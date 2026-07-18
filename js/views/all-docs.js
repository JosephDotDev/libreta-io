/* ═══════════════════════════════════════════════
   ALL DOCUMENTS VIRTUAL TABLE
═══════════════════════════════════════════════ */
function renderAllDocsTbl(){
  renderSidebarLists();
  const main=document.getElementById('tbl-main'); if(!main) return;
  const docs=DB.getDocs().filter(d=>docMatchesFilters(d,FILT.alldocs));
  const q=(S.allDocsFilter||'').toLowerCase();
  let rows=q?docs.filter(d=>(d.title||'').toLowerCase().includes(q)||
    (d.props||[]).some(p=>String(p.value||'').toLowerCase().includes(q))):[...docs];
  const {col='updatedAt',dir='desc'}=S.allDocsSort||{};
  rows.sort((a,b)=>{
    let va,vb;
    if(col==='title'){va=a.title||'';vb=b.title||''}
    else if(col==='wordCount'){va=a.meta?.wordCount||0;vb=b.meta?.wordCount||0}
    else if(col==='blockCount'){va=a.meta?.blockCount||0;vb=b.meta?.blockCount||0}
    else if(col==='createdAt'){va=a.createdAt||'';vb=b.createdAt||''}
    else{va=a.updatedAt||'';vb=b.updatedAt||''}
    const cmp=typeof va==='number'?va-vb:va.localeCompare(vb);
    return dir==='asc'?cmp:-cmp;
  });
  const activeCols=getDocCols().filter(c=>c.vis);
  const thH=activeCols.map((c,i)=>{
    const sc=col===c.id;
    const drag=!c.fixed?`draggable="true" ondragstart="colDragStart(event,${i})" ondragover="colDragOver(event,${i})" ondrop="colDrop(event,${i})" ondragleave="this.classList.remove('col-drag-over')" ondragend="document.querySelectorAll('.dbt th').forEach(t=>t.classList.remove('col-drag-over'))"`:'' ;
    return`<th class="${sc?dir==='asc'?'sa':'sd':''}" ${drag} onclick="sortAllDocs('${c.id}')" style="cursor:pointer">${c.name}</th>`;
  }).join('')+`<th style="width:80px;min-width:80px;cursor:default"><button class="btn btn-o btn-sm" onclick="showColChooser(event)" style="font-size:11px">Columns &#9660;</button></th>`;
  const rowH=rows.map(d=>{
    const wc=d.meta?.wordCount||0;
    const bc=d.meta?.blockCount||0;
    const chips=quickChips(d,true);
    const cells=activeCols.map(c=>{
      if(c.id==='title')return`<td><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0"><div style="font-weight:500;color:var(--tx)">${d.meta?.icon?iconHtml(d.meta.icon,'14px')+' ':''}${escHtml(d.title)||'<em style="opacity:.35;font-weight:300">Untitled</em>'}</div>${chips?`<div style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap">${chips}</div>`:''}</div><button class="ov-open-btn" onclick="event.stopPropagation();nav('editor','${d.id}')" title="Open">Open &#x2197;</button></div></td>`;
      if(c.id==='wordCount')return`<td>${wc>0?wc.toLocaleString():'<span style="color:var(--mu)">&#8212;</span>'}</td>`;
      if(c.id==='blockCount')return`<td>${bc||'<span style="color:var(--mu)">&#8212;</span>'}</td>`;
      if(c.id==='updatedAt')return`<td>${fmtDate(d.updatedAt)}</td>`;
      if(c.id==='createdAt')return`<td>${fmtDate(d.createdAt)}</td>`;
      return'<td>&#8212;</td>';
    }).join('');
    return`<tr onclick="nav('editor','${d.id}')" style="cursor:pointer" onmouseleave="this.style.transform=''">${cells}<td><button class="row-del" onclick="event.stopPropagation();showConfirm('Move this document to Trash?',()=>{trashDoc('${d.id}');renderAllDocsTbl()},'Delete','Move to Trash')" title="Delete">&#10005;</button></td></tr>`;
  }).join('')||`<tr><td colspan="${activeCols.length+1}" style="text-align:center;padding:32px;color:var(--mu)">No documents yet</td></tr>`;
  main.innerHTML=`
    <div class="tbl-bar">
      <span class="tbl-nm" style="pointer-events:none">All Documents</span>
      <button class="btn btn-o btn-sm" id="alldocs-filter-btn" onclick="openFilterPop(event,'alldocs')">&#9783; Filter</button>
      <input class="tbl-fi" placeholder="Search text&#8230;" value="${(S.allDocsFilter||'').replace(/"/g,'&quot;')}" oninput="S.allDocsFilter=this.value;renderAllDocsTbl()">
      <button class="btn btn-a btn-sm" onclick="newDoc()">+ New Document</button>
    </div>
    <div id="alldocs-filter-chips" class="filter-chips" style="padding:8px 20px 0"></div>
    <div class="tbl-sc"><table class="dbt"><thead><tr>${thH}</tr></thead><tbody>${rowH}</tbody></table></div>`;
  renderFilterUI('alldocs','alldocs-filter-btn','alldocs-filter-chips');
}

function sortAllDocs(col){
  const cur=S.allDocsSort||{col:'updatedAt',dir:'desc'};
  S.allDocsSort=cur.col===col?{col,dir:cur.dir==='asc'?'desc':'asc'}:{col,dir:'asc'};
  renderAllDocsTbl();
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
