/* ═══════════════════════════════════════════════
   PAGE ICON SYSTEM
═══════════════════════════════════════════════ */
function renderEditorIcon(doc){
  const home=S.docId===HOME_ID;
  const area=document.getElementById(home?'home-icon-area':'ed-icon-area'); if(!area) return;
  const addBtn=document.getElementById(home?'home-icon-add-btn':'icon-add-btn');
  const icon=doc?.meta?.icon;
  if(icon){
    const isImg=isBlobRef(icon)||icon.startsWith('data:')||icon.startsWith('http');
    area.innerHTML=`<div class="icon-display${isImg?' has-img':''}" onclick="openIconPicker(event,this)" title="Change icon">
      ${isImg?`<img src="${srcFor(icon)}" alt="icon">`:`${icon}`}
    </div>`;
    // Icon present → hide the redundant "Add icon" hover button (click the icon itself to change)
    if(addBtn) addBtn.style.display='none';
  } else if(home){
    area.innerHTML='';
    if(addBtn){addBtn.textContent='😀 Add icon'; addBtn.style.display='inline-flex';}
  } else {
    // Editor: show a faint, clickable add-icon affordance right where the icon will live.
    area.innerHTML=`<button class="ed-icon-add" onclick="openIconPicker(event,this)" title="Add an icon">☺</button>`;
    if(addBtn) addBtn.style.display='none';
  }
}
function openIconPicker(e, anchor, cb){
  e.stopPropagation&&e.stopPropagation();
  S.iconPickCb = cb || setDocIcon;
  const picker=document.getElementById('icon-picker');
  renderIconPickerContent('emoji');
  const el=anchor||e.target;
  const rect=el.getBoundingClientRect();
  let top=rect.bottom+6, left=Math.min(rect.left, window.innerWidth-336);
  if(top+450>window.innerHeight) top=Math.max(rect.top-450, 10);
  picker.style.top=top+'px'; picker.style.left=left+'px';
  picker.classList.add('open'); openOvl();
}
function renderIconPickerContent(tab){
  const picker=document.getElementById('icon-picker');
  const tabs=`<div class="ip-tabs">
    <button class="ip-tab${tab==='emoji'?' on':''}" onclick="renderIconPickerContent('emoji')">😀 Emoji</button>
    <button class="ip-tab${tab==='upload'?' on':''}" onclick="renderIconPickerContent('upload')">📤 Upload</button>
  </div>`;
  let body='';
  if(tab==='emoji'){
    const rows=Object.entries(EMOJI_CATS).map(([cat,ems])=>
      `<div class="ip-cat">${cat}</div><div class="ip-grid">${ems.map(em=>
        `<button class="ip-em" data-em="${em}" onclick="applyIcon(this.dataset.em)">${em}</button>`
      ).join('')}</div>`
    ).join('');
    body=`<div class="ip-scroll">${rows}
      <button class="ip-clr" onclick="applyIcon('')">Remove icon</button>
    </div>`;
  } else {
    body=`<div class="ip-scroll">
      <div class="ip-up-area" onclick="triggerIconUpload()">
        <div class="ip-up-ico">🖼</div>
        <div class="ip-up-lbl">Upload an image</div>
        <div class="ip-up-hint">PNG, SVG, JPG — square recommended</div>
      </div>
      <button class="ip-clr" onclick="applyIcon('')">Remove icon</button>
    </div>`;
  }
  picker.innerHTML=tabs+body;
}
/* Route an icon-picker choice to whatever opened it (doc icon by default, or a callout) */
function applyIcon(value){ (S.iconPickCb||setDocIcon)(value); }
function setDocIcon(value){
  if(!S.docId) return;
  const doc=getActiveDoc(); if(!doc) return;
  const prev=doc.meta?.icon;
  doc.meta=doc.meta||{}; doc.meta.icon=value;
  if(saveActiveDoc(doc)===false){doc.meta.icon=prev;if(isBlobRef(value))freeBlob(value);return}
  if(isBlobRef(prev)&&prev!==value) freeBlob(prev);
  renderEditorIcon(doc); closeAll();
}
function removeDocIcon(){
  if(!S.docId) return;
  const doc=getActiveDoc(); if(!doc) return;
  freeBlob(doc.meta?.icon);
  doc.meta=doc.meta||{}; doc.meta.icon='';
  saveActiveDoc(doc); renderEditorIcon(doc); closeAll();
}
function triggerIconUpload(){
  document.getElementById('icon-file-input').value='';
  document.getElementById('icon-file-input').click();
}
function onIconFileChange(input){
  const file=input.files[0]; if(!file) return;
  compressToBlob(file,400,400,0.85).then(async blob=>{ if(blob){const id=await storeBlob(blob);applyIcon(id);} });
}

