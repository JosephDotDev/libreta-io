/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */
const S = {
  view:'home', docId:null, pendingBlkId:null, pendingPropId:null,
  blocks:[], props:[],
  calY:new Date().getFullYear(), calM:new Date().getMonth(),
  calShowDetails:true,
  recView:'rows',
  docView:(localStorage.getItem('folio_doc_view')||'cards'),
  docSort:(()=>{const v=(localStorage.getItem('folio_doc_sort')||'updatedAt-desc').split('-');return{col:v[0],dir:v[1]}})(),
  tblId:null, tblSort:null, tblFilter:'',
  slashId:null, slashQ:'', slashFoc:0, slashSub:false,
  menuId:null, menuSub:false,
  dpTarget:null, dpY:0, dpM:0,
  saveTimer:null, dragId:null,
};

/* ═══════════════════════════════════════════════
   BLOCK TYPE DEFINITIONS
═══════════════════════════════════════════════ */
const BT = [
  {t:'paragraph', lbl:'Text',        ico:'P',   ds:'Start writing plain text'},
  {t:'h1',        lbl:'Heading 1',   ico:'H1',  ds:'Large section heading'},
  {t:'h2',        lbl:'Heading 2',   ico:'H2',  ds:'Medium section heading'},
  {t:'h3',        lbl:'Heading 3',   ico:'H3',  ds:'Small section heading'},
  {t:'quote',     lbl:'Quote',       ico:'"',   ds:'Highlighted blockquote'},
  {t:'callout',   lbl:'Callout',     ico:'💡',  ds:'Boxed note with an icon'},
  {t:'page',      lbl:'Page',        ico:'📄',  ds:'A nested sub-page (link)'},
  {t:'mention',   lbl:'Link / Mention',ico:'🔗',ds:'A formatted link with title & icon'},
  {t:'bookmark',  lbl:'Web Bookmark', ico:'🔖', ds:'Show a link as a visual card'},
  {t:'todo',      lbl:'To-do List',  ico:'☑',   ds:'Checkbox / task list item'},
  {t:'toggle',    lbl:'Toggle List', ico:'▸',   ds:'Collapsible block — hide content under a header'},
  {t:'bullet',    lbl:'Bullet List', ico:'•',   ds:'Unordered list item'},
  {t:'numbered',  lbl:'Numbered List',ico:'1.', ds:'Ordered list item'},
  {t:'alpha',     lbl:'Alphabetical List',ico:'a.',ds:'a, b, c… ordered list'},
  {t:'code',      lbl:'Code Block',  ico:'</>',  ds:'Preformatted code block'},
  {t:'math',      lbl:'Equation',    ico:'∑', ds:'A LaTeX math block (e.g. E = mc^2)'},
  {t:'divider',   lbl:'Divider',     ico:'—',   ds:'Horizontal separator line'},
  {t:'database',  lbl:'Database',    ico:'⊞',   ds:'Embed a table view inline'},
  {t:'db-board',  lbl:'Kanban Board',ico:'▥',   ds:'New database as a Kanban board'},
  {t:'db-calendar',lbl:'Database Calendar',ico:'▤',ds:'New database on a calendar'},
  {t:'image',     lbl:'Image',       ico:'🖼',  ds:'Upload or embed an image'},
  {t:'carousel',  lbl:'Image Carousel',ico:'❏', ds:'A row of thumbnails with labels'},
  {t:'youtube',   lbl:'YouTube',     ico:'▶',  ds:'Embed a video or bookmark'},
  {t:'grid',      lbl:'Table',       ico:'▦',  ds:'A simple editable grid'},
  {t:'file',      lbl:'File',        ico:'📎',  ds:'Upload a file attachment'},
];
const PH = {paragraph:"Type '/' for blocks…",h1:'Heading 1',h2:'Heading 2',h3:'Heading 3',
  quote:'Quote…',bullet:'List item',numbered:'List item',alpha:'List item',code:'Code…',
  todo:'To-do',toggle:'Toggle'};
/* ── Color-by-type map (Phase 1 keystone) ──
   One source of truth mapping each block type to a theme token, so the slash menu,
   block previews, and any future surface speak the same colour language. Values are
   CSS vars so they track the active theme (applyCfg overrides the tokens live). */
