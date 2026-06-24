const CFG_KEY='folio_cfg';
/* Each theme carries the shell colours plus the section-identity hues:
   ac (rose/primary+Home), c_docs (Documents), gr (lime/Tasks), go (gold/Calendar).
   Presets without an explicit c_docs/gr fall back to sensible values in applyCfg(). */
const THEMES={
  /* Surface ramps are tuned for layering on dark UI: gentle bg→sur lift (~1.1:1)
     plus a clearly lighter border (sur→bd ~1.35:1) so cards/components read as
     distinct, and a brighter --mu so muted text clears ~5:1 on a card. */
  'parra'        :{bg:'#0D0C0F',sur:'#1A1822',sur2:'#242031',bd:'#332E40',bd2:'#423C52',tx:'#ECE6DE',mu:'#8B8498',ac:'#E05572',c_docs:'#4D88E8',gr:'#5DC27A',go:'#D4A83C'},
  /* The two sibling Parra directions, kept as one-click presets. --gr stays in the
     green family in every theme so the success/done semantic (checkboxes, etc.)
     never turns a non-green colour. */
  'night-garden' :{bg:'#0B0B10',sur:'#191824',sur2:'#232234',bd:'#322F45',bd2:'#403C55',tx:'#E8E2E4',mu:'#8C8799',ac:'#C44B90',c_docs:'#3CB8A4',gr:'#5DC27A',go:'#D4A83C'},
  'warm-spectrum':{bg:'#0C0B08',sur:'#19160F',sur2:'#231F16',bd:'#352F22',bd2:'#453D2C',tx:'#EFE7D8',mu:'#988B72',ac:'#D45A50',c_docs:'#4ABBA0',gr:'#6FB87A',go:'#D4A83C'},
  'dark-warm'  :{bg:'#0C0B08',sur:'#18150F',sur2:'#221D15',bd:'#332C20',bd2:'#43392A',tx:'#EDE5D6',mu:'#988C74',ac:'#C47D32',c_docs:'#4E7EC4',gr:'#4E9E72',go:'#C9A84C'},
  'dark-cool'  :{bg:'#080C10',sur:'#111B28',sur2:'#1A2738',bd:'#2B3D50',bd2:'#3A4E63',tx:'#D6E6F2',mu:'#7E9EB2',ac:'#4E9E72',c_docs:'#4E9EC4',gr:'#6FC48E',go:'#7EC4B8'},
  'dark-ink'   :{bg:'#0A0A0A',sur:'#181818',sur2:'#232323',bd:'#343434',bd2:'#444444',tx:'#ECECEC',mu:'#8E8E8E',ac:'#E8C547',c_docs:'#5B9BD5',gr:'#5DC27A',go:'#C47D32'},
  'light-warm' :{bg:'#F5F0E8',sur:'#EDE8DC',sur2:'#E5DDD0',bd:'#D4CCBC',bd2:'#C4BAA8',tx:'#1C1917',mu:'#8B7E6E',ac:'#8B4A2B',c_docs:'#2E5FA8',gr:'#3B7D53',go:'#7A5C20'},
  'light-clean':{bg:'#FAFAFA',sur:'#F0F0F0',sur2:'#E8E8E8',bd:'#E0E0E0',bd2:'#D0D0D0',tx:'#1A1A1A',mu:'#888888',ac:'#2962FF',c_docs:'#1976D2',gr:'#2E9E5B',go:'#FF6D00'},
};
/* Curated content typefaces. `hw` = heading weights [h1,h2,h3] tuned so each reads as bold without faux-bolding.
   `bw` = body (reading) weight, `dw` = display/title weight. Serifs (esp. Cormorant) carry a higher numeric
   weight than sans so every face reads at a similar, solid perceived weight — no thin/washed-out text.
   `grp` groups them in the picker so the choice feels structured, not a soup of fonts. */
