// Cloudflare Pages Function: POST /api/contact
// Env vars (Pages > Settings > Variables and secrets):
//   TURNSTILE_SECRET  Cloudflare Turnstile secret key
//   RESEND_API_KEY    Resend API key
//   MAIL_FROM         e.g. "Jacobs Consultancy <website@thejacobsconsultancy.com>" (domain verified in Resend)
//   MAIL_TO           where enquiries are delivered, e.g. info@thejacobsconsultancy.com
//   (after a successful send, the submitter also gets a confirmation email from MAIL_FROM, reply-to info@)
//   TURNSTILE_HOSTNAMES (optional) extra comma-separated hostnames a Turnstile token may come from
//
// The forms are plain HTML POSTs (no JS fetch). The page expects:
//   success -> redirect to /thanks.html
//   error   -> redirect to /contact.html?error=<code> (main.js maps the code to a fixed message;
//              free text is never reflected, so the URL can't be used to show attacker-chosen text)
// If the client sends Accept: application/json, JSON is returned instead:
//   {ok:true} or {ok:false,error:"..."} with a matching HTTP status.

const NEEDS = ['Website', 'Online payments', 'Shopify store', 'Web app', 'Automation', 'AI automation', 'Cloud infrastructure & hosting', 'Modernization', 'Cost optimization', 'Data analytics', 'Security', 'Custom SOP platform', 'API & plugin integrations', 'DevOps', 'Enterprise', 'Support', 'Book a call', 'Other'];
const LIMITS = { name: 100, email: 254, company: 120, need: 40, message: 5000 };
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

