/* ═══════════════════════════════════════════════
   TEMPLATES — pre-built workspaces

   Each template builds a single top-level page seeded with blocks (and, where useful,
   an inline database) so a new user lands in something concrete instead of a blank
   page. Templates are constructed live (not stored), so they always match the current
   block/table model.
═══════════════════════════════════════════════ */

/* ── builders ── */
function _tplCol(name,type,opts){ const c={id:mkId('c'),name,type}; if(opts) c.options=opts; return c; }
function _tplOpt(l,c){ return {l,c}; }
/* Make a table from columns + rows-by-name; rows is an array of {ColName:value}. */
function _tplTable(name,cols,rows,extra){
  const now=new Date().toISOString();
  const t={id:mkId('t'),name,titleCol:cols[0].id,columns:cols,rows:[],createdAt:now,updatedAt:now};
  if(extra&&extra.icon) t.icon=extra.icon;
  (rows||[]).forEach(byName=>{
    const cells={}; cols.forEach(c=>{ cells[c.id] = (byName[c.name]!=null?byName[c.name]:''); });
    t.rows.push({id:mkId('r'),cells});
  });
  DB.saveTbl(t); return t;
}
function _dbBlock(tableId,view){ return {id:mkId('b'),type:'database',tableId,content:'',view:view||'table'}; }
function _b(type,content){ const blk=mkBlock(type,content||''); return blk; }
function _callout(content,icon){ const blk=mkBlock('callout',content||''); blk.icon=icon||'💡'; return blk; }
function _toggle(head,childLines){ const blk=mkBlock('toggle',head||''); blk.children=(childLines||[]).map(l=>mkBlock('paragraph',l)); blk.open=false; return blk; }

/* Finalise: persist the doc and open it. */
function _tplFinish(title,icon,blocks,meta){
  const d=blankDoc();
  d.title=title; d.blocks=blocks&&blocks.length?blocks:[mkBlock('paragraph')];
  d.meta=d.meta||{}; if(icon) d.meta.icon=icon; if(meta) Object.assign(d.meta,meta);
  DB.saveDoc(d);
  if(typeof renderSidebarTree==='function') renderSidebarTree();
  nav('editor',d.id);
  if(typeof toast==='function') toast('Template added');
  return d;
}

const PC=(typeof COLORS!=='undefined')?COLORS:['#E05572','#5DC27A','#8B72D4','#D85858','#4D88E8','#D4A83C','#46B5A6','#9A7355'];