const FONTS={
  cormorant :{lbl:'Cormorant', grp:'Serif', stack:"'Cormorant',Georgia,serif",      hw:[700,600,600], bw:500, dw:500},
  newsreader:{lbl:'Newsreader',grp:'Serif', stack:"'Newsreader',Georgia,serif",     hw:[600,600,600], bw:400, dw:500},
  lora      :{lbl:'Lora',      grp:'Serif', stack:"'Lora',Georgia,serif",           hw:[600,600,600], bw:400, dw:500},
  dmsans    :{lbl:'DM Sans',   grp:'Sans',  stack:"'DM Sans',system-ui,sans-serif", hw:[700,600,600], bw:400, dw:500},
  inter     :{lbl:'Inter',     grp:'Sans',  stack:"'Inter',system-ui,sans-serif",   hw:[700,600,600], bw:400, dw:500},
  dmmono    :{lbl:'DM Mono',   grp:'Mono',  stack:"'DM Mono',ui-monospace,monospace",hw:[500,500,500], bw:400, dw:500},
};
/* Map legacy/short config values onto the new keys */
function normFontKey(v){
  if(FONTS[v]) return v;
  return ({serif:'cormorant',sans:'dmsans',mono:'dmmono'})[v]||'cormorant';
}
function getCfg(){try{return JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}catch{return{}}}
function applyCfg(){
  const c=getCfg(); const tn=c.theme||'parra';
  const t=(tn==='custom'&&c.customSnapshot)?c.customSnapshot:(THEMES[tn]||THEMES['parra']);
  const r=document.documentElement.style;
  r.setProperty('--bg',  c.bg   ||t.bg);  r.setProperty('--sur', c.sur  ||t.sur);
  r.setProperty('--sur2',c.sur2 ||t.sur2);r.setProperty('--bd',  c.bd   ||t.bd);
  r.setProperty('--bd2', c.bd2  ||t.bd2); r.setProperty('--tx',  c.tx   ||t.tx);
  r.setProperty('--mu',  c.mu   ||t.mu);  r.setProperty('--ac',  c.ac   ||t.ac);
  r.setProperty('--go',  c.go   ||t.go);
  // Section-identity hues. Older saved themes / snapshots may lack these keys,
  // so fall back: Documents→a blue, Tasks→the green token, both leaning on --ac
  // only as a last resort so the app is never left with an undefined section colour.
  const ac=c.ac||t.ac;
  r.setProperty('--c-docs', c.c_docs || t.c_docs || '#4D88E8');
  r.setProperty('--gr',     c.gr     || t.gr     || '#5DC27A');
  // Accent tint tracks the live accent so custom accent colours get a matching
  // 12% wash everywhere --acs is used (active nav, callouts, chips, selection).
  r.setProperty('--acs', `color-mix(in srgb, ${ac} 12%, transparent)`);
  // Content typeface — curated set, each with its own heading weights
  const f=FONTS[normFontKey(c.font)]||FONTS.cormorant;
  r.setProperty('--fs',f.stack);
  r.setProperty('--hw1',f.hw[0]); r.setProperty('--hw2',f.hw[1]); r.setProperty('--hw3',f.hw[2]);
  r.setProperty('--bw',f.bw||400); r.setProperty('--dw',f.dw||500);
  // UI scale via CSS zoom. Expose the factor as --zoom so the app shell can
  // divide its viewport height by it — otherwise zoom>1 scales the 100dvh shell
  // taller than the screen and clips the sidebar foot (collapse button).
  const _zoom = c.zoom || '1.1';
  document.documentElement.style.zoom = _zoom;
  document.documentElement.style.setProperty('--zoom', _zoom);
  // Visual filter (fun whole-app display effect)
  if(document.body){
    [...document.body.classList].forEach(cl=>{ if(cl.indexOf('vf-')===0) document.body.classList.remove(cl); });
    const vf=c.filter||'none'; if(vf!=='none') document.body.classList.add('vf-'+vf);
  }
  applyNavVisibility();
  if(typeof loadCustomFonts==='function') loadCustomFonts(); // register any user-uploaded fonts
  updCfgUI();
}
/* Which sidebar shortcuts (Home / Documents / Calendar) are visible. Hiding one
   only removes its sidebar button — the view stays reachable via breadcrumbs,
   the logo (Home), and direct hash links. */
function navHidden(){ return getCfg().navHidden||{}; }
function applyNavVisibility(){
  const h=navHidden();
  ['home','documents','calendar','tasks'].forEach(k=>{
    const btn=document.querySelector(`.nav-it[data-nav="${k}"]`);
    if(btn) btn.style.display=h[k]?'none':'';
  });
}
function toggleNavItem(k){
  const c=getCfg(); c.navHidden=c.navHidden||{};
  if(c.navHidden[k]) delete c.navHidden[k]; else c.navHidden[k]=true;
  localStorage.setItem(CFG_KEY,JSON.stringify(c)); applyNavVisibility(); updCfgUI();
}
function setCfgColor(k,v){
  const c=getCfg();
  const tn=c.theme||'parra';
  const base=(tn==='custom'&&c.customSnapshot)?c.customSnapshot:(THEMES[tn]||THEMES['parra']);
  /* Snapshot every effective color + apply this override. Section hues
     (c_docs/gr) are included so they survive a switch to the custom theme. */
  c.customSnapshot={
    bg:c.bg||base.bg, sur:c.sur||base.sur, sur2:c.sur2||base.sur2,
    bd:c.bd||base.bd, bd2:c.bd2||base.bd2, tx:c.tx||base.tx,
    mu:c.mu||base.mu, ac:c.ac||base.ac,   go:c.go||base.go,
    c_docs:c.c_docs||base.c_docs||'#4D88E8', gr:c.gr||base.gr||'#5DC27A',
    [k]:v
  };
  c.theme='custom'; c[k]=v;
  localStorage.setItem(CFG_KEY,JSON.stringify(c)); applyCfg();
}
function setCfgFont(f){const c=getCfg();c.font=f;localStorage.setItem(CFG_KEY,JSON.stringify(c));applyCfg()}
function setCfgDef(k,v){const c=getCfg();c[k]=v;localStorage.setItem(CFG_KEY,JSON.stringify(c));applyCfg()}
function setVisualFilter(v){const c=getCfg();if(!v||v==='none')delete c.filter;else c.filter=v;localStorage.setItem(CFG_KEY,JSON.stringify(c));applyCfg()}
/* Apply a custom colour from a typed hex value (accepts #rgb or #rrggbb, with or
   without the leading #). Invalid input just snaps the field back. */
