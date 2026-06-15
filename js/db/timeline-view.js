function idbTimelineBar(blk,tbl){
  const dateCols=tbl.columns.filter(c=>c.type==='date');
  if(!dateCols.length) return idbToolbar(blk,tbl,'table');
  const dateCol=tbl.columns.find(c=>c.id===blk.dateCol)||dateCols[0];
  const dir=blk.tlDesc?'Latest first':'Soonest first';
  return `<div class="idb-toolbar"><span class="idb-tb-lbl">By</span><select class="idb-sel" onchange="idbSetDateCol('${blk.id}',this.value)">${dateCols.map(c=>`<option value="${c.id}"${c.id===dateCol.id?' selected':''}>${escHtml(c.name)}</option>`).join('')}</select><button class="idb-tb-btn" onclick="idbTlToggleDir('${blk.id}')" data-tip="Reverse order">${dir}</button><span class="idb-tb-grow"></span>${idbFilterChips(blk,tbl)}<button class="idb-tb-ic${(blk.filters||[]).length?' on':''}" onclick="idbOpenFilter(event,'${blk.id}')" data-tip="Filter">${IDB_ICON.filter}</button></div>`;
}
function idbTlToggleDir(blockId){const blk=findBlock(blockId);if(blk){blk.tlDesc=!blk.tlDesc;idbPersistView(blk);reRenderBlock(blockId);}}
function idbTimelineView(blk,tbl){
  const dateCols=tbl.columns.filter(c=>c.type==='date');
  if(!dateCols.length) return `<div class="idb-note">Add a <b>Date</b> property to build a timeline.</div>`;
  const dateCol=tbl.columns.find(c=>c.id===blk.dateCol)||dateCols[0];
  const rows=idbFilteredRows(blk,tbl);
  let dated=rows.filter(r=>r.cells[dateCol.id]).sort((a,b)=>String(a.cells[dateCol.id]).localeCompare(String(b.cells[dateCol.id])));
  if(blk.tlDesc) dated=dated.reverse();
  const undated=rows.filter(r=>!r.cells[dateCol.id]);
  const todayISO=new Date().toISOString().slice(0,10);
  const chipCols=tbl.columns.filter(hasOpts).slice(0,2);
  const item=r=>{
    const v=r.cells[dateCol.id];
    const d=v?new Date(v+'T12:00:00'):null;
    const dl=d?d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}):'No date';
    const isToday=v===todayISO, isPast=v&&v<todayISO;
    const chips=chipCols.map(c=>idbCardMeta(r,c)).filter(Boolean).join('');
    return `<div class="idb-tl-item${isPast?' past':''}${isToday?' today':''}" onclick="idbOpenRow('${blk.id}','${r.id}')"><div class="idb-tl-date">${dl}${isToday?'<span class="idb-tl-tod">Today</span>':''}</div><div class="idb-tl-dot"></div><div class="idb-tl-card"><div class="idb-tl-title">${idbRowIcon(r)}${escHtml(idbRowTitle(tbl,r)||'Untitled')}</div>${chips?`<div class="idb-tl-chips">${chips}</div>`:''}</div></div>`;
  };
  let html='', lastMon='';
  dated.forEach(r=>{
    const mon=r.cells[dateCol.id].slice(0,7);
    if(mon!==lastMon){ lastMon=mon; html+=`<div class="idb-tl-month">${new Date(r.cells[dateCol.id]+'T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'})}</div>`; }
    html+=item(r);
  });
  if(undated.length) html+=`<div class="idb-tl-month">No date</div>`+undated.map(item).join('');
  if(!dated.length&&!undated.length) html=`<div class="idb-empty" style="padding:22px">${tbl.rows.length?'No entries match the filters.':'No entries yet.'}</div>`;
  return `<div class="idb-timeline">${html}</div><div class="idb-foot" onclick="idbAddRow('${blk.id}')"><span class="np-pill">+ New Page</span></div>`;
}
