/* ═══════════════════════════════════════════════
   CALENDAR — one central calendar that every "sub-calendar" feeds into:
     • Pages       — standalone pages that carry a date property
     • <database>  — one sub-calendar per database table with a date column
   Each sub-calendar gets its own colour, and can be shown/hidden. Colour +
   visibility persist in localStorage (folio_calprefs) so they survive reloads
   and ride along with cloud sync.
═══════════════════════════════════════════════ */
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const WDAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const CALPREFS_KEY='folio_calprefs';
const PAGES_SRC='__pages__';
function _calPrefs(){ try{ const p=JSON.parse(localStorage.getItem(CALPREFS_KEY)||'{}'); p.colors=p.colors||{}; p.hidden=p.hidden||{}; return p; }catch{ return {colors:{},hidden:{}}; } }
function _saveCalPrefs(p){ try{ localStorage.setItem(CALPREFS_KEY,JSON.stringify(p)); }catch(e){} }

/* The sub-calendars that currently exist, in a stable order, each resolved to a
   colour (stored override → palette default) and a hidden flag. */
function calSources(){
  const prefs=_calPrefs(); const out=[];
  const hasPageDates=DB.getDocs().some(d=>!d.dbId && (d.props||[]).some(p=>p.type==='date'&&p.value));
  if(hasPageDates) out.push({id:PAGES_SRC,name:'Pages'});
  DB.getTbls().forEach(t=>{ if((t.columns||[]).some(c=>c.type==='date')) out.push({id:t.id,name:t.name||'Database'}); });
  out.forEach((s,i)=>{ s.color=prefs.colors[s.id]||PALETTE_COLORS[i%PALETTE_COLORS.length]; s.hidden=!!prefs.hidden[s.id]; });
  return out;
}
function toggleCalSrc(id){ const p=_calPrefs(); if(p.hidden[id]) delete p.hidden[id]; else p.hidden[id]=true; _saveCalPrefs(p); renderCal(); }
function setCalSrcColor(id,color){ const p=_calPrefs(); p.colors[id]=color; _saveCalPrefs(p); renderCal(); }
function showAllCalSrc(){ const p=_calPrefs(); p.hidden={}; _saveCalPrefs(p); renderCal(); }

function renderCalLegend(srcs){
  const el=document.getElementById('cal-legend'); if(!el) return;
  if(!srcs.length){ el.innerHTML='<span class="cal-leg-empty">No dated items yet — give a page a date property or add a date column to a database.</span>'; return; }
  const anyHidden=srcs.some(s=>s.hidden);
  el.innerHTML=srcs.map(s=>`<span class="cal-leg${s.hidden?' off':''}" title="${s.hidden?'Show':'Hide'} ${escAttr(s.name)}">
      <label class="cal-leg-dot" style="background:${s.color}" title="Change colour" onclick="event.stopPropagation()"><input type="color" value="${s.color}" oninput="setCalSrcColor('${s.id}',this.value)"></label>
      <span class="cal-leg-nm" onclick="toggleCalSrc('${s.id}')">${escHtml(s.name)}</span>
    </span>`).join('')
    + (anyHidden?`<button class="cal-leg-all" onclick="showAllCalSrc()">Show all</button>`:'');
}

/* ── Date helpers for the week/day anchor ── */
function _calParseDS(ds){ const a=(ds||'').split('-').map(Number); return new Date(a[0],(a[1]||1)-1,a[2]||1); }
function _calAddDS(ds,days){ const d=_calParseDS(ds); d.setDate(d.getDate()+days); return dateStr(d); }
function _calWeekStart(ds){ const d=_calParseDS(ds); d.setDate(d.getDate()-d.getDay()); return d; }   // Sunday

