/* Row id whose board-card title is in the brief "name it on creation" edit mode.
   Only that one card renders an editable title; every other card's title is plain
   text, so once a card exists its title is renamed from the page view, not in place. */
let _idbEditTitleRow=null;
function idbBoardView(blk,tbl){
  const groupCol=idbBoardGroupCol(blk,tbl);
  if(!groupCol) return `<div class="idb-note">Add a <b>Select</b> or <b>Status</b> property to group entries on a board.</div>`;
  const imgCol=tbl.columns.find(c=>c.type==='image');
  const titleColId=idbTitleColId(tbl);
  const allRows=idbViewRows(blk,tbl);
  const metaCols=idbVisibleCols(blk,tbl).slice(1).filter(c=>c.id!==groupCol.id&&c.type!=='image');
  const groups=[...(groupCol.options||[]).filter(o=>o.l).map(o=>({key:o.l,color:o.c,label:o.l})),{key:'',color:'var(--bd2)',label:'No '+groupCol.name}];
  const colsH=groups.map(g=>{
    const rows=allRows.filter(r=>(r.cells[groupCol.id]||'')===g.key);
    const gk=g.key||'__none__';
    const lim=idbGrpLim(blk,gk);
    const shownRows=lim===Infinity?rows:rows.slice(0,lim);
    const cards=shownRows.map(r=>{
      const rawTitle=escHtml(titleColId&&r.cells[titleColId]!=null?r.cells[titleColId]:'');
      const _dref=r.docId?DB.getDoc(r.docId):null;
      const _csrc=(imgCol&&r.cells[imgCol.id]&&srcFor(r.cells[imgCol.id]))||((_dref&&_dref.meta&&_dref.meta.cover)?srcFor(_dref.meta.cover):'');
      const cover=_csrc?`<div class="idb-card-cover"><img src="${_csrc}" alt=""></div>`:'';
      const meta=metaCols.slice(0,3).map(c=>idbCardMeta(r,c)).filter(Boolean).join('');
      // Title is editable in place ONLY for the card just created (name-on-creation);
      // for every existing card it's plain text and clicking it opens the page (where
      // the title is renamed), so a stray click can't accidentally edit it inline.
      const titleEd=_idbEditTitleRow===r.id
        ? `<span class="idb-ed idb-card-title-ed" contenteditable="true" data-ph="Untitled" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" onblur="idbBoardTitleCommit('${blk.id}','${r.id}','${titleColId}',this.innerText.trim())">${rawTitle}</span>`
        : `<span class="idb-card-title">${rawTitle||'<span class="idb-mu">Untitled</span>'}</span>`;
      return `<div class="idb-card" data-rid="${r.id}" style="--lane:${g.color}" draggable="true" ondragstart="idbCardDragStart(event,'${blk.id}','${r.id}')" ondragend="idbCardDragEnd()" onclick="idbOpenRow('${blk.id}','${r.id}')"><button class="idb-card-del" onclick="event.stopPropagation();idbDelRow('${blk.id}','${r.id}')" data-tip="Delete">&#10005;</button>${cover}<div class="idb-card-t">${idbRowIcon(r)}${titleEd}</div>${meta?`<div class="idb-card-m">${meta}</div>`:''}</div>`;
    }).join('');
    const more=idbBoardMore(blk,gk,rows.length,shownRows.length);
    return `<div class="idb-bcol" data-key="${escHtml(g.key)}" style="--lane:${g.color}" ondragover="idbCardDragOverCol(event)" ondragleave="idbBcolDragLeave(event)" ondrop="idbCardDropToCol(event,'${blk.id}','${escAttr(g.key)}')"><div class="idb-bcol-h${g.key?' movable" title="Drag to reorder lanes" onpointerdown="idbLaneDown(event,\''+blk.id+'\')':''}"><span class="idb-dd-dot" style="background:${g.color}"></span>${g.key
        ? `<span class="idb-bcol-name" title="Click to rename" onclick="idbLaneRenameStart(event,this,'${blk.id}','${groupCol.id}','${escAttr(g.key)}')">${escHtml(g.label)}</span>`
        : `<span class="idb-bcol-name none">${escHtml(g.label)}</span>`}<span class="idb-bcol-ct">${rows.length}</span></div><div class="idb-bcol-b">${cards}${more}<div class="idb-bcard-add" onclick="idbBoardAddRow('${blk.id}','${groupCol.id}','${escAttr(g.key)}')"><span class="np-pill">+ New Page</span></div></div></div>`;
  }).join('');
  return `<div class="idb-board">${colsH}</div>`;
}
/* "Show more / all / less" footer for a paginated swim lane (shares groupPageSize /
   groupShown with the grouped table view, so the increment is set in one place). */
