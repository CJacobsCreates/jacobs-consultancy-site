// Checks that "Shopify store" from the contact form reaches the enquiry email unchanged (mocked Turnstile + Resend).
import * as contact from '../functions/api/contact.js';
let sent=[];globalThis.fetch=async(url,opt)=>{url=String(url);if(url.includes('siteverify'))return new Response(JSON.stringify({success:true,hostname:'thejacobsconsultancy.com'}));if(url.includes('api.resend.com')){sent.push(JSON.parse(opt.body));return new Response('{"id":"x"}')}throw new Error(url)};
const env={TURNSTILE_SECRET:'s',RESEND_API_KEY:'k',MAIL_FROM:'Site <website@thejacobsconsultancy.com>',MAIL_TO:'info@thejacobsconsultancy.com'};
for(const need of ['Shopify store','Modernization']){sent=[];
const r=await contact.onRequestPost({request:new Request('https://thejacobsconsultancy.com/api/contact',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',accept:'application/json',origin:'https://thejacobsconsultancy.com'},body:new URLSearchParams({name:'Test',email:'t@example.com',need,message:'hi','cf-turnstile-response':'tok'})}),env});
const j=await r.json();const m=sent[0]||{};
const ok=j.ok&&m.subject===`New enquiry: ${need} from Test`&&m.text.includes(`What they need: ${need}`)&&m.html.includes(`<td>${need}</td>`);
console.log(need,ok?'PASS':'FAIL','|',m.subject,'|',m.text?.split('\n')[3]);}