/* Collect every dated item into { srcs, evts (dateStr→[ev]), color }. Shared by all views. */
function calBuildEvents(){
  const srcs=calSources();
  const color={}, hidden={};
  srcs.forEach(s=>{ color[s.id]=s.color; hidden[s.id]=s.hidden; });
  const evts={};
  const addEv=(ds,ev)=>{ if(hidden[ev.srcId]) return; (evts[ds]=evts[ds]||[]).push(ev); };
  DB.getDocs().forEach(doc=>{ if(doc.dbId) return;
    (doc.props||[]).filter(p=>p.type==='date'&&p.value).forEach(p=>
      addEv(p.value,{title:doc.title||'Untitled',id:doc.id,cls:'doc-ev',kind:'doc',propId:p.id,srcId:PAGES_SRC})); });
  DB.getTbls().forEach(tbl=>{ const dcols=tbl.columns.filter(c=>c.type==='date'); if(!dcols.length) return;
    (tbl.rows||[]).forEach(row=>{ dcols.forEach(col=>{ const v=row.cells[col.id]; if(v){
      const nm=idbRowTitle(tbl,row)||'Untitled';
      addEv(v,{title:nm,id:tbl.id,cls:'row-ev',kind:'row',tblId:tbl.id,rowId:row.id,colId:col.id,srcId:tbl.id}); }}); }); });
  return {srcs,evts,color};
}
/* One event chip, shared by month (details)/week/day. `full` shows cover + chips.
   The ✕ deletes a database row, or un-schedules a page (clears its date) — never
   silently trashes a whole page. */
function calEvChip(ev,color,full){
  const c=color[ev.srcId]||'var(--ac)';
  const tint=`background:${c}22;border-left:3px solid ${c};color:var(--tx)`;
  const drag=`draggable="true" ondragstart="calEvDragStart(event,'${encodeURIComponent(JSON.stringify(ev))}')" ondragend="calDrag=null;clearCalDrop()"`;
  const open=ev.kind==='row'?`calOpenRow('${ev.tblId}','${ev.rowId}')`:`nav('editor','${ev.id}')`;
  const del=ev.kind==='row'
    ? `<button class="cal-ev-del" onclick="event.stopPropagation();idbDeleteRow('${ev.tblId}','${ev.rowId}');renderCal()" data-tip="Delete">&#10005;</button>`
    : `<button class="cal-ev-del" onclick="event.stopPropagation();calUnschedule('${ev.id}','${ev.propId}')" data-tip="Remove from calendar">&#10005;</button>`;
  if(!full)
    return `<span class="cal-ev ${ev.cls}" style="${tint}" ${drag} onclick="event.stopPropagation();${open}" title="${escAttr(ev.title)}">${del}${escHtml(ev.title)}</span>`;
  // Detailed views: show a cover thumb + a couple of property chips. Pages read these
  // from doc.props; database rows read them from their table's option columns + a cover
  // image column (or the linked doc's cover) — previously rows showed only a bare title.
  const chip=(lbl,cc)=>`<span style="display:inline-block;padding:1px 5px;border-radius:10px;font-size:9px;background:${cc}22;color:${cc}">${escHtml(lbl)}</span>`;
  let coverHtml='', chips='';
  if(ev.kind==='row'){
    const tbl=DB.getTbl(ev.tblId), row=tbl&&(tbl.rows||[]).find(r=>r.id===ev.rowId);
    if(tbl&&row){
      const imgCol=tbl.columns.find(c=>c.type==='image');
      const doc=row.docId?DB.getDoc(row.docId):null;
      const cvSrc=(imgCol&&row.cells[imgCol.id]&&srcFor(row.cells[imgCol.id]))||(doc?.meta?.cover?srcFor(doc.meta.cover):'');
      if(cvSrc) coverHtml=`<span class="cal-ev-cover med" style="background-image:url('${cvSrc}');background-position:center"></span>`;
      const parts=[];
      tbl.columns.filter(hasOpts).forEach(col=>msVals(row.cells[col.id]).forEach(lbl=>{
        const o=(col.options||[]).find(x=>x.l===lbl); parts.push(chip(lbl,o?o.c:'var(--mu)'));
      }));
      chips=parts.slice(0,2).join('');
    }
  } else {
    const doc=DB.getDoc(ev.id); const cover=doc?.meta?.cover; const pos=doc?.meta?.coverPos!=null?doc.meta.coverPos:50;
    if(cover) coverHtml=`<span class="cal-ev-cover med" style="${coverThumbBg(cover,pos)}"></span>`;
    chips=(doc?.props||[]).filter(p=>p.type==='select'&&p.value).slice(0,2).map(p=>{const o=(p.options||[]).find(x=>x.l===p.value);return chip(p.value,o?o.c:'var(--mu)');}).join('');
  }
  return `<span class="cal-ev ${ev.cls}${coverHtml?' has-cover':''}" style="${tint}" ${drag} onclick="event.stopPropagation();${open}" title="${escAttr(ev.title)}">${del}${coverHtml}<span class="cal-ev-inner">${escHtml(ev.title)}</span>${chips?`<span class="cal-ev-props">${chips}</span>`:''}</span>`;
}
function calUnschedule(id,propId){ const doc=DB.getDoc(id); if(doc){ const p=(doc.props||[]).find(x=>x.id===propId); if(p){ p.value=null; DB.saveDoc(doc);} } renderCal(); }

