# Security

Libreta is a **static front-end** (HTML/CSS/JS, no server we run) plus **Supabase**
(Auth + Storage) for cloud sync. There is no application server and no database we
query from code, so the threat model is shaped accordingly. This document records
what's been hardened in the code and the controls that must be set **server-side
in the Supabase dashboard** (those can't live in shipped browser code).

---

## What lives in the client (done in code)

### 1. Cross-site scripting (XSS) — the main risk for an editor
Block rich-text content is the one field rendered as raw HTML; everything else
(titles, table cells, properties, link previews) goes through `escHtml`. Two
untrusted boundaries feed that sink, and both are now guarded in
[`js/core/security.js`](js/core/security.js):

- **`safeUrl(url)`** — allow-lists link schemes (`http`, `https`, `mailto`, `tel`).
  `javascript:`, `data:`, `vbscript:`, `file:`, `blob:` (incl. obfuscated
  `java\tscript:`) collapse to `#`. Applied to link "mentions"
  (`js/blocks/callout-page-mention.js`) and URL properties (`js/props/prop-editor.js`).
- **`sanitizeHtml(html)`** — whitelist sanitizer that parses into an inert
  `<template>`, drops dangerous elements (`script`, `iframe`, `object`, `svg`, …),
  unwraps unknown tags, and strips `on*` handlers, inline `style`, and unsafe URL
  attributes. Run on **every imported backup** (`sanitizeImportedDocs` in
  `js/media/blob-gc.js`) — the realistic path for attacker-controlled HTML to
  reach a victim's session.

### 2. Content-Security-Policy + security headers
Set as real HTTP headers in [`vercel.json`](vercel.json) (stronger than `<meta>`,
and lets us send `frame-ancestors`):

- `default-src 'self'`; `connect-src` limited to Supabase, the YouTube oEmbed and
  link-preview proxy endpoints, and Vercel analytics; `frame-src` limited to
  YouTube; `object-src 'none'`; `base-uri 'self'`; `frame-ancestors 'none'`
  (clickjacking); `upgrade-insecure-requests`.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
  (locks down geolocation/mic/camera/etc.), `Strict-Transport-Security`,
  `Cross-Origin-Opener-Policy`.

> **Known limitation:** `script-src`/`style-src` include `'unsafe-inline'` because
> the UI uses inline `onclick=`/`style=` attributes throughout. CSP nonces do **not**
> cover inline event-handler attributes, so removing `'unsafe-inline'` requires
> refactoring those into `addEventListener` wiring first. That's the highest-value
> follow-up to make the CSP a real second line of defense against XSS.

### 3. Auth brute-force throttle (defense in depth)
`js/cloud/sync.js` locks the sign-in form for an escalating cooldown after repeated
failures. This only slows guessing **through our UI** — see the server-side note
below for the authoritative control.

---

## What must be set in Supabase (server-side — do this in the dashboard)

These are the real controls. They cannot be enforced from browser code because an
attacker can call the Supabase API directly with the public anon key.

1. **Auth rate limits** — Dashboard → *Authentication → Rate Limits*. Cap
   sign-in / sign-up / OTP / recovery requests per hour. Keep the defaults at a
   minimum; lower the token-refresh and email limits if abuse appears.
2. **Bot protection (CAPTCHA)** — *Authentication → Settings → Bot and Abuse
   Protection*. Enable hCaptcha/Turnstile so credential-stuffing scripts can't hit
   the auth endpoints headlessly. (Pair with `captchaToken` in the client calls.)
3. **Row-Level Security on Storage** — confirm the policy on `storage.objects`
   restricts a signed-in user to **their own `auth.uid()` folder** for select /
   insert / update / delete. This is what makes the **public anon key safe** — the
   key only ever does what RLS allows. Verify with two accounts that neither can
   read the other's `state.json`.
4. **Redirect URL allow-list** — *Authentication → URL Configuration*. Only
   `https://libreta.io/**` (and your Vercel preview domains). Prevents OAuth /
   magic-link / recovery tokens from being redirected to an attacker site.
5. **Leaked-password protection** — *Authentication → Settings* → enable the
   HaveIBeenPwned check so users can't pick known-breached passwords.

---

## Keys & secrets

- **`SUPABASE_ANON_KEY`** (`js/cloud/config.js`) is **public by design** — it ships
  in browser code and is gated by RLS (point 3 above). This is correct; it is *not*
  a leak.
- **`service_role` key** must NEVER be placed in client code or this repo. There is
  no use for it in a static front-end.
- **`.env*` files** (e.g. `dist/.env.local`, which Vercel CLI generates with a
  short-lived `VERCEL_OIDC_TOKEN`) must never be deployed or committed. `build.sh`
  copies only the explicit file list, and `.gitignore` excludes `dist/` — but if
  you ever deploy a folder by hand, exclude `.env*`. Rotate any OIDC/dev token that
  has been shared.

## Not applicable

- **SQL injection** — there is no SQL in the codebase and no server-side query we
  build from user input. Data access goes through the Supabase Storage SDK
  (object get/put under an RLS-scoped path). There is no injectable query surface.
  If a Postgres/PostgREST data model is added later, use the SDK's parameterized
  query builder (never string-concatenated SQL / `rpc` with interpolated SQL).
