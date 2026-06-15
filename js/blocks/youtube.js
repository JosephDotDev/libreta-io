/* ═══════════════════════════════════════════════
   #6 YOUTUBE BLOCK  (embed + bookmark via oEmbed)
═══════════════════════════════════════════════ */
function ytParseId(url){
  if(!url) return null;
  let m=url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/);
  if(m) return m[1];
  m=url.match(/[?&]v=([\w-]{11})/); if(m) return m[1];
  if(/^[\w-]{11}$/.test(url.trim())) return url.trim();
  return null;
}
function mkYoutubeHtml(blk){
  const id=ytParseId(blk.url);
  if(!id){
    return `<div class="bk-yt-empty">
      <div style="font-size:12px;color:var(--mu)">Paste a YouTube link to embed or bookmark</div>
      <div class="bk-yt-empty-row">
        <input id="yt-in-${blk.id}" placeholder="https://www.youtube.com/watch?v=…" onkeydown="if(event.key==='Enter')ytSetUrl('${blk.id}',this.value)">
        <button class="bk-grid-btn" onclick="ytSetUrl('${blk.id}',document.getElementById('yt-in-${blk.id}').value)">Add</button>
      </div></div>`;
  }
  const mode=blk.mode||'embed';
  if(mode==='embed'){
    // Click-to-play facade: the iframe is only loaded on a user gesture, which avoids the
    // referrer/origin handshake failures that surface as "Error 153".
    const thumb=`https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
    const watch=`https://www.youtube.com/watch?v=${id}`;
    // YouTube can't validate the referrer of a file:// page → inline play returns Error 153.
    const fileHint=location.protocol==='file:'?`<div class="bk-yt-filehint">Opened as a local file — inline playback may show “Error 153”. <a href="${watch}" target="_blank">Open on YouTube ↗</a>, or run the app from a local server.</div>`:'';
    return `<div class="bk-yt-embed bk-yt-facade" style="background-image:url('${thumb}')" onclick="ytPlay(this,'${id}')" title="Click to play"><div class="bk-yt-play"><span>▶</span></div><a class="bk-yt-ext" href="${watch}" target="_blank" onclick="event.stopPropagation()" title="Open on YouTube">↗ YouTube</a></div>${fileHint}`;
  }
  // mqdefault is true 16:9 (no baked-in black bars, unlike hqdefault)
  const thumb=`https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  const title=blk.meta?.title||'YouTube video';
  const chan=blk.meta?.author||'';
  const watch=`https://www.youtube.com/watch?v=${id}`;
  return `<div class="bk-yt-card">
    <div class="bk-yt-thumb" onclick="window.open('${watch}','_blank')"><img src="${thumb}" alt=""><div class="bk-yt-play"><span>▶</span></div></div>
    <div class="bk-yt-info">
      <div class="bk-yt-title" onclick="window.open('${watch}','_blank')" style="cursor:pointer">${escHtml(title)}</div>
      ${chan?`<div class="bk-yt-chan">${escHtml(chan)}</div>`:''}
      <textarea class="bk-yt-desc" placeholder="Add a description…" oninput="ytSetDesc('${blk.id}',this.value)">${escHtml(blk.desc||'')}</textarea>
      <div class="bk-yt-host">youtube.com</div>
    </div></div>`;
}
function ytSetUrl(id,url){
  const b=findBlock(id); if(!b) return;
  const vid=ytParseId(url);
  if(!vid){alert('Could not find a YouTube video ID in that link.');return}
  b.url=url; b.mode=b.mode||'embed';
  reRenderBlock(id); sched();
  ytFetchMeta(id,vid);
}
function ytFetchMeta(blkId,vid){
  fetch('https://www.youtube.com/oembed?format=json&url='+encodeURIComponent('https://www.youtube.com/watch?v='+vid))
    .then(r=>r.ok?r.json():null).then(d=>{
      if(!d) return;
      const b=findBlock(blkId); if(!b) return;
      b.meta={title:d.title,author:d.author_name,thumb:d.thumbnail_url};
      if(b.mode==='bookmark') reRenderBlock(blkId);
      sched();
    }).catch(()=>{});
}
function ytSetMode(id,mode){
  const b=findBlock(id); if(!b) return;
  b.mode=mode; reRenderBlock(id); sched();
  if(mode==='bookmark'&&!b.meta){const vid=ytParseId(b.url);if(vid)ytFetchMeta(id,vid)}
}
function ytSetDesc(id,val){const b=findBlock(id);if(!b)return;b.desc=val;sched()}
function ytClear(id){const b=findBlock(id);if(!b)return;b.url='';b.meta=null;reRenderBlock(id);sched()}