/* ── Selected-day card stack (Phase 3) ──
   Clicking a month-grid day opens a side rail with the full cards (cover +
   property pills) for that day, so the month stays compact while the rich
   card view stays one click away. */
function _calDayCardHtml(ev,color){
  const c=color[ev.srcId]||'var(--ac)';
  const open=ev.kind==='row'?`calOpenRow('${ev.tblId}','${ev.rowId}')`:`nav('editor','${ev.id}')`;
  let cover='',chips='',icon='';
  const chip=(lbl,cc)=>`<span class="cdc-chip" style="background:${cc}22;color:${cc}">${escHtml(lbl)}</span>`;
  if(ev.kind==='row'){
    const tbl=DB.getTbl(ev.tblId), row=tbl&&(tbl.rows||[]).find(r=>r.id===ev.rowId);
    if(tbl&&row){
      const imgCol=tbl.columns.find(x=>x.type==='image');
      const doc=row.docId?DB.getDoc(row.docId):null;
      const cvSrc=(imgCol&&row.cells[imgCol.id]&&srcFor(row.cells[imgCol.id]))||(doc&&doc.meta&&doc.meta.cover?srcFor(doc.meta.cover):'');
      if(cvSrc) cover=`<div class="cdc-cover" style="background-image:url('${cvSrc}')"></div>`;
      const parts=[];
      tbl.columns.filter(hasOpts).forEach(col=>msVals(row.cells[col.id]).forEach(lbl=>{const o=(col.options||[]).find(x=>x.l===lbl);parts.push(chip(lbl,o?o.c:'var(--mu)'));}));
      chips=parts.slice(0,4).join('');
      if(doc&&doc.meta&&doc.meta.icon&&typeof iconHtml==='function') icon=`<span class="cdc-ico">${iconHtml(doc.meta.icon,'1.1em')}</span>`;
    }
  } else {
    const doc=DB.getDoc(ev.id);
    if(doc){
      const cvr=doc.meta&&doc.meta.cover; const pos=doc.meta&&doc.meta.coverPos!=null?doc.meta.coverPos:50;
      if(cvr) cover=`<div class="cdc-cover" style="${coverThumbBg(cvr,pos)}"></div>`;
      if(doc.meta&&doc.meta.icon&&typeof iconHtml==='function') icon=`<span class="cdc-ico">${iconHtml(doc.meta.icon,'1.1em')}</span>`;
      chips=(doc.props||[]).filter(p=>p.type==='select'&&p.value).slice(0,4).map(p=>{const o=(p.options||[]).find(x=>x.l===p.value);return chip(p.value,o?o.c:'var(--mu)');}).join('');
    }
  }
  return `<div class="cdc" style="--ev:${c}" onclick="${open}">${cover}<div class="cdc-b"><div class="cdc-t">${icon}<span>${escHtml(ev.title||'Untitled')}</span></div>${chips?`<div class="cdc-chips">${chips}</div>`:''}</div></div>`;
}
function calSelectDay(ds){
  S.calSelDay=ds;
  const panel=document.getElementById('cal-daypanel'); if(!panel) return;
  const data=calBuildEvents();
  const evList=data.evts[ds]||[];
  const d=_calParseDS(ds);
  const header=`<div class="cdp-hd"><div><div class="cdp-eyebrow">${WDAYS[d.getDay()]}</div><div class="cdp-date">${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}</div></div><button class="cdp-x" onclick="event.stopPropagation();closeCalDay()" aria-label="Close">&times;</button></div>`;
  const body=evList.length?evList.map(ev=>_calDayCardHtml(ev,data.color)).join(''):`<div class="cdp-empty">Nothing scheduled.</div>`;
  const add=`<button class="cdp-add" onclick="newDocOnDate('${ds}')"><span class="np-pill">+ New on this day</span></button>`;
  panel.innerHTML=header+`<div class="cdp-body">${body}${add}</div>`;
  panel.classList.add('open');
  document.querySelectorAll('.cal-cell.cal-cell-sel').forEach(c=>c.classList.remove('cal-cell-sel'));
  const cell=document.querySelector(`.cal-cell[data-ds="${ds}"]`); if(cell) cell.classList.add('cal-cell-sel');
}
function closeCalDay(){ S.calSelDay=null; const p=document.getElementById('cal-daypanel'); if(p) p.classList.remove('open'); document.querySelectorAll('.cal-cell.cal-cell-sel').forEach(c=>c.classList.remove('cal-cell-sel')); }

