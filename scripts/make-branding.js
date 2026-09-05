#!/usr/bin/env node
/* Renders Libreta's app icon and installer artwork with the app's own vendored fonts,
   via headless Chromium, into src-tauri/branding/. Rarely needed — only when the mark
   or the installer art changes. The outputs are committed.

   Why a browser: the mark is set in Cormorant, and `tauri icon` rasterises SVG without
   web fonts (that is how 1.0.x shipped a blank dark square). Rendering in Chromium
   uses the exact same font files the app ships.

   Run:   npm i --no-save playwright-core && CHROME=/path/to/chrome node scripts/make-branding.js
          (CHROME may be omitted if `npx playwright install chromium` has been run)
   Then:  npx tauri icon src-tauri/branding/icon-1024.png -o src-tauri/icons
          and delete the android/ and ios/ folders it adds — the desktop build doesn't use them. */
const { chromium } = require('playwright-core');
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..'), PORT=8757;
const OUT=process.argv[2]||path.join(ROOT,'src-tauri','branding');
const PREVIEW=process.argv[3]||OUT;
const MIME={'.css':'text/css','.woff2':'font/woff2','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'};
const srv=http.createServer((q,res)=>{ let p=decodeURIComponent(q.url.split('?')[0]); const f=path.join(ROOT,p); fs.readFile(f,(e,d)=>{ if(e){res.statusCode=404;res.end();return;} res.setHeader('Content-Type',MIME[path.extname(f)]||'application/octet-stream'); res.end(d); }); }).listen(PORT);

const FONTS=`<link rel="stylesheet" href="http://localhost:${PORT}/css/00-fonts.css">`;
const T={ bg:'#0D0C0F', sur:'#17161B', bd:'#221F2A', tx:'#E2DCD4', mu:'#857F8C', bl:'#4D88E8', ac:'#E05572', go:'#D4A83C', iconBg:'#141210', cream:'#E4DDD0', orange:'#C47D32' };
const base=(w,h,bg,extra='')=>`<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${bg}}
  *{box-sizing:border-box}
  .serif{font-family:'Cormorant',Georgia,serif}.sans{font-family:'DM Sans',system-ui,sans-serif}.mono{font-family:'DM Mono',ui-monospace,monospace}
  .brand{font-family:'Cormorant',Georgia,serif;font-weight:600;letter-spacing:.01em;color:${T.tx}} .brand i{font-style:normal;color:${T.bl}}
  ${extra}</style></head><body>`;

/* The mark: dark rounded square on a transparent canvas (≈88% so macOS shows it at the
   same size as its neighbours), a Cormorant "L" and the orange full stop. */