const BT_COL = {
  paragraph:'var(--c-docs)',
  h1:'var(--pu)', h2:'var(--pu)', h3:'var(--pu)', toggle:'var(--pu)',
  quote:'var(--go)', callout:'var(--ac)',
  todo:'var(--gr)', bullet:'var(--gr)', numbered:'var(--gr)', alpha:'var(--gr)',
  database:'var(--go)', 'db-board':'var(--go)', 'db-calendar':'var(--go)', grid:'var(--go)',
  image:'var(--c-docs)', carousel:'var(--c-docs)', youtube:'var(--c-docs)', file:'var(--c-docs)',
  page:'var(--ac)', mention:'var(--ac)', bookmark:'var(--ac)',
  code:'var(--mu)', math:'var(--mu)', divider:'var(--mu)',
};
function btCol(t){ return BT_COL[t] || 'var(--mu)'; }
const COLORS = ['#E05572','#5DC27A','#8B72D4','#D85858','#4D88E8','#D4A83C','#46B5A6','#9A7355'];

/* Emoji categories for icon picker */
const EMOJI_CATS = {
  'Smileys':    ['😀','😃','😄','😊','😍','🥰','😎','🤔','😅','😂','🤣','🙂','😉','🤩','🥳','😇','🤗','😏','🙄','😬','😔','😟','😮','😢','😭','😡','🤯','🥱','😴','😷','🤒','🥵','🥶','😈','👻','💀','🤖'],
  'People':     ['👶','🧒','👦','👧','🧑','👩','👨','🧓','👴','👵','👮','🧑‍💻','👩‍💻','👨‍💻','👩‍🎨','👨‍🎨','👩‍🏫','👨‍🏫','👩‍💼','👨‍💼','🧑‍🚀','👷','🕵️','🎅','🧙','🧝','🧜'],
  'Objects':    ['📝','📄','📁','📂','📅','📊','📌','📎','💡','🔦','📱','💻','⌨️','🖥️','📷','📸','📹','🎥','📞','📺','⌚','⏰','🔍','📚','📖','✏️','🖊️','🔑','🔒','💎','🏆','🎯'],
  'Nature':     ['🌱','🌿','🍀','🌲','🌳','🌴','🌵','🌺','🌸','🌼','🌻','🌾','🍂','🍁','🌙','⭐','🌟','✨','🌈','☀️','🌊','💧','🔥','❄️','🌍','🦋','🐝','🦊','🐺','🦁','🐉','🌋'],
  'Food':       ['🍎','🍊','🍋','🍇','🍓','🫐','🥑','🍕','🍔','🌮','🍜','🍣','☕','🧃','🍺','🍷','🎂','🍰','🍫','🍿','🍩','🧁','🥐','🥗','🍲','🍱','🥂','🧋'],
  'Travel':     ['🚗','🚕','✈️','🚀','🏠','🏢','🏰','🗼','🌆','🌇','🌃','🏖️','🏕️','⛰️','🏔️','🗺️','🧭','🚂','🚁','⛵','🚤','🌉','🗺️'],
  'Activities': ['⚽','🏀','🎾','🎮','🕹️','🎲','🧩','🎨','🎵','🎶','🎤','🎧','📚','🏋️','🏊','🚴','🤸','🎭','🎬','🎪','🏹','🎯','🧗','⛷️','🏄'],
  'Symbols':    ['❤️','🧡','💛','💚','💙','💜','🖤','💯','⭐','🔴','🟠','🟡','🟢','🔵','🟣','✅','❌','⚠️','💡','🔑','🌐','📌','🔖','♾️','🔮','💫','🎉','🎊'],
};

/* ═══════════════════════════════════════════════
   MINIMAL LINE-ICON LIBRARY
   A curated set of stroke icons (Lucide-style, 24×24) offered alongside emoji for a
   cleaner, more "designed" personalisation. Stored as the string  li:<name>[:#hex]
   so a colour can ride along with the icon. Each value is the SVG INNER markup. */
