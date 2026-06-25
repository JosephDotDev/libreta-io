/* ═══════════════════════════════════════════════
   DRAG & DROP
═══════════════════════════════════════════════ */
/* ── Reliable pointer-based block drag (works over contenteditable, unlike native HTML5 DnD) ──
   Grabbing the gutter handle (⠿) and moving starts a drag; releasing reorders the block.
   Reuses dropZone() for the left/right/top/bottom indicator and onDrop() for the actual move
   (so list renumbering, column-creation, nesting rules etc. all stay consistent). */
let _bkJustDragged=false;
/* A floating, tilted preview of the block you're carrying. It's purely visual
   (pointer-events:none, so elementFromPoint still hits the real rows underneath). */
let _dragGhost=null;
function _mkDragGhost(srcRow,count){
  _rmDragGhost();
  try{
    const g=document.createElement('div'); g.className='bk-drag-ghost';
    const bk=srcRow&&srcRow.querySelector('.bk');
    let txt=(bk?bk.textContent:'').trim();
    if(!txt){ const ty=srcRow&&srcRow.dataset.type; const bt=(typeof BT!=='undefined')&&BT.find(b=>b.t===ty); txt=(bt&&bt.lbl)||'Empty block'; }
    g.textContent=count>1?`${count} blocks`:txt.slice(0,90);
    document.body.appendChild(g); _dragGhost=g;
  }catch(_){}
}
function _moveDragGhost(x,y){
  if(!_dragGhost) return;
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  _dragGhost.style.left=(x/z+14)+'px';
  _dragGhost.style.top=(y/z+12)+'px';
}
function _rmDragGhost(){ if(_dragGhost){ _dragGhost.remove(); _dragGhost=null; } }
function bkGripDown(e,id){
  if(e.button!==0) return;
  e.preventDefault(); e.stopPropagation();
  const startX=e.clientX, startY=e.clientY;
  let started=false;
  // If the grabbed block is part of a multi-block selection, the whole selection moves
  // together (Notion-style). Otherwise it's a plain single-block drag.
  const multi=(typeof msSel!=='undefined' && msSel.includes(id) && msSel.length>1) ? msSel.slice() : null;
  const dragIds=multi||[id];
  const srcRow=document.querySelector(`.bk-row[data-id="${id}"]`);
  const isDragged=rid=>dragIds.includes(rid);
  const mm=(ev)=>{
    if(!started){
      if(Math.abs(ev.clientX-startX)<4 && Math.abs(ev.clientY-startY)<4) return;
      started=true; S.dragId=id;
      dragIds.forEach(d=>document.querySelector(`.bk-row[data-id="${d}"]`)?.classList.add('dragging'));
      document.body.classList.add('bk-ptr-dragging');
      _mkDragGhost(srcRow,dragIds.length);
    }
    _moveDragGhost(ev.clientX,ev.clientY);
    clearDropZones();
    const under=document.elementFromPoint(ev.clientX,ev.clientY);
    const row=under&&under.closest('.bk-row');
    if(row && !isDragged(row.dataset.id) && !dragIds.some(d=>row.querySelector(`[data-id="${d}"]`))){
      // If hovering inside a columns container, check whether the cursor is
      // near the bottom edge of the whole block — if so, snap to "below columns"
      // so the user can easily drop a block under both columns at once.
      const colsCont=row.closest('.bk-cols');
      if(colsCont){
        const colsRow=colsCont.closest('.bk-row');
        if(colsRow&&colsRow.dataset.id!==id){
          const z=parseFloat(document.documentElement.style.zoom||'1')||1;
          const fromBottom=colsCont.getBoundingClientRect().bottom/z - ev.clientY/z;
          if(fromBottom<=28){
            S.dropZone='bottom'; S.dropTargetId=colsRow.dataset.id;
            colsRow.classList.add('dz-bottom');
            return;
          }
        }
      }
      S.dropZone=dropZone({clientX:ev.clientX,clientY:ev.clientY},row);
      S.dropTargetId=row.dataset.id;
      row.classList.add('dz-'+S.dropZone);
    } else {
      S.dropTargetId=null;
    }
    // Auto-scroll the nearest scrollable container (editor body, side-peek, …) when
    // the cursor nears its edge — block drag is pointer-based, so it doesn't get the
    // native-DnD autoscroll for free.
    _asY=ev.clientY; _asEl=_asScrollable(ev.clientX,ev.clientY); if(!_asRAF) _asRAF=requestAnimationFrame(_asTick);
  };
  const mu=()=>{
    document.removeEventListener('mousemove',mm);
    document.removeEventListener('mouseup',mu);
    _asStop();
    _rmDragGhost();
    document.body.classList.remove('bk-ptr-dragging');
    dragIds.forEach(d=>document.querySelector(`.bk-row[data-id="${d}"]`)?.classList.remove('dragging'));
    if(!started){ S.dragId=null; return; } // no movement → treat as a click (opens block menu)
    _bkJustDragged=true; setTimeout(()=>_bkJustDragged=false,260);
    const tId=S.dropTargetId, zone=S.dropZone;
    clearDropZones(); S.dropTargetId=null;
    if(tId){
      if(multi){ doMultiMove(multi, tId, (zone==='right'||zone==='bottom')?'bottom':'top'); }
      else { S.dragId=id; S.dropZone=zone; onDrop({preventDefault(){},stopPropagation(){}},tId); }
    }
    else { S.dragId=null; }
  };
  document.addEventListener('mousemove',mm);
  document.addEventListener('mouseup',mu);
}
function onGripClick(e,id){ if(_bkJustDragged){ _bkJustDragged=false; return; } openBkMenu(e,id); }
function startDrag(e,id){S.dragId=id}
function onDragStart(e,id){e.stopPropagation();S.dragId=id;e.dataTransfer.effectAllowed='move';const row=document.querySelector(`.bk-row[data-id="${id}"]`);setTimeout(()=>row&&row.classList.add('dragging'),0)}
/* Global safety net: if a drag ends without a successful drop, clear any leftover
   "dragging"/drop-zone styling and reset drag state so nothing stays greyed out. */
