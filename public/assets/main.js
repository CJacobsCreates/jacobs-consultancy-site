const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
// --- core ---
try{
const nav=document.querySelector('nav');addEventListener('scroll',()=>nav.classList.toggle('s',scrollY>30),{passive:true});
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.r').forEach((el,i)=>{el.style.transitionDelay=(el.dataset.d||0)+'ms';io.observe(el)});
document.getElementById('y').textContent=new Date().getFullYear();
}catch(err){console.error('[core]',err);document.querySelectorAll('.r').forEach(e=>e.classList.add('in'))}
// --- menu ---
try{
(()=>{const b=document.querySelector('.menu'),n=document.querySelector('nav');if(!b)return;const set=o=>{n.classList.toggle('open',o);b.setAttribute('aria-expanded',o);b.setAttribute('aria-label',o?'Close menu':'Open menu')};
b.addEventListener('click',()=>set(!n.classList.contains('open')));n.querySelectorAll('ul a').forEach(a=>a.addEventListener('click',()=>set(false)));addEventListener('keydown',e=>e.key==='Escape'&&set(false))})();
}catch(err){console.error('[menu]',err)}
// --- modal ---
try{
// project modal (native dialog: Escape + focus containment), backdrop click closes
(()=>{const d=document.getElementById('project');if(!d)return;if(!d.showModal){d.showModal=()=>d.setAttribute('open','');d.close=()=>{d.removeAttribute('open');d.dispatchEvent(new Event('close'))}}let last=null;
const open=e=>{e&&e.preventDefault();last=document.activeElement;document.querySelector('nav')?.classList.remove('open');d.showModal();document.documentElement.style.overflow='hidden';setTimeout(()=>d.querySelector('input[name=name]')?.focus(),30)};
const close=()=>d.close();d.addEventListener('close',()=>{document.documentElement.style.overflow='';last&&last.focus()});
document.querySelectorAll('[data-open-project]').forEach(b=>b.addEventListener('click',open));window.openProject=open;
d.querySelector('[data-close]').addEventListener('click',close);
d.addEventListener('click',e=>{if(e.target===d)close()});
d.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const f=[...d.querySelectorAll('button,input:not([type=hidden]):not([name=bot-field]),select,textarea')].filter(x=>x.offsetParent);const a=f[0],z=f[f.length-1];
if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}});
if(location.hash==='#start')open()})();
window.__globes=window.__globes||{};
}catch(err){console.error('[modal]',err)}
// --- globe ---
try{
// 3D dotted globe (shared by hero + tour)
const D2R=Math.PI/180,RM2=RM;
const ll=(la,lo)=>{la*=D2R;lo*=D2R;return[Math.cos(la)*Math.sin(lo),Math.sin(la),Math.cos(la)*Math.cos(lo)]};
const fib=n=>{const a=[],g=Math.PI*(3-Math.sqrt(5));for(let i=0;i<n;i++){const y=1-2*i/(n-1),r=Math.sqrt(1-y*y),th=g*i;a.push([Math.cos(th)*r,y,Math.sin(th)*r])}return a};
const LIFT_MAX=.18;const HOME={n:'Cape Town',la:-33.9,lo:18.4,dx:8,dy:-6};
const CAPS=[['Cairo',30.0,31.2,8,12],['London',51.5,-.1,-52,-6],['Berlin',52.5,13.4,8,-6],['Madrid',40.4,-3.7,-48,12],['New York',40.71,-74.01,8,-6],['Los Angeles',34.05,-118.24,8,-6],['Austin',30.27,-97.74,8,12],['São Paulo',-23.5,-46.6,8,-6],['Dubai',25.2,55.3,8,-6],['Singapore',1.35,103.8,8,-6],['Tokyo',35.7,139.7,8,-6],['Sydney',-33.9,151.2,8,-6],['Toronto',43.65,-79.38,-58,-8],['Shanghai',31.23,121.47,-62,-6],['Nairobi',-1.29,36.82,8,12],['Lagos',6.52,3.38,-44,12],['Mumbai',19.08,72.88,8,12]].map(([n,la,lo,dx,dy])=>({n,la,lo,dx,dy,p:ll(la,lo)}));
HOME.p=ll(HOME.la,HOME.lo);
function Globe(c,o){const x=c.getContext('2d');let W,H,D,pts,stars=[];const g={lon:20,lat:15,t:0,focus:null,pw:1,tp:1};
// power 0..1 (lights-off demo): item k of n switches on/off in sequence
const sm=v=>v<=0?0:v>=1?1:v*v*(3-2*v);g.e=(k,n)=>{const S=1.3;return sm(g.pw*(1+S)-S*k/Math.max(1,n-1))};
g.size=()=>{D=Math.min(devicePixelRatio||1,2);W=c.clientWidth;H=c.clientHeight;c.width=W*D;c.height=H*D;x.setTransform(D,0,0,D,0,0);pts=[];const Ld=window.LAND||[];for(let i=0;i<Ld.length;i+=2)pts.push(ll(Ld[i],Ld[i+1]));
stars=o.stars===false?[]:Array.from({length:Math.min(420,Math.round(W*H/4200))},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.2+.45,a:Math.random()*.5+.4,p:Math.random()*6,s:.5+Math.random()*1.4}))};
const LIFT=o.lift||.18;
// great-circle point, lifted above the surface proportionally to arc length
const gc=(a,b,f,d)=>{const s=Math.sin(d)||1,A=Math.sin((1-f)*d)/s,B=Math.sin(f*d)/s,h=1+LIFT*(d/Math.PI)*Math.sin(Math.PI*f);return[(A*a[0]+B*b[0])*h,(A*a[1]+B*b[1])*h,(A*a[2]+B*b[2])*h]};
g.draw=()=>{const t=g.t;x.clearRect(0,0,W,H);
x.fillStyle='#f4fbff';for(const s of stars){x.globalAlpha=s.a*(.62+.38*Math.sin(t*s.s+s.p))*(.3+.7*g.pw);if(s.r>1.1){x.beginPath();x.arc(s.x,s.y,s.r*.6,0,7);x.fill()}else x.fillRect(s.x,s.y,s.r,s.r)}
// occasional shooting star (hero only; never while the lights are off or under reduced motion)
if(o.shoot&&!RM2){if(window.__off||g.pw<1){g.sh=null;g.next=t+4+Math.random()*6}else{if(g.next==null)g.next=t+3+Math.random()*5;
 if(!g.sh&&t>=g.next){const dir=Math.random()<.5?1:-1,ang=(18+Math.random()*30)*D2R;g.sh={x:W*(.15+Math.random()*.7),y:H*(.05+Math.random()*.4),dx:Math.cos(ang)*dir,dy:Math.sin(ang),v:W<700?380:620,len:W<700?110:190,d:.8+Math.random()*.4,t0:t}}
 if(g.sh){const S=g.sh,p=(t-S.t0)/S.d;if(p>=1){g.sh=null;g.next=t+6+Math.random()*9}else{const f=p<.15?p/.15:1-(p-.15)/.85,hx=S.x+S.dx*S.v*p*S.d,hy=S.y+S.dy*S.v*p*S.d,L=S.len*(.4+.6*Math.min(1,p*3)),tx=hx-S.dx*L,ty=hy-S.dy*L;
  const gr2=x.createLinearGradient(hx,hy,tx,ty);gr2.addColorStop(0,'rgba(255,255,255,.95)');gr2.addColorStop(.25,'rgba(234,244,255,.45)');gr2.addColorStop(1,'rgba(255,255,255,0)');
  x.globalAlpha=f;x.strokeStyle=gr2;x.lineWidth=1.7;x.lineCap="round";x.beginPath();x.moveTo(hx,hy);x.lineTo(tx,ty);x.stroke();x.fillStyle='#fff';x.beginPath();x.arc(hx,hy,1.3,0,7);x.fill();x.fillStyle='#f4fbff'}}}}
const L=o.layout(W,H),R=L.r,cx=L.cx,cy=L.cy,a=-g.lon*D2R,b=g.lat*D2R,cY=Math.cos(a),sY=Math.sin(a),cP=Math.cos(b),sP=Math.sin(b);
const P=p=>{const X=p[0]*cY+p[2]*sY,Z=-p[0]*sY+p[2]*cY,Y=p[1];return[X,Y*cP-Z*sP,Y*sP+Z*cP]};
const gr=x.createRadialGradient(cx,cy,R*.5,cx,cy,R*1.3);gr.addColorStop(0,'rgba(234,214,166,.07)');gr.addColorStop(1,'transparent');x.globalAlpha=1;x.fillStyle=gr;x.beginPath();x.arc(cx,cy,R*1.3,0,7);x.fill();
x.strokeStyle='rgba(234,214,166,.18)';x.lineWidth=1;x.beginPath();x.arc(cx,cy,R,0,7);x.stroke();
x.fillStyle='#cfdde2';const dz=Math.max(1.3,R/170);for(const p of pts){const q=P(p);if(q[2]<0)continue;x.globalAlpha=.15+.6*q[2];const sz=dz*(.7+.5*q[2]);x.fillRect(cx+q[0]*R,cy-q[1]*R,sz,sz)}
const list=o.tour?CAPS.filter(C=>C.n===g.focus):CAPS,hq=P(HOME.p),shown=[];
// arcs: only when both endpoints face the viewer, so every arc is whole and connected
x.strokeStyle='#ead6a6';x.shadowColor='#ead6a6';x.shadowBlur=8;x.lineWidth=o.tour?1.8:1.3;
list.forEach((C,k)=>{const cq=P(C.p),vis=Math.min(hq[2],cq[2]);if(vis<.08)return;shown.push(C);
const d=Math.acos(Math.max(-1,Math.min(1,HOME.p[0]*C.p[0]+HOME.p[1]*C.p[1]+HOME.p[2]*C.p[2]))),N=Math.max(16,Math.round(d*40));
const ek=o.power?g.e(k,list.length):1;if(ek<=.002)return;const grow=ek,cf=RM2?-1:((t*.3+k*.37)%1.6);x.globalAlpha=Math.min(1,(vis-.08)*5)*(o.tour?1:.85)*(.25+.75*ek);x.beginPath();
for(let i=0;i<=N;i++){const f=i/N*grow,q=P(gc(HOME.p,C.p,f,d));const X=cx+q[0]*R,Y=cy-q[1]*R;i?x.lineTo(X,Y):x.moveTo(X,Y)}x.stroke();});x.shadowBlur=0;
const dots=o.tour?[HOME,...shown]:[HOME,...CAPS],placed=[];for(const C of dots){const q=P(C.p);if(q[2]>=.05)placed.push([cx+q[0]*R-4,cy-q[1]*R-4,8,8])}
for(const C of dots){const q=P(C.p);if(q[2]<.05)continue;const X=cx+q[0]*R,Y=cy-q[1]*R,hub=C===HOME,foc=C.n===g.focus,ph=Math.sin(t*2.4+X*.05),pk=o.power?(hub?.25+.75*sm(g.pw*2.3-.0):g.e(CAPS.indexOf(C),CAPS.length)):1,fa=Math.min(1,(q[2]-.05)*6)*pk;if(fa<.01)continue;
x.globalAlpha=fa;x.fillStyle='#ead6a6';x.beginPath();x.arc(X,Y,foc?5:hub?3.6:2.3,0,7);x.fill();x.globalAlpha=fa*(.35+.4*ph);x.strokeStyle='#ead6a6';x.beginPath();x.arc(X,Y,(foc?12:hub?7:5)+3*ph,0,7);x.stroke();
if(o.tour&&!foc)continue;x.font=foc?'600 14px Outfit,sans-serif':(W<700?9:10)+'px "JetBrains Mono",monospace';const lab=foc||hub?C.n:C.n.toUpperCase(),tw=x.measureText(lab).width,th=foc?14:10;
 // try the preferred offset, then right / left / below; skip the label if it would collide with one already drawn
 const cand=foc?[[12,-10]]:[[C.dx,C.dy],[8,-6],[-tw-8,-6],[8,13],[-tw-8,13]];let pos=null;
 for(const [ox,oy] of cand){const r=[X+ox-2,Y+oy-th,tw+4,th+4];if(!placed.some(p=>r[0]<p[0]+p[2]&&p[0]<r[0]+r[2]&&r[1]<p[1]+p[3]&&p[1]<r[1]+r[3])){pos=[ox,oy];placed.push(r);break}}
 if(!pos)continue;x.globalAlpha=fa*((foc||hub)?1:.55*q[2]+.3);x.fillStyle=foc?'#fff':'#ead6a6';x.fillText(lab,X+pos[0],Y+pos[1])}
x.globalAlpha=1};
g.size();addEventListener('resize',()=>{g.size();g.draw()});return g}
let vis={};const loopers=[];
function run(id,g,step){const c=document.getElementById(id);if(!c)return;vis[id]=true;new IntersectionObserver(e=>vis[id]=e[0].isIntersecting).observe(c);loopers.push(()=>{if(!vis[id]||document.hidden)return;if(g.power){g.tp=window.__gp===0?0:1;const d=g.tp-g.pw;g.pw=Math.abs(d)<.012?g.tp:g.pw+Math.sign(d)*.012;if(window.__off&&g.pw===g.tp&&!g.dirty)return;g.dirty=g.pw!==g.tp}else if(window.__off)return;if(!window.__off){step&&step();g.t+=.016}g.draw()})}
const hc=document.getElementById('sky');if(hc){const hg=window.__hg=Globe(hc,{power:1,shoot:1,layout:(W,H)=>W<1000?{r:Math.min(W*.4,H*.2),cx:W*.66,cy:H*.25}:{r:Math.min(H*.32,W*.2),cx:W*.73,cy:H*.52}});hg.lat=12;hg.power=1;window.__globePower=v=>{window.__gp=v;if(RM){hg.pw=v;hg.draw()}};
if(RM){hg.lon=10;hg.t=8;hg.draw()}else run('sky',hg,()=>{if(!window.__freeze)hg.lon-=.1})}
// Scroll-step city tour: one active index drives both card and globe
const tc=document.getElementById('tglobe'),cards=[...document.querySelectorAll('.tcard')],track=document.querySelector('.tour-track');
if(tc&&cards.length&&track){const TOUR=[['London',51.5,-.1],['Dubai',25.2,55.3],['Singapore',1.35,103.8],['New York',40.7,-74],['Los Angeles',34.05,-118.2]];
const tg=Globe(tc,{tour:true,stars:false,lift:.32,layout:(W,H)=>{const r=Math.min(H*.42,W*.42)/1.32;return{r,cx:W/2,cy:H/2}}});
// view centre: along the CT->city great circle, as close to the city as possible while keeping Cape Town on the front side
const views=TOUR.map(([n,la,lo])=>{const p=ll(la,lo),H0=HOME.p,d=Math.acos(H0[0]*p[0]+H0[1]*p[1]+H0[2]*p[2]),f=Math.min(.8,(68*D2R)/d),s=Math.sin(d),A=Math.sin((1-f)*d)/s,B=Math.sin(f*d)/s;
let v=[A*H0[0]+B*p[0],A*H0[1]+B*p[1],A*H0[2]+B*p[2]];
// tilt the view off the arc's plane so the arc reads as a curve, never an edge-on straight line
let nn=[H0[1]*p[2]-H0[2]*p[1],H0[2]*p[0]-H0[0]*p[2],H0[0]*p[1]-H0[1]*p[0]];const nl=Math.hypot(...nn);nn=nn.map(c=>c/nl);if(nn[1]<0)nn=nn.map(c=>-c);
const th=-28*D2R;v=v.map((c,i)=>c*Math.cos(th)+nn[i]*Math.sin(th));
return{n,lat:Math.asin(v[1])/D2R,lon:Math.atan2(v[0],v[2])/D2R}});
let act=-1,cur={lon:views[0].lon,lat:views[0].lat};
const step=()=>{const r=track.getBoundingClientRect(),tot=r.height-innerHeight,pr=Math.max(0,Math.min(.9999,-r.top/Math.max(1,tot)));const i=Math.floor(pr*views.length);
if(i!==act){act=i;cards.forEach((c,k)=>c.classList.toggle('on',k===i));tg.focus=views[i].n}return views[i]};
const apply=k=>{const T=step();let dl=T.lon-cur.lon;if(dl>180)dl-=360;if(dl<-180)dl+=360;cur.lon+=dl*k;cur.lat+=(T.lat-cur.lat)*k;tg.lon=cur.lon;tg.lat=cur.lat};
window.__tgv=()=>[Math.round(tg.lon),Math.round(tg.lat),tg.focus];apply(1);tg.draw();if(RM){tg.t=8;const f=()=>{apply(1);tg.draw()};addEventListener('scroll',f,{passive:true});f()}else run('tglobe',tg,()=>apply(.1))}
(function L(){loopers.forEach(f=>f());requestAnimationFrame(L)})();
}catch(err){console.error('[globe]',err)}
// --- services ---
try{
// services: run card animations only while visible; revenue counter
(()=>{const cs=document.querySelectorAll('.card,.step');const vio=new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('play',e.isIntersecting&&!RM)),{threshold:.2});cs.forEach(c=>vio.observe(c));
const el=document.querySelector('[data-count]');if(!el)return;const max=+el.dataset.count,fmt=n=>'$'+n.toLocaleString('en-US');if(RM){el.textContent=fmt(max);return}
let v=0;setInterval(()=>{if(!el.closest('.card').classList.contains('play')||document.hidden)return;v+=Math.round(40+Math.random()*120);if(v>max)v=0;el.textContent=fmt(v)},400)})();

}catch(err){console.error('[services]',err)}

