function idbSortChip(blk,tbl){
  if(!blk.sort||!blk.sort.colId) return '';
  const col=tbl.columns.find(c=>c.id===blk.sort.colId); if(!col) return '';
  return `<span class="idb-fchip">${escHtml(col.name)} <b>${blk.sort.dir==='desc'?'\u2193':'\u2191'}</b><button onclick="idbSetSort('${blk.id}','','')" title="Clear sort">\u2715</button></span>`;
}
/* Icon-only toolbar: filter chips + Group / Sort / Filter / Properties / Colors. */
function idbToolbar(blk,tbl,viewKind){
  const grp = viewKind==='calendar'?'':`<button class="idb-tb-ic${blk.groupCol?' on':''}" onclick="idbGroupMenu(event,'${blk.id}')" data-tip="Group">${IDB_ICON.group}</button>`;
  return `<div class="idb-toolbar"><span class="idb-tb-grow"></span>${idbFilterChips(blk,tbl)}${idbSortChip(blk,tbl)}${grp}
    <button class="idb-tb-ic${(blk.sort&&blk.sort.colId)?' on':''}" onclick="idbSortMenu(event,'${blk.id}')" data-tip="Sort">${IDB_ICON.sort}</button>
    <button class="idb-tb-ic${(blk.filters||[]).length?' on':''}" onclick="idbOpenFilter(event,'${blk.id}')" data-tip="Filter">${IDB_ICON.filter}</button>
    <button class="idb-tb-ic${(blk.hiddenCols||[]).length?' on':''}" onclick="idbPropsMenu(event,'${blk.id}')" data-tip="Properties">${IDB_ICON.props}</button>
    <button class="idb-tb-ic${(blk.colorRules&&blk.colorRules.length)?' on':''}" onclick="idbColorMenu(event,'${blk.id}')" data-tip="Colors">${IDB_ICON.color}</button>
  </div>`;
}
/* ── Conditional row colors ── */
function idbColorMenuHtml(blk,tbl){
  const sel=tbl.columns.filter(isSelectish);
  const rules=blk.colorRules||[];
  const rulesHtml=rules.map((r,i)=>{
    const col=tbl.columns.find(c=>c.id===r.colId);
    const colOpts=sel.map(c=>`<option value="${c.id}"${c.id===r.colId?' selected':''}>${escHtml(c.name)}</option>`).join('');
    const valOpts=col?(col.options||[]).map(o=>`<option value="${escAttr(o.l)}"${o.l===r.value?' selected':''}>${escHtml(o.l)}</option>`).join(''):'';
    return `<div class="idb-cr-row">
      <select class="idb-cr-sel" onchange="idbCrSetCol('${blk.id}',${i},this.value)">${colOpts}</select>
      <span class="idb-mu">=</span>
      <select class="idb-cr-sel" onchange="idbCrSetVal('${blk.id}',${i},this.value)">${valOpts}</select>
      <input type="color" class="idb-cr-color" value="${r.color||'#3B82F6'}" oninput="idbCrSetColor('${blk.id}',${i},this.value)" title="Highlight color">
      <button class="idb-cr-del" onclick="idbCrDel('${blk.id}',${i})" title="Remove">×</button>
    </div>`;
  }).join('');
  const footer=sel.length
    ? `<div class="idb-pop-it idb-pop-add" onclick="idbCrAdd('${blk.id}')">+ Add rule</div>`
    : `<div class="idb-dd-empty">Add a Select or Status property first.</div>`;
  return `<div class="idb-pop-lbl">Conditional colors</div>${rulesHtml||'<div class="idb-dd-empty">No rules yet</div>'}${footer}`;
}
function idbColorMenu(e,blockId){
  e.stopPropagation();
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  idbPopOpen(e.currentTarget.getBoundingClientRect(),idbColorMenuHtml(blk,tbl));
}
function idbCrRefresh(blockId){
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const p=document.getElementById('idb-pop');
  if(p&&p.classList.contains('open')) p.innerHTML=idbColorMenuHtml(blk,tbl);
}
function idbCrAdd(blockId){
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const sel=tbl.columns.filter(isSelectish); if(!sel.length)return;
  blk.colorRules=blk.colorRules||[];
  const col=sel[0]; const firstVal=col.options&&col.options[0]?col.options[0].l:'';
  blk.colorRules.push({colId:col.id,value:firstVal,color:'#3B82F6'});
  idbPersistView(blk); idbCrRefresh(blockId); reRenderBlock(blockId);
}
function idbCrDel(blockId,i){
  const blk=findBlock(blockId); if(!blk)return;
  (blk.colorRules||[]).splice(i,1);
  idbPersistView(blk); idbCrRefresh(blockId); reRenderBlock(blockId);
}
function idbCrSetCol(blockId,i,colId){
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!blk||!tbl)return;
  const r=(blk.colorRules||[])[i]; if(!r)return;
  const col=tbl.columns.find(c=>c.id===colId); if(!col)return;
  r.colId=colId; r.value=col.options&&col.options[0]?col.options[0].l:'';
  idbPersistView(blk); idbCrRefresh(blockId); reRenderBlock(blockId);
}
function idbCrSetVal(blockId,i,val){
  const blk=findBlock(blockId); if(!blk)return;
  const r=(blk.colorRules||[])[i]; if(!r)return;
  r.value=val; idbPersistView(blk); reRenderBlock(blockId);
}
function idbCrSetColor(blockId,i,color){
  const blk=findBlock(blockId); if(!blk)return;
  const r=(blk.colorRules||[])[i]; if(!r)return;
  r.color=color; idbPersistView(blk); reRenderBlock(blockId);
}
/* \u2500\u2500 Toolbar popovers (group / sort / properties) \u2500\u2500 */
function idbPopOpen(rect,html){const p=document.getElementById('idb-pop');p.innerHTML=html;idbDdPos(p,rect);p.classList.add('open');openOvl();}
function idbPopClose(){document.getElementById('idb-pop')?.classList.remove('open');closeOvlSafe();}
/* ── Group header ⋯ menu ── */
function idbGrpMenu(e,blockId,gk,colId,gKey){
  e.stopPropagation();
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const isHidden=!!(blk.hiddenGroups&&blk.hiddenGroups[gk]);
  const countLabel=blk.hideGroupCount?'Show count':'Hide count';
  const delBtn=gKey?`<div class="idb-pop-it idb-pop-danger" onclick="idbPopClose();idbDeleteGroup('${blockId}','${colId}','${escAttr(gKey)}')">Delete group</div>`:'';
  idbPopOpen(e.currentTarget.getBoundingClientRect(),
    `<div class="idb-pop-lbl">Group options</div>
     <div class="idb-pop-it" onclick="idbHideGroup('${blockId}','${escAttr(gk)}');idbPopClose()">${isHidden?'Show group':'Hide group'}</div>
     <div class="idb-pop-it" onclick="idbToggleGrpCount('${blockId}');idbPopClose()">${countLabel}</div>
     ${delBtn}`);
}
function idbHideGroup(blockId,gk){
  const blk=findBlock(blockId); if(!blk)return;
  blk.hiddenGroups=blk.hiddenGroups||{};
  if(blk.hiddenGroups[gk]) delete blk.hiddenGroups[gk]; else blk.hiddenGroups[gk]=true;
  idbPersistView(blk); reRenderBlock(blockId);
}
function idbToggleGrpCount(blockId){
  const blk=findBlock(blockId); if(!blk)return;
  blk.hideGroupCount=!blk.hideGroupCount;
  idbPersistView(blk); reRenderBlock(blockId);
}
function idbShowAllGroups(blockId){
  const blk=findBlock(blockId); if(!blk)return;
  blk.hiddenGroups={}; idbPersistView(blk); reRenderBlock(blockId);
}
function idbDeleteGroup(blockId,colId,gKey){
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const col=tbl.columns.find(c=>c.id===colId); if(!col)return;
  const affected=tbl.rows.filter(r=>(r.cells[colId]||'')===gKey).length;
  showConfirm(`Delete group "${gKey}"? Removes this option and clears it from ${affected} entr${affected===1?'y':'ies'}.`,()=>{
    col.options=(col.options||[]).filter(o=>o.l!==gKey);
    tbl.rows.forEach(r=>{if((r.cells[colId]||'')===gKey)r.cells[colId]='';});
    DB.saveTbl(tbl); idbSync(blockId,tbl.id);
  },'Delete','Cancel');
}
function idbGroupMenu(e,blockId){
  e.stopPropagation(); const blk=findBlock(blockId),tbl=idbTbl(blk); const sel=tbl.columns.filter(isSelectish);
  const html=`<div class="idb-pop-lbl">Group by</div>
    <div class="idb-pop-it${!blk.groupCol?' on':''}" onclick="idbSetGroup('${blockId}','');idbPopClose()">None</div>
    ${sel.length?sel.map(c=>`<div class="idb-pop-it${blk.groupCol===c.id?' on':''}" onclick="idbSetGroup('${blockId}','${c.id}');idbPopClose()"><span class="idb-pop-ico">${c.type==='status'?'\u25d0':'\u25c9'}</span>${escHtml(c.name)}</div>`).join(''):'<div class="idb-dd-empty">Add a Select or Status property first.</div>'}`;
  idbPopOpen(e.currentTarget.getBoundingClientRect(),html);
}
function idbSortMenuHtml(blk,tbl){
  const cur=blk.sort||{};
  return `<div class="idb-pop-lbl">Sort</div>
    <div class="idb-pop-it${!cur.colId?' on':''}" onclick="idbSetSort('${blk.id}','','');idbPopClose()">None</div>
    ${tbl.columns.map(c=>{const a=cur.colId===c.id;return `<div class="idb-pop-it${a?' on':''}" onclick="idbSortPick('${blk.id}','${c.id}')">${escHtml(c.name)}<span class="idb-pop-arrow">${a?(cur.dir==='desc'?'\u2193':'\u2191'):''}</span></div>`;}).join('')}`;
}
function idbSortMenu(e,blockId){e.stopPropagation();const blk=findBlock(blockId),tbl=idbTbl(blk);idbPopOpen(e.currentTarget.getBoundingClientRect(),idbSortMenuHtml(blk,tbl));}
function idbSetSort(blockId,colId,dir){const blk=findBlock(blockId);if(!blk)return;if(colId)blk.sort={colId,dir};else delete blk.sort;idbPersistView(blk);reRenderBlock(blockId);}
function idbSortPick(blockId,colId){
  const blk=findBlock(blockId);const cur=blk.sort||{};
  if(cur.colId!==colId)blk.sort={colId,dir:'asc'};
  else if(cur.dir==='asc')blk.sort={colId,dir:'desc'};
  else delete blk.sort;
  idbPersistView(blk);reRenderBlock(blockId);
  const p=document.getElementById('idb-pop');if(p&&p.classList.contains('open'))p.innerHTML=idbSortMenuHtml(findBlock(blockId),idbTbl(blk));
}
function idbPropsMenuHtml(blk,tbl){
  const hidden=blk.hiddenCols||[];
  const titleId=idbTitleColId(tbl);
  return `<div class="idb-pop-lbl">Properties</div>`+tbl.columns.map((c,i)=>{
    const isTitle=c.id===titleId; const vis=!hidden.includes(c.id);
    const eye=isTitle?'':`<button class="idb-prop-eye${vis?'':' off'}" onclick="event.stopPropagation();idbToggleColVis('${blk.id}','${c.id}')" title="${vis?'Hide property':'Show property'}">${vis?IDB_EYE:IDB_EYE_OFF}</button>`;
    return `<div class="idb-pop-it idb-prop-it${vis?'':' dimmed'}" draggable="true" ondragstart="idbPropDragStart(event,${i})" ondragover="idbPropDragOver(event)" ondrop="idbPropDrop(event,'${blk.id}',${i})" ondragend="idbPropDragEnd()">
      <span class="idb-prop-grip">\u283f</span>
      <span class="idb-prop-nm">${idbTypeIcon(c.type)}${escHtml(c.name)}${isTitle?' <span class="idb-mu">\u00b7 title</span>':''}</span>${eye}</div>`;
  }).join('')+`<div class="idb-pop-it idb-pop-add" onclick="idbPopClose();idbAddColAt('${blk.id}')">\uff0b New property</div>`;
}
function idbPropsMenu(e,blockId){e.stopPropagation();const blk=findBlock(blockId),tbl=idbTbl(blk);idbPopOpen(e.currentTarget.getBoundingClientRect(),idbPropsMenuHtml(blk,tbl));}
function idbPropsRefresh(blockId){const blk=findBlock(blockId),tbl=idbTbl(blk);const p=document.getElementById('idb-pop');if(p&&p.classList.contains('open'))p.innerHTML=idbPropsMenuHtml(blk,tbl);}
function idbToggleColVis(blockId,colId){
  const blk=findBlock(blockId);if(!blk)return;blk.hiddenCols=blk.hiddenCols||[];
  const i=blk.hiddenCols.indexOf(colId);
  if(i>=0)blk.hiddenCols.splice(i,1);else blk.hiddenCols.push(colId);
  idbPersistView(blk);reRenderBlock(blockId);idbPropsRefresh(blockId);
}
function idbAddColAt(blockId){const th=document.querySelector(`.bk-row[data-id="${blockId}"] .idb-addcol`);idbAddCol({currentTarget:th||document.body,stopPropagation(){}},blockId);}
/* Reorder a table column (title stays first). Table-level \u2192 syncs all views. */
function idbMoveColumn(tbl,from,to){ if(from===to)return; if(!tbl.titleCol)tbl.titleCol=tbl.columns[0]&&tbl.columns[0].id; to=Math.max(0,Math.min(to,tbl.columns.length-1)); const [c]=tbl.columns.splice(from,1); tbl.columns.splice(to,0,c); }
let _idbColDrag=null;
function idbColDragStart(e,blockId,idx){_idbColDrag={blockId,idx};try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','c');}catch(_){}e.stopPropagation();}
function idbColDragOver(e){if(!_idbColDrag)return;e.preventDefault();e.stopPropagation();const th=e.currentTarget;th.classList.add('idb-col-drop');}
function idbColDragLeaveTh(e){e.currentTarget.classList.remove('idb-col-drop');}
function idbColDrop(e,blockId,idx){e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove('idb-col-drop');if(!_idbColDrag)return;const blk=findBlock(blockId),tbl=idbTbl(blk);idbMoveColumn(tbl,_idbColDrag.idx,idx);_idbColDrag=null;DB.saveTbl(tbl);idbSync(blockId,tbl.id);}
function idbColDragEnd(){_idbColDrag=null;document.querySelectorAll('.idb-col-drop').forEach(t=>t.classList.remove('idb-col-drop'));}
/* Resize a column by dragging the handle on its right edge. On first resize we
   capture all current widths so the table keeps its look, then lock to fixed. */
let _idbColRz=null;
function idbColResizeStart(e,blockId,colId){
  e.preventDefault(); e.stopPropagation();
  const blk=findBlock(blockId); if(!blk)return;
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  if(!blk.colWidths||!Object.keys(blk.colWidths).length){
    blk.colWidths={};
    document.querySelectorAll(`.bk-row[data-id="${blockId}"] .idb-tbl th[data-cid]`).forEach(th=>{ blk.colWidths[th.dataset.cid]=Math.round(th.getBoundingClientRect().width/z); });
  }
  _idbColRz={blk,blockId,colId,startX:e.clientX/z,startW:blk.colWidths[colId]||120,z};
  document.addEventListener('mousemove',idbColResizeMove);
  document.addEventListener('mouseup',idbColResizeEnd);
  document.body.classList.add('idb-col-resizing');
}
function idbColResizeMove(e){
  if(!_idbColRz)return;
  const {blockId,colId,startX,startW,z}=_idbColRz;
  const w=Math.max(48,Math.round(startW+(e.clientX/z-startX)));
  const prevW=_idbColRz.blk.colWidths[colId]||startW;
  _idbColRz.blk.colWidths[colId]=w;
  const col=document.querySelector(`.bk-row[data-id="${blockId}"] .idb-tbl colgroup col[data-cid="${colId}"]`);
  const tbl2=document.querySelector(`.bk-row[data-id="${blockId}"] .idb-tbl`);
  if(tbl2&&!tbl2.classList.contains('fixed')) tbl2.classList.add('fixed');
  if(col) col.style.width=w+'px';
  // grow/shrink the overall table width by the same delta so other columns keep their
  // widths and the table scrolls instead of squeezing them.
  if(tbl2){ const base=parseFloat(tbl2.style.width)|| (24+30+(_idbColRz.blk.colWidths?Object.values(_idbColRz.blk.colWidths).reduce((a,b)=>a+b,0):0)); tbl2.style.width=(base+(w-prevW))+'px'; }
}
function idbColResizeEnd(){
  document.removeEventListener('mousemove',idbColResizeMove);
  document.removeEventListener('mouseup',idbColResizeEnd);
  document.body.classList.remove('idb-col-resizing');
  const ctx=_idbColRz; _idbColRz=null;
  if(ctx){ idbPersistView(ctx.blk); reRenderBlock(ctx.blockId); } // width is per-view, don't touch siblings
}
/* Reorder rows by dragging the row handle. */
let _idbRowDrag=null;
function idbRowDragStart(e,blockId,rowId){_idbRowDrag={blockId,rowId};try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','r');}catch(_){}e.stopPropagation();}
function idbRowDragOver(e){if(!_idbRowDrag)return;e.preventDefault();e.stopPropagation();const tr=e.currentTarget;tr.classList.add('idb-row-drop');}
function idbRowDragLeave(e){e.currentTarget.classList.remove('idb-row-drop');}
function idbRowDrop(e,blockId,rowId){
  e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove('idb-row-drop');
  if(!_idbRowDrag)return;const blk=findBlock(blockId),tbl=idbTbl(blk);
  const srcId=_idbRowDrag.rowId; _idbRowDrag=null;
  const from=tbl.rows.findIndex(r=>r.id===srcId), to=tbl.rows.findIndex(r=>r.id===rowId);
  if(from<0||to<0||from===to)return;
  const srcRow=tbl.rows[from], tgtRow=tbl.rows[to];
  // When grouped, dropping onto a row in a DIFFERENT group offers to change this row's
  // group value to match the destination (so the move "sticks" instead of snapping back).
  const gcol=blk.groupCol&&tbl.columns.find(c=>c.id===blk.groupCol&&isSelectish(c));
  if(gcol){
    const sv=srcRow.cells[gcol.id]||'', tv=tgtRow.cells[gcol.id]||'';
    if(sv!==tv){
      const tvLabel=tv||('No '+gcol.name);
      showConfirm(`Move to “${tvLabel}”? This sets ${gcol.name} to “${tvLabel}”.`,()=>{
        const sr=tbl.rows.find(r=>r.id===srcId); if(!sr)return;
        sr.cells[gcol.id]=tv;
        const f2=tbl.rows.findIndex(r=>r.id===srcId); tbl.rows.splice(f2,1);
        const t2=tbl.rows.findIndex(r=>r.id===rowId); tbl.rows.splice(t2+1,0,sr);
        DB.saveTbl(tbl); idbSync(blockId,tbl.id);
      },'Move','Change group');
      return;
    }
  }
  const [r]=tbl.rows.splice(from,1); const t2=tbl.rows.findIndex(rr=>rr.id===rowId); tbl.rows.splice(t2,0,r);
  DB.saveTbl(tbl); idbSync(blockId,tbl.id);
}
function idbRowDragEnd(){_idbRowDrag=null;document.querySelectorAll('.idb-row-drop').forEach(t=>t.classList.remove('idb-row-drop'));}
/* Properties-menu drag reorder (mirrors column reorder). */
let _idbPropDrag=null;
function idbPropDragStart(e,idx){_idbPropDrag=idx;try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','p');}catch(_){}e.stopPropagation();}
function idbPropDragOver(e){if(_idbPropDrag==null)return;e.preventDefault();e.stopPropagation();}
function idbPropDrop(e,blockId,idx){e.preventDefault();e.stopPropagation();if(_idbPropDrag==null)return;const blk=findBlock(blockId),tbl=idbTbl(blk);idbMoveColumn(tbl,_idbPropDrag,idx);_idbPropDrag=null;DB.saveTbl(tbl);idbSync(blockId,tbl.id);idbPropsRefresh(blockId);}
function idbPropDragEnd(){_idbPropDrag=null;}