const LINE_ICONS = {
  // General
  'file':'<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4"/>',
  'folder':'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  'home':'<path d="M3 11l9-7 9 7"/><path d="M5 10v9h14v-9"/>',
  'star':'<path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6L12 17l-5.4 2.8 1-6L3.3 9.4l6-.9z"/>',
  'heart':'<path d="M12 20s-7-4.4-7-9.3A3.7 3.7 0 0 1 12 7a3.7 3.7 0 0 1 7 3.7C19 15.6 12 20 12 20z"/>',
  'bookmark':'<path d="M6 3h12v18l-6-4-6 4z"/>',
  'flag':'<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
  'bell':'<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  'calendar':'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/>',
  'clock':'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  'check':'<path d="M5 12l4 4L19 7"/>',
  'gear':'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  'search':'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
  'tag':'<path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  'pin':'<path d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10z"/><circle cx="12" cy="11" r="2"/>',
  'link':'<path d="M9 13a4 4 0 0 0 6 .5l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M15 11a4 4 0 0 0-6-.5l-3 3a4 4 0 0 0 6 6l1-1"/>',
  'bulb':'<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z"/>',
  'target':'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  'rocket':'<path d="M5 15c-1 1-1 4-1 4s3 0 4-1"/><path d="M9 15l-3-3c4-8 9-9 13-9 0 4-1 9-9 13z"/><circle cx="14.5" cy="9.5" r="1.5"/>',
  'flame':'<path d="M12 3c1 3-1 5-1 5s-3 2-3 6a4 4 0 0 0 8 0c0-2-1-3-1-3s2 1 2 4a6 6 0 0 1-12 0c0-5 7-7 7-12z"/>',
  'trophy':'<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M10 14h4M9 20h6M12 14v3"/>',
  'gift':'<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M4 13h16M12 9v11M12 9S10 4 8 6s4 3 4 3M12 9s2-5 4-3-4 3-4 3"/>',
  // Work
  'briefcase':'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  'chart':'<path d="M4 20V4M4 20h16"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/>',
  'trending':'<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
  'clipboard':'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4a3 3 0 0 1 6 0M9 11h6M9 15h6"/>',
  'edit':'<path d="M5 19h14"/><path d="M14 5l4 4-9 9H5v-4z"/>',
  'book':'<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M5 18a2 2 0 0 1 2-2h11"/>',
  'layers':'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  'grid':'<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
  'inbox':'<path d="M3 13l3-8h12l3 8v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 13h5l2 3h4l2-3h5"/>',
  'mail':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  'phone':'<path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  'camera':'<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
  // Media
  'play':'<path d="M7 4l13 8-13 8z"/>',
  'music':'<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  'image':'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 16l-5-5L5 20"/>',
  'video':'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
  'headphones':'<path d="M4 13a8 8 0 0 1 16 0"/><rect x="3" y="13" width="4" height="7" rx="1.5"/><rect x="17" y="13" width="4" height="7" rx="1.5"/>',
  'mic':'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  'gamepad':'<rect x="2" y="7" width="20" height="11" rx="4"/><path d="M7 11v3M5.5 12.5h3M15 12h.01M18 14h.01"/>',
  // Nature
  'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
  'moon':'<path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10z"/>',
  'cloud':'<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.5-1.5A3.5 3.5 0 0 1 17 18z"/>',
  'leaf':'<path d="M4 20c0-9 7-14 16-14 0 9-7 14-16 14z"/><path d="M4 20c4-6 8-8 12-9"/>',
  'tree':'<path d="M12 3l5 7h-3l4 6H6l4-6H7z"/><path d="M12 16v5"/>',
  'coffee':'<path d="M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M17 9h2a2 2 0 0 1 0 4h-2M6 3v2M10 3v2M14 3v2"/>',
  'globe':'<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4a14 14 0 0 1 0 16 14 14 0 0 1 0-16z"/>',
  'zap':'<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  'compass':'<circle cx="12" cy="12" r="8"/><path d="M15 9l-2 5-4 1 2-5z"/>',
  'droplet':'<path d="M12 3s6 6 6 10a6 6 0 0 1-12 0c0-4 6-10 6-10z"/>',
  // People
  'user':'<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>',
  'users':'<circle cx="9" cy="8" r="3.5"/><path d="M3 19a6 6 0 0 1 12 0"/><path d="M16 5a3.5 3.5 0 0 1 0 7M21 19a6 6 0 0 0-5-5.9"/>',
  'smile':'<circle cx="12" cy="12" r="8"/><path d="M9 10h.01M15 10h.01M8 14a4 4 0 0 0 8 0"/>',
};
const LINE_ICON_CATS = {
  'General':['file','folder','home','star','heart','bookmark','flag','bell','calendar','clock','check','gear','search','tag','pin','link','bulb','target','rocket','flame','trophy','gift'],
  'Work':['briefcase','chart','trending','clipboard','edit','book','layers','grid','inbox','mail','phone','camera'],
  'Media':['play','music','image','video','headphones','mic','gamepad'],
  'Nature':['sun','moon','cloud','leaf','tree','coffee','globe','zap','compass','droplet'],
  'People':['user','users','smile'],
};
/* Swatches for recolouring a line icon. The first ('') means "use the page's text
   colour" so an icon stays neutral by default. */
