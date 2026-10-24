// Writes the Shopify starting prices from pricing.json into the site.
//   node scripts/apply-prices.mjs        (run from the project root, then deploy)
// - HTML: every <... data-price="launch|growth|care">...</...> gets its text replaced, in public/*.html
// - FAQ: the entry with id "shopify-pricing" in public/assets/faq.json is regenerated from the template
//   (the site chat and its fallback answer Shopify pricing questions from that entry).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'pricing.json'), 'utf8'));
const fmt = p => '$' + Number(p.amount).toLocaleString('en-US') + (p.per ? '/' + p.per : '');
const P = Object.fromEntries(Object.entries(cfg.shopify).map(([k, v]) => [k, fmt(v)]));

const pub = join(root, 'public');
let n = 0;
for (const f of readdirSync(pub).filter(f => f.endsWith('.html'))) {
  const path = join(pub, f), src = readFileSync(path, 'utf8');
  const out = src.replace(/(<(\w+)\b[^>]*\bdata-price="(\w+)"[^>]*>)[^<]*(<\/\2>)/g, (m, open, tag, key, close) => {
    if (!(key in P)) throw new Error(`${f}: unknown data-price="${key}"`);
    n++; return open + P[key] + close;
  });
  if (out !== src) writeFileSync(path, out);
}

const faqPath = join(pub, 'assets', 'faq.json');
const faq = JSON.parse(readFileSync(faqPath, 'utf8'));
const a = cfg.faq.a.replace(/\{(\w+)\}/g, (m, k) => { if (!(k in P)) throw new Error('unknown token ' + m); return P[k]; });
const entry = { id: cfg.faq.id, q: cfg.faq.q, a };
const i = faq.findIndex(e => e.id === cfg.faq.id);
if (i >= 0) faq[i] = entry; else faq.splice(2, 0, entry);
writeFileSync(faqPath, JSON.stringify(faq, null, 2) + '\n');

// faq.html: the <details data-faq="shopify-pricing"> block is regenerated from the same text
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const faqHtml = join(pub, 'faq.html');
const fh = readFileSync(faqHtml, 'utf8');
const block = `<details class="r" data-faq="${cfg.faq.id}"><summary>${esc(cfg.faq.q)}</summary><p>${esc(a).replace('/shopify.html', '<a href="/shopify.html">our Shopify page</a>')}</p></details>`;
const fh2 = fh.replace(new RegExp(`<details[^>]*data-faq="${cfg.faq.id}"[^>]*>[\\s\\S]*?</details>`), block);
if (fh2 === fh && !fh.includes(block)) console.warn('faq.html: no data-faq block found, skipped');
else writeFileSync(faqHtml, fh2);

console.log(`Prices: ${Object.entries(P).map(([k, v]) => k + ' ' + v).join(', ')}. Updated ${n} price tags and the FAQ entry.`);
