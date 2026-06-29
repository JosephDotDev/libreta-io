/* ═══════════════════════════════════════════════
   KEYBOARD SHORTCUT CHEAT-SHEET

   A "?" overlay listing the app's real shortcuts, grouped and colour-coded by
   the section-colour language. Opens on "?" (when not typing in a field) and
   closes via Esc / backdrop / closeAll. Content is data-driven and built once.
═══════════════════════════════════════════════ */
const SHORTCUTS=[
  {grp:'Navigate', color:'var(--c-docs)', items:[
    {keys:['⌘','K'], lbl:'Command palette'},
    {keys:['⌘','.'], lbl:'Focus / Flow mode'},
    {keys:['Esc'],        lbl:'Close · exit · dismiss'},
    {keys:['?'],          lbl:'This cheat-sheet'},
  ]},
  {grp:'History', color:'var(--pu)', items:[
    {keys:['⌘','Z'],          lbl:'Undo'},
    {keys:['⌘','⇧','Z'], lbl:'Redo'},
  ]},
  {grp:'Format', color:'var(--gr)', items:[
    {keys:['⌘','B'], lbl:'Bold'},
    {keys:['⌘','I'], lbl:'Italic'},
    {keys:['⌘','U'], lbl:'Underline'},
  ]},
  {grp:'Blocks', color:'var(--go)', items:[
    {keys:['/'],          lbl:'Insert a block'},
    {keys:['⌘','A'], lbl:'Select block · all blocks'},
    {keys:['↵'],     lbl:'Split into a new block'},
    {keys:['⌫'],     lbl:'Merge · delete (at block start)'},
  ]},
];
function openShortcuts(){
  const m=document.getElementById('shortcuts'); if(!m) return;
  if(m.classList.contains('open')){ closeShortcuts(); return; }
  if(typeof closeAll==='function') closeAll();
  const body=document.getElementById('shortcuts-body');
  if(body && !body.dataset.built){
    body.innerHTML=SHORTCUTS.map(g=>
      `<div class="sc-grp"><div class="sc-grp-lbl" style="color:${g.color}">${g.grp}</div>`+
      g.items.map(it=>
        `<div class="sc-row"><span class="sc-lbl">${it.lbl}</span><span class="sc-keys">`+
        it.keys.map(k=>`<kbd class="sc-kbd">${k}</kbd>`).join('')+`</span></div>`
      ).join('')+`</div>`
    ).join('');
    body.dataset.built='1';
  }
  m.classList.add('open');
}
function closeShortcuts(){ const m=document.getElementById('shortcuts'); if(m) m.classList.remove('open'); }
function shortcutsBackdrop(e){ if(e.target===e.currentTarget) closeShortcuts(); }
/* "?" opens the sheet — but never while typing in a field / editing a block. */
document.addEventListener('keydown',e=>{
  if(e.key!=='?'||e.metaKey||e.ctrlKey||e.altKey) return;
  const a=document.activeElement;
  if(a && (a.isContentEditable || a.tagName==='INPUT' || a.tagName==='TEXTAREA')) return;
  e.preventDefault(); openShortcuts();
});
