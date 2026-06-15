/* Image cells store an IndexedDB blob ref (like cover/icon images). */
let _idbImgTarget=null;
function idbImgUpload(e,blockId,rowId,colId){ e&&e.stopPropagation&&e.stopPropagation(); _idbImgTarget={blockId,rowId,colId}; const inp=document.getElementById('idb-img-input'); inp.value=''; inp.click(); }
/* ── Image lightbox ── a dim full-screen overlay that just shows the picture; clicking
   anywhere outside the image closes it (so does Esc). Editable image cells get subtle
   Replace/Remove controls that fade in on hover. */
let _imglbCtx=null;
function openImgLightbox(src,opts){
  opts=opts||{};
  let lb=document.getElementById('imglb');
  if(!lb){ lb=document.createElement('div'); lb.id='imglb'; lb.className='imglb';
    lb.addEventListener('click',e=>{ if(!e.target.closest('.imglb-img,.imglb-btn')) closeImgLightbox(); });
    document.body.appendChild(lb);
  }
  const bar=opts.editable?`<div class="imglb-bar"><button class="imglb-btn" onclick="imglbReplace()">Replace</button><button class="imglb-btn danger" onclick="imglbRemove()">Remove</button></div>`:'';
  lb.innerHTML=`<div class="imglb-stage"><img class="imglb-img" src="${escAttr(src)}" alt="" draggable="false">${bar}</div>`;
  _imglbCtx=opts;
  requestAnimationFrame(()=>{ if(_imglbCtx===opts) lb.classList.add('open'); }); // skip if closed before the frame
}
function closeImgLightbox(){ const lb=document.getElementById('imglb'); if(lb){ lb.classList.remove('open'); setTimeout(()=>{ if(!lb.classList.contains('open'))lb.innerHTML=''; },200);} _imglbCtx=null; }
function imglbReplace(){ const c=_imglbCtx; closeImgLightbox(); if(c&&c.blockId) idbImgUpload(null,c.blockId,c.rowId,c.colId); }
function imglbRemove(){ const c=_imglbCtx; if(c&&c.blockId){ const blk=findBlock(c.blockId),tbl=idbTbl(blk); const row=tbl&&tbl.rows.find(r=>r.id===c.rowId); if(row){ const prev=row.cells[c.colId]; row.cells[c.colId]=''; if(isBlobRef(prev))freeBlob(prev); DB.saveTbl(tbl); idbSync(c.blockId,tbl.id);} } closeImgLightbox(); }
function idbViewImg(e,blockId,rowId,colId){
  e&&e.stopPropagation&&e.stopPropagation();
  const blk=findBlock(blockId),tbl=idbTbl(blk); const row=tbl&&tbl.rows.find(r=>r.id===rowId);
  const v=row&&row.cells[colId]; const src=v?srcFor(v):'';
  if(!src){ idbImgUpload(e,blockId,rowId,colId); return; } // empty cell → upload
  openImgLightbox(src,{editable:true,blockId,rowId,colId});
}
function idbViewCover(e,docId){
  e&&e.stopPropagation&&e.stopPropagation();
  const doc=docId?DB.getDoc(docId):null; const cv=doc&&doc.meta&&doc.meta.cover; const src=cv?srcFor(cv):'';
  if(src) openImgLightbox(src,{editable:false});
}
function idbDocImgUpload(colId){ _idbImgTarget={docMode:true,colId}; const inp=document.getElementById('idb-img-input'); inp.value=''; inp.click(); }