function setCfgColorHex(k,val){
  val=(val||'').trim().replace(/^#/,'');
  if(/^[0-9a-fA-F]{3}$/.test(val)) val=val.split('').map(c=>c+c).join('');
  if(/^[0-9a-fA-F]{6}$/.test(val)) setCfgColor(k,'#'+val.toLowerCase());
  else updCfgUI();
}
function setTheme(name){
  const c=getCfg();
  if(name==='custom'){
    /* Restore saved snapshot */
    if(c.customSnapshot) Object.assign(c,c.customSnapshot);
    c.theme='custom';
  }else{
    /* Switch to preset, clear per-key overrides but keep snapshot */
    ['bg','sur','sur2','bd','bd2','tx','mu','ac','go','c_docs','gr'].forEach(k=>delete c[k]);
    c.theme=name;
  }
  localStorage.setItem(CFG_KEY,JSON.stringify(c)); applyCfg();
}
function resetCfg(){showConfirm('Reset all themes, colors, and display settings to defaults?',()=>{localStorage.removeItem(CFG_KEY);applyCfg()},'Reset','Reset Settings');}
function openCfg(tab){
  // On mobile the sidebar is an off-canvas drawer (z-index 1000); close it so
  // the settings panel (z-index 800) slides in on top without being occluded.
  if(typeof closeMobileSidebar==='function') closeMobileSidebar();
  document.getElementById('cfg-panel').classList.add('open');
  document.getElementById('cfg-ovl').classList.add('open');
  updCfgUI();renderStorageStatus();renderAccountStatus();
  if(typeof updateTrashBadge==='function')updateTrashBadge();
  cfgInitCollapsible();
  // Two scopes share this panel: "This page" (per-page formatting) and
  // "Workspace" (global settings). Sidebar foot defaults to Workspace; the
  // ribbon kebab + Home "Customize" open straight to This page.
  cfgTab(tab||'workspace');
}
/* Toggle the panel's scope tab. 'page' renders the per-page settings into the
   This-page pane; 'workspace' shows the global settings sections. */
function cfgTab(which){
  const page=which==='page';
  const pp=document.getElementById('cfg-pane-page'), pw=document.getElementById('cfg-pane-ws');
  if(pp) pp.style.display=page?'block':'none';
  if(pw) pw.style.display=page?'none':'block';
  document.getElementById('cfg-tab-page')?.classList.toggle('on',page);
  document.getElementById('cfg-tab-ws')?.classList.toggle('on',!page);
  if(page) renderPageSettings();
}
/* Make the Workspace settings sections collapsible (the panel is dense). State is
   per-section-label, persisted locally; enhancement is idempotent across opens. */
function _cfgSecState(){ try{return JSON.parse(localStorage.getItem('folio_cfg_secs')||'{}')}catch{return{}} }
function cfgToggleSec(sl){
  const sec=sl.closest('.cfg-sec'); if(!sec) return;
  const collapsed=sec.classList.toggle('collapsed');
  const s=_cfgSecState(); s[sl.dataset.seckey]=collapsed;
  try{localStorage.setItem('folio_cfg_secs',JSON.stringify(s))}catch(e){}
}
function cfgInitCollapsible(){
  const s=_cfgSecState();
  document.querySelectorAll('#cfg-pane-ws .cfg-sec').forEach(sec=>{
    const sl=sec.querySelector('.cfg-sl'); if(!sl) return;
    if(!sl.dataset.seckey){
      sl.dataset.seckey=sl.textContent.trim();
      sl.classList.add('cfg-sl-toggle');
      sl.insertAdjacentHTML('beforeend','<span class="cfg-sl-chev">▾</span>');
      sl.addEventListener('click',()=>cfgToggleSec(sl));
    }
    sec.classList.toggle('collapsed', !!s[sl.dataset.seckey]);
  });
}
/* Account section — shown only when signed in to cloud sync. Hosts the email + Log out. */
function renderAccountStatus(){
  const el=document.getElementById('cfg-account'), sec=document.getElementById('cfg-account-sec');
  let user=null; try{ if(typeof Cloud!=='undefined') user=Cloud.user; }catch(e){}
  if(!user || !el){ if(sec) sec.style.display='none'; return; }
  sec.style.display='';
  el.innerHTML=`<div style="font-size:12px;color:var(--mu);margin-bottom:6px">Signed in as</div>
    <div class="cfg-email-pill" title="${escAttr(user.email)}">${escHtml(user.email)}</div>
    <button class="cfg-opt" onclick="cloudSignOut()" style="color:var(--re);border-color:rgba(196,84,84,.4)">Log out</button>`;
}
function cloudSignOut(){ if(typeof Cloud!=='undefined' && Cloud.signOut) Cloud.signOut(); }
/* Danger Zone — wipe all data locally + in the cloud, then sign out. Double-confirm
   because it can't be undone. (Cloud-only when signed in; falls back to a local
   wipe when running offline/local-only.) */
function confirmDeleteAllData(){
  showConfirm('Delete ALL your data — every page, database, image and setting, on this device and in the cloud? This cannot be undone.',
    ()=>{ showConfirm('Are you absolutely sure? There is no way to recover this.',
      ()=>{
        if(typeof Cloud!=='undefined' && Cloud.deleteEverything){ Cloud.deleteEverything(); return; }
        // Local-only fallback
        try{ const ks=[]; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k&&k.indexOf('folio_')===0)ks.push(k);} ks.forEach(k=>localStorage.removeItem(k)); }catch(e){}
        location.reload();
      },'Delete everything','Final confirmation'); },
    'Continue','Delete all data');
}
function closeCfg(){document.getElementById('cfg-panel').classList.remove('open');document.getElementById('cfg-ovl').classList.remove('open')}
/* WCAG relative-luminance contrast ratio between two #rgb/#rrggbb colours, used to
   softly warn when a customised theme's text/surface pairing is getting unreadable. */