function idbBoardMore(blk,gk,total,shown){
  const ps=blk.groupPageSize||0; if(!ps||total<=ps) return '';
  const parts=[];
  if(shown<total){
    const next=Math.min(ps,total-shown);
    parts.push(`<button class="idb-bmore-b" onclick="idbGrpShowMore('${blk.id}','${escAttr(gk)}')">Show ${next} more</button>`);
    parts.push(`<button class="idb-bmore-b sec" onclick="idbGrpShowAll('${blk.id}','${escAttr(gk)}')">All ${total}</button>`);
  }
  if(shown>ps) parts.push(`<button class="idb-bmore-b sec" onclick="idbGrpShowLess('${blk.id}','${escAttr(gk)}')">Show less</button>`);
  if(!parts.length) return '';
  return `<div class="idb-bmore"><span class="idb-bmore-ct">${Math.min(shown,total)} of ${total}</span>${parts.join('')}</div>`;
}
/* ── Reorder lanes (= the process flow) by dragging a lane's header ──
   Pointer-driven rather than native DnD so it can be live: the lane lifts into a
   ghost that follows the cursor, its slot stays as a dashed placeholder, and the
   other lanes slide aside (FLIP) as you move; the board auto-scrolls at its edges.
   Lane order IS the grouped property's option order, so dropping reorders the
   options — every view and status picker of this database follows the new flow.
   The "No <prop>" lane always stays last. Escape cancels. A press that moves < 5px
   is a click (so clicking the name still renames it). */
