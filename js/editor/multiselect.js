/* ═══════════════════════════════════════════════
   MULTI-BLOCK SELECTION + BLOCK CLIPBOARD

   Each block is its own contenteditable, so the browser won't let a native
   text selection drag across block boundaries. This layer adds a Notion-style
   "block selection": drag across rows (or from the left margin) to highlight
   whole blocks, then copy / cut / paste / delete them as units — preserving each
   block's TYPE (cut an H2 → paste an H2).
═══════════════════════════════════════════════ */
let msSel = [];           // selected TOP-LEVEL block ids, in document order
let _msDrag = null;

function msCt(){ return document.getElementById(currentCtId()); }
function _msRows(ct){ return ct ? [...ct.children].filter(el=>el.classList&&el.classList.contains('bk-row')) : []; }
function _msRowAtY(rows,y){
  let best=null,bestD=Infinity;
  for(const r of rows){ const rc=r.getBoundingClientRect();
    if(y>=rc.top&&y<=rc.bottom) return r;
    const d=y<rc.top?rc.top-y:y-rc.bottom; if(d<bestD){bestD=d;best=r;}
  }
  return best;
}
function _msApply(){ const ct=msCt(); if(ct) _msRows(ct).forEach(r=>r.classList.toggle('bk-row-sel', msSel.includes(r.dataset.id))); if(typeof renderMsBar==='function') renderMsBar(); }
function clearMsSel(){ if(msSel.length||document.querySelector('.bk-row-sel')){ msSel=[]; document.querySelectorAll('.bk-row-sel').forEach(r=>r.classList.remove('bk-row-sel')); } _msMarqueeHide&&_msMarqueeHide(); if(typeof renderMsBar==='function') renderMsBar(); }
function _msTopRowOf(node,ct){ let r=node&&node.closest?node.closest('.bk-row'):null; while(r&&r.parentElement!==ct) r=r.parentElement.closest('.bk-row'); return r; }
/* ── Marquee lasso (drag from the page margin) ──
   A visible rectangle so you can SEE which blocks a margin-drag is about to grab.
   Positioned in the zoomed coordinate space (root has CSS zoom), like idbDdPos. */
function _msMarqueeEl(){ let m=document.getElementById('ms-marquee'); if(!m){ m=document.createElement('div'); m.id='ms-marquee'; m.className='ms-marquee'; document.body.appendChild(m); } return m; }
function _msMarqueeShow(x1,y1,x2,y2){
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  const m=_msMarqueeEl();
  m.style.left=(Math.min(x1,x2)/z)+'px'; m.style.top=(Math.min(y1,y2)/z)+'px';
  m.style.width=(Math.abs(x2-x1)/z)+'px'; m.style.height=(Math.abs(y2-y1)/z)+'px';
  m.classList.add('on');
}
function _msMarqueeHide(){ const m=document.getElementById('ms-marquee'); if(m) m.classList.remove('on'); }

/* ── Drag selection ── */
document.addEventListener('mousedown', e=>{
  if(e.button!==0) return;
  const ct=msCt();
  // Clicking the floating multi-select bar (or its pop-over) must NOT clear the
  // selection — otherwise the action runs against an already-emptied msSel.
  if(e.target.closest('#ms-bar,#msb-pop')) return;
  if(!ct||!ct.contains(e.target)){ clearMsSel(); _msDrag=null; return; }
  // Don't hijack the block drag-handle or interactive controls (buttons, inputs,
  // tables, media) — let them do their own thing. [draggable="true"] covers every
  // native-DnD source (board cards, row handles, columns): the marquee must NOT
  // engage on them, or the brief mousemove before `dragstart` activates the lasso
  // and native DnD then swallows `mouseup`, leaving a stuck vertical line.
  if(e.target.closest('[draggable="true"],.gb,button,input,textarea,select,a,.idb-sc,.idb-tbl,.bk-img-wrap,.car-thumb,.bk-yt,.bk-col-rz,.bk-grid-colgrip,.bk-grid-rowgrip')){ _msDrag=null; return; }
  clearMsSel();
  const rows=_msRows(ct); if(!rows.length){ _msDrag=null; return; }
  // Start row: the row under the pointer (top-level), else the nearest by Y so a
  // drag begun in the left margin / empty space still grabs blocks.
  let startRow=_msTopRowOf(e.target,ct)||_msRowAtY(rows,e.clientY);
  const fromMargin=!e.target.closest('.bk[contenteditable="true"]'); // started off the text
  _msDrag={ct,rows,startRow,fromMargin,startX:e.clientX,startY:e.clientY,active:false};
}, true);

