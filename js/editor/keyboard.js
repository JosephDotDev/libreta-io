/* ═══════════════════════════════════════════════
   KEYBOARD HANDLER
═══════════════════════════════════════════════ */
function onBkKey(e,el){
  const id=el.dataset.id;

  /* Slash menu open → let it own Enter/Arrows/Escape (it navigates + selects and
     calls preventDefault) so the caret doesn't move in the page underneath. */
  if(S.slashId && ['Enter','ArrowUp','ArrowDown','Escape'].includes(e.key)) return;

  /* Inline formatting shortcuts: ⌘/Ctrl + B / I / U */
  if((e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey){
    const k=e.key.toLowerCase();
    if(k==='b'){e.preventDefault();fmtCmd('bold');return}
    if(k==='i'){e.preventDefault();fmtCmd('italic');return}
    if(k==='u'){e.preventDefault();fmtCmd('underline');return}
  }

  /* ENTER → split block (or, at the very start of a block with content, drop an
     empty line ABOVE and keep the caret where it is — Notion behaviour). */
  if(e.key==='Enter'&&!e.shiftKey){
    if(el.dataset.t==='code') return; // natural newline in code blocks
    e.preventDefault();
    const b=findBlock(id);
    if(isAtStart(el) && el.innerText.trim() && (!b||b.type!=='toggle')){ insertEmptyBlockAbove(id); return; }
    splitBlk(id,el); return;
  }

  /* BACKSPACE at start → merge or delete */
  if(e.key==='Backspace'){
    if(isAtStart(el)){
      e.preventDefault();
      const b=findBlock(id);
      if(b&&b.type==='toggle'){
        // never merge a toggle into the previous block; only delete if it's truly empty
        const hasContent=(b.children||[]).some(c=>(c.content||'').replace(/<[^>]+>/g,'').trim()||c.type!=='paragraph');
        if(!el.innerText.trim()&&!hasContent) delBlk(id);
        return;
      }
      if(!el.innerText.trim()) delBlk(id);
      else mergeWithPrev(id,el);
      return;
    }
  }

  /* Cmd/Ctrl+A → select all blocks (block selection, so they can be moved / deleted /
     formatted as a set). Two-stage like Notion: on an EMPTY block it selects every
     block immediately; on a block WITH text the first press selects that block's text
     (native), and a second press — once the text is already fully selected — escalates
     to selecting all blocks. Works wherever the block editor lives — main editor,
     side-peek, overview — via msSelectAll()'s currentCtId(). */
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'){
    const empty=!el.innerText.trim();
    let fullySelected=false;
    if(!empty){
      const sel=window.getSelection();
      if(sel&&sel.rangeCount&&!sel.isCollapsed){
        const r=sel.getRangeAt(0), full=document.createRange(); full.selectNodeContents(el);
        fullySelected = r.compareBoundaryPoints(Range.START_TO_START,full)<=0
                     && r.compareBoundaryPoints(Range.END_TO_END,full)>=0;
      }
    }
    if(empty||fullySelected){
      e.preventDefault();
      if(typeof msSelectAll==='function') msSelectAll();
    }
    // else: let the browser select this block's text first (don't preventDefault)
    return;
  }

  /* TAB → spaces */
  if(e.key==='Tab'){e.preventDefault();document.execCommand('insertText',false,'  ');return}

  /* Arrow key navigation between blocks */
  if(e.key==='ArrowUp'&&isAtTop(el)){e.preventDefault();focusAdj(id,-1)}
  if(e.key==='ArrowDown'&&isAtBot(el)){e.preventDefault();focusAdj(id,1)}
}

/* ═══════════════════════════════════════════════
   INPUT HANDLER — markdown triggers
═══════════════════════════════════════════════ */
function onBkInput(e,el){
  const id=el.dataset.id; const txt=el.innerText;

  /* Block-level markdown auto-conversion */
  if(checkBkMd(el,id)) return;

  /* Slash menu */
  if(txt==='/'&&!S.slashId){openSlash(el,id);return}
  // While a submenu (e.g. Database picker) is open, don't rebuild the canonical
  // list from the block's text — that would wipe the submenu.
  if(S.slashId===id&&S.slashSub) return;
  if(S.slashId===id&&txt.startsWith('/')){S.slashQ=txt.slice(1);renderSlashItems();return}
  else if(S.slashId) closeSlash();

  /* Inline markdown on closing delimiters */
  if(e.data==='*'||e.data==='`'||e.data==='~') processInline(el);

  saveBlk(id,el.innerHTML);
}

/* Block-level markdown: # → h1, > → quote, - → bullet etc. */
function checkBkMd(el,id){
  const txt=el.innerText;
  /* Inside a toggle header, #/##/### sets the header size instead of converting the block */
  if(el.getAttribute('data-t')==='toggle'){
    const hm=[{re:/^# $/,s:'h1'},{re:/^## $/,s:'h2'},{re:/^### $/,s:'h3'}].find(m=>m.re.test(txt));
    if(hm){ el.innerHTML=''; toggleSetSize(id,hm.s); el.focus(); putCursorEnd(el); return true; }
    return false;
  }
  const map=[
    {re:/^# $/,  t:'h1'},{re:/^## $/, t:'h2'},{re:/^### $/,t:'h3'},
    {re:/^> $/,  t:'quote'},{re:/^[-*] $/,t:'bullet'},{re:/^1\. $/,t:'numbered'},
    {re:/^a\. $/,t:'alpha'},{re:/^\[\s?\]\s$/,t:'todo'},
    {re:/^```$/,  t:'code'},{re:/^---$/,  t:'divider'},
  ];
  for(const m of map){
    if(m.re.test(txt)){
      if(m.t==='divider'){xformBlk(id,'divider','');}
      else{xformBlk(id,m.t,'');setTimeout(()=>{const e2=document.querySelector(`.bk[data-id="${id}"]`);if(e2){e2.focus();putCursorEnd(e2)}},0)}
      return true;
    }
  }
  return false;
}

/* Inline WYSIWYG: convert **bold**, *italic*, `code`, ~~del~~ */
function processInline(el){
  if(el.querySelector('.mention')) return; // don't flatten inline widgets like mentions
  const txt=el.innerText;
  let html=txt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g,'<em>$1</em>')
    .replace(/`([^`\n]+?)`/g,'<code>$1</code>')
    .replace(/~~(.+?)~~/g,'<del>$1</del>');
  if(html===txt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')) return;
  el.innerHTML=html;
  putCursorEnd(el);
}

