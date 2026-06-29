function idbTableView(blk,tbl){
  const cols=idbVisibleCols(blk,tbl);
  const rows=idbViewRows(blk,tbl);
  const span=cols.length+2; // leading handle + columns + trailing add-col
  const titleId=idbTitleColId(tbl);
  const widths=blk.colWidths||{}; const useFixed=Object.keys(widths).length>0;
  // Once any column has a set width, give EVERY column a width (defaulting newly-added
  // ones) and size the table to their sum so columns keep their width and the table
  // scrolls horizontally (via .idb-sc) instead of squishing a column into its neighbor.
  const DEFW=c=>c.id===titleId?200:150;
  const colW=c=>widths[c.id]||DEFW(c);
  const colgroup=`<colgroup><col class="idb-cg-handle">${cols.map(c=>`<col data-cid="${c.id}"${useFixed?` style="width:${colW(c)}px"`:''}>`).join('')}<col class="idb-cg-add"></colgroup>`;
  const tblW=useFixed?(24+cols.reduce((s,c)=>s+colW(c),0)+30):0;
  const th=`<th class="idb-lead-th"></th>`+cols.map(c=>{
    const ti=tbl.columns.indexOf(c);
    const rz=`<div class="idb-col-rz" onmousedown="idbColResizeStart(event,'${blk.id}','${c.id}')" onclick="event.stopPropagation()" ondragstart="event.preventDefault()"></div>`;
    return `<th draggable="true" ondragstart="idbColDragStart(event,'${blk.id}',${ti})" ondragover="idbColDragOver(event)" ondragleave="idbColDragLeaveTh(event)" ondrop="idbColDrop(event,'${blk.id}',${ti})" ondragend="idbColDragEnd()" onclick="idbColMenu(event,'${blk.id}','${c.id}')" title="Drag to reorder \u00b7 click to edit" data-col="${ti}" data-cid="${c.id}"><span class="idb-th-in">${idbTypeIcon(c.type)}${escHtml(c.name)}</span>${rz}</th>`;
  }).join('')
    +`<th class="idb-addcol" onclick="idbAddCol(event,'${blk.id}')" data-tip="Add a property">+</th>`;
  const rowHtml=row=>{
    const colorRule=(blk.colorRules||[]).find(r=>r.colId&&r.color&&r.value!==undefined&&(row.cells[r.colId]||'')===(r.value));
    // Visible on dark themes: a clear tint PLUS a solid left accent bar (the old
    // 12%-alpha tint alone read as "nothing happened").
    const rowStyle=colorRule?` style="background:${colorRule.color}30;box-shadow:inset 4px 0 0 ${colorRule.color}"`:''
    const handle=`<td class="idb-rowhandle" draggable="true" ondragstart="idbRowDragStart(event,'${blk.id}','${row.id}')" ondragend="idbRowDragEnd()"><button class="idb-rowmenu-btn" onclick="idbRowMenu(event,'${blk.id}','${row.id}')" title="Drag to reorder \u00b7 click for menu">\u22ee</button></td>`;
    const tds=cols.map(col=>{
      let cell=idbCell(blk,tbl,row,col,col.id===titleId);
      // Tag every data cell with its column id so keyboard nav can move within a column.
      cell=cell.replace(/^<td/,`<td data-cid="${col.id}"`);
      // Make non-text, interactive cells keyboard-focusable (text/title cells focus via
      // their own contenteditable). Only cells that have an action (onclick) become tab stops.
      const interactive=col.id!==titleId&&['select','status','multiselect','image','cover','date','checkbox','link'].includes(col.type);
      if(interactive&&/ onclick=/.test(cell)) cell=cell.replace(/^<td([^>]*)>/,`<td$1 tabindex="0" onkeydown="idbCellNav(event,this)">`);
      return cell;
    }).join('');
    return `<tr ondragover="idbRowDragOver(event)" ondrop="idbRowDrop(event,'${blk.id}','${row.id}')" ondragleave="idbRowDragLeave(event)" data-rid="${row.id}"${rowStyle}>${handle}${tds}<td class="idb-rowend"></td></tr>`;
  };
  const groupAddRow=(gcol,g)=>`<tr class="idb-grp-newrow"><td class="idb-rowhandle"></td><td colspan="${cols.length+1}"><button class="idb-grp-add" onclick="idbAddRowTo('${blk.id}','${gcol.id}','${escAttr(g.key)}')"><span class="np-pill">+ New Page</span></button></td></tr>`;
  // "Show more / all / less" controls for a paginated group (idbGrpMoreRow returns
  // '' when pagination is off or the group fits within one increment).
  const idbGrpMoreRow=(blk,gk,total,shown,nCols)=>{
    const ps=blk.groupPageSize||0; if(!ps||total<=ps) return '';
    const parts=[];
    if(shown<total){
      const next=Math.min(ps,total-shown);
      parts.push(`<button class="idb-grp-more-b" onclick="idbGrpShowMore('${blk.id}','${escAttr(gk)}')">Show ${next} more</button>`);
      parts.push(`<button class="idb-grp-more-b sec" onclick="idbGrpShowAll('${blk.id}','${escAttr(gk)}')">Show all ${total}</button>`);
    }
    if(shown>ps) parts.push(`<button class="idb-grp-more-b sec" onclick="idbGrpShowLess('${blk.id}','${escAttr(gk)}')">Show less</button>`);
    if(!parts.length) return '';
    return `<tr class="idb-grp-morerow"><td class="idb-rowhandle"></td><td colspan="${nCols+1}"><div class="idb-grp-more-in"><span class="idb-grp-more-ct">${shown} of ${total}</span>${parts.join('')}</div></td></tr>`;
  };
  let bodyRows;
  const gcol=blk.groupCol&&cols.find(c=>c.id===blk.groupCol&&isSelectish(c));
  if(gcol){
    const collapsed=blk.groupCollapsed||{};
    const hidden=blk.hiddenGroups||{};
    const groups=[...(gcol.options||[]).filter(o=>o.l).map(o=>({key:o.l,color:o.c,label:o.l})),{key:'',color:'var(--mu)',label:'No '+gcol.name}];
    const hiddenList=[];
    bodyRows=groups.map(g=>{
      const grows=rows.filter(r=>(r.cells[gcol.id]||'')===g.key);
      if(!grows.length) return '';
      const gk=g.key||'__none__'; const isC=!!collapsed[gk];
      if(hidden[gk]){ hiddenList.push(g); return ''; }
      const countSpan=blk.hideGroupCount?'': `<span class="idb-grp-count">${grows.length}</span>`;
      const delBtn=g.key?`<div class="idb-pop-it idb-pop-danger" onclick="idbPopClose();idbDeleteGroup('${blk.id}','${gcol.id}','${escAttr(g.key)}')">Delete group</div>`:'';
      const moreMenu=`idbGrpMenu(event,'${blk.id}','${escAttr(gk)}','${gcol.id}','${escAttr(g.key)}')`;
      const head=`<tr class="idb-grp"><td colspan="${span}"><div class="idb-grp-h"><button class="idb-grp-chev${isC?' collapsed':''}" onclick="idbToggleGroup('${blk.id}','${escAttr(gk)}')" title="Collapse">&#9662;</button>${idbGroupPill(gcol,g)}${countSpan}<button class="idb-grp-more" onclick="event.stopPropagation();${moreMenu}" title="Group options">&#8230;</button><button class="idb-grp-h-new" onclick="event.stopPropagation();idbAddRowTo('${blk.id}','${gcol.id}','${escAttr(g.key)}')" title="New page in this group">+ New</button></div></td></tr>`;
      const colHead=`<tr class="idb-grp-cols">${th}</tr>`;
      const lim=idbGrpLim(blk,gk);
      const shownRows=lim===Infinity?grows:grows.slice(0,lim);
      const moreRow=idbGrpMoreRow(blk,gk,grows.length,shownRows.length,cols.length);
      return head+(isC?'':colHead+shownRows.map(rowHtml).join('')+moreRow+groupAddRow(gcol,g));
    }).join('');
    if(hiddenList.length){
      const names=hiddenList.map(g=>escHtml(g.label)).join(', ');
      bodyRows+=`<tr class="idb-grp-hidden-row"><td colspan="${span}"><span class="idb-grp-hidden-lbl">${hiddenList.length} hidden group${hiddenList.length>1?'s':''}: ${names}</span><button class="idb-grp-show-all" onclick="idbShowAllGroups('${blk.id}')">Show all</button></td></tr>`;
    }
  } else bodyRows=rows.map(rowHtml).join('');
  const empty=rows.length?'':`<tr><td colspan="${span}" class="idb-empty">${tbl.rows.length?'No entries match the filters.':`<div class="idb-empty-rich"><div class="idb-empty-ico">\u{1F5C2}\u{FE0F}</div><div class="idb-empty-h">Your table is ready</div><div class="idb-empty-sub">Add a first row to get going.</div><button class="btn btn-a" onclick="idbAddRow('${blk.id}')">+ Add first row</button></div>`}</td></tr>`;
  return `<div class="idb-sc"><table class="idb-tbl${useFixed?' fixed':''}"${useFixed?` style="width:${tblW}px"`:''}>${colgroup}<thead>${gcol?'':`<tr>${th}</tr>`}</thead><tbody>${bodyRows}${empty}</tbody></table></div>
    ${gcol?'':`<div class="idb-foot" onclick="idbAddRow('${blk.id}')" ondragover="idbFootDragOver(event,'${blk.id}')" ondragleave="idbFootDragLeave(event)" ondrop="idbFootDrop(event,'${blk.id}')"><span class="np-pill">+ New Page</span></div>`}`;
}
/* Render the chip list for a multi-select value (shared by table cells, cards, calendar, props). */
function idbMsChips(col,v){
  const vals=msVals(v); if(!vals.length) return '';
  return vals.map(lbl=>{const o=(col.options||[]).find(x=>x.l===lbl);const cc=o?o.c:'#888';
    return `<span class="chip" style="background:${cc}22;color:${cc}">${escHtml(lbl)}</span>`;}).join('');
}
function idbCell(blk,tbl,row,col,isTitle){
  const v=row.cells[col.id]||''; const bid=blk.id;
  if(isSelectish(col)){
    const o=(col.options||[]).find(x=>x.l===v);
    const cc=o?o.c:'#888';
    const chip=v?(col.type==='status'
        ?`<span class="idb-status"><span class="idb-status-dot" style="background:${cc}"></span>${escHtml(v)}</span>`
        :`<span class="chip" style="background:${cc}22;color:${cc}">${escHtml(v)}</span>`)
      :`<span class="idb-mu">+</span>`;
    return `<td class="idb-click" onclick="idbOpenSel(event,'${bid}','${row.id}','${col.id}')">${chip}</td>`;
  }
  if(col.type==='multiselect'){
    const chips=idbMsChips(col,v)||'<span class="idb-mu">+</span>';
    return `<td class="idb-click idb-mscell" onclick="idbOpenSel(event,'${bid}','${row.id}','${col.id}')">${chips}</td>`;
  }
  if(col.type==='image'){
    const isrc=v?srcFor(v):'';
    return isrc?`<td class="idb-click idb-imgcell" onclick="idbViewImg(event,'${bid}','${row.id}','${col.id}')"><img src="${isrc}" alt=""></td>`
            :`<td class="idb-click idb-mu" onclick="idbImgUpload(event,'${bid}','${row.id}','${col.id}')">+ Image</td>`;
  }
  if(col.type==='cover'){
    // Read-only mirror of the row's page cover; click to view it large (no upload here).
    const doc=row.docId?DB.getDoc(row.docId):null;
    const cv=doc&&doc.meta&&doc.meta.cover; const csrc=cv?srcFor(cv):'';
    return csrc?`<td class="idb-click idb-imgcell" onclick="idbViewCover(event,'${row.docId}')"><img src="${csrc}" alt=""></td>`
              :`<td class="idb-mu idb-covercell">No cover</td>`;
  }
  if(col.type==='date'){
    const disp=v?new Date(v+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'<span class="idb-mu">+</span>';
    return `<td class="idb-click" onclick="idbOpenDate(event,'${bid}','${row.id}','${col.id}')">${disp}</td>`;
  }
  if(col.type==='checkbox')
    return `<td class="idb-click idb-cbcell" onclick="idbToggleCheck('${bid}','${row.id}','${col.id}')"><span class="idb-cb${v?' on':''}">${v?'\u2713':''}</span></td>`;
  if(col.type==='document'){
    const d=v?DB.getDoc(v):null;
    return `<td><button class="doc-link${d?' has-doc':''}" onkeydown="idbCellNav(event,this)" onclick="openLinkedDoc('${tbl.id}','${row.id}','${col.id}')">${d?'\u2197 '+escHtml(d.title||'Untitled'):'+ Doc'}</button></td>`;
  }
  if(col.type==='link')
    return v?`<td class="idb-click" onclick="idbEditLink(event,'${bid}','${row.id}','${col.id}')">${tblMentionHtml(v)}</td>`
            :`<td class="idb-click idb-mu" onclick="idbEditLink(event,'${bid}','${row.id}','${col.id}')">+ Link</td>`;
  if(isTitle)
    return `<td class="idb-title-cell"><div class="idb-title-inner">${idbRowIcon(row)}<span class="idb-ed idb-title-ed" contenteditable="true" onkeydown="idbCellKey(event,this)" onblur="idbSetCell('${bid}','${row.id}','${col.id}',this.innerText)">${escHtml(v)}</span><button class="idb-open-row" onclick="event.stopPropagation();idbOpenRow('${bid}','${row.id}')" data-tip="Open as page"><span class="idb-mi">⤢</span> Open</button></div></td>`;
  return `<td class="idb-ed" contenteditable="true" onkeydown="idbCellKey(event,this)" onblur="idbSetCell('${bid}','${row.id}','${col.id}',this.innerText)">${escHtml(v)}</td>`;
}
/* ── Spreadsheet-style keyboard navigation ──────────────────────────────────
   Every data cell is a tab stop — text/title cells via their contenteditable,
   everything else (select, date, checkbox, link, image, document) via tabindex.
     Tab / Shift+Tab → next / previous cell (any type)
     Enter           → commit a text cell + drop to the cell below; on a non-text
                       cell, assign a value (toggle / open editor) then move down
     Space           → assign a value on a non-text cell (stay put)
     Arrows          → move between non-text cells (up/down keep the column)
   Non-text cells re-render their block when a value lands, so move-down is wired
   through the editors that apply asynchronously (idbSelPick / pickDate). */

/* All focusable cell targets in a table, in document order. */
function idbNavTargets(scope){ return [...scope.querySelectorAll('.idb-ed, td[tabindex], .doc-link')]; }
/* The focusable element inside (or being) a cell, or null for read-only cells. */
function idbTargetIn(td){
  if(!td) return null;
  if(td.classList.contains('idb-ed')) return td;          // plain text cell (td is editable)
  const ed=td.querySelector('.idb-ed'); if(ed) return ed;  // title cell (inner span)
  const dl=td.querySelector('.doc-link'); if(dl) return dl; // document cell (inner button)
  if(td.hasAttribute('tabindex')) return td;               // interactive click cell
  return null;                                             // read-only (e.g. "No cover")
}
function idbFocusTarget(t){
  if(!t) return;
  t.focus();
  if(t.classList&&t.classList.contains('idb-ed')){ const r=document.createRange(); r.selectNodeContents(t); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }
}
function _idbFocusCell(el){ idbFocusTarget(el); } // back-compat alias
/* Move horizontally across the full cell list. */
function idbCellHop(el,dir){
  const table=el.closest('.idb-tbl'); if(!table) return;
  const list=idbNavTargets(table); const i=list.indexOf(el);
  if(i<0) return; const t=list[i+dir]; if(t) idbFocusTarget(t);
}
/* Move vertically within the same column (skips group headers / footers). */
function idbCellVert(el,dir){
  const td=el.closest('td'); const cid=td&&td.getAttribute('data-cid'); const tr=el.closest('tr');
  if(!cid||!tr) return false;
  const step=dir>0?'nextElementSibling':'previousElementSibling';
  let row=tr;
  while(row=row[step]){
    if(!row.hasAttribute('data-rid')) continue;
    const t=idbTargetIn(row.querySelector(`td[data-cid="${cid}"]`));
    if(t){ idbFocusTarget(t); return true; }
  }
  return false;
}
/* Re-find a row by id (the block may have re-rendered) and focus the cell below it
   in the given column; falls back to the same cell on the last row. */
function idbRefocusBelow(rowId,cid){
  const tr=document.querySelector(`tr[data-rid="${rowId}"]`); if(!tr) return;
  let row=tr;
  while(row=row.nextElementSibling){
    if(!row.hasAttribute('data-rid')) continue;
    const t=idbTargetIn(row.querySelector(`td[data-cid="${cid}"]`));
    if(t){ idbFocusTarget(t); return; }
  }
  const t=idbTargetIn(tr.querySelector(`td[data-cid="${cid}"]`)); if(t) idbFocusTarget(t);
}
/* Re-find a row by id and re-focus the SAME column's cell (used after a synchronous
   re-render so keyboard focus isn't dropped). */
function idbRefocusSame(rowId,cid){
  const tr=document.querySelector(`tr[data-rid="${rowId}"]`); if(!tr) return;
  const t=idbTargetIn(tr.querySelector(`td[data-cid="${cid}"]`)); if(t) idbFocusTarget(t);
}

/* Text / title cells (contenteditable). */
function idbCellKey(e,el){
  if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); el.blur(); idbCellVert(el,1); return; }
  if(e.key==='Tab'){ e.preventDefault(); el.blur(); idbCellHop(el,e.shiftKey?-1:1); return; }
}
/* Non-text cells (select, date, checkbox, link, image, document). */
function idbCellNav(e,el){
  switch(e.key){
    case 'Tab':        e.preventDefault(); idbCellHop(el,e.shiftKey?-1:1); return;
    case 'ArrowDown':  e.preventDefault(); idbCellVert(el,1); return;
    case 'ArrowUp':    e.preventDefault(); idbCellVert(el,-1); return;
    case 'ArrowRight': e.preventDefault(); idbCellHop(el,1); return;
    case 'ArrowLeft':  e.preventDefault(); idbCellHop(el,-1); return;
    case 'Enter':      e.preventDefault(); idbActivateCell(el,true); return;
    case ' ':          e.preventDefault(); idbActivateCell(el,false); return;
  }
}
/* Fire a non-text cell's own action (toggle / open editor / navigate). When `advance`
   is set, move to the cell below once the value is committed. */