/* ── TO-DO + TOGGLE block interactions ── */
function toggleTodo(id){
  const b=findBlock(id); if(!b) return;
  b.checked=!b.checked;
  const row=document.querySelector(`.bk-row[data-id="${id}"]`);
  if(row){ const todo=row.querySelector('.bk-todo'), chk=row.querySelector('.bk-todo-check');
    if(todo) todo.classList.toggle('done',b.checked);
    if(chk){chk.classList.toggle('on',b.checked);chk.textContent=b.checked?'✓':'';} }
  sched();
}
function toggleToggle(id){
  const b=findBlock(id); if(!b) return;
  b.collapsed=!b.collapsed;
  const row=document.querySelector(`.bk-row[data-id="${id}"]`);
  if(row){ const arrow=row.querySelector('.bk-toggle-arrow'), body=row.querySelector('.bk-toggle-body');
    if(arrow) arrow.classList.toggle('collapsed',b.collapsed);
    if(body) body.style.display=b.collapsed?'none':''; }
  sched();
}
function toggleSetSize(id,size){
  const b=findBlock(id); if(!b||b.type!=='toggle') return;
  if(size) b.hsize=size; else delete b.hsize;
  const head=document.querySelector(`.bk-row[data-id="${id}"] .bk-toggle-head .bk`);
  if(head){ if(size) head.setAttribute('data-hsize',size); else head.removeAttribute('data-hsize'); }
  sched();
}

