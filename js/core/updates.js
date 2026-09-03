/* ═══════════════════════════════════════════════
   UPDATE CHECK — desktop only; GitHub Releases is the source of truth.

   Libreta has no update server and never will. The app asks GitHub's public
   releases API what the newest tag is, compares it with its own version, and if
   there is a newer one offers a link to the download page. It NEVER downloads or
   installs anything by itself — the user decides what runs on their machine.

   Privacy: this is the only request Libreta makes on its own initiative. It is an
   unauthenticated GET carrying no identifying information (GitHub sees an IP and a
   user-agent, as it would for any web page). It runs at most once a day, only in
   the desktop app, and Settings → About has a switch to turn it off entirely.
═══════════════════════════════════════════════ */
const UPD_REPO     = 'JosephDotDev/libreta-io';
const UPD_PAGE     = 'https://josephdotdev.github.io/libreta-io/download.html';
const UPD_INTERVAL = 864e5;   // 24 h between automatic checks
/* Device-local keys (never exported, never part of a backup). */
const UPD_LAST = 'libreta_update_lastcheck';   // ms timestamp of the last completed check
const UPD_SKIP = 'libreta_update_skipped';     // a version the user chose to ignore
const UPD_OFF  = 'libreta_update_off';         // '1' when automatic checks are switched off

/* Compare two version strings numerically, part by part. Handles a leading "v"
   and ignores any pre-release suffix ("1.2.0-beta.1" compares as "1.2.0"). */
function _verParts(v){ return String(v||'').replace(/^v/i,'').split('-')[0].split('.').map(n=>parseInt(n,10)||0); }
function verNewer(a,b){
  const x=_verParts(a), y=_verParts(b);
  for(let i=0;i<Math.max(x.length,y.length);i++){ const d=(x[i]||0)-(y[i]||0); if(d) return d>0; }
  return false;
}

let _appVer=null;
async function appVersion(){
  if(_appVer!==null) return _appVer;
  try{ _appVer = IS_DESKTOP ? await window.__TAURI__.app.getVersion() : ''; }catch(e){ _appVer=''; }
  return _appVer;
}

function updateChecksOn(){ try{ return localStorage.getItem(UPD_OFF)!=='1'; }catch(e){ return true; } }
function setUpdateChecks(on){
  try{ on ? localStorage.removeItem(UPD_OFF) : localStorage.setItem(UPD_OFF,'1'); }catch(e){}
  renderAbout();
}

/* Ask GitHub for the newest release. Throws on network failure, a rate limit
   (60 unauthenticated requests per hour per IP), or a repo with no release yet. */
async function checkForUpdates(){
  const r = await fetch('https://api.github.com/repos/'+UPD_REPO+'/releases/latest',
                        { headers:{ 'Accept':'application/vnd.github+json' }, cache:'no-store' });
  if(!r.ok) throw new Error('GitHub returned '+r.status);
  const rel = await r.json();
  if(!rel || !rel.tag_name) throw new Error('no release found');
  try{ localStorage.setItem(UPD_LAST, String(Date.now())); }catch(e){}
  const current = await appVersion();
  return {
    current,
    latest: String(rel.tag_name).replace(/^v/i,''),
    newer:  !!current && verNewer(rel.tag_name, current),
    notes:  rel.html_url || '',
  };
}

/* Boot check: quiet, throttled, and never interrupts. Any failure (offline, rate
   limited, no release yet) is swallowed — an update notice is a convenience, not
   something worth showing an error about. */
async function maybeCheckForUpdates(){
  if(!IS_DESKTOP || !updateChecksOn()) return;
  let last=0; try{ last=parseInt(localStorage.getItem(UPD_LAST)||'0',10)||0; }catch(e){}
  if(Date.now()-last < UPD_INTERVAL) return;
  let info; try{ info=await checkForUpdates(); }catch(e){ return; }
  if(!info.newer) return;
  let skipped=''; try{ skipped=localStorage.getItem(UPD_SKIP)||''; }catch(e){}
  if(skipped===info.latest) return;          // the user already said "not now" to this one
  showUpdateToast(info);
}

/* Sticky toast: "Get it" opens the download page in the browser, "Not now"
   remembers this version so the same notice doesn't reappear tomorrow. */
function showUpdateToast(info){
  let wrap=document.getElementById('toast-wrap');
  if(!wrap){ wrap=document.createElement('div'); wrap.id='toast-wrap'; wrap.className='toast-wrap'; document.body.appendChild(wrap); }
  const t=document.createElement('div'); t.className='toast toast-sticky';
  const tx=document.createElement('span'); tx.textContent='Libreta '+info.latest+' is available.';
  const get=document.createElement('button'); get.className='toast-act'; get.textContent='Get it';
  get.onclick=()=>{ openExternal(UPD_PAGE); t.remove(); };
  const no=document.createElement('button'); no.className='toast-act'; no.textContent='Not now';
  no.style.background='transparent'; no.style.color='var(--mu)';
  no.onclick=()=>{ try{ localStorage.setItem(UPD_SKIP, info.latest); }catch(e){} t.remove(); };
  t.appendChild(tx); t.appendChild(get); t.appendChild(no);
  wrap.appendChild(t);
}

/* Settings → About → "Check for updates". Unlike the boot check this one always
   reports back, including failures, because the user explicitly asked. */
async function checkForUpdatesNow(){
  const p=(typeof progressToast==='function')?progressToast('Checking for updates…'):null;
  try{
    const info=await checkForUpdates();
    if(info.newer){
      try{ localStorage.removeItem(UPD_SKIP); }catch(e){}   // an explicit check un-skips
      if(p) p.done('Libreta '+info.latest+' is available');
      showUpdateToast(info);
    }else{
      if(p) p.done('You’re on the latest version');
    }
  }catch(e){
    if(p) p.fail('Could not reach GitHub — try again later');
  }
  renderAbout();
}

/* The About block in Settings. Called whenever the panel opens. */
function renderAbout(){
  const el=document.getElementById('cfg-about'); if(!el) return;
  if(!IS_DESKTOP){
    el.innerHTML='<div style="font-size:11px;color:var(--mu);line-height:1.7">Running in a browser. Update checks apply to the desktop app.</div>';
    return;
  }
  appVersion().then(v=>{
    let last=0; try{ last=parseInt(localStorage.getItem(UPD_LAST)||'0',10)||0; }catch(e){}
    const on=updateChecksOn();
    const when=last?('Last checked '+new Date(last).toLocaleDateString(undefined,{month:'short',day:'numeric'})+' at '+new Date(last).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})):'Not checked yet';
    el.innerHTML=`
      <div style="font-size:12px;color:var(--tx);margin-bottom:2px">Libreta ${escHtml(v||'—')}</div>
      <div style="font-size:10px;color:var(--mu);margin-bottom:10px">${escHtml(on?when:'Automatic checks are off')}</div>
      <button class="cfg-opt" onclick="checkForUpdatesNow()">Check for updates</button>
      <div class="cfg-opt-row" style="margin-top:8px">
        <button class="cfg-opt${on?' on':''}" onclick="setUpdateChecks(true)">Check automatically</button>
        <button class="cfg-opt${on?'':' on'}" onclick="setUpdateChecks(false)">Never check</button>
      </div>
      <div style="font-size:10px;color:var(--mu);margin-top:8px;line-height:1.6">Asks GitHub once a day what the newest release is. Nothing is downloaded or installed automatically, and no information about you is sent.</div>`;
  });
}