function _cfgLum(hex){
  hex=String(hex||'').replace('#',''); if(hex.length===3) hex=hex.split('').map(x=>x+x).join('');
  if(!/^[0-9a-fA-F]{6}$/.test(hex)) return 0;
  const v=[0,2,4].map(i=>{ let c=parseInt(hex.substr(i,2),16)/255; return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4); });
  return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];
}
function cfgContrast(a,b){ const la=_cfgLum(a),lb=_cfgLum(b); return (Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05); }
/* Render soft contrast warnings into #cfg-contrast for the effective theme colours. */
function updContrastWarn(c,t){
  const cw=document.getElementById('cfg-contrast'); if(!cw) return;
  const bg=c.bg||t.bg, sur=c.sur||t.sur, tx=c.tx||t.tx, mu=c.mu||t.mu, bd=c.bd||t.bd;
  const w=[];
  if(cfgContrast(tx,bg)<4.5) w.push('Body text is hard to read on the background.');
  else if(cfgContrast(tx,sur)<4.5) w.push('Text is hard to read on cards.');
  if(cfgContrast(mu,sur)<2.3) w.push('Muted text is too faint on cards.');
  if(cfgContrast(sur,bd)<1.1 && cfgContrast(bg,sur)<1.05) w.push('Cards barely separate from the background.');
  if(w.length){ cw.style.display='flex'; cw.innerHTML='<span class="cfg-cw-ico">&#9888;&#65039;</span><span>'+w.map(m=>escHtml(m)).join(' ')+'</span>'; }
  else{ cw.style.display='none'; cw.innerHTML=''; }
}
function updCfgUI(){
  const c=getCfg(); const tn=c.theme||'parra';
  const t=(tn==='custom'&&c.customSnapshot)?c.customSnapshot:(THEMES[tn]||THEMES['parra']);
  const el=document.getElementById('cfg-themes');
  if(el){
    const presets=Object.entries(THEMES);
    const hasCustom=!!(c.customSnapshot);
    const entries=(hasCustom||tn==='custom')?[...presets,['custom',c.customSnapshot||t]]:presets;
    el.innerHTML=entries.map(([k,tv])=>{
      const dot=k==='custom'?(c.ac||tv?.ac||'#888'):tv.ac;
      const lbl=k==='custom'?'Custom':k.replace(/-/g,' ').replace(/\b\w/g,x=>x.toUpperCase());
      return`<button class="t-btn${k===tn?' on':''}" onclick="setTheme('${k}')"><span class="t-dot" style="background:${dot}"></span>${lbl}</button>`;
    }).join('');
  }
  const sv=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v};
  sv('cfg-ac',c.ac||t.ac); sv('cfg-bg',c.bg||t.bg);
  sv('cfg-sur',c.sur||t.sur); sv('cfg-tx',c.tx||t.tx);
  sv('cfg-ac-hex',c.ac||t.ac); sv('cfg-bg-hex',c.bg||t.bg);
  sv('cfg-sur-hex',c.sur||t.sur); sv('cfg-tx-hex',c.tx||t.tx);
  // Section colours (fall back to the parra defaults if a theme/snapshot omits them)
  const docsC=c.c_docs||t.c_docs||'#4D88E8', tasksC=c.gr||t.gr||'#5DC27A', calC=c.go||t.go||'#D4A83C';
  sv('cfg-docs',docsC); sv('cfg-docs-hex',docsC);
  sv('cfg-tasks',tasksC); sv('cfg-tasks-hex',tasksC);
  sv('cfg-cal',calC); sv('cfg-cal-hex',calC);
  updContrastWarn(c,t);
  // (Typeface / default width / default size are per-page now — they live in the
  // "This page" tab via renderPageSettings, not in this Workspace pane.)
  const om=c.openMode||'peek';
  document.querySelectorAll('.cfg-opt[data-om]').forEach(b=>b.classList.toggle('on',b.dataset.om===om));
  // Zoom buttons
  const zoom=c.zoom||'1.1';
  document.querySelectorAll('.zoom-btn').forEach(b=>b.classList.toggle('on',b.dataset.zoom===zoom));
  // Property tags on cards (item 8)
  const lt=c.listTags||'on';
  document.querySelectorAll('.cfg-opt[data-tags]').forEach(b=>b.classList.toggle('on',b.dataset.tags===lt));
  // Sidebar shortcut visibility — "on" = shown
  const nh=c.navHidden||{};
  document.querySelectorAll('.cfg-opt[data-navtoggle]').forEach(b=>b.classList.toggle('on',!nh[b.dataset.navtoggle]));
  // Visual filter active button
  const vf=c.filter||'none';
  document.querySelectorAll('.cfg-opt[data-filter]').forEach(b=>b.classList.toggle('on',b.dataset.filter===vf));
}
/* Whether property tag chips show on Home cards + Documents list (item 8). */
function listTagsOn(){ return getCfg().listTags!=='off'; }
function setListTags(v){
  const c=getCfg(); c.listTags=v; localStorage.setItem(CFG_KEY,JSON.stringify(c)); updCfgUI();
  if(typeof refreshActiveLists==='function') refreshActiveLists();
  if(typeof renderHome==='function' && S.view==='home') renderHome();
}