/* ── the templates ── */
const TEMPLATES=[
  {
    id:'tutorial', icon:'👋', title:'Getting started',
    desc:'A guided tour of Libreta — blocks, databases, and making pages your own.',
    build(){
      const tbl=_tplTable('Reading list',[
        _tplCol('Title','text'),
        _tplCol('Status','status',[_tplOpt('To read',PC[3]),_tplOpt('Reading',PC[0]),_tplOpt('Done',PC[1])]),
        _tplCol('Added','date'),
      ],[
        {Title:'Atomic Habits',Status:'Reading'},
        {Title:'The Pragmatic Programmer',Status:'To read'},
      ],{icon:'📚'});
      return _tplFinish('Getting started','👋',[
        _b('h1','Welcome to Libreta 👋'),
        _b('paragraph','This is your space to think, plan, and write. Here’s everything you need to get going.'),
        _callout('Type <strong>/</strong> on any empty line to insert headings, lists, to-dos, images, databases and more.','💡'),
        _b('h2','The basics'),
        _b('bullet','Press <strong>/</strong> for the block menu — try /todo, /h2, /quote, /image.'),
        _b('bullet','Hover a line and drag the ⠿ handle to reorder. Drag from the left margin to select several blocks at once.'),
        _b('bullet','Select a block (or all of them with Ctrl/⌘+A) to move, delete, or format them together.'),
        _b('todo','Try checking me off'),
        _b('h2','Make it yours'),
        _b('bullet','Add an <strong>icon</strong> and a <strong>cover</strong> from the buttons above the title.'),
        _b('bullet','Open <strong>Page options</strong> (top-right) to set a typeface, width, or a <strong>page background</strong>.'),
        _b('h2','Databases'),
        _b('paragraph','Databases turn a page into a table, board, or calendar. Here’s a small one:'),
        _dbBlock(tbl.id,'table'),
        _toggle('Handy keyboard shortcuts',[
          'Ctrl/⌘ + B / I / U — bold, italic, underline',
          'Ctrl/⌘ + A — select the block, again to select all blocks',
          '/ — open the block menu',
          'Enter at the start of a line — add a line above',
        ]),
        _b('paragraph',''),
      ]);
    }
  },
  {
    id:'content', icon:'🎬', title:'Content creation',
    desc:'Plan posts across platforms with a content calendar board and an idea backlog.',
    build(){
      const tbl=_tplTable('Content calendar',[
        _tplCol('Title','text'),
        _tplCol('Platform','select',[_tplOpt('YouTube',PC[0]),_tplOpt('Instagram',PC[2]),_tplOpt('TikTok',PC[4]),_tplOpt('Blog',PC[5])]),
        _tplCol('Status','status',[_tplOpt('Idea',PC[7]),_tplOpt('Scripting',PC[5]),_tplOpt('Filming',PC[0]),_tplOpt('Editing',PC[2]),_tplOpt('Published',PC[1])]),
        _tplCol('Publish','date'),
      ],[
        {Title:'Channel trailer',Platform:'YouTube',Status:'Editing'},
        {Title:'Behind the scenes',Platform:'Instagram',Status:'Idea'},
        {Title:'Quick tip #1',Platform:'TikTok',Status:'Filming'},
        {Title:'How I plan content',Platform:'Blog',Status:'Scripting'},
      ],{icon:'🎬'});
      return _tplFinish('Content creation','🎬',[
        _b('h1','Content hub 🎬'),
        _b('paragraph','Everything from spark to publish in one place.'),
        _callout('Drag cards between columns as they move through your pipeline.','📌'),
        _b('h2','Calendar'),
        _dbBlock(tbl.id,'board'),
        _b('h2','Idea backlog'),
        _b('bullet','Series idea: …'),
        _b('bullet','Collab idea: …'),
        _b('bullet','Trending topic to cover: …'),
        _b('h2','Hooks & captions'),
        _b('paragraph','Keep reusable hooks and captions here.'),
        _b('paragraph',''),
      ]);
    }
  },
  {
    id:'startup', icon:'🚀', title:'Startup idea',
    desc:'Pressure-test an idea — problem, solution, market — and track early milestones.',
    build(){
      const tbl=_tplTable('Milestones',[
        _tplCol('Task','text'),
        _tplCol('Owner','text'),
        _tplCol('Status','status',[_tplOpt('Backlog',PC[7]),_tplOpt('In progress',PC[0]),_tplOpt('Done',PC[1])]),
        _tplCol('Due','date'),
      ],[
        {Task:'Validate the problem with 5 interviews',Status:'In progress'},
        {Task:'Build a landing page',Status:'Backlog'},
        {Task:'Ship a clickable prototype',Status:'Backlog'},
      ],{icon:'🚀'});
      return _tplFinish('Startup idea','🚀',[
        _b('h1','Startup canvas 🚀'),
        _b('paragraph','One page to sharpen the idea before you build.'),
        _b('h2','Problem'),
        _callout('What painful, frequent problem are you solving — and for whom?','❓'),
        _b('h2','Solution'),
        _b('paragraph','Describe the smallest version that delivers real value.'),
        _b('h2','Target audience'),
        _b('paragraph','Who feels this most? Be specific.'),
        _b('h2','Why now / why us'),
        _b('paragraph','What changed, and why are you the team to do it?'),
        _b('h2','Business model'),
        _b('bullet','How does it make money?'),
        _b('bullet','What does it cost to deliver?'),
        _b('h2','Milestones'),
        _dbBlock(tbl.id,'table'),
        _b('paragraph',''),
      ]);
    }
  },
  {
    id:'media', icon:'📚', title:'Media backlog',
    desc:'Track books, games, movies and shows — what’s next, in progress, and finished.',
    build(){
      const tbl=_tplTable('Backlog',[
        _tplCol('Title','text'),
        _tplCol('Type','select',[_tplOpt('Book',PC[2]),_tplOpt('Game',PC[0]),_tplOpt('Movie',PC[4]),_tplOpt('Show',PC[5]),_tplOpt('Podcast',PC[6])]),
        _tplCol('Status','status',[_tplOpt('Backlog',PC[7]),_tplOpt('In progress',PC[0]),_tplOpt('Finished',PC[1]),_tplOpt('Dropped',PC[3])]),
        _tplCol('Rating','select',[_tplOpt('★',PC[3]),_tplOpt('★★',PC[5]),_tplOpt('★★★',PC[5]),_tplOpt('★★★★',PC[1]),_tplOpt('★★★★★',PC[1])]),
        _tplCol('Notes','text'),
      ],[
        {Title:'Dune',Type:'Book',Status:'Finished',Rating:'★★★★★'},
        {Title:'Hades',Type:'Game',Status:'In progress',Rating:'★★★★'},
        {Title:'Severance',Type:'Show',Status:'Backlog'},
        {Title:'Everything Everywhere All at Once',Type:'Movie',Status:'Finished',Rating:'★★★★★'},
      ],{icon:'📚'});
      return _tplFinish('Media backlog','📚',[
        _b('h1','Media backlog 📚'),
        _b('paragraph','Everything you want to read, play, and watch — in one tidy list.'),
        _callout('Switch the view (Table / Board) from the database header to group by status.','🎛️'),
        _dbBlock(tbl.id,'table'),
        _b('paragraph',''),
      ]);
    }
  },
];