const LINE_ICON_COLORS = ['', '#E05572','#5DC27A','#8B72D4','#4D88E8','#D4A83C','#46B5A6','#D85858','#9A7355'];
function isLineIcon(v){ return typeof v==='string' && v.startsWith('li:'); }
function parseLineIcon(v){ const p=String(v).split(':'); return {name:p[1]||'', color:p[2]||''}; }
function lineIconSvg(name, color, px){
  const inner=LINE_ICONS[name]; if(!inner) return '';
  const size=px||'18px';
  const safe=(/^#[0-9a-fA-F]{3,8}$/.test(color||'')) ? color : 'currentColor';
  return `<svg class="li-svg" viewBox="0 0 24 24" fill="none" stroke="${safe}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:${size};height:${size};flex-shrink:0;display:inline-block;vertical-align:middle">${inner}</svg>`;
}
/* Inner markup for any icon value (line icon / image / emoji) — shared by the
   bespoke icon slots (page header, peek, DB header, callout) that don't go through
   iconHtml(). */
function iconInner(icon, px){
  if(!icon) return '';
  if(isLineIcon(icon)){ const p=parseLineIcon(icon); return lineIconSvg(p.name,p.color,px||'1em'); }
  if(isBlobRef(icon)||icon.startsWith('data:')||icon.startsWith('http')) return `<img src="${srcFor(icon)}" alt="icon">`;
  return icon;
}

/* ── FILE / ICON HELPERS ── */
function getFileIcon(mime){
  if(!mime) return '📎';
  if(mime.startsWith('image/')) return '🖼';
  if(mime.startsWith('video/')) return '🎥';
  if(mime.startsWith('audio/')) return '🎵';
  if(mime.includes('pdf'))      return '📕';
  if(mime.includes('word')||mime.includes('document')) return '📝';
  if(mime.includes('sheet')||mime.includes('excel'))   return '📊';
  if(mime.includes('presentation')||mime.includes('powerpoint')) return '📊';
  if(mime.includes('zip')||mime.includes('compressed')) return '🗜';
  if(mime.includes('text')) return '📄';
  return '📎';
}
function formatFileSize(bytes){
  if(!bytes) return '0 B';
  if(bytes<1024) return bytes+' B';
  if(bytes<1048576) return (bytes/1024).toFixed(1)+' KB';
  if(bytes<1073741824) return (bytes/1048576).toFixed(1)+' MB';
  return (bytes/1073741824).toFixed(1)+' GB';
}
function iconHtml(icon, size){
  if(!icon) return '';
  const px=size||'18px';
  if(isLineIcon(icon)){ const p=parseLineIcon(icon); return lineIconSvg(p.name,p.color,px); }
  if(isBlobRef(icon)||icon.startsWith('data:')||icon.startsWith('http')){
    return `<img src="${srcFor(icon)}" style="width:${px};height:${px};border-radius:3px;object-fit:cover;vertical-align:middle;flex-shrink:0;display:inline-block">`;
  }
  return `<span style="font-size:${px};line-height:1;flex-shrink:0;display:inline-block;vertical-align:middle">${icon}</span>`;
}

