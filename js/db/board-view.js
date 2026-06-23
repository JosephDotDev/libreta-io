/* Row id whose board-card title is in the brief "name it on creation" edit mode.
   Only that one card renders an editable title; every other card's title is plain
   text, so once a card exists its title is renamed from the page view, not in place. */
let _idbEditTitleRow=null;
function idbBoardView(blk,tbl){
  const selCols=tbl.columns.filter(isSelectish);
  if(!selCols.length) return `<div class="idb-note">Add a <b>Select</b> or <b>Status</b> property to group entries on a board.</div>`;
  const groupCol=tbl.columns.find(c=>c.id===blk.groupCol&&isSelectish(c))||selCols[0];
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
      return `<div class="idb-card" data-rid="${r.id}" draggable="true" ondragstart="idbCardDragStart(event,'${blk.id}','${r.id}')" ondragend="idbCardDragEnd()" onclick="idbOpenRow('${blk.id}','${r.id}')"><button class="idb-card-del" onclick="event.stopPropagation();idbDelRow('${blk.id}','${r.id}')" data-tip="Delete">&#10005;</button>${cover}<div class="idb-card-t">${idbRowIcon(r)}${titleEd}</div>${meta?`<div class="idb-card-m">${meta}</div>`:''}</div>`;
    }).join('');
    const more=idbBoardMore(blk,gk,rows.length,shownRows.length);
    return `<div class="idb-bcol" ondragover="idbCardDragOverCol(event)" ondragleave="idbBcolDragLeave(event)" ondrop="idbCardDropToCol(event,'${blk.id}','${escAttr(g.key)}')"><div class="idb-bcol-h"><span class="idb-dd-dot" style="background:${g.color}"></span>${escHtml(g.label)}<span class="idb-mu" style="margin-left:auto">${rows.length}</span></div><div class="idb-bcol-b">${cards}${more}<div class="idb-bcard-add" onclick="idbBoardAddRow('${blk.id}','${groupCol.id}','${escAttr(g.key)}')"><span class="np-pill">+ New Page</span></div></div></div>`;
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
  const groupCol=tbl.columns.find(c=>c.id===blk.groupCol&&isSelectish(c))||tbl.columns.filter(isSelectish)[0];
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
