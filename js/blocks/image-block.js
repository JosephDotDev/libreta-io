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
/* ── Resize an image by dragging a side handle ──
   Width is stored on blk.w (px), clamped between 80px and the column width. */
function imgResizeStart(e,blkId,dir){
  e.preventDefault(); e.stopPropagation();
  const wrap=document.querySelector(`.bk-row[data-id="${blkId}"] .bk-img-wrap`); if(!wrap) return;
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  const startX=e.clientX/z, startW=wrap.getBoundingClientRect().width/z;
  const maxW=(wrap.parentElement?wrap.parentElement.getBoundingClientRect().width/z:startW)||startW;
  document.body.classList.add('bk-img-resizing'); wrap.classList.add('rz-active');
  const move=ev=>{
    const dx=(ev.clientX/z-startX)*dir;
    const w=Math.max(80,Math.min(maxW,Math.round(startW+dx)));
    wrap.style.width=w+'px';
  };
  const up=()=>{
    document.removeEventListener('mousemove',move); document.removeEventListener('mouseup',up);
    document.body.classList.remove('bk-img-resizing'); wrap.classList.remove('rz-active');
    const blk=findBlock(blkId); if(blk){ blk.w=Math.round(parseFloat(wrap.style.width))||null; sched(); }
  };
  document.addEventListener('mousemove',move); document.addEventListener('mouseup',up);
}
/* ── DRAG-AND-DROP an image file from the desktop ──
   Drop onto an existing image block → fills/replaces it; drop anywhere else in the
   block editor → inserts new image block(s) at the drop point. Works in the main
   editor and the side-peek (everything routes through S.blocks / currentCtId()). */
function setBlockImageFromFile(blkId,file){
  const blk=findBlock(blkId); if(!blk||!file||!file.type||!file.type.startsWith('image/')) return;
  const [mw,mh,q]=blk.type==='carousel'?[1200,1200,0.78]:[1600,1200,0.85];
  compressToBlob(file,mw,mh,q).then(async blob=>{
    if(!blob) return;
    const id=await storeBlob(blob); const prev=blk.src; blk.src=id; blk.caption=blk.caption||'';
    reRenderBlock(blkId); clearTimeout(S.saveTimer);
    if(flushSave()===false){ blk.src=prev||''; freeBlob(id); reRenderBlock(blkId); }
    else if(isBlobRef(prev)&&prev!==id) freeBlob(prev);
  });
}
async function insertImageBlocksFromFiles(files,atRowId){
  const imgs=[...files].filter(f=>f.type&&f.type.startsWith('image/')); if(!imgs.length) return;
  const pt=imgs.length>1&&typeof progressToast==='function'?progressToast(`Adding ${imgs.length} images…`):null;
  const made=[];
  for(const file of imgs){
    const blob=await compressToBlob(file,1600,1200,0.85); if(!blob) continue;
    const id=await storeBlob(blob); const nb=mkBlock('image',''); nb.src=id; nb.caption=''; made.push(nb);
  }
  if(!made.length){ pt&&pt.fail('Couldn’t add images'); return; }
  // Insert at the drop row (top level only); an empty paragraph there is replaced.
  let idx=S.blocks.length;
  if(atRowId){ const loc=locate(atRowId);
    if(loc&&loc.arr===S.blocks){ const cur=loc.arr[loc.idx];
      const empty=cur.type==='paragraph'&&!(cur.content||'').replace(/<[^>]+>/g,'').trim();
      if(empty){ loc.arr.splice(loc.idx,1,...made); idx=-1; } else idx=loc.idx+1;
    }
  }
  if(idx>=0) S.blocks.splice(idx,0,...made);
  rerender(); updNums(); clearTimeout(S.saveTimer);
  if(flushSave()===false){ made.forEach(b=>freeBlob(b.src)); pt&&pt.fail('Storage full — images not saved'); }
  else pt&&pt.done(imgs.length>1?'Images added':'Image added');
}
function _imgDropCt(target){ return (target&&target.closest&&target.closest('#blocks-ct,#peek-blocks,#home-blocks-ct,#ov-panel-blocks'))||null; }
function _dtHasFiles(e){ const dt=e.dataTransfer; return !!(dt&&dt.types&&[].indexOf.call(dt.types,'Files')>=0); }
/* Where an image dropped "in the editor" should land, even if the cursor is over the
   title/props/empty area rather than directly on a block row. */
function _imgEditorSurface(target){
  if(_imgDropCt(target)) return _imgDropCt(target);
  if(S.peekOpen){ const t=target&&target.closest&&target.closest('#doc-peek'); if(t) return document.getElementById('peek-blocks'); }
  if(S.view==='editor'){ const t=target&&target.closest&&target.closest('#blocks-sc'); if(t) return document.getElementById('blocks-ct'); }
  return null;
}
// Window-level + capture so we ALWAYS cancel the browser's default "open the file"
// navigation when an image is dragged over the app — the #1 frustration was the tab
// navigating away. Insertion only happens when the drop lands on an editor surface.
window.addEventListener('dragover',e=>{
  if(!_dtHasFiles(e)) return;
  e.preventDefault();                  // app has no other file-drop targets → never let the tab navigate
  try{e.dataTransfer.dropEffect=_imgEditorSurface(e.target)?'copy':'none';}catch(_){}
},true);
window.addEventListener('drop',e=>{
  if(!_dtHasFiles(e)) return;
  e.preventDefault(); e.stopPropagation();   // kill the "open the dropped file" navigation everywhere
  const surface=_imgEditorSurface(e.target);
  if(!surface) return;                       // dropped outside the editor → nothing to insert
  const files=[...(e.dataTransfer.files||[])].filter(f=>f.type&&f.type.startsWith('image/'));
  if(!files.length) return;
  const imgRow=e.target.closest&&e.target.closest('.bk-row[data-type="image"]');
  if(imgRow){ setBlockImageFromFile(imgRow.dataset.id,files[0]); return; }
  const row=e.target.closest&&e.target.closest('.bk-row');
  insertImageBlocksFromFiles(files,row?row.dataset.id:null);
},true);
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