// --- contact page: Book a call + ?need= preset ---
try{
const sel=document.querySelector('#cpage select[name=need]');
const setNeed=v=>{if(!sel)return;const o=[...sel.options].find(o=>o.text.toLowerCase()===v.toLowerCase());if(o){sel.value=o.value||o.text;sel.dispatchEvent(new Event('change'))}};
document.querySelectorAll('[data-book-call]').forEach(b=>b.addEventListener('click',()=>{setNeed('Book a call');const m=document.querySelector('#cpage textarea');if(m&&!m.value)m.value="I'd like to book a call. Times that suit me: ";document.querySelector('#cpage input[name=name]')?.focus()}));
// ?error=<code> from /api/contact: only known codes are shown, as fixed text (never reflected)
const EMSG={read:'We could not read your message. Please try again.',missing:'Please fill in your name, email, what you need and a message.',email:'Please enter a valid email address.',config:'Our form is not configured yet. Please email info@thejacobsconsultancy.com.',captcha:'Please complete the security check and try again.',captcha_failed:'The security check failed. Please refresh the page and try again.',captcha_error:'We could not verify the security check. Please try again.',send:'Sorry, your message could not be sent. Please email info@thejacobsconsultancy.com.',origin:'Please send your message from the contact form on our website.',size:'Your message is too long. Please shorten it and try again.'};
const er=new URLSearchParams(location.search).get('error'),cf=document.getElementById('cpage');if(er&&cf){const d=document.createElement('p');d.className='ferr';d.setAttribute('role','alert');d.textContent=Object.prototype.hasOwnProperty.call(EMSG,er)?EMSG[er]:EMSG.send;cf.prepend(d)}
const q=new URLSearchParams(location.search).get('need');if(q)setNeed(q==='call'?'Book a call':q);
}catch(err){console.error('[contact]',err)}

