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