function idbLaneDown(e,blockId){
  if(e.button!==0||e.target.isContentEditable) return;
  const lane=e.currentTarget.closest('.idb-bcol'), board=lane&&lane.parentElement; if(!board) return;
  e.preventDefault();   // no text selection, and no compat mousedown → the block marquee stays out of it
  const Z=()=>parseFloat(document.documentElement.style.zoom||'1')||1;
  const movable=()=>[...board.children].filter(c=>c.classList.contains('idb-bcol')&&c.dataset.key);
  const sx=e.clientX, sy=e.clientY;
  let drag=null, lastEv=e, raf=0;
  const before=movable().map(c=>c.dataset.key);

  function begin(){
    const r=lane.getBoundingClientRect(), z=Z();
    const ghost=lane.cloneNode(true);
    ghost.classList.add('idb-bcol-ghost'); ghost.setAttribute('aria-hidden','true');
    ghost.querySelectorAll('[onclick],[ondragstart],[onpointerdown]').forEach(n=>{ n.removeAttribute('onclick'); n.removeAttribute('ondragstart'); n.removeAttribute('onpointerdown'); });
    ghost.style.width=(r.width/z)+'px'; ghost.style.left=(r.left/z)+'px'; ghost.style.top=(r.top/z)+'px';
    document.body.appendChild(ghost);
    lane.classList.add('idb-bcol-placeholder');
    document.body.classList.add('idb-lane-dragging');
    drag={ghost, offX:sx-r.left, offY:sy-r.top};
  }
  /* Slide `lane` to the slot under the pointer, animating every lane that shifts. */
  function place(x){
    const others=movable().filter(c=>c!==lane);
    const next=others.find(c=>{ const r=c.getBoundingClientRect(); return x<r.left+r.width/2; });
    // Insert before `next`, or right after the last movable lane (i.e. before "No <prop>").
    const anchor=next||(others.length?others[others.length-1].nextElementSibling:null);
    if(anchor===lane||lane.nextElementSibling===anchor) return;   // already in that slot
    const all=movable(), z=Z(), first=new Map(all.map(c=>[c,c.getBoundingClientRect().left]));
    board.insertBefore(lane,anchor);
    all.forEach(c=>{ const dx=(first.get(c)-c.getBoundingClientRect().left)/z;
      if(Math.abs(dx)>0.5) c.animate([{transform:`translateX(${dx}px)`},{transform:'none'}],{duration:170,easing:'cubic-bezier(.2,.8,.2,1)'}); });
  }
  /* Ghost follows the pointer and the slot updates on every move (synchronously, so a
     quick flick that releases before the next frame still lands where it was aimed). */
  function follow(){
    const z=Z();
    drag.ghost.style.left=((lastEv.clientX-drag.offX)/z)+'px';
    drag.ghost.style.top=((lastEv.clientY-drag.offY)/z)+'px';
    place(lastEv.clientX);
  }
  /* Near the board's edges, keep scrolling it each frame while the pointer rests there. */
  function edgeSpeed(){ const br=board.getBoundingClientRect(), edge=56, x=lastEv.clientX;
    return x<br.left+edge?-(br.left+edge-x):x>br.right-edge?(x-(br.right-edge)):0; }
  function scrollTick(){
    raf=0; if(!drag) return;
    const v=edgeSpeed(); if(!v) return;
    board.scrollLeft+=Math.max(-18,Math.min(18,v/3)); place(lastEv.clientX);
    raf=requestAnimationFrame(scrollTick);
  }
  function onMove(ev){
    lastEv=ev;
    if(!drag){ if(Math.abs(ev.clientX-sx)<5&&Math.abs(ev.clientY-sy)<5) return; begin(); }
    follow();
    if(!raf&&edgeSpeed()) raf=requestAnimationFrame(scrollTick);
  }
  function end(commit){
    window.removeEventListener('pointermove',onMove); window.removeEventListener('pointerup',onUp);
    window.removeEventListener('pointercancel',onCancel); window.removeEventListener('keydown',onKey,true);
    if(raf) cancelAnimationFrame(raf);
    if(!drag) return;
    if(commit) place(lastEv.clientX);
    // The pointerup on the header would also fire a click (= start renaming) — swallow it.
    const eat=ev=>{ ev.stopPropagation(); ev.preventDefault(); };
    window.addEventListener('click',eat,true); setTimeout(()=>window.removeEventListener('click',eat,true),0);
    drag.ghost.remove(); lane.classList.remove('idb-bcol-placeholder');
    document.body.classList.remove('idb-lane-dragging');
    drag=null;
    const after=movable().map(c=>c.dataset.key);
    if(commit&&after.join('\u0000')!==before.join('\u0000')) idbReorderLanes(blockId,after);
    else if(!commit) reRenderBlock(blockId);   // cancelled → put the lanes back
  }
  const onUp=()=>end(true), onCancel=()=>end(false);
  const onKey=ev=>{ if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); end(false); } };
  window.addEventListener('pointermove',onMove); window.addEventListener('pointerup',onUp);
  window.addEventListener('pointercancel',onCancel); window.addEventListener('keydown',onKey,true);
}
/* Persist a new lane order: the grouped property's options, in this order (options
   without a lane — e.g. unnamed — keep their relative order at the end). */
function idbReorderLanes(blockId,keys){
  const blk=findBlock(blockId), tbl=idbTbl(blk), col=tbl&&idbBoardGroupCol(blk,tbl); if(!col) return;
  const byL=new Map((col.options||[]).map(o=>[o.l,o]));
  const ordered=keys.map(k=>byL.get(k)).filter(Boolean);
  col.options=[...ordered,...col.options.filter(o=>!ordered.includes(o))];
  DB.saveTbl(tbl); idbSync(blockId,tbl.id);
}
/* ── Rename a lane in place: click its name, type, Enter (or click away) saves,
   Escape cancels. A lane IS an option of the grouped property, so this renames the
   option for every entry and view (idbRenameOption). The "No <prop>" lane is a
   placeholder for empty values, so it isn't renamable. */
function idbLaneRenameStart(e,el,blockId,colId,oldL){
  e.stopPropagation();
  if(el.isContentEditable) return;
  el.contentEditable='true'; el.spellcheck=false; el.classList.add('editing');
  el.focus();
  const r=document.createRange(); r.selectNodeContents(el);
  const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
  let done=false;
  const finish=commit=>{
    if(done) return; done=true;
    el.removeEventListener('keydown',onKey); el.removeEventListener('blur',onBlur);
    el.contentEditable='false'; el.classList.remove('editing');
    const blk=findBlock(blockId), tbl=idbTbl(blk);
    const changed=commit&&tbl&&idbRenameOption(tbl.id,colId,oldL,el.innerText);
    if(!changed) el.textContent=oldL;            // cancelled / empty / duplicate → put it back
    if(changed) idbSync(blockId,tbl.id);
  };
  const onKey=ev=>{
    ev.stopPropagation();                        // keep editor/global shortcuts out of the lane name
    if(ev.key==='Enter'){ ev.preventDefault(); finish(true); }
    else if(ev.key==='Escape'){ ev.preventDefault(); finish(false); }
  };
  const onBlur=()=>finish(true);
  el.addEventListener('keydown',onKey); el.addEventListener('blur',onBlur);
}
/* Commit the name-on-creation title, leave edit mode, and re-render the board so the
   title becomes plain (non-editable) text. */