function idbActivateCell(el,advance){
  const td=el.closest('td'); if(!td) return;
  const cid=td.getAttribute('data-cid'); const tr=td.closest('tr'); const rowId=tr&&tr.getAttribute('data-rid');
  const isCheckbox=td.classList.contains('idb-cbcell');
  const btn=td.querySelector('button');
  if(btn) btn.click(); else td.click();
  if(isCheckbox){ // toggle re-renders synchronously — restore focus (move down on Enter, stay on Space)
    if(rowId&&cid){ if(advance) idbRefocusBelow(rowId,cid); else idbRefocusSame(rowId,cid); }
    return;
  }
  if(!advance) return;
  // Select/date editors apply later — stash the move-down target on their context.
  if(typeof _selCtx!=='undefined'&&_selCtx) _selCtx._advance={rowId,cid};
  else if(S.dpTarget) S.dpTarget._advance={rowId,cid};
}
/* A row's linked-doc icon, shown in the title cell / cards / calendar. */
function idbRowIcon(row){
  if(!row||!row.docId) return '';
  const d=DB.getDoc(row.docId); const ic=d&&d.meta&&d.meta.icon; if(!ic) return '';
  const isImg=isBlobRef(ic)||(typeof ic==='string'&&(ic.startsWith('data:')||ic.startsWith('http')));
  return isImg?`<span class="idb-row-ico"><img src="${srcFor(ic)}" alt=""></span>`:`<span class="idb-row-ico">${ic}</span>`;
}
/* Row item menu (⋮) — keeps destructive delete out of one-click range. */
function idbRowMenu(e,blockId,rowId){
  e.stopPropagation();
  const blk=findBlock(blockId),tbl=idbTbl(blk);
  const others=tbl?DB.getTbls().filter(t=>t.id!==tbl.id):[];
  const moveSection=others.length?`<div class="idb-dd-sep"></div>
    <div class="idb-dd-cap">Move to database</div>`+others.map(t=>
      `<div class="idb-dd-it" onclick="idbCloseRowMenu();idbRowMoveTo('${blockId}','${rowId}','${t.id}')"><span class="idb-mi">⊞</span> ${escHtml(t.name||'Untitled')}</div>`).join(''):'';
  const pop=document.getElementById('idb-rowmenu');
  pop.innerHTML=`<div class="idb-dd-it" onclick="idbCloseRowMenu();idbOpenRow('${blockId}','${rowId}')"><span class="idb-mi">⤢</span> Open as page</div>
    <div class="idb-dd-it idb-rm-del" onclick="idbRowMenuDelete('${blockId}','${rowId}')"><span class="idb-mi"><svg class="lic" viewBox="0 0 24 24" width="13" height="13"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg></span> Delete entry</div>${moveSection}`;
  idbDdPos(pop,e.currentTarget.getBoundingClientRect()); pop.classList.add('open'); openOvl();
}
function idbRowMoveTo(blockId,rowId,destTblId){
  const blk=findBlock(blockId),tbl=idbTbl(blk),dest=DB.getTbl(destTblId);
  if(tbl&&dest) idbMoveRowConfirm(tbl,rowId,dest);
}
function idbRowMenuDelete(blockId,rowId){ idbCloseRowMenu(); idbDelRow(blockId,rowId); }
function idbCloseRowMenu(){ const p=document.getElementById('idb-rowmenu'); if(p)p.classList.remove('open'); closeOvlSafe(); }
function idbSetCell(blockId,rowId,colId,val){
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const row=tbl.rows.find(r=>r.id===rowId); if(!row)return;
  row.cells[colId]=val; DB.saveTbl(tbl);
  if(idbTitleColId(tbl)===colId&&row.docId){const d=DB.getDoc(row.docId);if(d){d.title=val;DB.saveDoc(d);}}
  idbRerenderSiblings(tbl.id,blockId); // keep sibling views (e.g. calendar) in sync, don't disturb the cell being edited
}
function idbToggleCheck(blockId,rowId,colId){
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const row=tbl.rows.find(r=>r.id===rowId); if(!row)return;
  row.cells[colId]=row.cells[colId]?'':'1'; DB.saveTbl(tbl); idbSync(blockId,tbl.id);
}
/* \u2500\u2500 IN-PLACE SELECT EDITOR \u2500\u2500
   One dropdown that lets you assign a value AND manage options live (add via
   an inline input, delete, recolor) without prompts. Works for both inline
   table cells and the document's shared-property tags via a small context. */