document.addEventListener('dragend',function(){
  _rmDragGhost();
  const cls=['dragging','idb-cal-dragging','home-drop','idb-col-drop','idb-row-drop','idb-cal-drop','bk-grid-col-drop','bk-grid-row-drop','col-drag-over','opt-dov','drag-over','dz-left','dz-right','dz-top','dz-bottom'];
  document.querySelectorAll('.'+cls.join(',.')).forEach(el=>el.classList.remove(...cls));
  document.body.classList.remove('home-dragging','idb-cal-dragging-active','idb-col-resizing');
  S.dragId=null;
  try{document.querySelectorAll('.idb-cal-ghost').forEach(g=>g.remove());}catch(e){}
  try{_calDrag=null;_calDragEl=null;_calGhost=null;_idbColDrag=null;_idbRowDrag=null;_idbPropDrag=null;_selDrag=null;_homeDrag=null;_gridColDrag=null;_gridRowDrag=null;}catch(e){}
});
/* ── Auto-scroll while dragging ──
   During a native HTML5 drag (database rows/cards, sidebar tree, etc.) the page
   won't scroll on its own, so you can't reach a drop target that's off-screen.
   This nudges the nearest scrollable container (or the window) when the cursor
   nears its top/bottom edge. Coordinates are in the zoomed visual space, matching
   getBoundingClientRect — same convention as dropZone() above. */
