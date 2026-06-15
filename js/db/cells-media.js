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
function idbAddRow(blockId){
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const cells={}; tbl.columns.forEach(c=>cells[c.id]='');
  tbl.rows.push({id:mkId('r'),cells}); DB.saveTbl(tbl); idbSync(blockId,tbl.id);
  setTimeout(()=>{const rs=document.querySelectorAll(`.bk-row[data-id="${blockId}"] .idb-tbl tbody tr`);const last=rs[rs.length-1];const c=last&&last.querySelector('.idb-ed');if(c){c.focus();}},40);
}
function idbAddRowTo(blockId,colId,val){
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  const cells={}; tbl.columns.forEach(c=>cells[c.id]=''); cells[colId]=val;
  tbl.rows.push({id:mkId('r'),cells}); DB.saveTbl(tbl); idbSync(blockId,tbl.id);
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
