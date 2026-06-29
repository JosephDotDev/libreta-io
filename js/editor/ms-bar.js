/* ═══════════════════════════════════════════════
   MULTI-SELECT ACTION BAR (Phase 3)

   When 2+ blocks are selected, a floating bar offers Turn into / Color /
   Duplicate / Delete across the whole selection. Driven by multiselect.js
   (msSel); renderMsBar() is called from _msApply()/clearMsSel().
═══════════════════════════════════════════════ */
function _msBarEl(){
  let b=document.getElementById('ms-bar');
  if(!b){ b=document.createElement('div'); b.id='ms-bar'; b.className='ms-bar'; document.body.appendChild(b); }
  return b;
}
function renderMsBar(){
  const n=(typeof msSel!=='undefined')?msSel.length:0;
  const b=document.getElementById('ms-bar');
  if(n<2){ if(b) b.classList.remove('open'); _msBarPopClose(); return; }
  const bar=_msBarEl();
  bar.innerHTML=
    `<span class="msb-count">${n} selected</span>`+
    `<button class="msb-btn" onclick="msBarTurnInto(event)"><span class="msb-ic" style="color:var(--pu)">&#8646;</span>Turn into</button>`+
    `<button class="msb-btn" onclick="msBarColor(event)"><span class="msb-ic" style="color:var(--go)">&#9679;</span>Color</button>`+
    `<button class="msb-btn" onclick="msBarDuplicate()"><span class="msb-ic" style="color:var(--gr)">&#10697;</span>Duplicate</button>`+
    `<button class="msb-btn msb-danger" onclick="msBarDelete()"><span class="msb-ic" style="color:var(--re)">&#9003;</span>Delete</button>`;
  bar.classList.add('open');
}
function _msBarPop(anchor,html,cls){
  _msBarPopClose();
  const p=document.createElement('div'); p.id='msb-pop'; p.className='msb-pop'+(cls?(' '+cls):''); p.innerHTML=html;
  document.body.appendChild(p);
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  const r=anchor.getBoundingClientRect();
  p.style.left=(r.left/z)+'px';
  p.style.bottom=(window.innerHeight/z - r.top/z + 7)+'px';
}
function _msBarPopClose(){ const p=document.getElementById('msb-pop'); if(p) p.remove(); }
function msBarTurnInto(e){
  e.stopPropagation();
  const types=[['paragraph','Text'],['h1','Heading 1'],['h2','Heading 2'],['todo','To-do list'],['bullet','Bulleted list'],['quote','Quote']];
  _msBarPop(e.currentTarget, types.map(t=>`<div class="msb-pop-it" onclick="msBarApplyType('${t[0]}')">${t[1]}</div>`).join(''));
}
function msBarApplyType(type){
  (typeof msSel!=='undefined'?msSel.slice():[]).forEach(id=>{ if(typeof xformBlk==='function') xformBlk(id,type); });
  _msBarPopClose(); if(typeof _msApply==='function') _msApply();
}
function msBarColor(e){
  e.stopPropagation();
  const colors=(typeof BLOCK_COLORS!=='undefined')?BLOCK_COLORS:[];
  const sw=`<button class="msb-sw" title="Default" onclick="msBarApplyColor('')">A</button>`+
    colors.map(c=>`<button class="msb-sw" style="color:${c.c}" title="${c.k}" onclick="msBarApplyColor('${c.c}')">A</button>`).join('');
  _msBarPop(e.currentTarget, sw, 'msb-pop-colors');
}
function msBarApplyColor(color){
  (typeof msSel!=='undefined'?msSel.slice():[]).forEach(id=>{ if(typeof setBlkColor==='function') setBlkColor(id,color); });
  _msBarPopClose();
}
function msBarDuplicate(){
  (typeof msSel!=='undefined'?msSel.slice():[]).forEach(id=>{ if(typeof dupBlk==='function') dupBlk(id); });
  _msBarPopClose();
}
function msBarDelete(){ _msBarPopClose(); if(typeof msDeleteSelected==='function') msDeleteSelected(); }
/* Close the pop when clicking anywhere outside it / the bar. */
document.addEventListener('mousedown',e=>{
  const p=document.getElementById('msb-pop'); if(!p) return;
  if(e.target.closest('#msb-pop')||e.target.closest('#ms-bar')) return;
  _msBarPopClose();
},true);