/* ── INLINE FORMATTING (selection toolbar + shortcuts) ── */
function getSelectionBk(){
  const s=window.getSelection(); if(!s||!s.rangeCount) return null;
  let n=s.getRangeAt(0).commonAncestorContainer;
  if(n.nodeType===3) n=n.parentElement;
  return n?n.closest('.bk[contenteditable]'):null;
}
function fmtCmd(cmd){
  const el=getSelectionBk(); if(!el) return;
  document.execCommand(cmd,false,null);
  saveBlk(el.dataset.id, el.innerHTML);
  updateSelToolbarState();
}
function fmtInlineCode(){
  const s=window.getSelection(); if(!s||!s.rangeCount||s.isCollapsed) return;
  const el=getSelectionBk(); if(!el) return;
  const txt=s.toString();
  document.execCommand('insertHTML',false,`<code>${escHtml(txt)}</code>`);
  saveBlk(el.dataset.id, el.innerHTML);
}
/* Text color + highlight (background) for the current selection. */
const FMT_TEXT_COLORS=[{l:'Default',c:'__tx__'},{l:'Gray',c:'#9A9389'},{l:'Brown',c:'#A6794D'},{l:'Orange',c:'#C47D32'},{l:'Yellow',c:'#C9A84C'},{l:'Green',c:'#4E9E72'},{l:'Teal',c:'#5E9BAA'},{l:'Blue',c:'#4E7EC4'},{l:'Purple',c:'#7E6FBE'},{l:'Pink',c:'#C454B4'},{l:'Red',c:'#C45454'}];
const FMT_HL_COLORS=[{l:'None',c:'__none__'},{l:'Gray',c:'rgba(154,147,137,.30)'},{l:'Brown',c:'rgba(166,121,77,.30)'},{l:'Orange',c:'rgba(196,125,50,.32)'},{l:'Yellow',c:'rgba(201,168,76,.32)'},{l:'Green',c:'rgba(78,158,114,.30)'},{l:'Teal',c:'rgba(94,155,170,.30)'},{l:'Blue',c:'rgba(78,126,196,.32)'},{l:'Purple',c:'rgba(126,111,190,.32)'},{l:'Pink',c:'rgba(196,84,180,.30)'},{l:'Red',c:'rgba(196,84,84,.32)'}];
function fmtColorOpen(e){
  e&&e.stopPropagation&&e.stopPropagation();
  const pop=document.getElementById('fmt-color-pop');
  pop.innerHTML=`<div class="fcp-sec">Text</div><div class="fcp-row">${FMT_TEXT_COLORS.map(o=>`<button class="fcp-sw" onmousedown="event.preventDefault()" onclick="fmtSetColor('text','${o.c}')" title="${o.l}" style="color:${o.c==='__tx__'?'var(--tx)':o.c}">A</button>`).join('')}</div><div class="fcp-sec">Highlight</div><div class="fcp-row">${FMT_HL_COLORS.map(o=>`<button class="fcp-sw fcp-hl" onmousedown="event.preventDefault()" onclick="fmtSetColor('bg','${o.c}')" title="${o.l}" style="background:${o.c==='__none__'?'transparent':o.c}">${o.c==='__none__'?'⊘':'A'}</button>`).join('')}</div>`;
  pop.classList.add('open');
  const tb=document.getElementById('sel-toolbar'); const r=tb.getBoundingClientRect();
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  const vw=window.innerWidth/z;
  let left=r.left/z; if(left+200>vw) left=vw-200;
  pop.style.top=(r.bottom/z+4)+'px'; pop.style.left=Math.max(8,left)+'px';
}
function fmtColorClose(){document.getElementById('fmt-color-pop')?.classList.remove('open');}
function fmtSetColor(kind,color){
  const el=getSelectionBk(); if(!el){fmtColorClose();return;}
  if(kind==='text'){
    const c=color==='__tx__'?(getComputedStyle(document.documentElement).getPropertyValue('--tx').trim()||'#E4DDD0'):color;
    document.execCommand('styleWithCSS',false,true);
    document.execCommand('foreColor',false,c);
  } else {
    const c=color==='__none__'?'transparent':color;
    document.execCommand('styleWithCSS',false,true);
    if(!document.execCommand('hiliteColor',false,c)) document.execCommand('backColor',false,c);
  }
  saveBlk(el.dataset.id, el.innerHTML);
  fmtColorClose();
}
let _selTbT=null;
function refreshSelToolbar(){ clearTimeout(_selTbT); _selTbT=setTimeout(showSelToolbar,15); }
function showSelToolbar(){
  const tb=document.getElementById('sel-toolbar'); if(!tb) return;
  const s=window.getSelection();
  if(!s||s.isCollapsed||!s.rangeCount){ tb.classList.remove('open'); fmtColorClose(); return; }
  const bk=getSelectionBk(); if(!bk){ tb.classList.remove('open'); fmtColorClose(); return; }
  const r=s.getRangeAt(0).getBoundingClientRect();
  if(!r.width&&!r.height){ tb.classList.remove('open'); return; }
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  tb.classList.add('open');
  let top=r.top/z-tb.offsetHeight-8; if(top<6) top=r.bottom/z+8;
  tb.style.top=top+'px';
  tb.style.left=Math.max(60,(r.left+r.width/2)/z)+'px';
  updateSelToolbarState();
}
function updateSelToolbarState(){
  ['bold','italic','underline','strikeThrough'].forEach(c=>{
    const b=document.querySelector(`#sel-toolbar [data-cmd="${c}"]`);
    if(b){ try{b.classList.toggle('on',document.queryCommandState(c))}catch(e){} }
  });
}
document.addEventListener('selectionchange',refreshSelToolbar);
document.addEventListener('scroll',()=>{document.getElementById('sel-toolbar')?.classList.remove('open');fmtColorClose();},true);
/* Load the actual player on click. Only pass `origin` on http(s) — a file:// origin is invalid
   and is itself a cause of YouTube "Error 153". */
function ytPlay(el,id){
  // From file:// the browser sends no referrer and YouTube can't embed → open on YouTube instead.
  if(location.protocol==='file:'){ window.open('https://www.youtube.com/watch?v='+id,'_blank'); return; }
  // Vanilla youtube.com embed (most compatible — no origin/nocookie params that can trigger 153).
  el.classList.remove('bk-yt-facade'); el.style.backgroundImage='';
  el.innerHTML=`<iframe src="https://www.youtube.com/embed/${id}?rel=0&autoplay=1&playsinline=1" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;web-share" allowfullscreen></iframe>`;
}

