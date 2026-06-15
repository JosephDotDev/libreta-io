/* ═══════════════════════════════════════════════
   IMAGE CAROUSEL BLOCK
═══════════════════════════════════════════════ */
function mkCarouselHtml(blk){
  const imgs=blk.images||[];
  const fit=blk.fit||'landscape';
  const items=imgs.map((im,i)=>{
    const cap=`<input class="bk-car-cap" placeholder="Label…" value="${(im.caption||'').replace(/"/g,'&quot;')}" oninput="carCaption('${blk.id}',${i},this.value)">`;
    if(im.src){
      return `<div class="bk-car-item">
        <div class="bk-car-imgwrap">
          <img class="bk-car-thumb" src="${srcFor(im.src)}" alt="">
          <div class="bk-car-ov">
            <button class="bk-car-btn" onclick="carUpload('${blk.id}',${i})">Replace</button>
            <button class="bk-car-btn" onclick="carRemove('${blk.id}',${i})">Remove</button>
          </div>
        </div>${cap}</div>`;
    }
    return `<div class="bk-car-item">
      <div class="bk-car-empty">
        <button class="bk-car-empty-x" onclick="event.stopPropagation();carRemove('${blk.id}',${i})" title="Remove this slot">&#10005;</button>
        <span style="font-size:24px">🖼</span>
        <div class="bk-img-acts"><button class="bk-img-act" onclick="event.stopPropagation();carUpload('${blk.id}',${i})">Upload</button><button class="bk-img-act" onclick="carImgFromUrl(event,'${blk.id}',${i})">URL</button></div>
      </div>${cap}</div>`;
  }).join('');
  const add=`<div class="bk-car-add" onclick="carAdd('${blk.id}')" title="Add another thumbnail">+<div style="font-size:10px;margin-top:3px">Add</div></div>`;
  return `<div class="bk-carousel fit-${fit}">${items}${add}</div>`;
}
function carSetFit(blkId,fit){
  const b=findBlock(blkId); if(!b) return;
  b.fit=fit; reRenderBlock(blkId); sched();
}
function carUpload(blkId,idx){
  S.pendingBlkId=blkId; S.pendingCarIdx=idx;
  document.getElementById('blk-img-input').value='';
  document.getElementById('blk-img-input').click();
}
function carCaption(blkId,idx,val){
  const b=findBlock(blkId); if(!b||!b.images[idx]) return;
  b.images[idx].caption=val; sched();
}
function carAdd(blkId){
  const b=findBlock(blkId); if(!b) return;
  b.images=b.images||[]; b.images.push({src:'',caption:''});
  reRenderBlock(blkId); sched();
}
function carRemove(blkId,idx){
  const b=findBlock(blkId); if(!b||!b.images) return;
  b.images.splice(idx,1);
  reRenderBlock(blkId); sched();
}
function reRenderBlock(blkId){
  if(blkId==='__pagedb__'){renderPageDb();return;} // full-page database (Databases page)
  const b=findBlock(blkId);
  const row=document.querySelector(`.bk-row[data-id="${blkId}"]`);
  if(b&&row) row.replaceWith(mkBkEl(b));
}
/* Terminal blocks (database, divider, media, …) have no editable text, so a
   document must always keep a trailing empty paragraph after one — otherwise
   there is nowhere to place the caret, type, or run '/' commands. */
const TERMINAL_BK=['database','divider','image','file','carousel','youtube','grid','page'];
function ensureTrailingParagraph(){
  const last=S.blocks[S.blocks.length-1];
  if(!last||TERMINAL_BK.includes(last.type)){ S.blocks.push(mkBlock('paragraph','')); return true; }
  return false;
}

