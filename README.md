# Folio

A local-first, Notion-like content planner. No build step, no dependencies —
open `index.html` from any static server and it runs. All data lives in the
browser: documents/databases/config in `localStorage`, images and file blobs
in `IndexedDB`.

## Running

```
# any static server works; the project's launch config serves on :8753
npx serve .        # or: python3 -m http.server 8753
```

`index_3.html` is the frozen pre-split snapshot of the app (single file).
It is kept only as a reference/backup — **do not edit it**; all development
happens in `index.html` + `css/` + `js/`.

## How the code is organized

The app is plain HTML/CSS/JS. The JS files are **classic scripts loaded in
order** (see the `<script>` list at the bottom of `index.html`): they share
one global scope, which is what lets the inline `onclick="…"` handlers in
generated HTML call across files. That makes load order meaningful — files
may freely call functions from *any* file at event time, but top-level code
that runs at load time may only use things loaded *before* it. `core/init.js`
is the only file that does real work at load, and it loads last.

### `index.html`
The app shell: sidebar, top bar, one `<div class="view">` per page
(home / documents / editor / tables / calendar / overview), and every
popover/modal (slash menu, pickers, config panel, confirm dialog…). If you
add a new popover, its markup goes here and its behavior in a `js/ui/` or
feature file.

### `css/` — numbered, load-order-sensitive
Stylesheets are numbered because later files intentionally override earlier
ones (the app evolved feature-by-feature). Keep new rules in the file that
owns the feature; add a new numbered file only for a genuinely new surface.
Highlights: `01-tokens.css` (design tokens — colors, fonts; start here for
theming), `08-database.css` (all `idb-*` database-view styles),
`16-components.css` (toast, tooltip, breadcrumbs).

### `js/core/` — plumbing
| file | owns |
|---|---|
| `state.js` | the global `S` state object + block-type definitions |
| `storage.js` | `DB` (in-memory cache) + a swappable persistence **adapter** + IndexedDB blob store, `blankDoc`/`blankTbl` |
| `router.js` | `nav(view,id)` — the single entry point for changing pages |
| `history.js` | back/forward stack + breadcrumbs |
| `save.js` | debounced autosave (`sched()`/`flushSave()`) |
| `config.js` | themes, fonts, settings panel logic |
| `utils.js` | cursor/date helpers |
| `init.js` | boot sequence (loads **last**) |

### `js/ui/` — shared widgets
`feedback.js` (toast, progress toast, `data-tip` tooltips), `overlay.js`,
`confirm.js` (`showConfirm`), `lightbox.js` (full-screen image viewer),
`sidebar.js`, `tilt.js`.

### `js/editor/` — the block editor
Open/render (`editor-open.js`, `blocks-render.js`), the nested block model
(`block-model.js` — `locate()` handles columns + toggles), typing
(`keyboard.js`, markdown triggers), block CRUD (`block-ops.js`), pointer
drag-and-drop (`drag.js`), slash + block menus, cover and page-icon systems,
undo.

### `js/blocks/` — self-contained block types
carousel, grid table, youtube/bookmark, callout + nested-page + mentions,
image block, file block. A new block type usually means: an entry in the
`BT` list (`core/state.js`), a render branch in `editor/blocks-render.js`,
and one file here.

### `js/db/` — the inline database system (`idb*` functions)
This is the heart of the app. A *database* is a table (`folio_tables`):
columns = shared properties, rows = entries; a row can link to a document
(`row.docId`) and the **Databases page** is the same system rendered
full-page (the synthetic `__pagedb__` block).
| file | owns |
|---|---|
| `core.js` | table/title helpers, column types, filtering/sorting primitives, `idbSync` |
| `toolbar.js` | Group/Sort/Filter/Properties menus, column drag/resize, row drag (incl. cross-group move prompt) |
| `block.js` | `mkDbBlockHtml` — view dispatcher |
| `table-view.js` | table rendering, cells (`idbCell`), groups, select editor |
| `board-view.js`, `calendar-view.js`, `timeline-view.js` | the other views |
| `cells-media.js` | image-cell uploads, add row/col |
| `row-doc.js` | row↔document link, peek panel, view persistence |
| `filters.js` | the filter popover |
| `page-db.js` | full-page database + slash-menu creation |
| `doc-props.js` | shared DB properties shown in the document editor |

### `js/props/` — document properties
Standalone per-document properties (`properties.js`), the property editor
popover (`prop-editor.js`), select-option editing (`options.js`), quick
editing from list surfaces (`quick-edit.js`), cross-view property filters
(`filtering.js`).

### `js/views/` — the pages
`home.js` (configurable home), `all-docs.js` + `databases-page.js`
(legacy/table pages), `calendar.js` (global calendar), `overview.js`.

### `js/media/` — binary data
`compress.js` (canvas downscaling), `blob-gc.js` (reference collection,
garbage collection of orphaned blobs, legacy migration, export/import).
**If you add a new place that stores an image ref, add it to `collectRefs()`
in `blob-gc.js`** — otherwise GC will delete those blobs.

## Sidebar (search + page tree)
The left sidebar (`index.html` markup + `js/ui/sidebar*.js` + `js/ui/search.js`,
styled by `css/18-sidebar-tree.css`) has three custom pieces:

- **Search** (`search.js`) — a lazily-built in-memory index of every document
  (title + extracted block text) cached in `_searchIdx` and invalidated when
  `DB.saveDoc`/`delDoc` run. Queries are debounced and ranked
  (title-start > title > body). ⌘K / Ctrl-K focuses it.
