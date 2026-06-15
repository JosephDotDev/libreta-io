/* Persist a DB block's view prefs. Inline blocks live in the doc (sched);
   the full-page database stores them on the table itself. */
function idbPersistView(blk){
  if(blk.id==='__pagedb__'){const t=idbTbl(blk);if(t){t._view=blk.view;t._groupCol=blk.groupCol;t._dateCol=blk.dateCol;t._calYM=blk.calYM;t._filters=blk.filters;t._sort=blk.sort;t._hiddenCols=blk.hiddenCols;t._groupCollapsed=blk.groupCollapsed;t._colWidths=blk.colWidths;t._tlDesc=blk.tlDesc;t._colorRules=blk.colorRules;t._hiddenGroups=blk.hiddenGroups;t._hideGroupCount=blk.hideGroupCount;DB.saveTbl(t);}}
  else sched();
}
function idbSetView(blockId,view){
  const blk=findBlock(blockId); if(!blk)return; blk.view=view;
  const tbl=idbTbl(blk);
  if(view==='board'&&!blk.groupCol){const c=tbl.columns.find(isSelectish);blk.groupCol=c?c.id:null;}
  if((view==='calendar'||view==='timeline')&&!blk.dateCol){const c=tbl.columns.find(c=>c.type==='date');blk.dateCol=c?c.id:null;}
  idbPersistView(blk); reRenderBlock(blockId);
}
function idbSetGroup(blockId,colId){const blk=findBlock(blockId);if(blk){blk.groupCol=colId||null;idbPersistView(blk);reRenderBlock(blockId);}}
function idbToggleGroup(blockId,gk){const blk=findBlock(blockId);if(!blk)return;blk.groupCollapsed=blk.groupCollapsed||{};blk.groupCollapsed[gk]=!blk.groupCollapsed[gk];idbPersistView(blk);reRenderBlock(blockId);}
function idbSetDateCol(blockId,colId){const blk=findBlock(blockId);if(blk){blk.dateCol=colId;idbPersistView(blk);reRenderBlock(blockId);}}
/* Ensure a row has a backing document, returning its id. */
function idbEnsureRowDoc(tbl,row){
  if(!row.docId){
    const d=blankDoc(); d.dbId=tbl.id; d.rowId=row.id;
    d.title=idbRowTitle(tbl,row)||'Untitled';
    DB.saveDoc(d); row.docId=d.id; DB.saveTbl(tbl);
  } else if(!DB.getDoc(row.docId)){
    const d=blankDoc(); d.id=row.docId; d.dbId=tbl.id; d.rowId=row.id;
    d.title=idbRowTitle(tbl,row)||'Untitled'; DB.saveDoc(d);
  }
  return row.docId;
}
function idbOpenRow(blockId,rowId){
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const row=tbl.rows.find(r=>r.id===rowId); if(!row)return;
  openDocPeek(idbEnsureRowDoc(tbl,row));
}
/* \u2500\u2500 DOCUMENT PEEK (side / centered preview) \u2500\u2500
   Opens an entry in a quick-edit panel without leaving the page. Mode is set in
   settings (cfg.openMode = 'peek' | 'center' | 'full'). It reuses the block/prop
   editor by temporarily pointing the shared editor state at the peeked doc. */
function openDocPeek(docId){
  const doc=DB.getDoc(docId); if(!doc) return;
  const mode=getCfg().openMode||'peek';
  if(mode==='full'){ clearTimeout(S.saveTimer); flushSave(); nav('editor',docId); return; }
  if(S.peekOpen) closeDocPeek(); // swap to the new doc
  clearTimeout(S.saveTimer); flushSave();
  S.peekHost={docId:S.docId, view:S.view};
  S.peekOpen=true; S.docId=docId;
  S.blocks=doc.blocks&&doc.blocks.length?doc.blocks:[mkBlock('paragraph')];
  ensureTrailingParagraph();
  S.props=doc.props||[];
  S.dbRow=(doc.dbId&&doc.rowId&&DB.getTbl(doc.dbId)&&DB.getTbl(doc.dbId).rows.find(r=>r.id===doc.rowId))?{tableId:doc.dbId,rowId:doc.rowId}:null;
  const peek=document.getElementById('doc-peek');
  peek.className='doc-peek open '+(mode==='center'?'mode-center':'mode-side');
  document.getElementById('peek-title').value=doc.title||'';
  renderBlocks('peek-blocks'); renderProps(); initHistory();
  setTimeout(()=>{const el=document.querySelector('#peek-blocks .bk');if(el){el.focus();}},90);
}
function closeDocPeek(){
  if(!S.peekOpen) return;
  clearTimeout(S.saveTimer); flushSave(); // persist the peeked doc
  const tableId=S.dbRow?S.dbRow.tableId:null;
  S.peekOpen=false;
  document.getElementById('doc-peek').classList.remove('open');
  const host=S.peekHost||{}; S.peekHost=null;
  S.docId=host.docId||null; S.dbRow=null;
  // Restore the host view's editor state + refresh any DB blocks that show this row.
  if(host.view==='editor'&&host.docId){
    const hd=DB.getDoc(host.docId);
    if(hd){
      S.blocks=hd.blocks&&hd.blocks.length?hd.blocks:[mkBlock('paragraph')];
      S.props=hd.props||[]; ensureTrailingParagraph();
      S.dbRow=(hd.dbId&&hd.rowId&&DB.getTbl(hd.dbId)&&DB.getTbl(hd.dbId).rows.find(r=>r.id===hd.rowId))?{tableId:hd.dbId,rowId:hd.rowId}:null;
      renderBlocks('blocks-ct'); renderProps();
    }
  } else if(host.view==='tables'){
    renderPageDb();
  } else if(host.view==='overview'){ try{renderOverview();}catch(_){} }
  else if(tableId){ idbRerenderSiblings(tableId,null); }
}
function peekOpenFull(){ const id=S.docId; closeDocPeek(); if(id) nav('editor',id); }
function peekTitleInput(){
  const val=document.getElementById('peek-title').value;
  if(S.dbRow){const tbl=DB.getTbl(S.dbRow.tableId);const row=tbl&&tbl.rows.find(r=>r.id===S.dbRow.rowId);const _tc=idbTitleCol(tbl);if(tbl&&row&&_tc){row.cells[_tc.id]=val;DB.saveTbl(tbl);}}
  sched();
}
/* \u2500\u2500 BOARD VIEW (toolbar/group-by live in idbToolbar) \u2500\u2500 */
