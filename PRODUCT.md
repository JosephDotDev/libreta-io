# Libreta.io — Product Wiki

> Living reference for mission, features, architecture, and roadmap. Update this as the product evolves.

**Last updated:** July 12, 2026 · **Status:** Closed test shipped (Jun 20); offline support (service worker + self-hosted assets) landed Jul 12.

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

**Vision:** A local-first workspace where your data lives on your device, cloud sync is a layer you opt into (not a prerequisite), and the free tier is genuinely complete. No team overhead, no lock-in, no proprietary format trapping your notes.

**Core principles — every decision runs through these:**

| Principle | What it means in practice |
|---|---|
| **Local-first** | The app works fully offline, with no account. All data lives in the browser by default. |
| **Cloud sync as a layer** | Supabase sync is optional and additive — it never replaces local storage, it mirrors it. |
| **No build step** | Plain HTML/CSS/JS. Deployable from any static host in minutes. No Node, no bundler. |
| **Personally owned** | Users control their data. Export is always available. No lock-in by design. |
| **Zero marginal infra cost for free users** | Free users cost ~$0. Heavy compute stays in the browser; only paying users touch server infrastructure. |

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

**Lead with local-first as an identity, not a feature.** The free tier must feel complete — Sync and Lifetime are for people who already love Libreta, not a tax for using it.

### vs. Notion
- Data lives in your browser first; sync is optional.
- No workspace/team overhead.
- Free tier is genuinely unrestricted (not a teaser).

### vs. Obsidian
- Richer Notion-style databases (Table, Board, Calendar, Timeline) out of the box.
- Block editor with inline databases, covers, carousels, and YouTube embeds.
- Cloud sync doesn't require a paid plugin.

---

## 4. Business Model

| Tier | Price | What you get |
|---|---|---|
| **Free** | $0 forever | Full local workspace — every feature, unlimited documents, no account required |
| **Sync** | Monthly / Annual (TBD) | Cloud sync across devices, extended version history retention |
| **Lifetime** | One-time (TBD) | Everything in Sync, forever, for supporters who want to fund the project |

**Guardrail:** Free users cost ~$0 in infrastructure by design. Growth should be almost free; only paying users touch Supabase storage/compute. Never add per-user server compute to features that can live in the browser.

**Payment processor:** Paddle or Lemon Squeezy (handles global VAT automatically — pricing to be finalized in Week 2, Jun 27–28).

---

## 5. How Libreta Works

### The data model

Everything is a **document** or a **database table**. Both are stored locally in the browser (`localStorage` + `IndexedDB` for binary blobs). When a user signs in and enables sync, the entire workspace is mirrored as a single JSON snapshot to Supabase Storage (`<userId>/state.json`), scoped per user by RLS policy.

- **Documents** are standalone pages with a block array, metadata (title, icon, cover, parent), and optional properties.
- **Database tables** are collections of rows, where each row can also open as a full document page (row ↔ page link).
- **Pages** exist in a tree hierarchy via `meta.parent` references — this powers the sidebar tree and breadcrumbs.

### The editor

The block editor is the core of Libreta. A document is an ordered array of blocks. Each block has a type and content. Users interact via:

- **Slash menu** — type `/` anywhere to insert a block. Keyboard-navigable without moving the caret.
- **Block menu** — click the `⋮` handle on any block for move, duplicate, turn-into, and delete actions.
- **Markdown shortcuts** — `**text**` for bold, `- ` for bullet list, `# ` for H1, etc.
- **Drag handles** — reorder blocks by dragging.

### Sync model

Sync is **last-write-wins, whole-snapshot**. On load, Libreta pulls the cloud snapshot and merges it with local state. On every save (debounced), it pushes the full snapshot. This is intentionally simple — it's designed for a solo user on 1–2 devices, not real-time collaboration.

A "dirty flag" prevents a stale local state from accidentally overwriting a newer cloud snapshot.

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

#### Cloud sync & auth
- Supabase email + password sign-up/login
- Google social sign-in (Apple hidden pending setup)
- Password recovery flow
- Auto-sync on load + debounced push on every save
- Sync status indicator chip
- RLS policy: users read/write only their own data

#### Offline
- **Full offline boot** — service worker precaches the app shell atomically; from the second visit on, Libreta loads with no connection (fonts, math rendering, and cloud code included — sync simply resumes when back online)
- **Atomic updates** — new deploys download in the background; a toast offers "Reload"; users never run mixed old/new assets

#### Data management
- **Export / Import** — portable JSON backup (accepts legacy `folio` format)
- **Trash** — soft-delete, restore, 30-day auto-purge
- **Danger Zone** — wipe all local + cloud data (double-confirmed)

---

## 7. Tech Stack & Architecture

