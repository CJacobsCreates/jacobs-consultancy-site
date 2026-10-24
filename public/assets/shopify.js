// Shopify page: screenshot lightbox (progressive: links open the image directly without JS)
(()=>{try{const d=document.querySelector('dialog.lbox');if(!d||typeof d.showModal!=='function')return;const im=d.querySelector('img');let last=null;
document.querySelectorAll('a[data-lb]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();last=a;const s=a.querySelector('img');im.src=a.href;im.alt=s?s.alt:'';d.showModal()}));
const close=()=>{d.close()};d.querySelector('button').addEventListener('click',close);d.addEventListener('click',e=>{if(e.target===d)close()});d.addEventListener('close',()=>{im.removeAttribute('src');if(last)last.focus()});
}catch(err){console.error('[shopify]',err)}})();