// --- terminal typer (v15) ---
try{(()=>{const pre=document.querySelector('[data-term]');if(!pre)return;const code=pre.querySelector('code');const src=[...code.childNodes].map(n=>n.cloneNode(true));
const card=pre.closest('.card');if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
// flatten into [char, className|null]
const seq=[];src.forEach(n=>{const cls=n.nodeType===1?n.className:null;for(const ch of n.textContent)seq.push([ch,cls])});
const cur=document.createElement('span');cur.className='cur';let i=0,wait=0;
const render=()=>{code.textContent='';let last=null,el=null;for(let k=0;k<i;k++){const [ch,c]=seq[k];if(c!==last||!el){el=c?document.createElement('span'):document.createTextNode('');if(c)el.className=c;code.appendChild(el);last=c}if(c)el.textContent+=ch;else el.appendData(ch)}code.appendChild(cur)};
render();
setInterval(()=>{if(document.hidden||(card&&!card.classList.contains('play')))return;if(wait>0){wait--;return}
if(i>=seq.length){i=0;render();wait=6;return}const ch=seq[i][0];i++;
// output lines appear quickly; typed code a char at a time
if(ch==='\n'){wait=seq[i]&&seq[i][1]==='c'||seq[i]&&seq[i][1]==='ok'?5:3}
render();if(i>=seq.length)wait=40},45)})()}catch(err){console.error('[term]',err)}

