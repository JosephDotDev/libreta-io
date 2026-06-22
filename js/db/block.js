function mkDbBlockHtml(blk){
  const tbl=idbTbl(blk);
  if(!tbl) return `<div class="idb"><div class="idb-hd"><span class="idb-title-s">Database not found</span></div></div>`;
  const view=blk.view||'table';
  let toolbar, body;
  if(view==='board'){ toolbar=idbToolbar(blk,tbl,'board'); body=idbBoardView(blk,tbl); }
  else if(view==='calendar'){ toolbar=idbCalBar(blk,tbl); body=idbCalView(blk,tbl); }
  else if(view==='timeline'){ toolbar=idbTimelineBar(blk,tbl); body=idbTimelineView(blk,tbl); }
  else { toolbar=idbToolbar(blk,tbl,'table'); body=idbTableView(blk,tbl); }
  const viewSel=`<select class="idb-viewsel" onchange="idbSetView('${blk.id}',this.value)" title="Change view">${Object.keys(IDB_VIEWS).map(v=>`<option value="${v}"${v===view?' selected':''}>${IDB_VIEWS[v]}</option>`).join('')}</select>`;
  // Point this block at a different existing database (inline blocks only — the
  // full-page database has its own switcher).
  const useExisting=blk.id==='__pagedb__'?'':`<button class="idb-tb-ic idb-useexisting" onclick="idbUseExistingMenu(event,'${blk.id}')" data-tip="Show an existing database">⇆</button>`;
  // Clickable icon slot before the title (emoji, line icon, or uploaded image).
  const ic=tbl.icon;
  const iconBtn=`<button class="idb-hd-icon${ic?' has':''}" onclick="idbPickIcon(event,'${blk.id}')" data-tip="${ic?'Change icon':'Add an icon'}">${ic?iconInner(ic,'1em'):'<span class="idb-hd-icon-ph">☺</span>'}</button>`;
  // Open this database as its own full page (not shown when already on that page).
  const openPage=blk.id==='__pagedb__'?'':`<button class="idb-tb-ic idb-openpage" onclick="openDbPage('${tbl.id}')" data-tip="Open as a full page">↗</button>`;
  // Destructive: kept apart from the modifier icons by a divider so it's not a stray click.
  const delBtn=`<button class="idb-hd-del" onclick="idbDeleteDbConfirm('${blk.id}')" data-tip="Delete database"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.6 9h4.8l.6-9"/></svg></button>`;
  // Table/Board: collapse name + modifier buttons + view picker onto a single
  // header row. Calendar/Timeline keep their own bar (date nav lives there).
  const inline=(view==='table'||view==='board');
  return `<div class="idb${inline?' idb-onerow':''}" data-tid="${tbl.id}">
    <div class="idb-hd">
      ${iconBtn}
      <input class="idb-title" value="${escAttr(tbl.name)}" onblur="idbRename('${blk.id}',this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">
      ${inline?(toolbar||''):''}
      <span class="idb-hd-r">${openPage}${useExisting}${viewSel}<span class="idb-hd-sep"></span>${delBtn}</span>
    </div>${inline?'':(toolbar||'')}${body}</div>`;
}
/* Set/change/remove a database's header icon (reuses the page icon picker). */
function idbPickIcon(e,blockId){
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  openIconPicker(e,e.currentTarget,(v)=>{ tbl.icon=v||''; DB.saveTbl(tbl); idbRerenderSiblings(tbl.id,null); if(blk.id==='__pagedb__'&&typeof renderPageDb==='function')renderPageDb(); else reRenderBlock(blockId); if(typeof closeAll==='function')closeAll(); });
}
/* Delete the whole database (the table) from any view. Clearly separated + confirmed
   because it removes the table everywhere it's shown, not just this block. */
function idbDeleteDbConfirm(blockId){
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const n=(tbl.rows||[]).length;
  showConfirm(`Delete the “${tbl.name||'Untitled'}” database${n?` and its ${n} entr${n===1?'y':'ies'}`:''}? It will be removed from every page that shows it. This can’t be undone.`,()=>{
    (tbl.rows||[]).forEach(r=>{ if(r.docId){ const d=DB.getDoc(r.docId); if(d&&d.dbId===tbl.id&&typeof DB.delDoc==='function') DB.delDoc(r.docId); } });
    const tid=tbl.id; DB.delTbl(tid);
    if(blk.id==='__pagedb__'){ S.pageDbBlk=null; S.tblId=null; if(typeof renderTblList==='function')renderTblList(); }
    else { idbRerenderSiblings(tid,null); reRenderBlock(blockId); }
    if(typeof renderTasks==='function'&&S.view==='tasks') renderTasks();
    if(typeof toast==='function') toast('Database deleted');
  },'Delete','Delete database');
}
const IDB_TYPE_ICON={text:'T',number:'#',select:'\u25c9',multiselect:'\u2263',status:'\u25d0',date:'\u2637',checkbox:'\u2611',image:'\u25a3',cover:'\u25a6',url:'\u2197',link:'\ud83d\udd17',document:'\u2197'};
function idbTypeIcon(type){return `<span class="idb-th-ico">${IDB_TYPE_ICON[type]||'\u2022'}</span>`;}
function idbGroupPill(gcol,g){
  if(g.key==='') return `<span class="idb-grp-none">${escHtml(g.label)}</span>`;
  if(gcol.type==='status') return `<span class="idb-status"><span class="idb-status-dot" style="background:${g.color}"></span>${escHtml(g.label)}</span>`;
  return `<span class="chip" style="background:${g.color}22;color:${g.color}">${escHtml(g.label)}</span>`;
}
