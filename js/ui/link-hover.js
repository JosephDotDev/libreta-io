/* ═══════════════════════════════════════════════
   LINK HOVER PREVIEW
   Hovering a link shows a floating card that previews what's on the other side:
     • external mentions (.mention[data-url]) → site, title, description, og:image
       (pulled from mentionCache; fetched on first hover if not cached yet)
     • internal page links (.bk-page[data-page-id]) → cover, icon, title, excerpt,
       and a couple of property chips
   Inspired by Capacities' link hover. Purely a reading aid — clicking still navigates.
═══════════════════════════════════════════════ */
let _lhEl=null, _lhShowT=0, _lhHideT=0, _lhAnchor=null, _lhKey=null;

function _lhPanel(){
  if(_lhEl) return _lhEl;
  _lhEl=document.createElement('div');
  _lhEl.id='link-hover'; _lhEl.className='link-hover';
  _lhEl.addEventListener('mouseenter',()=>clearTimeout(_lhHideT));
  _lhEl.addEventListener('mouseleave',_lhScheduleHide);
  document.body.appendChild(_lhEl);
  return _lhEl;
}
function _lhZoom(){ return parseFloat(document.documentElement.style.zoom||'1')||1; }
function _lhPosition(anchor){
  const el=_lhPanel(), z=_lhZoom();
  el.style.visibility='hidden'; el.style.display='block';
  const r=anchor.getBoundingClientRect();
  const pw=el.offsetWidth, ph=el.offsetHeight;
  const vw=window.innerWidth/z, vh=window.innerHeight/z;
  let left=r.left/z;
  left=Math.max(8,Math.min(left,vw-pw-8));
  let top=r.bottom/z+8;
  if(top+ph>vh-8) top=Math.max(8,r.top/z-ph-8);   // flip above if it would overflow
  el.style.left=left+'px'; el.style.top=top+'px';
  el.style.visibility='visible';
}
function _lhClose(){ clearTimeout(_lhShowT); clearTimeout(_lhHideT); if(_lhEl) _lhEl.style.display='none'; _lhAnchor=null; _lhKey=null; }
function _lhScheduleHide(){ clearTimeout(_lhHideT); _lhHideT=setTimeout(_lhClose,160); }

/* ── content builders ── */
function _lhExcerpt(doc,n){
  return (doc.blocks||[]).filter(b=>b&&!['divider','database','image','file','carousel'].includes(b.type))
    .map(b=>(b.content||'').replace(/<[^>]+>/g,'')).join(' ').replace(/\s+/g,' ').slice(0,n||220).trim();
}
function _lhPageHtml(pageId){
  const doc=DB.getDoc(pageId);
  if(!doc) return `<div class="lh-body"><div class="lh-title">Page not found</div></div>`;
  const pos=doc.meta&&doc.meta.coverPos!=null?doc.meta.coverPos:50;
  const cover=doc.meta&&doc.meta.cover?`<div class="lh-cover" style="${coverThumbBg(doc.meta.cover,pos)}"></div>`:'';
  const ico=doc.meta&&doc.meta.icon?iconHtml(doc.meta.icon,'18px'):'📄';
  const exc=_lhExcerpt(doc,240);
  const chips=(doc.props||[]).filter(p=>p.type==='select'&&p.value).slice(0,3).map(p=>{
    const o=(p.options||[]).find(x=>x.l===p.value); const cc=o?o.c:'var(--mu)';
    return `<span class="lh-chip" style="background:${cc}22;color:${cc}">${escHtml(p.value)}</span>`;}).join('');
  return `${cover}<div class="lh-body">
    <div class="lh-kicker">Page</div>
    <div class="lh-title">${ico} ${escHtml(doc.title||'Untitled')}</div>
    ${exc?`<div class="lh-desc">${escHtml(exc)}</div>`:'<div class="lh-desc lh-muted">Empty page</div>'}
    ${chips?`<div class="lh-chips">${chips}</div>`:''}
  </div>`;
}
function _lhLinkHtml(url){
  const m=mentionCache.get(normUrl(url));
  const host=hostOf(url);
  if(!m){
    // not fetched yet — show a light placeholder and pull metadata, then refresh
    if(!_mentionFetching.has(normUrl(url))){
      _mentionFetching.add(normUrl(url));
      fetchLinkMeta(url).then(meta=>{ mentionCache.set(normUrl(url),meta); _mentionFetching.delete(normUrl(url));
        if(_lhKey===('url:'+normUrl(url))&&_lhAnchor){ _lhRender('url:'+normUrl(url)); _lhPosition(_lhAnchor); } });
    }
    return `<div class="lh-body"><div class="lh-kicker">${escHtml(host)}</div><div class="lh-title">Loading preview…</div></div>`;
  }
  const fav=m.favicon?`<img class="lh-fav" src="${escHtml(m.favicon)}" alt="" onerror="this.style.display='none'">`:'';
  const img=m.image?`<div class="lh-cover"><img src="${escHtml(m.image)}" alt="" onerror="this.parentNode.style.display='none'"></div>`:'';
  return `${img}<div class="lh-body">
    <div class="lh-kicker">${fav}${escHtml(m.site||host)}</div>
    <div class="lh-title">${escHtml(m.title||url)}</div>
    ${m.desc?`<div class="lh-desc">${escHtml(m.desc)}</div>`:''}
    <div class="lh-url">${escHtml(host)}</div>
  </div>`;
}
function _lhRender(key){
  const el=_lhPanel();
  if(key.startsWith('page:')) el.innerHTML=_lhPageHtml(key.slice(5));
  else el.innerHTML=_lhLinkHtml(key.slice(4));
}
function _lhShow(anchor,key){
  _lhAnchor=anchor; _lhKey=key;
  _lhRender(key);
  _lhPosition(anchor);
}

/* ── delegated hover wiring ── */
document.addEventListener('mouseover',e=>{
  const t=e.target&&e.target.closest&&e.target.closest('.mention[data-url],.bk-page[data-page-id]');
  if(!t){ return; }
  // ignore while actively dragging or selecting
  if(document.body.classList.contains('idb-cal-dragging-active')) return;
  const key=t.classList.contains('bk-page')?('page:'+t.getAttribute('data-page-id')):('url:'+normUrl(t.getAttribute('data-url')));
  if(_lhAnchor===t && _lhKey===key){ clearTimeout(_lhHideT); return; }
  clearTimeout(_lhShowT); clearTimeout(_lhHideT);
  _lhShowT=setTimeout(()=>_lhShow(t,key),320);
});
document.addEventListener('mouseout',e=>{
  const t=e.target&&e.target.closest&&e.target.closest('.mention[data-url],.bk-page[data-page-id]');
  if(!t) return;
  // moving into the panel keeps it open
  if(e.relatedTarget&&_lhEl&&_lhEl.contains(e.relatedTarget)) return;
  clearTimeout(_lhShowT);
  _lhScheduleHide();
});
// any scroll / navigation dismisses it immediately
window.addEventListener('scroll',_lhClose,true);
document.addEventListener('click',e=>{ if(!_lhEl||!_lhEl.contains(e.target)) _lhClose(); },true);
