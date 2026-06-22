/* ═══════════════════════════════════════════════
   TABLES VIEW
═══════════════════════════════════════════════ */
function newTable(){const t=blankTbl();t.name='New Database';const cells={};t.columns.forEach(c=>cells[c.id]='');t.rows.push({id:mkId('r'),cells});DB.saveTbl(t);S.tblId=t.id;renderTblList();openTbl(t.id)}
function renderTblList(){
  const tbls=DB.getTbls();
  const isAll=S.tblId==='__all_docs__';
  const allItem=`<div class="tbl-sb-it${isAll?' active':''}" onclick="openTbl('__all_docs__')">
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6L9 1z"/>
      <path d="M9 1v5h5"/>
    </svg>All Documents</div>`;
  const customItems=tbls.map(t=>`
    <div class="tbl-sb-it${t.id===S.tblId?' active':''}" onclick="openTbl('${t.id}')">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5.5" x2="15" y2="5.5"/><line x1="6" y1="5.5" x2="6" y2="15"/>
      </svg>${t.name}
    </div>`).join('');
  document.getElementById('tbl-list').innerHTML=allItem+customItems;
  /* Auto-open All Documents on first visit */
  if(!S.tblId){ openTbl('__all_docs__'); }
}
function openTbl(id){
  S.tblId=id; S.tblSort=null; S.tblFilter='';
  renderTblList();
  if(id==='__all_docs__'){
    S.allDocsSort=S.allDocsSort||{col:'updatedAt',dir:'desc'};
    S.allDocsFilter=S.allDocsFilter||'';
    S.pageDbBlk=null;
    renderAllDocsTbl();
  }else{
    const tbl=DB.getTbl(id);
    if(tbl){
      // Render the SAME interactive database component used inline (table/board/calendar).
      S.pageDbBlk={id:'__pagedb__',type:'database',tableId:id,view:tbl._view||'table',groupCol:tbl._groupCol,dateCol:tbl._dateCol,calYM:tbl._calYM,calView:tbl._calView,calAnchorDS:tbl._calAnchorDS,filters:tbl._filters||[],sort:tbl._sort,hiddenCols:tbl._hiddenCols||[],groupCollapsed:tbl._groupCollapsed||{},colWidths:tbl._colWidths||{},tlDesc:tbl._tlDesc,colorRules:tbl._colorRules||[],hiddenGroups:tbl._hiddenGroups||{},hideGroupCount:!!tbl._hideGroupCount,groupPageSize:tbl._groupPageSize||0,groupShown:tbl._groupShown||{}};
    } else S.pageDbBlk=null;
    renderPageDb();
  }
  if(S.view==='databases') renderBreadcrumbs('databases',id);
  writeRoute('databases', id==='__all_docs__'?null:id); // deep-linkable: #/db/<tableId>
}
/* Open a database as its own full page (from an inline block's ↗ button or a link). */
function openDbPage(tableId){
  S.tblId=tableId;      // nav('databases') opens whatever S.tblId points at
  nav('databases');
}
function renderTbl(tbl){
  if(!tbl){document.getElementById('tbl-main').innerHTML=`<div class="tbl-empty"><svg width="40" height="40" viewBox="0 0 16 16" fill="none" stroke="var(--bd2)" stroke-width="1"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5.5" x2="15" y2="5.5"/><line x1="6" y1="5.5" x2="6" y2="15"/></svg>Select or create a table</div>`;return}
  // Sort & filter
  let rows=[...tbl.rows];
  if(S.tblSort){
    const{col,dir}=S.tblSort;
    rows.sort((a,b)=>{const va=a.cells[col]||'',vb=b.cells[col]||'';return dir==='asc'?va.localeCompare(vb):vb.localeCompare(va)});
  }
  if(S.tblFilter){const q=S.tblFilter.toLowerCase();rows=rows.filter(r=>Object.values(r.cells).some(v=>String(v||'').toLowerCase().includes(q)))}

  const thH=tbl.columns.map(c=>{const sc=S.tblSort?.col===c.id;return`<th class="${sc?S.tblSort.dir==='asc'?'sa':'sd':''}" onclick="sortTbl('${c.id}')">${c.name}</th>`}).join('')+`<th onclick="addCol('${tbl.id}')">+</th>`;
  const rowH=rows.map(row=>{
    const cells=tbl.columns.map(col=>mkTblCell(tbl,row,col)).join('');
    return`<tr>${cells}<td><button class="row-del" onclick="delRow('${tbl.id}','${row.id}')" title="Delete row">✕</button></td></tr>`;
  }).join('');

  document.getElementById('tbl-main').innerHTML=`
    <div class="tbl-bar">
      <input class="tbl-nm" value="${tbl.name}" placeholder="Table name" onblur="renameTbl('${tbl.id}',this.value)">
      <input class="tbl-fi" placeholder="Filter…" value="${S.tblFilter}" oninput="S.tblFilter=this.value;renderTbl(DB.getTbl('${tbl.id}'))">
      <button class="btn btn-o btn-sm" onclick="delTblConfirm('${tbl.id}')">Delete table</button>
    </div>
    <div class="tbl-sc">
      <table class="dbt"><thead><tr>${thH}</tr></thead><tbody>${rowH}</tbody></table>
      <div class="tbl-add" onclick="addRow('${tbl.id}')">+ New row</div>
    </div>`;
}
function mkTblCell(tbl,row,col){
  const v=row.cells[col.id]||'';
  if(col.type==='select'){
    const opt=(col.options||[]).find(o=>o.l===v);
    const chip=v?`<span class="chip" style="background:${opt?.c||'#888'}22;color:${opt?.c||'#888'}">${v}</span>`:`<span style="color:var(--mu)">&#8212;</span>`;
    return`<td onclick="openTblSelDD('${tbl.id}','${row.id}','${col.id}',this)" style="cursor:pointer">${chip}</td>`;
  }
  if(col.type==='date'){
    const disp=v?new Date(v+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'&#8212;';
    return`<td onclick="openTblDpDD('${tbl.id}','${row.id}','${col.id}',this)" style="cursor:pointer;color:${v?'var(--tx)':'var(--mu)'}">${disp}</td>`;
  }
    if(col.type==='document'){
    const d=v?DB.getDoc(v):null;
    return`<td><button class="doc-link${d?' has-doc':''}" onclick="openLinkedDoc('${tbl.id}','${row.id}','${col.id}')">${d?'↗ '+(d.title||'Untitled'):'+ Open doc'}</button></td>`;
  }
  if(col.type==='link'){
    return v?`<td onclick="editTblLink(event,'${tbl.id}','${row.id}','${col.id}')" style="cursor:pointer">${tblMentionHtml(v)}</td>`
           :`<td onclick="editTblLink(event,'${tbl.id}','${row.id}','${col.id}')" style="cursor:pointer;color:var(--mu)">+ Add link</td>`;
  }
  return`<td class="ed" contenteditable="true" onblur="setTblCell('${tbl.id}','${row.id}','${col.id}',this.innerText)">${v}</td>`;
}
function editTblLink(e,tblId,rowId,colId){
  e.stopPropagation();
  promptUrl(e.currentTarget.getBoundingClientRect(),(url)=>{ setTblCell(tblId,rowId,colId,url?normUrl(url):''); renderTbl(DB.getTbl(tblId)); });
}
function sortTbl(colId){
  if(S.tblSort&&S.tblSort.col===colId) S.tblSort={col:colId,dir:S.tblSort.dir==='asc'?'desc':'asc'};
  else S.tblSort={col:colId,dir:'asc'};
  renderTbl(DB.getTbl(S.tblId));
}
function addRow(tblId){
  const tbl=DB.getTbl(tblId); if(!tbl) return;
  const cells={}; tbl.columns.forEach(c=>{cells[c.id]=''});
  tbl.rows.push({id:mkId('r'),cells}); DB.saveTbl(tbl); renderTbl(tbl);
  setTimeout(()=>{const last=document.querySelector('.dbt tbody tr:last-child td.ed');if(last)last.focus()},50);
}
function delRow(tblId,rowId){const t=DB.getTbl(tblId);if(!t)return;t.rows=t.rows.filter(r=>r.id!==rowId);DB.saveTbl(t);renderTbl(t)}
function addCol(tblId){
  const n=prompt('Column name:'); if(!n) return;
  const tp=prompt('Type: text / select / date / number / link','text');
  const type=['text','select','date','number','document','link'].includes(tp)?tp:'text';
  const tbl=DB.getTbl(tblId); if(!tbl) return;
  const nc={id:mkId('c'),name:n.trim(),type,
    options:type==='select'?[{l:'Option 1',c:COLORS[0]},{l:'Option 2',c:COLORS[1]}]:undefined};
  tbl.columns.push(nc); tbl.rows.forEach(r=>{r.cells[nc.id]=''}); DB.saveTbl(tbl); renderTbl(tbl);
}
function setTblCell(tblId,rowId,colId,val){
  const t=DB.getTbl(tblId); const r=t&&t.rows.find(x=>x.id===rowId); if(!r) return;
  r.cells[colId]=val; DB.saveTbl(t);
}
function renameTbl(id,name){const t=DB.getTbl(id);if(t){t.name=name.trim()||'Untitled Table';DB.saveTbl(t);renderTblList()}}
function delTblConfirm(id){showConfirm('Delete this table? All rows will be lost.',()=>{DB.delTbl(id);S.tblId=null;renderTblList();renderTbl(null)},'Delete Table','Delete Table');}
function openTblSelDD(tblId,rowId,colId,td){
  const tbl=DB.getTbl(tblId); const col=tbl&&tbl.columns.find(c=>c.id===colId); if(!col) return;
  const curV=(tbl.rows.find(r=>r.id===rowId)||{cells:{}}).cells[colId]||'';
  const dd=document.getElementById('tbl-dd');
  const optH=(col.options||[]).map(o=>`
    <div onclick="setTblCell('${tblId}','${rowId}','${colId}','${o.l}');document.getElementById('tbl-dd').style.display='none';closeOvlSafe();renderTbl(DB.getTbl('${tblId}'))"
      style="display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;font-size:12px;color:var(--tx)"
      onmouseover="this.style.background='var(--sur2)'" onmouseout="this.style.background=''">
      <span style="width:8px;height:8px;border-radius:50%;background:${o.c};display:inline-block;flex-shrink:0"></span>
      ${o.l}${o.l===curV?' \u2713':''}
    </div>`).join('');
  const clearH=`<div onclick="setTblCell('${tblId}','${rowId}','${colId}','');document.getElementById('tbl-dd').style.display='none';closeOvlSafe();renderTbl(DB.getTbl('${tblId}'))"
    style="padding:6px 12px;cursor:pointer;font-size:11px;color:var(--mu);border-top:1px solid var(--bd)"
    onmouseover="this.style.background='var(--sur2)'" onmouseout="this.style.background=''">Clear</div>`;
  dd.innerHTML=optH+clearH;
  const r=td.getBoundingClientRect();
  dd.style.top=(r.bottom+2)+'px'; dd.style.left=r.left+'px'; dd.style.display='block'; openOvl();
}
function openTblDpDD(tblId,rowId,colId,td){
  S.dpTarget={type:'tbl',tblId,rowId,colId};
  const tbl=DB.getTbl(tblId);
  const v=tbl&&tbl.rows.find(r=>r.id===rowId)&&tbl.rows.find(r=>r.id===rowId).cells[colId]||'';
  const d=v?new Date(v+'T12:00:00'):new Date(); S.dpY=d.getFullYear(); S.dpM=d.getMonth();
  renderDp('Date'); posModal(document.getElementById('pm-dp'),td.getBoundingClientRect());
}

/* ===================================================
   CURSOR HELPERS
=================================================== */
