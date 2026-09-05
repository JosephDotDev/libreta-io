# Changelog

A Notion-like personal content-planning web app. Started as a single-file
prototype (**Folio**), renamed to **Libreta.io**, now deployed on Vercel with
Supabase cloud sync. Reconstructed from session history; oldest first.

---

## Phase 1 — Core editor & content (Folio prototype)

### Added
- Document editor with a block model (contenteditable blocks, flat array with nesting).
- **Image headers/covers** with IndexedDB blob storage (reference model + UUIDs)
  to get past the localStorage "storage full" limit; image compression and
  **image-from-URL** download + cache.
- **Calendar view** with document cards showing the header image; drag-and-drop
  to reschedule; "Details on" by default; taller day boxes fitting the thumbnail.
- **Home page**: Recent Pages carousel (last 10 edited), Favorites section
  (introduced page favoriting), collapsible/reorderable/hideable sections, and a
  free-form notes block area below. Made the home behave like a normal document
  (cover, icon, editable/removable title, width control).
- **Sidebar**: resizable + collapsible; collapsible Recents and Favorites menus.
- Document properties with quick-select editing from other views (e.g. change
  status without opening the page); property-based filtering on every page;
  sort + row/card view toggles in Documents.

### Block types
- Image **carousel** (dynamically sized, vertical/horizontal crop config, add/remove slides).
- **YouTube embeds** — bookmark style (thumbnail + title/description) and inline player.
- **Tables** (editable grid, optional header row).
- **Multi-column layouts** (up to 3 resizable columns side by side).
- **Mentions / formatted links** (icon + author + title, clickable, valid in table cells).
- **Nested pages** (page-link block).
- **Callout** and **quote** blocks.
- **Stylized text** (bold, italic, underline, strikethrough).
- **To-do / checkbox** lists; numbered / bulleted / alphabetical lists; **toggle** (collapsible) blocks.

### Editor UX
- Slash/block menu consolidated (per-block controls moved into the block menu;
  "new block above/below"; held = move, click = options like turn-into/duplicate).
- Collapsing header on scroll (smoothed out of earlier rubber-banding) so writing
  area gets more room.
- Breadcrumb navigation + back/forward buttons; nested page hierarchy.
- Ctrl+Z **undo** support; "Select All" selecting page blocks; click empty space
  places caret at nearest block (not jump to bottom).
- Toast + shake feedback for invalid actions (e.g. too many large side-by-side blocks).
- Export / import of data.

### Fixed
- 13.7 MB image "storage full" loss on refresh (IndexedDB rewrite).
- YouTube error 153; cropped bookmark/player thumbnails; minimal play button.
- Callout icon alignment; user-settable (non-random) icons; formatted-link wrapping.
- Markdown-typed lists reverting to grey "list item" with stranded caret.

---

## Phase 2 — Rename, cloud sync & deployment (→ Libreta.io)

### Changed
- Rebranded **Folio → Libreta.io** (logo, in-app indicators, storage keys,
  Supabase bucket `libreta`, `DEPLOY.md` rewritten for Vercel + Supabase).

### Added
- **Supabase cloud sync** with autosync (no more manual trigger) — log in on any
  device and see the same data.
- **Auth**: account sign-up/login, **password recovery page**, **logout** button,
  **Google social sign-in** (Apple hidden for now); login-form layout polish.
- Loading-screen inspirational quote / fun fact.
- Vercel Analytics.
- Deployed to Vercel + the `libreta.io` domain.

### Fixed
- Don't show "Title" as a shared DB property (it's built in).
- Top-of-page writing padding; smoother animations; home banner spacing.
- Hide/Show properties panel in page edit view, Home, and Documents views.
- Mobile: sidebar collapse button reachable when page menu is long.

---

## Phase 3 — Bug fixes & polish (current)

### Fixed
- **Recents/sidebar stale after delete** — deleting from any surface now refreshes
  the sidebar tree, Recents, and Trash badge immediately. (`js/core/trash.js`, `js/ui/sidebar-tree.js`)
