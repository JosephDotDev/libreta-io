# Security

Libreta is one plain HTML/CSS/JS app shipped three ways — in a browser, in a Tauri
desktop window, and in a Tauri Android shell. It is **local-first**: every feature
works with no account and no connection, and the user's notes live on their device.

**Sync is optional.** A user may sign in to keep a copy in their own Supabase
account so their other devices can catch up. Signed out, the app makes no network
calls of its own beyond the daily update check.

That gives three areas to defend: content arriving from outside must not run code;
the desktop/Android shells must not expose more of the machine than they need; and
for users who do sign in, the account boundary must hold.

---

## Cross-site scripting (XSS) — the main risk for an editor

Block rich-text content is the one field rendered as raw HTML; everything else
(titles, table cells, properties, link previews) goes through `escHtml`. Two
untrusted boundaries feed that sink, and both are guarded in
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
  reach a workspace.

Inside the desktop shell a successful XSS would also reach whatever the shell
exposes to the page, which is why that surface is kept tiny (next section).

## What the page is allowed to do on the machine

Tauri's capability system ([`src-tauri/capabilities/default.json`](src-tauri/capabilities/default.json))
grants the main window the following beyond the core window API:

| Permission | Why |
|---|---|
| `dialog:allow-save` | Native Save dialog for Export, Publish and attachment downloads |
| `dialog:allow-open` | Native folder picker for "Keep my notes in a folder" |
| `fs:allow-read-file`, `read-text-file`, `read-dir`, `exists` | Read the workspace folder |
| `fs:allow-write-file`, `write-text-file`, `mkdir`, `rename`, `remove` | Write pages, media and settings into it (write-then-rename), and delete files for pages the user deleted |
| `opener:default` | Open `http(s):` / `mailto:` / `tel:` links in the system browser |
| `deep-link:default` | Receive the `libreta://auth-callback` URL a provider redirects to after sign-in. Sign-in itself happens in the real browser — the webview never hosts a provider's login form |

**None of the `fs` permissions carry a path scope of their own.** A path becomes
accessible only when the user picks it in a native dialog: a Save dialog grants
that one file; the folder picker grants that folder recursively. The
`persisted-scope` plugin remembers those grants across launches so the workspace
folder opens again without asking. The page can never read or write anywhere the
user did not explicitly choose. No shell, no process spawning. Everything above is
used from two files, `js/core/platform.js` and `js/core/workspace.js`.

Within the workspace folder, file names are derived from record ids that must
match `^[A-Za-z0-9_-]+$` — an imported backup cannot smuggle `../` into a path.

## The app window stays the app

- **Navigation guard** (`src-tauri/src/lib.rs`): the webview may only navigate to the
  app's own origin (`tauri://localhost` / `https://tauri.localhost`) and the YouTube
  embed hosts allowed by `frame-src`. Any other navigation is refused, so a link in a
  page, a dropped URL or a redirect can never replace the workspace with a web page.
- **Click interception** (`js/core/platform.js`): every external anchor is routed to
  the system browser before it can navigate; unhandled file/URL drops are swallowed.

## Content-Security-Policy

Set in [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) (`app.security.csp`);
Tauri injects it into the page. `default-src 'self'`; `connect-src` limited to Tauri's
IPC plus the YouTube oEmbed and link-preview proxy endpoints; `frame-src` limited to
YouTube; `object-src 'none'`; `base-uri 'self'`.

> **Known limitation:** `script-src`/`style-src` include `'unsafe-inline'` because
> the UI uses inline `onclick=`/`style=` attributes throughout. Tauri's automatic
> nonce/hash injection is therefore disabled for those two directives
> (`dangerousDisableAssetCspModification`) — a nonce would make browsers ignore
> `'unsafe-inline'` and break every inline handler. Refactoring the inline handlers
> into `addEventListener` wiring is the highest-value follow-up to make the CSP a
> real second line of defense against XSS.

## Accounts and sync (only for users who opt in)

Auth and storage are Supabase. The client code holds only the project URL and the
**anon key**, which is public by design — it can do nothing a Row-Level-Security
policy doesn't allow. The `service_role` key must never appear in this repository.

These are the controls that actually matter, and they live in the Supabase
dashboard, not in shipped code — an attacker can call the API directly:

1. **Row-Level Security on Storage** — a signed-in user may read/write only the
   folder named after their own `auth.uid()`. This is what makes the public anon key
   safe. Verify with two accounts that neither can read the other's files.
2. **Auth rate limits** — cap sign-in / sign-up / OTP / recovery per hour.
3. **Bot protection (CAPTCHA)** — so credential stuffing can't hit auth headlessly.
4. **Redirect URL allow-list** — only the real site origins plus the app's own
   `libreta://auth-callback`, so OAuth / magic-link / recovery tokens cannot be
   redirected to an attacker's page. Note a custom scheme is claimed by whichever
   app registers it, so it is not a secret channel — which is why the flow carries
   only what a redirect normally would, and the session is established by the
   client from that callback rather than trusted from it.
5. **Leaked-password protection** — the HaveIBeenPwned check on sign-up.

In the client, `js/cloud/sync.js` also locks the sign-in form for an escalating
cooldown after repeated failures. That only slows guessing through our own UI; items
2 and 3 above are the authoritative controls.

**Signing out leaves the notes on the device.** Deleting the account's copy is a
separate, double-confirmed action (Danger Zone), which wipes both sides.

## What is *not* in scope

- **A server we run** — there is no application server and no database we query from
  code; Supabase is reached directly from the client through RLS-scoped APIs.
- **Third-party runtime dependencies** — fonts, KaTeX and supabase-js are vendored
  and bundled; nothing is loaded from a CDN.
- **SQL injection** — there is no SQL and no query surface.

## Network activity

Libreta works with no connection at all. Everything it can send is listed here.

| Request | When | Carries |
|---|---|---|
| `api.github.com` — latest release | At most once a day in the installed app, and only while Settings → About has automatic checks on. Also on demand | Nothing. An unauthenticated GET; GitHub sees an IP and user-agent as it would for any page |
| `*.supabase.co` — auth + storage | **Only when the user has signed in.** On boot, on every change (debounced), and on a slow poll | The user's own notes and media, and their session token. Nothing else, and nothing at all while signed out |
| YouTube oEmbed / embeds | Only when the user adds a YouTube block | The video ID |
| Link previews (public CORS proxies) | Only when the user pastes a link and asks for a preview | The URL being previewed — note this means a third-party proxy sees that URL |
| Image-from-URL | Only when the user adds an image by URL | The image URL |

Signed out, the update check is the only request Libreta starts by itself; it never
downloads or installs anything and can be switched off in Settings → About. Signing
in is what turns on the Supabase traffic, and signing out turns it off again.

## Reporting

Open an issue on the GitHub repository. Since nothing runs on a server, a fix ships
as a new release for users to download; there is nothing to rotate or revoke.
