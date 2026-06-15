function idbCalBar(blk,tbl){
  const dateCols=tbl.columns.filter(c=>c.type==='date');
  if(!dateCols.length) return idbToolbar(blk,tbl,'table'); // still let them add a date prop & filter
  const dateCol=tbl.columns.find(c=>c.id===blk.dateCol)||dateCols[0];
  const [yy,mm]=idbYM(blk).split('-').map(Number);
  const monthName=new Date(yy,mm-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
  return `<div class="idb-toolbar"><button class="idb-navbtn" onclick="idbCalNav('${blk.id}',-1)">\u2039</button><span class="idb-cal-month">${monthName}</span><button class="idb-navbtn" onclick="idbCalNav('${blk.id}',1)">\u203a</button><span class="idb-tb-lbl" style="margin-left:6px">By</span><select class="idb-sel" onchange="idbSetDateCol('${blk.id}',this.value)">${dateCols.map(c=>`<option value="${c.id}"${c.id===dateCol.id?' selected':''}>${escHtml(c.name)}</option>`).join('')}</select><span class="idb-tb-grow"></span>${idbFilterChips(blk,tbl)}${idbSortChip(blk,tbl)}
    <button class="idb-tb-ic${(blk.sort&&blk.sort.colId)?' on':''}" onclick="idbSortMenu(event,'${blk.id}')" data-tip="Sort">${IDB_ICON.sort}</button>
    <button class="idb-tb-ic${(blk.filters||[]).length?' on':''}" onclick="idbOpenFilter(event,'${blk.id}')" data-tip="Filter">${IDB_ICON.filter}</button>
    <button class="idb-tb-ic${(blk.hiddenCols||[]).length?' on':''}" onclick="idbPropsMenu(event,'${blk.id}')" data-tip="Properties">${IDB_ICON.props}</button></div>`;
}
/* A clickable, editable property chip shown on a (detailed) calendar event. */
function idbCalChip(blk,r,c){
  const v=r.cells[c.id];
  const click=`onclick="event.stopPropagation();idbOpenSel(event,'${blk.id}','${r.id}','${c.id}')"`;
  if(c.type==='multiselect'){
    const vals=msVals(v);
    if(!vals.length) return `<span class="idb-cev-chip empty" ${click} title="${escAttr(c.name)}">+ ${escHtml(c.name)}</span>`;
    return vals.map(lbl=>{const o=(c.options||[]).find(x=>x.l===lbl);const cc=o?o.c:'#888';return `<span class="idb-cev-chip" ${click} style="background:${cc}22;color:${cc}" title="${escAttr(c.name)}">${escHtml(lbl)}</span>`;}).join('');
  }
  const o=v?(c.options||[]).find(x=>x.l===v):null; const cc=o?o.c:'#888';
  if(!v) return `<span class="idb-cev-chip empty" ${click} title="${escAttr(c.name)}">+ ${escHtml(c.name)}</span>`;
  if(c.type==='status') return `<span class="idb-cev-chip status" ${click} title="${escAttr(c.name)}"><span class="idb-status-dot" style="background:${cc}"></span>${escHtml(v)}</span>`;
  return `<span class="idb-cev-chip" ${click} style="background:${cc}22;color:${cc}" title="${escAttr(c.name)}">${escHtml(v)}</span>`;
}
/* One calendar event \u2014 draggable from ANYWHERE on the item (to reschedule). */
function idbCalEvent(blk,tbl,r,detailed){
  const title=escHtml(idbRowTitle(tbl,r)||'Untitled');
  const ico=idbRowIcon(r);
  const drag=`draggable="true" ondragstart="idbCalEvDragStart(event,'${blk.id}','${r.id}')" ondragend="idbCalEvDragEnd()"`;
  if(detailed){
    const vis=idbVisibleCols(blk,tbl);                 // respect the Properties show/hide menu
    const imgCol=vis.find(c=>c.type==='image');
    const doc=r.docId?DB.getDoc(r.docId):null;
    const coverSrc=(imgCol&&r.cells[imgCol.id]&&srcFor(r.cells[imgCol.id]))||((doc&&doc.meta&&doc.meta.cover)?srcFor(doc.meta.cover):'');
    const cover=coverSrc?`<div class="idb-cev-cover"><img src="${coverSrc}" draggable="false" alt=""></div>`:'';
    const chips=vis.filter(hasOpts).slice(0,3).map(c=>idbCalChip(blk,r,c)).join('');
    return `<div class="idb-cal-ev idb-cev${cover?' has-cover':''}" ${drag} onclick="idbOpenRow('${blk.id}','${r.id}')" title="Drag to reschedule \u00b7 click to open">${cover}<div class="idb-cev-row"><span class="idb-cev-t">${ico}${title}</span></div>${chips?`<div class="idb-cev-chips">${chips}</div>`:''}</div>`;
  }
  return `<div class="idb-cal-ev" ${drag} onclick="idbOpenRow('${blk.id}','${r.id}')" title="Drag to reschedule \u00b7 click to open">${ico}<span class="idb-cev-t">${title}</span></div>`;
}
function idbCalView(blk,tbl){
  const dateCols=tbl.columns.filter(c=>c.type==='date');
  if(!dateCols.length) return `<div class="idb-note">Add a <b>Date</b> property to place entries on a calendar.</div>`;
  const dateCol=tbl.columns.find(c=>c.id===blk.dateCol)||dateCols[0];
  const now=new Date(), detailed=true;   // covers + property chips always on; the Properties menu controls which show
  const [yy,mm]=idbYM(blk).split('-').map(Number);
  const startDow=new Date(yy,mm-1,1).getDay(), daysInMonth=new Date(yy,mm,0).getDate();
  const pad=n=>String(n).padStart(2,'0');
  // Key events by full ISO date so adjacent-month days (peeking into the grid) can
  // show their events too, not just the current month.
  const byDate={};
  idbFilteredRows(blk,tbl).forEach(r=>{const v=r.cells[dateCol.id];if(!v)return;(byDate[v]=byDate[v]||[]).push(r);});
  let cells='';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d=>cells+=`<div class="idb-cal-dow">${d}</div>`);
  const firstCell=new Date(yy,mm-1,1-startDow);
  const totalCells=Math.ceil((startDow+daysInMonth)/7)*7;
  for(let i=0;i<totalCells;i++){
    const d=new Date(firstCell); d.setDate(firstCell.getDate()+i);
    const inMonth=d.getMonth()===mm-1;
    const dISO=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const isTod=d.toDateString()===now.toDateString();
    const evs=(byDate[dISO]||[]).map(r=>idbCalEvent(blk,tbl,r,detailed)).join('');
    cells+=`<div class="idb-cal-cell${inMonth?'':' idb-cal-out'}" ondragover="idbCalDayOver(event)" ondragleave="idbCalDayLeave(event)" ondrop="idbCalDrop(event,'${blk.id}','${dISO}')"><div class="idb-cal-num${isTod?' tod':''}">${d.getDate()}</div>${evs}</div>`;
  }
  return `<div class="idb-cal${detailed?' detailed':''}" ondragstart="idbCalContainerDragStart(event)"><div class="idb-cal-grid">${cells}</div></div>`;
}
function idbCalToggleDetails(blockId){const blk=findBlock(blockId);if(blk){blk.calDetails=!blk.calDetails;idbPersistView(blk);reRenderBlock(blockId);}}
/* Drag a calendar event to another day to reschedule it. Only the grip starts a
   drag; any other drag inside the calendar is cancelled so the block/page stays put. */
