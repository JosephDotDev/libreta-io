/* ═══════════════════════════════════════════════
   FIRST-RUN ONBOARDING
   A short, warm two-step welcome for brand-new users:
     1) greeting by name + favourite colour (sets the accent live, with banter)
     2) "how will you use Libreta?" → seeds a tailored starter → lands on Home.
   Shown once, only to a genuinely empty workspace; always skippable.
   Flag: localStorage 'libreta_onboarded'. Builders reuse the template helpers
   (_tplTable / _b / _callout / _dbBlock) defined in templates.js (loaded first).
═══════════════════════════════════════════════ */
const ONB_FLAG='libreta_onboarded';
const ONB_COLORS=[
  {name:'Rose',hex:'#E05572'},{name:'Coral',hex:'#D45A50'},{name:'Gold',hex:'#D4A83C'},
  {name:'Green',hex:'#5DC27A'},{name:'Teal',hex:'#46B5A6'},{name:'Blue',hex:'#4D88E8'},
  {name:'Purple',hex:'#7E6FBE'},
];
const ONB_REACTS=[
  "Cool — that's my favorite too!",
  "Actually… it's that one, yeah.",
  "Ooh. Okay, THAT one. Definitely.",
  "You know what? Final answer — this one.",
];
let _onbPicks=0, _onbIntent='look';

/* Persistent discoverability nudge embedded in the starter pages, so the "where to
   customize" hint outlives the one-time onboarding flow. */
const ONB_TIP_HTML='<strong>Make it yours:</strong> open <strong>⚙ Settings</strong> (bottom-left) for themes, fonts &amp; colors · <strong>⋯ Page options</strong> (top-right) for this page’s typeface, width &amp; cover · type <strong>/</strong> to add anything.';

/* Tiny theme-aware "where to click" mockups for the discoverability step. They use
   CSS vars (incl. --ac), so they pick up the colour the user just chose. */
const ONB_MOCK_SETTINGS=`<svg viewBox="0 0 140 84" class="onb-mock" role="img" aria-label="Settings button at the bottom-left of the sidebar">
  <rect x="2" y="2" width="46" height="80" rx="5" fill="var(--sur2)" stroke="var(--bd2)"/>
  <rect x="9" y="9" width="28" height="4" rx="2" fill="var(--mu)" opacity=".55"/>
  <rect x="9" y="24" width="26" height="3" rx="1.5" fill="var(--mu)" opacity=".4"/>
  <rect x="9" y="32" width="30" height="3" rx="1.5" fill="var(--mu)" opacity=".4"/>
  <rect x="9" y="40" width="22" height="3" rx="1.5" fill="var(--mu)" opacity=".4"/>
  <rect x="5.5" y="63" width="39" height="13" rx="4" fill="none" stroke="var(--ac)" stroke-width="1.6"/>
  <circle cx="13" cy="69.5" r="2.6" fill="none" stroke="var(--ac)" stroke-width="1.3"/>
  <rect x="19" y="68" width="20" height="3" rx="1.5" fill="var(--ac)"/>
  <rect x="54" y="2" width="84" height="80" rx="5" fill="var(--sur2)" opacity=".45"/>
</svg>`;
const ONB_MOCK_PAGE=`<svg viewBox="0 0 140 84" class="onb-mock" role="img" aria-label="Page options button at the top-right">
  <rect x="2" y="2" width="136" height="16" rx="4" fill="var(--sur2)" stroke="var(--bd2)"/>
  <rect x="9" y="8" width="42" height="4" rx="2" fill="var(--mu)" opacity=".5"/>
  <rect x="115" y="4" width="19" height="12" rx="3.5" fill="none" stroke="var(--ac)" stroke-width="1.6"/>
  <circle cx="120.5" cy="10" r="1.1" fill="var(--ac)"/><circle cx="124.5" cy="10" r="1.1" fill="var(--ac)"/><circle cx="128.5" cy="10" r="1.1" fill="var(--ac)"/>
  <rect x="2" y="24" width="136" height="20" rx="4" fill="var(--ac)" opacity=".2"/>
  <rect x="10" y="50" width="58" height="6" rx="3" fill="var(--mu)" opacity=".55"/>
  <rect x="10" y="63" width="104" height="3" rx="1.5" fill="var(--mu)" opacity=".3"/>
  <rect x="10" y="71" width="86" height="3" rx="1.5" fill="var(--mu)" opacity=".3"/>
</svg>`;
const ONB_MOCK_SLASH=`<svg viewBox="0 0 140 84" class="onb-mock" role="img" aria-label="Type slash to open the block menu">
  <rect x="2" y="2" width="136" height="80" rx="5" fill="var(--sur2)" opacity=".45"/>
  <rect x="12" y="13" width="2.6" height="11" rx="1.3" fill="var(--ac)"/>
  <line x1="19" y1="24" x2="25" y2="13" stroke="var(--tx)" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>
  <rect x="20" y="30" width="78" height="48" rx="5" fill="var(--sur)" stroke="var(--bd2)"/>
  <rect x="24" y="35" width="70" height="10" rx="3" fill="var(--ac)" opacity=".22"/>
  <circle cx="31" cy="40" r="2.2" fill="var(--ac)"/>
  <rect x="37" y="38.5" width="42" height="3" rx="1.5" fill="var(--tx)" opacity=".75"/>
  <circle cx="31" cy="52" r="2.2" fill="none" stroke="var(--mu)" stroke-width="1"/>
  <rect x="37" y="50.5" width="46" height="3" rx="1.5" fill="var(--mu)" opacity=".5"/>
  <circle cx="31" cy="64" r="2.2" fill="none" stroke="var(--mu)" stroke-width="1"/>
  <rect x="37" y="62.5" width="38" height="3" rx="1.5" fill="var(--mu)" opacity=".5"/>
</svg>`;