/* ===================================================
   PER-DOC FORMAT BAR
=================================================== */
/* Width / Size / Typeface are PER-PAGE (doc.fmt) and live in the ribbon's
   Page-settings menu — the old inline fmt bar just applies them now. */
function renderFmtBar(doc){ applyDocFmt(doc); if(document.getElementById('cfg-panel')?.classList.contains('open') && document.getElementById('cfg-tab-page')?.classList.contains('on')) renderPageSettings(); if(typeof renderBreadcrumbs==='function') renderBreadcrumbs(S.view,S.docId); }
/* Font size is remembered PER DEVICE: stored under a non-folio_ key so the cloud
   snapshot (which only carries folio_* keys) never syncs it — a phone can run small
   text while a desktop runs large, and each remembers its own across reloads. Once a
   device sets a size it wins over any legacy per-page size. */
const DEV_SIZE_KEY='libreta_devsize';
function getDevSize(){ try{ return localStorage.getItem(DEV_SIZE_KEY)||''; }catch(e){ return ''; } }
function setDevSize(s){ try{ localStorage.setItem(DEV_SIZE_KEY, s||'normal'); }catch(e){} }
function applyDocFmt(doc){
  const fmt=doc.fmt||{}; const cfg=getCfg();
  const f=FONTS[normFontKey(fmt.font||cfg.font)]||FONTS.cormorant;
  // Home only carries a per-page typeface (width lives in its own toggle) — scope it to #view-home.
  if(doc.id===HOME_ID){
    const hv=document.getElementById('view-home');
    if(hv){ hv.style.setProperty('--fs',f.stack); hv.style.setProperty('--hw1',f.hw[0]); hv.style.setProperty('--hw2',f.hw[1]); hv.style.setProperty('--hw3',f.hw[2]); hv.style.setProperty('--bw',f.bw||400); hv.style.setProperty('--dw',f.dw||500); }
    return;
  }
  const w=fmt.width||cfg.defWidth||'focused';
  const s=getDevSize()||fmt.size||cfg.defSize||'normal';
  const ct=document.getElementById('blocks-ct');
  if(ct){
    ct.classList.remove('w-wide','w-full'); if(w==='wide') ct.classList.add('w-wide'); if(w==='full') ct.classList.add('w-full');
    ct.classList.remove('fs-sm','fs-lg','fs-xl'); if(s!=='normal') ct.classList.add('fs-'+s);
  }
  // Per-page typeface — scope --fs to the editor view so other surfaces keep the global font.
  const ev=document.getElementById('view-editor');
  if(ev){ ev.style.setProperty('--fs',f.stack); ev.style.setProperty('--hw1',f.hw[0]); ev.style.setProperty('--hw2',f.hw[1]); ev.style.setProperty('--hw3',f.hw[2]); ev.style.setProperty('--bw',f.bw||400); ev.style.setProperty('--dw',f.dw||500);
    // Mirror the width onto the view so the page-background card (which spans title +
    // cover + props + body, not just .blocks-ct) can size itself to the width setting.
    ev.classList.remove('pw-wide','pw-full'); if(w==='wide') ev.classList.add('pw-wide'); if(w==='full') ev.classList.add('pw-full'); }
}
function setDocWidth(w){ const doc=getActiveDoc(); if(!doc) return; doc.fmt=doc.fmt||{}; doc.fmt.width=w; saveActiveDoc(doc); renderFmtBar(doc); }
/* Size is a per-device preference (not per-page), so it does NOT write to doc.fmt /
   sync — it's stored locally and re-applied to whatever page is open on this device. */
