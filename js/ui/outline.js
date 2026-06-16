/* ═══════════════════════════════════════════════
   OUTLINE / SECTIONS
   A per-document table of contents built from the page's headings (H1–H3). It
   appears on its own on the right edge of the editor whenever the page has
   headings — a collapsed rail of marks that expands to a labelled list on hover.
   Click a heading to scroll to it; the section nearest the top stays highlighted.
═══════════════════════════════════════════════ */
/* Headings in document order — flattenBlocks reaches into columns & toggles too. */
function _outlineHeadings(){
  const all=(typeof flattenBlocks==='function')?flattenBlocks(S.blocks):(S.blocks||[]);
  return all.filter(b=>b&&['h1','h2','h3'].includes(b.type))
    .map(b=>({id:b.id, level:+b.type[1], text:(b.content||'').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').trim()}));
}
function renderOutline(){
  const panel=document.getElementById('outline-panel'); if(!panel) return;
  const hs=(S.view==='editor')?_outlineHeadings():[];
  const on=hs.length>0;                                   // appears on its own only when there are sections
  document.body.classList.toggle('outline-on', on);
  if(!on){ panel.innerHTML=''; return; }
  panel.innerHTML=`<div class="outline-inner"><div class="outline-hd">Outline</div><div class="outline-list">`
    + hs.map(h=>`<button class="outline-it lvl${h.level}" data-bid="${h.id}" onclick="outlineScrollTo('${h.id}')" title="${escAttr(h.text||'Untitled section')}"><span class="ol-bar"></span><span class="ol-label">${escHtml(h.text)||'<span class="outline-mu">Untitled</span>'}</span></button>`).join('')
    + `</div></div>`;
  outlineSyncActive();
}
function _zoomFactor(){ return parseFloat(getComputedStyle(document.documentElement).zoom)||parseFloat(document.documentElement.style.zoom)||1; }
function outlineScrollTo(bid){
  const el=document.querySelector(`#blocks-ct .bk[data-id="${bid}"]`)||document.querySelector(`.bk[data-id="${bid}"]`);
  const sc=document.getElementById('blocks-sc'); if(!el||!sc) return;
  // The root carries a CSS zoom, so getBoundingClientRect is in *visual* px while
  // scrollTop is *layout* px (visual = layout × zoom). scrollIntoView/smooth-scroll
  // both misbehave under zoom, so compute the layout target and set scrollTop directly.
  const z=_zoomFactor();
  const step=()=>{ const visualDelta=el.getBoundingClientRect().top - sc.getBoundingClientRect().top; sc.scrollTop += visualDelta/z - 64; }; // 64 = room for the sticky props bar
  step();
  requestAnimationFrame(step);   // second pass corrects for the header collapsing as we scroll
  el.classList.add('bk-flash'); setTimeout(()=>el.classList.remove('bk-flash'), 900);
}
/* Highlight the heading nearest the top of the viewport as the user scrolls. */
let _outlineRaf=0;
function outlineSyncActive(){
  if(!document.body.classList.contains('outline-on')||S.view!=='editor') return;
  cancelAnimationFrame(_outlineRaf);
  _outlineRaf=requestAnimationFrame(()=>{
    const sc=document.getElementById('blocks-sc'); if(!sc) return;
    const line=sc.getBoundingClientRect().top+90;
    let activeId=null;
    _outlineHeadings().forEach(h=>{ const el=document.querySelector(`.bk[data-id="${h.id}"]`); if(el && el.getBoundingClientRect().top<=line) activeId=h.id; });
    document.querySelectorAll('#outline-panel .outline-it').forEach(b=>b.classList.toggle('active', b.dataset.bid===activeId));
  });
}
/* Debounced rebuild — called from sched() so the rail appears/updates as headings
   are added, edited, or removed, without rebuilding on every keystroke. */
let _outlineRebuildT=0;
function outlineRefreshSoon(){ if(S.view!=='editor') return; clearTimeout(_outlineRebuildT); _outlineRebuildT=setTimeout(renderOutline, 300); }
