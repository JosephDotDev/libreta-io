/* ═══════════════════════════════════════════════
   MENU MOTION — fade-out for every floating sub-menu

   Fade-IN is pure CSS (`menuIn` in 05-menus.css replays whenever a menu goes from
   display:none to shown). Fading OUT can't be done in CSS alone: each menu's own
   close code hides it instantly (an `.open` class removed, or style.display='none'),
   and ~15 menus each own that logic — plus code all over checks "is it open?".
   Rather than delay every close path, watch the menus: when one goes from shown to
   hidden, drop an inert copy of its last visible state right after it and fade the
   COPY out. The real menu is already closed, so no open/close behaviour changes.
═══════════════════════════════════════════════ */
(function(){
  const MENUS='.slash-m,.bk-menu,.pm,.dp,.ptp,.prop-editor,.color-pal,.fmt-color-pop,.grid-hmenu,.idb-pop,.idb-rowmenu,.idb-colpop,.icon-picker,.sb-menu,.link-pop,#tbl-dd';
  const shown=new WeakMap();   // last known visibility per menu element
  const isShown=el=>el.isConnected&&getComputedStyle(el).display!=='none';
  const reduced=()=>document.body.classList.contains('reduce-motion')||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* `before` = each attribute's value at the start of this batch (null = absent),
     i.e. the menu's last visible state. */
  function ghost(el,before){
    if(reduced()||!el.parentNode) return;
    const g=el.cloneNode(true);
    for(const [name,val] of Object.entries(before)){ if(val==null) g.removeAttribute(name); else g.setAttribute(name,val); }
    // Inner ids would shadow the real menu's for getElementById; none are styled by id.
    g.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
    g.classList.add('menu-ghost'); g.setAttribute('inert',''); g.setAttribute('aria-hidden','true');
    el.after(g);   // after the real menu: same stacking context, and the real one stays first for lookups
    if(!isShown(g)){ g.remove(); return; }   // couldn't reconstruct a visible state — just skip the fade
    const drop=()=>g.remove();
    g.addEventListener('animationend',drop,{once:true});
    setTimeout(drop,400);                    // safety net if animationend never fires
  }

  const mo=new MutationObserver(records=>{
    const batch=new Map();                   // el → {attr: value before this batch}
    for(const r of records){
      const el=r.target;
      if(el.nodeType!==1||el.classList.contains('menu-ghost')||!el.matches(MENUS)) continue;
      let b=batch.get(el); if(!b){ b={}; batch.set(el,b); }
      if(!(r.attributeName in b)) b[r.attributeName]=r.oldValue;
    }
    batch.forEach((before,el)=>{
      const now=isShown(el);
      if(shown.get(el)&&!now) ghost(el,before);
      shown.set(el,now);
    });
  });
  mo.observe(document.body,{subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['class','style']});
})();
