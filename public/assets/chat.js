// Jacobs Consultancy chat assistant.
// AI answers via /api/chat (Cloudflare Pages Function + Workers AI). On any error, timeout, 429 or
// {fallback:true} it falls back to the rule-based bot below, which uses /assets/faq.json. Set AI_ENDPOINT:null to disable AI.
(()=>{try{
const CFG={AI_ENDPOINT:'/api/chat',MAX_LEN:500,FAQ_URL:'/assets/faq.json?v=23',EMAIL:'info@thejacobsconsultancy.com'};
let FAQ=[];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- text normalisation + fuzzy matching ---------- */
const SYN={u:'you',ur:'your',r:'are',pls:'please',plz:'please',thx:'thanks',ty:'thanks',cheers:'thanks',
 whats:'what is',wat:'what',hw:'how',app:'app',apps:'app',site:'website',sites:'website',webpage:'website',web:'website',
 cost:'price',costs:'price',pricing:'price',prices:'price',charge:'price',fee:'price',fees:'price',rates:'price',rate:'price',quote:'price',budget:'price',
 hey:'hello',hi:'hello',hiya:'hello',yo:'hello',sup:'hello',heita:'hello',
 bot:'bot',robot:'bot',ai:'ai',long:'long',timeline:'time',timeframe:'time',duration:'time',deadline:'time',
 shop:'store',shops:'store',stores:'store',online:'online',chatbot:'chatbot',receptionist:'chatbot'};
const norm=t=>t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s']/g,' ').replace(/'/g,'').split(/\s+/).filter(Boolean).map(w=>SYN[w]||w).join(' ').split(' ');
const lev=(a,b)=>{if(a===b)return 0;const m=a.length,n=b.length;if(!m||!n)return m||n;let p=Array.from({length:n+1},(_,i)=>i);
 for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[n]};
// a word "matches" a keyword exactly, by prefix, or within a typo budget
const wm=(w,k)=>w===k||(k.length>4&&w.length>3&&(k.startsWith(w)||w.startsWith(k)))||(k.length>3&&lev(w,k)<=(k.length>6?2:1));
const score=(words,keys)=>{let s=0;for(const k of keys){const kw=k.split(' ');if(kw.length>1){if(words.join(' ').includes(k))s+=2}else if(words.some(w=>wm(w,k)))s+=1}return s};
const STOP=new Set('the a an is are do does you your we our i me my to of for and or can how what when who will with in on it be have has get much'.split(' '));

/* ---------- intents (rule-based fallback) ---------- */
const CHIPS_MAIN=['Services','Pricing','Timelines','Book a call','Talk to a human'];
const LEAD=['Pricing','Book a call','Talk to a human'];
const pick=a=>a[Math.floor(Math.random()*a.length)];
const faqA=k=>{const f=FAQ.find(f=>f.q.toLowerCase().includes(k));return f?esc(f.a):''};
const CF='<a href="/contact.html">contact form</a>';
const stem=w=>w.length>5?w.replace(/(ings|ing|ers|ies|es|ed|s)$/,''):(w.length>3?w.replace(/s$/,''):w);
const prep=t=>{const ws=norm(t).map(stem);return{ws,j:' '+ws.join(' ')+' '}};
const KC=new Map();const kp=k=>{if(!KC.has(k))KC.set(k,prep(k));return KC.get(k)};
// one keyword: phrases match on the normalised text; single words by stem, prefix or a small typo budget
const hit=(q,k)=>{const K=kp(k);if(K.ws.length!==1)return q.j.includes(K.j)?2:0;const s=K.ws[0];if(!s)return 0;
 return q.ws.some(w=>w===s||(s.length>=4&&w.startsWith(s))||(w.length>=5&&s.startsWith(w)&&s.length-w.length<=1)||(s.length>=5&&w.length>=4&&lev(w,s)<=(s.length>=8?2:1)))?1:0};
const sc=(q,keys)=>{const seen=new Set();let a=0;for(const k of keys){const n=kp(k).j;if(seen.has(n))continue;seen.add(n);a+=hit(q,k)}return a};
const firstHit=(q,keys)=>keys.find(k=>hit(q,k));
/* industries: label, plural, typical builds */
const IND=[
 ['restaurant','restaurants and cafés',['restaurant','cafe','coffee shop','takeaway','take away','bakery','pizza','food truck','pub','catering','diner','eatery','bistro','food business'],'online ordering with card payments, table bookings, a fast menu website and a strong Google listing'],
 ['shop','shops and retailers',['store','boutique','retail','retailer','clothing brand','spaza','merch'],'an online store with secure payments and delivery options, stock syncing and local SEO'],
 ['salon','salons and studios',['salon','barber','spa','beauty','nail','hair','lash','massage','tattoo'],'online booking with deposits and reminders, a polished website and Google reviews'],
 ['practice','clinics and practices',['clinic','doctor','dentist','dental','hospital','medical','physio','pharmacy','vet','healthcare','therapist','optometrist','practice'],'appointment booking, online patient forms, POPIA-aware data handling and, for larger sites, equipment and maintenance dashboards'],
 ['school','schools and training providers',['school','college','tutor','academy','creche','university','training provider','education'],'a clear website, online enrolment and fee payments, parent communication and admin automation'],
 ['gym','gyms and fitness studios',['gym','fitness','yoga','pilates','crossfit','personal trainer','sports club'],'class bookings, memberships with recurring payments, and a site that gets you found'],
 ['hotel','hotels and guesthouses',['hotel','guesthouse','guest house','bnb','lodge','airbnb','accommodation','resort'],'direct bookings and payments, a fast website and a strong Google listing'],
 ['business','trades and contractors',['plumber','plumbing','electrician','electrical','builder','construction','contractor','handyman','painter','roofer','roofing','landscaping','mechanic','cleaning company'],'a website that wins jobs, quote request forms, local SEO and job scheduling'],
 ['agency','property businesses',['property','real estate','estate agent','rental','letting','landlord'],'a listings website, enquiry handling and tenant or owner portals'],
 ['operation','logistics and transport businesses',['logistic','transport','courier','trucking','freight','fleet'],'live dashboards using the trackers already in your vehicles, job tracking and proof-of-delivery checklists'],
 ['firm','professional firms',['law firm','lawyer','attorney','accountant','accounting firm','bookkeeper','consultancy','agency','architect','insurance broker'],'client portals, secure document handling, bookings and workflow automation'],
 ['organisation','non-profits and churches',['church','ngo','nonprofit','non profit','charity','foundation'],'a website, online donations and member or volunteer management'],
 ['operation','manufacturers and mines',['factory','manufactur','warehouse','mine','mining','plant','production line'],'operations dashboards, digital SOP checklists and live reporting across sites'],
];
const NOUN=new Set('restaurant cafe bakery pizzeria bistro diner salon barber spa clinic hospital pharmacy practice school college academy creche gym studio hotel guesthouse lodge church charity ngo foundation factory warehouse mine firm agency store boutique'.split(' '));
const T=(id,keys,r,opt={})=>({id,keys,r,...opt});
const forI=c=>c.ind?' for your '+c.ind[0]:'';
const TOP=[
 T('call',['book a call','schedule a call','free call','meeting','video call','zoom','google meet','teams call','consultation','discovery call','speak to someone','set up a call','call me'],c=>{go('call');return['Great, let’s set up a free call. We can talk on Google Meet, Zoom or Teams, whatever suits you. Taking you to the contact page now…',[]]},{w:1.4}),
 T('human',['human','real person','someone','your team','contact you','email you','reach you','get in touch','talk to','speak with'],c=>{go('human');return['Sure! The team replies within 1 business day. Use the '+CF+' or email <a href="mailto:'+CFG.EMAIL+'">'+CFG.EMAIL+'</a>.',[]]}),
 T('shopify',['shopify','shopify store','shopify site','shopify theme','dawn theme','woocommerce to shopify','wix to shopify','squarespace to shopify','move to shopify','shopify migration','store care'],c=>{const a=faqA('shopify store cost');return[(a?'Yes, we build and look after <b>Shopify stores</b>. '+a.replace(/See \/shopify\.html for details\.?/,'').trim()+' ':'Yes, we build <b>Shopify stores</b> for small and medium brands: products and collections, a theme styled to your brand, payments, shipping and tax, plus migrations from other platforms and monthly store care. Packages have clear starting prices in USD. ')+'See the <a href="/shopify.html">Shopify page</a> for the packages and a concept store we built (a fictional brand, made to show the work).',['Pricing','Book a call','Talk to a human']]},{w:2}),
 T('order',['order online','online order','ordering','orders','order','menu','takeaway','take away','delivery','deliver','online store','sell online','selling online','sell my','sell product','cart','checkout','ecommerce','e commerce','webshop','online shop','products online'],c=>['Yes, we can set up online ordering'+forI(c)+': '+(c.food?'a clear online menu, secure card payments, collection or delivery options, and orders sent straight to your kitchen screen, phone or email.':'a product catalogue with stock, secure card payments, delivery or collection options, and orders sent straight to you by email or a simple dashboard.')+' It’s your own system, so you’re not relying only on third-party apps. It’s quoted per project. Tell us a little about your '+(c.ind?c.ind[0]:'business')+' through the '+CF+' and we’ll suggest the simplest setup.',LEAD]),
 T('booking',['booking','book online','online booking','appointment','reservation','reserve','table','schedule','calendar','slot','book a table','book a class','class booking'],c=>['Yes, we build online booking'+forI(c)+'. Customers pick a service and time, can pay a deposit if you want, and get automatic confirmations and reminders. You manage it all from one calendar. Want us to suggest a setup? Send a few details through the '+CF+'.',LEAD]),
 T('payments',['payment','pay online','card payment','stripe','paypal','invoice','subscription','membership','recurring','deposit','pay me','accept card'],c=>['We set up online payments, subscriptions and memberships: card checkout, deposits, recurring billing and invoices, with every transaction accounted for. We work with providers such as Stripe and PayPal. Quoted per project.',LEAD]),
 T('modern',['legacy','old system','old systems','outdated','out of date','upgrade','migrate','migration','modernise','modernize','modernisation','modernization','old website','old site','old server','old servers','on-prem','on prem','ancient','wordpress','old software','stale'],c=>[faqA('modernise our old')||'Yes, we upgrade or rebuild legacy systems and outdated websites, migrate you off old servers with your data intact, and cut over in phases with no downtime.',LEAD],{w:1.35}),
T('cost',['reduce cost','cut cost','lower cost','save money','saving','too expensive','overpay','our bill','cloud bill','software bill','licence','license','sprawl','cheaper setup','reduce our','cut our'],c=>[faqA('reduce our cloud')||'We review your cloud, hosting and software bills line by line and cut what isn’t needed.',LEAD],{w:1.3}),
 T('price',['price','how much','afford','expensive','cheap','pay for','ballpark','rough idea'],c=>[(faqA('pricing')||'Every project is quoted individually.')+' Share a few details via the '+CF+' and we’ll send a clear quote.',['Book a call','Timelines','Talk to a human']]),
 T('time',['how long','timeline','turnaround','weeks','deadline','how soon','how fast','when can','ready by','launch date'],c=>[faqA('how long')||'A simple website usually takes 1 to 3 weeks.',['Pricing','Book a call']],{w:1.6}),
 T('seo',['seo','google','search engine','rank','found online','get found','visible online','google maps','google business','show up'],c=>['Our <b>local SEO</b> covers Google Business Profile setup, on-page SEO, fast mobile-friendly pages and local listings. No one can honestly guarantee rankings, but we make you easy to find and trust'+(c.ind?' for people searching for a '+c.ind[0]+' nearby':'')+'.',LEAD]),
 T('security',['security','secure','hack','hacked','breach','popia','gdpr','encrypt','password','malware','virus','protect','privacy','access control','data safe','safe','compliance','compliant'],c=>[faqA('handle security')||'We handle secure storage, access control, encryption and tested backups.',LEAD],{w:1.3}),
 T('devops',['devops','ci cd','cicd','pipeline','deploy','deployment','rollback','release','uptime','incident'],c=>[faqA('deployment pipelines')||'We set up CI/CD pipelines, monitoring and incident response.',LEAD]),
 T('cloud',['cloud','aws','amazon web service','cloudflare','cdn','migrate','migration','infrastructure','server','scaling','database','load fast'],c=>[faqA('cloud infrastructure')||'We set up and run cloud environments on AWS and Cloudflare.',LEAD]),
 T('hosting',['hosting','host my','domain','backup','maintenance','care plan','support plan','updates','keep it running','look after'],c=>['<b>Hosting, care &amp; support</b>: managed hosting on Cloudflare, domain renewals, daily backups, updates and fixes after launch. Each plan is quoted for your setup.',LEAD]),
 T('data',['dashboard','analytics','sales numbers','sales figures','report','reporting','kpi','data','spreadsheet','excel','insight','metric','export'],c=>[faqA('data analytics')||'We build live dashboards and KPI tracking from your existing data.',LEAD]),
 T('sop',['sop','procedure','checklist','compliance','audit','sign off','signoff','inspection','training record','standard operating'],c=>[faqA('sop platform')||'We turn procedures into digital checklists with sign-offs and audit trails.',LEAD],{w:1.2}),
 T('auto',['automate','automation','workflow','manual','admin work','repetitive','paperwork','crm','zapier'],c=>['We automate the repetitive admin: connecting your forms, email, spreadsheets, accounting and CRM so information moves on its own, with approvals, reminders, invoices and follow-ups that run themselves.',LEAD]),
 T('api',['api','apis','integrate','integration','plugin','plug in','extension','connect','sync','syncing','webhook','zapier','link our','talk to each other','xero','quickbooks','sage','hubspot','salesforce','woocommerce','wordpress'],c=>[faqA('through apis')||'We build API and plugin integrations between the tools you already use.',LEAD],{w:1.2}),
 T('ent',['enterprise','corporate','large company','big company','employee','staff member','workforce','department','head of technology','cto','multiple sites','several sites','branches','50 people','operations dashboard','fleet'],c=>['For organisations with 50+ people we build <b>real-time operations dashboards</b>, <b>SOP &amp; operations platforms</b>, integrations, analytics, cloud and security, and offer an <b>outsourced Head of Technology</b>. It’s quoted per project. See <a href="/enterprise.html">our Enterprise page</a> or book an enterprise call.',['Book a call','Talk to a human']],{w:1.2}),
 T('ai',['chatbot','chat bot','ai receptionist','receptionist','answer calls','answer the phone','virtual assistant','ai assistant','bot for'],c=>['We build <b>AI receptionists &amp; chatbots</b> that answer calls and chats 24/7, book appointments and handle common questions, so you never miss a customer'+(c.ind?' at your '+c.ind[0]:'')+'.',LEAD]),
 T('social',['social media','instagram','facebook','tiktok','followers','content creation','ads','advertising','marketing'],c=>['We help you show up where your customers spend their time, with social media content, campaigns, and email and marketing automation that bring in real enquiries.',LEAD]),
 T('app',['app','mobile app','web app','portal','platform','software','custom system','system for','client portal','member area','login area'],c=>['Yes, we build custom web apps and portals'+forI(c)+', such as booking systems, client portals, quote tools and mobile-friendly apps, built around how you work. Every app is quoted per project. Tell us what it should do via the '+CF+'.',LEAD]),
 T('website',['website','landing page','redesign','new website','web design','homepage'],c=>['Yes! We build fast, good-looking websites'+forI(c)+' that make you easy to find, trust and contact'+(c.ind?', with features '+c.ind[1]+' usually need, like '+c.ind[3]:'')+'. A simple site usually takes 1 to 3 weeks, quoted per project.',LEAD]),
 T('services',['services','what do you do','what you offer','what can you do','offer'],c=>['We build <b>websites</b>, <b>online ordering &amp; payments</b>, <b>Shopify stores</b>, <b>booking systems</b>, <b>custom web apps</b>, <b>AI receptionists &amp; chatbots</b>, <b>workflow automation</b>, <b>cloud infrastructure</b>, <b>DevOps</b>, <b>custom SOP platforms</b>, <b>API &amp; plugin integrations</b>, <b>data dashboards</b>, <b>cost optimization</b>, <b>security</b>, <b>local SEO</b> and <b>hosting &amp; care</b>. What are you working on?',['Pricing','Timelines','Book a call']]),
 T('own',['own the','ownership','copyright','source code','who owns'],c=>[faqA('who owns'),LEAD]),
 T('nda',['nda','non disclosure','confidential'],c=>[faqA('nda'),LEAD]),
 T('intl',['international','overseas','abroad','time zone','another country','outside south africa','usa','uk','europe','australia'],c=>[faqA('international'),LEAD]),
 T('paymeth',['how can i pay','how do i pay','payment method','pay you','eft','bank transfer','wise'],c=>[faqA('how can i pay'),LEAD],{w:1.3}),
 T('changes',['after launch','make changes','edit myself','update it myself','change later'],c=>[faqA('changes after launch'),LEAD]),
 T('start',['get started','how do we start','next step','how does it work','process','how do i begin'],c=>[faqA('get started'),['Book a call','Pricing']]),
 T('aiuse',['do you use ai','use ai','chatgpt','gpt','artificial intelligence'],c=>[faqA('do you use ai'),LEAD]),
];
const SMALL=[
 T('greet',['hello','good morning','good afternoon','good evening','greetings','howzit'],c=>[pick(['Hey there!','Hi!','Hello, welcome!'])+' I can help with our services, pricing and timelines, or get you talking to the team. What are you working on?',CHIPS_MAIN]),
 T('thanks',['thanks','thank you','appreciate','awesome','perfect','great stuff'],c=>[pick(['You’re welcome!','Happy to help!','Anytime!'])+' Anything else I can help with?',['Book a call','Services','Talk to a human']]),
 T('bye',['bye','goodbye','see you','cheers bye','cya'],c=>['Thanks for stopping by! If you think of anything else, I’m right here.',[]]),
 T('who',['who are you','what are you','your name','are you a bot','are you human','are you real'],c=>['I’m the Jacobs Consultancy assistant, an automated helper. For anything detailed, the team is happy to help personally and replies within 1 business day.',['Talk to a human','Book a call']]),
 T('howru',['how are you','hows it going','how is it going','how you doing'],c=>['I’m doing well, thanks for asking! How can I help you today?',CHIPS_MAIN]),
];
const BUILD=['can you build','can you make','can you create','can you help','do you build','do you do','do you make','i need','we need','i want','we want','looking for','help me','help us','would like'];
const CHIP_MAP={'services':'services','pricing':'price','timelines':'time','book a call':'call','talk to a human':'human'};

function ruleReply(text){
 const raw=String(text).toLowerCase().trim();
 if(CHIP_MAP[raw]){const t=TOP.find(x=>x.id===CHIP_MAP[raw]);return t.r({})}
 const q=prep(text),c={};
 // industry
 let ib=0;for(const d of IND){const s=sc(q,d[2]);if(s>ib){ib=s;c.ind=d}}
 if(c.ind){const k=firstHit(q,c.ind[2]);const n=k&&kp(k).ws.length===1&&NOUN.has(k)?(k==='store'?'shop':k):c.ind[0];c.ind=[n,...c.ind.slice(1)];c.food=IND.indexOf(IND.find(d=>d[1]===c.ind[1]))===0}
 // topics
 let best=null,bs=0;for(const t of TOP){const s=sc(q,t.keys)*(t.w||1);if(s>bs){bs=s;best=t}}
 const small=SMALL.map(t=>({t,s:sc(q,t.keys)})).sort((a,b)=>b.s-a.s)[0];
 const wantsBuild=BUILD.some(k=>q.j.includes(kp(k).j));
 if(small.s&&(!best||bs<1||q.ws.length<=3)&&!c.ind)return small.t.r(c);
 if(best&&bs>=1)return best.r(c);
 if(c.ind)return['We’d love to help your '+c.ind[0]+'. For '+c.ind[1]+' we often build '+c.ind[3]+'. What would make the biggest difference for you right now? You can also tell us through the '+CF+'.',['Online ordering','Bookings','Website','Pricing']];
 // FAQ overlap as a second opinion
 const content=q.ws.filter(w=>!STOP.has(w)&&w.length>2);let fb=null,fs=0;
 FAQ.forEach(f=>{const qw=prep(f.q).ws.filter(w=>!STOP.has(w)&&w.length>2);const s=content.filter(w=>qw.some(x=>x===w||(x.length>4&&w.startsWith(x))||(w.length>4&&x.startsWith(w)))).length;if(s>fs){fs=s;fb=f}});
 if(fb&&fs>=2)return[esc(fb.a),LEAD];
 if(wantsBuild)return['Most likely, yes. We build websites, apps and systems around how each business works. Tell us what you have in mind through the '+CF+' and we’ll reply within 1 business day with ideas and a quote.',LEAD];
 if(fb&&fs>=1)return[esc(fb.a),LEAD];
 return['Thanks for the question! I’m a simple assistant, so I may have missed the detail, but the team can definitely help. Send a quick note through the '+CF+', or pick a topic below.',CHIPS_MAIN];
}

/* ---------- AI backend (falls back to rules on any problem) ---------- */
let aiOff=false,aiOffUntil=0;
const fmtAI=t=>esc(t).replace(/\n/g,'<br>').replace(/info@thejacobsconsultancy\.com/g,'<a href="mailto:'+CFG.EMAIL+'">'+CFG.EMAIL+'</a>').replace(/(^|[\s(])\/contact(\.html)?\b/g,'$1<a href="/contact.html">/contact</a>').replace(/\bcontact form\b/gi,'<a href="/contact.html">$&</a>');
async function aiReply(text,hist){
 if(!CFG.AI_ENDPOINT||aiOff||Date.now()<aiOffUntil)return null;
 try{const ctl=new AbortController();const to=setTimeout(()=>ctl.abort(),15000);
  const r=await fetch(CFG.AI_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text.slice(0,CFG.MAX_LEN),history:hist.slice(-12).map(m=>({role:m.role,content:m.content.slice(0,CFG.MAX_LEN)}))}),signal:ctl.signal});
  clearTimeout(to);
  let d=null;try{d=await r.json()}catch(e){}
  if(r.status===429){aiOffUntil=Date.now()+Math.min(86400,(d&&d.retryAfter)||60)*1000;return{limit:(d&&d.message)||'You’ve reached the chat limit for now.'}}
  if(r.status===404||r.status===405||r.status===403||r.status===501){aiOff=true;return null}
  if(!r.ok||!d)return null;
  if(d.fallback){aiOff=true;return null}
  return d.reply?{res:[fmtAI(d.reply),Array.isArray(d.chips)?d.chips.slice(0,4).map(String):[]]}:null}catch(e){return null}
}