- **Slash menu keyboard nav moved the caret** — block key handler yields Enter / ↑ / ↓ /
  Escape to the slash menu while open. (`js/editor/keyboard.js`)
- **Wide page icons cropped/misaligned** — icons use `object-fit: contain`, centered
  in the square box. (`css/12-editor-extras.css`)
- **Nested page resurrected after parent delete** — deleting a parent clears `S.docId`,
  cancels autosave, and navigates Home when the open page is in the deleted subtree;
  `openEditor` refuses to recreate a non-existent page from a stale breadcrumb.
  (`js/core/trash.js`, `js/editor/editor-open.js`)

### Changed
- **Font settings on Home** — `Aa` button now appears on Home with a Typeface-only
  popover that persists. (`js/core/config.js`, `js/views/home.js`, `css/19-page-settings.css`)
- **Sync indicator moved into the topbar** — cloud chip lives in the topbar's right
  action cluster instead of floating. (`js/cloud/sync.js`, `css/20-cloud.css`, `index.html`)
- **Consistent header height** — topbar fixed at 52px across all views. (`css/02-layout.css`)
- **Themed scrollbars** — custom webkit + Firefox scrollbar styling (notably for
  Windows/Chromium). (`css/02-layout.css`)

### Added (batch 2)
- **Documents page hierarchy** — new **Tree** view shows pages as a collapsible
  nested hierarchy with sub-page counts, plus per-row Duplicate / Move to… /
  Add-inside / Delete (reusing the sidebar's page actions). (`js/views/home.js`,
  `index.html`, `css/03-home-docs.css`)
- **Sidebar shortcut visibility** — Settings → "Sidebar shortcuts" lets you
  show/hide the Home, Documents, and Calendar nav items (still reachable via
  breadcrumbs/links). (`js/core/config.js`, `index.html`)
- **Mobile / narrow-viewport drawer** — below 860px the sidebar becomes an
  off-canvas drawer opened by a topbar hamburger, giving content the full width
  for a vertical-friendly layout. (`css/02-layout.css`, `js/ui/sidebar.js`,
  `js/core/router.js`, `index.html`)

### Changed (batch 2)
- **Slash menu scrolls with arrow keys** — the highlighted item now scrolls into
  view when navigating past the visible edge. (`js/editor/slash-menu.js`)
- **Page title adopts the page font** — the topbar breadcrumb title renders in the
  page's own typeface again. (`js/core/history.js`, `js/core/config.js`)
- **Bigger, bolder sidebar + section headers** — sidebar nav/labels, page-tree
  rows, and Home section titles (Recent Pages, Favorites…) increased in size and
  weight. (`css/02-layout.css`, `css/18-sidebar-tree.css`, `css/13-home-redesign.css`)

### Added (batch 3)
- **Database views as direct blocks** — `/Kanban Board` and `/Database Calendar`
  spin up a new database straight into that view, skipping the source/view
  picker. (`js/core/state.js`, `js/editor/slash-menu.js`)
- **Linked pages as cards** — a linked page block can be shown as an inline link
  or a preview card (cover + icon + title + excerpt), toggled from the block
  menu. (`js/blocks/callout-page-mention.js`, `js/editor/block-menu.js`, `css/15-rich-blocks.css`)
- **Delete all my data (Danger Zone)** — wipes every page, database, image and
  setting locally and in the cloud, then signs out (double-confirmed). Auth-user
  deletion still needs a Supabase server function. (`js/cloud/sync.js`, `js/core/config.js`, `index.html`)

### Fixed (batch 3)
- **Deleted data resurrecting on quick reload** — unpushed local edits (e.g. a
  deleted database property) now win over the older cloud snapshot via a dirty
  flag + page-hide flush, instead of being overwritten on next boot. (`js/cloud/sync.js`)
