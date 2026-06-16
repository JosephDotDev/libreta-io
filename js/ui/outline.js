/* ═══════════════════════════════════════════════
   OUTLINE / SECTIONS
   A per-document table of contents built from the page's headings (H1–H3).
   Lives as a floating rail in the editor: click a heading to scroll to it, and
   the section nearest the top stays highlighted as you scroll. Open/closed is
   device-local (a non-folio_ key, so it never rides the cloud snapshot).
═══════════════════════════════════════════════ */
const OUTLINE_KEY='libreta_outline_open';
function outlineOpen(){ try{ return localStorage.getItem(OUTLINE_KEY)==='1'; }catch(e){ return false; } }
/* Headings in document order — flattenBlocks reaches into columns & toggles too. */
function _outlineHeadings(){
  const all=(typeof flattenBlocks==='function')?flattenBlocks(S.blocks):(S.blocks||[]);
  return all.filter(b=>b&&['h1','h2','h3'].includes(b.type))
    .map(b=>({id:b.id, level:+b.type[1], text:(b.content||'').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').trim()}));
}
function renderOutline(){
  const panel=document.getElementById('outline-panel'); if(!panel) return;
  const on=outlineOpen() && S.view==='editor';
  document.body.classList.toggle('outline-on', on);
  document.getElementById('outline-btn')?.classList.toggle('on', outlineOpen());
  if(!on){ panel.innerHTML=''; return; }
  const hs=_outlineHeadings();
  if(!hs.length){ panel.innerHTML=`<div class="outline-hd">Outline</div><div class="outline-empty">Add a heading (H1–H3) to build sections.</div>`; return; }
  panel.innerHTML=`<div class="outline-hd">Outline</div><div class="outline-list">`
    + hs.map(h=>`<button class="outline-it lvl${h.level}" data-bid="${h.id}" onclick="outlineScrollTo('${h.id}')" title="${escAttr(h.text||'Untitled section')}">${escHtml(h.text)||'<span class="outline-mu">Untitled</span>'}</button>`).join('')
    + `</div>`;
  outlineSyncActive();
}
function toggleOutline(){
  try{ localStorage.setItem(OUTLINE_KEY, outlineOpen()?'0':'1'); }catch(e){}
  renderOutline();
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
  if(!outlineOpen()||S.view!=='editor') return;
  cancelAnimationFrame(_outlineRaf);
  _outlineRaf=requestAnimationFrame(()=>{
    const sc=document.getElementById('blocks-sc'); if(!sc) return;
    const line=sc.getBoundingClientRect().top+90;
    let activeId=null;
    _outlineHeadings().forEach(h=>{ const el=document.querySelector(`.bk[data-id="${h.id}"]`); if(el && el.getBoundingClientRect().top<=line) activeId=h.id; });
    document.querySelectorAll('#outline-panel .outline-it').forEach(b=>b.classList.toggle('active', b.dataset.bid===activeId));
  });
}
/* Debounced rebuild — called from sched() so the list tracks heading edits and
   structural changes without rebuilding on every keystroke. */
let _outlineRebuildT=0;
function outlineRefreshSoon(){ if(!outlineOpen()) return; clearTimeout(_outlineRebuildT); _outlineRebuildT=setTimeout(renderOutline, 350); }
