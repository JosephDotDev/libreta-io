/* ═══════════════════════════════════════════════
   #6 CALLOUT  (quote already exists as a block type)
═══════════════════════════════════════════════ */
function calloutIconInner(ico){
  ico=ico||'💡';
  if(isBlobRef(ico)||(typeof ico==='string'&&(ico.startsWith('data:')||ico.startsWith('http')))) return `<img class="bk-callout-img" src="${srcFor(ico)}" alt="">`;
  return ico; // emoji rendered raw so it inherits the button's text metrics (aligns with the note)
}
function openCalloutIconPicker(e,anchor,blkId){
  openIconPicker(e,anchor,(v)=>{
    const b=findBlock(blkId); if(b){ if(isBlobRef(b.icon)&&b.icon!==v) freeBlob(b.icon); b.icon=v||'💡'; reRenderBlock(blkId); sched(); }
    closeAll();
  });
}

/* ═══════════════════════════════════════════════
   #4 NESTED PAGE BLOCK  (a link to a child document)
═══════════════════════════════════════════════ */
function mkPageLinkHtml(blk){
  const child=blk.pageId?DB.getDoc(blk.pageId):null;
  if(!child) return `<div class="bk-page bk-page-missing"><span class="bk-page-ico">📄</span><span style="color:var(--mu)">Page not found</span></div>`;
  // Card display — a preview tile (cover + icon + title + excerpt), toggled from the block menu.
  if(blk.display==='card'){
    const pos=child.meta?.coverPos!=null?child.meta.coverPos:50;
    const cover=child.meta?.cover?`<div class="bk-page-card-cover" style="${coverThumbBg(child.meta.cover,pos)}"></div>`:'';
    const ico=child.meta?.icon?iconHtml(child.meta.icon,'20px'):'📄';
    const exc=(child.blocks||[]).filter(b=>!['divider','database','image','file','carousel'].includes(b.type))
      .map(b=>(b.content||'').replace(/<[^>]+>/g,'')).join(' ').replace(/\s+/g,' ').slice(0,120).trim();
    return `<div class="bk-page-card${cover?' has-cover':''}" onclick="nav('editor','${blk.pageId}')">
      ${cover}
      <div class="bk-page-card-body">
        <div class="bk-page-card-title"><span class="bk-page-ico">${ico}</span>${escHtml(child.title||'Untitled')}</div>
        <div class="bk-page-card-exc">${exc?escHtml(exc):'<span style="opacity:.4">Empty page</span>'}</div>
      </div></div>`;
  }
  const ico=child.meta?.icon?iconHtml(child.meta.icon,'18px'):'📄';
  return `<div class="bk-page" onclick="nav('editor','${blk.pageId}')"><span class="bk-page-ico">${ico}</span><span class="bk-page-title">${escHtml(child.title||'Untitled')}</span><span class="bk-page-arrow">&#8599;</span></div>`;
}
/* Toggle a linked-page block between the inline link and the preview card. */
function setPageDisplay(id,mode){ const b=findBlock(id); if(!b) return; b.display=mode; reRenderBlock(id); sched(); }

