/* ═══════════════════════════════════════════════
   MATH / EQUATION BLOCKS  (KaTeX, lazy-loaded from CDN)
   A math block keeps its LaTeX source in block.content and renders it with
   KaTeX. KaTeX (script + stylesheet + fonts) is fetched on demand the first
   time a math block is shown, so pages without math pay nothing. Editing shows
   a source textarea with a live preview above it; clicking a rendered equation
   re-opens the editor.
═══════════════════════════════════════════════ */
const KATEX_VER='0.16.11';
let _katexPromise=null;
function loadKatex(){
  if(window.katex) return Promise.resolve(window.katex);
  if(_katexPromise) return _katexPromise;
  _katexPromise=new Promise((resolve,reject)=>{
    if(!document.getElementById('katex-css')){
      const css=document.createElement('link'); css.id='katex-css'; css.rel='stylesheet';
      css.href=`https://cdn.jsdelivr.net/npm/katex@${KATEX_VER}/dist/katex.min.css`;
      document.head.appendChild(css);
    }
    const s=document.createElement('script');
    s.src=`https://cdn.jsdelivr.net/npm/katex@${KATEX_VER}/dist/katex.min.js`;
    s.onload=()=>resolve(window.katex);
    s.onerror=()=>reject(new Error('KaTeX failed to load'));
    document.head.appendChild(s);
  });
  return _katexPromise;
}
/* Render LaTeX (or a placeholder / error) into a given host element. */
function renderMathInto(host, src){
  if(!host) return;
  src=(src||'').trim();
  if(!src){ host.innerHTML='<span class="bk-math-ph">Click to add an equation…</span>'; return; }
  const draw=()=>{ try{ window.katex.render(src, host, {displayMode:true, throwOnError:false, errorColor:'#C45454'}); }
    catch(e){ host.textContent=''; host.innerHTML='<span class="bk-math-err">Invalid LaTeX</span>'; } };
  if(window.katex){ draw(); return; }
  host.innerHTML='<span class="bk-math-ph">Loading…</span>';
  loadKatex().then(draw).catch(()=>{ host.innerHTML='<span class="bk-math-err">Couldn’t load the math renderer.</span>'; });
}
function renderMathBlock(blk){ if(blk) renderMathInto(document.querySelector(`.bk-math[data-id="${blk.id}"]`), blk.content); }
/* Open the LaTeX editor for a math block. */
function mathEdit(id){
  const wrap=document.querySelector(`.bk-math-wrap[data-id="${id}"]`); if(!wrap) return;
  wrap.classList.add('editing');
  const ta=wrap.querySelector('.bk-math-src');
  if(ta){ ta.style.display='block'; ta.focus(); try{ ta.setSelectionRange(ta.value.length, ta.value.length); }catch(e){} }
}
function mathOnInput(id,val){ saveBlk(id,val); renderMathBlock(findBlock(id)); }
function mathBlur(id){
  const wrap=document.querySelector(`.bk-math-wrap[data-id="${id}"]`); if(!wrap) return;
  wrap.classList.remove('editing');
  const ta=wrap.querySelector('.bk-math-src'); if(ta) ta.style.display='none';
  renderMathBlock(findBlock(id));
}