/* Greeting name. There are no accounts, so this is a friendly constant; kept as a
   function so the copy has one place to change. */
function onbFirstName(){ return 'there'; }
/* Only greet a brand-new, empty workspace; otherwise quietly mark as done. */
function shouldOnboard(){
  try{ if(localStorage.getItem(ONB_FLAG)) return false; }catch(e){ return false; }
  let real=[];
  try{ real=DB.getDocs().filter(d=>d.id!==HOME_ID && !(typeof sbIsForeignDbEntry==='function'&&sbIsForeignDbEntry(d))); }catch(e){}
  return real.length===0;
}
function maybeStartOnboarding(){
  if(!shouldOnboard()){ try{ localStorage.setItem(ONB_FLAG,'1'); }catch(e){} return; }
  _onbPicks=0; startOnboarding();
}
function _onbEl(){ return document.getElementById('onboarding'); }
function _onbShow(html){
  const el=_onbEl(); if(!el) return;
  el.innerHTML=`<div class="onb-backdrop"></div><div class="onb-card">${html}</div>`;
  el.classList.add('open');
}
function finishOnboarding(){
  try{ localStorage.setItem(ONB_FLAG,'1'); }catch(e){}
  const el=_onbEl(); if(el){ el.classList.remove('open'); el.innerHTML=''; }
}
function startOnboarding(){ onbStepColor(); }

/* ── Step 1: name + favourite colour ── */
function onbStepColor(){
  const name=escHtml(onbFirstName());
  const sw=ONB_COLORS.map(c=>
    `<button class="onb-sw" style="--sw:${c.hex}" title="${c.name}" aria-label="${c.name}" onclick="onbPickColor('${c.hex}')"></button>`
  ).join('');
  _onbShow(`<div class="onb-step">
    <div class="onb-eyebrow">Welcome to Libreta</div>
    <h2 class="onb-h">Hey ${name} — real quick,<br>what's your favorite color?</h2>
    <div class="onb-swatches">${sw}</div>
    <div class="onb-react" id="onb-react" aria-live="polite"></div>
    <div class="onb-actions">
      <button class="onb-skip" onclick="finishOnboarding()">Skip</button>
      <button class="onb-next" id="onb-color-next" style="visibility:hidden" onclick="onbStepIntent()">Next →</button>
    </div>
  </div>`);
}
function onbPickColor(hex){
  try{ if(typeof setCfgColor==='function') setCfgColor('ac',hex); }catch(e){}   // theme the app live
  document.querySelectorAll('#onboarding .onb-sw').forEach(b=>
    b.classList.toggle('on', (b.style.getPropertyValue('--sw')||'').trim().toLowerCase()===hex.toLowerCase()));
  const react=document.getElementById('onb-react');
  if(react){
    react.textContent=ONB_REACTS[Math.min(_onbPicks,ONB_REACTS.length-1)];
    react.classList.remove('show'); void react.offsetWidth; react.classList.add('show');
  }
  _onbPicks++;
  const next=document.getElementById('onb-color-next'); if(next) next.style.visibility='visible';
}

/* ── Step 2: how will you use it? ── */
function onbStepIntent(){
  _onbShow(`<div class="onb-step">
    <div class="onb-eyebrow">About Libreta</div>
    <h2 class="onb-h">An all-in-one creative workspace</h2>
    <p class="onb-p">Think of it as a journal, a planner, and a simple database for everything you want to jot down.</p>
    <div class="onb-q">How do you plan to use Libreta?</div>
    <div class="onb-choices">
      <button class="onb-choice" onclick="onbPickIntent('write')"><span class="onb-choice-ico">✍️</span><span class="onb-choice-tx"><b>I'd like to do some writing!</b><small>A clean page to journal & draft</small></span></button>
      <button class="onb-choice" onclick="onbPickIntent('plan')"><span class="onb-choice-ico">🗓️</span><span class="onb-choice-tx"><b>I need to do some planning.</b><small>A board to track tasks & ideas</small></span></button>
      <button class="onb-choice" onclick="onbPickIntent('look')"><span class="onb-choice-ico">🧭</span><span class="onb-choice-tx"><b>I'm just here to look around.</b><small>A short guided tour</small></span></button>
    </div>
    <div class="onb-actions"><button class="onb-skip" onclick="onbPickIntent('look')">Skip</button></div>
  </div>`);
}
function onbPickIntent(kind){ _onbIntent=kind||'look'; onbStepDiscover(); }