function calLabel(){
  if(S.calView==='week'){ const s=_calWeekStart(S.calAnchorDS), e=new Date(s); e.setDate(s.getDate()+6);
    return `${MONTHS[s.getMonth()].slice(0,3)} ${s.getDate()} – ${MONTHS[e.getMonth()].slice(0,3)} ${e.getDate()}, ${e.getFullYear()}`; }
  if(S.calView==='day'){ const d=_calParseDS(S.calAnchorDS); return `${WDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }
  return `${MONTHS[S.calM]} ${S.calY}`;
}
/* ── Dispatcher ── */
function renderCal(){
  S.calView=S.calView||'month'; S.calAnchorDS=S.calAnchorDS||dateStr(new Date());
  ['month','week','day'].forEach(v=>document.getElementById('calv-'+v)?.classList.toggle('on',S.calView===v));
  const data=calBuildEvents();
  renderCalLegend(data.srcs);
  document.getElementById('cal-label').textContent=calLabel();
  const grid=document.getElementById('cal-grid'); if(!grid) return;
  if(S.calView==='week') renderCalWeek(grid,data);
  else if(S.calView==='day') renderCalDay(grid,data);
  else renderCalMonth(grid,data);
  if(S.calView!=='month' && typeof closeCalDay==='function') closeCalDay();
  const detBtn=document.getElementById('cal-det-btn');
  if(detBtn){ detBtn.style.display=S.calView==='month'?'':'none'; detBtn.style.color=S.calShowDetails?'var(--ac)':''; detBtn.style.borderColor=S.calShowDetails?'var(--ac)':''; }
}
function renderCalMonth(grid,{evts,color}){
  const y=S.calY,m=S.calM, tod=dateStr(new Date());
  const fd=new Date(y,m,1).getDay(),dim=new Date(y,m+1,0).getDate(),pdim=new Date(y,m,0).getDate();
  const prevM=m===0?11:m-1, prevY=m===0?y-1:y, nextM=m===11?0:m+1, nextY=m===11?y+1:y;
  const limit=S.calShowDetails?2:3;
  const cellEventsHtml=(ds)=>{ const evList=evts[ds]||[];
    const evH=evList.slice(0,limit).map(ev=>calEvChip(ev,color,S.calShowDetails)).join('');
    const more=(evList.length>limit)?`<span class="cal-ev" style="color:var(--mu)">+${evList.length-limit} more</span>`:'';
    return evH+more; };
  const cell=(ds,dnum,extraCls)=>`<div class="cal-cell${extraCls}${S.calSelDay===ds?' cal-cell-sel':''}" data-ds="${ds}" onclick="calSelectDay('${ds}')" ondragover="calCellDragOver(event)" ondragleave="this.classList.remove('cal-drop')" ondrop="calCellDrop(event,'${ds}')"><div class="cal-numrow"><span class="cal-num">${dnum}</span><button class="cal-add" onclick="event.stopPropagation();newDocOnDate('${ds}')" data-tip="New page">+</button></div>${cellEventsHtml(ds)}</div>`;
  let html=WDAYS.map(d=>`<div class="cal-dh">${d}</div>`).join('');
  for(let i=fd-1;i>=0;i--){ const dnum=pdim-i; html+=cell(`${prevY}-${pad(prevM+1)}-${pad(dnum)}`,dnum,' om'); }
  for(let d=1;d<=dim;d++){ const ds=`${y}-${pad(m+1)}-${pad(d)}`; html+=cell(ds,d,ds===tod?' tod':''); }
  const fill=(7-(fd+dim)%7)%7; for(let d=1;d<=fill;d++){ html+=cell(`${nextY}-${pad(nextM+1)}-${pad(d)}`,d,' om'); }
  grid.className='cal-grid'+(S.calShowDetails?' details':''); grid.innerHTML=html;
}
function renderCalWeek(grid,{evts,color}){
  const start=_calWeekStart(S.calAnchorDS), tod=dateStr(new Date());
  let html='';
  for(let i=0;i<7;i++){ const dt=new Date(start); dt.setDate(start.getDate()+i); const ds=dateStr(dt);
    const evList=evts[ds]||[];
    html+=`<div class="calw-col${ds===tod?' tod':''}" data-ds="${ds}" ondragover="calCellDragOver(event)" ondragleave="this.classList.remove('cal-drop')" ondrop="calCellDrop(event,'${ds}')">
      <div class="calw-h"><span class="calw-wd">${WDAYS[dt.getDay()]}</span><span class="calw-dn${ds===tod?' tod':''}">${dt.getDate()}</span></div>
      <div class="calw-body">${evList.map(ev=>calEvChip(ev,color,true)).join('')}<button class="calw-add" onclick="newDocOnDate('${ds}')"><span class="np-pill">+ New page</span></button></div>
    </div>`;
  }
  grid.className='cal-grid cal-week'; grid.innerHTML=html;
}
function renderCalDay(grid,{evts,color}){
  const ds=S.calAnchorDS, evList=evts[ds]||[], tod=ds===dateStr(new Date());
  grid.className='cal-grid cal-day';
  grid.innerHTML=`<div class="cald-col${tod?' tod':''}" data-ds="${ds}" ondragover="calCellDragOver(event)" ondragleave="this.classList.remove('cal-drop')" ondrop="calCellDrop(event,'${ds}')">
    <div class="cald-body">${evList.map(ev=>calEvChip(ev,color,true)).join('')||'<div class="cald-empty">Nothing scheduled. Click below to add.</div>'}</div>
    <div class="cald-add" onclick="newDocOnDate('${ds}')"><span class="np-pill">+ New on this day</span></div>
  </div>`;
}
function calSetView(v){ S.calView=v; if(v!=='month'){ S.calAnchorDS=S.calAnchorDS||dateStr(new Date()); } renderCal(); }
function calShift(d){
  if(S.calView==='week') S.calAnchorDS=_calAddDS(S.calAnchorDS||dateStr(new Date()),d*7);
  else if(S.calView==='day') S.calAnchorDS=_calAddDS(S.calAnchorDS||dateStr(new Date()),d);
  else { S.calM+=d; if(S.calM>11){S.calM=0;S.calY++} if(S.calM<0){S.calM=11;S.calY--} }
  renderCal();
}
function calToday(){ const n=new Date(); S.calY=n.getFullYear(); S.calM=n.getMonth(); S.calAnchorDS=dateStr(n); renderCal(); }
function toggleCalDetails(){S.calShowDetails=!S.calShowDetails;renderCal()}
/* Open a database row's page (a quick peek) — replaces the old full-page DB jump. */
function calOpenRow(tblId,rowId){
  const tbl=DB.getTbl(tblId); if(!tbl) return;
  const row=(tbl.rows||[]).find(r=>r.id===rowId); if(!row) return;
  openDocPeek(idbEnsureRowDoc(tbl,row));
}
/* #4 — drag events between days to reschedule */
let calDrag=null;
function clearCalDrop(){document.querySelectorAll('.cal-cell.cal-drop').forEach(c=>c.classList.remove('cal-drop'))}
function calEvDragStart(e,payload){e.stopPropagation();try{calDrag=JSON.parse(decodeURIComponent(payload))}catch{calDrag=null}e.dataTransfer.effectAllowed='move'}
function calCellDragOver(e){if(!calDrag)return;e.preventDefault();e.dataTransfer.dropEffect='move';e.currentTarget.classList.add('cal-drop')}
function calCellDrop(e,ds){
  e.preventDefault(); e.currentTarget.classList.remove('cal-drop');
  if(!calDrag) return;
  if(calDrag.kind==='doc'){
    const doc=DB.getDoc(calDrag.id);
    if(doc){const p=(doc.props||[]).find(x=>x.id===calDrag.propId);if(p){p.value=ds;DB.saveDoc(doc)}}
  } else if(calDrag.kind==='row'){
    const t=DB.getTbl(calDrag.tblId); const r=t&&t.rows.find(x=>x.id===calDrag.rowId);
    if(r){ r.cells[calDrag.colId]=ds; DB.saveTbl(t); }
  }
  calDrag=null; renderCal();
}
function newDocOnDate(ds){
  const doc=blankDoc();
  doc.props.push({id:mkId('p'),name:'Deadline',type:'date',value:ds});
  DB.saveDoc(doc); nav('editor',doc.id);
}
