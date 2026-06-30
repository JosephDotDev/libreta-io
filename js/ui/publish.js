/* ═══════════════════════════════════════════════
   PUBLISH — export a page as a self-contained web page (Phase 4)

   Renders the current page to a single styled, read-only HTML file the user can
   open or host anywhere. Fully local: images (and an image cover) are inlined as
   data URLs, so the file stands alone with no backend and no server cost — true
   to the local-first, no-lock-in model.
═══════════════════════════════════════════════ */
async function _urlToDataURL(url){
  try{
    if(!url) return '';
    if(url.indexOf('data:')===0) return url;
    const res=await fetch(url); const blob=await res.blob();
    return await new Promise(resolve=>{ const fr=new FileReader(); fr.onload=()=>resolve(fr.result); fr.onerror=()=>resolve(''); fr.readAsDataURL(blob); });
  }catch(e){ return ''; }
}
function _pubStrip(s){ return (s||'').replace(/<[^>]+>/g,''); }
function _pubBlock(b, imgMap){
  const c=b.content||'';
  switch(b.type){
    case 'h1': return `<h1>${c}</h1>`;
    case 'h2': return `<h2>${c}</h2>`;
    case 'h3': return `<h3>${c}</h3>`;
    case 'quote': return `<blockquote>${c}</blockquote>`;
    case 'callout': return `<div class="co">${c}</div>`;
    case 'divider': return `<hr>`;
    case 'code': return `<pre><code>${escHtml(_pubStrip(c))}</code></pre>`;
    case 'todo': return `<div class="td"><span class="cb${b.checked?' on':''}"></span><span>${c}</span></div>`;
    case 'toggle': return `<details><summary>${c}</summary>${_pubBlocks(b.children||[], imgMap)}</details>`;
    case 'image': { const u=imgMap[b.src]||''; if(!u) return '';
      const cap=(b.caption&&!b.hideCaption)?`<figcaption>${escHtml(b.caption)}</figcaption>`:'';
      return `<figure><img src="${u}" alt="${escAttr(b.caption||'')}">${cap}</figure>`; }
    case 'page': case 'mention': case 'bookmark': {
      const t=escHtml(_pubStrip(c)||b.url||'Link'); const href=b.url&&typeof safeUrl==='function'?safeUrl(b.url):'';
      return href?`<p><a href="${href}" rel="noopener">${t}</a></p>`:(t?`<p>${t}</p>`:''); }
    case 'paragraph': default: return _pubStrip(c).trim()?`<p>${c}</p>`:'';
  }
}
function _pubBlocks(blocks, imgMap){
  const out=[]; let i=0;
  while(i<(blocks||[]).length){
    const b=blocks[i];
    if(b.type==='bullet'||b.type==='numbered'){
      const tag=b.type==='bullet'?'ul':'ol'; const items=[];
      while(i<blocks.length && blocks[i].type===b.type){ items.push(`<li>${blocks[i].content||''}</li>`); i++; }
      out.push(`<${tag}>${items.join('')}</${tag}>`); continue;
    }
    const h=_pubBlock(b, imgMap); if(h) out.push(h); i++;
  }
  return out.join('\n');
}
function _pubDocument(title, iconHtml, coverHtml, body, dateStr){
  const headPad = coverHtml ? '30px' : '76px';
  const css = ":root{--bg:#0D0C0F;--tx:#ECE6DE;--mu:#8B8498;--ac:#E05572;--sur:#1A1822;--bd:#332E40}"
    + "*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}"
    + "body{margin:0;background:var(--bg);color:var(--tx);font-family:'Newsreader',Georgia,serif;font-size:18px;line-height:1.8}"
    + ".pcover{height:210px;background-size:cover;background-position:center;background-color:var(--sur)}.pcover-accent{background:var(--ac)}"
    + ".pwrap{max-width:680px;margin:0 auto;padding:0 26px 90px}"
    + ".phead{padding-top:"+headPad+"}.picon{font-size:40px;line-height:1;margin-bottom:12px}"
    + ".ptitle{font-family:'Cormorant',Georgia,serif;font-weight:600;font-size:42px;line-height:1.08;margin:0 0 8px;letter-spacing:.01em}"
    + ".pmeta{color:var(--mu);font-size:13px;font-family:system-ui,-apple-system,sans-serif;margin-bottom:34px}"
    + ".pbody h1{font-family:'Cormorant',serif;font-size:30px;font-weight:600;margin:32px 0 10px}.pbody h2{font-family:'Cormorant',serif;font-size:25px;font-weight:600;margin:28px 0 8px}.pbody h3{font-family:'Cormorant',serif;font-size:21px;font-weight:600;margin:24px 0 6px}"
    + ".pbody p{margin:0 0 18px}.pbody a{color:var(--ac)}"
    + ".pbody blockquote{border-left:3px solid var(--ac);margin:0 0 18px;padding:2px 0 2px 18px;color:#d7d0c6;font-style:italic}"
    + ".pbody .co{background:rgba(224,85,114,.09);border-left:3px solid var(--ac);border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 18px}"
    + ".pbody hr{border:none;border-top:1px solid var(--bd);margin:30px 0}"
    + ".pbody figure{margin:0 0 20px}.pbody img{max-width:100%;border-radius:10px;display:block}.pbody figcaption{color:var(--mu);font-size:13px;text-align:center;margin-top:7px;font-family:system-ui,sans-serif}"
    + ".pbody ul,.pbody ol{margin:0 0 18px;padding-left:24px}.pbody li{margin:0 0 6px}"
    + ".pbody .td{display:flex;gap:10px;align-items:flex-start;margin:0 0 9px}.pbody .td .cb{width:18px;height:18px;border:1.5px solid var(--mu);border-radius:5px;flex-shrink:0;margin-top:6px}.pbody .td .cb.on{background:var(--ac);border-color:var(--ac)}"
    + ".pbody pre{background:var(--sur);border:1px solid var(--bd);border-radius:8px;padding:14px;overflow:auto;font-family:ui-monospace,monospace;font-size:14px;line-height:1.55}"
    + ".pbody details{margin:0 0 14px}.pbody summary{cursor:pointer}"
    + ".pfoot{border-top:1px solid var(--bd);margin-top:44px;padding:20px 0 0;text-align:center;color:var(--mu);font-size:13px;font-family:system-ui,-apple-system,sans-serif}.pfoot a{color:var(--mu)}";
  return "<!DOCTYPE html>\n<html lang=\"en\"><head>\n"
    + "<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
    + "<title>"+title+"</title>\n"
    + "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"><link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n"
    + "<link href=\"https://fonts.googleapis.com/css2?family=Cormorant:wght@500;600&family=Newsreader:ital@0;1&display=swap\" rel=\"stylesheet\">\n"
    + "<style>"+css+"</style></head>\n<body>\n"
    + coverHtml
    + "<div class=\"pwrap\"><div class=\"phead\">"+iconHtml+"<h1 class=\"ptitle\">"+title+"</h1><div class=\"pmeta\">Updated "+dateStr+"</div></div>\n"
    + "<div class=\"pbody\">"+body+"</div>\n"
    + "<div class=\"pfoot\">Made with <a href=\"https://libreta.io\" rel=\"noopener\">Libreta</a> · your workspace, your data</div>\n"
    + "</div></body></html>";
}
async function publishPage(docId){
  const id=docId||S.docId;
  if(!id || id===HOME_ID){ if(typeof toast==='function') toast('Open a page to share'); return; }
  const doc=(typeof DB!=='undefined')?DB.getDoc(id):null;
  if(!doc){ if(typeof toast==='function') toast('That page no longer exists'); return; }
  if(typeof toast==='function') toast('Building your page…',{type:'info'});
  // Inline all images (body + cover) as data URLs so the file is self-contained.
  const leaves=(typeof flattenBlocks==='function')?flattenBlocks(doc.blocks||[]):(doc.blocks||[]);
  const imgSrcs=[...new Set(leaves.filter(b=>b.type==='image'&&b.src).map(b=>b.src))];
  const imgMap={};
  await Promise.all(imgSrcs.map(async s=>{ imgMap[s]=await _urlToDataURL(srcFor(s)); }));
  let coverHtml='';
  const cover=doc.meta&&doc.meta.cover;
  if(cover){
    if(typeof isAccentCover==='function'&&isAccentCover(cover)){ coverHtml='<div class="pcover pcover-accent"></div>'; }
    else { const cu=await _urlToDataURL(srcFor(cover)); if(cu) coverHtml='<div class="pcover" style="background-image:url(\''+cu+'\')"></div>'; }
  }
  const icon=doc.meta&&doc.meta.icon;
  const iconStr=(icon && !(typeof isBlobRef==='function'&&isBlobRef(icon))) ? '<div class="picon">'+iconHtml(icon,'40px')+'</div>' : '';
  const body=_pubBlocks(doc.blocks||[], imgMap);
  const title=escHtml(doc.title||'Untitled');
  const dateStr=new Date(doc.updatedAt||Date.now()).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
  const html=_pubDocument(title, iconStr, coverHtml, body, dateStr);
  const blob=new Blob([html],{type:'text/html'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=((doc.title||'page').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase()||'page')+'.html';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  if(typeof toast==='function') toast('Saved as a web page',{type:'success'});
}