function idbBoardTitleCommit(blockId,rowId,colId,val){
  _idbEditTitleRow=null;
  idbSetCell(blockId,rowId,colId,val);
  const blk=findBlock(blockId); if(blk) idbSync(blockId,blk.tableId);
}
function idbCardMeta(r,c){
  const v=r.cells[c.id]; if(!v||(Array.isArray(v)&&!v.length))return'';
  if(c.type==='multiselect')return idbMsChips(c,v);
  if(isSelectish(c)){const o=(c.options||[]).find(x=>x.l===v);const cc=o?o.c:'#888';return c.type==='status'?`<span class="idb-status"><span class="idb-status-dot" style="background:${cc}"></span>${escHtml(v)}</span>`:`<span class="chip" style="background:${cc}22;color:${cc}">${escHtml(v)}</span>`;}
  if(c.type==='date')return `<span class="idb-card-d">${new Date(v+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>`;
  if(c.type==='checkbox')return `<span class="idb-card-d">\u2713</span>`;
  return `<span class="idb-card-d">${escHtml(String(v).slice(0,28))}</span>`;
}
/* \u2500\u2500 BOARD DRAG: move a card between swim lanes \u2500\u2500
   Dropping a card on another column sets the row's group property to that lane's
   value (the empty "No <prop>" lane clears it), so the move sticks. Mirrors the
   table-view row drag, but a lane drop is an explicit intent so there's no prompt. */
let _idbCardDrag=null;
function idbCardDragStart(e,blockId,rowId){
  const _b=findBlock(blockId);
  _idbCardDrag={blockId,rowId,tableId:_b&&_b.tableId};
  try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','card');}catch(_){}
  e.stopPropagation();
  const card=e.currentTarget; setTimeout(()=>card&&card.classList.add('idb-card-dragging'),0);
}
function idbCardDragOverCol(e){
  if(!_idbCardDrag)return;
  e.preventDefault(); e.stopPropagation();
  if(e.dataTransfer)e.dataTransfer.dropEffect='move';
  const col=e.currentTarget;
  document.querySelectorAll('.idb-bcol.idb-bcol-drop').forEach(c=>{if(c!==col)c.classList.remove('idb-bcol-drop');});
  col.classList.add('idb-bcol-drop');
}
function idbBcolDragLeave(e){ const c=e.currentTarget; if(!c.contains(e.relatedTarget)) c.classList.remove('idb-bcol-drop'); }
function idbCardDropToCol(e,blockId,groupKey){
  e.preventDefault(); e.stopPropagation();
  document.querySelectorAll('.idb-bcol-drop').forEach(c=>c.classList.remove('idb-bcol-drop'));
  if(!_idbCardDrag)return;
  const {rowId,tableId:srcTableId}=_idbCardDrag; _idbCardDrag=null;
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const groupCol=idbBoardGroupCol(blk,tbl);
  if(!groupCol)return;
  // Dropped onto a DIFFERENT database's board → move the entry across tables and
  // pin its group property to the lane it landed in.
  if(srcTableId&&srcTableId!==tbl.id){
    const srcTbl=DB.getTbl(srcTableId); if(!srcTbl)return;
    idbMoveRowConfirm(srcTbl,rowId,tbl,{setCells:{[groupCol.id]:groupKey}});
    return;
  }
  const row=tbl.rows.find(r=>r.id===rowId); if(!row)return;
  if((row.cells[groupCol.id]||'')===groupKey)return;   // same lane \u2192 nothing to do
  row.cells[groupCol.id]=groupKey;
  DB.saveTbl(tbl); idbSync(blockId,tbl.id);
}
function idbCardDragEnd(){ _idbCardDrag=null; document.querySelectorAll('.idb-card-dragging,.idb-bcol-drop').forEach(c=>c.classList.remove('idb-card-dragging','idb-bcol-drop')); }
/* \u2500\u2500 CALENDAR VIEW (nav/date-col live in idbCalBar) \u2500\u2500 */
