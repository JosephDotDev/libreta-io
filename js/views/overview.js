/* ═══════════════════════════════════════════════
   OVERVIEW STATE
═══════════════════════════════════════════════ */
const OV={
  calY:new Date().getFullYear(), calM:new Date().getMonth(),
  groupBy:'', filter:'', openDocId:null, collapsed:{},
  panelWidth:null, panelCollapsed:false, panelWidthBeforeCollapse:null,
};

/* ═══════════════════════════════════════════════
   OVERVIEW — main render
═══════════════════════════════════════════════ */
function renderOverview(){
  renderOvCalendar();
  renderOvGroupByOptions();
  renderOvRows();
}

/* ── compact calendar ── */
function renderOvCalendar(){
  const y=OV.calY,m=OV.calM;
  document.getElementById('ov-cal-label').textContent=`${MONTHS[m]} ${y}`;
  const evts={};
  const addEv=(ds,title,id,cls)=>{if(!evts[ds])evts[ds]=[];evts[ds].push({title,id,cls})};
  DB.getDocs().forEach(doc=>{
    (doc.props||[]).filter(p=>p.type==='date'&&p.value).forEach(p=>addEv(p.value,doc.title||'Untitled',doc.id,'doc-ev'));
  });
  DB.getTbls().forEach(tbl=>{
    const dcols=tbl.columns.filter(c=>c.type==='date');
    (tbl.rows||[]).forEach(row=>{dcols.forEach(col=>{const v=row.cells[col.id];if(v)addEv(v,row.cells[tbl.columns[0]?.id]||'Row',tbl.id,'row-ev')})});
  });
  const tod=dateStr(new Date());
  const fd=new Date(y,m,1).getDay(),dim=new Date(y,m+1,0).getDate(),pdim=new Date(y,m,0).getDate();
  let html=WDAYS.map(d=>`<div class="cal-dh">${d}</div>`).join('');
  for(let i=fd-1;i>=0;i--)html+=`<div class="cal-cell om"><div class="cal-num">${pdim-i}</div></div>`;
  for(let d=1;d<=dim;d++){
    const ds=`${y}-${pad(m+1)}-${pad(d)}`;const isT=ds===tod;
    const evH=(evts[ds]||[]).slice(0,2).map(ev=>`<span class="cal-ev ${ev.cls}" onclick="event.stopPropagation();openOvPanel('${ev.id}')" title="${ev.title}">${ev.title}</span>`).join('');
    const more=(evts[ds]?.length>2)?`<span class="cal-ev" style="color:var(--mu)">+${evts[ds].length-2}</span>`:'';
    html+=`<div class="cal-cell${isT?' tod':''}" onclick="newDocOnDate('${ds}')"><div class="cal-num">${d}</div>${evH}${more}</div>`;
  }
  const fill=(7-(fd+dim)%7)%7; for(let d=1;d<=fill;d++)html+=`<div class="cal-cell om"><div class="cal-num">${d}</div></div>`;
  document.getElementById('ov-cal-grid').innerHTML=html;
}
function ovCalShift(d){OV.calM+=d;if(OV.calM>11){OV.calM=0;OV.calY++}if(OV.calM<0){OV.calM=11;OV.calY--}renderOvCalendar()}
function ovCalToday(){OV.calY=new Date().getFullYear();OV.calM=new Date().getMonth();renderOvCalendar()}

/* ── group-by dropdown ── */
function renderOvGroupByOptions(){
  const propNames=new Set();
  DB.getDocs().forEach(d=>(d.props||[]).filter(p=>p.type==='select'||p.type==='checkbox').forEach(p=>propNames.add(p.name)));
  const sel=document.getElementById('ov-groupby'); if(!sel) return;
  sel.innerHTML='<option value="">No grouping</option>'+[...propNames].map(n=>`<option value="${n}"${OV.groupBy===n?' selected':''}>${n}</option>`).join('');
}