/* ── gallery modal ── */
function _tplModalEl(){
  let m=document.getElementById('tpl-modal');
  if(!m){ m=document.createElement('div'); m.id='tpl-modal'; m.className='tpl-modal'; document.body.appendChild(m); }
  return m;
}
function openTemplateGallery(){
  const m=_tplModalEl();
  const cards=TEMPLATES.map(t=>`
    <button class="tpl-card" onclick="useTemplate('${t.id}')">
      <div class="tpl-card-ico">${t.icon}</div>
      <div class="tpl-card-body">
        <div class="tpl-card-title">${escHtml(t.title)}</div>
        <div class="tpl-card-desc">${escHtml(t.desc)}</div>
      </div>
    </button>`).join('');
  m.innerHTML=`<div class="tpl-backdrop" onclick="closeTemplateGallery()"></div>
    <div class="tpl-panel">
      <div class="tpl-head">
        <div><div class="tpl-h1">Start from a template</div><div class="tpl-sub">Pre-built workspaces to get going fast. You can change anything afterwards.</div></div>
        <button class="tpl-close" onclick="closeTemplateGallery()" title="Close">✕</button>
      </div>
      <div class="tpl-grid">
        ${cards}
        <button class="tpl-card tpl-card-blank" onclick="closeTemplateGallery();newDoc()">
          <div class="tpl-card-ico">＋</div>
          <div class="tpl-card-body"><div class="tpl-card-title">Blank page</div><div class="tpl-card-desc">Start from scratch.</div></div>
        </button>
      </div>
    </div>`;
  m.classList.add('open');
}
function closeTemplateGallery(){ const m=document.getElementById('tpl-modal'); if(m) m.classList.remove('open'); }
function useTemplate(id){
  const t=TEMPLATES.find(x=>x.id===id); if(!t) return;
  closeTemplateGallery();
  try{ t.build(); }catch(e){ console.error('template build failed',e); if(typeof toast==='function') toast('Could not create template'); }
}