let _calDrag=null;
/* Cancel any drag that doesn't start on an event, so dragging the calendar body
   never reorders the block — the block moves only via its own gutter handle. */
function idbCalContainerDragStart(e){ if(!e.target.closest('.idb-cal-ev')){ e.preventDefault(); e.stopPropagation(); } }
let _calDragEl=null,_calGhost=null;
function idbCalEvDragStart(e,blockId,rowId){
  _calDrag={blockId,rowId}; const el=e.currentTarget;
  try{
    e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','ev');
    // Build a translucent copy of the card that follows the cursor while dragging.
    const r=el.getBoundingClientRect();
    const ghost=el.cloneNode(true);
    ghost.classList.add('idb-cal-ghost'); ghost.classList.remove('idb-cal-dragging');
    ghost.style.width=r.width+'px';
    document.body.appendChild(ghost); _calGhost=ghost;
    const ox=Math.max(8,Math.min(e.clientX-r.left,r.width-8));
    const oy=Math.max(6,Math.min(e.clientY-r.top,r.height-6));
    e.dataTransfer.setDragImage(ghost,ox,oy);
  }catch(_){}
  e.stopPropagation();
  // Leave a dimmed "ghost" of the item in its original spot while dragging.
  _calDragEl=el; setTimeout(()=>{ if(_calDragEl)_calDragEl.classList.add('idb-cal-dragging'); },0);
  document.body.classList.add('idb-cal-dragging-active');
}
function idbCalEvDragEnd(){
  _calDrag=null;
  if(_calDragEl){_calDragEl.classList.remove('idb-cal-dragging');_calDragEl=null;}
  if(_calGhost){_calGhost.remove();_calGhost=null;}
  document.body.classList.remove('idb-cal-dragging-active');
  document.querySelectorAll('.idb-cal-drop').forEach(c=>c.classList.remove('idb-cal-drop'));
}
function idbCalDayOver(e){ if(!_calDrag)return; e.preventDefault(); e.stopPropagation(); if(e.dataTransfer)e.dataTransfer.dropEffect='move'; e.currentTarget.classList.add('idb-cal-drop'); }
function idbCalDayLeave(e){ e.currentTarget.classList.remove('idb-cal-drop'); }
function idbCalDrop(e,blockId,dISO){
  e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('idb-cal-drop');
  if(!_calDrag)return; const {rowId}=_calDrag; _calDrag=null;
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const dateCol=tbl.columns.find(c=>c.id===blk.dateCol)||tbl.columns.find(c=>c.type==='date');
  const row=tbl.rows.find(r=>r.id===rowId);
  if(row&&dateCol){ row.cells[dateCol.id]=dISO; DB.saveTbl(tbl); idbSync(blockId,tbl.id); }
}
function idbCalNav(blockId,delta){
  const blk=findBlock(blockId); if(!blk)return;
  const now=new Date();
  const ym=blk.calYM||(now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0'));
  let [yy,mm]=ym.split('-').map(Number); mm+=delta;
  if(mm<1){mm=12;yy--;} if(mm>12){mm=1;yy++;}
  blk.calYM=yy+'-'+String(mm).padStart(2,'0'); idbPersistView(blk); reRenderBlock(blockId);
}
/* ── TIMELINE VIEW: entries in chronological order by a date property ── */