- **Slash submenu arrow keys** — arrows/Enter now drive the Database source/view
  submenu instead of wiping it back to the block list. (`js/editor/slash-menu.js`, `js/db/page-db.js`, `js/editor/keyboard.js`, `js/core/state.js`)
- **Broken-image cover on cards** — the solid-accent placeholder cover renders as
  a color fill on cards/calendar instead of a broken `<img>`. (`js/editor/cover.js`, `js/views/home.js`, `js/views/calendar.js`)
- **Cover-by-URL took several steps** — a "Link cover" button now shows when a
  page has no cover, so linking an image is one click. (`js/editor/cover.js`)
- **Database property chip spacing** — the `⊞` icon no longer sits flush against
  the property name. (`css/08-database.css`)
- **Writing-section start padding** — more breathing room above the first block. (`css/04-editor.css`)

### Added (batch 4)
- **Multi-block selection** — drag across blocks of any type (or grab from the
  left margin) to select whole blocks; Esc clears, ⌘/Ctrl+A extends to all.
  (`js/editor/multiselect.js`, `css/04-editor.css`)
- **Block-preserving clipboard** — copy/cut/paste selected blocks keeps each
  block's type (cut an H2 → paste an H2); pastes after the caret or replaces the
  selection, and falls back to clean HTML/plain-text for other apps.
  (`js/editor/multiselect.js`)

### Fixed (batch 4)
- **Can't select across different block types** — a heading and the text under it
  can now be highlighted together (native selection couldn't cross contenteditable
  block boundaries). (`js/editor/multiselect.js`)
- **Deleting blocks emptied by a cut** — empty blocks (including a leftover `<br>`)
  delete cleanly with Backspace, and any block(s) can be selected and removed with
  Delete. (`js/editor/multiselect.js`)

### Added (batch 5)
- **Multi-line paste → one block per line** — pasting text with line breaks (e.g.
  notes written with Shift+Enter) now creates a separate block per line, Notion-
  style. (`js/blocks/callout-page-mention.js`)
- **Per-property name/value controls** — a property's name is click-to-rename in
  place; clicking its value opens an Edit / Rename / Delete menu. Works for page
  properties and shared database properties. (`js/props/properties.js`, `js/db/doc-props.js`, `css/04-editor.css`)

### Changed (batch 5)
- **Page icon sits above the title** — stacked like the cover, instead of inline to
  the left. (`css/12-editor-extras.css`)

### Fixed (batch 5)
- **Editing a property value opened an OS dialog** — database entry values now edit
  in place with an inline field instead of a browser `prompt()`. (`js/db/doc-props.js`)
- **Block-selection highlight too tight** — the selection now has padding around the
  text instead of sitting right on it. (`css/04-editor.css`)

  ### Added (batch 6)
- **Visual filters** — Settings → Visual filter applies a whole-app display effect,
  just for fun: **Pixel art** (bitmap font, square edges, posterized/pixelated
  imagery), **CRT** (scanlines, vignette, gentle flicker + phosphor glow), and
  **Black & White** (grayscale). Purely cosmetic; content is untouched, and the
  choice persists. (`css/22-filters.css`, `js/core/config.js`, `index.html`)

### Changed (batch 10)
- **Inline calendars use the Properties menu** — the database table's show/hide
  Properties menu now also appears on calendar-view blocks (controls which
  property chips + cover show on events); the old "Covers & properties" toggle
  button was removed. (`js/db/calendar-view.js`)
- **Properties menu spacing** — the property type icon now has space before the
  name in the show/hide menu. (`css/08-database.css`)

### Changed (batch 9)
- **Database calendars match the calendar page** — long event titles truncate with
  "…" (columns stay equal) and adjacent-month days now show their events dimmed.
  (`js/db/calendar-view.js`, `css/08-database.css`)
- **Roomier writing area** — the top of the editor body now has generous real CSS
  padding (not a phantom empty block) so writing starts well clear of the
  properties. (`css/04-editor.css`)