let _asEl=null,_asY=0,_asRAF=null;
function _asScrollable(x,y){
  let el=document.elementFromPoint(x,y);
  while(el&&el!==document.body&&el!==document.documentElement){
    const s=getComputedStyle(el);
    if(/(auto|scroll)/.test(s.overflowY)&&el.scrollHeight>el.clientHeight+2) return el;
    el=el.parentElement;
  }
  return document.scrollingElement||document.documentElement;
}
function _asTick(){
  if(!_asEl){_asRAF=null;return;}
  const win=_asEl===document.scrollingElement||_asEl===document.documentElement;
  const r=win?{top:0,bottom:window.innerHeight}:_asEl.getBoundingClientRect();
  const EDGE=64, MAX=22; let dy=0;
  if(_asY<r.top+EDGE)        dy=-MAX*Math.min(1,(r.top+EDGE-_asY)/EDGE);
  else if(_asY>r.bottom-EDGE) dy= MAX*Math.min(1,(_asY-(r.bottom-EDGE))/EDGE);
  if(dy) (win?document.scrollingElement:_asEl).scrollTop+=dy;
  _asRAF=requestAnimationFrame(_asTick);
}
document.addEventListener('dragover',e=>{
  _asY=e.clientY; _asEl=_asScrollable(e.clientX,e.clientY);
  if(!_asRAF) _asRAF=requestAnimationFrame(_asTick);
},true);
function _asStop(){ _asEl=null; if(_asRAF){cancelAnimationFrame(_asRAF);_asRAF=null;} }
document.addEventListener('drop',_asStop,true);
document.addEventListener('dragend',_asStop,true);
function clearDropZones(){document.querySelectorAll('.bk-row').forEach(r=>r.classList.remove('drag-over','dz-left','dz-right','dz-top','dz-bottom'))}
/* Decide the drop zone from cursor position over the target's content area */
function dropZone(e,row){
  const wrap=row.querySelector(':scope > .bk-wrap')||row;
  const r=wrap.getBoundingClientRect();
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  const x=e.clientX/z, y=e.clientY/z, left=r.left/z, right=r.right/z, top=r.top/z, bottom=r.bottom/z;
  const w=right-left, edge=Math.min(80,w*0.28);
  if(x<left+edge) return 'left';
  if(x>right-edge) return 'right';
  return (y<(top+bottom)/2)?'top':'bottom';
}
function onDragOver(e,id){
  e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect='move';
  if(id===S.dragId) return;
  const row=document.querySelector(`.bk-row[data-id="${id}"]`); if(!row) return;
  // Don't allow dropping a block onto its own descendant
  if(row.querySelector(`[data-id="${S.dragId}"]`)) return;
  clearDropZones();
  S.dropZone=dropZone(e,row); S.dropTargetId=id;
  row.classList.add('dz-'+S.dropZone);
}
function onDrop(e,targetId){
  e.preventDefault(); e.stopPropagation();
  const zone=S.dropZone; clearDropZones();
  const srcId=S.dragId; S.dragId=null;
  if(!srcId||srcId===targetId) return;
  const srcRow=document.querySelector(`.bk-row[data-id="${srcId}"]`);
  if(srcRow&&srcRow.querySelector(`[data-id="${targetId}"]`)) return; // can't drop into own child
  const sLoc=locate(srcId), tLoc=locate(targetId);
  if(!sLoc||!tLoc) return;
  const moved=sLoc.block;

  if(zone==='left'||zone==='right'){
    // Don't nest a columns block, and don't wrap a columns block as a column — fall back to reorder
    if(moved.type==='columns'||tLoc.block.type==='columns'){ doVerticalMove(srcId,targetId,zone==='left'?'top':'bottom'); return; }
    // Reject a 4th column with a toast + shake instead of silently mis-placing it
    if(tLoc.colsBlock && tLoc.colsBlock.cols.length>=3){
      toast('Rows are limited to 3 columns');
      shakeEl(document.querySelector(`.bk-cols[data-cols-id="${tLoc.colsBlock.id}"]`));
      return;
    }
    // remove source first
    const s2=locate(srcId); s2.arr.splice(s2.idx,1);
    if(s2.colsBlock&&s2.arr.length===0) cleanupColumns(s2.colsBlock);
    const t2=locate(targetId); if(!t2){rerender();sched();return}
    if(t2.colsBlock){
      // target already inside a columns block → add as a new sibling column
      const cb=t2.colsBlock;
      const at=zone==='left'?t2.colArrayIndex:t2.colArrayIndex+1; cb.cols.splice(at,0,[moved]); cb.widths=cb.cols.map(()=>1);
    } else {
      // wrap target + moved into a new columns block
      const colsBlk={id:mkId('b'),type:'columns',content:'',
        cols: zone==='left'?[[moved],[t2.block]]:[[t2.block],[moved]], widths:[1,1]};
      t2.arr.splice(t2.idx,1,colsBlk);
    }
    rerender(); updNums(); sched(); return;
  }
  // Vertical reorder (works in nested arrays too)
  doVerticalMove(srcId,targetId,zone);
}
/* Move a whole multi-block selection together. Selections are always top-level blocks
   (see multiselect.js), so they live in S.blocks; a target inside a columns block snaps
   to just above/below the whole columns block. The selection stays highlighted after. */
