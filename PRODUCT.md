# Libreta.io — Product Wiki

> Living reference for mission, features, architecture, and roadmap. Update this as the product evolves.

**Last updated:** September 1, 2026 · **Status:** Phase 5 — Libreta is now a free desktop app (Tauri). Cloud sync, accounts, hosting and monetization are retired; the web deployment is being sunset.

---

## Table of Contents

1. [Mission & Vision](#1-mission--vision)
2. [Target Users](#2-target-users)
3. [Positioning](#3-positioning)
4. [Business Model](#4-business-model)
5. [How Libreta Works](#5-how-libreta-works)
6. [Feature Inventory](#6-feature-inventory)
7. [Tech Stack & Architecture](#7-tech-stack--architecture)
8. [Codebase Map](#8-codebase-map)
9. [Development History](#9-development-history)
10. [Launch Roadmap](#10-launch-roadmap)

---

## 1. Mission & Vision

**Mission:** Give solo creators a Notion-grade writing and organizing workspace that they personally own — no subscription required to think.

**Vision:** A local-first workspace where your data lives on your device, full stop. One-and-done software: free for everyone, nothing to subscribe to, no server that has to stay up for it to keep working. No team overhead, no lock-in, no proprietary format trapping your notes.

**Core principles — every decision runs through these:**

| Principle | What it means in practice |
|---|---|
| **Local-first** | The app works fully offline, with no account. All data lives on the device. |
| **No server, ever** | Nothing Libreta does may depend on infrastructure the author has to run, secure or pay for. Sync, if it comes, uses the user's own cloud drive or a direct device-to-device link. |
| **No build step** | Plain HTML/CSS/JS. The desktop shell wraps the very same files; only the Tauri CLI is needed to package it. |
| **Personally owned** | Users control their data. Export is always available. No lock-in by design. |
| **Zero cost to run** | GitHub Releases host the installers, GitHub Actions build them, GitHub Pages hosts the download page. The project can outlive its maintainer. |

---

## 2. Target Users

**Primary:** Solo creators, writers, indie makers, students, and PKM (Personal Knowledge Management) enthusiasts.

**Common profiles:**
- A writer who wants a block editor and content calendar without a Notion subscription.
- An indie maker who needs a project wiki and task board they can use offline.
- A student or researcher building a personal knowledge base they actually own.
- A PKM enthusiast who wants Notion-style databases without handing their data to a third party.

**Not the target:** Teams, collaborative workspaces, enterprise. Libreta is intentionally a solo tool — no real-time multiplayer, no permissions/sharing system, no commenting.

---

## 3. Positioning

**Tag line:** *"Your workspace. Your data. No subscription required to think."*

**Lead with local-first as an identity, not a feature.** There is exactly one tier and it is complete. "Free" is not a teaser: it is the product.

### vs. Notion
- Data lives on your computer; there is no account at all.
- No workspace/team overhead.
- Free and unrestricted (not a teaser).

### vs. Obsidian
- Richer Notion-style databases (Table, Board, Calendar, Timeline) out of the box.
- Block editor with inline databases, covers, carousels, and YouTube embeds.
- Free, with no paid tiers of any kind.

---

## 4. Business Model

There isn't one, on purpose. Libreta is **free for everyone, forever**, and is built so that it costs nothing to keep alive:

| Concern | How it's handled |
|---|---|
| Hosting the app | Not needed — it's a desktop app. Installers live on GitHub Releases |
| Building releases | GitHub Actions (free for public repos) |
| Download page | `landing.html` on GitHub Pages |
| User data | On the user's machine only; no storage bill, no breach surface |
| Payments, billing, taxes | None |

**Guardrail:** never add a feature that needs a server the author runs. If it can't run on the device or on infrastructure the *user* already owns (their cloud drive, their local network), it doesn't ship.

---

## 5. How Libreta Works

### The data model

Everything is a **document** or a **database table**. Both are stored on the device in IndexedDB (one record each; media blobs in a separate store), with small settings in localStorage. There is no remote copy — Export produces the single portable JSON file that represents the whole workspace.

- **Documents** are standalone pages with a block array, metadata (title, icon, cover, parent), and optional properties.
- **Database tables** are collections of rows, where each row can also open as a full document page (row ↔ page link).
- **Pages** exist in a tree hierarchy via `meta.parent` references — this powers the sidebar tree and breadcrumbs.

### The editor

The block editor is the core of Libreta. A document is an ordered array of blocks. Each block has a type and content. Users interact via:

- **Slash menu** — type `/` anywhere to insert a block. Keyboard-navigable without moving the caret.
- **Block menu** — click the `⋮` handle on any block for move, duplicate, turn-into, and delete actions.
- **Markdown shortcuts** — `**text**` for bold, `- ` for bullet list, `# ` for H1, etc.
- **Drag handles** — reorder blocks by dragging.

### Where data lives

Everything is on the device, inside the app's webview storage: documents and tables as one IndexedDB record each (`folio_data`), media blobs content-addressed in a second IndexedDB store (`folio_media`), and small singletons (theme, sidebar state, trash, version history) in localStorage. **Export** writes all of it to one portable JSON file; **Import** restores it — that is how a workspace moves between machines today.

Planned next: a folder-based workspace on disk behind the existing persistence-adapter seam (`setPersistenceAdapter()` in `js/core/storage.js`), so the data is visible, backupable, and can sit in any cloud-drive folder for device-to-device sync with no server involved. See §10.

### Navigation

All navigation goes through `nav(view, id)` in `js/core/router.js`. There are no separate URLs for documents — the app is a single-page shell. Back/forward state is maintained in a JS stack, not the browser history API.

---

## 6. Feature Inventory

### Shipped (as of Phase 3)

#### Block editor
- 20+ block types via slash menu with keyboard navigation
- **Text blocks:** Paragraph, H1/H2/H3, Quote, Callout, Code, Divider
- **List blocks:** To-do (checkbox), Bullet, Numbered, Alphabetical, Toggle (collapsible)
- **Layout:** Multi-column (up to 3 resizable columns), nested toggles
- **Rich blocks:** Image (+ cover/header), Carousel, YouTube (bookmark or inline player), File attachment, Editable grid table, Nested page link (inline or card), Formatted link mention
- **Grid table features:** Notion-style column/row resize (table width = sum of column widths), hover "+" strips to add columns/rows, header row & header column, per-row/column background tints (7-color palette via the ⠿ handle menu), per-column text alignment, and spreadsheet formulas — cells starting with `=` support A1-style refs (header row counts as row 1), ranges, SUM/AVG/MIN/MAX/COUNT, and arithmetic; formulas show their computed value and reveal the raw formula while editing (`js/blocks/grid-table.js`)
- **Inline formatting:** Bold, italic, underline, strikethrough, inline code, text color + highlight
- Markdown shortcuts, 60-step undo/redo
- Drag-and-drop block reordering
- Click empty space → caret snaps to nearest block

#### Page settings
- Cover image + page icon (emoji or custom image)
- Page width: Focused / Full
- Per-page font: Inter, DM Sans, Lora, Newsreader, Cormorant, DM Mono
- Visual filters: CRT mode, Pixel-art mode

#### Databases (inline + full-page)
- **Views:** Table, Board (Kanban), Calendar, Timeline
- **Column types:** Text, Select, Multi-select, Date, Number, Checkbox, URL, File/Image
- Group, sort, filter, column drag/resize, row drag (including cross-group move)
- Row ↔ document link — every row opens as a full document page
- **Peek panel** — open any row as a side panel without leaving the current view
- Slash shortcuts: `/Kanban Board`, `/Database Calendar` to create a view inline

#### Home & navigation
- **Home page** — Recent Pages carousel, Favorites, free-form notes; sections collapsible/reorderable/hideable; home behaves like a full document (cover, icon, title, width, font)
- **Documents view** — list/card toggle, sort + filter by property, Tree view (collapsible hierarchy with sub-page counts)
- **Global calendar** — drag-to-reschedule across dates
- **Sidebar** — resizable/collapsible; Recents, Favorites, full page tree with drag-to-nest, expand/collapse, per-row ⋯ menu (Duplicate deep-clone, Move to…, Add inside, Delete, Hide)
- **⌘K search** — in-memory index, ranked by title-start → title → body
- Back/forward navigation + breadcrumb trail
- **Mobile** — off-canvas drawer below 860px; topbar hamburger toggle

#### Version history
- Auto-snapshots every ≥3 minutes while editing
- Rolling 40 snapshots per document
- Browse, preview, and restore any snapshot

#### Desktop app (Phase 5)
- **Native window** on macOS, Windows and Linux via Tauri v2; the whole app is bundled into the binary, so it boots with no connection at all
- **Native Save dialogs** for Export, Publish and attachment downloads; links open in the system browser
- **No accounts, no sync service** — the workspace lives on the device

#### Data management
- **Export / Import** — portable JSON backup (accepts legacy `folio` format)
- **Publish** — save any page as a self-contained HTML file
- **Trash** — soft-delete, restore, 30-day auto-purge
- **Danger Zone** — wipe all data on this device (double-confirmed)

---

## 7. Tech Stack & Architecture

| Layer | Technology |
|---|---|
| **Frontend** | Plain HTML/CSS/JS — no framework, no build step |
| **Desktop shell** | Tauri v2 (`src-tauri/`): system webview (WKWebView / WebView2 / WebKitGTK), Rust host, ~5–10 MB installers. Plugins: `dialog`, `fs`, `opener` |
| **Bundle** | `scripts/build-dist.js` copies the shipped files into `dist/`; Tauri embeds them. Fonts and KaTeX are vendored — no CDN at runtime |
| **Local storage** | `IndexedDB` (documents + tables per record; media blobs) + `localStorage` (small settings singletons) |
| **Releases** | GitHub Actions (`.github/workflows/release.yml`) → GitHub Releases, triggered by a `v*` tag |
| **Download page** | `landing.html` → GitHub Pages (`.github/workflows/pages.yml`) |
| **Analytics / telemetry** | None |

### Key architectural decisions

**In-memory cache (`DB` object):** All reads are synchronous against an in-memory cache hydrated at boot. Writes update the cache and hand off to a swappable persistence adapter. This makes the UI fast and keeps storage concerns isolated.

**One bridge for platform differences:** `js/core/platform.js` is the only file that knows whether the page is in a browser tab or in the Tauri shell. Saving a file and opening a link are the two operations that differ; everything else in the app is platform-agnostic, which keeps the web-served version (for development, and for a possible mobile PWA later) identical to the desktop build.

**Classic scripts, shared global scope:** JS files are loaded in order via `<script>` tags. They share one global scope, which lets inline `onclick` handlers in generated HTML call across files. Load order is meaningful — `core/init.js` always loads last.

**CSS load order:** Numbered CSS files (`01-tokens.css` → `22-filters.css`) intentionally cascade — later files override earlier ones. `01-tokens.css` is the single source for design tokens (colors, fonts, spacing). New features get their own numbered file; don't scatter rules across existing files.

---

## 8. Codebase Map

```
index.html          App shell — all views, popovers, modals live here
landing.html        Download page (published to GitHub Pages)
src-tauri/          Desktop shell: tauri.conf.json, capabilities/, src/lib.rs, icons/
fonts/              Self-hosted woff2 fonts (generated by scripts/vendor-fonts.js)
vendor/katex/       Vendored KaTeX 0.16.11 (js + css + woff2 fonts)
scripts/            build-dist.js (assembles dist/ for Tauri), vendor-fonts.js (regenerates fonts/)
css/                Numbered stylesheets (00-fonts, 01-tokens through 40-mobile-fixes)
js/
  core/             Plumbing
    state.js          Global S object, block type definitions (BT)
    storage.js        DB cache + persistence adapter + IndexedDB blob store (IDB)
    router.js         nav(view, id) — single navigation entry point
    history.js        Back/forward stack + breadcrumb rendering
    save.js           Debounced autosave (sched / flushSave)
    versions.js       Per-document auto-snapshots
    config.js         Themes, fonts, settings panel
    utils.js          Cursor/date helpers
    security.js       XSS guards — safeUrl + sanitizeHtml
    platform.js       Browser vs. desktop bridge (save file, open link) — loads FIRST
    init.js           Boot sequence — loads LAST
  ui/               Shared widgets
    sidebar.js        Sidebar behavior
    sidebar-tree.js   Drag-to-nest page tree
    search.js         ⌘K search
    feedback.js       Toast, progress toast, tooltips
    overlay.js        Modal overlay
    confirm.js        showConfirm dialog
    lightbox.js       Full-screen image viewer
    onboarding.js     First-run experience
  editor/           Block editor
    editor-open.js    Open/render a document
    blocks-render.js  Block → HTML dispatcher
    block-model.js    locate() — handles columns + toggles
    keyboard.js       Typing, markdown triggers
    block-ops.js      Block CRUD
    drag.js           Pointer drag-and-drop
    (slash menu, block menu, cover/icon, undo)
  blocks/           Self-contained block types
    carousel.js, youtube.js, grid-table.js
    image-block.js, file-block.js
    callout-page-mention.js, math.js
  db/               Inline database system
    core.js           Column types, filtering/sorting, idbSync
    block.js          mkDbBlockHtml — view dispatcher
    table-view.js     Table rendering + cells
    board-view.js     Kanban view
    calendar-view.js  DB calendar view
    timeline-view.js  Timeline view
    toolbar.js        Group/Sort/Filter/Properties menus
    row-doc.js        Row ↔ doc link, peek panel
    cells-media.js    Image cells, add row/col
    filters.js        Filter popover
    page-db.js        Full-page database creation
    doc-props.js      Shared DB properties in doc editor
  props/            Document properties
    properties.js, prop-editor.js, options.js
    quick-edit.js, filtering.js
  views/            Page views
    home.js, all-docs.js, databases-page.js
    calendar.js, overview.js, tasks.js
  media/            Binary data
    compress.js       Canvas image downscaling
    blob-gc.js        Blob GC + export/import
```

**Extending the editor:** To add a new block type — (1) add entry to `BT` in `core/state.js`, (2) add render branch in `editor/blocks-render.js`, (3) create a file in `js/blocks/`. If the block stores image references, register them in `collectRefs()` in `blob-gc.js` or GC will silently delete the blobs.

**Releasing:** bump the version in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, push a `v*` tag, and GitHub Actions attaches installers to a draft release. See README → Releasing.

---

## 9. Development History

| Phase | Name | Status | Summary |
|---|---|---|---|
| **Phase 1** | Folio prototype | Complete | Core block editor, IndexedDB image storage, calendar view, home page, sidebar, document properties, all block types, export/import |
| **Phase 2** | Libreta.io launch | Complete | Rebrand Folio → Libreta.io, Supabase cloud sync + auth, Google sign-in, loading screen, Vercel deploy + libreta.io domain, Vercel Analytics |
| **Phase 3** | Bug fixes & polish | Complete | Sidebar stale-after-delete fix, slash menu keyboard nav fix, nested-page GC fix, Documents Tree view, mobile drawer (<860px), linked pages as cards, DB views as slash commands, Danger Zone + dirty-flag sync fix, onboarding flow |
| **Phase 4** | Local-only mode | Complete | "Start writing — no account", per-record IndexedDB storage, publish/export, mobile Add menu |
| **Phase 5** | Desktop | Shipped (this branch) | Removed Supabase sync/auth, Vercel hosting, analytics and the service worker; Tauri v2 shell with a three-permission capability set; GitHub Actions release pipeline; landing page → download page |

---

## 10. Roadmap

**Decision (Sep 2026):** Libreta is a one-and-done desktop app. No servers, no accounts, no billing — it must keep working with zero involvement from its author.

| Phase | What | Status |
|---|---|---|
| **1 — Desktop shell** | Tauri v2 wrapper; cloud, hosting and service worker removed; native save dialogs + external links; CSP and navigation guard | ✅ Done |
| **3 — Distribution** | GitHub Actions builds macOS (arm64 + x64), Windows and Linux installers on a `v*` tag; `landing.html` becomes the download page on GitHub Pages | ✅ Done (first tag still to be pushed) |
| **Web sunset** | Deploy one last web build with sign-up hidden, a banner pointing at the desktop download and Export, and the service-worker kill switch; after a grace period delete the Supabase project and the Vercel deployment | ⏳ Next — see below |
| **2 — Folder workspace** | Filesystem persistence adapter behind `setPersistenceAdapter()`: one JSON file per document/table, media by content hash, one settings file, in a user-chosen folder. One-click migration from IndexedDB. Gives desktop↔desktop sync for free through any cloud-drive folder | Planned |
| **4 — Bring your own cloud + mobile** | Storage adapter that talks straight to the user's Dropbox (later Google Drive) with client-side OAuth, reusing the per-record model; a mobile PWA served from GitHub Pages so phones can join | Planned |
| **Later — LAN sync** | Desktop hosts a local service; phone pairs by scanning one QR code (address + one-time key) and reconciles directly | Idea |

### Web sunset checklist

1. On the last web build: hide sign-up, keep sign-in for existing testers, add a banner — "Libreta is now a desktop app. Export your data (Settings → Data & Backup) and download it here." — and ship with the service-worker kill switch so browsers stop caching the old shell.
2. Tell the closed-test cohort directly; their data already mirrors into their browsers, so Export → Import into the desktop app is the migration.
3. After the grace period: delete the Supabase project (auth + storage), remove the Vercel project, point `libreta.io` at the GitHub Pages download page (or let it lapse).

---

## Key guardrails (don't cross these)

1. **Keep heavy lifting in the browser.** No per-user server compute. If it can run client-side, it must.
2. **Free tier stays complete.** Sync and Lifetime are upsells to people who already love Libreta — not a gate on core functionality.
3. **No server, ever.** Nothing may depend on infrastructure the author runs. Device-to-device sync goes through the user's own cloud drive or a direct connection.
4. **XSS safety.** All user-controlled URLs go through `safeUrl()`; all user HTML through `sanitizeHtml()`. Do not bypass these. (`js/core/security.js`)
5. **Blob GC contract.** Any new block type that stores image/file references must register those refs in `collectRefs()` in `js/media/blob-gc.js`, or GC will silently delete the blobs.
6. **Platform differences live in `js/core/platform.js` only.** Anything that saves a file or opens a link must go through `saveFileToDisk()` / `openExternal()`. Never add `<a download>`, `window.open` or `target="_blank"`-only behaviour elsewhere.
7. **Least-privilege shell.** `src-tauri/capabilities/default.json` grants the page a Save dialog, writing the file it picked, and opening links — nothing else. Any new capability needs a written justification in SECURITY.md.
8. **No third-party CDNs at runtime.** Fonts and KaTeX are vendored (`fonts/`, `vendor/katex/`) and CSP allows scripts/styles/fonts from `'self'` only. Don't reintroduce CDN loads — the app must work with no connection at all.
9. **Versions move together.** `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` carry the same version; a release is a `v*` tag matching them.
