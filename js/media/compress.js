/* ═══════════════════════════════════════════════
   IMAGE COMPRESSION
═══════════════════════════════════════════════ */
function compressImage(file, maxW, maxH, quality){
  return new Promise(resolve=>{
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{
      URL.revokeObjectURL(url);
      let w=img.width, h=img.height;
      if(w>maxW||h>maxH){const r=Math.min(maxW/w,maxH/h);w=Math.round(w*r);h=Math.round(h*r)}
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      resolve(canvas.toDataURL('image/jpeg',quality));
    };
    img.onerror=()=>{URL.revokeObjectURL(url);const r=new FileReader();r.onload=e=>resolve(e.target.result);r.readAsDataURL(file)};
    img.src=url;
  });
}

