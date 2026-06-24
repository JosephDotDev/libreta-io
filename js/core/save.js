/* ═══════════════════════════════════════════════
   SAVE
═══════════════════════════════════════════════ */
function saveBlk(id,html){const b=findBlock(id);if(b)b.content=html;sched()}
function sched(){
  clearTimeout(S.saveTimer);S.saveTimer=setTimeout(flushSave,700);
  clearTimeout(S.histTimer);S.histTimer=setTimeout(commitHistory,500);
  if(typeof outlineRefreshSoon==='function') outlineRefreshSoon();   // keep the sections rail current
}
function flushSave(){
  if(!S.docId) return;
  if(S.docId===HOME_ID){
    const hd=getHomeDoc(); hd.blocks=S.blocks;
    const ti=document.getElementById('home-title-input'); if(ti) hd.title=ti.value;
    saveHomeDoc(hd); return true;
  }
  const doc=DB.getDoc(S.docId)||{id:S.docId,createdAt:new Date().toISOString()};
  const titleEl=document.getElementById(S.peekOpen?'peek-title':(S.view==='overview'?'ov-panel-title':'ed-title'));
  doc.title=titleEl?.value??doc.title??'';
  doc.blocks=S.blocks; doc.props=S.props; doc.fmt=doc.fmt||{};
  const leaves=flattenBlocks(S.blocks);
  // Word count: strip tags with a regex and decode entities in ONE pass, rather than
  // building a <div> per block and reading innerText (which forced a layout per block).
  const raw=leaves.filter(b=>!['divider','database','image','file','carousel','youtube','grid','math'].includes(b.type))
    .map(b=>(b.content||'').replace(/<[^>]+>/g,' ')).join(' ');
  const dec=document.createElement('textarea'); dec.innerHTML=raw;
  const wc=dec.value.trim().split(/\s+/).filter(Boolean).length;
  doc.meta=Object.assign({version:1,pinned:false,icon:'',tags:[]},doc.meta||{},{
    wordCount:wc,blockCount:leaves.length,readingTime:Math.max(1,Math.round(wc/200)),
    lastSaved:new Date().toISOString(),
  });
  const ok=DB.saveDoc(doc);
  if(ok!==false) snapshotVersion(doc); // periodic version snapshot (throttled internally)
  document.getElementById('page-title').textContent=doc.title||'Untitled';
  // Refresh overview table title live
  if(S.view==='overview') renderOvRows();
  // Sidebar (favorites/recents/tree) only reflects titles + ordering, never the body
  // text being typed — rebuild it on a lazy debounce so it doesn't rebuild the tree DOM
  // on every typing pause and compete with the next keystroke.
  renderSidebarListsSoon();
  return ok;
}
function autoGrowTitle(){ const el=document.getElementById('ed-title'); if(el&&el.tagName==='TEXTAREA'){ el.style.height='auto'; el.style.height=el.scrollHeight+'px'; } }
function onTitleKey(e){ if(e.key==='Enter'){ e.preventDefault(); const first=document.querySelector('#blocks-ct .bk'); if(first){ first.focus(); if(typeof putCursorStart==='function') putCursorStart(first); } } }
function onTitleInput(){
  autoGrowTitle();
  const val=document.getElementById('ed-title').value;
  document.getElementById('page-title').textContent=val||'Untitled';
  // Keep the database row's first column (the title) in sync.
  if(S.dbRow){const tbl=DB.getTbl(S.dbRow.tableId);const row=tbl&&tbl.rows.find(r=>r.id===S.dbRow.rowId);const _tc=idbTitleCol(tbl);if(tbl&&row&&_tc){row.cells[_tc.id]=val;DB.saveTbl(tbl);}}
  renderBreadcrumbs('editor',S.docId);sched();
}