### Changed (batch 8)
- **Calendar keeps a consistent grid** — long event titles are truncated with "…"
  (a stray long title no longer widens its column / the whole grid). (`css/06-calendar-tables.css`)
- **Calendar shows adjacent-month peek events** — events on the leading/trailing
  days of neighbouring months now render (dimmed) instead of blank. (`js/views/calendar.js`, `css/06-calendar-tables.css`)
- **Custom colors accept hex** — each custom colour row has a hex field alongside
  the swatch. (`index.html`, `js/core/config.js`, `css/07-chrome.css`)
- **Page delete moved to the ⋯ menu** — "Delete page" now lives in the page-options
  popover instead of the hover action row. (`index.html`, `js/core/config.js`, `css/19-page-settings.css`)
- **Compact database header** — the view picker (Table/Board/…) now shares one row
  with the table name and the modifier buttons (filter/sort/group/properties).
  (`js/db/block.js`, `css/08-database.css`)

### Fixed (batch 8)
- **Text property didn't get its own row** — the properties area is now block-stacked,
  so text properties sit full-width below the others instead of landing after
  "+ Add property". (`css/04-editor.css`)
- **Top-of-page gap looked like an empty block** — reduced the writing-area top
  padding so it reads as spacing, not a deletable line. (`css/04-editor.css`)

### Changed (batch 7)
- **Long titles wrap** — the page title is now a wrapping, auto-growing field
  (bolder, slightly smaller) instead of a single line that clipped. Enter jumps to
  the body. (`index.html`, `css/04-editor.css`, `css/10-scale.css`, `js/core/save.js`, `js/editor/editor-open.js`)
- **Notion-style properties** — each property shows its name above the value (in a
  pill); text properties get a wider box on their own line below the rest. The
  Edit/Rename/Delete menu now lives on the property **name**, and the **value** is
  edited directly inline. (`js/props/properties.js`, `js/db/doc-props.js`, `css/04-editor.css`)
- **Topbar page controls** — the "Aa" button became a "⋯" page-options menu that now
  also holds **Version history** and (for database entries) the **Show properties**
  show/hide toggles; the **Favorite** star moved up to the left of it. History and
  Favorite were removed from the hover action row. (`index.html`, `js/core/config.js`, `js/views/home.js`, `css/19-page-settings.css`)

### Added (batch 8) — Offline support (service worker + self-hosted assets)
- **Service worker offline shell** — the whole app (HTML/CSS/JS + vendored libs +
  fonts) is precached as one atomic version; the app boots fully offline from the
  second visit on. New deploys download in the background and a sticky toast
  offers **Reload**; users always run a complete old build or a complete new
  build, never a mix of stale and fresh files. Kill switch: `KILL=1 ./build.sh`.
  (`sw.js`, `js/core/sw-register.js`, `build.sh`, `css/16-components.css`)
- **Self-hosted fonts** — all Google Fonts (8 families, latin + latin-ext, woff2,
  0.77 MB) now live in `fonts/` + `css/00-fonts.css`, generated by
  `scripts/vendor-fonts.js`. No request leaves for Google; fonts work offline.
  (`index.html`, `landing.html`)
- **Vendored libraries** — supabase-js pinned at 2.110.2 (`js/vendor/supabase.js`,
  was an unpinned CDN load) and KaTeX 0.16.11 (`vendor/katex/`, was lazy CDN).
  Cloud sync code and math blocks now load offline; supply-chain exposure to
  jsDelivr removed.
- **Tightened CSP** — `script-src`, `style-src`, and `font-src` no longer trust
  any third-party CDN (`'self'` only); SW files served `no-cache`, fonts
  `immutable`. (`vercel.json`)
- **build.sh generates `sw-manifest.js`** — precache list + content-hash version;
  dev tree has no manifest so the SW never installs during development. Dist can
  be previewed with the SW active via `node .claude/serve.js dist 8754`.

---

## Phase 5 — Desktop app, offline for good