document.addEventListener('mousemove', e=>{
  if(!_msDrag) return;
  if((e.buttons&1)===0){ _msDrag=null; return; }
  const curRow=_msRowAtY(_msDrag.rows,e.clientY); if(!curRow) return;
  if(!_msDrag.active){
    const crossed = curRow!==_msDrag.startRow;
    const dist = Math.abs(e.clientY-_msDrag.startY);
    // Margin drags = explicit block-select intent → engage after a tiny nudge.
    // Drags begun ON text are usually a normal text selection, so only escalate to
    // block selection once the pointer has clearly left the start row (crossed AND
    // moved a comfortable distance) — stops a stray pixel from hijacking it.
    if(_msDrag.fromMargin){ if(dist<=4) return; }
    else { if(!crossed || dist<24) return; }
    _msDrag.active=true;
    _msDrag.ct.classList.add('ms-dragging');
    const s=window.getSelection(); if(s) s.removeAllRanges();
  }
  e.preventDefault();
  const rows=_msDrag.rows;
  const i1=rows.indexOf(_msDrag.startRow), i2=rows.indexOf(curRow);
  if(i1<0||i2<0) return;
  const a=Math.min(i1,i2), b=Math.max(i1,i2);
  msSel=rows.slice(a,b+1).map(r=>r.dataset.id);
  _msApply();
  // Margin drags also paint a lasso rectangle spanning the selected rows so the
  // pending selection is visible as a shape (not just row tints).
  if(_msDrag.fromMargin){
    const ra=rows[a].getBoundingClientRect(), rb=rows[b].getBoundingClientRect();
    _msMarqueeShow(_msDrag.startX, ra.top-2, e.clientX, rb.bottom+2);
  }
}, true);

document.addEventListener('mouseup', ()=>{ if(_msDrag&&_msDrag.ct) _msDrag.ct.classList.remove('ms-dragging'); _msMarqueeHide(); _msDrag=null; }, true);
// If a marquee gesture is in progress, a stray native `dragstart` (the browser
// trying to drag the text/gutter under the cursor) would otherwise abort it — so
// cancel that native drag and let the marquee continue. We already bail on real
// drag sources (cards/handles) at mousedown, so _msDrag is never a genuine drag.
document.addEventListener('dragstart', e=>{ if(_msDrag){ e.preventDefault(); } }, true);
document.addEventListener('dragend',   ()=>{ _msMarqueeHide(); }, true);

/* ── Keyboard on a block selection ── */
document.addEventListener('keydown', e=>{
  if(!msSel.length) return;
  if(e.key==='Escape'){ e.preventDefault(); clearMsSel(); return; }
  if(e.key==='Backspace'||e.key==='Delete'){ e.preventDefault(); e.stopImmediatePropagation(); msDeleteSelected(); return; }
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'){ e.preventDefault(); msSelectAll(); return; }
  // Inline formatting across every selected block (bold / italic / underline).
  if((e.metaKey||e.ctrlKey)&&!e.altKey){ const tag={b:'strong',i:'em',u:'u'}[e.key.toLowerCase()];
    if(tag){ e.preventDefault(); e.stopImmediatePropagation(); msToggleInline(tag); return; } }
  if(e.key.startsWith('Arrow')){
    const ids=msSel.slice(); clearMsSel();
    const toStart=(e.key==='ArrowUp'||e.key==='ArrowLeft');
    const el=document.querySelector(`.bk[data-id="${toStart?ids[0]:ids[ids.length-1]}"]`);
    if(el){ e.preventDefault(); el.focus(); toStart?putCursorStart(el):putCursorEnd(el); }
    return;
  }
  // A printable key replaces the selection with what you type.
  if(e.key.length===1 && !e.metaKey && !e.ctrlKey && !e.altKey){
    e.preventDefault();
    msDeleteSelected();
    if(document.activeElement&&document.activeElement.classList.contains('bk')) document.execCommand('insertText',false,e.key);
    return;
  }
}, true);

function msSelectAll(){ const ct=msCt(); if(!ct) return; msSel=_msRows(ct).map(r=>r.dataset.id); const s=window.getSelection(); if(s) s.removeAllRanges(); _msApply(); }
/* Toggle a wrapping inline tag (strong/em/u) around EVERY selected block's content.
   Direction is decided by the first block: if it's already fully wrapped, unwrap all;
   otherwise wrap any that aren't. Whole-block granularity keeps it predictable. */
function msToggleInline(tag){
  if(!msSel.length) return;
  const set=new Set(msSel);
  const sel=S.blocks.filter(b=>set.has(b.id));
  if(!sel.length) return;
  const re=new RegExp('^<'+tag+'>([\\s\\S]*)</'+tag+'>$','i');
  const unwrap=re.test((sel[0].content||'').trim());
  sel.forEach(b=>{
    const c=(b.content||'').trim();
    if(unwrap){ const m=c.match(re); if(m) b.content=m[1]; }
    else if(c&&!re.test(c)){ b.content='<'+tag+'>'+b.content+'</'+tag+'>'; }
  });
  rerender(); updNums(); sched(); _msApply();
}
function _msTopIdx(){ const set=new Set(msSel); const idx=[]; S.blocks.forEach((b,i)=>{ if(set.has(b.id)) idx.push(i); }); return idx; }
function _msRemove(){ const idx=_msTopIdx(); const at=idx.length?idx[0]:S.blocks.length; idx.slice().sort((a,b)=>b-a).forEach(i=>S.blocks.splice(i,1)); clearMsSel(); return at; }
function msDeleteSelected(){
  const at=_msRemove();
  if(!S.blocks.length) S.blocks.push(mkBlock('paragraph'));
  rerender(); updNums(); sched();
  const tgt=S.blocks[Math.min(at,S.blocks.length-1)];
  const el=tgt&&document.querySelector(`.bk[data-id="${tgt.id}"]`); if(el){ el.focus(); putCursorStart(el); }
}

