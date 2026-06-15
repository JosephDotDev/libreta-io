/* ═══════════════════════════════════════════════
   3-D TILT EFFECT
   Cards (.dc) tilt on both axes; rows tilt horizontally only.
═══════════════════════════════════════════════ */
(function(){
  function tilt(el, e, maxX, maxY, sc){
    const r=el.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width-0.5;
    const y=(e.clientY-r.top)/r.height-0.5;
    el.style.transform=`perspective(700px) rotateX(${-y*maxY}deg) rotateY(${x*maxX}deg)${sc?` scale(${sc})`:''}`;
  }
  document.addEventListener('mousemove', e=>{
    /* Doc grid cards — pronounced two-axis tilt, no scale (scale caused neighbours to clip) */
    const dc=e.target.closest('.dc');
    if(dc){ tilt(dc,e,16,16); return; }
    /* Overview doc rows */
    const ovr=e.target.closest('.ov-doc-row');
    if(ovr){ tilt(ovr,e,4,0); return; }
    /* All-docs table rows */
    const tr=e.target.closest('.dbt tbody tr');
    if(tr) tilt(tr,e,2,0);
  });
})();