function setDocSize(s){ setDevSize(s); const doc=getActiveDoc(); if(doc) applyDocFmt(doc); if(typeof renderPageSettings==='function') renderPageSettings(); }
function setDocFont(f){ const doc=getActiveDoc(); if(!doc) return; doc.fmt=doc.fmt||{}; doc.fmt.font=f; saveActiveDoc(doc); renderFmtBar(doc); }

/* ═══════════════════════════════════════════════
   CUSTOM FONT UPLOAD
   A user-supplied font file is stored as an IndexedDB blob (kept alive by
   collectRefs) and registered both as a FONTS picker entry and a live FontFace.
   cfg.customFonts = [{ key, name, ref }]  (key doubles as the CSS family name).
═══════════════════════════════════════════════ */
const _customFontFaces=new Set(); // keys whose FontFace bytes are already loading/loaded
/* Add the picker entry synchronously so it shows up immediately; loading the glyphs
   is async (font swaps in when ready). */
function registerCustomFont(cf){
  if(!cf||!cf.key) return;
  FONTS[cf.key]={lbl:cf.name||'Custom font',grp:'Custom',stack:`'${cf.key}',var(--fs-fallback,system-ui),sans-serif`,hw:[700,600,600],bw:400,dw:600,custom:true,ref:cf.ref};
  loadCustomFontFace(cf.key,cf.ref);
}
function loadCustomFontFace(key,ref){
  if(_customFontFaces.has(key)||!ref||typeof FontFace==='undefined'||!document.fonts) return;
  _customFontFaces.add(key);
  Promise.resolve(IDB.get(ref)).then(async blob=>{
    if(!blob) return;
    try{
      const face=new FontFace(key, await blob.arrayBuffer());
      await face.load(); document.fonts.add(face);
      // Anything currently showing this face re-paints once it's ready.
      if(typeof renderFmtBar==='function'){ const d=(typeof getActiveDoc==='function')&&getActiveDoc(); if(d) try{applyDocFmt(d);}catch(_){} }
    }catch(e){ _customFontFaces.delete(key); console.warn('[font] failed to load',key,e); }
  });
}
/* Register every saved custom font (called from applyCfg — idempotent). */
function loadCustomFonts(){ (getCfg().customFonts||[]).forEach(cf=>{ if(cf&&cf.key&&!FONTS[cf.key]) registerCustomFont(cf); }); }
function triggerCustomFontUpload(){ const inp=document.getElementById('custom-font-input'); if(inp){ inp.value=''; inp.click(); } }
async function onCustomFontFile(input){
  const file=input.files&&input.files[0]; input.value=''; if(!file) return;
  if(typeof withinUploadLimit==='function' && !withinUploadLimit(file,'Font')) return;
  if(!/\.(woff2?|ttf|otf)$/i.test(file.name||'')){ if(typeof toast==='function') toast('Please choose a .woff2, .woff, .ttf or .otf file.'); return; }
  let ref; try{ ref=await storeBlob(file); }catch(e){ if(typeof toast==='function') toast('Couldn’t store that font.'); return; }
  const name=(file.name||'Custom font').replace(/\.(woff2?|ttf|otf)$/i,'');
  const cf={key:'cf_'+(typeof uuid==='function'?uuid():Date.now().toString(36)).replace(/[^a-z0-9]/gi,'').slice(0,12), name, ref};
  const c=getCfg(); c.customFonts=c.customFonts||[]; c.customFonts.push(cf);
  localStorage.setItem(CFG_KEY,JSON.stringify(c));
  registerCustomFont(cf);
  if(typeof renderPageSettings==='function') renderPageSettings();
  if(typeof toast==='function') toast(`“${name}” added — pick it under Typeface.`);
}
function removeCustomFont(key){
  const go=()=>{
    const c=getCfg(); const list=c.customFonts||[]; const cf=list.find(x=>x.key===key); if(!cf) return;
    c.customFonts=list.filter(x=>x.key!==key);
    localStorage.setItem(CFG_KEY,JSON.stringify(c));
    delete FONTS[key]; _customFontFaces.delete(key);
    if(cf.ref && typeof freeBlob==='function') freeBlob(cf.ref);
    // Drop the selection from any page that was using it so it falls back cleanly.
    if(typeof getActiveDoc==='function'){ const d=getActiveDoc(); if(d&&d.fmt&&d.fmt.font===key){ d.fmt.font='cormorant'; if(typeof saveActiveDoc==='function') saveActiveDoc(d); } }
    if(c.font===key){ c.font='cormorant'; localStorage.setItem(CFG_KEY,JSON.stringify(c)); }
    applyCfg();
    if(typeof renderPageSettings==='function') renderPageSettings();
  };
  if(typeof showConfirm==='function') showConfirm('Remove this custom font?',go,'Remove','Remove font'); else go();
}

