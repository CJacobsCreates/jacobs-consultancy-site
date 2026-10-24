# Jacobs Consultancy website

The source for **[thejacobsconsultancy.com](https://thejacobsconsultancy.com)**, the site for my web studio in Cape Town. It's a hand-built static site on Cloudflare Pages with two small serverless functions: a contact form and an AI chat assistant.

No framework, no build step, no CMS and no plugins. The whole public site is under 1 MB.

## What's in it

| Path | What it does |
|---|---|
| `public/` | The static site: HTML, one stylesheet, a few small scripts, images in WebP |
| `public/_headers` | Security and caching headers for every static file |
| `functions/api/contact.js` | Contact form handler: Turnstile check, validation, email via Resend, branded confirmation email |
| `functions/api/chat.js` | AI chat: Workers AI, KV-backed rate limits, an output guard, and a FAQ fallback |
| `security-tests/` | Local attack script and a unit test harness for both functions (32 checks) |
| `pricing.json`, `scripts/apply-prices.mjs` | One source of truth for the starting prices shown in the FAQ |
| `SECURITY-AUDIT.md` | The pre-launch security review and what was fixed |

## Features

**Fast by default.** Plain HTML and CSS served from Cloudflare's edge, WebP images with explicit sizes so nothing jumps around while loading, fonts preconnected, and animations that respect `prefers-reduced-motion`. It's built to score well in Lighthouse without tricks.

**Strict security headers.** A Content-Security-Policy that starts from `default-src 'none'` and allows only the few origins the site actually needs (Turnstile, Cloudflare Web Analytics, Google Analytics and Google Fonts), plus HSTS, `X-Frame-Options: DENY`, a locked-down Permissions-Policy and `Cross-Origin-Opener-Policy`.

**A contact form that doesn't attract spam.**
- Cloudflare Turnstile, verified server-side, including a check that the token was issued on this site
- A honeypot field, body size limits and length caps on every field
- All user input escaped before it goes into an email
- Fails closed: if a secret is missing, visitors are told to email directly instead of the form silently failing
- Sends the enquiry with [Resend](https://resend.com), then a branded confirmation to the visitor that never echoes back what they typed

**An AI assistant that stays on topic and on budget.**
- Runs on Cloudflare Workers AI
- Per-IP limits (per minute and per day) and a global daily cap, stored in Workers KV, with IPv6 addresses grouped by /64 so rotating addresses doesn't reset the limit
- Only accepts requests from the site's own origin
- History is trimmed and roles are forced server-side, so a visitor can't inject a fake system message
- An output guard swaps out any reply that leaks the prompt, makes a claim the business doesn't make, or invents a phone number
- If the AI isn't available, a small keyword-based FAQ answers instead

## Run it locally

You need Node 20+.

```bash
npx wrangler pages dev public
```

That serves the site at http://127.0.0.1:8788 with the functions running. The form and chat fail closed until you add secrets, which is expected.

To run the tests:

```bash
node security-tests/unit.mjs              # function-level tests, all network calls mocked
bash security-tests/attack.sh             # HTTP checks against the local dev server
```

## Deploy

```bash
npx wrangler pages deploy public --project-name=<your-project>
```

Bindings and plain variables live in `wrangler.toml`. Secrets never go in the repo; add them as encrypted Pages secrets:

| Secret | Used for |
|---|---|
| `TURNSTILE_SECRET` | Server-side Turnstile verification |
| `RESEND_API_KEY` | Sending the enquiry and confirmation emails |
| `BLOCKED_NAMES` | Optional comma-separated names the chat must never say (for example confidential clients) |

The KV namespace id in `wrangler.toml` is not a secret (it's useless without the account's API credentials), but if you fork this, create your own namespace and replace it.

## About

Built and maintained by [Cheslin Jacobs](https://github.com/CJacobsCreates). If you'd like a site like this for your business, get in touch at [info@thejacobsconsultancy.com](mailto:info@thejacobsconsultancy.com).

The code is here so you can see how it's put together. The copy, logo and photos belong to Jacobs Consultancy, so please don't reuse those.
