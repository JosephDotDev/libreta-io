/* ═══════════════════════════════════════════════
   ROUTER
═══════════════════════════════════════════════ */
function nav(view,id){
  // Close any open side-peek first so its edits flush to the peeked doc and the shared
  // editing state is re-pointed at the host — never carried into the destination view.
  if(S.peekOpen && typeof closeDocPeek==='function') closeDocPeek();
  if(S.view==='editor'||S.view==='home'){clearTimeout(S.saveTimer);flushSave()}
  // Databases + Overview pages were removed; databases now live inline in pages.
  const viewEl=document.getElementById('view-'+view);
  if(!viewEl){ if(view!=='home') return nav('home'); return; }
  document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
  viewEl.classList.remove('hidden');
  document.querySelectorAll('.nav-it').forEach(n=>n.classList.remove('active'));
  const ni=document.querySelector(`[data-nav="${view}"]`);if(ni)ni.classList.add('active');
  const lbls={home:'Home',documents:'Documents',editor:'Editor',calendar:'Calendar',tasks:'Tasks',databases:'Databases'};
  document.getElementById('page-title').textContent=lbls[view]||view;
  S.view=view;
  document.body.setAttribute('data-view',view); // drives ribbon page-settings button visibility
  if(view==='home')      renderHome();
  if(view==='documents') renderDocList();
  if(view==='editor')    openEditor(id);
  if(view==='calendar')  renderCal();
  if(view==='tasks')     renderTasks();
  if(view==='databases') openTbl((S.tblId&&S.tblId!=='__all_docs__'&&DB.getTbl(S.tblId))?S.tblId:'__all_docs__');
  if(!_navSuppress) navHistoryPush(view,id);
  renderBreadcrumbs(view,id);
  renderSidebarLists();
  if(typeof closeMobileSidebar==='function') closeMobileSidebar(); // dismiss the mobile drawer after a jump
  if(typeof clearMsSel==='function') clearMsSel(); // drop any stale block selection
  // For databases the deep-link id is the open table (tracked in S.tblId), so the
  // generic trailing write doesn't clobber #/db/<id> back to #/databases.
  writeRoute(view, view==='databases'?((S.tblId&&S.tblId!=='__all_docs__')?S.tblId:null):id);
}

/* Re-render whatever the user is currently looking at, in place — no history
   push, no scroll reset, no autofocus. Used by live cross-device sync so a
   background data refresh updates the page content without a jarring full reload
   (which would flash the loading screen and jump back to the top). */
function rerenderView(){
  const view=S.view;
  if(view==='editor'){
    if(!S.docId||!DB.getDoc(S.docId)){ nav('home'); return; }
    openEditor(S.docId,{keepScroll:true});
  }
  else if(view==='home')      renderHome();
  else if(view==='documents') renderDocList();
  else if(view==='calendar')  renderCal();
  else if(view==='tasks')     renderTasks();
  else return; // unknown view — nothing to refresh
  if(typeof renderBreadcrumbs==='function') renderBreadcrumbs(view,S.docId);
  if(typeof renderSidebarLists==='function') renderSidebarLists();
}

/* ── URL (hash) ROUTING ── Notion-style: every page has a stable URL, kept in
   the location hash so it works on any static server (no rewrite rules).
   - navigating writes #/route → refresh and deep links restore the exact page
   - the browser's own back/forward walk the trail via the hashchange event
   Routes: #/home  #/docs  #/doc/<docId>  #/databases  #/db/<tableId>
           #/calendar  #/overview */
let _hashWriting=false;
function routeFor(view,id){
  switch(view){
    case 'home':      return '#/home';
    case 'documents': return '#/docs';
    case 'editor':    return id?('#/doc/'+id):'#/docs';
    case 'calendar':  return '#/calendar';
    case 'tasks':     return '#/tasks';
    case 'databases': return (id&&id!=='__all_docs__')?('#/db/'+id):'#/databases';
    default:          return '#/home';
  }
}
function writeRoute(view,id){
  const h=routeFor(view,id);
  if(location.hash===h) return;
  _hashWriting=true;
  if(!location.hash) history.replaceState(null,'',h); // first write: don't add a history entry
  else location.hash=h;
  setTimeout(()=>{_hashWriting=false;},0);
}
function parseRoute(){
  const h=decodeURIComponent(location.hash||'');
  let m;
  if((m=h.match(/^#\/doc\/(.+)$/))) return {view:'editor',id:m[1]};
  if((m=h.match(/^#\/db\/(.+)$/)))  return {view:'databases',tblId:m[1]};
  if(h==='#/databases') return {view:'databases'};
  if(h==='#/docs')      return {view:'documents'};
  if(h==='#/calendar')  return {view:'calendar'};
  if(h==='#/tasks')     return {view:'tasks'};
  return {view:'home'};
}
function applyRoute(r){
  if(r.view==='editor'){
    if(r.id&&DB.getDoc(r.id)) nav('editor',r.id);
    else { toast('That page no longer exists'); nav('home'); }
    return;
  }
  if(r.view==='databases'&&r.tblId){
    if(DB.getTbl(r.tblId)){ nav('databases'); openTbl(r.tblId); }
    else { toast('That database no longer exists'); nav('databases'); }
    return;
  }
  nav(r.view);
}
window.addEventListener('hashchange',()=>{
  if(_hashWriting){_hashWriting=false;return;}
  applyRoute(parseRoute()); // user-driven: browser back/forward or a hand-edited URL
});