let _selCtx=null;
let _selFilter='';   // live type-to-filter query
let _selFocus=0;     // keyboard-highlighted index into the filtered list (+ create row)
function idbSelEditor(ctx,rect){
  _selCtx=ctx; _selFilter=''; _selFocus=0;
  const dd=document.getElementById('tbl-dd'); dd.classList.add('idb-seldd');
  renderSelDD(); idbDdPos(dd,rect); dd.style.display='block'; openOvl();
}
/* Build the dropdown shell: a search/add field on top + the (separately rendered)
   options list. Typing only re-renders the list, so the field keeps focus + caret. */
function renderSelDD(){
  if(!_selCtx) return;
  const {tbl,colId}=_selCtx;
  const col=tbl.columns.find(c=>c.id===colId); if(!col)return;
  col.options=col.options||[];
  const isStatus=col.type==='status', multi=!!_selCtx.multi;
  document.getElementById('tbl-dd').innerHTML=
    `<div class="idb-dd-searchrow"><input class="idb-dd-search" autocomplete="off" spellcheck="false" placeholder="Search or add ${isStatus?'a state':'an option'}\u2026" value="${escAttr(_selFilter)}" oninput="idbSelFilter(this.value)" onkeydown="idbSelSearchKey(event)"></div>
     <div class="idb-dd-hint">\u2191\u2193 move \u00b7 Enter ${multi?'toggle':'select'}${isStatus?' \u00b7 drag \u283f reorders':''}</div>
     <div class="idb-dd-opts">${renderSelOptsHtml()}</div>`;
  // Focus the field so you can type immediately; place caret at the end.
  setTimeout(()=>{ const s=document.querySelector('.idb-dd-search'); if(s&&document.activeElement!==s){ s.focus(); const n=s.value.length; try{s.setSelectionRange(n,n);}catch(_){} } },0);
}
/* Just the filtered option rows (+ "Create \u2026" row). Injected into .idb-dd-opts on
   every keystroke without touching the search field. */
