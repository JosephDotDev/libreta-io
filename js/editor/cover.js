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
  if(S.peekOpen) return renderPeekCover(doc);
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
/* Cover in the side-peek — a compact version (no reposition; unique class-only ids
   so it never collides with the host editor's cover that's still in the DOM). */
function renderPeekCover(doc){
  const wrap=document.getElementById('peek-cover-wrap'); if(!wrap) return;
  const addBtn=document.getElementById('peek-cover-add-btn');
  const linkBtn=document.getElementById('peek-cover-link-btn');
  if(doc&&doc.meta&&doc.meta.cover){
    const cover=doc.meta.cover, isBlank=cover===BLANK_COVER;
    const pos=doc.meta.coverPos!=null?doc.meta.coverPos:50;
    wrap.style.display='block';
    const media=isBlank?`<div class="cover-img-el" style="background:var(--ac)"></div>`
      :`<img class="cover-img-el" src="${srcFor(cover)}" alt="Cover" draggable="false" style="object-position:center ${pos}%">`;
    wrap.innerHTML=`<div class="cover-wrap peek-cover">${media}
      <div class="cover-actions">
        <button class="cover-btn" onclick="triggerCoverUpload()">${isBlank?'Add image':'Change cover'}</button>
        <button class="cover-btn" onclick="coverFromUrlPrompt(event)">${isBlank?'Add by URL':'Link'}</button>
        <button class="cover-btn" onclick="removeCover()">Remove</button>
      </div></div>`;
    if(addBtn) addBtn.style.display='none';
    if(linkBtn) linkBtn.style.display='none';
  } else {
    wrap.innerHTML=''; wrap.style.display='none';
    if(addBtn){ addBtn.textContent='🖼 Add cover'; addBtn.style.display='inline-flex'; }
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
/* ═══════════════════════════════════════════════
   PAGE BACKGROUND  (Craft-style — content floats as a centered card over a full-bleed
   background image/gradient). Stored on doc.meta.bg as either a preset key (bg:<name>)
   or an image ref (blob/data/url). Distinct from the cover, which is a banner.
═══════════════════════════════════════════════ */
const PAGE_BGS = {
  'dawn':'linear-gradient(160deg,#ffd9a0,#ff9aa2 52%,#a18cd1)',
  'mint':'linear-gradient(160deg,#d4fc79,#96e6a1)',
  'ocean':'linear-gradient(160deg,#a1c4fd,#c2e9fb)',
  'lavender':'linear-gradient(160deg,#e0c3fc,#8ec5fc)',
  'peach':'linear-gradient(160deg,#ffecd2,#fcb69f)',
  'dusk':'linear-gradient(160deg,#2b5876,#4e4376)',
  'forest':'linear-gradient(160deg,#134e5e,#71b280)',
  'slate':'linear-gradient(160deg,#3a3f44,#1f2327)',
};
function pageBgCss(bg){
  if(!bg) return '';
  if(typeof bg==='string'&&bg.startsWith('bg:')){ const g=PAGE_BGS[bg.slice(3)]; return g||''; }
  return `url('${srcFor(bg)}')`;
}
function renderPageBg(doc){
  const sc=document.getElementById('blocks-sc'); const ev=document.getElementById('view-editor');
  if(!sc||!ev) return;
  const bg=doc&&doc.meta&&doc.meta.bg;
  if(bg && S.docId!==HOME_ID){
    sc.style.backgroundImage=pageBgCss(bg);
    sc.style.backgroundSize='cover';
    sc.style.backgroundPosition='center';
    sc.style.backgroundRepeat='no-repeat';
    ev.classList.add('has-pagebg');
  } else {
    sc.style.backgroundImage=''; sc.style.backgroundSize=''; sc.style.backgroundPosition=''; sc.style.backgroundRepeat='';
    ev.classList.remove('has-pagebg');
  }
}
function setPageBg(key){
  const doc=getActiveDoc(); if(!doc) return;
  freeBlob(doc.meta?.bg); // releases an image bg if we're switching to a preset/none
  doc.meta=doc.meta||{}; doc.meta.bg=key?('bg:'+key):null;
  saveActiveDoc(doc); renderPageBg(doc); if(typeof renderPageSettings==='function') renderPageSettings();
}
function removePageBg(){
  const doc=getActiveDoc(); if(!doc) return;
  freeBlob(doc.meta?.bg);
  doc.meta=doc.meta||{}; doc.meta.bg=null;
  saveActiveDoc(doc); renderPageBg(doc); if(typeof renderPageSettings==='function') renderPageSettings();
}
function triggerPageBgUpload(){ const i=document.getElementById('pagebg-file-input'); if(i){ i.value=''; i.click(); } }
function onPageBgFileChange(input){
  const file=input.files[0]; if(!file) return;
  if(!withinUploadLimit(file,'Image')){ input.value=''; return; }
  compressToBlob(file,2400,1600,0.86).then(async blob=>{
    if(!blob) return;
    const doc=getActiveDoc(); if(!doc) return;
    const prev=doc.meta?.bg;
    const id=await storeBlob(blob);
    doc.meta=doc.meta||{}; doc.meta.bg=id;
    if(saveActiveDoc(doc)===false){ doc.meta.bg=prev||null; freeBlob(id); return; }
    if(isBlobRef(prev)) freeBlob(prev);
    renderPageBg(doc); if(typeof renderPageSettings==='function') renderPageSettings();
  });
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
  if(!withinUploadLimit(file,'Cover image')){ input.value=''; return; }
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

