/* ═══════════════════════════════════════════════════════════════════════════
   SECURITY HELPERS  —  URL scheme allow-listing + HTML sanitization
   ---------------------------------------------------------------------------
   Libreta is a single-user private workspace, but two boundaries take in data
   we don't fully control and feed it back into the DOM:
     1. Link targets the user pastes / types (mentions, URL properties).
     2. Backup files imported via Settings → Data & Backup → Import.
   A crafted `javascript:` link or a malicious backup could otherwise run script
   in our origin — and our origin holds the Supabase session token (full account
   takeover + access to everything in cloud Storage). These helpers neutralize
   both: `safeUrl()` collapses dangerous schemes; `sanitizeHtml()` strips script,
   event handlers and dangerous elements from untrusted rich-text content.
═══════════════════════════════════════════════════════════════════════════ */

/* Allow only schemes that can't execute script. Everything else
   (javascript:, data:, vbscript:, file:, …) collapses to '#'. Relative,
   anchor and scheme-less links are passed through (treated as web links). */
function safeUrl(u){
  const s = String(u == null ? '' : u).trim();
  if(!s) return '';
  // Browsers ignore control chars / whitespace when resolving a scheme, so an
  // attacker can hide one inside "java\tscript:". Strip them before testing.
  const probe = s.replace(/[\x00-\x20]+/g, '').toLowerCase();
  if(/^(javascript|data|vbscript|file|blob):/.test(probe)) return '#';
  // Has an explicit scheme → only http(s)/mailto/tel are allowed through.
  if(/^[a-z][a-z0-9+.\-]*:/.test(probe)){
    return /^(https?|mailto|tel):/.test(probe) ? s : '#';
  }
  // No scheme → relative / anchor / protocol-relative link: safe to keep.
  return s;
}

/* Tags whose entire subtree is removed (they execute script, load remote
   resources, or carry interactive/scripting surface we never store as content). */
const _SANITIZE_DROP = new Set([
  'SCRIPT','STYLE','IFRAME','OBJECT','EMBED','LINK','META','BASE','TITLE','HEAD',
  'FORM','INPUT','BUTTON','SELECT','OPTION','TEXTAREA','SVG','MATH','FRAME',
  'FRAMESET','APPLET','AUDIO','VIDEO','SOURCE','TRACK','CANVAS','NOSCRIPT','TEMPLATE'
]);

/* Inline / structural rich-text tags that contenteditable legitimately produces.
   Anything not here is "unwrapped" (its text is kept, the tag itself dropped),
   so sanitizing only ever loses formatting — never the user's words. */
const _SANITIZE_ALLOW = new Set([
  'A','ABBR','B','STRONG','I','EM','U','S','STRIKE','DEL','INS','MARK','CODE',
  'PRE','KBD','SAMP','VAR','BR','SPAN','SUB','SUP','SMALL','BLOCKQUOTE',
  'UL','OL','LI','P','DIV','H1','H2','H3','H4','H5','H6','HR'
]);

/* Whitelist-based HTML sanitizer. Parses into an inert <template> (so no image
   loads, no script runs, no resources fetch during parsing), walks every node,
   drops dangerous elements, unwraps unknown ones, and strips event-handler
   attributes, inline styles and unsafe URL schemes. Returns clean HTML. */
function sanitizeHtml(html){
  if(html == null) return html;
  const str = String(html);
  if(str.indexOf('<') === -1 && str.indexOf('&') === -1) return str; // plain text fast-path
  const tpl = document.createElement('template');
  tpl.innerHTML = str;                       // inert: template content is parsed, never live
  const root = tpl.content;
  for(const el of Array.from(root.querySelectorAll('*'))){
    if(!root.contains(el)) continue;          // already removed along with an ancestor
    const tag = el.tagName;
    if(_SANITIZE_DROP.has(tag)){ el.remove(); continue; }
    if(!_SANITIZE_ALLOW.has(tag)){            // unknown but harmless → keep children, drop the tag
      const parent = el.parentNode;
      while(el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      continue;
    }
    for(const attr of Array.from(el.attributes)){
      const n = attr.name.toLowerCase();
      if(n.startsWith('on') || n === 'style' || n === 'srcdoc' || n === 'formaction'){
        el.removeAttribute(attr.name); continue;
      }
      if(n === 'href' || n === 'src' || n === 'xlink:href' || n === 'action' || n === 'data-url'){
        const safe = safeUrl(attr.value);
        if(safe === '#' || safe === '') el.removeAttribute(attr.name);
        else el.setAttribute(attr.name, safe);
      }
    }
  }
  return tpl.innerHTML;
}

/* Colours stored on user data (select/status option colours, row colour rules)
   are interpolated into style="…" attributes at render time. In-app they're only
   ever palette hexes; anything else in an imported file is an attribute-breakout
   attempt (or corruption) and collapses to a neutral grey. */
function safeCssColor(c){
  return (typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c)) ? c : '#888888';
}

/* Sanitize an imported document set, in place. Two fields render as raw HTML:
   block `content` and grid-table cells (which legitimately hold inline tags —
   mentions, formatting). Colour-rule colours land in style attributes, so they're
   clamped to plain hex. Everything else (titles, captions, property values) is
   plain text escaped at render time via escHtml — no rewriting needed here. */
function sanitizeImportedDocs(docs){
  const scanBlocks=(blocks)=>{
    for(const b of (blocks || [])){
      if(!b) continue;
      if(typeof b.content === 'string') b.content = sanitizeHtml(b.content);
      if(b.grid && Array.isArray(b.grid.rows)){
        b.grid.rows.forEach(row=>{ (row || []).forEach((cell,i)=>{ if(typeof cell === 'string') row[i] = sanitizeHtml(cell); }); });
      }
      if(Array.isArray(b.colorRules)) b.colorRules.forEach(r=>{ if(r) r.color = safeCssColor(r.color); });
      // Recurse into layout containers so nested blocks get the same treatment.
      if(Array.isArray(b.cols)) b.cols.forEach(scanBlocks);
      if(Array.isArray(b.children)) scanBlocks(b.children);
    }
  };
  for(const d of (docs || [])) scanBlocks(d.blocks);
  return docs;
}

/* Sanitize imported database tables, in place. Cell values and column names are
   escaped at render, but option colours (and the full-page view's colour rules)
   are interpolated into style attributes — clamp them to plain hex. */
function sanitizeImportedTables(tables){
  for(const t of (tables || [])){
    if(!t) continue;
    for(const col of (t.columns || [])){
      (col && col.options || []).forEach(o=>{ if(o) o.c = safeCssColor(o.c); });
    }
    if(Array.isArray(t._colorRules)) t._colorRules.forEach(r=>{ if(r) r.color = safeCssColor(r.color); });
  }
  return tables;
}