/* ── Block clipboard (copy / cut / paste preserving block type) ── */
function _msSelectedObjs(){ const set=new Set(msSel); return S.blocks.filter(b=>set.has(b.id)).map(b=>JSON.parse(JSON.stringify(b))); }
function _blkPlain(b){
  if(b.type==='divider') return '---';
  const d=document.createElement('div'); d.innerHTML=b.content||''; let t=d.innerText||'';
  if(b.type==='toggle'&&b.children) t=(t?t+'\n':'')+b.children.map(_blkPlain).join('\n');
  return t;
}
function _blkHtml(b){
  const c=b.content||'';
  switch(b.type){
    case 'h1':return `<h1>${c}</h1>`; case 'h2':return `<h2>${c}</h2>`; case 'h3':return `<h3>${c}</h3>`;
    case 'quote':return `<blockquote>${c}</blockquote>`; case 'code':return `<pre>${c}</pre>`;
    case 'bullet':return `<ul><li>${c}</li></ul>`; case 'numbered':case 'alpha':return `<ol><li>${c}</li></ol>`;
    case 'todo':return `<p>${b.checked?'☑':'☐'} ${c}</p>`; case 'divider':return '<hr>';
    default:return `<p>${c}</p>`;
  }
}
function _msWrite(e,blocks){
  try{
    const b64=btoa(unescape(encodeURIComponent(JSON.stringify(blocks))));
    e.clipboardData.setData('text/html', `<!--lib-blocks:${b64}-->`+blocks.map(_blkHtml).join(''));
    e.clipboardData.setData('text/plain', blocks.map(_blkPlain).join('\n\n'));
  }catch(_){}
}
document.addEventListener('copy', e=>{ if(!msSel.length) return; e.preventDefault(); _msWrite(e,_msSelectedObjs()); }, true);
document.addEventListener('cut',  e=>{ if(!msSel.length) return; e.preventDefault(); _msWrite(e,_msSelectedObjs()); msDeleteSelected(); }, true);

document.addEventListener('paste', e=>{
  const html=(e.clipboardData&&e.clipboardData.getData('text/html'))||'';
  const m=html.match(/<!--lib-blocks:([A-Za-z0-9+/=]*)-->/); if(!m) return;
  const ct=msCt(); if(!ct) return;
  const inEditor = msSel.length || (document.activeElement && ct.contains(document.activeElement));
  if(!inEditor) return;
  let blocks; try{ blocks=JSON.parse(decodeURIComponent(escape(atob(m[1])))); }catch(_){ return; }
  if(!Array.isArray(blocks)||!blocks.length) return;
  e.preventDefault(); e.stopImmediatePropagation();
  blocks.forEach(reassignIds);
  msPasteBlocks(blocks);
}, true);

/* Universal plain-text paste. Anything a specialised handler already claimed
   (block paste, mentions, grid cells — they all preventDefault) is left alone;
   every other contenteditable surface (database cells, the all-docs table,
   property editors) gets stripped to plain text so pasted formatting never
   carries in. Plain <input>/<textarea> already paste plainly, so skip them. */
document.addEventListener('paste', e=>{
  if(e.defaultPrevented) return;
  const t=e.target;
  const ce=t&&t.closest&&t.closest('[contenteditable="true"],[contenteditable=""]');
  if(!ce) return;
  const text=(e.clipboardData&&e.clipboardData.getData('text/plain'))||'';
  e.preventDefault();
  document.execCommand('insertText',false,text);
});

function msPasteBlocks(newBlocks){
  let at;
  if(msSel.length){ at=_msRemove(); }
  else {
    const ct=msCt();
    const topRow=_msTopRowOf(document.activeElement,ct);
    const idx=topRow?S.blocks.findIndex(b=>b.id===topRow.dataset.id):-1;
    if(idx<0){ at=S.blocks.length; }
    else {
      const cur=S.blocks[idx];
      const empty = cur.type==='paragraph' && !(cur.content||'').replace(/<[^>]+>/g,'').trim();
      if(empty){ S.blocks.splice(idx,1); at=idx; } else { at=idx+1; }
    }
  }
  S.blocks.splice(at,0,...newBlocks);
  rerender(); updNums(); sched();
  const last=newBlocks[newBlocks.length-1];
  const el=last&&document.querySelector(`.bk[data-id="${last.id}"]`); if(el){ el.focus(); putCursorEnd(el); }
}
