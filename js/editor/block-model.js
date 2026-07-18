/* ═══════════════════════════════════════════════
   NESTED BLOCK MODEL  (columns support)
   locate(id) → {arr, idx, block, colsBlock, colArrayIndex}
   `arr` is the array directly containing the block (top-level or a column).
═══════════════════════════════════════════════ */
function locate(id,blocks,colsBlock,colArrayIndex,toggleBlock){
  blocks=blocks||S.blocks;
  for(let i=0;i<blocks.length;i++){
    const b=blocks[i];
    if(b.id===id) return {arr:blocks,idx:i,block:b,colsBlock:colsBlock||null,colArrayIndex,toggleBlock:toggleBlock||null};
    if(b.type==='columns'&&b.cols){
      for(let c=0;c<b.cols.length;c++){
        const r=locate(id,b.cols[c],b,c,null);
        if(r) return r;
      }
    }
    if(b.type==='toggle'&&b.children){
      const r=locate(id,b.children,null,null,b);
      if(r) return r;
    }
  }
  return null;
}
function findBlock(id){if(id==='__pagedb__'&&S.pageDbBlk)return S.pageDbBlk;const r=locate(id);return r?r.block:null}
function flattenBlocks(blocks){
  blocks=blocks||S.blocks; let out=[];
  blocks.forEach(b=>{
    if(b.type==='columns'&&b.cols){b.cols.forEach(col=>{out=out.concat(flattenBlocks(col))})}
    else if(b.type==='toggle'&&b.children){out.push(b);out=out.concat(flattenBlocks(b.children))}
    else out.push(b);
  });
  return out;
}
function reassignIds(b){ b.id=mkId('b'); if(b.type==='columns'&&b.cols) b.cols.forEach(col=>col.forEach(reassignIds)); if(b.type==='toggle'&&b.children) b.children.forEach(reassignIds); }
function currentCtId(){return S.peekOpen?'peek-blocks':(S.view==='home'?'home-blocks-ct':'blocks-ct')}
function rerender(){renderBlocks(currentCtId())}
/* Remove empty columns; unwrap a columns block that's down to ≤1 column. */
function cleanupColumns(cb){
  cb.cols=cb.cols.filter(col=>col.length>0);
  if(cb.widths) cb.widths=cb.widths.slice(0,cb.cols.length);
  if(cb.cols.length<=1){
    const loc=locate(cb.id); if(!loc) return;
    const remaining=cb.cols[0]||[mkBlock('paragraph')];
    loc.arr.splice(loc.idx,1,...remaining);
  }
}

