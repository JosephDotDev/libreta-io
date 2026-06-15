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

function renderCal(){
  const y=S.calY,m=S.calM;
  document.getElementById('cal-label').textContent=`${MONTHS[m]} ${y}`;
  const srcs=calSources();
  renderCalLegend(srcs);
  const color={}, hidden={};
  srcs.forEach(s=>{ color[s.id]=s.color; hidden[s.id]=s.hidden; });

  const evts={}; // dateStr → [ev]
  const addEv=(ds,ev)=>{ if(hidden[ev.srcId]) return; (evts[ds]=evts[ds]||[]).push(ev); };
  // Pages with date props (standalone pages only — db rows come from their table)
  DB.getDocs().forEach(doc=>{
    if(doc.dbId) return;
    (doc.props||[]).filter(p=>p.type==='date'&&p.value).forEach(p=>
      addEv(p.value,{title:doc.title||'Untitled',id:doc.id,cls:'doc-ev',kind:'doc',propId:p.id,srcId:PAGES_SRC}));
  });
  // Database rows with date columns — one sub-calendar per table
  DB.getTbls().forEach(tbl=>{
    const dcols=tbl.columns.filter(c=>c.type==='date'); if(!dcols.length) return;
    (tbl.rows||[]).forEach(row=>{
      dcols.forEach(col=>{ const v=row.cells[col.id]; if(v){
        const nm=row.cells[tbl.columns[0]?.id]||'Row';
        addEv(v,{title:nm,id:tbl.id,cls:'row-ev',kind:'row',tblId:tbl.id,rowId:row.id,colId:col.id,srcId:tbl.id});
      }});
    });
  });

  const tod=dateStr(new Date());
  const fd=new Date(y,m,1).getDay(),dim=new Date(y,m+1,0).getDate(),pdim=new Date(y,m,0).getDate();
  const prevM=m===0?11:m-1, prevY=m===0?y-1:y;
  const nextM=m===11?0:m+1, nextY=m===11?y+1:y;
  const limit=S.calShowDetails?2:3;
  // Events markup for one day — reused by in-month and adjacent-month (peek) cells.
  const cellEventsHtml=(ds)=>{
    const evList=evts[ds]||[];
    const shown=evList.slice(0,limit);
    const single=shown.length===1;
    const evH=shown.map(ev=>{
      const c=color[ev.srcId]||'var(--ac)';
      const tint=`background:${c}22;border-left:3px solid ${c};color:var(--tx)`;
      const dragAttr=`draggable="true" ondragstart="calEvDragStart(event,'${encodeURIComponent(JSON.stringify(ev))}')" ondragend="calDrag=null;clearCalDrop()"`;
      const openAct=ev.kind==='row'?`calOpenRow('${ev.tblId}','${ev.rowId}')`:`nav('editor','${ev.id}')`;
      if(!S.calShowDetails||ev.cls!=='doc-ev')
        return`<span class="cal-ev ${ev.cls}" style="${tint}" ${dragAttr} onclick="event.stopPropagation();${openAct}" title="${ev.title}">${ev.title}</span>`;
      const doc=DB.getDoc(ev.id);
      const cover=doc?.meta?.cover;
      const pos=doc?.meta?.coverPos!=null?doc.meta.coverPos:50;
      const coverHtml=cover?`<span class="cal-ev-cover ${single?'big':'med'}" style="${coverThumbBg(cover,pos)}"></span>`:'';
      const propChips=(doc?.props||[]).filter(p=>p.type==='select'&&p.value).slice(0,2).map(p=>{const o=(p.options||[]).find(x=>x.l===p.value);const cc=o?o.c:'var(--mu)';return`<span style="display:inline-block;padding:1px 5px;border-radius:10px;font-size:9px;background:${cc}22;color:${cc}">${p.value}</span>`}).join('');
      return`<span class="cal-ev ${ev.cls}${cover?' has-cover':''}" style="${tint}" ${dragAttr} onclick="event.stopPropagation();${openAct}" title="${ev.title}">${coverHtml}<span class="cal-ev-inner">${ev.title}</span>${propChips?`<span class="cal-ev-props">${propChips}</span>`:''}</span>`;
    }).join('');
    const more=(evList.length>limit)?`<span class="cal-ev" style="color:var(--mu)">+${evList.length-limit} more</span>`:'';
    return evH+more;
  };
  const cell=(ds,dnum,extraCls)=>`<div class="cal-cell${extraCls}" data-ds="${ds}" onclick="newDocOnDate('${ds}')" ondragover="calCellDragOver(event)" ondragleave="this.classList.remove('cal-drop')" ondrop="calCellDrop(event,'${ds}')"><div class="cal-num">${dnum}</div>${cellEventsHtml(ds)}</div>`;
  let html=WDAYS.map(d=>`<div class="cal-dh">${d}</div>`).join('');
  // Trailing days of the previous month (dimmed) — still show any events that peek in.
  for(let i=fd-1;i>=0;i--){ const dnum=pdim-i; html+=cell(`${prevY}-${pad(prevM+1)}-${pad(dnum)}`,dnum,' om'); }
  for(let d=1;d<=dim;d++){ const ds=`${y}-${pad(m+1)}-${pad(d)}`; html+=cell(ds,d,ds===tod?' tod':''); }
  const fill=(7-(fd+dim)%7)%7; for(let d=1;d<=fill;d++){ html+=cell(`${nextY}-${pad(nextM+1)}-${pad(d)}`,d,' om'); }
  const grid=document.getElementById('cal-grid');
  grid.className='cal-grid'+(S.calShowDetails?' details':'');
  grid.innerHTML=html;
  // Sync Details button state
  const detBtn=document.getElementById('cal-det-btn');
  if(detBtn){detBtn.style.color=S.calShowDetails?'var(--ac)':'';detBtn.style.borderColor=S.calShowDetails?'var(--ac)':'';}
}
function calShift(d){S.calM+=d;if(S.calM>11){S.calM=0;S.calY++}if(S.calM<0){S.calM=11;S.calY--}renderCal()}
function calToday(){S.calY=new Date().getFullYear();S.calM=new Date().getMonth();renderCal()}
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
    setTblCell(calDrag.tblId,calDrag.rowId,calDrag.colId,ds);
  }
  calDrag=null; renderCal();
}
function newDocOnDate(ds){
  const doc=blankDoc();
  doc.props.push({id:mkId('p'),name:'Deadline',type:'date',value:ds});
  DB.saveDoc(doc); nav('editor',doc.id);
}