/* ---------- UI ---------- */
const btn=document.createElement('button');btn.className='jc-chat-btn';btn.type='button';btn.setAttribute('aria-label','Open chat');btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls','jc-chat');
btn.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';
const pn=document.createElement('div');pn.className='jc-chat';pn.id='jc-chat';pn.setAttribute('role','dialog');pn.setAttribute('aria-label','Chat with Jacobs Consultancy');
pn.innerHTML='<header><img src="/assets/logo.svg" alt="" width="30" height="30"><div><b>Jacobs Consultancy</b><small>● Typically replies instantly</small></div><button type="button" aria-label="Close chat">×</button></header><div class="jc-log" role="log" aria-live="polite"></div><div class="jc-chips"></div><form class="jc-form"><label class="skip" for="jc-in">Your message</label><input id="jc-in" autocomplete="off" maxlength="500" placeholder="Ask us anything…"><button type="submit">Send</button></form>';
document.body.append(btn,pn);
const log=pn.querySelector('.jc-log'),chipsEl=pn.querySelector('.jc-chips'),inp=pn.querySelector('input'),history=[];
const add=(html,who)=>{const m=document.createElement('div');m.className='jc-msg '+who;who==='bot'?m.innerHTML=html:m.textContent=html;log.append(m);log.scrollTop=log.scrollHeight;history.push({role:who==='bot'?'assistant':'user',content:m.textContent});return m};
const setChips=list=>{chipsEl.innerHTML='';(list||[]).forEach(l=>{const b=document.createElement('button');b.type='button';b.textContent=l;b.onclick=()=>send(l);chipsEl.append(b)})};
const typing=()=>{const t=document.createElement('div');t.className='jc-msg bot jc-typing';t.setAttribute('aria-label','Typing');t.innerHTML='<i></i><i></i><i></i>';log.append(t);log.scrollTop=log.scrollHeight;return t};
let pending=null,busy=false;
function go(kind){pending=kind}
function doPending(){const k=pending;pending=null;if(!k)return;setTimeout(()=>{
 if(k==='call'){if(location.pathname==='/contact.html'){document.querySelector('[data-book-call]')?.click();close()}else location.href='/contact.html?need=call'}
 else if(k==='human'){if(window.openProject&&document.getElementById('project')){close();window.openProject()}else location.href='/contact.html'}},1100)}
