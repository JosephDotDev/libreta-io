/* ═══════════════════════════════════════════════
   SERVICE WORKER REGISTRATION + UPDATE FLOW
   Registers sw.js and handles the update handshake. In the dev tree the SW's
   importScripts('sw-manifest.js') 404s (build.sh only generates the manifest
   into dist/), so install fails and dev runs uncontrolled — no stale-cache
   pain while iterating. On deployed builds:
     • first visit: SW installs quietly; offline works from the next visit on
     • new deploy: the new shell downloads in the background, then a sticky
       toast offers "Reload" — clicking it activates the new version atomically
   `updateViaCache:'none'` keeps the browser from HTTP-caching sw.js itself.
═══════════════════════════════════════════════ */
(function(){
  if(!('serviceWorker' in navigator)) return;

  let _offered=false;
  function offerUpdate(reg){
    if(_offered||!reg.waiting) return; _offered=true;
    let wrap=document.getElementById('toast-wrap');
    if(!wrap){ wrap=document.createElement('div'); wrap.id='toast-wrap'; wrap.className='toast-wrap'; document.body.appendChild(wrap); }
    const t=document.createElement('div'); t.className='toast toast-sticky';
    const tx=document.createElement('span'); tx.textContent='A new version of Libreta is ready.';
    const b=document.createElement('button'); b.className='toast-act'; b.textContent='Reload';
    b.onclick=()=>{ try{ if(reg.waiting) reg.waiting.postMessage('SKIP_WAITING'); }catch(e){} t.remove(); };
    t.appendChild(tx); t.appendChild(b); wrap.appendChild(t);
  }

  // The updated SW takes control only after the user clicks Reload (the SW
  // never calls clients.claim()), so this fires exactly once per approved
  // update — reload onto the new build.
  let _reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(_reloading) return; _reloading=true; location.reload();
  });

  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'});
      const watch=()=>{
        const w=reg.installing; if(!w) return;
        w.addEventListener('statechange',()=>{
          // 'installed' with an existing controller = an UPDATE finished
          // downloading (a first install has no controller — stay quiet).
          if(w.state==='installed'&&navigator.serviceWorker.controller) offerUpdate(reg);
        });
      };
      reg.addEventListener('updatefound',watch); watch();
      if(reg.waiting&&navigator.serviceWorker.controller) offerUpdate(reg);
      // Long-lived SPA tabs: re-check for updates whenever the tab comes back.
      document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') reg.update().catch(()=>{}); });
    }catch(e){ /* registration failed → app simply runs uncontrolled */ }
  });
})();
