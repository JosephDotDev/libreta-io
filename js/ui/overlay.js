/* ═══════════════════════════════════════════════
   OVERLAY
═══════════════════════════════════════════════ */
let ovlRef=0;
function openOvl(){ovlRef++;document.getElementById('ovl').classList.add('open')}
function closeOvlSafe(){ovlRef=Math.max(0,ovlRef-1);if(ovlRef===0)document.getElementById('ovl').classList.remove('open')}
function closeAll(){
  ovlRef=0; document.getElementById('ovl').classList.remove('open');
  ['slash-menu','bk-menu','pm-sel','pm-dp','pm-ptp','prop-editor','color-pal','icon-picker','filter-pop','col-chooser','link-pop','idb-colpop','idb-filterpop','idb-rowmenu','idb-pop','fmt-color-pop','cmdk','shortcuts'].forEach(id=>document.getElementById(id)?.classList.remove('open'));
  const _dd=document.getElementById('tbl-dd'); if(_dd&&_dd.style.display==='block'&&_selCtx&&_selCtx.rerender){const cb=_selCtx.rerender;_selCtx=null;cb();}
  document.getElementById('tbl-dd').style.display='none';
  const _sbm=document.getElementById('sb-menu'); if(_sbm) _sbm.style.display='none';
  S.slashId=null; S.editPropId=null; _colPop=null; _selCtx=null; _filterDraft=null;
}
// Lightbox / version preview Esc run first (capture) and swallow the key so nothing else also closes.
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape') return;
  const lb=document.getElementById('imglb');
  if(lb&&lb.classList.contains('open')){ e.stopPropagation(); closeImgLightbox(); return; }
  const vp=document.getElementById('vh-preview');
  if(vp&&vp.classList.contains('open')){ e.stopPropagation(); closeVersionPreview(); return; }
  const vpan=document.getElementById('vh-panel');
  if(vpan&&vpan.classList.contains('open')){ e.stopPropagation(); closeVersionPanel(); }
},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll()});
/* Escape closes the doc peek — but only when no popover inside it is open (capture
   phase runs before the closeAll handler so we can decide first). */
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||!S.peekOpen) return;
  if(_selCtx||document.querySelector('#idb-colpop.open,#idb-filterpop.open,#idb-rowmenu.open,#bk-menu.open,#slash-menu.open,#pm-dp.open,#pm-ptp.open,#icon-picker.open,#prop-editor.open')) return;
  e.stopPropagation(); closeDocPeek();
},true);
/* Scrolling while a transient popover is open closes it and passes the scroll
   through to the writing area (the full-screen overlay otherwise blocks it). */
const TRANSIENT_SEL='#bk-menu,#slash-menu,#filter-pop,#pm-ptp,#pm-sel,#col-chooser,#tbl-dd';
document.addEventListener('wheel',e=>{
  const anyOpen=document.querySelector('#bk-menu.open,#slash-menu.open,#filter-pop.open,#pm-ptp.open,#pm-sel.open,#col-chooser.open');
  const dd=document.getElementById('tbl-dd');
  const ddOpen=dd&&dd.style.display==='block';
  if(!anyOpen&&!ddOpen) return;
  // If the wheel is happening inside the popover itself, let it scroll internally.
  if(e.target.closest(TRANSIENT_SEL)) return;
  closeAll();
  // Nudge the active writing scroller so this same gesture moves the page.
  const sc=(S.view==='overview')?document.querySelector('.ov-panel-body'):document.getElementById('blocks-sc');
  if(sc) sc.scrollTop+=e.deltaY;
},{passive:true});
function cmdK(){alert('Search coming soon!')}

/* ═══════════════════════════════════════════════
   HOME + DOCS LIST
═══════════════════════════════════════════════ */
