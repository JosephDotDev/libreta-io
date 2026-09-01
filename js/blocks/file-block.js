/* ═══════════════════════════════════════════════
   FILE BLOCK HANDLERS
═══════════════════════════════════════════════ */
function openBlkFileInput(id){
  S.pendingBlkId=id;
  document.getElementById('blk-file-input').value='';
  document.getElementById('blk-file-input').click();
}
async function onBlkFileChange(input){
  const file=input.files[0]; if(!file||!S.pendingBlkId) return;
  if(!withinUploadLimit(file,'File')){ input.value=''; return; }
  const blkId=S.pendingBlkId;
  const blk=findBlock(blkId); if(!blk){S.pendingBlkId=null;return}
  const prev=blk.fileId;
  const id=await storeBlob(file);
  blk.fileName=file.name; blk.fileType=file.type; blk.fileSize=file.size; blk.fileId=id; delete blk.fileData;
  const row=document.querySelector(`.bk-row[data-id="${blkId}"]`);
  if(row){const nr=mkBkEl(blk); row.replaceWith(nr);}
  clearTimeout(S.saveTimer);
  if(flushSave()===false){ blk.fileId=prev; if(!prev){blk.fileName='';blk.fileType='';blk.fileSize=0} freeBlob(id); reRenderBlock(blkId); }
  else freeBlob(prev);
  S.pendingBlkId=null;
}
function downloadBlkFile(id){
  const blk=findBlock(id); if(!blk) return;
  saveStoredFile(blk.fileId, blk.fileData, blk.fileName, blk.fileType);
}
/* Shared by file blocks + file properties: resolve the stored bytes (IndexedDB blob
   ref, or a legacy inline data URL) to a Blob and hand it to the platform bridge,
   which downloads it in a browser or opens a native Save dialog on desktop. */
async function saveStoredFile(ref, legacyDataUrl, name, type){
  let blob=null;
  try{
    if(isBlobRef(ref)) blob=await IDB.get(ref);
    else if(typeof legacyDataUrl==='string'&&legacyDataUrl.startsWith('data:')) blob=dataURLtoBlob(legacyDataUrl);
  }catch(e){ blob=null; }
  if(!blob){ if(typeof toast==='function') toast('That file is no longer available'); return; }
  if(type&&!blob.type) blob=new Blob([blob],{type});
  try{ await saveFileToDisk(blob, name||'file'); }
  catch(e){ console.warn('[file] save failed',e); if(typeof toast==='function') toast('Could not save the file'); }
}

/* ═══════════════════════════════════════════════
   FILE PROPERTY HANDLERS
═══════════════════════════════════════════════ */
function triggerPropFileUpload(propId){
  S.pendingPropId=propId;
  document.getElementById('prop-file-input').value='';
  document.getElementById('prop-file-input').click();
}
async function onPropFileChange(input){
  const file=input.files[0]; if(!file||!S.pendingPropId) return;
  if(!withinUploadLimit(file,'File')){ input.value=''; return; }
  const propId=S.pendingPropId;
  const prop=S.props.find(p=>p.id===propId); if(!prop){S.pendingPropId=null;return}
  const prevId=prop.value&&prop.value.id;
  const id=await storeBlob(file);
  prop.value={name:file.name,type:file.type,id,size:file.size};
  renderProps();
  clearTimeout(S.saveTimer);
  if(flushSave()===false){ prop.value=prevId?{name:prop.value.name}:null; freeBlob(id); renderProps(); }
  else freeBlob(prevId);
  if(S.editPropId===propId&&document.getElementById('prop-editor').classList.contains('open'))
    renderPropEditor(prop);
  S.pendingPropId=null;
}
function downloadPropFile(propId){
  const prop=S.props.find(p=>p.id===propId); if(!prop||!prop.value) return;
  saveStoredFile(prop.value.id, prop.value.data, prop.value.name, prop.value.type);
}
function clearPropFile(propId){
  const prop=S.props.find(p=>p.id===propId); if(!prop) return;
  if(prop.value&&prop.value.id) freeBlob(prop.value.id);
  prop.value=null; renderProps(); sched();
  if(S.editPropId===propId&&document.getElementById('prop-editor').classList.contains('open'))
    renderPropEditor(prop);
}