async function send(text){
 text=String(text).trim().slice(0,CFG.MAX_LEN);if(!text||busy)return;busy=true;
 const prior=history.slice();add(text,'me');setChips([]);const t=typing();
 const started=Date.now();let note='';
 const ai=await aiReply(text,prior);let res=ai&&ai.res;
 if(ai&&ai.limit)note=esc(ai.limit)+' I can still answer common questions, and the team is always reachable via <a href="/contact.html">our contact form</a> or <a href="mailto:'+CFG.EMAIL+'">'+CFG.EMAIL+'</a>.';
 if(!res)res=ruleReply(text);
 const wait=Math.max(0,450+Math.min(700,res[0].length*4)-(Date.now()-started));
 setTimeout(()=>{t.remove();if(note)add(note,'bot');add(res[0],'bot');setChips(res[1]);busy=false;doPending()},wait);
}
window.__jcChat={reply:t=>ruleReply(t)};
let greeted=false,last=null;
const open=()=>{last=document.activeElement;pn.classList.add('open');btn.setAttribute('aria-expanded','true');btn.setAttribute('aria-label','Close chat');
 if(!greeted){greeted=true;add('Hi, welcome to Jacobs Consultancy. I can tell you about our services, pricing and timelines, or connect you with our team. How can I help?','bot');setChips(CHIPS_MAIN)}setTimeout(()=>inp.focus(),50)};
const close=()=>{pn.classList.remove('open');btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-label','Open chat');if(last&&last!==document.body)btn.focus()};
btn.onclick=()=>pn.classList.contains('open')?close():open();pn.querySelector('header button').onclick=close;
pn.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close()}});
pn.querySelector('form').onsubmit=e=>{e.preventDefault();const v=inp.value;inp.value='';send(v)};
fetch(CFG.FAQ_URL).then(r=>r.json()).then(d=>FAQ=d).catch(()=>{});
}catch(err){console.error('[chat]',err)}})();
