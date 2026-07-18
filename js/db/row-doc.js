/* Persist a DB block's view prefs. Inline blocks live in the doc (sched);
   the full-page database stores them on the table itself. */
function idbPersistView(blk){
  if(blk.id==='__pagedb__'){const t=idbTbl(blk);if(t){t._view=blk.view;t._groupCol=blk.groupCol;t._dateCol=blk.dateCol;t._calYM=blk.calYM;t._calView=blk.calView;t._calAnchorDS=blk.calAnchorDS;t._filters=blk.filters;t._sort=blk.sort;t._hiddenCols=blk.hiddenCols;t._groupCollapsed=blk.groupCollapsed;t._colWidths=blk.colWidths;t._tlDesc=blk.tlDesc;t._colorRules=blk.colorRules;t._hiddenGroups=blk.hiddenGroups;t._hideGroupCount=blk.hideGroupCount;t._groupPageSize=blk.groupPageSize;t._groupShown=blk.groupShown;DB.saveTbl(t);}}
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
    d.title=idbRowTitle(tbl,row)||'';   // empty → UI shows a soft "Untitled" placeholder
    DB.saveDoc(d); row.docId=d.id; DB.saveTbl(tbl);
  } else if(!DB.getDoc(row.docId)){
    const d=blankDoc(); d.id=row.docId; d.dbId=tbl.id; d.rowId=row.id;
    d.title=idbRowTitle(tbl,row)||''; DB.saveDoc(d);
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
  let mode=getCfg().openMode||'peek';
  // Side-peek is too cramped on a phone — open small screens as a full page instead
  // (desktop keeps the user's chosen default).
  if(window.innerWidth<=860 && mode==='peek') mode='full';
  if(mode==='full'){ clearTimeout(S.saveTimer); flushSave(); nav('editor',docId); return; }
  if(S.peekOpen) closeDocPeek(); // swap to the new doc
  clearTimeout(S.saveTimer); flushSave();
  S.peekHost={docId:S.docId, view:S.view};
  // Isolate undo: stash the host's stack so the peek's Ctrl+Z can only undo the peek
  // (never pop the host's edits), and the host keeps its history once the peek closes.
  S._peekHostHist={hist:S.hist||[], redo:S.histRedo||[], present:S.histPresent};
  S.peekOpen=true; S.docId=docId;
  S.blocks=doc.blocks&&doc.blocks.length?doc.blocks:[mkBlock('paragraph')];
  ensureTrailingParagraph();
  S.props=doc.props||[];
  S.dbRow=(doc.dbId&&doc.rowId&&DB.getTbl(doc.dbId)&&DB.getTbl(doc.dbId).rows.find(r=>r.id===doc.rowId))?{tableId:doc.dbId,rowId:doc.rowId}:null;
  const peek=document.getElementById('doc-peek');
  peek.className='doc-peek open '+(mode==='center'?'mode-center':'mode-side');
  // The peek panel sits at a high z-index; flag the body so the shared property /
  // menu popovers can lift above it (otherwise they open *behind* the peek).
  document.body.classList.add('peek-open');
  document.getElementById('peek-title').value=doc.title||'';
  renderBlocks('peek-blocks'); renderProps(); initHistory();
  if(typeof renderEditorIcon==='function') renderEditorIcon(doc);   // routes to the peek icon
  if(typeof renderCover==='function') renderCover(doc);             // routes to the peek cover
  // A still-unnamed entry (e.g. a just-created board card) starts in the title field
  // so naming is the first step; an already-titled entry focuses the body.
  setTimeout(()=>{
    if(!doc.title){ const t=document.getElementById('peek-title'); if(t){ t.focus(); const n=t.value.length; try{t.setSelectionRange(n,n);}catch(_){}} return; }
    const el=document.querySelector('#peek-blocks .bk');if(el){el.focus();}
  },90);
}
function closeDocPeek(){
  if(!S.peekOpen) return;
  if(typeof closeAll==='function') closeAll(); // dismiss any property/menu popover so it can't linger into the host/full view
  clearTimeout(S.saveTimer); flushSave(); // persist the peeked doc (S still points at it)
  const tableId=S.dbRow?S.dbRow.tableId:null;
  S.peekOpen=false;
  document.getElementById('doc-peek').classList.remove('open');
  document.body.classList.remove('peek-open');
  const host=S.peekHost||{}; S.peekHost=null;
  S.dbRow=null;
  // Re-point the shared editing state (docId + blocks + props) at the host doc BEFORE
  // anything can autosave. This MUST happen for every host view, not just the editor:
  // if S.blocks is left holding the peeked doc's content while S.docId points at the
  // host, the next flushSave (e.g. one triggered by Ctrl+Z) writes the peek's blocks
  // into the host doc — the "the side peek overwrote my page" data-loss bug.
  const hd=host.docId?DB.getDoc(host.docId):null;
  if(hd){
    S.docId=host.docId;
    S.blocks=hd.blocks&&hd.blocks.length?hd.blocks:[mkBlock('paragraph')];
    S.props=hd.props||[];
    ensureTrailingParagraph();
    S.dbRow=(hd.dbId&&hd.rowId&&DB.getTbl(hd.dbId)&&DB.getTbl(hd.dbId).rows.find(r=>r.id===hd.rowId))?{tableId:hd.dbId,rowId:hd.rowId}:null;
  } else {
    // No host doc to return to (e.g. opened from the databases page) — clear the
    // editing state entirely so no stray save can target a stale doc id.
    S.docId=null; S.blocks=[mkBlock('paragraph')]; S.props=[];
  }
  // Restore the host's own undo stack (the peek ran on an isolated one).
  if(S._peekHostHist){ S.hist=S._peekHostHist.hist; S.histRedo=S._peekHostHist.redo; S.histPresent=S._peekHostHist.present; S._peekHostHist=null; }
  // Refresh whatever host surface is on screen. Re-seed the editor's title field from
  // the HOST doc so the peeked item's title can never visually "stick" on the parent.
  if(host.view==='editor'&&hd){
    const t=document.getElementById('ed-title');
    if(t){ t.value=hd.title||''; if(typeof autoGrowTitle==='function') autoGrowTitle(); }
    const pt=document.getElementById('page-title'); if(pt) pt.textContent=hd.title||'Untitled';
    renderBlocks('blocks-ct'); renderProps();
  }
  else if(tableId){ idbRerenderSiblings(tableId,null); }
}
function peekOpenFull(){ const id=S.docId; closeDocPeek(); if(id) nav('editor',id); }
function peekTitleInput(){
  const val=document.getElementById('peek-title').value;
  if(S.dbRow){const tbl=DB.getTbl(S.dbRow.tableId);const row=tbl&&tbl.rows.find(r=>r.id===S.dbRow.rowId);const _tc=idbTitleCol(tbl);if(tbl&&row&&_tc){row.cells[_tc.id]=val;DB.saveTbl(tbl);}}
  sched();
}
/* \u2500\u2500 BOARD VIEW (toolbar/group-by live in idbToolbar) \u2500\u2500 */