/* ── PAGE SETTINGS — the ribbon kebab + Home "Customize" open the unified
   Settings panel on its "This page" tab. ── */
function togglePageSettings(e){
  e&&e.stopPropagation&&e.stopPropagation();
  const open=document.getElementById('cfg-panel')?.classList.contains('open');
  const onPage=document.getElementById('cfg-tab-page')?.classList.contains('on');
  if(open&&onPage){ closeCfg(); return; }
  openCfg('page');
}
function closePageSettings(){ closeCfg(); }
function renderPageSettings(){
  const pop=document.getElementById('cfg-pane-page'); if(!pop) return;
  const home=S.docId===HOME_ID;
  const doc=getActiveDoc(); if(!doc){ pop.innerHTML='<div class="ps-empty">Open a page to adjust its settings.</div>'; return; }
  const fmt=doc.fmt||{}; const cfg=getCfg();
  const fk=normFontKey(fmt.font||cfg.font);
  const w=fmt.width||cfg.defWidth||'focused';
  const s=getDevSize()||fmt.size||cfg.defSize||'normal';
  let fonts='',last=null;
  Object.keys(FONTS).forEach(k=>{ const f=FONTS[k]; if(f.grp!==last){ fonts+=`<div class="ps-fgrp">${f.grp}</div>`; last=f.grp; }
    if(f.custom){
      fonts+=`<span class="ps-font-wrap"><button class="ps-font${k===fk?' on':''}" onclick="setDocFont('${k}')" style="font-family:${f.stack}">${escHtml(f.lbl)}</button><button class="ps-font-rm" title="Remove font" onclick="removeCustomFont('${k}')">&times;</button></span>`;
    } else {
      fonts+=`<button class="ps-font${k===fk?' on':''}" onclick="setDocFont('${k}')" style="font-family:${f.stack}">${f.lbl}</button>`;
    }
  });
  fonts+=`<button class="ps-font ps-font-up" onclick="triggerCustomFontUpload()" title="Upload a font file (.woff2, .woff, .ttf, .otf — max 25 MB)">&#8593; Upload font</button>`;
  const wb=(v,l)=>`<button class="ps-seg${w===v?' on':''}" onclick="setDocWidth('${v}')">${l}</button>`;
  const sb=(v,l)=>`<button class="ps-seg${s===v?' on':''}" onclick="setDocSize('${v}')">${l}</button>`;
  // Home: page setup (cover / icon / title) + width + typeface. The buttons keep
  // their original IDs so renderHome() / renderCover() / page-icon sync still target
  // them while the panel is open.
  if(home){
    const hd=doc, hw=hd.fmt?.width||'focused';
    const titleLbl=hd.titleHidden?'&#43; Add title':'<svg class="lic" viewBox="0 0 24 24" width="13" height="13" style="vertical-align:-2px;margin-right:5px"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>Remove title';
    pop.innerHTML=`
      <div class="ps-sec"><div class="ps-lbl">Page</div>
        <div class="ps-setup">
          <button class="meta-action-btn" id="home-cover-add-btn" onclick="addBlankCover()">&#128444; Add cover</button>
          <button class="meta-action-btn" id="home-cover-link-btn" onclick="coverFromUrlPrompt(event)" style="display:none">&#128279; Link cover</button>
          <button class="meta-action-btn" id="home-icon-add-btn" onclick="openIconPicker(event,this)">&#128512; Add icon</button>
          <button class="meta-action-btn" id="home-title-toggle" onclick="toggleHomeTitle()">${titleLbl}</button>
        </div></div>
      <div class="ps-sec"><div class="ps-lbl">Width</div><div class="ps-segrow">
        <button class="ps-seg${hw!=='full'?' on':''}" id="home-w-focused" onclick="setHomeWidth('focused')">Centered</button>
        <button class="ps-seg${hw==='full'?' on':''}" id="home-w-full" onclick="setHomeWidth('full')">Full width</button>
      </div></div>
      <div class="ps-sec"><div class="ps-lbl">Typeface</div><div class="ps-fonts">${fonts}</div></div>`;
    if(typeof renderCover==='function') renderCover(hd);
    return;
  }
  // Show/hide shared properties (only when this page is a database entry).
  let propsSec='';
  if(S.dbRow && typeof DB!=='undefined'){
    const tbl=DB.getTbl(S.dbRow.tableId);
    if(tbl){
      const titleId=idbTitleColId(tbl), hidden=idbHiddenDocProps(tbl);
      const cols=tbl.columns.filter(c=>c.id!==titleId);
      const items=cols.map(c=>{ const on=!hidden.has(c.id);
        return `<button class="ps-proprow${on?'':' off'}" onclick="idbToggleDocProp('${c.id}');renderPageSettings()"><span class="ps-propnm">${escHtml(c.name)}</span><span class="ps-propeye">${on?'&#128065;':'&#128683;'}</span></button>`;
      }).join('')||'<div class="ps-empty2">No shared properties</div>';
      propsSec=`<div class="ps-sec"><div class="ps-lbl">Show properties</div><div class="ps-proplist">${items}</div></div>`;
    }
  }
  // Page background (Craft-style centered-card-over-image). Preset gradients + upload.
  const curBg=(doc.meta&&doc.meta.bg)||'';
  const bgIsImg=curBg&&!curBg.startsWith('bg:');
  const bgSw=(k,css)=>`<button class="ps-bg${curBg==='bg:'+k?' on':''}" title="${k}" style="background-image:${css}" onclick="setPageBg('${k}')"></button>`;
  const bgSwatches=Object.entries(typeof PAGE_BGS!=='undefined'?PAGE_BGS:{}).map(([k,css])=>bgSw(k,css)).join('');
  const bgSec=`<div class="ps-sec"><div class="ps-lbl">Page background</div>
    <div class="ps-bgrow">
      <button class="ps-bg ps-bg-none${curBg?'':' on'}" title="None" onclick="removePageBg()">∅</button>
      ${bgSwatches}
      <button class="ps-bg ps-bg-up${bgIsImg?' on':''}" title="Upload an image" onclick="triggerPageBgUpload()">↑</button>
    </div></div>`;
  pop.innerHTML=`
    <div class="ps-sec"><div class="ps-lbl">Typeface</div><div class="ps-fonts">${fonts}</div></div>
    <div class="ps-sec"><div class="ps-lbl">Width</div><div class="ps-segrow">${wb('focused','Focused')}${wb('wide','Wide')}${wb('full','Full')}</div></div>
    <div class="ps-sec"><div class="ps-lbl">Font size</div><div class="ps-segrow">${sb('sm','S')}${sb('normal','M')}${sb('lg','L')}${sb('xl','XL')}</div></div>
    ${bgSec}
    ${propsSec}
    <div class="ps-sec">
      <button class="ps-actbtn" onclick="closePageSettings();openVersionPanel()">&#128336; Version history</button>
      <button class="ps-actbtn ps-danger" onclick="closePageSettings();deleteSbDoc(event,S.docId)" style="margin-top:6px"><svg class="lic" viewBox="0 0 24 24" width="13" height="13" style="vertical-align:-2px;margin-right:5px"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>Delete page</button>
    </div>`;
}

/* ===================================================
   DATABASE BLOCK
=================================================== */