function renderSelOptsHtml(){
  const {tbl,colId,cur}=_selCtx;
  const col=tbl.columns.find(c=>c.id===colId);
  const isStatus=col.type==='status', multi=!!_selCtx.multi;
  const curArr=multi?(_selCtx.cur||[]):null;
  const isOn=(lbl)=>multi?curArr.includes(lbl):lbl===cur;
  const q=_selFilter.trim().toLowerCase();
  const filtered=col.options.map((o,i)=>({o,i})).filter(x=>!q||(x.o.l||'').toLowerCase().includes(q));
  const canCreate=!!q && !col.options.some(o=>(o.l||'').toLowerCase()===q);
  const navLen=filtered.length+(canCreate?1:0);
  if(_selFocus>=navLen) _selFocus=Math.max(0,navLen-1);
  let html=filtered.map((x,pos)=>{
    const {o,i}=x; const editing=_selCtx._editing===i; const on=isOn(o.l); const foc=pos===_selFocus;
    const editPanel=editing?`<div class="idb-dd-edit">
        <div class="idb-dd-swatches">${PALETTE_COLORS.map(c=>`<span class="idb-dd-sw${c===o.c?' on':''}" style="background:${c}" onclick="event.stopPropagation();idbSelSetColor(${i},'${c}')"></span>`).join('')}</div>
        <button class="idb-dd-delbtn" onclick="event.stopPropagation();idbSelDelOpt(${i})">\ud83d\uddd1 Delete option</button>
      </div>`:'';
    const mark=multi
      ? `<span class="idb-dd-cb${on?' on':''}">${on?'\u2713':''}</span>`
      : (on?'<span class="idb-dd-chk">\u2713</span>':'');
    return `<div class="idb-dd-optwrap${editing?' open':''}">
      <div class="idb-dd-it idb-dd-opt${multi&&on?' sel':''}${foc?' foc':''}" data-fpos="${pos}" draggable="${q?'false':'true'}" ondragstart="idbSelDragStart(event,${i})" ondragover="idbSelDragOver(event)" ondrop="idbSelDrop(event,${i})" ondragend="idbSelDragEnd()" onclick="${multi?`idbSelToggle('${escAttr(o.l)}')`:`idbSelPick('${escAttr(o.l)}')`}">
        <span class="idb-dd-grip" title="Drag to reorder">\u283f</span>
        ${multi?mark:''}
        <span class="idb-dd-dot${isStatus?' ring':''}" style="background:${o.c}" onclick="event.stopPropagation();idbSelToggleEdit(${i})" title="Edit color"></span>
        <span class="idb-dd-lbl">${o.l?escHtml(o.l):'<span class=&quot;idb-mu&quot;>unnamed</span>'}</span>
        ${multi?'':mark}
        <button class="idb-dd-more" onclick="event.stopPropagation();idbSelToggleEdit(${i})" title="Edit / delete">\u22ef</button>
      </div>${editPanel}</div>`;}).join('');
  if(canCreate){
    const foc=_selFocus===filtered.length;
    html+=`<div class="idb-dd-it idb-dd-create${foc?' foc':''}" data-fpos="${filtered.length}" onclick="idbSelCreatePick()"><span class="idb-dd-create-plus">+</span> Create <b>${escHtml(_selFilter.trim())}</b></div>`;
  }
  if(!filtered.length && !canCreate) html=`<div class="idb-dd-empty">No options yet \u2014 type to add one</div>`;
  const showClear=multi?(curArr.length>0):!!cur;
  if(showClear && !q) html+=`<div class="idb-dd-it idb-mu idb-dd-clear" onclick="${multi?'idbSelClearMulti()':"idbSelPick('')"}">Clear ${multi?'all':'value'}</div>`;
  return html;
}
/* Live filter \u2014 re-render only the list so the search field keeps focus + caret. */
function idbSelFilter(v){ if(!_selCtx)return; _selFilter=v; _selFocus=0; const c=document.querySelector('.idb-dd-opts'); if(c)c.innerHTML=renderSelOptsHtml(); }
function _selRerenderOpts(){ const c=document.querySelector('.idb-dd-opts'); if(c)c.innerHTML=renderSelOptsHtml(); const f=c&&c.querySelector('.foc'); if(f&&f.scrollIntoView)f.scrollIntoView({block:'nearest'}); }
/* Arrow keys move the highlight (caret stays put \u2014 preventDefault stops the field's
   own up/down behaviour); Enter selects/creates the highlight; Esc closes. */
