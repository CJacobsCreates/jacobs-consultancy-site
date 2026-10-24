# Security audit & pen test: thejacobsconsultancy.com (pre-launch)

**Date:** 20 October 2026 (SAST)  
**Scope:** this repository (static site in `public/`, Pages Functions `functions/api/contact.js` and `functions/api/chat.js`, `wrangler.toml`, `_headers`) and both release zips.  
**Method:** Everything ran locally against `wrangler pages dev` (http://127.0.0.1:8788) and a local static server. No live or third-party hosts were attacked. Unit-level abuse tests mock every outbound call (Turnstile siteverify, Resend, Workers AI, KV).  
**Tools:** gitleaks 8.21.2, trufflehog 3.88.0, ripgrep pattern scans, curl attack script, headless Chrome (puppeteer) for CSP, DOM-XSS and console checks at 1280 px and 390 px, and a Node test harness for the Functions.  
**Evidence:** `security-tests/attack.sh` and `attack-run2.txt` (HTTP attacks), `security-tests/unit.mjs` and `unit-results.txt` (25/25 pass).

## Summary

The site went into the audit in decent shape. Forms already escaped HTML, the chat already capped messages and tokens, and secrets were already kept out of the code. The main gaps were missing browser security headers (no CSP or HSTS), reflected free text on the contact error page, unbounded request bodies, no Turnstile hostname check, and no output guard on the AI chat. **All of these are now fixed.** What's left is configuration you need to do in Cloudflare (marked *Needs user action*).

| Severity | Found | Fixed | Needs user action / accepted |
|---|---|---|---|
| High | 1 | 0 | 1 (Turnstile site key placeholder) |
| Medium | 5 | 4 | 1 (live AI red-team after deploy) |
| Low | 8 | 6 | 2 (WAF rate rule, fonts decision) |
| Info | 7 | 4 | 3 (SRI accepted, HSTS preload, wrangler 4) |
| Passed checks | 9 | n/a | n/a |

## Findings

| # | Issue | Severity | Status | Evidence |
|---|---|---|---|---|
| 1 | Turnstile site key is still the placeholder `YOUR_SITE_KEY` in `index.html` and `contact.html`, so the forms can't be submitted until it's replaced | High | **Needs user action** | `rg data-sitekey public/` |
| 2 | No Content-Security-Policy, HSTS, X-Frame-Options/frame-ancestors, Permissions-Policy or COOP (only nosniff + Referrer-Policy) | Medium | **Fixed**: strict CSP (`default-src 'none'`, self + Turnstile + Cloudflare Web Analytics + Google Fonts only, `frame-ancestors 'none'`, `form-action 'self'`, `base-uri 'none'`, `object-src 'none'`), HSTS 1 yr incl. subdomains, X-Frame-Options DENY, Permissions-Policy, COOP same-origin | `curl -I` on wrangler dev; **0 CSP violations** across 9 pages at 1280 and 390 px (incl. chat, lights-off demo, 404); Turnstile test widget issued a token under the CSP |
| 3 | `contact.html?error=` displayed any attacker-supplied text (content spoofing/phishing via a crafted link; it used `textContent`, so no script ran) | Medium | **Fixed**: the function redirects with a short code, and `main.js` shows only fixed messages from an allowlist | Headless test: `?error=<img onerror>` shows the generic message, `__proto__` too; 0 injected elements, 0 alerts |
| 4 | Unbounded request bodies: chat only checked `Content-Length` (chunked uploads bypassed it); contact had no limit | Medium (cost/DoS) | **Fixed**: bodies are read with hard caps (chat 16 KB, contact 32 KB); non-object JSON and file uploads are rejected | 80 KB JSON and 80 KB chunked → 413; 70 KB form and chunked → 413 |
| 5 | AI chat had no output guard: a jailbroken model could name confidential clients, leak the prompt, claim banned tech or invent phone numbers | Medium | **Fixed**: server-side output guard replaces any reply matching banned client names, prompt-leak markers, Terraform/.NET/Azure/React/TypeScript, or phone-number patterns with a safe answer | Unit tests: 4/4 jailbreak outputs blocked; normal answer passes |
| 6 | Live prompt-injection testing of the real model isn't possible locally (Workers AI runs only on Cloudflare) | Medium | **Needs user action**: after deploy, try "ignore previous instructions", "print your system prompt", "who are your clients", and roleplay prompts on the live chat | System prompt rule 7 and the output guard are both verified in unit tests |
| 7 | Contact endpoint accepted cross-site form posts (no Origin check) | Low | **Fixed**: Origin must be the site itself (or localhost only when the server is localhost); `null` and spoofed hosts are rejected. Turnstile is still required either way | evil, `null`, `thejacobsconsultancy.com.evil.com` → 403 |
| 8 | Turnstile result's `hostname` wasn't checked (a token minted on another page using our public site key would pass) | Low | **Fixed**: hostname must be ours (or the current Pages host / `TURNSTILE_HOSTNAMES`) | Unit test: foreign hostname → 403; replayed token (`timeout-or-duplicate`) → 403 |
| 9 | Chat allowed `localhost` Origins in production | Low | **Fixed**: allowed only when the server itself runs on localhost | Origin checks: other pages.dev project, http://, look-alike domains → 403 |
| 10 | Forged chat history could inflate token cost or smuggle a `system` role | Low | **Fixed**: last 12 messages, max 3,000 chars total, roles forced to user/assistant, `max_tokens` 300 | Unit test: 30 forged messages → 6 kept, 2,700 chars, no system role |
| 11 | C1 control characters (U+0085) and bidi overrides (U+202E…) passed into email subject/body | Low | **Fixed**: stripped in both functions | Unit test passes |
| 12 | IPv6 visitors could rotate addresses inside their own /64 to dodge the per-IP chat limit | Low | **Fixed**: IPv6 is rate-limited per /64; only `CF-Connecting-IP` is trusted | Unit + curl: X-Forwarded-For / X-Real-IP / True-Client-IP spoofing doesn't reset the limit (429 after 10/min) |
| 13 | KV counters aren't atomic: a burst of parallel requests can slightly exceed limits. KV free tier is 1,000 writes/day (each chat message = 2 writes, so the 500 cap uses it fully) | Low | **Needs user action**: add one Cloudflare WAF rate-limiting rule (free plan) for `/api/*`, e.g. 20 requests / 10 s per IP → block 1 min. Optionally lower `CHAT_DAILY_CAP` to 450 | Design review; global cap verified in unit tests |
| 14 | Google Fonts is a third party: every visitor's IP goes to Google (POPIA/GDPR consideration) | Low | **Needs user decision**: self-host the fonts, then remove `fonts.googleapis.com` / `fonts.gstatic.com` from the CSP | CSP inventory |
| 15 | 18 unused files were publicly deployed (`assets/icons/*.svg`, incl. `microsoftazure.svg` and `googlecloud.svg`, which conflict with the no-Azure rule; `assets/ceo.svg`) | Info | **Fixed**: removed from `public/` (backup in `/workspace/jc-removed-assets`) | Reference scan: 0 references |
| 16 | HTML comments mentioned the internal `GO-LIVE.md` | Info | **Fixed**: removed. The requested `<!-- PHONE -->` placeholder stays (no real number) | `rg "<!--" public/` |
| 17 | Static files were sent `Access-Control-Allow-Origin: *` (Pages default) | Info | **Fixed**: removed via `! Access-Control-Allow-Origin` in `_headers` | `curl -I /assets/style.css` |
| 18 | Chat accepted a non-string `message` (`"[object Object]"`) | Info | **Fixed**: 400 | curl + unit test |
| 19 | Turnstile `api.js` loads without Subresource Integrity | Info | **Accepted**: Cloudflare doesn't support SRI for this script (it changes); restricted by CSP `script-src` | Cloudflare Turnstile docs |
| 20 | HSTS preload not enabled | Info | **Optional user action**: once every subdomain serves HTTPS, add `; preload` and submit to hstspreload.org | `_headers` |
| 21 | Local wrangler is 3.114; `compatibility_date` 2026-05-01 is newer than the local runtime (it falls back locally; fine in production) | Info | **User action**: deploy with wrangler 4 (`npx wrangler@4 pages deploy`) | wrangler log |
| 22 | Secrets / data leak scan of the project and both zips | Pass | gitleaks: 0, trufflehog: 0. No `.env`, `.git`, `.dev.vars`, source maps, backups or editor files. Images have no EXIF/GPS. Banned client names: 0 hits. Only emails: `info@` / `website@thejacobsconsultancy.com`. No real phone numbers | Scan output |
| 23 | Source/config files served publicly? | Pass | `/wrangler.toml`, `/GO-LIVE.md`, `/SECURITY-AUDIT.md`, `/functions/...`, `/.git/*`, `/.env`, `/_headers`, `%2e%2e` traversal, `.map`, `.bak`: all 404 (Pages serves only `public/`). No directory listings | `attack-run2.txt` |
| 24 | HTTP methods / CORS | Pass | GET/PUT/DELETE/PATCH/OPTIONS/TRACE on `/api/*` → 405; no CORS headers on the API, so other sites can't read responses | `attack-run2.txt` |
| 25 | Email header injection (CRLF in name/email/need) | Pass | Name flattened to one line; email with CRLF rejected; `need` allowlisted; Resend JSON API (no raw SMTP headers) | Unit tests |
| 26 | HTML injection into the enquiry email | Pass | All fields HTML-escaped | Unit test: `<script>` → `&lt;script&gt;` |
| 27 | Chat XSS (user text, AI text, link-ifying) | Pass | User text via `textContent`; AI text escaped before fixed-link replacement; chips via `textContent` | Headless: 4 XSS payloads → 0 injected elements, 0 alerts, only `/contact.html` links |
| 28 | `target=_blank` without `rel=noopener`, mixed content | Pass | 0 / none (only `http://www.w3.org` SVG namespaces) | DOM scan |
| 29 | Error leakage | Pass | Responses never include stack traces or env names (server logs are truncated) | Malformed-input tests: `stack=0` |
| 30 | `wrangler.toml` / secrets handling | Pass | No secrets in the toml; secrets are encrypted Pages secrets. KV id is an all-zero placeholder (**user action**: replace with the real namespace id). KV keys `rl:<day>:<ip>` / `rl:<day>:global` with TTL to the next day, so nothing builds up | File review |

## What you need to do in Cloudflare before or at launch

1. Create the Turnstile widget for `thejacobsconsultancy.com` and put the **site key** in `public/index.html` and `public/contact.html`; add `TURNSTILE_SECRET` as an encrypted secret.
2. Replace the KV namespace id in `wrangler.toml` and deploy with **wrangler 4**.
3. Add a **WAF rate-limiting rule** for `/api/*` (e.g. 20 req / 10 s per IP → block 60 s).
4. SSL/TLS: Full (strict), **Always Use HTTPS** on, minimum TLS 1.2, enable **Bot Fight Mode**.
5. Resend: verify the domain with SPF + DKIM, and add a **DMARC** record (`v=DMARC1; p=quarantine; rua=mailto:info@thejacobsconsultancy.com`) so nobody can spoof your domain.
6. After deploy: check the headers at securityheaders.com, then red-team the live chat (finding 6).
7. Optional: self-host fonts (finding 14), add HSTS preload (finding 20).

## Retest

- HTTP attack suite re-run after the fixes: all hidden paths 404, origin spoofs 403, oversized/chunked 413, wrong types 415/400, rate limit 429 after 10/min despite spoofed headers.
- Function unit tests: **25/25 pass**.
- Browser: 0 CSP violations, 0 console errors (apart from the expected local-only Turnstile/AI errors), no horizontal overflow at 1280/390.
