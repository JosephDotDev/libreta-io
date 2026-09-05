# Libreta

A local-first personal workspace that runs as a desktop app. No account, no server, no subscription: documents, databases, images and settings live on your computer (IndexedDB + localStorage inside the app's webview). The app itself is plain HTML/CSS/JS with no build step, wrapped in a native window by [Tauri](https://v2.tauri.app).

Downloads for macOS, Windows and Linux are published on the **GitHub Releases** page of this repository.

Libreta is open source under the [MIT License](LICENSE); bundled fonts and KaTeX carry their own licenses, listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Contributions and forks are welcome.

---

## Running locally

**Just the web app** (fastest for UI work — any static server works):

```bash
npx serve .
# or
python3 -m http.server 8753
```

Everything works in a browser tab except the two things a desktop shell does natively: saving files and opening links go through the browser's own download/new-tab behaviour instead (see `js/core/platform.js`).

**The desktop app** needs Node, Rust and Tauri's platform prerequisites (see the Tauri docs for your OS: Xcode CLT on macOS, WebView2 + MSVC build tools on Windows, `libwebkit2gtk-4.1-dev` and friends on Linux).

```bash
npm install            # pulls in the Tauri CLI (the only dependency)
npm run desktop:dev    # assembles dist/ and opens the app in a native window
npm run desktop:build  # produces installers under src-tauri/target/release/bundle/
```

`scripts/build-dist.js` copies exactly the shipped files into `dist/`; Tauri embeds that folder into the binary. Edit the source files, not `dist/`.

**Icon and installer artwork** live in `src-tauri/branding/` (see its README). They are rendered from the app's own fonts by `scripts/make-branding.js`; `src-tauri/icons/` is generated from `branding/icon-1024.png` with `npx tauri icon`. Don't feed `favicon.svg` to `tauri icon` — it sets the mark in Cormorant and the rasteriser has no fonts, which is how 1.0.x shipped a blank square.

> `index_3.html` is a frozen pre-split snapshot of the original single-file build. Keep it as a reference only — all active development happens in `index.html` + `css/` + `js/`.

---

## What Libreta is

Libreta is a **personal content-planning workspace** — a place to write, organize, and track ideas without the overhead of a team tool. Its design principles:

- **Local-first.** Everything works offline, instantly, with no account required. Data lives in your browser.
- **Yours, on your machine.** No account and nothing to sign in to. Move between machines with Export / Import (a folder-based workspace that can sit in any synced folder is the next step).
- **No build step.** Plain HTML/CSS/JS loaded in order. Readable, hackable, and the desktop shell is a thin wrapper around the very same files.
- **Notion-like UX, personally owned.** Block editor, inline databases, calendar, page hierarchy — your data, your device, your rules.

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

### Data & backup
- No accounts and no cloud: the workspace lives entirely on this device
- **Settings → Data & Backup → Export / Import** — portable JSON backup of everything (documents, tables, settings, images and files); accepts legacy `folio` backups too. This is the way to move a workspace between machines today
- **Publish** — save any page as a self-contained HTML file
- **Settings → Danger Zone → Delete all my data** — wipes the device's workspace (double-confirmed)

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
| `platform.js` | browser vs. desktop bridge — loads first (see below) |
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

### `js/core/platform.js` — browser vs. desktop bridge
Loads first. `saveFileToDisk(blob, name)` and `openExternal(url)` are the only two places that know whether the page is in a browser tab or inside the Tauri shell (`window.__TAURI__`). In the shell, saving opens a native Save dialog and writes the bytes through the `dialog` + `fs` plugins; links go to the system browser through `opener`; a capture-phase click handler makes sure no external link can navigate the app window. Every download / new-tab call site in the app goes through these two functions.

### `js/core/updates.js` — update check
Desktop only. Asks GitHub's public releases API for the latest tag at most once a day, compares it with `getVersion()`, and offers a link to the download page if there is a newer one. It never downloads or installs anything. Settings → About shows the running version, a manual "Check for updates", and a switch to turn automatic checks off. This is the only request Libreta makes on its own initiative — see SECURITY.md → Network activity.

### `src-tauri/` — the desktop shell
`tauri.conf.json` (window, CSP, bundle metadata; `frontendDist` points at `dist/`), `capabilities/default.json` (the three permissions the page gets: `dialog:allow-save`, `fs:allow-write-file`, `opener:default`), `src/lib.rs` (plugin registration + a navigation guard that refuses to let the main window leave the app), `icons/` (generated from `favicon.svg` with `npx tauri icon`).

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

## Releasing

Releases are built by GitHub Actions (`.github/workflows/release.yml`) — there is no server anywhere in the pipeline.

1. Bump the version in **three** places so they agree: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` (then run `cargo generate-lockfile` in `src-tauri/` so `Cargo.lock` follows).
2. Add a CHANGELOG entry, commit, and push a tag: `git tag v1.0.1 && git push origin v1.0.1`.
3. The workflow builds macOS (Apple Silicon + Intel), Windows and Linux installers and attaches them to a **draft** GitHub Release. Review the notes, then publish.

### Android

The same tag also builds a **signed APK** for sideloading (`Libreta_<version>_android.apk`) — no Play Store, no fee. It needs a signing keystore in the repository secrets, created **once** and kept forever: Android only lets a newer APK install over an older one when both are signed with the same key, so losing it means every user has to uninstall and reinstall.

```bash
# one time, on your own machine — keep the .jks and the password somewhere safe (a password manager)
keytool -genkeypair -v -keystore libreta-android.jks -alias libreta -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 libreta-android.jks     # macOS: base64 -i libreta-android.jks
```

Repository → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the base64 output above |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password you chose |
| `ANDROID_KEY_ALIAS` | `libreta` |
| `ANDROID_KEY_PASSWORD` | the key password (same as the keystore password unless you set a different one) |

Until those exist the Android job still builds the APK as a check but skips signing and upload, with a warning in the run.

### Unsigned desktop installers

The installers are not signed with a paid Apple / Windows developer certificate.

- **Windows** shows a SmartScreen prompt; "More info → Run anyway" gets past it.
- **macOS refuses to open the app at all** — it reports "Libreta is damaged and can't be opened" — until the user runs `xattr -cr /Applications/Libreta.app` once. This is Gatekeeper's behaviour for any app Apple has not *notarised*. The bundle is ad-hoc signed (`bundle.macOS.signingIdentity` is `-`), which is required for arm64 binaries to execute at all, but ad-hoc signing does **not** satisfy Gatekeeper and does not produce the milder "unidentified developer / Open Anyway" prompt — that appears only for apps signed with a real Developer ID. Removing the Terminal step needs an Apple Developer Program membership ($99/year) plus notarisation in CI; `tauri-action` supports it via the `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD` and `APPLE_TEAM_ID` secrets. macOS users allow the app once under System Settings → Privacy & Security → Open Anyway; Windows users click "More info → Run anyway" on the SmartScreen prompt. `landing.html` (the site's front page) detects the visitor's OS and links straight to the right installer; `download.html` lists every file with install steps. Both read the latest release from GitHub's public API and fall back to the Releases page.

---

## Project history

| Phase | Summary |
|---|---|
| Phase 1 — Folio | Core block editor, image storage rewrite (IndexedDB), calendar, home, inline databases, all block types |
| Phase 2 — Libreta | Rebranded Folio → Libreta.io; Supabase cloud sync + auth; deployed to Vercel + libreta.io |
| Phase 3 — Polish | Bug fixes (stale sidebar after delete, slash menu keyboard nav, version history, nested page GC), mobile drawer, document tree view, linked-page cards, database views as direct slash commands |
| Phase 4 — Local-only mode | "Start writing — no account" path, account section, publish/export, per-record storage in IndexedDB |
| Phase 5 — Desktop | Cloud sync, auth, hosting and the service worker removed; the app ships as a Tauri desktop application built by GitHub Actions. Zero servers, zero cost to run |

Full details in **`CHANGELOG.md`**.