function idbSelSearchKey(e){
  if(!_selCtx)return;
  const {tbl,colId}=_selCtx; const col=tbl.columns.find(c=>c.id===colId);
  const q=_selFilter.trim().toLowerCase();
  const filtered=col.options.filter(o=>!q||(o.l||'').toLowerCase().includes(q));
  const canCreate=!!q && !col.options.some(o=>(o.l||'').toLowerCase()===q);
  const navLen=filtered.length+(canCreate?1:0);
  if(e.key==='ArrowDown'){ e.preventDefault(); _selFocus=navLen?Math.min(_selFocus+1,navLen-1):0; _selRerenderOpts(); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); _selFocus=Math.max(_selFocus-1,0); _selRerenderOpts(); }
  else if(e.key==='Enter'){ e.preventDefault();
    if(canCreate && _selFocus===filtered.length) idbSelCreatePick();
    else if(filtered[_selFocus]) idbSelChoose(filtered[_selFocus].l);
  }
  else if(e.key==='Escape'){ e.preventDefault(); closeSelDD(); }
}
/* Assign (single) or toggle (multi) the chosen value. */
function idbSelChoose(label){ if(_selCtx&&_selCtx.multi) idbSelToggle(label); else idbSelPick(label); }
/* Create the typed option, then assign/toggle it. */
function idbSelCreatePick(){
  if(!_selCtx)return; const name=_selFilter.trim(); if(!name)return;
  const col=idbSelCol(); col.options=col.options||[];
  if(!col.options.some(o=>(o.l||'').toLowerCase()===name.toLowerCase())){
    col.options.push({l:name,c:PALETTE_COLORS[col.options.length%PALETTE_COLORS.length]});
    DB.saveTbl(_selCtx.tbl); _selCtx._dirty=true;
  }
  _selFilter=''; _selFocus=0;
  idbSelChoose(name);
}
function idbSelLive(){ if(_selCtx&&_selCtx.rerender)_selCtx.rerender(); } // live-update the underlying view without closing
function idbSelPick(val){ const adv=_selCtx&&_selCtx._advance; if(_selCtx&&_selCtx.onPick)_selCtx.onPick(val); closeSelDD(); if(adv) idbRefocusBelow(adv.rowId,adv.cid); }
/* Multi-select: toggle membership and keep the dropdown open so you can pick several. */
function idbSelToggle(val){
  if(!_selCtx)return;
  if(_selCtx.onToggle)_selCtx.onToggle(val);
  _selCtx.cur=_selCtx.cur||[]; const i=_selCtx.cur.indexOf(val);
  if(i>=0)_selCtx.cur.splice(i,1); else _selCtx.cur.push(val);
  _selCtx._editing=null; renderSelDD(); idbSelLive();
}
function idbSelClearMulti(){ if(!_selCtx)return; if(_selCtx.onClear)_selCtx.onClear(); _selCtx.cur=[]; renderSelDD(); idbSelLive(); }
function idbSelCol(){const {tbl,colId}=_selCtx;return tbl.columns.find(c=>c.id===colId);}
function idbSelAddOpt(name){
  name=(name||'').trim(); if(!name||!_selCtx)return;
  const {tbl}=_selCtx; const col=idbSelCol(); col.options=col.options||[];
  if(!col.options.some(o=>o.l===name)) col.options.push({l:name,c:PALETTE_COLORS[col.options.length%PALETTE_COLORS.length]});
  DB.saveTbl(tbl); _selCtx._dirty=true; _selCtx._editing=null; renderSelDD(); idbSelLive();
  setTimeout(()=>document.querySelector('.idb-dd-newinput')?.focus(),10);
}
function idbSelDelOpt(i){ if(!_selCtx)return; const {tbl}=_selCtx; idbSelCol().options.splice(i,1); _selCtx._editing=null; DB.saveTbl(tbl); _selCtx._dirty=true; renderSelDD(); idbSelLive(); }
function idbSelToggleEdit(i){ if(!_selCtx)return; _selCtx._editing=(_selCtx._editing===i)?null:i; renderSelDD(); }
function idbSelSetColor(i,c){ if(!_selCtx)return; const {tbl}=_selCtx; idbSelCol().options[i].c=c; DB.saveTbl(tbl); _selCtx._dirty=true; renderSelDD(); idbSelLive(); } // applies instantly, keeps the editor open
let _selDrag=null;
function idbSelDragStart(e,i){ _selDrag=i; try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','o');}catch(_){} e.stopPropagation(); }
function idbSelDragOver(e){ e.preventDefault(); if(e.dataTransfer)e.dataTransfer.dropEffect='move'; }
function idbSelDrop(e,i){ e.preventDefault(); e.stopPropagation(); if(_selDrag==null||_selDrag===i){_selDrag=null;return;} const {tbl}=_selCtx; const opts=idbSelCol().options; const [m]=opts.splice(_selDrag,1); opts.splice(i,0,m); _selDrag=null; _selCtx._editing=null; DB.saveTbl(tbl); _selCtx._dirty=true; renderSelDD(); idbSelLive(); }
function idbSelDragEnd(){ _selDrag=null; }
function closeSelDD(){ const dd=document.getElementById('tbl-dd'); if(dd){dd.style.display='none';dd.classList.remove('idb-seldd');} closeOvlSafe(); const ctx=_selCtx; _selCtx=null; if(ctx&&ctx.rerender)ctx.rerender(); }
function idbOpenSel(e,blockId,rowId,colId){
  e.stopPropagation();
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const row=tbl.rows.find(r=>r.id===rowId);
  const col=tbl.columns.find(c=>c.id===colId);
  if(col&&col.type==='multiselect'){
    idbSelEditor({tbl,colId,multi:true,cur:row?msVals(row.cells[colId]):[],
      onToggle:val=>{if(!row)return;const set=msVals(row.cells[colId]);const i=set.indexOf(val);if(i>=0)set.splice(i,1);else set.push(val);row.cells[colId]=set;DB.saveTbl(tbl);},
      onClear:()=>{if(row){row.cells[colId]=[];DB.saveTbl(tbl);}},
      rerender:()=>idbSync(blockId,tbl.id)
    }, e.currentTarget.getBoundingClientRect());
    return;
  }
  idbSelEditor({tbl,colId,cur:row?row.cells[colId]||'':'',
    onPick:val=>{if(row){row.cells[colId]=val;DB.saveTbl(tbl);}},
    rerender:()=>idbSync(blockId,tbl.id)
  }, e.currentTarget.getBoundingClientRect());
}
function idbOpenDate(e,blockId,rowId,colId){
  e.stopPropagation();
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  S.dpTarget={type:'idb',blockId,rowId,colId};
  const v=(tbl.rows.find(r=>r.id===rowId)||{cells:{}}).cells[colId]||'';
  const d=v?new Date(v+'T12:00:00'):new Date(); S.dpY=d.getFullYear(); S.dpM=d.getMonth();
  renderDp('Date'); posModal(document.getElementById('pm-dp'),e.currentTarget.getBoundingClientRect());
}
function idbEditLink(e,blockId,rowId,colId){
  e.stopPropagation();
  promptUrl(e.currentTarget.getBoundingClientRect(),(url)=>{idbSetCell(blockId,rowId,colId,url?normUrl(url):'');reRenderBlock(blockId);});
}
