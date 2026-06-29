/* ═══════════════════════════════════════════════
   SIDEBAR FLY-OUT  (collapsed-rail branch preview)

   When the sidebar is collapsed to its coloured icon rail, hovering a section
   flies out a small popover with that section's branch — top-level pages for
   Documents, the table list for Databases, a labelled jump for the rest — so you
   can dive deep without re-opening the whole sidebar. Desktop/rail only.
═══════════════════════════════════════════════ */
let _sbFlyHideT=null;
const _SBF={
  file:'<svg viewBox="0 0 16 16"><path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6L9 1z"/><path d="M9 1v5h5"/></svg>',
  db:'<svg viewBox="0 0 16 16"><rect x="1.5" y="1.5" width="13" height="13" rx="1"/><line x1="1.5" y1="5.5" x2="14.5" y2="5.5"/><line x1="6" y1="5.5" x2="6" y2="14.5"/></svg>',
  plus:'<svg viewBox="0 0 16 16"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>',
};
const _SBF_HUE={home:'var(--ac)',documents:'var(--c-docs)',calendar:'var(--go)',tasks:'var(--gr)',databases:'var(--pu)'};
const _SBF_NAME={home:'Home',documents:'Documents',calendar:'Calendar',tasks:'Tasks',databases:'Databases'};

function _sbFlyEl(){
  let f=document.getElementById('sb-flyout');
  if(!f){
    f=document.createElement('div'); f.id='sb-flyout'; f.className='sb-flyout';
    f.addEventListener('mouseenter',()=>clearTimeout(_sbFlyHideT));
    f.addEventListener('mouseleave',sbFlyLeave);
    document.body.appendChild(f);
  }
  return f;
}
function _sbFlyRow(onclick,ico,label){
  return `<div class="sbf-row" onclick="${onclick}">${ico?`<span class="sbf-ico">${ico}</span>`:''}<span class="sbf-nm">${escHtml(label)}</span></div>`;
}
function _sbFlyContent(area){
  const hue=_SBF_HUE[area]||'var(--mu)';
  const hd=`<div class="sbf-hd" style="color:${hue}">${_SBF_NAME[area]||area}</div>`;
  if(area==='documents'){
    const tops=DB.getDocs()
      .filter(d=>d.id!==HOME_ID && !(d.meta&&d.meta.parent) && (typeof sbIsForeignDbEntry!=='function'||!sbIsForeignDbEntry(d)))
      .sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,12);
    const list=tops.length
      ? tops.map(d=>_sbFlyRow(`nav('editor','${d.id}');sbFlyClose()`, (d.meta&&d.meta.icon)?iconHtml(d.meta.icon,'15px'):_SBF.file, d.title||'Untitled')).join('')
      : `<div class="sbf-empty">No pages yet</div>`;
    return hd+list+`<div class="sbf-sep"></div>`
      +_sbFlyRow(`nav('documents');sbFlyClose()`, _SBF.file, 'All documents')
      +_sbFlyRow(`newDoc();sbFlyClose()`, _SBF.plus, 'New page');
  }
  if(area==='databases'){
    const tbls=(typeof DB!=='undefined'&&DB.getTbls?DB.getTbls():[]).slice(0,12);
    const list=tbls.length
      ? tbls.map(t=>_sbFlyRow(`nav('databases');if(typeof openTbl==='function')openTbl('${t.id}');sbFlyClose()`, _SBF.db, t.name||'Untitled')).join('')
      : `<div class="sbf-empty">No databases yet</div>`;
    return hd+list+`<div class="sbf-sep"></div>`+_sbFlyRow(`nav('databases');sbFlyClose()`, _SBF.db, 'All databases');
  }
  // single-destination sections — a labelled jump
  return `<div class="sbf-label" style="border-left:2px solid ${hue}">Open ${_SBF_NAME[area]||area}</div>`;
}
function sbFlyEnter(navit){
  if(!document.body.classList.contains('sb-collapsed')) return; // only on the collapsed rail
  const area=navit.dataset.nav; if(!area) return;
  clearTimeout(_sbFlyHideT);
  const fly=_sbFlyEl();
  fly.innerHTML=_sbFlyContent(area);
  fly.onclick=function(e){ if(e.target===fly) sbFlyClose(); };
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  const r=navit.getBoundingClientRect();
  fly.style.left=(r.right/z+8)+'px';
  // clamp so it never runs off the bottom of the viewport
  fly.classList.add('open');
  const vh=window.innerHeight/z, fh=fly.offsetHeight;
  let top=r.top/z; if(top+fh>vh-8) top=Math.max(8,vh-fh-8);
  fly.style.top=top+'px';
}
function sbFlyLeave(){
  clearTimeout(_sbFlyHideT);
  _sbFlyHideT=setTimeout(sbFlyClose,150);
}
function sbFlyClose(){ const f=document.getElementById('sb-flyout'); if(f) f.classList.remove('open'); }

function _sbFlyInit(){
  document.querySelectorAll('.sb .nav-it').forEach(it=>{
    it.addEventListener('mouseenter',()=>sbFlyEnter(it));
    it.addEventListener('mouseleave',sbFlyLeave);
    it.addEventListener('click',sbFlyClose);
  });
}
if(document.readyState!=='loading') _sbFlyInit(); else document.addEventListener('DOMContentLoaded',_sbFlyInit);
