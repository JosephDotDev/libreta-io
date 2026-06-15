# Libreta

A local-first, Notion-like personal workspace. No build step, no dependencies — open `index.html` from any static server and it runs. Documents, databases, and settings live in the browser (`localStorage` + `IndexedDB`); optional cloud sync via Supabase keeps everything in sync across devices.

Live at **[libreta.io](https://libreta.io)** · deployed on Vercel.

---

## Running locally

```bash
# any static server works; the project's launch config defaults to :8753
npx serve .
# or
python3 -m http.server 8753
```

> `index_3.html` is a frozen pre-split snapshot of the original single-file build. Keep it as a reference only — all active development happens in `index.html` + `css/` + `js/`.

---

## What Libreta is

Libreta is a **personal content-planning workspace** — a place to write, organize, and track ideas without the overhead of a team tool. Its design principles:

- **Local-first.** Everything works offline, instantly, with no account required. Data lives in your browser.
- **Cloud sync as a layer.** Sign in with Supabase and your workspace follows you across devices (last-write-wins, not real-time; fine for solo use).
- **No build step.** Plain HTML/CSS/JS loaded in order. Readable, hackable, deployable in minutes.
- **Notion-like UX, personally owned.** Block editor, inline databases, calendar, page hierarchy — your data, your server, your rules.

---

## Feature overview

### Editor
- Block model with contenteditable blocks (flat array + nesting for columns and toggles)
- Slash (`/`) command menu — type to filter, arrow keys to navigate
- Block types: paragraphs, headings (H1–H3), quotes, callouts, code, to-do / bullet / numbered / alpha lists, toggles (collapsible), dividers, multi-column layouts (up to 3 resizable columns)
- Rich blocks: image (+ cover headers, carousel), file attachments, YouTube embeds (bookmark or inline player), editable grid tables, nested page links (inline or preview card), formatted link mentions
- Inline formatting: bold, italic, underline, strikethrough, inline code, text color + highlight
- Undo / redo (60-step history per document)
- Version history — automatic snapshots every ≥3 min while editing; browse, preview, and restore any snapshot
- Drag-and-drop block reordering; click empty space to place caret at nearest block
- Markdown shortcuts (type `**` for bold, `- ` for bullet, etc.)
- Document cover images + page icons (emoji or image); customizable page width (focused / full)
- Per-page font settings (Inter, DM Sans, Lora, Newsreader, Cormorant, DM Mono); visual filters including CRT and Pixel-art modes

### Databases (inline + full-page)
- Table, Board (Kanban), Calendar, and Timeline views
- Column types: text, select, multi-select, date, number, checkbox, URL, file/image
- Grouping, sorting, filtering, column drag/resize, row drag (including cross-group move)
- Row ↔ document link: every database row can open as a full page with its own blocks and properties
- Document peek panel (open a row as a side panel without leaving the current view)
- Slash-menu shortcuts: `/Kanban Board`, `/Database Calendar` to spin up a view directly

### Home & navigation
- Configurable home page: Recent Pages carousel, Favorites, free-form notes block area — sections are collapsible, reorderable, and hideable
- Home behaves like a document (cover, icon, editable title, width control, per-page font)
- Documents view: list/card toggle, sort + filter by property, Tree view (collapsible page hierarchy with sub-page counts)
- Global calendar view with drag-to-reschedule
- Overview panel
- Sidebar: resizable + collapsible; Recents, Favorites, and a full page tree with drag-to-nest, expand/collapse, and per-row actions (Duplicate deep-clone, Move to…, Add inside, Delete)
- ⌘K / Ctrl-K search (in-memory index, ranked by title-start > title > body)
- Back / forward navigation + breadcrumb trail
- Mobile: off-canvas drawer below 860 px; topbar hamburger

### Cloud sync & auth
- Supabase email + password auth; Google social sign-in; password recovery
- Auto-sync on load + debounced push on every save (no manual trigger)
- Snapshot = every `folio_*` localStorage key + every IndexedDB blob; docs, databases, settings, and images all travel
- RLS policy: each signed-in user reads/writes only their own `<userId>/state.json` in the `libreta` Storage bucket
- **Settings → Data & Backup → Export / Import** — portable JSON backup (accepts legacy `folio` format too)
- **Settings → Danger Zone → Delete all my data** — wipes local + cloud and signs out (double-confirmed)

---

## How the code is organized

Plain HTML/CSS/JS. JS files are **classic scripts loaded in order** (see the `<script>` block at the bottom of `index.html`): they share one global scope, which is what lets inline `onclick="…"` handlers in generated HTML call across files. Load order is meaningful — top-level code at load time may only use things defined in earlier files. `core/init.js` is the only file that does real work at load and it loads last.

### `index.html`
App shell: sidebar, topbar, one `<div class="view">` per page (home / documents / editor / calendar / overview), and every popover/modal (slash menu, block menu, property editors, confirm dialog, version history panel, icon picker, etc.). New popovers → markup here, behavior in a `js/ui/` or feature file.

### `css/` — numbered, load-order-sensitive
Later files intentionally override earlier ones (the app grew feature-by-feature). Keep new rules in the file that owns the feature; add a new numbered file only for a genuinely new surface.

Key files: `01-tokens.css` (design tokens — colors, fonts; start here for theming), `08-database.css` (all `idb-*` database-view styles), `16-components.css` (toast, tooltip, breadcrumbs), `19-page-settings.css` (font/width/visual-filter panel), `20-cloud.css` (sync indicator, auth UI).

### `js/core/` — plumbing

| file | owns |
|---|---|
| `state.js` | global `S` object + block-type definitions (`BT`) |
| `storage.js` | `DB` in-memory cache + swappable persistence adapter + IndexedDB blob store (`IDB`), `blankDoc`/`blankTbl` |
| `router.js` | `nav(view, id)` — single entry point for all view changes |
| `history.js` | back/forward stack + breadcrumb rendering |
| `save.js` | debounced autosave (`sched()` / `flushSave()`) |
| `versions.js` | per-document version snapshots (rolling 40 per doc, ≥3 min apart) |
| `config.js` | themes, fonts, settings panel |
| `utils.js` | cursor/date helpers |
| `init.js` | boot sequence — loads last |

### `js/ui/` — shared widgets
`feedback.js` (toast, progress toast, `data-tip` tooltips), `overlay.js`, `confirm.js` (`showConfirm`), `lightbox.js` (full-screen image viewer), `sidebar.js`, `sidebar-tree.js` (drag-to-nest page hierarchy), `search.js`, `tilt.js`.

### `js/editor/` — the block editor
Open/render (`editor-open.js`, `blocks-render.js`), nested block model (`block-model.js` — `locate()` handles columns + toggles), typing (`keyboard.js`, markdown triggers), block CRUD (`block-ops.js`), pointer drag-and-drop (`drag.js`), slash + block menus, cover + icon system, undo.

### `js/blocks/` — self-contained block types
Carousel, grid table, YouTube/bookmark, callout + nested-page + mentions, image block, file block. Adding a new block type: entry in `BT` (`core/state.js`), render branch in `editor/blocks-render.js`, and one file here.

### `js/db/` — inline database system (`idb*` functions)

| file | owns |
|---|---|
| `core.js` | table/title helpers, column types, filtering/sorting primitives, `idbSync` |
| `toolbar.js` | Group / Sort / Filter / Properties menus, column drag/resize, row drag |
| `block.js` | `mkDbBlockHtml` — view dispatcher |
| `table-view.js` | table rendering, cells, groups, select editor |
| `board-view.js`, `calendar-view.js`, `timeline-view.js` | other views |
| `cells-media.js` | image-cell uploads, add row/col |
| `row-doc.js` | row ↔ document link, peek panel, view persistence |
| `filters.js` | filter popover |
| `page-db.js` | full-page database + slash-menu creation |
| `doc-props.js` | shared DB properties shown in the document editor |

### `js/props/` — document properties
Standalone per-document properties (`properties.js`), property editor popover (`prop-editor.js`), select-option editing (`options.js`), quick editing from list surfaces (`quick-edit.js`), cross-view property filters (`filtering.js`).

### `js/views/` — pages
`home.js` (configurable home), `all-docs.js` + `databases-page.js` (legacy/table pages), `calendar.js` (global calendar), `overview.js`.

### `js/media/` — binary data
`compress.js` (canvas downscaling), `blob-gc.js` (reference collection, GC of orphaned blobs, legacy migration, export/import).

> **Important:** if you add any new place that stores an image reference, add it to `collectRefs()` in `blob-gc.js` — otherwise GC will silently delete those blobs.

### `js/cloud/` — sync + auth
`config.js` (Supabase project URL + anon key), `sync.js` (pull-on-load, debounced push-on-save, auth state, sync indicator chip).

---

## Data layer

`js/core/storage.js` separates *what* the app does with data from *where* it lives:

- **`DB`** is an in-memory cache that is the synchronous source of truth. Every read (`getDocs`, `getDoc`, `getTbls`, `getTbl`) hits the cache instantly; every write (`saveDoc`, `delDoc`, `saveTbl`, `delTbl`, `replaceAll`) updates the cache and hands off to the adapter.
- **The persistence adapter** (`Persist`, default `LocalStorageAdapter`) is the single place that knows the storage medium. It implements four methods: `loadDocs / loadTbls / persistDocs / persistTbls`.
- **Boot:** `await DB.load()` in `core/init.js` hydrates the cache from the adapter before the first render.

To add a different backend: implement those four methods against your API and call `setPersistenceAdapter(yourAdapter)` at startup. Nothing else in the app changes.

---

## Sidebar

- **Search** (`search.js`) — lazily-built in-memory index (title + block text), debounced, ranked title-start > title > body. ⌘K / Ctrl-K to focus.
- **Pages tree** (`sidebar-tree.js`) — parent relationship lives on docs (`meta.parent`); sidebar-only prefs (order, collapsed, hidden) in `localStorage.folio_sidebar`. Supports native drag-to-reorder/nest, expand/collapse, and a per-row ⋯ menu (Open, Add inside, Duplicate deep-clone, Move to…, Hide, Delete).
- **Footer** — Settings gear at the bottom. Page creation is via the tree's **+** or inline; there's no global "New Doc" button.

---

## Deployment

See **`DEPLOY.md`** for the full Vercel + Supabase setup. The short version:

```bash
./build.sh          # assembles dist/ (index.html, manifest, favicon, css/, js/)
cd dist
npx vercel --prod   # ship it
```

After any CSS/JS change, bump the `?v=N` cache-buster in `index.html` (one find/replace) so browsers fetch fresh assets.

---

## Asset cache-busting

`index.html`'s local `css/` + `js/` URLs carry `?v=N`. Bump `N` after any asset change. Production users get current code on a fresh load regardless.

---

## Project history

| Phase | Summary |
|---|---|
| Phase 1 — Folio | Core block editor, image storage rewrite (IndexedDB), calendar, home, inline databases, all block types |
| Phase 2 — Libreta | Rebranded Folio → Libreta.io; Supabase cloud sync + auth; deployed to Vercel + libreta.io |
| Phase 3 — Polish | Bug fixes (stale sidebar after delete, slash menu keyboard nav, version history, nested page GC), mobile drawer, document tree view, linked-page cards, database views as direct slash commands |

Full details in **`CHANGELOG.md`**.