Libreta becomes a one-and-done desktop application: free for everyone, with no
server to run, no accounts to protect and nothing to bill. The web app, cloud sync
and hosting are retired.

### Removed
- Supabase authentication and cloud sync (`js/cloud/`, vendored supabase-js, the
  auth gate, sync chip, per-record reconcile engine and its test pages).
- Vercel hosting: `vercel.json`, the analytics snippet, `robots.txt`, `DEPLOY.md`,
  the logged-out redirect to the marketing page.
- The service worker and its build-time precache manifest (a desktop bundle is
  already atomic and offline), plus the `?v=N` asset cache-busters.
- The Settings account card's sign-in call to action; the "Turn on sync" step in
  the home checklist is now "Export a backup".

### Added
- **Tauri v2 desktop shell** (`src-tauri/`): native window, bundled assets, CSP,
  a navigation guard, and a three-permission capability set (save dialog, write the
  chosen file, open links externally). Icons generated from `favicon.svg`.
- **`js/core/platform.js`** — the single browser-vs-desktop bridge.
  `saveFileToDisk()` backs Export, Publish and attachment downloads (native Save
  dialog in the app, `<a download>` in a browser); `openExternal()` backs every
  outbound link; a capture-phase click handler keeps external links from navigating
  the app window.
- `scripts/build-dist.js` (cross-platform replacement for `build.sh`) and a root
  `package.json` whose only dependency is the Tauri CLI.
- GitHub Actions release workflow: a `v*` tag builds macOS (Apple Silicon + Intel),
  Windows and Linux installers and attaches them to a draft GitHub Release.
- `landing.html` repurposed as the download page.

### Fixed
- "Delete all my data" only cleared localStorage on a local-only workspace; it now
  also clears the IndexedDB document/table store and the media blob store.

### 1.0.1 — macOS signing (did not fix the launch problem)
- The macOS bundle is now ad-hoc signed by the release build (`bundle.macOS.signingIdentity: "-"`).
  This is worth keeping — arm64 binaries need at least an ad-hoc signature to execute — but it
  does **not** change what a user sees. Gatekeeper only accepts a Developer ID signature plus
  Apple notarisation; an ad-hoc signature counts as unsigned, so a downloaded copy is still
  reported as "damaged and can't be opened", with no "Open Anyway" path.
- **The actual requirement on macOS** is `xattr -cr /Applications/Libreta.app`, run once before
  first launch. The download page, landing note and release notes now lead with this instead of
  describing it as a rare fallback.

### Unreleased
- **Android release.** Every tag now also builds a signed, sideloadable APK (arm64 + arm32)
  and attaches it to the release; the download page and landing page recognise Android and
  link to it directly, with install steps. Signing uses a keystore kept in the repository
  secrets (README → Releasing → Android). The app itself is unchanged — the same web app in
  a Tauri Android shell, using the existing mobile layout.
- **App icon fixed.** 1.0.0 and 1.0.1 shipped a blank dark square: `tauri icon` rasterised
  `favicon.svg` without the Cormorant font, so the "L." never rendered. The mark is now
  rendered from the vendored font by `scripts/make-branding.js` into
  `src-tauri/branding/icon-1024.png` (with a transparent margin, so it sits at the same size
  as neighbouring icons), and the whole icon set is regenerated from that.
- **Branded installers.** The Windows `.exe` gets a header image, a welcome/finish sidebar
  and the app icon; the `.msi` gets a banner and dialog image; the macOS `.dmg` gets a
  background with a drag-to-Applications arrow and the first-launch Terminal step printed
  right on it. The `.exe` installs per-user (no administrator prompt).
- **In-app update check.** The desktop app asks GitHub once a day whether a newer
  release exists and offers a link to the download page if so; it never downloads or
  installs anything itself. Settings → About shows the running version, a manual
  "Check for updates", and an off switch. Dismissing a version with "Not now" stops
  that version being offered again.
