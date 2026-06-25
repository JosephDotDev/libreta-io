/* ═══════════════════════════════════════════════
   #6 CALLOUT  (quote already exists as a block type)
═══════════════════════════════════════════════ */
function calloutIconInner(ico){
  ico=ico||'💡';
  if(isLineIcon(ico)){ const p=parseLineIcon(ico); return lineIconSvg(p.name,p.color,'1em'); }
  if(isBlobRef(ico)||(typeof ico==='string'&&(ico.startsWith('data:')||ico.startsWith('http')))) return `<img class="bk-callout-img" src="${srcFor(ico)}" alt="">`;
  return ico; // emoji rendered raw so it inherits the button's text metrics (aligns with the note)
}
function openCalloutIconPicker(e,anchor,blkId){
  openIconPicker(e,anchor,(v)=>{
    // v==='' means "Remove icon" — keep it empty (don't snap back to the default 💡).
    const b=findBlock(blkId); if(b){ if(isBlobRef(b.icon)&&b.icon!==v) freeBlob(b.icon); b.icon=v||''; reRenderBlock(blkId); sched(); }
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
  return `<div class="bk-page" data-page-id="${blk.pageId}" onclick="nav('editor','${blk.pageId}')"><span class="bk-page-ico">${ico}</span><span class="bk-page-title">${escHtml(child.title||'Untitled')}</span><span class="bk-page-arrow">&#8599;</span></div>`;
}
/* Toggle a linked-page block between the inline link and the preview card. */
function setPageDisplay(id,mode){ const b=findBlock(id); if(!b) return; b.display=mode; reRenderBlock(id); sched(); }

/* ═══════════════════════════════════════════════
   WEB BOOKMARK — show an external link as a rich card (favicon, title, site,
   description + og:image thumbnail). Metadata is fetched once and cached on the
   block so the card survives reloads/offline; the rest reuses the mention pipeline.
═══════════════════════════════════════════════ */
const _bmFetching=new Set();
function mkBookmarkHtml(blk){
  if(!blk.url) return `<div class="bk-bookmark bk-bm-empty" onclick="bookmarkEdit('${blk.id}')"><span class="bk-bm-ico">🔖</span><span>Add a link to bookmark…</span></div>`;
  const u=normUrl(blk.url), host=hostOf(u);
  const m=blk.meta||mentionCache.get(u)||quickMeta(u);
  const fav=m.favicon?`<img class="bk-bm-fav" src="${escHtml(m.favicon)}" alt="" onerror="this.style.display='none'">`:'';
  const thumb=m.image?`<div class="bk-bm-thumb"><img src="${escHtml(m.image)}" alt="" onerror="this.closest('.bk-bm-thumb').style.display='none'"></div>`:'';
  const desc=m.desc?`<div class="bk-bm-desc">${escHtml(m.desc)}</div>`:'';
  const safe=safeUrl(u);
  return `<a class="bk-bookmark${m.image?' has-thumb':''}" href="${escHtml(safe)}" target="_blank" rel="noopener" data-url="${escHtml(u)}" onclick="event.preventDefault();if(this.getAttribute('href')!=='#')window.open(this.href,'_blank')">
    <div class="bk-bm-info">
      <div class="bk-bm-title">${escHtml(m.title||u)}</div>
      ${desc}
      <div class="bk-bm-host">${fav}<span class="bk-bm-site">${escHtml(m.site||host)}</span></div>
    </div>${thumb}</a>`;
}
/* Fetch + cache metadata once, then re-render so the card fills in. */
function bookmarkEnsureMeta(blkId){
  const blk=findBlock(blkId); if(!blk||!blk.url||(blk.meta&&blk.meta.title)) return;
  const u=normUrl(blk.url);
  if(mentionCache.has(u)){ blk.meta=mentionCache.get(u); reRenderBlock(blkId); sched(); return; }
  if(_bmFetching.has(u)) return; _bmFetching.add(u);
  fetchLinkMeta(blk.url).then(m=>{ _bmFetching.delete(u); mentionCache.set(u,m);
    const b=findBlock(blkId); if(b){ b.meta=m; reRenderBlock(blkId); sched(); } })
    .catch(()=>_bmFetching.delete(u));
}
function bookmarkEdit(blkId){
  const row=document.querySelector(`.bk-row[data-id="${blkId}"]`);
  promptUrl(row?row.getBoundingClientRect():{bottom:140,left:140},(url)=>{
    if(!url) return; const b=findBlock(blkId); if(!b) return;
    b.url=normUrl(url); b.meta=null; reRenderBlock(blkId); bookmarkEnsureMeta(blkId); sched();
  });
}
/* Slash-menu entry point: prompt for a URL, then turn the caret block into a bookmark. */
function insertBookmarkBlock(sid){
  const el=document.querySelector('.bk[data-id="'+sid+'"]');
  promptUrl(el?el.getBoundingClientRect():{bottom:140,left:140},(url)=>{
    if(!url) return; const loc=locate(sid); if(!loc) return;
    loc.arr[loc.idx]={id:sid,type:'bookmark',content:'',url:normUrl(url)};
    if(typeof ensureTrailingParagraph==='function') ensureTrailingParagraph();
    rerender(); updNums(); bookmarkEnsureMeta(sid); sched();
  });
}

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
  // Markdown-aware paste: text copied from Notion/GitHub/etc. arrives as Markdown in
  // text/plain, so convert headings, lists, quotes, code, and inline bold/italic/links
  // into the matching blocks + tags. Falls back to the plain line-per-block behaviour.
  const md=parseMarkdownToBlocks(text);
  if(md && md.length){ insertParsedBlocks(el,md); return; }
  const lines=(text||'').split(/\r?\n/).map(l=>l.replace(/\s+$/,'')).filter(l=>l.trim().length);
  if(lines.length>1){ pasteLinesAsBlocks(el,lines); return; }
  document.execCommand('insertText',false,text);
}
/* ── MARKDOWN → blocks ──────────────────────────────────────────────────────────
   Conservative: only kicks in when the text actually carries a Markdown marker, so
   plain prose is never mangled. Returns null when nothing markdown-ish is present. */
function mdInline(s){
  let h=String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // [label](url) → safe link first, so its url isn't caught by * / _ emphasis rules.
  h=h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(m,t,u)=>{ const safe=(typeof safeUrl==='function')?safeUrl(u):u; return safe?`<a href="${safe.replace(/"/g,'&quot;')}">${t}</a>`:t; });
  h=h.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
     .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
     .replace(/__(.+?)__/g,'<strong>$1</strong>')
     .replace(/(?<![\*\w])\*([^*\n]+?)\*(?![\*\w])/g,'<em>$1</em>')
     .replace(/(?<![_\w])_([^_\n]+?)_(?![_\w])/g,'<em>$1</em>')
     .replace(/`([^`\n]+?)`/g,'<code>$1</code>')
     .replace(/~~(.+?)~~/g,'<del>$1</del>');
  return h;
}
const _MD_MARKER=/(^|\n)\s*(#{1,3}\s|>\s|[-*+]\s|\d+\.\s|```|---\s*$|\[[ xX]?\]\s)|\*\*|__|`[^`]+`|~~|\[[^\]]+\]\([^)]+\)/;
function parseMarkdownToBlocks(text){
  if(!text || !_MD_MARKER.test(text)) return null;
  const raw=text.replace(/\r\n?/g,'\n').split('\n');
  const blocks=[]; let i=0;
  const escCode=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  while(i<raw.length){
    const line=raw[i];
    const fence=line.match(/^```(\w*)\s*$/);
    if(fence){
      const code=[]; i++;
      while(i<raw.length && !/^```\s*$/.test(raw[i])){ code.push(raw[i]); i++; }
      i++; // consume the closing fence
      blocks.push({type:'code',content:escCode(code.join('\n'))});
      continue;
    }
    if(!line.trim()){ i++; continue; } // blank line = block separator
    let m;
    if(m=line.match(/^(#{1,3})\s+(.*)$/))                blocks.push({type:'h'+m[1].length,content:mdInline(m[2])});
    else if(m=line.match(/^>\s+(.*)$/))                  blocks.push({type:'quote',content:mdInline(m[1])});
    else if(m=line.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/))blocks.push({type:'todo',content:mdInline(m[2]),checked:/[xX]/.test(m[1])});
    else if(m=line.match(/^[-*+]\s+(.*)$/))              blocks.push({type:'bullet',content:mdInline(m[1])});
    else if(m=line.match(/^\d+\.\s+(.*)$/))              blocks.push({type:'numbered',content:mdInline(m[1])});
    else if(/^(---+|\*\*\*+|___+)\s*$/.test(line))       blocks.push({type:'divider',content:''});
    else                                                blocks.push({type:'paragraph',content:mdInline(line)});
    i++;
  }
  return blocks.length?blocks:null;
}
/* Place parsed blocks: a single inline-only paragraph is inserted at the caret (so
   pasting "**bold**" mid-sentence just formats inline); anything structural becomes
   real blocks — replacing the current block if it's empty, else inserted after it. */
function insertParsedBlocks(el,parsed){
  if(parsed.length===1 && parsed[0].type==='paragraph'){
    document.execCommand('insertHTML',false,parsed[0].content);
    saveBlk(el.dataset.id,el.innerHTML); return;
  }
  const id=el.dataset.id; const loc=locate(id);
  if(!loc){ document.execCommand('insertText',false,parsed.map(b=>(b.content||'').replace(/<[^>]+>/g,'')).join('\n')); return; }
  const made=parsed.map(b=>{ const nb=mkBlock(b.type,b.content||''); if(b.checked)nb.checked=true; return nb; });
  const cur=loc.arr[loc.idx];
  const curEmpty=cur.type==='paragraph' && !(cur.content||'').replace(/<[^>]+>/g,'').trim();
  let anchor=el.closest('.bk-row');
  if(curEmpty){
    loc.arr.splice(loc.idx,1,...made);
    const frag=document.createDocumentFragment(); made.forEach(b=>frag.appendChild(mkBkEl(b)));
    anchor.replaceWith(frag);
  } else {
    loc.arr.splice(loc.idx+1,0,...made);
    let after=anchor; made.forEach(b=>{ const r=mkBkEl(b); after.after(r); after=r; });
  }
  if(typeof updNums==='function') updNums();
  sched();
  const last=made[made.length-1];
  const lastEl=document.querySelector(`.bk[data-id="${last.id}"]`); if(lastEl){ lastEl.focus(); if(typeof putCursorEnd==='function') putCursorEnd(lastEl); }
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
/* Pull a page's HTML through a chain of public CORS proxies. Returns the first body
   that looks like a real document (has a <title> or og:title); falls back to the last
   non-empty body so we still get something for unusual pages. */
async function fetchHtmlViaProxies(u){
  const enc=encodeURIComponent(u);
  const proxies=[
    {url:'https://corsproxy.io/?url='+enc,           kind:'text'},
    {url:'https://api.codetabs.com/v1/proxy/?quest='+enc, kind:'text'},
    {url:'https://api.allorigins.win/raw?url='+enc,  kind:'text'},
    {url:'https://api.allorigins.win/get?url='+enc,  kind:'json'},
  ];
  const looksReal=h=>/<title[^>]*>[\s\S]*?<\/title>/i.test(h)||/og:title/i.test(h);
  let fallback='';
  for(const p of proxies){
    try{
      const r=await fetch(p.url); if(!r.ok) continue;
      let h; if(p.kind==='json'){ const j=await r.json(); h=j.contents||''; } else { h=await r.text(); }
      if(!h) continue;
      if(looksReal(h)) return h;
      if(!fallback) fallback=h;
    }catch(_){}
  }
  return fallback;
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
  // Fetch the page HTML through a CORS proxy. Public proxies are flaky and rate-limit,
  // so try several in order and keep the first response whose HTML actually carries a
  // <title>/og:title — a 200 with an empty or challenge body shouldn't end the chain
  // and leave us showing just the hostname.
  const html=await fetchHtmlViaProxies(u);
  if(html){
    // Match a <meta> by property/name regardless of attribute ORDER (content before or
    // after property) — the old single-order regex missed most real-world pages, so
    // titles fell back to the bare hostname.
    const metaProp=(prop)=>{
      const a=html.match(new RegExp('<meta[^>]+(?:property|name)=["\']'+prop+'["\'][^>]*content=["\']([^"\']+)["\']','i'));
      if(a) return a[1];
      const b=html.match(new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']'+prop+'["\']','i'));
      return b?b[1]:null;
    };
    const tt=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title=(metaProp('og:title')||metaProp('twitter:title')||(tt&&tt[1])||host||u).trim();
    const site=metaProp('og:site_name')||host;
    const desc=metaProp('og:description')||metaProp('twitter:description')||metaProp('description')||'';
    const image=metaProp('og:image')||metaProp('twitter:image')||'';
    return{url:u,title:decodeEntities(title),site:decodeEntities(site),favicon,
      desc:desc?decodeEntities(desc.trim()).slice(0,240):'',image:image||''};
  }
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

