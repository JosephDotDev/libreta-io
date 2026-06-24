/* ═══════════════════════════════════════════════
   LEFT SIDEBAR COLLAPSE
═══════════════════════════════════════════════ */
/* The toggle lives in the topbar (left of back/forward) and uses a static sidebar
   icon; we update its title + a `collapsed` class for state rather than swapping a glyph. */
function syncSbToggle(collapsed){
  const tog=document.getElementById('sb-toggle');
  if(tog){ tog.title=collapsed?'Expand sidebar':'Collapse sidebar'; tog.classList.toggle('collapsed',collapsed); tog.setAttribute('aria-pressed',collapsed?'true':'false'); }
}
function toggleSidebar(){
  const collapsed=document.body.classList.toggle('sb-collapsed');
  localStorage.setItem('folio_sb_collapsed',collapsed?'1':'0');
  syncSbToggle(collapsed);
}
function restoreSidebar(){
  const collapsed=localStorage.getItem('folio_sb_collapsed')==='1';
  if(collapsed) document.body.classList.add('sb-collapsed');
  syncSbToggle(collapsed);
}

/* ── Mobile / narrow-viewport drawer ──
   On phones and narrow second monitors the sidebar slides in over the content
   (off-canvas) instead of stealing horizontal space. The hamburger in the topbar
   opens it; tapping the backdrop or navigating closes it. */
function toggleMobileSidebar(){ document.body.classList.toggle('sb-mobile-open'); }
function closeMobileSidebar(){ document.body.classList.remove('sb-mobile-open'); }

/* ── Sidebar Favorites + Recents menus (collapsible) ── */
function getSbGroups(){ try{return JSON.parse(localStorage.getItem('folio_sb_groups'))||{}}catch{return{}} }
function toggleSbGroup(key){ const g=getSbGroups(); g[key]=!g[key]; localStorage.setItem('folio_sb_groups',JSON.stringify(g)); renderSidebarLists(); }
function sbItemHtml(d){
  const ico=d.meta?.icon?`<span class="sb-it-ico">${iconHtml(d.meta.icon,'14px')}</span>`
    :`<span class="sb-it-ico"><svg viewBox="0 0 16 16"><path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6L9 1z"/><path d="M9 1v5h5"/></svg></span>`;
  const active=(S.view==='editor'&&S.docId===d.id)?' active':'';
  return `<button class="sb-list-it${active}" onclick="nav('editor','${d.id}')" title="${escAttr(d.title||'Untitled')}">${ico}<span class="sb-it-nm">${escHtml(d.title||'Untitled')}</span></button>`;
}
function renderSidebarLists(){
  const g=getSbGroups(); const docs=DB.getDocs();
  // Favorites
  const favs=docs.filter(isFav).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,20);
  const favG=document.getElementById('sb-favorites');
  if(favG){
    favG.style.display=favs.length?'block':'none';
    const collapsed=!!g.favorites; favG.querySelector('.sb-list-chev').classList.toggle('collapsed',collapsed);
    document.getElementById('sb-fav-list').innerHTML=collapsed?'':favs.map(sbItemHtml).join('');
  }
  // Recents
  const rec=[...docs].sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,8);
  const recG=document.getElementById('sb-recents');
  if(recG){
    recG.style.display=rec.length?'block':'none';
    const collapsed=!!g.recents; recG.querySelector('.sb-list-chev').classList.toggle('collapsed',collapsed);
    document.getElementById('sb-rec-list').innerHTML=collapsed?'':rec.map(sbItemHtml).join('');
  }
  // Customizable page tree + hidden pages
  if(typeof renderSidebarTree==='function') renderSidebarTree();
  if(typeof renderHiddenList==='function') renderHiddenList();
  if(typeof updateTrashBadge==='function') updateTrashBadge();
}
/* Lazy, coalesced sidebar refresh for the autosave path — keeps tree rebuilds off the
   typing hot path. Direct structural changes (create/delete/rename) still call
   renderSidebarLists() for an immediate update. */
let _sbListsT=null;
function renderSidebarListsSoon(){ clearTimeout(_sbListsT); _sbListsT=setTimeout(renderSidebarLists,1200); }