/* ═══════════════════════════════════════════════
   #3 FORMATTED LINKS ("mentions") — inline chip with favicon, site (grey) + title (white)
═══════════════════════════════════════════════ */
const mentionCache=new Map(); const _mentionFetching=new Set();
function isUrl(s){s=(s||'').trim();return /^https?:\/\/\S+$/i.test(s)||/^www\.[^\s]+\.[^\s]+$/i.test(s)}
function normUrl(u){u=(u||'').trim();return /^https?:\/\//i.test(u)?u:'https://'+u}
function hostOf(u){try{return new URL(normUrl(u)).hostname.replace(/^www\./,'')}catch{return ''}}
function faviconFor(host){return host?`https://www.google.com/s2/favicons?sz=64&domain=${host}`:''}
function decodeEntities(s){const t=document.createElement('textarea');t.innerHTML=s;return t.value}
function mentionHtml(m,mid){
  const fav=m.favicon?`<img class="mention-fav" src="${escHtml(m.favicon)}" alt="">`:'';
  const site=m.site?`<span class="mention-site">${escHtml(m.site)}</span>`:'';
  const safe=safeUrl(m.url);
  return `<a class="mention" data-mid="${mid||''}" data-url="${escHtml(safe)}" contenteditable="false" href="${escHtml(safe)}" target="_blank" rel="noopener" onclick="event.preventDefault();if(this.getAttribute('href')!=='#')window.open(this.href,'_blank')">${fav}${site}<span class="mention-title">${escHtml(m.title||m.url)}</span></a>`;
}
function quickMeta(url){
  const u=normUrl(url),h=hostOf(u);
  // For YouTube URLs, avoid showing "youtube.com" as both site and title by
  // extracting the handle/channel name from the path as the placeholder title.
  if(/youtube\.com|youtu\.be/.test(h)){
    const handle=u.match(/\/@([^/?&#]+)/)?.[1];
    return{url:u,title:handle?('@'+handle):'YouTube',site:'YouTube',favicon:faviconFor(h)};
  }
  return{url:u,title:h||u,site:h,favicon:faviconFor(h)};
}
/* Pasting a bare URL becomes a formatted mention; multi-line text becomes one
   block per line (like Notion — handy for notes pasted with Shift+Enter line
   breaks); a single line stays inline. */
function onBlockPaste(e,el){
  const text=e.clipboardData.getData('text/plain');
  const trimmed=(text||'').trim();
  if(isUrl(trimmed) && !/\r?\n/.test(trimmed)){ e.preventDefault(); insertMention(el,trimmed); return; }
  e.preventDefault();
  const lines=(text||'').split(/\r?\n/).map(l=>l.replace(/\s+$/,'')).filter(l=>l.trim().length);
  if(lines.length>1){ pasteLinesAsBlocks(el,lines); return; }
  document.execCommand('insertText',false,text);
}
/* First line goes into the current block at the caret; the rest become sibling
   paragraph blocks right after it. */
function pasteLinesAsBlocks(el,lines){
  const id=el.dataset.id;
  document.execCommand('insertText',false,lines[0]);
  saveBlk(id,el.innerHTML);
  const rest=lines.slice(1); if(!rest.length) return;
  const loc=locate(id); if(!loc) return;
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const newBlocks=rest.map(line=>mkBlock('paragraph',esc(line)));
  loc.arr.splice(loc.idx+1,0,...newBlocks);
  let after=el.closest('.bk-row');
  newBlocks.forEach(b=>{ const r=mkBkEl(b); after.after(r); after=r; });
  updNums(); sched();
  const last=newBlocks[newBlocks.length-1];
  const lastEl=document.querySelector(`.bk[data-id="${last.id}"]`); if(lastEl){ lastEl.focus(); putCursorEnd(lastEl); }
}
async function fetchLinkMeta(url){
  const u=normUrl(url), host=hostOf(u);
  const favicon=faviconFor(host);
  const vid=ytParseId(u);
  if(vid){ try{const r=await fetch('https://www.youtube.com/oembed?format=json&url='+encodeURIComponent('https://www.youtube.com/watch?v='+vid));if(r.ok){const d=await r.json();return{url:u,title:d.title,site:d.author_name||'YouTube',favicon}}}catch{} }
  // YouTube channel / user / playlist URL — extract handle from path rather than
  // showing "YouTube.com" as both site and title.
  if(/youtube\.com|youtu\.be/.test(host)){
    const handle=u.match(/\/@([^/?&#]+)/)?.[1]||u.match(/\/c\/([^/?&#]+)/)?.[1]||u.match(/\/user\/([^/?&#]+)/)?.[1]||u.match(/\/channel\/([^/?&#]+)/)?.[1];
    return{url:u,title:handle?('@'+handle):'YouTube',site:'YouTube',favicon};
  }
  try{
    const r=await fetch('https://api.allorigins.win/get?url='+encodeURIComponent(u));
    if(r.ok){const j=await r.json();const html=j.contents||'';
      const og=html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
      const tt=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const ogs=html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
      const title=((og&&og[1])||(tt&&tt[1])||host||u).trim();
      return{url:u,title:decodeEntities(title),site:(ogs&&ogs[1])||host,favicon};
    }
  }catch{}
  return {url:u,title:host||u,site:host,favicon};
}
/* Insert a mention at the caret of an editable block, then enrich it asynchronously */
function insertMention(el,url){
  const mid='m_'+uuid();
  document.execCommand('insertHTML',false,mentionHtml(quickMeta(url),mid)+' ');
  // execCommand('insertHTML') strips contenteditable="false" in some browsers,
  // turning the link into editable text instead of a clickable chip — re-apply it.
  const ins=el.querySelector(`.mention[data-mid="${mid}"]`);
  if(ins) ins.setAttribute('contenteditable','false');
  const id=el.dataset.id; saveBlk(id,el.innerHTML);
  fetchLinkMeta(url).then(m=>{
    mentionCache.set(normUrl(url),m);
    const node=el.querySelector(`.mention[data-mid="${mid}"]`);
    if(node){ node.outerHTML=mentionHtml(m,mid); saveBlk(id,el.innerHTML); }
  });
}
/* For table cells (re-rendered often): render from cache, fetch once, then re-render the table */
function tblMentionHtml(url){
  const key=normUrl(url); const cached=mentionCache.get(key);
  if(cached) return mentionHtml(cached);
  if(!_mentionFetching.has(key)){ _mentionFetching.add(key); fetchLinkMeta(key).then(m=>{mentionCache.set(key,m);_mentionFetching.delete(key);if(S.view==='tables')renderTbl(DB.getTbl(S.tblId))}); }
  return mentionHtml(quickMeta(key));
}
/* Small popover to paste a URL (used by the /link slash command and table link cells) */
function promptUrl(rect,cb){
  const pop=document.getElementById('link-pop');
  pop.innerHTML=`<input id="link-pop-in" placeholder="Paste a link…" spellcheck="false">
    <button onclick="(function(){var v=document.getElementById('link-pop-in').value;closeAll();_linkPopCb&&_linkPopCb(v)})()">Add</button>`;
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  pop.style.top=(rect.bottom/z+6)+'px'; pop.style.left=Math.min(rect.left/z,window.innerWidth/z-280)+'px';
  pop.classList.add('open'); openOvl();
  _linkPopCb=cb;
  setTimeout(()=>{const i=document.getElementById('link-pop-in');if(i){i.focus();i.addEventListener('keydown',e=>{if(e.key==='Enter'){const v=i.value;closeAll();cb&&cb(v)}})}},20);
}
let _linkPopCb=null;