function markSvg(size){
  const s=size, pad=Math.round(s*0.06), box=s-pad*2, r=Math.round(box*0.225);
  return `<div style="position:absolute;left:${pad}px;top:${pad}px;width:${box}px;height:${box}px;border-radius:${r}px;
      background:linear-gradient(160deg,#1c1a17 0%,${T.iconBg} 55%,#0f0e0c 100%);box-shadow:inset 0 ${Math.round(s*0.004)}px 0 rgba(255,255,255,.06)">
    <div class="serif" style="position:absolute;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;
      font-weight:600;font-size:${Math.round(box*0.72)}px;line-height:1;color:${T.cream};letter-spacing:-.02em;padding-right:${Math.round(box*0.06)}px;padding-bottom:${Math.round(box*0.04)}px">L<span style="color:${T.orange}">.</span></div>
  </div>`;
}
const PAGES={
  'icon-1024.png': { w:1024,h:1024, transparent:true, html: base(1024,1024,'transparent')+markSvg(1024)+'</body></html>' },

  // NSIS header (right side of the wizard header, text is drawn beside it)
  'installer-header.png': { w:150,h:57, html: base(150,57,T.bg)+`
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-end;padding-right:14px">
      ${markSvg(34).replace('position:absolute','position:relative;display:inline-block')}
      <span class="brand" style="font-size:24px;margin-left:8px">Libre<i>ta</i></span>
    </div></body></html>` },

  // NSIS sidebar (welcome + finish pages, full left column)
  'installer-sidebar.png': { w:164,h:314, html: base(164,314,T.bg,`.sw{position:absolute;pointer-events:none}`)+`
    <svg class="sw" style="left:-40px;top:190px" width="260" height="160" viewBox="0 0 260 160"><path d="M0 120 C 60 70, 150 70, 260 110" fill="none" stroke="${T.bl}" stroke-width="26" stroke-linecap="round" opacity=".16"/></svg>
    <svg class="sw" style="left:90px;top:250px" width="120" height="80" viewBox="0 0 120 80"><path d="M0 60 C 40 30, 80 30, 120 55" fill="none" stroke="${T.ac}" stroke-width="14" stroke-linecap="round" opacity=".14"/></svg>
    <div style="position:absolute;left:0;top:0;width:164px;padding:26px 18px 0;text-align:left">
      <div style="position:relative;width:64px;height:64px">${markSvg(64)}</div>
      <div class="brand" style="font-size:34px;margin-top:16px;line-height:1">Libre<i>ta</i></div>
      <div class="sans" style="font-size:11.5px;color:${T.mu};margin-top:10px;line-height:1.5;font-weight:300">A personal workspace, built around you.</div>
      <div class="mono" style="font-size:9.5px;color:${T.mu};margin-top:22px;line-height:1.7;opacity:.85">No account<br>No server<br>Works offline</div>
    </div></body></html>` },

  // WiX banner: WiX draws the page title in BLACK over the left of this strip → keep it light there
  'wix-banner.png': { w:493,h:58, html: base(493,58,'#F4F1EC')+`
    <div style="position:absolute;right:0;top:0;height:58px;width:150px;background:${T.bg};display:flex;align-items:center;justify-content:center;gap:8px">
      <div style="position:relative;width:30px;height:30px">${markSvg(30)}</div>
      <span class="brand" style="font-size:22px">Libre<i>ta</i></span>
    </div></body></html>` },

  // WiX welcome/finish dialog: text is drawn over the right ~2/3 → light there, dark art column on the left
  'wix-dialog.png': { w:493,h:312, html: base(493,312,'#FFFFFF')+`
    <div style="position:absolute;left:0;top:0;width:164px;height:312px;background:${T.bg};overflow:hidden">
      <svg style="position:absolute;left:-40px;top:200px" width="260" height="160" viewBox="0 0 260 160"><path d="M0 120 C 60 70, 150 70, 260 110" fill="none" stroke="${T.bl}" stroke-width="26" stroke-linecap="round" opacity=".16"/></svg>
      <div style="position:absolute;left:18px;top:26px"><div style="position:relative;width:64px;height:64px">${markSvg(64)}</div>
        <div class="brand" style="font-size:34px;margin-top:16px;line-height:1">Libre<i>ta</i></div>
        <div class="sans" style="font-size:11.5px;color:${T.mu};margin-top:10px;line-height:1.5;font-weight:300;width:128px">A personal workspace, built around you.</div></div>
    </div></body></html>` },

  // DMG window background 660×400; app icon lands at (180,170), Applications at (480,170)
  'dmg-background.png': { w:660,h:400, html: base(660,400,T.bg)+`
    <svg style="position:absolute;left:-60px;top:-20px" width="800" height="300" viewBox="0 0 800 300"><path d="M0 200 C 200 120, 500 120, 800 190" fill="none" stroke="${T.bl}" stroke-width="40" stroke-linecap="round" opacity=".10"/></svg>
    <svg style="position:absolute;left:380px;top:300px" width="360" height="140" viewBox="0 0 360 140"><path d="M0 100 C 100 50, 240 50, 360 90" fill="none" stroke="${T.ac}" stroke-width="22" stroke-linecap="round" opacity=".10"/></svg>
    <div class="brand" style="position:absolute;left:0;right:0;top:34px;text-align:center;font-size:40px;line-height:1">Libre<i>ta</i></div>
    <div class="sans" style="position:absolute;left:0;right:0;top:82px;text-align:center;font-size:14px;color:${T.mu};font-weight:300">Drag Libreta into Applications to install</div>
    <svg style="position:absolute;left:270px;top:150px" width="120" height="40" viewBox="0 0 120 40"><path d="M6 20 H 100 M 84 6 L 102 20 L 84 34" fill="none" stroke="${T.tx}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/></svg>
    <div style="position:absolute;left:40px;right:40px;bottom:26px;padding:12px 16px;border:1px solid ${T.bd};border-radius:10px;background:${T.sur}">
      <div class="sans" style="font-size:12px;color:${T.tx};margin-bottom:4px">First launch — macOS will say Libreta “is damaged”. It isn’t. Run this once in Terminal, then open it:</div>
      <div class="mono" style="font-size:12.5px;color:${T.go}">xattr -cr /Applications/Libreta.app</div>
    </div></body></html>` },
};

