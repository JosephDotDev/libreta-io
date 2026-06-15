/* ═══════════════════════════════════════════════
   COVER IMAGE SYSTEM
═══════════════════════════════════════════════ */
const BLANK_COVER='__accent__';
function isAccentCover(c){ return c===BLANK_COVER; }
/* Background style for a cover thumbnail on cards/calendar. The "blank" cover is a
   solid accent fill, not an image — rendering it through an <img> shows a broken
   image, so callers use this to get a correct background either way. */
function coverThumbBg(cover,pos){
  if(cover===BLANK_COVER) return 'background:var(--ac)';
  return `background-image:url('${srcFor(cover)}');background-position:center ${(pos!=null?pos:50)}%`;
}
function renderCover(doc){
  const home=S.docId===HOME_ID;
  const wrap=document.getElementById(home?'home-cover-wrap':'ed-cover-wrap'); if(!wrap) return;
  // Keep the inactive view's cover empty so #cover-wrap / #cover-img-el ids stay unique
  const other=document.getElementById(home?'ed-cover-wrap':'home-cover-wrap'); if(other){other.innerHTML='';other.style.display='none';}
  const addBtn=document.getElementById(home?'home-cover-add-btn':'cover-add-btn');
  const linkBtn=document.getElementById(home?'home-cover-link-btn':'cover-link-btn');
  if(doc?.meta?.cover){
    const cover=doc.meta.cover;
    const isBlank=cover===BLANK_COVER;
    const pos=doc.meta.coverPos!=null?doc.meta.coverPos:50;
    wrap.style.display='block';
    // Reset any leftover collapse state from a previously-scrolled doc
    wrap.style.maxHeight=''; wrap.style.opacity=''; wrap._fullH=0;
    // Blank cover = solid accent fill; an image/link can be added from the actions overlay.
    const media=isBlank
      ? `<div class="cover-img-el" id="cover-img-el" style="background:var(--ac)"></div>`
      : `<img class="cover-img-el" id="cover-img-el" src="${srcFor(cover)}" alt="Cover" draggable="false" style="object-position:center ${pos}%">`;
    wrap.innerHTML=`<div class="cover-wrap" id="cover-wrap">
      ${media}
      <div class="cover-actions" id="cover-actions">
        ${isBlank?'':`<button class="cover-btn" onclick="startReposition()">Reposition</button>`}
        <button class="cover-btn" onclick="triggerCoverUpload()">${isBlank?'Add image':'Change cover'}</button>
        <button class="cover-btn" onclick="coverFromUrlPrompt(event)">${isBlank?'Add by URL':'Link'}</button>
        <button class="cover-btn" onclick="removeCover()">Remove</button>
      </div>
      <div class="cover-reposition-bar" id="cover-reposition-bar" style="display:none">
        <span class="cover-reposition-hint">Drag the image up or down to reposition</span>
        <button class="cover-btn" onclick="saveReposition()">Save position</button>
      </div>
    </div>`;
    // Cover present → hide the redundant hover buttons (actions live on the cover)
    if(addBtn) addBtn.style.display='none';
    if(linkBtn) linkBtn.style.display='none';
  } else {
    wrap.innerHTML=''; wrap.style.display='none';
    if(addBtn){addBtn.textContent='🖼 Add cover'; addBtn.style.display='inline-flex';}
    // Offer a direct "link an image" path here too, so adding a cover-by-URL
    // doesn't require first creating a blank solid cover.
    if(linkBtn) linkBtn.style.display='inline-flex';
  }
}
/* "Add cover" → start with a solid accent-fill cover; the user can then swap in
   an uploaded or URL-linked image from the cover's hover actions. */
function addBlankCover(){
  const doc=getActiveDoc(); if(!doc) return;
  doc.meta=doc.meta||{}; doc.meta.cover=BLANK_COVER; delete doc.meta.coverPos;
  saveActiveDoc(doc); renderCover(doc);
}
/* ── COVER REPOSITION ── */
let _repos={pos:50,startY:0,startPos:50};
function startReposition(){
  const doc=getActiveDoc();
  _repos.pos=doc?.meta?.coverPos!=null?doc.meta.coverPos:50;
  const wrap=document.getElementById('cover-wrap'); if(!wrap) return;
  wrap.classList.add('repositioning');
  document.getElementById('cover-actions').style.display='none';
  document.getElementById('cover-reposition-bar').style.display='flex';
  const img=document.getElementById('cover-img-el');
  if(img) img.addEventListener('mousedown',reposDown);
}
function reposDown(e){
  e.preventDefault();
  _repos.startY=e.clientY; _repos.startPos=_repos.pos;
  document.addEventListener('mousemove',reposMove);
  document.addEventListener('mouseup',reposUp);
}
function reposMove(e){
  const wrap=document.getElementById('cover-wrap'); if(!wrap) return;
  const h=wrap.offsetHeight||210;
  // Dragging down reveals the top of the image → decrease object-position-y
  let pos=_repos.startPos-((e.clientY-_repos.startY)/h)*100;
  pos=Math.max(0,Math.min(100,pos));
  _repos.pos=pos;
  const img=document.getElementById('cover-img-el');
  if(img) img.style.objectPosition='center '+pos+'%';
}
function reposUp(){
  document.removeEventListener('mousemove',reposMove);
  document.removeEventListener('mouseup',reposUp);
}
function saveReposition(){
  const doc=getActiveDoc();
  if(doc){doc.meta=doc.meta||{};doc.meta.coverPos=Math.round(_repos.pos);saveActiveDoc(doc);}
  const wrap=document.getElementById('cover-wrap'); if(wrap) wrap.classList.remove('repositioning');
  const img=document.getElementById('cover-img-el'); if(img) img.removeEventListener('mousedown',reposDown);
  reposUp();
  const bar=document.getElementById('cover-reposition-bar'); if(bar) bar.style.display='none';
  const acts=document.getElementById('cover-actions'); if(acts) acts.style.display='';
}
function triggerCoverUpload(){
  document.getElementById('cover-file-input').value='';
  document.getElementById('cover-file-input').click();
}
function onCoverFileChange(input){
  const file=input.files[0]; if(!file) return;
  // Higher res + quality than before so covers keep more of their original detail
  compressToBlob(file,2400,1100,0.90).then(async blob=>{
    if(!blob) return;
    const doc=getActiveDoc(); if(!doc) return;
    const prev=doc.meta?.cover;
    const id=await storeBlob(blob);
    doc.meta=doc.meta||{}; doc.meta.cover=id;
    if(saveActiveDoc(doc)===false){doc.meta.cover=prev||null;freeBlob(id);return}
    freeBlob(prev);
    renderCover(doc);
  });
}
function removeCover(){
  const doc=getActiveDoc(); if(!doc) return;
  freeBlob(doc.meta?.cover);
  doc.meta=doc.meta||{}; doc.meta.cover=null;
  saveActiveDoc(doc); renderCover(doc);
}

