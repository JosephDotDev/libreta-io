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
function _msApply(){ const ct=msCt(); if(!ct) return; _msRows(ct).forEach(r=>r.classList.toggle('bk-row-sel', msSel.includes(r.dataset.id))); }
function clearMsSel(){ if(msSel.length||document.querySelector('.bk-row-sel')){ msSel=[]; document.querySelectorAll('.bk-row-sel').forEach(r=>r.classList.remove('bk-row-sel')); } }
function _msTopRowOf(node,ct){ let r=node&&node.closest?node.closest('.bk-row'):null; while(r&&r.parentElement!==ct) r=r.parentElement.closest('.bk-row'); return r; }

/* ── Drag selection ── */
document.addEventListener('mousedown', e=>{
  if(e.button!==0) return;
  const ct=msCt();
  if(!ct||!ct.contains(e.target)){ clearMsSel(); _msDrag=null; return; }
  // Don't hijack the block drag-handle or interactive controls (buttons, inputs,
  // tables, media) — let them do their own thing.
  if(e.target.closest('.gb,button,input,textarea,select,a,.idb-sc,.idb-tbl,.bk-img-wrap,.car-thumb,.bk-yt')){ _msDrag=null; return; }
  clearMsSel();
  const rows=_msRows(ct); if(!rows.length){ _msDrag=null; return; }
  // Start row: the row under the pointer (top-level), else the nearest by Y so a
  // drag begun in the left margin / empty space still grabs blocks.
  let startRow=_msTopRowOf(e.target,ct)||_msRowAtY(rows,e.clientY);
  const fromMargin=!e.target.closest('.bk[contenteditable="true"]'); // started off the text
  _msDrag={ct,rows,startRow,fromMargin,startY:e.clientY,active:false};
}, true);

document.addEventListener('mousemove', e=>{
  if(!_msDrag) return;
  if((e.buttons&1)===0){ _msDrag=null; return; }
  const curRow=_msRowAtY(_msDrag.rows,e.clientY); if(!curRow) return;
  if(!_msDrag.active){
    const crossed = curRow!==_msDrag.startRow;
    const movedFar = Math.abs(e.clientY-_msDrag.startY)>4;
    // Activate when the drag leaves the start row, OR (when begun in the margin)
    // after a small movement — so you can grab even a single block from outside.
    if(!crossed && !(_msDrag.fromMargin && movedFar)) return;
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
}, true);

document.addEventListener('mouseup', ()=>{ if(_msDrag&&_msDrag.ct) _msDrag.ct.classList.remove('ms-dragging'); _msDrag=null; }, true);

/* ── Keyboard on a block selection ── */
document.addEventListener('keydown', e=>{
  if(!msSel.length) return;
  if(e.key==='Escape'){ e.preventDefault(); clearMsSel(); return; }
  if(e.key==='Backspace'||e.key==='Delete'){ e.preventDefault(); e.stopImmediatePropagation(); msDeleteSelected(); return; }
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'){ e.preventDefault(); msSelectAll(); return; }
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
