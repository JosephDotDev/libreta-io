async function onIdbImgChange(input){
  const file=input.files[0]; if(!file||!_idbImgTarget) return;
  const t=_idbImgTarget; _idbImgTarget=null;
  const blob=await compressToBlob(file,1200,1200,0.82)||file;
  const id=await storeBlob(blob);
  if(t.docMode){
    const {tbl,row}=idbDocRow(); if(!tbl||!row){freeBlob(id);return;}
    const prev=row.cells[t.colId]; row.cells[t.colId]=id;
    if(DB.saveTbl(tbl)===false){freeBlob(id);return;}
    if(isBlobRef(prev)) freeBlob(prev); renderProps();
  } else {
    const blk=findBlock(t.blockId),tbl=idbTbl(blk); if(!tbl){freeBlob(id);return;}
    const row=tbl.rows.find(r=>r.id===t.rowId); if(!row){freeBlob(id);return;}
    const prev=row.cells[t.colId]; row.cells[t.colId]=id;
    if(DB.saveTbl(tbl)===false){freeBlob(id);return;}
    if(isBlobRef(prev)) freeBlob(prev); idbSync(t.blockId,tbl.id);
  }
}
/* Make naming part of creation: after a new entry renders, drop the caret into its
   title cell so the user types the name immediately (no extra click). Targets the row
   by id so it works in grouped + ungrouped tables; no-ops in views without an inline
   title cell (board/calendar/gallery). */
function idbFocusRowTitle(blockId,rowId){
  setTimeout(()=>{
    const cell=document.querySelector(`.bk-row[data-id="${blockId}"] tr[data-rid="${rowId}"] .idb-title-ed`)
            || document.querySelector(`.bk-row[data-id="${blockId}"] tr[data-rid="${rowId}"] .idb-ed`);
    if(cell){ cell.focus(); if(typeof putCursorEnd==='function') putCursorEnd(cell); }
  },40);
}
function idbAddRow(blockId){
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const cells={}; tbl.columns.forEach(c=>cells[c.id]='');
  const row={id:mkId('r'),cells}; tbl.rows.push(row); DB.saveTbl(tbl); idbSync(blockId,tbl.id);
  idbFocusRowTitle(blockId,row.id);
}
function idbAddRowTo(blockId,colId,val){
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const cells={}; tbl.columns.forEach(c=>cells[c.id]=''); cells[colId]=val;
  const row={id:mkId('r'),cells}; tbl.rows.push(row); DB.saveTbl(tbl); idbSync(blockId,tbl.id);
  idbFocusRowTitle(blockId,row.id);
}
/* Focus the inline-editable title on a board card / calendar event after it renders,
   so a new entry is named in place (no preview panel). Falls back to opening the row
   for any view that lacks an inline title (e.g. timeline). */
function idbFocusCardTitle(blockId,rowId){
  setTimeout(()=>{
    const root=document.querySelector(`.bk-row[data-id="${blockId}"] .idb-card[data-rid="${rowId}"], .bk-row[data-id="${blockId}"] .idb-cal-ev[data-rid="${rowId}"]`);
    const el=root&&(root.querySelector('.idb-card-title-ed')||root.querySelector('.idb-cev-title-ed'));
    if(el){
      el.focus({preventScroll:true});   // preventScroll so adding an item doesn't jump the page
      // place the caret inside the (empty) title without a second focus() that would re-scroll
      try{ const r=document.createRange(); r.selectNodeContents(el); r.collapse(false);
           const s=window.getSelection(); s.removeAllRanges(); s.addRange(r); }catch(_){}
    } else if(typeof idbOpenRow==='function') idbOpenRow(blockId,rowId);
  },50);
}
/* Board/kanban add: create the card in its lane, then edit its title in place. */
function idbBoardAddRow(blockId,colId,val){
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const cells={}; tbl.columns.forEach(c=>cells[c.id]=''); cells[colId]=val;
  const row={id:mkId('r'),cells}; tbl.rows.push(row); DB.saveTbl(tbl); idbSync(blockId,tbl.id);
  idbFocusCardTitle(blockId,row.id);
}
function idbAddCol(e,blockId){
  e&&e.stopPropagation&&e.stopPropagation();
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  idbColPop(e.currentTarget.getBoundingClientRect(),{title:'New property',type:'text',onSave:(name,type)=>{
    const col={id:mkId('c'),name,type,options:idbSeedOpts(type)};
    tbl.columns.push(col); tbl.rows.forEach(r=>r.cells[col.id]=''); DB.saveTbl(tbl); idbSync(blockId,tbl.id);
  }});
}
function idbColMenu(e,blockId,colId){
  e.stopPropagation();
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const col=tbl.columns.find(c=>c.id===colId); if(!col)return;
  const isFirst=idbTitleColId(tbl)===colId;
  idbColPop(e.currentTarget.getBoundingClientRect(),{
    title:isFirst?'Edit title property':'Edit property', name:col.name, type:col.type,
    onSave:(name,type)=>{
      col.name=name;
      if(type!==col.type){col.type=type;if(hasOpts(col)&&!col.options)col.options=idbSeedOpts(type);}
      DB.saveTbl(tbl); idbSync(blockId,tbl.id);
    },
    onDelete:isFirst?null:()=>{ tbl.columns=tbl.columns.filter(c=>c.id!==colId); tbl.rows.forEach(r=>delete r.cells[colId]); DB.saveTbl(tbl); idbSync(blockId,tbl.id); }
  });
}
function idbRename(blockId,name){const blk=findBlock(blockId),tbl=idbTbl(blk);if(tbl){tbl.name=name.trim()||'Untitled';DB.saveTbl(tbl);idbRerenderSiblings(tbl.id,blockId);}}
function idbDelRow(blockId,rowId){const blk=findBlock(blockId),tbl=idbTbl(blk);if(tbl){tbl.rows=tbl.rows.filter(r=>r.id!==rowId);DB.saveTbl(tbl);idbSync(blockId,tbl.id);}}
/* Delete a row given only its table (no block context) — for the Tasks page,
   calendar, and other non-block surfaces. Re-renders every inline view of the table. */
function idbDeleteRow(tableId,rowId){
  const tbl=DB.getTbl(tableId); if(!tbl) return;
  tbl.rows=(tbl.rows||[]).filter(r=>r.id!==rowId);
  DB.saveTbl(tbl);
  if(typeof idbRerenderSiblings==='function') idbRerenderSiblings(tableId,null);
}
