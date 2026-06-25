/* ═══════════════════════════════════════════════
   #8 NAVIGATION — history (back/forward) + breadcrumbs
═══════════════════════════════════════════════ */
/* #3 — transient toast + a shake-and-dim animation for rejected actions.
   Back-compat: toast(msg) and toast(msg, ms) still work. Pass an options object
   to get a meaning-tinted variant: toast(msg, {type:'success'|'info'|'warn'|'error'|'celebrate', ms}). */
const TOAST_ICON={success:'✓',info:'ℹ',warn:'!',error:'✕',celebrate:'🔥'};
function toast(msg,opt){
  const o=(typeof opt==='number')?{ms:opt}:(opt||{});
  let wrap=document.getElementById('toast-wrap');
  if(!wrap){wrap=document.createElement('div');wrap.id='toast-wrap';wrap.className='toast-wrap';document.body.appendChild(wrap)}
  const t=document.createElement('div'); t.className='toast'+(o.type?(' toast-'+o.type):'');
  if(o.type&&TOAST_ICON[o.type]){ const ic=document.createElement('span'); ic.className='toast-ic'; ic.textContent=TOAST_ICON[o.type]; t.appendChild(ic); }
  const tx=document.createElement('span'); tx.textContent=msg; t.appendChild(tx);
  wrap.appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),300)},o.ms||2400);
}
/* Sticky toast with a spinner that stays up until .done()/.fail() is called. */
function progressToast(msg){
  let wrap=document.getElementById('toast-wrap');
  if(!wrap){wrap=document.createElement('div');wrap.id='toast-wrap';wrap.className='toast-wrap';document.body.appendChild(wrap)}
  const t=document.createElement('div'); t.className='toast';
  const ic=document.createElement('span'); ic.className='toast-spin';
  const tx=document.createElement('span'); tx.textContent=msg;
  t.appendChild(ic); t.appendChild(tx); wrap.appendChild(t);
  let closed=false;
  function finish(message,ok,ms){
    if(closed) return; closed=true;
    ic.className='toast-tick'; ic.textContent=ok?'✓':'✕';
    if(!ok)t.classList.add('is-err');
    if(message)tx.textContent=message;
    setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),300)},ms||1800);
  }
  return{
    update:(m)=>{ if(!closed)tx.textContent=m; },
    done:(m)=>finish(m,true),
    fail:(m)=>finish(m,false,2600),
  };
}
function shakeEl(el){
  if(!el) return;
  el.classList.remove('shake-bad'); void el.offsetWidth; el.classList.add('shake-bad');
  setTimeout(()=>el.classList.remove('shake-bad'),470);
}

/* ── Built-in tooltips ── appear immediately on hover (no OS delay) and fade in/out.
   Any element with a data-tip="…" attribute gets one, positioned just below (or above
   if there's no room). Replaces sluggish native title= tooltips. */
let _tipEl=null,_tipHideT=null,_tipFor=null;
function _ensureTip(){ if(_tipEl) return _tipEl; _tipEl=document.createElement('div'); _tipEl.className='tip'; document.body.appendChild(_tipEl); return _tipEl; }
function showTip(el){
  const txt=el.getAttribute('data-tip'); if(!txt) return;
  _tipFor=el; clearTimeout(_tipHideT);
  const t=_ensureTip(); t.textContent=txt; t.style.display='block'; t.classList.remove('show');
  t.style.left='-9999px'; t.style.top='-9999px';
  requestAnimationFrame(()=>{
    if(_tipFor!==el) return;
    const z=parseFloat(document.documentElement.style.zoom||'1')||1;
    const r=el.getBoundingClientRect();
    const tw=t.offsetWidth, th=t.offsetHeight;
    const vw=window.innerWidth/z, vh=window.innerHeight/z;
    let left=(r.left+r.width/2)/z - tw/2;
    let top=r.bottom/z + 7;
    if(top+th>vh-4) top=r.top/z - th - 7;          // flip above if it would overflow
    left=Math.max(6,Math.min(left,vw-tw-6));
    t.style.left=left+'px'; t.style.top=Math.max(6,top)+'px';
    t.classList.add('show');
  });
}
function hideTip(){ _tipFor=null; if(!_tipEl) return; _tipEl.classList.remove('show'); _tipHideT=setTimeout(()=>{if(_tipEl)_tipEl.style.display='none';},170); }
document.addEventListener('mouseover',e=>{ const el=e.target.closest&&e.target.closest('[data-tip]'); if(el&&el!==_tipFor) showTip(el); });
document.addEventListener('mouseout',e=>{ const el=e.target.closest&&e.target.closest('[data-tip]'); if(el){ const to=e.relatedTarget; if(to&&el.contains&&el.contains(to)) return; hideTip(); } });
document.addEventListener('mousedown',hideTip,true);
document.addEventListener('scroll',hideTip,true);

