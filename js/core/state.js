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
const COLORS = ['#C47D32','#4E9E72','#7E6FBE','#C45454','#4E7EC4','#C9A84C','#5E9BAA','#8C6A3E'];

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
  if(isBlobRef(icon)||icon.startsWith('data:')||icon.startsWith('http')){
    return `<img src="${srcFor(icon)}" style="width:${px};height:${px};border-radius:3px;object-fit:cover;vertical-align:middle;flex-shrink:0;display:inline-block">`;
  }
  return `<span style="font-size:${px};line-height:1;flex-shrink:0;display:inline-block;vertical-align:middle">${icon}</span>`;
}

