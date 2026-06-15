/* ═══════════════════════════════════════════════
   IMAGE BLOCK HANDLERS
═══════════════════════════════════════════════ */
function openBlkImgInput(id){
  S.pendingBlkId=id; S.pendingCarIdx=null;
  document.getElementById('blk-img-input').value='';
  document.getElementById('blk-img-input').click();
}
function replaceBlkImg(id){ openBlkImgInput(id); }
function toggleImgCaption(id){ const b=findBlock(id); if(!b)return; b.hideCaption=!b.hideCaption; reRenderBlock(id); sched(); }
function onBlkImgChange(input){
  const file=input.files[0]; if(!file||!S.pendingBlkId) return;
  const blkId=S.pendingBlkId, carIdx=S.pendingCarIdx;
  // Carousel thumbnails are compressed harder since several can share one document.
  const [mw,mh,q]=carIdx!=null?[1200,1200,0.78]:[1600,1200,0.85];
  compressToBlob(file,mw,mh,q).then(async blob=>{
    if(!blob){S.pendingBlkId=null;S.pendingCarIdx=null;return}
    const blk=findBlock(blkId); if(!blk){S.pendingBlkId=null;S.pendingCarIdx=null;return}
    const id=await storeBlob(blob);
    let prev;
    if(carIdx!=null&&blk.type==='carousel'){
      blk.images=blk.images||[];
      if(!blk.images[carIdx]) blk.images[carIdx]={src:'',caption:''};
      prev=blk.images[carIdx].src; blk.images[carIdx].src=id;
    } else {
      prev=blk.src; blk.src=id; blk.caption=blk.caption||'';
    }
    const row=document.querySelector(`.bk-row[data-id="${blkId}"]`);
    if(row){const nr=mkBkEl(blk); row.replaceWith(nr);}
    clearTimeout(S.saveTimer);
    const ok=flushSave();
    if(ok===false){
      if(carIdx!=null&&blk.type==='carousel') blk.images[carIdx].src=prev||'';
      else blk.src=prev||'';
      freeBlob(id); reRenderBlock(blkId);
    } else {
      freeBlob(prev);
    }
    S.pendingBlkId=null; S.pendingCarIdx=null;
  });
}
function saveBlkExtra(id, key, val){
  const blk=findBlock(id); if(!blk) return;
  blk[key]=val; sched();
}
/* ── #4 IMAGE FROM A URL (download + cache to IndexedDB) ── */
function blkImgFromUrl(e,blkId){
  e.stopPropagation();
  promptUrl(e.currentTarget.getBoundingClientRect(),(url)=>{ if(url) setBlockImageFromUrl(blkId,url); });
}
async function setBlockImageFromUrl(blkId,url){
  url=normUrl(url);
  const pt=progressToast('Fetching image…');
  const raw=await fetchImageBlob(url);
  const blk=findBlock(blkId); if(!blk){ pt.fail('Couldn’t add image'); return; }
  const prev=blk.src;
  let val;
  if(raw){ pt.update('Saving image…'); const blob=await compressToBlob(raw,1600,1200,0.85)||raw; val=await storeBlob(blob); }
  else { val=url; } // CORS-blocked → reference the URL directly
  blk.src=val; reRenderBlock(blkId);
  clearTimeout(S.saveTimer);
  if(flushSave()===false){ blk.src=prev||''; if(isBlobRef(val))freeBlob(val); reRenderBlock(blkId); pt.fail('Couldn’t save image'); }
  else { if(isBlobRef(prev)&&prev!==val)freeBlob(prev); pt.done(raw?'Image saved':'Image linked from URL'); }
}
function carImgFromUrl(e,blkId,idx){
  e.stopPropagation();
  promptUrl(e.currentTarget.getBoundingClientRect(),async(url)=>{
    if(!url) return; const pt=progressToast('Fetching image…');
    const raw=await fetchImageBlob(url);
    if(!raw){ pt.fail('Couldn’t download that image'); return; }
    const blk=findBlock(blkId); if(!blk){ pt.fail('Couldn’t add image'); return; }
    pt.update('Saving image…');
    const blob=await compressToBlob(raw,1200,1200,0.78)||raw;
    blk.images=blk.images||[]; if(!blk.images[idx]) blk.images[idx]={src:'',caption:''};
    const prev=blk.images[idx].src; const id=await storeBlob(blob);
    blk.images[idx].src=id; reRenderBlock(blkId);
    clearTimeout(S.saveTimer);
    if(flushSave()===false){ blk.images[idx].src=prev||''; freeBlob(id); reRenderBlock(blkId); pt.fail('Couldn’t save image'); }
    else { freeBlob(prev); pt.done('Image saved'); }
  });
}
function coverFromUrlPrompt(e){
  e.stopPropagation&&e.stopPropagation();
  const rect=(e.currentTarget||e.target).getBoundingClientRect();
  promptUrl(rect,(url)=>{ if(url) setCoverFromUrl(url); });
}
async function setCoverFromUrl(url){
  url=normUrl(url);
  const doc=getActiveDoc(); if(!doc) return;
  const pt=progressToast('Fetching cover…');
  const raw=await fetchImageBlob(url);
  const prev=doc.meta?.cover;
  let coverVal;
  if(raw){ pt.update('Saving cover…'); const blob=await compressToBlob(raw,2400,1100,0.90)||raw; coverVal=await storeBlob(blob); }
  else { coverVal=url; } // CORS-blocked download → just reference the URL directly (still displays in an <img>)
  doc.meta=doc.meta||{}; doc.meta.cover=coverVal;
  if(saveActiveDoc(doc)===false){ doc.meta.cover=prev||null; if(isBlobRef(coverVal))freeBlob(coverVal); pt.fail('Couldn’t save cover'); return; }
  if(isBlobRef(prev)&&prev!==coverVal) freeBlob(prev);
  renderCover(doc); pt.done(raw?'Cover saved':'Cover linked from URL');
}