const SITE_HOSTS = ['thejacobsconsultancy.com', 'www.thejacobsconsultancy.com'];
const MAX_BODY = 32 * 1024;   // bytes; the form is a few KB at most
const SEC = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' };
// Short codes -> messages (the same table lives in main.js for the redirect case)
const MSG = {
  read: 'We could not read your message. Please try again.',
  missing: 'Please fill in your name, email, what you need and a message.',
  email: 'Please enter a valid email address.',
  config: 'Our form is not configured yet. Please email info@thejacobsconsultancy.com.',
  captcha: 'Please complete the security check and try again.',
  captcha_failed: 'The security check failed. Please refresh the page and try again.',
  captcha_error: 'We could not verify the security check. Please try again.',
  send: 'Sorry, your message could not be sent. Please email info@thejacobsconsultancy.com.',
  origin: 'Please send your message from the contact form on our website.',
  size: 'Your message is too long. Please shorten it and try again.',
};
const isLocal = h => h === 'localhost' || h === '127.0.0.1';
function originOk(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;                       // non-browser clients still need a valid Turnstile token
  let o; try { o = new URL(origin); } catch { return false; } // "null" and garbage are rejected
  const self = new URL(request.url);
  if (o.host === self.host && o.protocol === self.protocol) return true;
  if (SITE_HOSTS.includes(o.hostname) && o.protocol === 'https:') return true;
  return isLocal(o.hostname) && isLocal(self.hostname);  // local dev only
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').trim().slice(0, max);
const oneLine = s => s.replace(/\s+/g, ' ');

function respond(request, ok, code, status) {
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  if (wantsJson) {
    return new Response(JSON.stringify(ok ? { ok: true } : { ok: false, code, error: MSG[code] || MSG.send }), {
      status: ok ? 200 : status || 400,
      headers: { 'content-type': 'application/json; charset=utf-8', ...SEC },
    });
  }
  const origin = new URL(request.url).origin;
  const to = ok ? `${origin}/thanks.html` : `${origin}/contact.html?error=${encodeURIComponent(MSG[code] ? code : 'send')}#cpage`;
  return new Response(null, { status: 303, headers: { Location: to, ...SEC } });
}

class TooLarge extends Error {}
async function readBody(request) {
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (parseInt(request.headers.get('content-length') || '0', 10) > MAX_BODY) throw new TooLarge();
  const buf = await request.arrayBuffer();          // also catches chunked bodies with no content-length
  if (buf.byteLength > MAX_BODY) throw new TooLarge();
  if (type.startsWith('application/json')) {
    const j = JSON.parse(new TextDecoder().decode(buf));
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('bad json');
    return k => (typeof j[k] === 'string' ? j[k] : '');
  }
  if (!type.startsWith('application/x-www-form-urlencoded') && !type.startsWith('multipart/form-data')) throw new Error('bad type');
  const f = await new Response(buf, { headers: { 'content-type': type } }).formData();
  return k => { const v = f.get(k); return typeof v === 'string' ? v : ''; };   // ignore file uploads
}

// ---------- Confirmation email to the person who submitted the form ----------
// Anti-abuse: the only submitted text that ever appears in this email is the first name, and only
// when it looks like a real name (letters, marks, apostrophes, hyphens; max 50 chars). Anything else
// (URLs, symbols, markup) falls back to "Hi there", so the form can't be used to mail attacker-written
// text to a third party. The message, company and need are never included.
const SITE_URL = 'https://thejacobsconsultancy.com';
const REPLY_TO = 'info@thejacobsconsultancy.com';
export const CONFIRM_SUBJECT = "We've received your message | Jacobs Consultancy";
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'\u2019-]*$/u;
export function firstName(full) {
  const f = String(full ?? '').trim().split(/\s+/)[0].slice(0, 50);
  return NAME_RE.test(f) ? f : '';
}
export function buildConfirmation(fullName) {
  const fn = firstName(fullName);
  const hi = fn ? `Hi ${esc(fn)},` : 'Hi there,';
  const C = { bg: '#05070a', card: '#0b0e13', tx: '#e8f4f8', mu: '#93a3ab', au: '#ead6a6', au2: '#b89a5c', line: '#2a2a24' };
  const sans = "Outfit,'Segoe UI',Helvetica,Arial,sans-serif";
  const disp = "Syne,'Arial Black','Helvetica Neue',Arial,sans-serif";
  const mono = "'JetBrains Mono',Menlo,Consolas,'Courier New',monospace";
  const p = `margin:0 0 18px;font-family:${sans};font-size:16px;line-height:26px;color:${C.tx}`;
  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<meta name="x-apple-disable-message-reformatting">
<title>${CONFIRM_SUBJECT}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
:root{color-scheme:dark;supported-color-schemes:dark}
body{margin:0!important;padding:0!important;width:100%!important;background:${C.bg}}
a{color:${C.au}}
@media only screen and (max-width:620px){
 .outer{padding:20px 12px!important}
 .card{padding:32px 24px 28px!important}
 .h1{font-size:26px!important;line-height:31px!important}
 .foot{padding:24px 12px 0!important}
}
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.bg};opacity:0">Thank you for reaching out. You'll hear back from us within 1 business day.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};">
<tr><td align="center" class="outer" style="padding:40px 16px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;">
<tr><td align="center" style="padding:0 0 28px;">
 <a href="${SITE_URL}" style="text-decoration:none;"><img src="${SITE_URL}/assets/logo-512.png" width="56" height="56" alt="Jacobs Consultancy" style="display:block;width:56px;height:56px;border:0;outline:none;margin:0 auto;"></a>
 <div style="padding-top:14px;font-family:${mono};font-size:11px;line-height:16px;letter-spacing:4px;text-transform:uppercase;color:${C.au};">Jacobs Consultancy</div>
</td></tr>
<tr><td height="2" bgcolor="${C.au}" style="height:2px;line-height:2px;font-size:0;background:${C.au};background-image:linear-gradient(90deg,${C.au2},#f7ecd0 50%,${C.au2});">&nbsp;</td></tr>
<tr><td class="card" bgcolor="${C.card}" style="background:${C.card};padding:44px 48px 36px;border:1px solid ${C.line};border-top:0;">
 <div style="margin:0 0 14px;font-family:${mono};font-size:11px;line-height:16px;letter-spacing:4px;text-transform:uppercase;color:${C.au};">Message received</div>
 <h1 class="h1" style="margin:0 0 28px;font-family:${disp};font-weight:800;font-size:34px;line-height:38px;letter-spacing:-0.5px;color:${C.tx};">Thank you.<br><span style="color:${C.au};">We'll&nbsp;be in&nbsp;touch.</span></h1>
 <p style="${p}">${hi}</p>
 <p style="${p}">Thank you for reaching out. Your enquiry is with our team and you'll hear back from us within 1 business day.</p>
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 26px;">
 <tr><td style="border-left:2px solid ${C.au};background:#11141a;padding:16px 20px;" bgcolor="#11141a">
  <div style="font-family:${mono};font-size:10px;line-height:14px;letter-spacing:3px;text-transform:uppercase;color:${C.mu};padding-bottom:6px;">Expected response</div>
  <div style="font-family:${disp};font-weight:700;font-size:18px;line-height:24px;color:${C.au};">Within 1 business day</div>
 </td></tr></table>
 <p style="${p}">Want to add anything, like a link, a file or a deadline? Just reply to this email and it will come straight to us.</p>
 <p style="margin:28px 0 2px;font-family:${sans};font-size:16px;line-height:24px;color:${C.mu};">Warm regards,</p>
 <p style="margin:0;font-family:${disp};font-weight:700;font-size:20px;line-height:28px;color:${C.tx};">Cheslin Jacobs</p>
 <p style="margin:0 0 30px;font-family:${mono};font-size:11px;line-height:18px;letter-spacing:2px;text-transform:uppercase;color:${C.au};">CEO, Jacobs Consultancy</p>
 <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${C.au}" style="border-radius:999px;background:${C.au};">
  <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${SITE_URL}" style="height:46px;v-text-anchor:middle;width:230px;" arcsize="50%" stroke="f" fillcolor="${C.au}"><center style="color:#0b0b0b;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">Visit our website &rarr;</center></v:roundrect><![endif]-->
  <!--[if !mso]><!--><a href="${SITE_URL}" style="display:inline-block;padding:14px 28px;font-family:${sans};font-size:15px;font-weight:600;line-height:18px;color:#0b0b0b;text-decoration:none;border-radius:999px;">Visit our website &rarr;</a><!--<![endif]-->
 </td></tr></table>
</td></tr>
<tr><td align="center" class="foot" style="padding:28px 24px 0;font-family:${sans};font-size:12px;line-height:20px;color:${C.mu};">
 <a href="${SITE_URL}" style="color:${C.au};text-decoration:none;">thejacobsconsultancy.com</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="mailto:${REPLY_TO}" style="color:${C.mu};text-decoration:none;">${REPLY_TO}</a><br>
 Jacobs Consultancy (Pty) Ltd &middot; Reg. 2026/508534/07<br>
 <span style="color:#5f6b72;">You're receiving this because you contacted us through our website.</span>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
  const text = `${fn ? `Hi ${fn},` : 'Hi there,'}

Thank you for reaching out. Your enquiry is with our team and you'll hear back from us within 1 business day.

Want to add anything, like a link, a file or a deadline? Just reply to this email and it will come straight to us.

Warm regards,

Cheslin Jacobs
CEO, Jacobs Consultancy
${SITE_URL}

Jacobs Consultancy (Pty) Ltd · Reg. 2026/508534/07
You're receiving this because you contacted us through our website.
`;
  return { subject: CONFIRM_SUBJECT, html, text };
}

