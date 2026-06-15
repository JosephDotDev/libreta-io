const CFG_KEY='folio_cfg';
const THEMES={
  'dark-warm'  :{bg:'#0C0B08',sur:'#141210',sur2:'#1A1814',bd:'#252219',bd2:'#332E26',tx:'#E4DDD0',mu:'#756E62',ac:'#C47D32',go:'#C9A84C'},
  'dark-cool'  :{bg:'#080C10',sur:'#0F1520',sur2:'#131C28',bd:'#1B2D3D',bd2:'#253648',tx:'#CEE0EE',mu:'#5A7A8A',ac:'#4E9E72',go:'#7EC4B8'},
  'dark-ink'   :{bg:'#0A0A0A',sur:'#121212',sur2:'#1A1A1A',bd:'#242424',bd2:'#303030',tx:'#E8E8E8',mu:'#666666',ac:'#E8C547',go:'#C47D32'},
  'light-warm' :{bg:'#F5F0E8',sur:'#EDE8DC',sur2:'#E5DDD0',bd:'#D4CCBC',bd2:'#C4BAA8',tx:'#1C1917',mu:'#8B7E6E',ac:'#8B4A2B',go:'#7A5C20'},
  'light-clean':{bg:'#FAFAFA',sur:'#F0F0F0',sur2:'#E8E8E8',bd:'#E0E0E0',bd2:'#D0D0D0',tx:'#1A1A1A',mu:'#888888',ac:'#2962FF',go:'#FF6D00'},
};
/* Curated content typefaces. `hw` = heading weights [h1,h2,h3] tuned so each reads as bold without faux-bolding.
   `grp` groups them in the picker so the choice feels structured, not a soup of fonts. */
