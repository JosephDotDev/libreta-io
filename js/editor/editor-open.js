/* ═══════════════════════════════════════════════
   EDITOR — open
═══════════════════════════════════════════════ */
/* The default database every new top-level document joins, so all docs share
   the same sortable/trackable properties out of the box. Created on first use. */
/* ── Page creation ──
   A new page is a clean, standalone document (Notion model): no inherited schema,
   its own `props`. A page only gains *shared* properties by being created INSIDE a
   database (see js/db — idbAddRow / idbBoardAddRow). We no longer staple new pages
   into a hidden "default" database. */
function newDoc(){
  const d=blankDoc();
  DB.saveDoc(d); nav('editor',d.id);
}
/* ── One-time migration: decouple pages from the old default database ──
   Earlier builds stapled every "+ New page" into a hidden default DB, so every page
   inherited its Status / Due Date columns. This converts those rows back into true
   standalone pages — preserving any value the user actually set as a page-local
   property, dropping the empty ones — then retires the default-DB concept.
   Idempotent: guarded by cfg.docModelV2. */
function _colToPageProp(col,v){
  const tmap={status:'select',select:'select',multiselect:'multiselect',date:'date',text:'text',number:'number',checkbox:'checkbox',url:'url'};
  const type=tmap[col.type]||'text';
  const p={id:mkId('p'),name:col.name||type,type,value:v};
  if(type==='select'||type==='multiselect') p.options=(col.options||[]).map(o=>({l:o.l,c:o.c}));
  return p;
}
function migrateDecoupleDefaultDb(){
  const cfg=getCfg();
  if(cfg.docModelV2) return;
  const defId=cfg.defaultDbId;
  if(defId){
    const tbl=DB.getTbl(defId);
    if(tbl){
      const titleColId=(typeof idbTitleCol==='function'?idbTitleCol(tbl):null)?.id;
      (tbl.rows||[]).slice().forEach(row=>{
        if(!row.docId) return;                       // not a page-backed row — leave it
        const doc=DB.getDoc(row.docId); if(!doc) return;
        const carried=[];
        (tbl.columns||[]).forEach(col=>{
          if(col.id===titleColId) return;            // title already lives on doc.title
          const v=row.cells?.[col.id];
          if(v==null||v===''||(Array.isArray(v)&&!v.length)) return;   // drop empty/unused fields
          carried.push(_colToPageProp(col,v));
        });
        doc.props=(doc.props||[]).concat(carried);
        delete doc.dbId; delete doc.rowId;           // now a standalone page
        DB.saveDoc(doc);
      });
      tbl.rows=(tbl.rows||[]).filter(r=>!r.docId);   // keep any genuine (non-page) rows
      if(!tbl.rows.length){ if(typeof DB.delTbl==='function') DB.delTbl(tbl.id); }
      else DB.saveTbl(tbl);
    }
    delete cfg.defaultDbId;
  }
  cfg.docModelV2=true;
  localStorage.setItem(CFG_KEY,JSON.stringify(cfg));
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
  if(typeof renderPageBg==='function') renderPageBg(doc);
  renderEditorIcon(doc);
  renderFavBtn(doc);
  renderBlocks(); renderProps();
  const _d=DB.getDoc(id);if(_d)renderFmtBar(_d);
  if(typeof renderOutline==='function') renderOutline();   // rebuild the sections rail for this page
  if(typeof renderBacklinks==='function') renderBacklinks(id);   // pages that link here
  if(opts.keepScroll) return; // live refresh: leave scroll, focus, and history untouched
  snapshotVersion(doc,{force:true}); // baseline: the saved state at open (de-duped if unchanged)
  initHistory();
  const sc=document.getElementById('blocks-sc'); if(sc) sc.scrollTop=0; // start at top (cover expanded)
  // A page with no title yet (brand-new page, or a fresh DB entry opened as a page)
  // starts in the title field so naming is the first step; an already-titled page
  // focuses the body so you resume writing where the content is.
  setTimeout(()=>{
    if(!doc.title){
      const t=document.getElementById('ed-title');
      if(t){ t.focus({preventScroll:true}); const n=t.value.length; try{t.setSelectionRange(n,n);}catch(_){}}
      if(sc) sc.scrollTop=0;
      return;
    }
    const el=document.querySelector('.bk');if(el){el.focus({preventScroll:true});putCursorEnd(el);if(sc)sc.scrollTop=0;onEditorScroll({currentTarget:sc})}
  },50);
}