function doMultiMove(ids,targetId,zone){
  S.dragId=null;
  const set=new Set(ids); if(set.has(targetId)) return;
  const t=locate(targetId);
  if(t && t.arr!==S.blocks){ if(t.colsBlock){ targetId=t.colsBlock.id; if(set.has(targetId)) return; } else return; }
  const objs=S.blocks.filter(b=>set.has(b.id)); if(!objs.length) return;
  S.blocks=S.blocks.filter(b=>!set.has(b.id));
  const ti=S.blocks.findIndex(b=>b.id===targetId);
  if(ti<0) S.blocks.push(...objs);
  else S.blocks.splice(zone==='bottom'?ti+1:ti,0,...objs);
  rerender(); updNums(); sched();
  if(typeof msSel!=='undefined'){ msSel=objs.map(b=>b.id); if(typeof _msApply==='function') _msApply(); }
}
function doVerticalMove(srcId,targetId,zone){
  const s=locate(srcId); if(!s) return;
  const moved=s.block; s.arr.splice(s.idx,1);
  if(s.colsBlock&&s.arr.length===0) cleanupColumns(s.colsBlock);
  const t=locate(targetId); if(!t){S.blocks.push(moved);rerender();sched();return}
  t.arr.splice(zone==='bottom'?t.idx+1:t.idx,0,moved);
  rerender(); updNums(); sched();
}
/* Column resize */
function colResizeStart(e,colsId,dividerIdx){
  e.preventDefault(); e.stopPropagation();
  const cb=findBlock(colsId); if(!cb) return;
  const cont=document.querySelector(`.bk-cols[data-cols-id="${colsId}"]`); if(!cont) return;
  const cols=[...cont.querySelectorAll(':scope > .bk-col')];
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  const totalW=cont.getBoundingClientRect().width/z;
  cb.widths=cb.widths||cb.cols.map(()=>1);
  const li=dividerIdx-1, ri=dividerIdx;
  const startX=e.clientX/z, wL=cb.widths[li], wR=cb.widths[ri], sum=wL+wR;
  const move=ev=>{
    const dx=(ev.clientX/z-startX)/totalW*(cb.cols.length); // delta in flex units
    let nl=Math.max(0.25,Math.min(sum-0.25,wL+dx));
    cb.widths[li]=nl; cb.widths[ri]=sum-nl;
    if(cols[li])cols[li].style.flex=cb.widths[li]+' 1 0';
    if(cols[ri])cols[ri].style.flex=cb.widths[ri]+' 1 0';
  };
  const up=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);document.querySelector(`.bk-cols[data-cols-id="${colsId}"] .bk-col-rz`)?.classList.remove('rz-active');sched()};
  document.addEventListener('mousemove',move); document.addEventListener('mouseup',up);
}

