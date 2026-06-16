/* ═══════════════════════════════════════════════
   EDITOR — open
═══════════════════════════════════════════════ */
/* The default database every new top-level document joins, so all docs share
   the same sortable/trackable properties out of the box. Created on first use. */
function getDefaultDb(){
  const cfg=getCfg();
  let t=cfg.defaultDbId?DB.getTbl(cfg.defaultDbId):null;
  if(!t){
    t=blankTbl(); t.name='Videos'; DB.saveTbl(t);
    const c=getCfg(); c.defaultDbId=t.id; localStorage.setItem(CFG_KEY,JSON.stringify(c));
  }
  return t;
}
/* Attach a doc as an entry (row) in a database so it gains the shared properties. */
function attachDocToDb(doc,tbl){
  const cells={}; tbl.columns.forEach(c=>cells[c.id]='');
  const _tc=idbTitleCol(tbl); if(_tc) cells[_tc.id]=doc.title||'';
  const row={id:mkId('r'),cells,docId:doc.id};
  tbl.rows.push(row); DB.saveTbl(tbl);
  doc.dbId=tbl.id; doc.rowId=row.id;
  return row;
}
function newDoc(){
  const d=blankDoc();
  attachDocToDb(d,getDefaultDb());
  DB.saveDoc(d); nav('editor',d.id);
}
/* opts.keepScroll — used by live cross-device sync to refresh the page content in
   place: it skips the scroll-to-top, the autofocus, and the version baseline so a
   background data update doesn't disturb what the user is reading or spam history. */
function openEditor(id,opts){
  opts=opts||{};
  const doc=DB.getDoc(id);
  // Navigating to a page that no longer exists (e.g. a stale breadcrumb to a
  // deleted ancestor) must NOT resurrect it — bail out before pointing state at it.
  if(!doc){ S.docId=null; if(typeof toast==='function') toast('That page no longer exists'); nav('home'); return; }
  S.docId=id;
  S.blocks=doc.blocks&&doc.blocks.length?doc.blocks:[mkBlock('paragraph')];
  ensureTrailingParagraph(); // keep a place to type/'/' after terminal blocks (e.g. databases)
  S.props=doc.props||[];
  // If this doc is an entry in a database, its shared properties come from that DB's columns.
  S.dbRow=(doc.dbId&&doc.rowId&&DB.getTbl(doc.dbId)&&DB.getTbl(doc.dbId).rows.find(r=>r.id===doc.rowId))?{tableId:doc.dbId,rowId:doc.rowId}:null;
  document.getElementById('ed-title').value=doc.title;
  document.getElementById('page-title').textContent=doc.title||'Untitled';
  if(typeof autoGrowTitle==='function') setTimeout(autoGrowTitle,0); // wrap-height after the view is visible
  renderCover(doc);
  renderEditorIcon(doc);
  renderFavBtn(doc);
  renderBlocks(); renderProps();
  const _d=DB.getDoc(id);if(_d)renderFmtBar(_d);
  if(typeof renderOutline==='function') renderOutline();   // rebuild the sections rail for this page
  if(opts.keepScroll) return; // live refresh: leave scroll, focus, and history untouched
  snapshotVersion(doc,{force:true}); // baseline: the saved state at open (de-duped if unchanged)
  initHistory();
  const sc=document.getElementById('blocks-sc'); if(sc) sc.scrollTop=0; // start at top (cover expanded)
  // Focus first block (without yanking the scroll past the cover)
  setTimeout(()=>{const el=document.querySelector('.bk');if(el){el.focus({preventScroll:true});putCursorEnd(el);if(sc)sc.scrollTop=0;onEditorScroll({currentTarget:sc})}},50);
}