const FONTS={
  cormorant :{lbl:'Cormorant', grp:'Serif', stack:"'Cormorant',Georgia,serif",      hw:[700,600,600]},
  newsreader:{lbl:'Newsreader',grp:'Serif', stack:"'Newsreader',Georgia,serif",     hw:[600,600,600]},
  lora      :{lbl:'Lora',      grp:'Serif', stack:"'Lora',Georgia,serif",           hw:[600,600,600]},
  dmsans    :{lbl:'DM Sans',   grp:'Sans',  stack:"'DM Sans',system-ui,sans-serif", hw:[700,600,600]},
  inter     :{lbl:'Inter',     grp:'Sans',  stack:"'Inter',system-ui,sans-serif",   hw:[700,600,600]},
  dmmono    :{lbl:'DM Mono',   grp:'Mono',  stack:"'DM Mono',ui-monospace,monospace",hw:[500,500,500]},
};
/* Map legacy/short config values onto the new keys */
function normFontKey(v){
  if(FONTS[v]) return v;
  return ({serif:'cormorant',sans:'dmsans',mono:'dmmono'})[v]||'cormorant';
}
function getCfg(){try{return JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}catch{return{}}}
function applyCfg(){
  const c=getCfg(); const tn=c.theme||'dark-warm';
  const t=(tn==='custom'&&c.customSnapshot)?c.customSnapshot:(THEMES[tn]||THEMES['dark-warm']);
  const r=document.documentElement.style;
  r.setProperty('--bg',  c.bg   ||t.bg);  r.setProperty('--sur', c.sur  ||t.sur);
  r.setProperty('--sur2',c.sur2 ||t.sur2);r.setProperty('--bd',  c.bd   ||t.bd);
  r.setProperty('--bd2', c.bd2  ||t.bd2); r.setProperty('--tx',  c.tx   ||t.tx);
  r.setProperty('--mu',  c.mu   ||t.mu);  r.setProperty('--ac',  c.ac   ||t.ac);
  r.setProperty('--go',  c.go   ||t.go);
  // Content typeface — curated set, each with its own heading weights
  const f=FONTS[normFontKey(c.font)]||FONTS.cormorant;
  r.setProperty('--fs',f.stack);
  r.setProperty('--hw1',f.hw[0]); r.setProperty('--hw2',f.hw[1]); r.setProperty('--hw3',f.hw[2]);
  // UI scale via CSS zoom. Expose the factor as --zoom so the app shell can
  // divide its viewport height by it — otherwise zoom>1 scales the 100dvh shell
  // taller than the screen and clips the sidebar foot (collapse button).
  const _zoom = c.zoom || '1.1';
  document.documentElement.style.zoom = _zoom;
  document.documentElement.style.setProperty('--zoom', _zoom);
  // Visual filter (fun whole-app display effect)
  if(document.body){
    document.body.classList.remove('vf-pixel','vf-crt','vf-bw');
    const vf=c.filter||'none'; if(vf!=='none') document.body.classList.add('vf-'+vf);
  }
  applyNavVisibility();
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
  const tn=c.theme||'dark-warm';
  const base=(tn==='custom'&&c.customSnapshot)?c.customSnapshot:(THEMES[tn]||THEMES['dark-warm']);
  /* Snapshot every effective color + apply this override */
  c.customSnapshot={
    bg:c.bg||base.bg, sur:c.sur||base.sur, sur2:c.sur2||base.sur2,
    bd:c.bd||base.bd, bd2:c.bd2||base.bd2, tx:c.tx||base.tx,
    mu:c.mu||base.mu, ac:c.ac||base.ac,   go:c.go||base.go,
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
    ['bg','sur','sur2','bd','bd2','tx','mu','ac','go'].forEach(k=>delete c[k]);
    c.theme=name;
  }
  localStorage.setItem(CFG_KEY,JSON.stringify(c)); applyCfg();
}
function resetCfg(){showConfirm('Reset all themes, colors, and display settings to defaults?',()=>{localStorage.removeItem(CFG_KEY);applyCfg()},'Reset','Reset Settings');}
function openCfg(){
  // On mobile the sidebar is an off-canvas drawer (z-index 1000); close it so
  // the settings panel (z-index 800) slides in on top without being occluded.
  if(typeof closeMobileSidebar==='function') closeMobileSidebar();
  document.getElementById('cfg-panel').classList.add('open');
  document.getElementById('cfg-ovl').classList.add('open');
  updCfgUI();renderStorageStatus();renderAccountStatus();
  if(typeof updateTrashBadge==='function')updateTrashBadge();
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
function updCfgUI(){
  const c=getCfg(); const tn=c.theme||'dark-warm';
  const t=(tn==='custom'&&c.customSnapshot)?c.customSnapshot:(THEMES[tn]||THEMES['dark-warm']);
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
  const fn=normFontKey(c.font);
  const fg=document.getElementById('cfg-fonts');
  if(fg){
    let last='', html='';
    for(const [k,f] of Object.entries(FONTS)){
      if(f.grp!==last){ html+=`<div class="cfg-font-grp">${f.grp}</div>`; last=f.grp; }
      html+=`<button class="cfg-font-opt cfg-opt${k===fn?' on':''}" data-gf="${k}" onclick="setCfgFont('${k}')" style="font-family:${f.stack}">${f.lbl}</button>`;
    }
    fg.innerHTML=html;
  }
  const dw=c.defWidth||'focused';
  document.querySelectorAll('.cfg-opt[data-dw]').forEach(b=>b.classList.toggle('on',b.dataset.dw===dw));
  const ds=c.defSize||'normal';
  document.querySelectorAll('.cfg-opt[data-ds]').forEach(b=>b.classList.toggle('on',b.dataset.ds===ds));
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
function renderFmtBar(doc){ applyDocFmt(doc); if(document.getElementById('page-set-pop')?.classList.contains('open')) renderPageSettings(); if(typeof renderBreadcrumbs==='function') renderBreadcrumbs(S.view,S.docId); }
function applyDocFmt(doc){
  const fmt=doc.fmt||{}; const cfg=getCfg();
  const f=FONTS[normFontKey(fmt.font||cfg.font)]||FONTS.cormorant;
  // Home only carries a per-page typeface (width lives in its own toggle) — scope it to #view-home.
  if(doc.id===HOME_ID){
    const hv=document.getElementById('view-home');
    if(hv){ hv.style.setProperty('--fs',f.stack); hv.style.setProperty('--hw1',f.hw[0]); hv.style.setProperty('--hw2',f.hw[1]); hv.style.setProperty('--hw3',f.hw[2]); }
    return;
  }
  const w=fmt.width||cfg.defWidth||'focused';
  const s=fmt.size||cfg.defSize||'normal';
  const ct=document.getElementById('blocks-ct');
  if(ct){
    ct.classList.remove('w-wide','w-full'); if(w==='wide') ct.classList.add('w-wide'); if(w==='full') ct.classList.add('w-full');
    ct.classList.remove('fs-sm','fs-lg','fs-xl'); if(s!=='normal') ct.classList.add('fs-'+s);
  }
  // Per-page typeface — scope --fs to the editor view so other surfaces keep the global font.
  const ev=document.getElementById('view-editor');
  if(ev){ ev.style.setProperty('--fs',f.stack); ev.style.setProperty('--hw1',f.hw[0]); ev.style.setProperty('--hw2',f.hw[1]); ev.style.setProperty('--hw3',f.hw[2]); }
}
function setDocWidth(w){ const doc=getActiveDoc(); if(!doc) return; doc.fmt=doc.fmt||{}; doc.fmt.width=w; saveActiveDoc(doc); renderFmtBar(doc); }
function setDocSize(s){ const doc=getActiveDoc(); if(!doc) return; doc.fmt=doc.fmt||{}; doc.fmt.size=s; saveActiveDoc(doc); renderFmtBar(doc); }
function setDocFont(f){ const doc=getActiveDoc(); if(!doc) return; doc.fmt=doc.fmt||{}; doc.fmt.font=f; saveActiveDoc(doc); renderFmtBar(doc); }

/* ── PAGE SETTINGS menu (ribbon, top-right) ── per-page typeface, width, size ── */
function togglePageSettings(e){
  e&&e.stopPropagation&&e.stopPropagation();
  const pop=document.getElementById('page-set-pop'); if(!pop) return;
  if(pop.classList.contains('open')){ closePageSettings(); return; }
  renderPageSettings();
  const r=e.currentTarget.getBoundingClientRect(); const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  pop.style.top=(r.bottom/z+6)+'px'; pop.style.right=((window.innerWidth-r.right)/z)+'px'; pop.style.left='auto';
  pop.classList.add('open'); openOvl();
}
function closePageSettings(){ document.getElementById('page-set-pop')?.classList.remove('open'); closeOvlSafe(); }
function renderPageSettings(){
  const pop=document.getElementById('page-set-pop'); if(!pop) return;
  const home=S.docId===HOME_ID;
  const doc=getActiveDoc(); if(!doc){ pop.innerHTML='<div class="ps-empty">Open a page to adjust its settings.</div>'; return; }
  const fmt=doc.fmt||{}; const cfg=getCfg();
  const fk=normFontKey(fmt.font||cfg.font);
  const w=fmt.width||cfg.defWidth||'focused';
  const s=fmt.size||cfg.defSize||'normal';
  let fonts='',last=null;
  Object.keys(FONTS).forEach(k=>{ const f=FONTS[k]; if(f.grp!==last){ fonts+=`<div class="ps-fgrp">${f.grp}</div>`; last=f.grp; }
    fonts+=`<button class="ps-font${k===fk?' on':''}" onclick="setDocFont('${k}')" style="font-family:${f.stack}">${f.lbl}</button>`; });
  const wb=(v,l)=>`<button class="ps-seg${w===v?' on':''}" onclick="setDocWidth('${v}')">${l}</button>`;
  const sb=(v,l)=>`<button class="ps-seg${s===v?' on':''}" onclick="setDocSize('${v}')">${l}</button>`;
  // Home: typeface only (its width has its own Centered/Full toggle).
  if(home){
    pop.innerHTML=`
      <div class="ps-hdr">Home settings</div>
      <div class="ps-sec"><div class="ps-lbl">Typeface</div><div class="ps-fonts">${fonts}</div></div>`;
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
  pop.innerHTML=`
    <div class="ps-hdr">Page options</div>
    <div class="ps-sec"><div class="ps-lbl">Typeface</div><div class="ps-fonts">${fonts}</div></div>
    <div class="ps-sec"><div class="ps-lbl">Width</div><div class="ps-segrow">${wb('focused','Focused')}${wb('wide','Wide')}${wb('full','Full')}</div></div>
    <div class="ps-sec"><div class="ps-lbl">Font size</div><div class="ps-segrow">${sb('sm','S')}${sb('normal','M')}${sb('lg','L')}${sb('xl','XL')}</div></div>
    ${propsSec}
    <div class="ps-sec">
      <button class="ps-actbtn" onclick="closePageSettings();openVersionPanel()">&#128336; Version history</button>
      <button class="ps-actbtn ps-danger" onclick="closePageSettings();deleteSbDoc(event,S.docId)" style="margin-top:6px">&#128465; Delete page</button>
    </div>`;
}

/* ===================================================
   DATABASE BLOCK
=================================================== */
