/* ── localStorage budget ──
   localStorage has its OWN fixed cap (~5 MB per origin; WebKit — the macOS desktop
   shell — counts UTF-16 bytes, so ≈2.5M characters), completely separate from the
   gigabytes navigator.storage.estimate() reports for IndexedDB. Version history and
   Trash live here, so "full" must mean THIS quota — and only a genuine quota error. */
const LS_QUOTA_BYTES=5*1024*1024;
function isQuotaError(e){
  return !!e&&(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'||e.code===22||e.code===1014);
}
/* Current usage, in UTF-16 bytes (keys + values), plus the biggest keys. */
function lsUsage(){
  let bytes=0; const byKey={};
  try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); const v=localStorage.getItem(k)||'';
    const b=(k.length+v.length)*2; bytes+=b; byKey[k]=b; } }catch(e){}
  return {bytes, byKey};
}
function putCursorEnd(el){
  el.focus();
  const r=document.createRange(); r.selectNodeContents(el); r.collapse(false);
  const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
}
function putCursorStart(el){
  el.focus();
  const r=document.createRange(); r.selectNodeContents(el); r.collapse(true);
  const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
}
function putCursorAtOffset(el,off){
  const wk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  let pos=0,node;
  while((node=wk.nextNode())){
    const len=node.textContent.length;
    if(pos+len>=off){
      const r=document.createRange();
      r.setStart(node,Math.min(off-pos,len)); r.collapse(true);
      const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
      return;
    }
    pos+=len;
  }
  putCursorEnd(el);
}
function isAtStart(el){
  const s=window.getSelection(); if(!s.rangeCount) return false;
  const r=s.getRangeAt(0); if(!r.collapsed) return false;
  const tr=document.createRange(); tr.selectNodeContents(el); tr.collapse(true);
  return r.compareBoundaryPoints(Range.START_TO_START,tr)===0;
}
function isAtTop(el){
  const s=window.getSelection(); if(!s.rangeCount) return false;
  const r=s.getRangeAt(0).getBoundingClientRect();
  if(!r.height&&!r.width) return true; // empty block → caret rect is degenerate; it's both top and bottom
  return r.top===0||(r.top-el.getBoundingClientRect().top)<16;
}
function isAtBot(el){
  const s=window.getSelection(); if(!s.rangeCount) return false;
  const r=s.getRangeAt(0).getBoundingClientRect();
  // An empty block returns a 0×0 caret rect anchored at the top, which made
  // (block.bottom - r.bottom) huge and falsely reported "not at bottom" — so
  // ArrowDown wouldn't move off the first empty block. Treat it as the last line.
  if(!r.height&&!r.width) return true;
  return(el.getBoundingClientRect().bottom-r.bottom)<16;
}
function focusAdj(id,dir){
  const loc=locate(id); if(!loc) return;
  const ti=loc.idx+dir; if(ti<0||ti>=loc.arr.length) return;
  const tel=document.querySelector('.bk[data-id="'+loc.arr[ti].id+'"]');
  if(tel){tel.focus();if(dir>0)putCursorStart(tel);else putCursorEnd(tel)}
}

/* ===================================================
   DATE / FORMAT HELPERS
=================================================== */
const pad=n=>String(n).padStart(2,'0');
const dateStr=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
function fmtDate(iso){
  if(!iso) return '\u2014';
  const d=new Date(iso),diff=Date.now()-d;
  const m=Math.floor(diff/6e4),h=Math.floor(diff/36e5),dy=Math.floor(diff/864e5);
  if(m<1)return'Just now'; if(m<60)return m+'m ago';
  if(h<24)return h+'h ago'; if(dy<7)return dy+'d ago';
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
}

/* ===================================================
   INIT
=================================================== */

/* ===================================================
   CONFIG SYSTEM
=================================================== */