/* 24-bit BMP from RGBA pixels (rows bottom-up, 4-byte padded). Alpha is composited on `bgHex`. */
function toBmp(rgba,w,h,bgHex){
  const bg=[parseInt(bgHex.slice(1,3),16),parseInt(bgHex.slice(3,5),16),parseInt(bgHex.slice(5,7),16)];
  const rowBytes=Math.ceil(w*3/4)*4, size=54+rowBytes*h, b=Buffer.alloc(size,0);
  b.write('BM',0); b.writeUInt32LE(size,2); b.writeUInt32LE(54,10); b.writeUInt32LE(40,14);
  b.writeInt32LE(w,18); b.writeInt32LE(h,22); b.writeUInt16LE(1,26); b.writeUInt16LE(24,28); b.writeUInt32LE(rowBytes*h,34);
  b.writeInt32LE(2835,38); b.writeInt32LE(2835,42);
  for(let y=0;y<h;y++){ const src=(h-1-y)*w*4; let o=54+y*rowBytes;
    for(let x=0;x<w;x++){ const i=src+x*4, a=rgba[i+3]/255;
      b[o++]=Math.round(rgba[i+2]*a+bg[2]*(1-a)); b[o++]=Math.round(rgba[i+1]*a+bg[1]*(1-a)); b[o++]=Math.round(rgba[i]*a+bg[0]*(1-a)); } }
  return b;
}

(async()=>{
  const browser=await chromium.launch({ executablePath:process.env.CHROME||undefined, args:['--no-sandbox'] });
  const ctx=await browser.newContext({deviceScaleFactor:1});
  const page=await ctx.newPage();
  for(const [name,spec] of Object.entries(PAGES)){
    await page.setViewportSize({width:spec.w,height:spec.h});
    await page.setContent(spec.html,{waitUntil:'load'});
    await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(150);
    const png=await page.screenshot({omitBackground:!!spec.transparent, clip:{x:0,y:0,width:spec.w,height:spec.h}});
    fs.writeFileSync(path.join(PREVIEW,name),png);
    if(/^(installer|wix)-/.test(name)){
      // decode the PNG in-page and write a BMP next to it
      const rgba=await page.evaluate(async(b64)=>{ const img=new Image(); img.src='data:image/png;base64,'+b64; await img.decode();
        const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; const g=c.getContext('2d'); g.drawImage(img,0,0);
        const d=g.getImageData(0,0,c.width,c.height).data; let s=''; for(let i=0;i<d.length;i+=8192) s+=String.fromCharCode.apply(null,d.subarray(i,i+8192)); return btoa(s); }, png.toString('base64'));
      const bmp=toBmp(Buffer.from(rgba,'base64'),spec.w,spec.h,'#FFFFFF');
      fs.writeFileSync(path.join(OUT,name.replace(/\.png$/,'.bmp')),bmp);
    }else{
      fs.writeFileSync(path.join(OUT,name),png);
    }
    console.log('wrote',name,spec.w+'x'+spec.h);
  }
  await browser.close(); srv.close();
})();