| Layer | Technology |
|---|---|
| **Frontend** | Plain HTML/CSS/JS — no framework, no build step |
| **Offline** | Service worker (`sw.js`) precaches the whole shell as one atomic version; app boots fully offline. Fonts, supabase-js (pinned 2.110.2), and KaTeX are self-hosted — no third-party CDN at runtime |
| **Hosting** | Vercel (static deploy via `./build.sh` → `dist/`; build also generates `sw-manifest.js`, the SW's content-hashed precache list) |
| **Local storage** | `localStorage` (documents, settings, DB tables) + `IndexedDB` (binary blobs — images, files) |
| **Cloud sync** | Supabase Storage — one `state.json` snapshot per user |
| **Auth** | Supabase Auth — email/password + Google OAuth |
| **DNS** | Porkbun → libreta.io |
| **Analytics** | Vercel Analytics |

### Key architectural decisions

**In-memory cache (`DB` object):** All reads are synchronous against an in-memory cache hydrated at boot. Writes update the cache and hand off to a swappable persistence adapter. This makes the UI fast and keeps storage concerns isolated.

**Whole-snapshot sync:** Rather than per-document syncing, the entire workspace serializes to a single JSON. Simple, robust for solo use, cheap on Supabase. Trade-off: not suitable for large workspaces with many large images (images are stored as IndexedDB blobs, referenced by UUID — only the reference travels in the JSON, not the blob itself, unless explicitly included in a full export).

**Classic scripts, shared global scope:** JS files are loaded in order via `<script>` tags. They share one global scope, which lets inline `onclick` handlers in generated HTML call across files. Load order is meaningful — `core/init.js` always loads last.

**CSS load order:** Numbered CSS files (`01-tokens.css` → `22-filters.css`) intentionally cascade — later files override earlier ones. `01-tokens.css` is the single source for design tokens (colors, fonts, spacing). New features get their own numbered file; don't scatter rules across existing files.

---

## 8. Codebase Map

```
index.html          App shell — all views, popovers, modals live here
sw.js               Service worker — offline shell cache, atomic updates, kill switch
fonts/              Self-hosted woff2 fonts (generated by scripts/vendor-fonts.js)
vendor/katex/       Vendored KaTeX 0.16.11 (js + css + woff2 fonts)
scripts/            Maintenance scripts (vendor-fonts.js regenerates fonts/ + 00-fonts.css)
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
  cloud/            Sync + auth
    sync.js           Pull-on-load, debounced push, auth state, sync chip
    config.js         Supabase URL + anon key
  vendor/           Vendored supabase-js (pinned, self-hosted)
  core/sw-register.js  SW registration + "update ready → Reload" toast
```

**Extending the editor:** To add a new block type — (1) add entry to `BT` in `core/state.js`, (2) add render branch in `editor/blocks-render.js`, (3) create a file in `js/blocks/`. If the block stores image references, register them in `collectRefs()` in `blob-gc.js` or GC will silently delete the blobs.

**Deployment:** `./build.sh` assembles `dist/`. After any CSS/JS change, bump the `?v=N` cache-buster in `index.html` before deploying (one find/replace). See `DEPLOY.md` for the full Vercel + Supabase setup.

---

## 9. Development History

| Phase | Name | Status | Summary |
|---|---|---|---|
| **Phase 1** | Folio prototype | Complete | Core block editor, IndexedDB image storage, calendar view, home page, sidebar, document properties, all block types, export/import |
| **Phase 2** | Libreta.io launch | Complete | Rebrand Folio → Libreta.io, Supabase cloud sync + auth, Google sign-in, loading screen, Vercel deploy + libreta.io domain, Vercel Analytics |
| **Phase 3** | Bug fixes & polish | Complete (pre-launch) | Sidebar stale-after-delete fix, slash menu keyboard nav fix, nested-page GC fix, Documents Tree view, mobile drawer (<860px), linked pages as cards, DB views as slash commands, Danger Zone + dirty-flag sync fix, onboarding flow |

---

## 10. Launch Roadmap

**Today is June 22, 2026.** The closed test shipped June 20 (on schedule). We are now in Week 2.

### Gate A — Closed Test ✓ Shipped Jun 20

| Area | Item | Status |
|---|---|---|
| Stability | Sync stress test (two devices, large images, offline→online) | Done |
| Stability | RLS isolation verified with two real accounts | Done |
| Stability | Export/import round-trip verified | Done |
| Stability | Cross-browser pass (Chrome, Safari, Firefox, mobile Safari) | Done |
| Security | Supabase auth rate limits + bot/CAPTCHA protection | Done |
| Security | Leaked-password (HaveIBeenPwned) check | Done |
| Security | Redirect URL allow-list locked to libreta.io + previews | Done |
| Onboarding | First-run welcome doc + empty states teaching slash menu | Done |
| Onboarding | 2–3 starter templates seeded for new accounts | Done |
| Onboarding | Clear "local vs synced" indicator | Done |
| Test logistics | 10–20 testers recruited (PKM / indie maker circles) | Done |
| Test logistics | Feedback channel (form or Discord + in-app link) | Done |
| Test logistics | Known-issues note sent to testers | Done |

### Gate B — Public Launch · Target: End of July 2026

#### Week 2 · Jun 22–28 — Feedback triage + monetization spike
| Days | Task |
|---|---|
| Mon–Tue Jun 22–23 | Triage feedback — cluster into bugs vs. friction vs. requests, rank by frequency and severity |
| Wed–Thu Jun 24–25 | Fix top bugs — burn down critical and high-frequency issues from test cohort |
| Fri Jun 26 | Smooth first-run friction points flagged by testers; ship updated build |
| Sat–Sun Jun 27–28 | **Monetization spike** — decide launch tiers, prototype Paddle/Lemon Squeezy checkout → **Pricing locked** |

#### Week 3 · Jun 29 – Jul 12 — Payments + marketing site
| Week | Task |
|---|---|
| Wk of Jun 29 | Wire monetization: integrate payment provider, gate Sync + extended version history behind paid tiers, build Lifetime purchase flow, add snapshot gzip compression |
| Wk of Jul 6 | **Marketing site:** landing page (local-first story, screenshots, pricing), template gallery as SEO discovery surface, per-tier storage caps enforced → **Site live** |

#### Week 4 · Jul 13–31 — Launch prep + public launch
| Week | Task |
|---|---|
| Wk of Jul 13 | Product Hunt assets + copy, seed 5–10 ambassadors from test cohort, draft "build in public" story, apply final feedback fixes |
| Wk of Jul 20 | Release-candidate hardening — full regression pass, analytics goals + error monitoring confirmed, billing edge cases tested → **RC freeze** |
| Wk of Jul 27 | **Go live** — Product Hunt launch day, ambassadors activate, story post published, monitor + support in real time → **PUBLIC LAUNCH** |

### Open items for Gate B

| Area | Item | Priority |
|---|---|---|
| Monetization | Decide launch tiers (Free + Lifetime first; Sync subscription next) | HIGH |
| Monetization | Integrate Paddle / Lemon Squeezy (global VAT handling) | HIGH |
| Monetization | Gate sync/version-retention behind paid tier in-app | HIGH |
| Monetization | Snapshot gzip compression before upload (cuts storage cost) | HIGH |
| Marketing | Landing page — local-first story, screenshots, pricing table | HIGH |
| Marketing | Template gallery as SEO discovery surface | HIGH |
| Growth | Product Hunt launch prepped (assets, copy, day-of plan) | MEDIUM |
| Growth | Seed 5–10 ambassadors from test cohort | MEDIUM |
| Growth | "Build in public" / bootstrapped story post drafted | MEDIUM |
| Hardening | Act on test feedback — top bugs + friction fixed | HIGH |
| Hardening | Per-tier sync storage caps enforced | HIGH |
| Hardening | Analytics goals + error monitoring confirmed | HIGH |

---

## Key guardrails (don't cross these)

1. **Keep heavy lifting in the browser.** No per-user server compute. If it can run client-side, it must.
2. **Free tier stays complete.** Sync and Lifetime are upsells to people who already love Libreta — not a gate on core functionality.
3. **Whole-snapshot sync integrity.** Only `CONTENT_RE` keys may trigger a push. The stale-push guard must not be weakened. (See `js/cloud/sync.js`.)
4. **XSS safety.** All user-controlled URLs go through `safeUrl()`; all user HTML through `sanitizeHtml()`. Do not bypass these. (`js/core/security.js`)
5. **Blob GC contract.** Any new block type that stores image/file references must register those refs in `collectRefs()` in `js/media/blob-gc.js`, or GC will silently delete the blobs.
6. **Cache-bust on every deploy.** Bump `?v=N` in `index.html` after any CSS/JS change. The service worker makes updates atomic for browsers it controls (whole-shell swap, never mixed versions), but `?v=N` still protects first visits and any browser without the SW.
7. **Service-worker discipline.** `sw-manifest.js` is generated by `build.sh` — never hand-edit or commit it. `sw.js` + `sw-manifest.js` must stay `no-cache` in `vercel.json`. If a bad SW ships, deploy with `KILL=1 ./build.sh` to make every client unregister and clear caches. If font file *contents* ever change in place, bump the `FONTS` cache name in `sw.js`.
8. **No third-party CDNs at runtime.** Fonts, supabase-js, and KaTeX are self-hosted (`fonts/`, `js/vendor/`, `vendor/katex/`) and CSP allows scripts/styles/fonts from `'self'` only. Don't reintroduce CDN loads — they break offline and reopen supply-chain exposure.