// --- v21: deep-dive tabs, one-shot visuals, ops dashboard ---
try{(()=>{
const ERAS=['e0','e1','e2','e3'],COST=['100%','78%','58%','38%'];
const setEra=(el,k)=>{const w=el.querySelector('.mwin');if(!w)return;w.classList.remove(...ERAS);w.classList.add(ERAS[k]);el.querySelectorAll('.mod-era span').forEach((s,i)=>s.classList.toggle('on',i===k));const c=el.querySelector('.mod-cost i');if(c)c.style.setProperty('--w',COST[k])};
const count=el=>el.querySelectorAll('[data-to]').forEach(b=>{const to=+b.dataset.to,dec=+(b.dataset.dec||0),suf=b.dataset.suf||'',f=v=>(dec?v.toFixed(dec):Math.round(v).toLocaleString('en-ZA'))+suf;if(RM){b.textContent=f(to);return}const t0=performance.now(),D=1400;const st=t=>{const p=Math.min(1,(t-t0)/D),e=1-Math.pow(1-p,3);b.textContent=f(to*e);if(p<1)requestAnimationFrame(st)};requestAnimationFrame(st)});
const play=el=>{clearInterval(el.__t);el.classList.remove('play');void el.offsetWidth;el.classList.add('play');count(el);
 if(el.classList.contains('dv-mod')){if(RM){setEra(el,3);return}let k=0;setEra(el,0);el.__t=setInterval(()=>{k++;setEra(el,k);if(k>=3)clearInterval(el.__t)},1500)}};
const inView=new WeakMap();
const io=new IntersectionObserver(es=>es.forEach(e=>{inView.set(e.target,e.isIntersecting);const p=e.target.closest('.dd-panel');if(e.isIntersecting&&(!p||p.classList.contains('on'))&&!e.target.__done){e.target.__done=true;play(e.target)}}),{threshold:.35});
document.querySelectorAll('.dv').forEach(v=>io.observe(v));
document.querySelectorAll('[data-tabs]').forEach(dd=>{const tabs=[...dd.querySelectorAll('[role=tab]')],pans=[...dd.querySelectorAll('[role=tabpanel]')];dd.classList.add('ready');
 const strip=dd.querySelector('.dd-tabs');
 // centre the chosen tab inside the strip only (never scrolls the page vertically)
 const centre=i=>{if(!strip||strip.scrollWidth<=strip.clientWidth+1)return;const t=tabs[i],sr=strip.getBoundingClientRect(),tr=t.getBoundingClientRect();strip.scrollTo({left:strip.scrollLeft+(tr.left-sr.left)-(strip.clientWidth-tr.width)/2,behavior:RM?'auto':'smooth'})};
 const fade=()=>{if(!strip)return;const m=strip.scrollWidth-strip.clientWidth;strip.classList.toggle('fl',m>1&&strip.scrollLeft>2);strip.classList.toggle('fr',m>1&&strip.scrollLeft<m-2)};
 if(strip){strip.addEventListener('scroll',fade,{passive:true});addEventListener('resize',fade);fade()}
 const sel=(i,focus)=>{tabs.forEach((t,k)=>{const on=k===i;t.setAttribute('aria-selected',on);t.tabIndex=on?0:-1;pans[k].classList.toggle('on',on);if(on)pans[k].removeAttribute('inert');else pans[k].setAttribute('inert','')});
  if(focus)tabs[i].focus({preventScroll:true});centre(i);
  const v=pans[i].querySelector('.dv');if(v){v.__done=true;play(v)}};
 pans.forEach((p,k)=>{if(k)p.setAttribute('inert','')});
 tabs.forEach((t,i)=>{t.addEventListener('click',()=>sel(i,false));t.addEventListener('keydown',e=>{let j=null;if(e.key==='ArrowRight')j=(i+1)%tabs.length;else if(e.key==='ArrowLeft')j=(i-1+tabs.length)%tabs.length;else if(e.key==='Home')j=0;else if(e.key==='End')j=tabs.length-1;if(j!==null){e.preventDefault();sel(j,true)}})});
 pans.forEach(p=>{const v=p.querySelector('.dv');if(v&&!p.classList.contains('on'))v.__done=false});
});
// looping visuals (.dz without one-shot): play only while visible
const loop=new IntersectionObserver(es=>es.forEach(e=>{const el=e.target;if(el.classList.contains('dv'))return;el.classList.toggle('play',e.isIntersecting&&!RM);el.querySelectorAll('svg').forEach(s=>{try{(e.isIntersecting&&!RM)?s.unpauseAnimations():s.pauseAnimations()}catch(_){}})}),{threshold:.15});
document.querySelectorAll('.dz').forEach(el=>{if(!el.classList.contains('dv'))loop.observe(el)});
// ops dashboard
document.querySelectorAll('.x-ops').forEach(o=>{
 o.querySelectorAll('svg').forEach(s=>{try{s.pauseAnimations()}catch(_){}});
 const clk=o.querySelector('.clock'),ol=o.querySelector('.ops-feed ol'),feed=JSON.parse(o.dataset.feed||'[]');let fi=0;
 const hm=d=>d.toTimeString().slice(0,5);
 const push=(txt,anim)=>{const li=document.createElement('li');if(anim)li.className='new';const t=document.createElement('time');t.textContent=hm(new Date());li.append(t,document.createTextNode(txt));ol.prepend(li);while(ol.children.length>4)ol.lastChild.remove()};
 for(let k=0;k<4;k++)push(feed[(fi++)%feed.length],false);
 const tick=()=>{if(clk)clk.textContent=new Date().toTimeString().slice(0,8)};tick();
 const val=(k,v)=>{const b=o.querySelector(`[data-k=${k}]`);if(!b)return;b.textContent=v;b.classList.add('bump');setTimeout(()=>b.classList.remove('bump'),400)};
 let n=0;setInterval(()=>{if(document.hidden)return;tick();if(RM||!o.classList.contains('play'))return;n++;
  if(n%3===0)push(feed[(fi++)%feed.length],true);
  if(n%5===0)val('on',41+Math.floor(Math.random()*3));
  if(n%7===0)val('att',Math.floor(Math.random()*3));
  if(n%9===0)val('chk',Math.max(1,6-Math.floor(n/9)%6))},1000);
});
})()}catch(err){console.error('[v21]',err)}