- **Pages tree** (`sidebar-tree.js`) — the customizable hierarchy. The parent
  relationship lives on the docs (`meta.parent`); sidebar-only prefs live in
  `localStorage.folio_sidebar` = `{order, collapsed, hidden}` so they don't
  pollute document data. Supports: drag to reorder/nest (native DnD with
  before/after/inside drop zones), a **+** on each section/row to add a page
  inside, expand/collapse, and a per-row **⋯** menu (Open, Add inside,
  Duplicate [deep — clones the whole sub-tree and remaps page-block links],
  Move to…, Hide, Delete). Hidden pages collect in a "Hidden" section.
- **Footer** — Settings (gear) lives at the bottom of the sidebar; the top bar
  is just back/forward + breadcrumbs. Page creation is inline / via the tree's
  **+** (no global "New Doc" button).

## Data layer (backend-ready)
`js/core/storage.js` separates *what* the app does with data from *where* it's
stored:

- **`DB`** is an in-memory cache that's the synchronous source of truth. Every
  read (`getDocs`/`getDoc`/`getTbls`/`getTbl`) hits the cache instantly; every
  write (`saveDoc`/`delDoc`/`saveTbl`/`delTbl`/`replaceAll`) updates the cache
  and hands off to the adapter. The whole app stays synchronous — call sites
  never `await`.
- **The persistence adapter** (`Persist`, default `LocalStorageAdapter`) is the
  one place that knows the storage medium. It implements four methods:
  `loadDocs / loadTbls / persistDocs / persistTbls` (load may be async).
- **Boot**: `await DB.load()` in `core/init.js` hydrates the cache from the
  adapter before the first render.

**Adding a backend (accounts / sync) later** = implement those four methods
against your API and call `setPersistenceAdapter(yourAdapter)` at startup
(after auth). `load*` can fetch over the network; `persist*` can be async /
queued. Nothing else in the app changes — verified by swapping in a mock async
API adapter and watching synchronous writes flow through to it. Images would
move from the IndexedDB blob store (`IDB`) to object storage in the same spirit
(the data already stores image *refs*, not bytes).

## Asset cache-busting (dev)
`index.html`'s local `css/`+`js/` URLs carry a `?v=N` query (currently `v=3`).
Because this is a no-build app served by a plain static server, browsers cache
the JS/CSS aggressively — bump the `N` (a one-line find/replace over `?v=`) when
you change assets and need a reload to pick them up. Production users opening
the file fresh always get current code regardless.

## Version history
`js/core/versions.js` keeps Notion-style page snapshots in
`localStorage.folio_versions` (`{[docId]: [{ts,title,blocks,props,meta}, …]}`,
capped at 40/doc). Snapshots are captured automatically: a **baseline** when a
page opens, **periodically** while editing (throttled to ≥3 min via
`flushSave`), and **always before a restore** (so reverting is reversible).
The "History" button in the editor opens a slide-over panel; clicking a version
shows a read-only preview modal with **Restore**.

**Sub-pages and restore (important design point):** a snapshot only stores the
page's own blocks. A sub-page is a *separate document* (a `page` block holds a
`pageId` pointer). Restoring an older version therefore **never deletes child
documents** — it only rewrites the parent's blocks. If the restored version
predates a sub-page, that link block disappears from the parent but the child
doc still exists and stays reachable from the Documents list ("orphaned", not
deleted), and a toast says so. `restoreVersion()` is the only restore path and
never calls `delDoc`. `collectRefs()` (blob-gc) also scans version snapshots so
a restored old image still has its blob; `DB.delDoc` purges a doc's versions.

## URL routing
Like Notion, Folio is a single-page app that keeps the address bar in sync —
implemented as **hash routes** (in `js/core/router.js`) so it works on any
static server with no rewrite rules:

```
#/home   #/docs   #/doc/<docId>   #/databases   #/db/<tableId>
#/calendar   #/overview
```

- Every `nav()` writes the matching route, so **refresh restores the page you
  were on**, and any page is deep-linkable.
- The browser's native back/forward buttons work (via `hashchange`), alongside
  the in-app ‹ › buttons (which keep their own stack in `core/history.js`).
- Boot (`core/init.js`) parses the hash and lands there; an unknown or deleted
  page falls back to home with a toast.
- If you add a new top-level view, give it a route in `routeFor()` +
  `parseRoute()` + `applyRoute()`.

## Ways to reach a page (worth knowing before touching navigation)
- sidebar / breadcrumbs / back-forward → `nav('editor', id)`
- home cards, recents, document rows → `nav('editor', id)`
- a database row's "Open" / calendar event / board card → `idbOpenRow` →
  `openDocPeek` (side/center peek or full editor, per settings)
- nested-page blocks and inline mentions inside a document
- the Databases page → `openTbl(id)` → full-page database → row → peek

## Conventions
- One feature per file; keep new code in the owning file.
- Generated HTML uses inline `onclick="fn(...)"` — any function referenced
  this way must stay global (top-level `function` declaration).
- Escape user text with `escHtml`/`escAttr` when building HTML strings.
- Tooltips: add `data-tip="…"` (immediate, styled) instead of `title`.
- After mutating a table, call `idbSync(blockId, tableId)` so sibling views
  of the same database re-render.
- Test in the browser with localStorage cleared *and* with existing data —
  most regressions historically came from the second case.
