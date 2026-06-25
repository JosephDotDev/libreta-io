/* ═══════════════════════════════════════════════
   FLOW MODE  (distraction-free writing)

   Toggles body.flow-mode, which dims the chrome (sidebar, topbar, gutters,
   property/format bars) and centers the writing column. A small floating bar
   shows live word count + reading time. Toggle with ⌘. / the topbar button;
   Esc exits (unless a popover is open, which Esc should close first).
═══════════════════════════════════════════════ */
let _flowInput=null;
function flowOn(){ return document.body.classList.contains('flow-mode'); }
function toggleFlow(){ flowOn()?exitFlow():enterFlow(); }
function enterFlow(){
  if(typeof S!=='undefined' && S.view!=='editor'){ if(typeof toast==='function') toast('Open a page to enter Flow mode',{type:'info'}); return; }
  if(typeof closeAll==='function') closeAll();           // tidy any open menus first
  document.body.classList.add('flow-mode');
  flowUpdateStats();
  const sc=document.getElementById('blocks-sc');
  if(sc){ _flowInput=()=>flowUpdateStats(); sc.addEventListener('input',_flowInput); }
}
function exitFlow(){
  if(!flowOn()) return;
  document.body.classList.remove('flow-mode');
  const sc=document.getElementById('blocks-sc');
  if(sc&&_flowInput){ sc.removeEventListener('input',_flowInput); _flowInput=null; }
}
function _flowWordCount(){
  if(typeof flattenBlocks!=='function'||typeof S==='undefined') return 0;
  const leaves=flattenBlocks(S.blocks||[]);
  const raw=leaves.filter(b=>!['divider','database','image','file','carousel','youtube','grid','math'].includes(b.type))
    .map(b=>(b.content||'').replace(/<[^>]+>/g,' ')).join(' ');
  const dec=document.createElement('textarea'); dec.innerHTML=raw;
  return dec.value.trim().split(/\s+/).filter(Boolean).length;
}
function flowUpdateStats(){
  const wc=_flowWordCount();
  const w=document.getElementById('flow-words'); if(w) w.textContent=wc.toLocaleString()+' word'+(wc!==1?'s':'');
  const r=document.getElementById('flow-read'); if(r) r.textContent='~'+Math.max(1,Math.round(wc/200))+' min';
}
/* ⌘. / Ctrl-. toggles; Esc exits when active (capture phase, but yield to any open popover). */
document.addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key==='.'){ e.preventDefault(); toggleFlow(); return; }
  if(e.key==='Escape'&&flowOn()){
    if(document.querySelector('#slash-menu.open,#bk-menu.open,#cmdk.open,#prop-editor.open,#icon-picker.open,#link-pop.open,#filter-pop.open')) return;
    e.stopPropagation(); exitFlow();
  }
},true);