/* ── document rows (flat or grouped) ── */
function renderOvRows(){
  renderFilterUI('overview','ov-filter-btn','ov-filter-chips');
  const docs=DB.getDocs().filter(d=>docMatchesFilters(d,FILT.overview));
  const q=OV.filter.toLowerCase();
  const filtered=q?docs.filter(d=>(d.title||'').toLowerCase().includes(q)||(d.props||[]).some(p=>String(p.value||'').toLowerCase().includes(q))):docs;
  const el=document.getElementById('ov-rows'); if(!el) return;
  if(!OV.groupBy){
    el.innerHTML=filtered.map(d=>ovDocRowHtml(d)).join('')||`<div style="padding:32px;text-align:center;color:var(--mu)">No documents found</div>`;
    return;
  }
  const groups={};
  filtered.forEach(doc=>{
    const prop=(doc.props||[]).find(p=>p.name===OV.groupBy);
    const val=prop?.value||'__none__';
    if(!groups[val])groups[val]=[];
    groups[val].push(doc);
  });
  const keys=Object.keys(groups).sort((a,b)=>a==='__none__'?1:b==='__none__'?-1:a.localeCompare(b));
  el.innerHTML=keys.map(key=>{
    const docs=groups[key];
    const label=key==='__none__'?`No ${OV.groupBy}`:key;
    const collapsed=OV.collapsed[key];
    // Get color for select group header
    let dotHtml='';
    if(key!=='__none__'){
      const sampleProp=docs[0]?.props?.find(p=>p.name===OV.groupBy&&p.type==='select');
      const opt=sampleProp?.options?.find(o=>o.l===key);
      if(opt) dotHtml=`<span style="width:8px;height:8px;border-radius:50%;background:${opt.c};display:inline-block;flex-shrink:0"></span>`;
    }
    return`<div class="ov-group">
      <div class="ov-group-hdr${collapsed?' collapsed':''}" onclick="ovToggleGroup('${key.replace(/'/g,"\\'")}')">
        <span class="ov-chevron">&#9660;</span>${dotHtml} ${label}<span class="ov-grp-cnt">${docs.length}</span>
      </div>
      ${collapsed?'':`<div>${docs.map(d=>ovDocRowHtml(d)).join('')}</div>`}
    </div>`;
  }).join('');
}

function ovDocRowHtml(doc){
  const wc=doc.meta?.wordCount||0;
  const chips=quickChips(doc,true);
  const isActive=doc.id===OV.openDocId;
  return`<div class="ov-doc-row${isActive?' active':''}"
      onclick="openOvPanel('${doc.id}')"
      onmouseleave="this.style.transform=''">
    <div class="ov-doc-info" style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:8px">
        <div class="ov-doc-title" style="flex:1;min-width:0">${doc.meta?.icon?iconHtml(doc.meta.icon,'14px')+' ':''}<span>${doc.title||'<em style="opacity:.4;font-weight:300">Untitled</em>'}</span></div>
        <button class="ov-open-btn" onclick="event.stopPropagation();nav('editor','${doc.id}')" title="Open full page">Open &#x2197;</button>
      </div>
      ${chips?`<div class="ov-doc-chips">${chips}</div>`:''}
    </div>
    <div class="ov-doc-meta">${wc>0?wc.toLocaleString()+' words<br>':''}<span>${fmtDate(doc.updatedAt)}</span></div>
  </div>`;
}

function ovToggleGroup(key){OV.collapsed[key]=!OV.collapsed[key];renderOvRows()}
function ovSetGroup(name){OV.groupBy=name;renderOvRows()}
function ovSetFilter(val){OV.filter=val;renderOvRows()}

/* ── side panel ── */
function openOvPanel(docId){
  if(OV.openDocId&&OV.openDocId!==docId){clearTimeout(S.saveTimer);flushSave()}
  OV.openDocId=docId;
  const doc=DB.getDoc(docId); if(!doc) return;
  S.docId=docId;
  S.blocks=doc.blocks&&doc.blocks.length?doc.blocks:[mkBlock('paragraph')];
  S.props=doc.props||[];
  document.getElementById('ov-panel-title').value=doc.title||'';
  renderBlocks('ov-panel-blocks');
  renderOvPanelProps();
  const panel=document.getElementById('ov-panel');
  panel.classList.add('open');
  panel.classList.remove('collapsed');
  if(OV.panelWidth) panel.style.width=OV.panelWidth+'px';
  OV.panelCollapsed=false;
  const cb=document.getElementById('ov-collapse-btn');
  if(cb) cb.textContent='‹';
  initHistory();
  renderOvRows();
  setTimeout(()=>{const el=document.querySelector('#ov-panel-blocks .bk');if(el)el.focus()},80);
}
function closeOvPanel(){
  clearTimeout(S.saveTimer); flushSave();
  const panel=document.getElementById('ov-panel');
  if(!OV.panelCollapsed&&panel.offsetWidth>40) OV.panelWidth=panel.offsetWidth;
  panel.style.width='';
  panel.classList.remove('open','collapsed');
  OV.openDocId=null; S.docId=null; OV.panelCollapsed=false;
  renderOvRows();
}
function renderOvPanelProps(){ renderProps(); }
function ovPanelTitleInput(){sched()}

