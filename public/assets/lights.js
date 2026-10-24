/* "Is your business offline?" lights-off demo. Visual only: nothing is blocked, scrolling and links keep working. */
(function(){
'use strict';
const root=document.documentElement,RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
try{if(sessionStorage.getItem('jc-lo-x'))return}catch(e){}
const T={off:'Is your business offline? <u>Click here</u>',on:'Bring it back online',boot:'Booting up…'};
const LOG=['power ............ ok','network .......... ok','servers .......... ok','database ......... ok','cache warmed ...... ok','all systems online ✓'];
const w=document.createElement('div');w.className='jc-lo';w.id='lo';
w.innerHTML='<div class="lo-boot" aria-hidden="true"><div class="lo-term"><b>jc@systems:~$ boot</b><pre></pre></div><i class="lo-bar"><s></s></i></div>'+
 '<div class="lo-row"><button type="button" class="lo-pill" aria-pressed="false" aria-describedby="lo-hint"><span class="lo-dot" aria-hidden="true"></span><span class="lo-t">'+T.off+'</span></button>'+
 '<button type="button" class="lo-x" aria-label="Dismiss the offline demo"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8"/></svg></button></div>'+
 '<span id="lo-hint" class="lo-sr">A visual demo of what an offline business feels like. It only changes the look of the page.</span><p class="lo-sr" aria-live="polite" id="lo-live"></p>';
const veil=document.createElement('div');veil.className='lo-veil';veil.setAttribute('aria-hidden','true');
veil.innerHTML='<div class="lo-sig"><b>NO SIGNAL</b><span>Connection lost · retrying<i>.</i><i>.</i><i>.</i></span></div>';
const sweep=document.createElement('div');sweep.className='lo-sweep';sweep.setAttribute('aria-hidden','true');
const slot=document.getElementById('lo-slot');
document.body.append(veil,sweep);(slot||document.body).append(w);if(!slot)w.classList.add('dock');
const pill=w.querySelector('.lo-pill'),txt=w.querySelector('.lo-t'),live=w.querySelector('#lo-live'),pre=w.querySelector('pre'),x=w.querySelector('.lo-x');
let state='on',timers=[];
// FLIP move between the hero slot and the docked (fixed) position, keeping focus on the pill
function move(toDock){if(!slot)return;const a=w.getBoundingClientRect(),f=document.activeElement===pill;
 if(toDock){document.body.append(w);w.classList.add('dock')}else{slot.append(w);w.classList.remove('dock')}
 if(f)pill.focus({preventScroll:true});if(RM)return;const b=w.getBoundingClientRect();
 if(w.animate)w.animate([{transform:'translate('+(a.left-b.left)+'px,'+(a.top-b.top)+'px)'},{transform:'none'}],{duration:550,easing:'cubic-bezier(.2,.8,.2,1)'})}
const later=(f,ms)=>timers.push(setTimeout(f,ms));
const clear=()=>{timers.forEach(clearTimeout);timers=[]};
const say=m=>{live.textContent='';later(()=>live.textContent=m,30)};
function off(){
 clear();state='off';window.__off=true;window.__globePower&&window.__globePower(0);
 root.classList.remove('lo-up','lo-booting');root.classList.add('lo-dark');
 if(!RM){root.classList.add('lo-flick');later(()=>root.classList.remove('lo-flick'),900)}
 txt.innerHTML=T.on;pill.setAttribute('aria-pressed','true');pill.classList.add('is-off');move(true);
 say('Lights off. This is how a stalled, offline business feels to a customer. Select Bring it back online to restore the page.');
}
function boot(){
 clear();state='boot';pill.disabled=true;txt.textContent=T.boot;root.classList.add('lo-booting');pre.textContent='';window.__globePower&&window.__globePower(1);
 say('Booting up.');
 const step=RM?0:280;
 LOG.forEach((l,i)=>later(()=>{pre.textContent+=(i?'\n':'')+'> '+l},RM?0:120+i*step));
 const done=RM?700:120+LOG.length*step+250;
 later(()=>{
  window.__off=false;root.classList.remove('lo-dark','lo-booting');
  if(!RM){root.classList.add('lo-up');later(()=>root.classList.remove('lo-up'),1300)}
  state='on';pill.disabled=false;pill.classList.remove('is-off');pill.setAttribute('aria-pressed','false');txt.innerHTML=T.off;
  say('Back online. Every system is running normally again.');
  later(()=>move(false),900);pill.focus({preventScroll:true});
 },done);
}
pill.addEventListener('click',()=>{if(state==='on')off();else if(state==='off')boot()});
x.addEventListener('click',()=>{clear();window.__off=false;window.__globePower&&window.__globePower(1);root.classList.remove('lo-dark','lo-flick','lo-booting','lo-up');w.remove();veil.remove();sweep.remove();try{sessionStorage.setItem('jc-lo-x','1')}catch(e){}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state==='off'&&document.activeElement&&w.contains(document.activeElement))boot()});
setTimeout(()=>w.classList.add('in'),RM?0:1800);
})();