/* ── Step 3: discoverability — "here's where the customization lives" ── */
function onbStepDiscover(){
  _onbShow(`<div class="onb-step">
    <div class="onb-eyebrow">Make it yours</div>
    <h2 class="onb-h">Libreta bends to fit you</h2>
    <p class="onb-p">Nearly everything is customizable — a few good places to poke around:</p>
    <div class="onb-discover">
      <div class="onb-tip">${ONB_MOCK_SETTINGS}<small><b>Theme, fonts & colors.</b> Open <strong>⚙ Settings</strong>, bottom-left.</small></div>
      <div class="onb-tip">${ONB_MOCK_PAGE}<small><b>Typeface, width, cover & background.</b> <strong>⋯ Page options</strong>, top-right.</small></div>
      <div class="onb-tip">${ONB_MOCK_SLASH}<small><b>Add anything.</b> Type <kbd>/</kbd> for blocks, images & databases.</small></div>
    </div>
    <div class="onb-actions">
      <button class="onb-skip" onclick="onbFinishFlow()">Maybe later</button>
      <button class="onb-next" onclick="onbFinishFlow()">Let’s go →</button>
    </div>
  </div>`);
}
function onbFinishFlow(){
  _onbShow(`<div class="onb-step onb-done">
    <div class="onb-done-ico">✨</div>
    <h2 class="onb-h">Setting up your space…</h2>
    <p class="onb-p">This one's yours to play with — customize anything to fit your needs!</p>
  </div>`);
  setTimeout(()=>{
    try{ onbBuildStarter(_onbIntent); }catch(e){ console.warn('[onboarding] starter build failed',e); }
    finishOnboarding();
    try{ if(typeof nav==='function') nav('home'); }catch(e){}
  },1300);
}

/* ── Tailored starters (saved, not opened — the flow lands on Home) ── */
function _onbSaveDoc(title,icon,blocks){
  const d=blankDoc(); d.title=title; d.meta=d.meta||{}; if(icon) d.meta.icon=icon;
  d.blocks=blocks&&blocks.length?blocks:[mkBlock('paragraph')];
  DB.saveDoc(d);
  if(typeof renderSidebarTree==='function') renderSidebarTree();
  return d;
}
function onbBuildStarter(kind){
  const PCo=(typeof PC!=='undefined')?PC:['#E05572','#5DC27A','#8B72D4','#D85858','#4D88E8','#D4A83C'];
  if(kind==='write'){
    _onbSaveDoc('My Journal','📓',[
      _b('h1','My Journal'),
      _callout('Type <strong>/</strong> on any empty line to add headings, to-dos, images and more.','✍️'),
      _b('h2',new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})),
      _b('paragraph','What’s on your mind today?'),
      _b('paragraph',''),
      _callout(ONB_TIP_HTML,'✨'),
    ]);
  } else if(kind==='plan'){
    const tbl=_tplTable('My Tasks',[
      _tplCol('Task','text'),
      _tplCol('Status','status',[_tplOpt('To do',PCo[3]),_tplOpt('Doing',PCo[0]),_tplOpt('Done',PCo[1])]),
      _tplCol('Due','date'),
    ],[
      {Task:'Drag me over to “Doing”',Status:'To do'},
      {Task:'Add your own with “+ New”',Status:'To do'},
      {Task:'Peek at the Board & Calendar views',Status:'Doing'},
    ],{icon:'🗓️'});
    _onbSaveDoc('This Week','🗓️',[
      _b('h1','This Week'),
      _callout('This is a database — switch between Table, Board and Calendar from the view menu.','🗓️'),
      _dbBlock(tbl.id,'board'),
      _callout(ONB_TIP_HTML,'✨'),
    ]);
  } else {
    const tbl=_tplTable('Reading list',[
      _tplCol('Title','text'),
      _tplCol('Status','status',[_tplOpt('To read',PCo[3]),_tplOpt('Reading',PCo[0]),_tplOpt('Done',PCo[1])]),
    ],[
      {Title:'Atomic Habits',Status:'Reading'},
      {Title:'The Pragmatic Programmer',Status:'To read'},
    ],{icon:'📚'});
    _onbSaveDoc('Getting started','👋',[
      _b('h1','Welcome to Libreta 👋'),
      _b('paragraph','Your space to think, plan, and write. A few things to try:'),
      _callout('Type <strong>/</strong> on any empty line for headings, to-dos, images, databases and more.','💡'),
      _b('bullet','Add an <strong>icon</strong> and a <strong>cover</strong> from the buttons above the title.'),
      _b('bullet','Open <strong>Page options</strong> (top-right) for a typeface, width or page background.'),
      _b('bullet','Change your <strong>theme, fonts &amp; colors</strong> anytime from <strong>⚙ Settings</strong> (bottom-left).'),
      _b('todo','Check me off ✓'),
      _b('h2','A little database'),
      _dbBlock(tbl.id,'table'),
    ]);
  }
}