async function sendConfirmation(env, to, fullName) {
  // Never throws and never affects the user-facing result. The recipient address is not logged.
  try {
    const c = buildConfirmation(fullName);
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM, to: [to], reply_to: REPLY_TO,
        subject: c.subject, html: c.html, text: c.text,
        headers: { 'Auto-Submitted': 'auto-replied' },   // stops auto-responder loops
      }),
    });
    if (!r.ok) console.error('Confirmation email error', r.status, (await r.text()).slice(0, 300));
  } catch (e) {
    console.error('Confirmation email failed', String(e).slice(0, 200));
  }
}

export async function onRequestPost({ request, env }) {
  if (!originOk(request)) return respond(request, false, 'origin', 403);
  let get;
  try { get = await readBody(request); } catch (e) { return e instanceof TooLarge ? respond(request, false, 'size', 413) : respond(request, false, 'read', 400); }

  // Honeypot: real people never fill this hidden field. Pretend success to bots.
  if (clean(get('bot-field'), 200)) return respond(request, true);

  const d = {
    name: oneLine(clean(get('name'), LIMITS.name)),
    email: clean(get('email'), LIMITS.email),
    company: oneLine(clean(get('company'), LIMITS.company)),
    need: oneLine(clean(get('need'), LIMITS.need)),
    message: clean(get('message'), LIMITS.message),
  };
  if (!d.name || !d.email || !d.need || !d.message) return respond(request, false, 'missing', 400);
  if (!EMAIL_RE.test(d.email)) return respond(request, false, 'email', 400);
  if (!NEEDS.includes(d.need)) d.need = 'Other';

  // Turnstile (fails closed if the secret is missing)
  if (!env.TURNSTILE_SECRET) return respond(request, false, 'config', 500);
  const token = clean(get('cf-turnstile-response'), 2048);
  if (!token) return respond(request, false, 'captcha', 400);
  try {
    const body = new FormData();
    body.append('secret', env.TURNSTILE_SECRET);
    body.append('response', token);
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) body.append('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const v = await r.json();
    if (!v.success) return respond(request, false, 'captcha_failed', 403);   // includes replayed tokens (timeout-or-duplicate)
    // The token must have been issued on our own site, not on someone else's page using our site key
    const hosts = [...SITE_HOSTS, new URL(request.url).hostname, ...String(env.TURNSTILE_HOSTNAMES || '').split(',').map(x => x.trim()).filter(Boolean)];
    if (v.hostname && !hosts.includes(v.hostname)) return respond(request, false, 'captcha_failed', 403);
  } catch {
    return respond(request, false, 'captcha_error', 502);
  }

  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !env.MAIL_TO) return respond(request, false, 'config', 500);

  const rows = [['Name', d.name], ['Email', d.email], ['Company', d.company || '-'], ['What they need', d.need]];
  const html = `<div style="font-family:system-ui,Arial,sans-serif;font-size:15px;color:#111">
<h2 style="margin:0 0 12px">New website enquiry</h2>
<table cellpadding="6" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="color:#666;vertical-align:top"><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('')}</table>
<p style="margin:16px 0 4px"><b>Message</b></p>
<div style="white-space:pre-wrap;border-left:3px solid #b89a5c;padding:8px 12px;background:#faf7ef">${esc(d.message)}</div>
<p style="color:#888;font-size:12px;margin-top:16px">Sent from the contact form on thejacobsconsultancy.com. Reply to this email to answer ${esc(d.name)} directly.</p></div>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nMessage:\n${d.message}\n`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: env.MAIL_TO.split(',').map(s => s.trim()).filter(Boolean),
        reply_to: d.email,
        subject: `New enquiry: ${d.need} from ${d.name}`.slice(0, 150),
        html,
        text,
      }),
    });
    if (!r.ok) {
      console.error('Resend error', r.status, (await r.text()).slice(0, 300));
      return respond(request, false, 'send', 502);
    }
  } catch (e) {
    console.error('Resend fetch failed', String(e).slice(0, 200));
    return respond(request, false, 'send', 502);
  }
  // Enquiry delivered: send the submitter a confirmation (best effort, result ignored)
  await sendConfirmation(env, d.email, d.name);
  return respond(request, true);
}

// Anything other than POST
export const onRequest = () => new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST', ...SEC } });
