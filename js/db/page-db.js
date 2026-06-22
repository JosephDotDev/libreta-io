function renderPageDb(){
  const main=document.getElementById('tbl-main'); if(!main) return;
  const blk=S.pageDbBlk, tbl=blk&&DB.getTbl(blk.tableId);
  if(!blk||!tbl){ main.innerHTML='<div class="tbl-empty">Select or create a database</div>'; return; }
  main.innerHTML=`<div class="pagedb-wrap">${mkDbBlockHtml(blk)}</div>`;
}
function insertDbBlock(blockId,tableId,view){
  const loc=locate(blockId); if(!loc) return;
  loc.arr[loc.idx]={id:blockId,type:'database',tableId,content:'',view:view||'table'};
  const row=document.querySelector('.bk-row[data-id="'+blockId+'"]');
  if(row) row.replaceWith(mkBkEl(loc.arr[loc.idx]));
  // Keep a place to keep typing / run '/' below a top-level database.
  if(loc.arr===S.blocks && loc.idx===S.blocks.length-1){
    const p=mkBlock('paragraph','');
    S.blocks.push(p);
    document.getElementById('blocks-ct').appendChild(mkBkEl(p));
    setTimeout(()=>{const e=document.querySelector('.bk[data-id="'+p.id+'"]');if(e){e.focus();putCursorEnd(e);}},30);
  }
  closeSlash(); sched();
}
function idbCreateNew(blockId,view){
  const t=blankTbl(); t.name='New Database';
  // seed with one empty entry so the database isn't blank
  const cells={}; t.columns.forEach(c=>cells[c.id]=''); t.rows.push({id:mkId('r'),cells});
  DB.saveTbl(t);
  insertDbBlock(blockId,t.id,view);
}
/* Slash flow for databases: pick the format for a brand-new database. (Each block
   shows a single view; add another block to show the same DB differently. To point a
   block at an existing database, use the header control — idbUseExistingMenu.) */
function idbSlashView(sid,source){
  const hdr=document.querySelector('#slash-menu .sm-hdr'); if(hdr) hdr.textContent='New database — choose a format';
  const views=[
    {v:'table',ico:'⊞',lbl:'Table',ds:'A spreadsheet of entries'},
    {v:'board',ico:'▥',lbl:'Kanban board',ds:'Cards grouped by a select property'},
    {v:'calendar',ico:'▤',lbl:'Calendar',ds:'Entries on a month by a date property'},
  ];
  document.getElementById('sm-its').innerHTML=
    views.map(x=>`<div class="sm-it" onclick="idbSlashCreate('${sid}','${source}','${x.v}')"><div class="sm-ico">${x.ico}</div><div><div class="sm-nm">${x.lbl}</div><div class="sm-ds">${x.ds}</div></div></div>`).join('');
  S.slashSub=true; if(typeof slashSetFoc==='function') slashSetFoc(0);   // arrow keys now drive this submenu
}
function idbSlashCreate(sid,source,view){
  if(source==='__new__') idbCreateNew(sid,view);
  else insertDbBlock(sid,source,view);
}
/* Header control: point THIS database block at an existing database instead of its
   current one (the clutter-free replacement for listing every table in /database). */
function idbUseExistingMenu(e,blockId){
  e.stopPropagation();
  const blk=findBlock(blockId); const cur=idbTbl(blk);
  const tbls=DB.getTbls().filter(t=>t.id!==(cur&&cur.id));
  const list=tbls.length
    ? tbls.map(t=>`<div class="idb-pop-it" onclick="idbSwitchTable('${blockId}','${t.id}');idbPopClose()"><span class="idb-pop-ico">⊞</span>${escHtml(t.name||'Untitled Table')}<span class="idb-mu" style="margin-left:auto">${t.rows.length}</span></div>`).join('')
    : '<div class="idb-dd-empty">No other databases yet.</div>';
  idbPopOpen(e.currentTarget.getBoundingClientRect(),`<div class="idb-pop-lbl">Show an existing database</div>${list}`);
}
function idbSwitchTable(blockId,tableId){
  const blk=findBlock(blockId); if(!blk||blk.tableId===tableId) return;
  blk.tableId=tableId;
  // Reset view selections / per-view tweaks that may not apply to the new table.
  blk.groupCol=null; blk.dateCol=null; blk.hiddenCols=[]; blk.filters=[]; blk.sort=null; blk.colWidths={};
  idbPersistView(blk); reRenderBlock(blockId);
}

