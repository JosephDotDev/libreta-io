/* ═══════════════════════════════════════════════
   BLOCK RENDERING
═══════════════════════════════════════════════ */
function renderBlocks(ctId){
  const ct=document.getElementById(ctId||'blocks-ct');
  if(!ct) return;
  ct.innerHTML='';
  S.blocks.forEach(b=>ct.appendChild(mkBkEl(b)));
  updNums();
}
function mkBkEl(blk){
  const row=document.createElement('div');
  row.className='bk-row'; row.dataset.id=blk.id; row.dataset.type=blk.type;
  row.draggable=false; // dragging is handled by a reliable pointer-based grip (native DnD is flaky over contenteditable)

  const gutter=`<div class="bk-gut"><button class="gb drag" onmousedown="bkGripDown(event,'${blk.id}')" onclick="onGripClick(event,'${blk.id}')" data-tip="Drag to move · Click for options">⠿</button></div>`;

  if(blk.type==='divider'){
    row.innerHTML=gutter+`<div class="bk-wrap"><hr class="bk-div"></div>`;
  } else if(blk.type==='database'){
    row.innerHTML=gutter+`<div class="bk-wrap">${mkDbBlockHtml(blk)}</div>`;
  } else if(blk.type==='columns'){
    row.innerHTML=gutter+`<div class="bk-wrap"></div>`;
    const wrap=row.querySelector('.bk-wrap');
    const cont=document.createElement('div'); cont.className='bk-cols'; cont.dataset.colsId=blk.id;
    (blk.cols||[]).forEach((col,ci)=>{
      if(ci>0){const rz=document.createElement('div');rz.className='bk-col-rz';rz.addEventListener('mousedown',e=>colResizeStart(e,blk.id,ci));cont.appendChild(rz)}
      const colEl=document.createElement('div'); colEl.className='bk-col'; colEl.dataset.colsId=blk.id; colEl.dataset.colIdx=ci;
      colEl.style.flex=((blk.widths&&blk.widths[ci])||1)+' 1 0';
      col.forEach(child=>colEl.appendChild(mkBkEl(child)));
      cont.appendChild(colEl);
    });
    wrap.appendChild(cont);
  } else if(blk.type==='carousel'){
    row.innerHTML=gutter+`<div class="bk-wrap">${mkCarouselHtml(blk)}</div>`;
  } else if(blk.type==='grid'){
    row.innerHTML=gutter+`<div class="bk-wrap">${mkGridHtml(blk)}</div>`;
  } else if(blk.type==='youtube'){
    row.innerHTML=gutter+`<div class="bk-wrap">${mkYoutubeHtml(blk)}</div>`;
  } else if(blk.type==='page'){
    row.innerHTML=gutter+`<div class="bk-wrap">${mkPageLinkHtml(blk)}</div>`;
  } else if(blk.type==='callout'){
    // An explicitly-removed icon is '' / null; an untouched callout defaults to 💡.
    const hasIco=blk.icon!==''&&blk.icon!=null;
    const icoBtn=`<button class="bk-callout-ico${hasIco?'':' bk-callout-ico-empty'}" onclick="openCalloutIconPicker(event,this,'${blk.id}')" title="${hasIco?'Change or remove icon':'Add an icon'}">${hasIco?calloutIconInner(blk.icon):'+'}</button>`;
    row.innerHTML=gutter+`<div class="bk-wrap"><div class="bk-callout${hasIco?'':' no-ico'}">${icoBtn}<div class="bk" contenteditable="true" data-t="callout" data-id="${blk.id}" data-ph="Type a note…" spellcheck="true">${blk.content}</div></div></div>`;
    const el=row.querySelector('.bk');
    el.addEventListener('keydown',e=>onBkKey(e,el));
    el.addEventListener('input',  e=>onBkInput(e,el));
    el.addEventListener('paste',  e=>onBlockPaste(e,el));
    el.addEventListener('focus',  ()=>S.activeId=blk.id);
  } else if(blk.type==='todo'){
    row.innerHTML=gutter+`<div class="bk-wrap"><div class="bk-todo${blk.checked?' done':''}"><button class="bk-todo-check${blk.checked?' on':''}" onclick="toggleTodo('${blk.id}')">${blk.checked?'✓':''}</button><div class="bk" contenteditable="true" data-t="todo" data-id="${blk.id}" data-ph="To-do" spellcheck="true">${blk.content}</div></div></div>`;
    const el=row.querySelector('.bk');
    el.addEventListener('keydown',e=>onBkKey(e,el));
    el.addEventListener('input',  e=>onBkInput(e,el));
    el.addEventListener('paste',  e=>onBlockPaste(e,el));
    el.addEventListener('focus',  ()=>S.activeId=blk.id);
  } else if(blk.type==='toggle'){
    row.innerHTML=gutter+`<div class="bk-wrap"></div>`;
    const wrap=row.querySelector('.bk-wrap');
    const head=document.createElement('div'); head.className='bk-toggle-head';
    head.innerHTML=`<button class="bk-toggle-arrow${blk.collapsed?' collapsed':''}" onclick="toggleToggle('${blk.id}')" title="Show/hide">&#9662;</button><div class="bk" contenteditable="true" data-t="toggle"${blk.hsize?` data-hsize="${blk.hsize}"`:''} data-id="${blk.id}" data-ph="Toggle" spellcheck="true">${blk.content}</div>`;
    wrap.appendChild(head);
    const headEl=head.querySelector('.bk');
    headEl.addEventListener('keydown',e=>onBkKey(e,headEl));
    headEl.addEventListener('input',  e=>onBkInput(e,headEl));
    headEl.addEventListener('paste',  e=>onBlockPaste(e,headEl));
    headEl.addEventListener('focus',  ()=>S.activeId=blk.id);
    const body=document.createElement('div'); body.className='bk-toggle-body'; body.dataset.toggleId=blk.id;
    if(blk.collapsed) body.style.display='none';
    (blk.children||[]).forEach(child=>body.appendChild(mkBkEl(child)));
    wrap.appendChild(body);
  } else if(blk.type==='image'){
    if(blk.src){
      const capHtml=blk.hideCaption?'':`<input class="bk-img-cap" placeholder="Add a caption…" value="${(blk.caption||'').replace(/"/g,'&quot;')}" oninput="saveBlkExtra('${blk.id}','caption',this.value)">`;
      // Drag either side handle to resize; width persists on blk.w (px, capped to the column).
      const wStyle=blk.w?` style="width:${blk.w}px"`:'';
      const handles=`<span class="bk-img-rz bk-img-rz-l" onmousedown="imgResizeStart(event,'${blk.id}',-1)" title="Drag to resize"></span><span class="bk-img-rz bk-img-rz-r" onmousedown="imgResizeStart(event,'${blk.id}',1)" title="Drag to resize"></span>`;
      row.innerHTML=gutter+`<div class="bk-wrap"><div class="bk-img-wrap"${wStyle}><img src="${srcFor(blk.src)}" alt="${blk.caption||''}" onclick="event.stopPropagation();openImgLightbox(this.src,{editable:false})" style="cursor:zoom-in">${handles}<div class="bk-img-overlay"><button class="bk-img-btn" onclick="toggleImgCaption('${blk.id}')">${blk.hideCaption?'Show caption':'Hide caption'}</button><button class="bk-img-btn" onclick="replaceBlkImg('${blk.id}')">Replace</button><button class="bk-img-btn" onclick="delBlk('${blk.id}')">Remove</button></div></div>${capHtml}</div>`;
    } else {
      row.innerHTML=gutter+`<div class="bk-wrap"><div class="bk-img-empty"><span style="font-size:32px">🖼</span><div class="bk-img-acts"><button class="bk-img-act" onclick="openBlkImgInput('${blk.id}')">Upload</button><button class="bk-img-act" onclick="blkImgFromUrl(event,'${blk.id}')">From URL</button></div></div></div>`;
    }
  } else if(blk.type==='file'){
    if(blk.fileName){
      const fIco=getFileIcon(blk.fileType);
      row.innerHTML=gutter+`<div class="bk-wrap"><div class="bk-file-card" onclick="downloadBlkFile('${blk.id}')"><span class="bk-file-ico">${fIco}</span><div class="bk-file-info"><div class="bk-file-nm">${escHtml(blk.fileName)}</div><div class="bk-file-sz">${formatFileSize(blk.fileSize)}</div></div><span class="bk-file-dl">↓ Download</span></div></div>`;
    } else {
      row.innerHTML=gutter+`<div class="bk-wrap"><div class="bk-file-empty" onclick="openBlkFileInput('${blk.id}')"><span style="font-size:22px">📎</span><span>Click to upload a file</span></div></div>`;
    }
  } else if(blk.type==='math'){
    row.innerHTML=gutter+`<div class="bk-wrap"><div class="bk-math-wrap" data-id="${blk.id}"><div class="bk-math" data-id="${blk.id}" onclick="mathEdit('${blk.id}')"></div><textarea class="bk-math-src" data-id="${blk.id}" spellcheck="false" placeholder="LaTeX — e.g. E = mc^2   or   \\int_0^\\infty e^{-x}\\,dx" oninput="mathOnInput('${blk.id}',this.value)" onblur="mathBlur('${blk.id}')" style="display:none">${escHtml(blk.content||'')}</textarea></div></div>`;
    if(typeof renderMathInto==='function') renderMathInto(row.querySelector('.bk-math'), blk.content);
  } else if(blk.type==='bookmark'){
    row.innerHTML=gutter+`<div class="bk-wrap">${mkBookmarkHtml(blk)}</div>`;
    if(blk.url && !(blk.meta&&blk.meta.title) && typeof bookmarkEnsureMeta==='function') bookmarkEnsureMeta(blk.id);
  } else {
    row.innerHTML=gutter+`<div class="bk-wrap"><div class="bk" contenteditable="true" data-t="${blk.type}" data-id="${blk.id}" data-ph="${PH[blk.type]||''}" spellcheck="true">${blk.content}</div></div>`;
    const el=row.querySelector('.bk');
    el.addEventListener('keydown',e=>onBkKey(e,el));
    el.addEventListener('input',  e=>onBkInput(e,el));
    el.addEventListener('paste',  e=>onBlockPaste(e,el));
    el.addEventListener('focus',  ()=>S.activeId=blk.id);
  }
  // Block colour coding — text colour and/or a soft background tint, derived from
  // the stored base colour via CSS in 06-blocks (color-mix on --bk-bg).
  if(blk.color){ row.classList.add('bk-colored'); row.style.setProperty('--bk-text',blk.color); }
  if(blk.bg){ row.classList.add('bk-bged'); row.style.setProperty('--bk-bg',blk.bg); }
  row.addEventListener('dragstart',e=>onDragStart(e,blk.id));
  row.addEventListener('dragover', e=>onDragOver(e,blk.id));
  row.addEventListener('dragleave',e=>{e.currentTarget.classList.remove('dz-left','dz-right','dz-top','dz-bottom','drag-over')});
  row.addEventListener('drop',     e=>onDrop(e,blk.id));
  row.addEventListener('dragend',  ()=>{clearDropZones();S.dragId=null});
  return row;
}
function alphaLabel(num){ let s=''; while(num>0){num--; s=String.fromCharCode(97+(num%26))+s; num=Math.floor(num/26);} return s; }
function updNums(){
  let n=0,a=0;
  document.querySelectorAll('.bk').forEach(el=>{
    const t=el.dataset.t;
    if(t==='numbered'){el.dataset.n=String(++n);a=0;}
    else if(t==='alpha'){el.dataset.n=alphaLabel(++a);n=0;}
    else {n=0;a=0;}
  });
}

