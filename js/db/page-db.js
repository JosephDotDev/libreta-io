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
/* Slash flow for databases: pick a source, then pick which view this block shows.
   (Each block is a single view; add another block to show the same DB differently.) */
function idbSlashSourceMenu(sid){
  const tbls=DB.getTbls();
  const hdr=document.querySelector('#slash-menu .sm-hdr'); if(hdr) hdr.textContent='Database — choose a source';
  const newItem=`<div class="sm-it" onclick="idbSlashView('${sid}','__new__')"><div class="sm-ico">＋</div><div><div class="sm-nm">New database</div><div class="sm-ds">Create one, then pick a view</div></div></div>`;
  const items=tbls.map(t=>`<div class="sm-it" onclick="idbSlashView('${sid}','${t.id}')"><div class="sm-ico">⊞</div><div><div class="sm-nm">${escHtml(t.name)}</div><div class="sm-ds">${t.rows.length} entr${t.rows.length!==1?'ies':'y'} · add a view of this database</div></div></div>`).join('');
  document.getElementById('sm-its').innerHTML=newItem+items;
  S.slashSub=true; if(typeof slashSetFoc==='function') slashSetFoc(0);   // arrow keys now drive this submenu
}
function idbSlashView(sid,source){
  const hdr=document.querySelector('#slash-menu .sm-hdr'); if(hdr) hdr.textContent='Choose a view';
  const views=[
    {v:'table',ico:'⊞',lbl:'Table',ds:'A spreadsheet of entries'},
    {v:'board',ico:'▥',lbl:'Board',ds:'Kanban grouped by a select property'},
    {v:'calendar',ico:'▤',lbl:'Calendar',ds:'Entries on a month by a date property'},
  ];
  document.getElementById('sm-its').innerHTML=
    `<div class="sm-it" onclick="idbSlashSourceMenu('${sid}')"><div class="sm-ico">‹</div><div><div class="sm-nm">Back</div><div class="sm-ds">Choose a different database</div></div></div>`
    +views.map(x=>`<div class="sm-it" onclick="idbSlashCreate('${sid}','${source}','${x.v}')"><div class="sm-ico">${x.ico}</div><div><div class="sm-nm">${x.lbl} view</div><div class="sm-ds">${x.ds}</div></div></div>`).join('');
  S.slashSub=true; if(typeof slashSetFoc==='function') slashSetFoc(0);   // arrow keys now drive this submenu
}
function idbSlashCreate(sid,source,view){
  if(source==='__new__') idbCreateNew(sid,view);
  else insertDbBlock(sid,source,view);
}

