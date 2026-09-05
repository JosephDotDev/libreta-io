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
/* Device-local keys — deliberately outside folio_cfg so they never ride a backup:
   when you last checked and what you dismissed are facts about THIS machine. */
const UPD_LAST = 'libreta_update_lastcheck';
const UPD_SKIP = 'libreta_update_skipped';
const UPD_OFF  = 'libreta_update_off';
/* One try/catch for the whole module, the same shape as _calPrefs/_saveCalPrefs
   in views/calendar.js — call sites below read and write plainly. */
function _updGet(k){ try{ return localStorage.getItem(k)||''; }catch(e){ return ''; } }
function _updSet(k,v){ try{ v==null ? localStorage.removeItem(k) : localStorage.setItem(k,v); }catch(e){} }
function _updLast(){ return parseInt(_updGet(UPD_LAST),10)||0; }

/* Compare two version strings numerically, part by part. Handles a leading "v"
   and ignores any pre-release suffix ("1.2.0-beta.1" compares as "1.2.0"). */
function _verParts(v){ return String(v||'').replace(/^v/i,'').split('-')[0].split('.').map(n=>parseInt(n,10)||0); }
function verNewer(a,b){
  const x=_verParts(a), y=_verParts(b);
  for(let i=0;i<Math.max(x.length,y.length);i++){ const d=(x[i]||0)-(y[i]||0); if(d) return d>0; }
  return false;
}

function updateChecksOn(){ return _updGet(UPD_OFF)!=='1'; }
function setUpdateChecks(on){ _updSet(UPD_OFF, on?null:'1'); renderAbout(); }

/* Ask GitHub for the newest release. Throws on network failure, a rate limit
   (60 unauthenticated requests per hour per IP), or a repo with no release yet. */
async function checkForUpdates(){
  // Stamp the ATTEMPT, not the success: a machine that can't reach GitHub —
  // offline, behind a firewall, rate-limited — must still fall under the daily
  // throttle, or it retries a doomed connection on every single launch.
  _updSet(UPD_LAST, String(Date.now()));
  // The version comes from the shell and the tag from the network; nothing links
  // them, so let them run together.
  const [r, current] = await Promise.all([
    fetch('https://api.github.com/repos/'+UPD_REPO+'/releases/latest',
          { headers:{ 'Accept':'application/vnd.github+json' }, cache:'no-store' }),
    appVersion(),
  ]);
  if(!r.ok) throw new Error('GitHub returned '+r.status);
  const rel = await r.json();
  if(!rel || !rel.tag_name) throw new Error('no release found');
  return { latest: String(rel.tag_name).replace(/^v/i,''), newer: !!current && verNewer(rel.tag_name, current) };
}

/* Boot check: quiet, throttled, and never interrupts. Any failure (offline, rate
   limited, no release yet) is swallowed — an update notice is a convenience, not
   something worth showing an error about. */
async function maybeCheckForUpdates(){
  if(!IS_NATIVE || !updateChecksOn()) return;
  if(Date.now()-_updLast() < UPD_INTERVAL) return;
  let info; try{ info=await checkForUpdates(); }catch(e){ return; }
  if(info.newer && _updGet(UPD_SKIP)!==info.latest) showUpdateToast(info);
}

/* "Get it" opens the download page in the browser; "Not now" remembers this
   version so the same notice doesn't come back tomorrow. */
function showUpdateToast(info){
  actionToast('Libreta '+info.latest+' is available.', [
    { label:'Get it',                onClick:()=>openExternal(UPD_PAGE) },
    { label:'Not now', ghost:true,   onClick:()=>_updSet(UPD_SKIP, info.latest) },
  ]);
}

/* Settings → About → "Check for updates". Unlike the boot check this one always
   reports back, including failures, because the user explicitly asked. */
async function checkForUpdatesNow(){
  const p=progressToast('Checking for updates…');
  try{
    const info=await checkForUpdates();
    if(info.newer){
      _updSet(UPD_SKIP, null);   // an explicit check un-dismisses
      p.done();                  // the sticky toast below carries the version
      showUpdateToast(info);
    }else{
      p.done('You’re on the latest version');
    }
  }catch(e){
    p.fail('Could not reach GitHub — try again later');
  }
  renderAbout();
}

/* The About block in Settings. Called whenever the panel opens. */
function renderAbout(){
  const el=document.getElementById('cfg-about'); if(!el) return;
  if(!IS_NATIVE){
    el.innerHTML='<div style="font-size:11px;color:var(--mu);line-height:1.7">Running in a browser. Update checks apply to the installed app.</div>';
    return;
  }
  appVersion().then(v=>{
    const on=updateChecksOn(), last=_updLast();
    const sub = !on   ? 'Automatic checks are off'
              : last  ? 'Last checked '+fmtVersionTime(last)
              :         'Not checked yet';
    el.innerHTML=`
      <div style="font-size:12px;color:var(--tx);margin-bottom:2px">Libreta ${escHtml(v||'—')}</div>
      <div style="font-size:10px;color:var(--mu);margin-bottom:10px">${escHtml(sub)}</div>
      <button class="cfg-opt" onclick="checkForUpdatesNow()">Check for updates</button>
      <div class="cfg-opt-row" style="margin-top:8px">
        <button class="cfg-opt${on?' on':''}" onclick="setUpdateChecks(true)">Check automatically</button>
        <button class="cfg-opt${on?'':' on'}" onclick="setUpdateChecks(false)">Never check</button>
      </div>
      <div style="font-size:10px;color:var(--mu);margin-top:8px;line-height:1.6">Asks GitHub once a day what the newest release is. Nothing is downloaded or installed automatically, and no information about you is sent.</div>`;
  });
}
