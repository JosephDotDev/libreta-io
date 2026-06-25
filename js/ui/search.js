/* ═══════════════════════════════════════════════
   SEARCH  (sidebar, in-memory index)

   A lazily-built index of every document (title + extracted block text) is
   cached and only rebuilt when documents change (DB.saveDoc / DB.delDoc flip
   _searchDirty). Queries run as a debounced substring match ranked by where
   the hit lands (title-start > title > body), so typing stays snappy even
   with hundreds of pages.
═══════════════════════════════════════════════ */
let _searchIdx=null;          // [{id,title,icon,titleLow,bodyLow}]
let _searchDirty=true;
let _searchT=null;
function searchInvalidate(){ _searchDirty=true; }

function _docPlainText(doc){
  const leaves=(typeof flattenBlocks==='function')?flattenBlocks(doc.blocks||[]):(doc.blocks||[]);
  const parts=[];
  for(const b of leaves){
    if(!b) continue;
    if(typeof b.content==='string'&&b.content){ const d=document.createElement('div'); d.innerHTML=b.content; parts.push(d.textContent||''); }
    if(b.caption) parts.push(b.caption);
    if(parts.join(' ').length>4000) break; // cap per doc — long bodies don't need full indexing
  }
  return parts.join(' ');
}
function buildSearchIndex(){
  if(_searchIdx&&!_searchDirty) return _searchIdx;
  const docs=DB.getDocs().filter(d=>d.id!==HOME_ID);
  _searchIdx=docs.map(d=>({
    id:d.id,
    title:d.title||'Untitled',
    icon:d.meta&&d.meta.icon||'',
    titleLow:(d.title||'untitled').toLowerCase(),
    bodyLow:_docPlainText(d).toLowerCase(),
  }));
  _searchDirty=false;
  return _searchIdx;
}
function runSearch(q){
  q=(q||'').trim().toLowerCase(); if(!q) return [];
  const idx=buildSearchIndex();
  const hits=[];
  for(const e of idx){
    let score=-1;
    if(e.titleLow.startsWith(q)) score=0;
    else if(e.titleLow.includes(q)) score=1;
    else if(e.bodyLow.includes(q)) score=2;
    if(score>=0) hits.push({e,score});
  }
  hits.sort((a,b)=> a.score-b.score || a.e.title.localeCompare(b.e.title));
  return hits.slice(0,14).map(h=>h.e);
}
function _searchSnippet(id,q){
  const e=_searchIdx&&_searchIdx.find(x=>x.id===id); if(!e) return '';
  const i=e.bodyLow.indexOf(q); if(i<0) return '';
  const start=Math.max(0,i-24);
  return (start>0?'…':'')+e.bodyLow.slice(start,i+q.length+40).replace(/\s+/g,' ').trim()+'…';
}
function onSearchInput(v){
  document.getElementById('sb-search-x').style.display=v?'block':'none';
  clearTimeout(_searchT);
  // read the live value when the timer fires, so a stale tick can't re-open cleared results
  _searchT=setTimeout(()=>{ const inp=document.getElementById('sb-search-input'); renderSearchResults(inp?inp.value:''); },110);
}
function renderSearchResults(v){
  const box=document.getElementById('sb-search-results'); if(!box) return;
  const q=(v||'').trim();
  if(!q){ box.style.display='none'; box.innerHTML=''; document.body.classList.remove('sb-searching'); return; }
  const res=runSearch(q); const ql=q.toLowerCase();
  document.body.classList.add('sb-searching');
  box.style.display='block';
  if(!res.length){ box.innerHTML=`<div class="sb-sr-empty">No pages match “${escHtml(q)}”.</div>`; return; }
  box.innerHTML=res.map(e=>{
    const ico=e.icon?`<span class="sb-sr-ico">${iconHtml(e.icon,'15px')}</span>`
      :`<span class="sb-sr-ico"><svg viewBox="0 0 16 16"><path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6L9 1z"/><path d="M9 1v5h5"/></svg></span>`;
    const snip=_searchSnippet(e.id,ql);
    return `<div class="sb-sr-it" onclick="openSearchResult('${e.id}')">${ico}<div class="sb-sr-tx"><div class="sb-sr-nm">${escHtml(e.title)}</div>${snip?`<div class="sb-sr-snip">${escHtml(snip)}</div>`:''}</div></div>`;
  }).join('');
}
function openSearchResult(id){ clearSearch(); nav('editor',id); }
function clearSearch(){
  clearTimeout(_searchT); // cancel any pending debounced render so it can't re-open results
  const inp=document.getElementById('sb-search-input'); if(inp) inp.value='';
  document.getElementById('sb-search-x').style.display='none';
  const box=document.getElementById('sb-search-results'); if(box){ box.style.display='none'; box.innerHTML=''; }
  document.body.classList.remove('sb-searching');
}
function onSearchKey(e){
  if(e.key==='Escape'){ clearSearch(); e.target.blur(); }
  else if(e.key==='Enter'){ const first=document.querySelector('#sb-search-results .sb-sr-it'); if(first) first.click(); }
}
function focusSidebarSearch(){
  if(document.body.classList.contains('sb-collapsed')) toggleSidebar();
  const inp=document.getElementById('sb-search-input'); if(inp){ inp.focus(); inp.select(); }
}
/* ⌘K / Ctrl-K focuses the sidebar search (replaces the old modal stub). */
document.addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); if(typeof openCmdK==='function') openCmdK(); else focusSidebarSearch(); }
});
function cmdK(){ if(typeof openCmdK==='function') openCmdK(); else focusSidebarSearch(); } // legacy callers