/* ── OVERVIEW PANEL RESIZE & COLLAPSE ── */
let _ovRhDrag=false, _ovRhStartX=0, _ovRhStartW=0;
function ovRhDown(e){
  e.preventDefault();
  if(OV.panelCollapsed){ovToggleCollapse();return;}
  _ovRhDrag=true; _ovRhStartX=e.clientX;
  const panel=document.getElementById('ov-panel');
  _ovRhStartW=panel.offsetWidth;
  panel.style.transition='none';
  document.getElementById('ov-rh').classList.add('ov-dragging');
  document.addEventListener('mousemove',ovRhMove);
  document.addEventListener('mouseup',ovRhUp);
}
function ovRhMove(e){
  if(!_ovRhDrag) return;
  const panel=document.getElementById('ov-panel');
  const newW=Math.max(240,Math.min(Math.round(window.innerWidth*0.6),_ovRhStartW+(_ovRhStartX-e.clientX)));
  panel.style.width=newW+'px';
  OV.panelWidth=newW;
}
function ovRhUp(){
  _ovRhDrag=false;
  const panel=document.getElementById('ov-panel');
  panel.style.transition='';
  document.getElementById('ov-rh')?.classList.remove('ov-dragging');
  document.removeEventListener('mousemove',ovRhMove);
  document.removeEventListener('mouseup',ovRhUp);
}
function ovToggleCollapse(){
  const panel=document.getElementById('ov-panel');
  const cb=document.getElementById('ov-collapse-btn');
  OV.panelCollapsed=!OV.panelCollapsed;
  if(OV.panelCollapsed){
    OV.panelWidthBeforeCollapse=panel.offsetWidth;
    panel.style.width='36px';
    panel.classList.add('collapsed');
    if(cb) cb.textContent='›';
  } else {
    const w=OV.panelWidthBeforeCollapse||OV.panelWidth||null;
    panel.style.width=w?w+'px':'';
    panel.classList.remove('collapsed');
    if(cb) cb.textContent='‹';
  }
}

/* ═══════════════════════════════════════════════
   COLUMN CHOOSER + DRAG  (All Docs table)
═══════════════════════════════════════════════ */
const DEFAULT_DOC_COLS=[
  {id:'title',     name:'Title',       vis:true,  fixed:true},
  {id:'wordCount', name:'Words',       vis:true},
  {id:'blockCount',name:'Blocks',      vis:false},
  {id:'updatedAt', name:'Last edited', vis:true},
  {id:'createdAt', name:'Created',     vis:false},
];
function getDocCols(){
  try{const s=localStorage.getItem('folio_doc_cols');return s?JSON.parse(s):DEFAULT_DOC_COLS.map(c=>({...c}))}
  catch{return DEFAULT_DOC_COLS.map(c=>({...c}))}
}
function saveDocCols(cols){localStorage.setItem('folio_doc_cols',JSON.stringify(cols))}

function showColChooser(e){
  e.stopPropagation();
  const cols=getDocCols();
  const dd=document.getElementById('col-chooser');
  dd.innerHTML=cols.map(c=>`
    <label class="col-ch-row${c.fixed?' fixed-col':''}">
      <input type="checkbox" class="col-ch-cb" ${c.vis?'checked':''} ${c.fixed?'disabled':''}
        onchange="toggleDocCol('${c.id}',this.checked)">
      ${c.name}
    </label>`).join('');
  const rect=e.currentTarget.getBoundingClientRect();
  dd.style.top=(rect.bottom+4)+'px';
  dd.style.left=Math.min(rect.right-200,window.innerWidth-210)+'px';
  dd.classList.add('open'); openOvl();
}
function toggleDocCol(colId,visible){
  const cols=getDocCols(); const col=cols.find(c=>c.id===colId);
  if(col&&!col.fixed)col.vis=visible; saveDocCols(cols); renderAllDocsTbl();
}

let _colDragIdx=null;
function colDragStart(e,idx){
  _colDragIdx=idx;
  e.dataTransfer.effectAllowed='move';
  const th=e.currentTarget;          /* capture ref now — currentTarget is null in setTimeout */
  setTimeout(()=>{ if(th) th.style.opacity='.5'; },0);
}
function colDragOver(e,idx){e.preventDefault();document.querySelectorAll('.dbt th').forEach((t,i)=>t.classList.toggle('col-drag-over',i===idx&&i!==_colDragIdx))}
function colDrop(e,targetIdx){
  e.preventDefault();
  document.querySelectorAll('.dbt th').forEach(t=>{
    t.classList.remove('col-drag-over'); t.style.opacity='';
  });
  if(_colDragIdx===null||_colDragIdx===targetIdx)return;
  const vis=getDocCols().filter(c=>c.vis);
  const [moved]=vis.splice(_colDragIdx,1); vis.splice(targetIdx,0,moved);
  const hidden=getDocCols().filter(c=>!c.vis);
  saveDocCols([...vis,...hidden]); _colDragIdx=null; renderAllDocsTbl();
}


