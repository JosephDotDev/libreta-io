# Security

Libreta is a **desktop application**: plain HTML/CSS/JS running inside a Tauri
webview, with no server, no accounts and no network service of our own. Everything
the user writes stays on their machine. That shapes the threat model: there is no
account to take over and no shared backend to attack — what matters is that content
which reaches the page from outside (pasted links, imported backups, fetched link
previews) cannot run code, and that the page cannot do more on the machine than the
few things it needs.

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
grants the main window exactly three things beyond the core window API:

| Permission | Why |
|---|---|
| `dialog:allow-save` | Native Save dialog for Export, Publish and attachment downloads |
| `fs:allow-write-file` | Write the bytes to the path the user just picked in that dialog. The dialog adds only that path to the file-system scope — the page has **no** read access and cannot write anywhere else |
| `opener:default` | Open `http(s):` / `mailto:` / `tel:` links in the system browser |

No shell, no arbitrary file reads, no process spawning. All of it is used from one
file, `js/core/platform.js`.

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

## What is *not* in scope any more

- **Authentication, session tokens, rate limiting, password policy** — there are no
  accounts.
- **Server-side access control** — there is no server.
- **Third-party runtime dependencies** — fonts, KaTeX and the app code are all
  bundled into the binary; nothing is loaded from a CDN.
- **SQL injection** — there is no SQL and no query surface.

## Network activity

Libreta works with no connection at all. Everything it can send is listed here.

| Request | When | Carries |
|---|---|---|
| `api.github.com` — latest release | At most once a day, desktop only, and only while Settings → About has automatic checks on. Also on demand from "Check for updates" | Nothing. An unauthenticated GET; GitHub sees an IP and user-agent as it would for any page |
| YouTube oEmbed / embeds | Only when the user adds a YouTube block | The video ID |
| Link previews (public CORS proxies) | Only when the user pastes a link and asks for a preview | The URL being previewed — note this means a third-party proxy sees that URL |
| Image-from-URL | Only when the user adds an image by URL | The image URL |

The update check is the only one Libreta starts by itself, it never downloads or
installs anything, and it can be switched off permanently in Settings → About
(`js/core/updates.js`). Every other request is a direct result of a user action.

## Reporting

Open an issue on the GitHub repository. Since nothing runs on a server, a fix ships
as a new release for users to download; there is nothing to rotate or revoke.
