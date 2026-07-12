/* ═══════════════════════════════════════════════
   SERVICE WORKER — offline app shell
   The asset list + version come from sw-manifest.js, which build.sh GENERATES
   into dist/ (content-hash of the shell). The dev tree has no manifest, so the
   importScripts below 404s, install fails, and dev runs uncontrolled — the SW
   only ever activates on built deployments.

   Model: the whole shell (html + css + js + vendor libs) is precached as ONE
   atomic version. Users run either the complete old build or the complete new
   build — never a mix of cached-old CSS with fresh-new JS. Fonts live in a
   separate stable cache shared across versions (they only change if their
   filenames do; bump FONTS below if font file CONTENTS ever change in place).

   Update flow: new deploy → new SW_VERSION → this file's byte-change makes the
   browser install the new SW alongside the old → new cache fills in the
   background → sw-register.js offers "Reload" → SKIP_WAITING message activates
   the new SW → activate deletes old shell caches → page reloads on the new
   build.

   Kill switch: deploy with SW_KILL=true in the manifest (KILL=1 ./build.sh)
   and the next update check unregisters the SW and clears every cache, putting
   all users back on plain network.
═══════════════════════════════════════════════ */
importScripts('sw-manifest.js');   // defines SW_VERSION, SW_KILL, SW_ASSETS, SW_FONTS

const SHELL='libreta-shell-'+SW_VERSION;
const FONTS='libreta-fonts-v1';

self.addEventListener('install',e=>{
  if(SW_KILL){ self.skipWaiting(); return; }
  e.waitUntil((async()=>{
    const shell=await caches.open(SHELL);
    await shell.addAll(SW_ASSETS);
    // Fonts: only fetch what the stable cache doesn't already hold.
    const fonts=await caches.open(FONTS);
    const have=new Set((await fonts.keys()).map(r=>new URL(r.url).pathname));
    await Promise.all(SW_FONTS.filter(u=>!have.has(u)).map(u=>fonts.add(u)));
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    if(SW_KILL){
      await Promise.all((await caches.keys()).map(k=>caches.delete(k)));
      await self.registration.unregister();
      return;
    }
    // Drop every cache that isn't this version's shell or the shared fonts.
    for(const k of await caches.keys()) if(k!==SHELL&&k!==FONTS) await caches.delete(k);
    // NOTE: no clients.claim() — the first-ever install must not yank control
    // mid-session, and sw-register.js reloads on controllerchange, which must
    // only fire for a user-approved update.
  })());
});

self.addEventListener('message',e=>{ if(e.data==='SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==location.origin) return;   // Supabase, YouTube, … go straight to the network
  e.respondWith((async()=>{
    if(req.mode==='navigate'){
      // Serve each page by its own path (index vs landing), cache-first;
      // offline navigations to unknown paths fall back to the app shell.
      const path=url.pathname==='/'?'/index.html':url.pathname;
      const hit=await caches.match(path);
      if(hit) return hit;
      try{ return await fetch(req); }
      catch(err){ const shell=await caches.match('/index.html'); if(shell) return shell; throw err; }
    }
    // Assets are referenced with ?v= cache-busters → match ignoring the query.
    const cached=await caches.match(req,{ignoreSearch:true});
    if(cached) return cached;
    return fetch(req);   // anything unprecached (analytics, …) passes through
  })());
});
