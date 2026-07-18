/* Header label for the inline calendar, per view (month / week range / day). */
function idbCalLabel(blk){
  const view=blk.calView||'month';
  const anchor=blk.calAnchorDS||dateStr(new Date());
  if(view==='week'){ const s=_calWeekStart(anchor), e=new Date(s); e.setDate(s.getDate()+6);
    return `${MONTHS[s.getMonth()].slice(0,3)} ${s.getDate()} \u2013 ${MONTHS[e.getMonth()].slice(0,3)} ${e.getDate()}`; }
  if(view==='day'){ const d=_calParseDS(anchor); return `${WDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`; }
  const [yy,mm]=idbYM(blk).split('-').map(Number);
  return new Date(yy,mm-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
}
function idbCalBar(blk,tbl){
  const dateCols=tbl.columns.filter(c=>c.type==='date');
  if(!dateCols.length) return idbToolbar(blk,tbl,'table'); // still let them add a date prop & filter
  const dateCol=tbl.columns.find(c=>c.id===blk.dateCol)||dateCols[0];
  const view=blk.calView||'month';
  const seg=`<span class="idb-calviewseg">${['month','week','day'].map(v=>`<button class="${v===view?'on':''}" onclick="idbSetCalView('${blk.id}','${v}')">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</span>`;
  return `<div class="idb-toolbar"><button class="idb-navbtn" onclick="idbCalNav('${blk.id}',-1)">\u2039</button><span class="idb-cal-month">${idbCalLabel(blk)}</span><button class="idb-navbtn" onclick="idbCalNav('${blk.id}',1)">\u203a</button><button class="idb-navbtn idb-cal-today" onclick="idbCalToday('${blk.id}')" data-tip="Today">\u25cf</button>${seg}<span class="idb-tb-lbl" style="margin-left:6px">By</span><select class="idb-sel" onchange="idbSetDateCol('${blk.id}',this.value)">${dateCols.map(c=>`<option value="${c.id}"${c.id===dateCol.id?' selected':''}>${escHtml(c.name)}</option>`).join('')}</select><span class="idb-tb-grow"></span>${idbFilterChips(blk,tbl)}${idbSortChip(blk,tbl)}
    <button class="idb-tb-ic${(blk.sort&&blk.sort.colId)?' on':''}" onclick="idbSortMenu(event,'${blk.id}')" data-tip="Sort">${IDB_ICON.sort}</button>
    <button class="idb-tb-ic${(blk.filters||[]).length?' on':''}" onclick="idbOpenFilter(event,'${blk.id}')" data-tip="Filter">${IDB_ICON.filter}</button>
    <button class="idb-tb-ic${(blk.hiddenCols||[]).length?' on':''}" onclick="idbPropsMenu(event,'${blk.id}')" data-tip="Properties">${IDB_ICON.props}</button></div>`;
}
function idbSetCalView(blockId,view){
  const blk=findBlock(blockId); if(!blk)return;
  blk.calView=view; if(view!=='month' && !blk.calAnchorDS) blk.calAnchorDS=dateStr(new Date());
  idbPersistView(blk); reRenderBlock(blockId);
}
function idbCalToday(blockId){
  const blk=findBlock(blockId); if(!blk)return;
  const n=new Date(); blk.calYM=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0'); blk.calAnchorDS=dateStr(n);
  idbPersistView(blk); reRenderBlock(blockId);
}
/* Create a new entry on a given date (replaces click-to-create) and open it. */
function idbCalAddOnDate(blockId,dISO){
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const dateCol=tbl.columns.find(c=>c.id===blk.dateCol)||tbl.columns.find(c=>c.type==='date'); if(!dateCol)return;
  const cells={}; tbl.columns.forEach(c=>cells[c.id]=''); cells[dateCol.id]=dISO;
  const row={id:mkId('r'),cells}; tbl.rows.push(row); DB.saveTbl(tbl); idbSync(blockId,tbl.id);
  if(typeof idbFocusCardTitle==='function') idbFocusCardTitle(blockId,row.id);
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
  const ico=idbRowIcon(r);
  const titleColId=idbTitleColId(tbl);
  const rawTitle=escHtml(titleColId&&r.cells[titleColId]!=null?r.cells[titleColId]:'');
  // Title is editable in place; click elsewhere on the chip to open the entry.
  const titleEd=`<span class="idb-ed idb-cev-title-ed" contenteditable="true" data-ph="Untitled" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" onblur="idbSetCell('${blk.id}','${r.id}','${titleColId}',this.innerText.trim())">${rawTitle}</span>`;
  const drag=`draggable="true" ondragstart="idbCalEvDragStart(event,'${blk.id}','${r.id}')" ondragend="idbCalEvDragEnd()"`;
  if(detailed){
    const vis=idbVisibleCols(blk,tbl);                 // respect the Properties show/hide menu
    const imgCol=vis.find(c=>c.type==='image');
    const doc=r.docId?DB.getDoc(r.docId):null;
    const coverSrc=(imgCol&&r.cells[imgCol.id]&&srcFor(r.cells[imgCol.id]))||((doc&&doc.meta&&doc.meta.cover)?srcFor(doc.meta.cover):'');
    const cover=coverSrc?`<div class="idb-cev-cover"><img src="${coverSrc}" draggable="false" alt=""></div>`:'';
    const chips=vis.filter(hasOpts).slice(0,3).map(c=>idbCalChip(blk,r,c)).join('');
    return `<div class="idb-cal-ev idb-cev${cover?' has-cover':''}" data-rid="${r.id}" ${drag} onclick="idbOpenRow('${blk.id}','${r.id}')" title="Drag to reschedule \u00b7 click to open"><button class="idb-cev-del" onclick="event.stopPropagation();idbDelRow('${blk.id}','${r.id}')" data-tip="Delete">&#10005;</button>${cover}<div class="idb-cev-row"><span class="idb-cev-t">${ico}${titleEd}</span></div>${chips?`<div class="idb-cev-chips">${chips}</div>`:''}</div>`;
  }
  return `<div class="idb-cal-ev" data-rid="${r.id}" ${drag} onclick="idbOpenRow('${blk.id}','${r.id}')" title="Drag to reschedule \u00b7 click to open"><button class="idb-cev-del" onclick="event.stopPropagation();idbDelRow('${blk.id}','${r.id}')" data-tip="Delete">&#10005;</button>${ico}<span class="idb-cev-t">${titleEd}</span></div>`;
}
function idbCalView(blk,tbl){
  const dateCols=tbl.columns.filter(c=>c.type==='date');
  if(!dateCols.length) return `<div class="idb-note">Add a <b>Date</b> property to place entries on a calendar.</div>`;
  const view=blk.calView||'month';
  if(view==='week') return idbCalWeekView(blk,tbl);
  if(view==='day') return idbCalDayView(blk,tbl);
  return idbCalMonthView(blk,tbl);
}
function idbCalMonthView(blk,tbl){
  const dateCol=tbl.columns.find(c=>c.id===blk.dateCol)||tbl.columns.find(c=>c.type==='date');
  const now=new Date(), detailed=true;   // covers + property chips always on; the Properties menu controls which show
  const [yy,mm]=idbYM(blk).split('-').map(Number);
  const startDow=new Date(yy,mm-1,1).getDay(), daysInMonth=new Date(yy,mm,0).getDate();
  const pad=n=>String(n).padStart(2,'0');
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
    cells+=`<div class="idb-cal-cell${inMonth?'':' idb-cal-out'}" ondragover="idbCalDayOver(event)" ondragleave="idbCalDayLeave(event)" ondrop="idbCalDrop(event,'${blk.id}','${dISO}')"><div class="idb-cal-numrow"><span class="idb-cal-num${isTod?' tod':''}">${d.getDate()}</span><button class="idb-cal-add" onclick="event.stopPropagation();idbCalAddOnDate('${blk.id}','${dISO}')" data-tip="New entry">+</button></div>${evs}</div>`;
  }
  return `<div class="idb-cal detailed" ondragstart="idbCalContainerDragStart(event)"><div class="idb-cal-grid">${cells}</div></div>`;
}
function idbCalWeekView(blk,tbl){
  const dateCol=tbl.columns.find(c=>c.id===blk.dateCol)||tbl.columns.find(c=>c.type==='date');
  const start=_calWeekStart(blk.calAnchorDS||dateStr(new Date())), todayDS=dateStr(new Date());
  const byDate={};
  idbFilteredRows(blk,tbl).forEach(r=>{const v=r.cells[dateCol.id];if(v)(byDate[v]=byDate[v]||[]).push(r);});
  let cols='';
  for(let i=0;i<7;i++){ const dt=new Date(start); dt.setDate(start.getDate()+i); const ds=dateStr(dt);
    const evs=(byDate[ds]||[]).map(r=>idbCalEvent(blk,tbl,r,true)).join('');
    cols+=`<div class="idb-calw-col${ds===todayDS?' tod':''}" ondragover="idbCalDayOver(event)" ondragleave="idbCalDayLeave(event)" ondrop="idbCalDrop(event,'${blk.id}','${ds}')">
      <div class="idb-calw-h"><span class="idb-calw-wd">${WDAYS[dt.getDay()]}</span><span class="idb-calw-dn${ds===todayDS?' tod':''}">${dt.getDate()}</span></div>
      <div class="idb-calw-body">${evs}<button class="idb-calw-add" onclick="idbCalAddOnDate('${blk.id}','${ds}')"><span class="np-pill">+ New</span></button></div>
    </div>`;
  }
  return `<div class="idb-cal detailed" ondragstart="idbCalContainerDragStart(event)"><div class="idb-calw">${cols}</div></div>`;
}
function idbCalDayView(blk,tbl){
  const dateCol=tbl.columns.find(c=>c.id===blk.dateCol)||tbl.columns.find(c=>c.type==='date');
  const ds=blk.calAnchorDS||dateStr(new Date()), todayDS=dateStr(new Date());
  const evs=idbFilteredRows(blk,tbl).filter(r=>r.cells[dateCol.id]===ds).map(r=>idbCalEvent(blk,tbl,r,true)).join('');
  return `<div class="idb-cal detailed" ondragstart="idbCalContainerDragStart(event)"><div class="idb-cald${ds===todayDS?' tod':''}" ondragover="idbCalDayOver(event)" ondragleave="idbCalDayLeave(event)" ondrop="idbCalDrop(event,'${blk.id}','${ds}')">
    <div class="idb-cald-body">${evs||'<div class="idb-cald-empty">Nothing on this day yet.</div>'}<button class="idb-calw-add" onclick="idbCalAddOnDate('${blk.id}','${ds}')"><span class="np-pill">+ New entry</span></button></div>
  </div></div>`;
}
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
  const view=blk.calView||'month';
  if(view==='week'){ blk.calAnchorDS=_calAddDS(blk.calAnchorDS||dateStr(new Date()),delta*7); }
  else if(view==='day'){ blk.calAnchorDS=_calAddDS(blk.calAnchorDS||dateStr(new Date()),delta); }
  else {
    const now=new Date();
    const ym=blk.calYM||(now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0'));
    let [yy,mm]=ym.split('-').map(Number); mm+=delta;
    if(mm<1){mm=12;yy--;} if(mm>12){mm=1;yy++;}
    blk.calYM=yy+'-'+String(mm).padStart(2,'0');
  }
  idbPersistView(blk); reRenderBlock(blockId);
}
/* ── TIMELINE VIEW: entries in chronological order by a date property ── */
