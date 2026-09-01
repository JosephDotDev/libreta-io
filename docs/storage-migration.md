# Storage migration: from one blob to per-record, lazy, syncable

> **Historical note (Phase 5).** Cloud sync was removed when Libreta became a desktop
> app, so everything below about Supabase, `js/cloud/sync.js`, reconcile modes and
> media sync describes code that no longer exists. Phase 1 (per-record IndexedDB
> storage) and Phase 3 (cold-document compression) are still how the app stores data,
> and the persistence-adapter seam they introduced is where a folder-based workspace
> will plug in next.

Status: **Phase 1 + Phase 3 shipped; Phase 2 + Phase 4 deferred** (see §6 for the why)
Author: design notes for the per-page storage restructure
Related: media efficiency (WebP + content-dedup, shipped in `js/core/storage.js`)

## Progress

- **Phase 1 — SHIPPED.** Docs + tables live in `folio_data` IndexedDB, one record each
  (`IdbDataAdapter`). `saveDoc` writes one record; the ~5 MB localStorage cap is gone.
  One-time legacy migration (`_maybeMigrate`) + `migrateBack()` rollback. Reads stay
  synchronous via the in-memory cache. Sync rewired: a `libreta:content` DOM signal
  replaces the localStorage-write trigger for docs/tables; `snapshot()`/`applySnapshot()`
  source docs/tables from the adapter; boot now runs `DB.load()` before `Cloud.boot()`.
- **Phase 3 — SHIPPED.** `compactColdDocs(days)` gzip-compresses docs untouched > 30 days
  (`{id,updatedAt,_z}`); `loadDocs` inflates transparently; editing re-saves hot (plain).
  Runs idle at boot. ~5–10× on real prose.
- **Phase 4 — BUILT, flag-gated (default OFF).** Two-way per-record reconcile in
  `js/cloud/sync.js`: per-record objects (`<uid>/rec/doc/<id>.json`, `tbl/<id>.json`,
  `kv.json`) + a `manifest.json` ({recs, deleted}). Mode is `localStorage.libreta_sync_mode`:
  `mono` (default, unchanged whole-snapshot), `dual` (mono authoritative + shadow-writes
  per-record), `records` (per-record reconcile authoritative). Per-record LWW by
  `updatedAt` (ISO strings sort chronologically); deletions propagate via tombstones; the
  `CONTENT_RE` allowlist + `activelyEditing()` stale-push guard are preserved. The pure
  decision function `planReconcile(local, remote, base)` is unit-tested
  (`Cloud.planReconcile`); the cloud I/O paths are implemented but NOT yet validated on
  real devices. **Rollout: mono → dual (verify the layout accumulates) → records (verify
  two devices editing different pages both survive, deletes propagate). See §6.**
- **Phase 2 — DEFERRED** (see §6).

---

## 1. Why

Today the whole workspace is three monoliths:

- `localStorage["folio_docs"]` — a JSON **array of every document**.
- `localStorage["folio_tables"]` — a JSON array of every database table.
- One `state.json` in Supabase Storage — **every `folio_*` key + every media blob (base64)** in a single file.

This is simple and fast for small workspaces but degrades as O(workspace size):

1. **Write amplification.** `DB.saveDoc` re-`JSON.stringify`s the entire `_docs` array and rewrites it to localStorage on every change (`js/core/storage.js`). Editing one word in one page serializes *all* pages.
2. **Hard ceiling.** Page text lives in localStorage (~5 MB/origin cap). A large workspace's text literally cannot fit and starts throwing the "Storage is full" toast. (Media already lives in IndexedDB and is fine.)
3. **Whole-snapshot sync.** Every debounced edit uploads *all docs + all media as base64* as one object, last-write-wins (`js/cloud/sync.js`). A 200 MB workspace re-uploads ~200 MB per edit, and two devices editing different pages clobber each other.

The hierarchy model is already correct and does **not** need to change: `doc.meta.parent` is a parent pointer and `localStorage["folio_sidebar"]` holds per-parent ordering / collapse / hidden state (`js/ui/sidebar-tree.js`). We keep the **normalized** tree (parent pointer + order index). We do **not** nest child JSON inside parents — that would make every move/reorder rewrite a subtree and fight the sync.

Non-goals: changing the block/document data model, changing the sidebar tree semantics, or making the public read API async (see §6).

---

## 2. Target architecture

Four phases, each independently shippable and individually valuable.

### Phase 1 — per-record local storage in IndexedDB

Move documents and tables out of the two big localStorage keys into IndexedDB object stores, one record per doc/table (media already lives in the `folio_media` DB).

- New DB `folio_data`, version 1, object stores: `docs` (keyed by `doc.id`), `tables` (keyed by `tbl.id`), `kv` (for `folio_cfg`, `folio_sidebar`, `folio_trash`, etc. — the small singleton keys).
- `DB.saveDoc(doc)` writes **one** record (`put(doc, doc.id)`), not the whole array. Kills write amplification and the 5 MB ceiling.
- Reads stay **synchronous** (see §6): the in-memory `_docs` / `_tbls` caches remain the source of truth for the running app; only *load granularity* and *flush granularity* change.

Adapter changes (`LocalStorageAdapter` → `IdbDataAdapter`, behind the existing `setPersistenceAdapter` seam):

```
interface PersistenceAdapter {
  // bulk (kept for boot + import/export)
  loadDocs(): Promise<Doc[]>            // Phase 1: still loads all; Phase 2: loads index only
  loadTbls(): Promise<Tbl[]>
  // NEW per-record
  putDoc(doc): Promise<void>
  delDoc(id): Promise<void>
  putTbl(tbl): Promise<void>
  delTbl(id): Promise<void>
  // small singletons
  getKV(key): Promise<string|null>
  setKV(key, val): Promise<void>
}
```

`DB._flushDocs()` is replaced by `Persist.putDoc(changedDoc)` inside `saveDoc`, and `Persist.delDoc(id)` inside `delDoc`. `replaceAll` (import) writes records in a transaction.

**Migration (one-time, idempotent):** on boot, if `localStorage["folio_docs"]` exists and `folio_data` is empty, read the array, `putDoc` each into IDB, then mark migrated (`folio_data_migrated=1`) and remove the legacy key. Mirror for tables. Keep a `migrateBack()` escape hatch that re-serializes IDB → the legacy localStorage keys, for rollback.

### Phase 2 — slim index + lazy bodies

Hold a lightweight **index** in memory for everything the chrome needs without page bodies:

```
IndexEntry = { id, parent, title, icon, updatedAt, order?, dbId? }
```

- Built from a cheap IDB cursor over `docs` projecting just those fields (or maintained as a separate `index` store updated on each `putDoc`).
- Sidebar tree, Home, Documents list, search-by-title, and breadcrumbs read the index — they never need block content.
- Full bodies hydrate **on open** (`openEditor`) into the `_docs` cache and stay cached (LRU-capped, e.g. last 50 bodies) so navigation is instant and reads stay synchronous after first touch.
- Full-text search (block contents) becomes an explicit async pass that streams bodies from IDB rather than assuming they're all in memory.

This is the real "cold pages cost nothing until touched" win — bigger than compression.

### Phase 3 — compress cold bodies

Once bodies are per-record, compress the cold ones.

- On `putDoc`, if a doc hasn't been opened/edited in > N days (track `meta.lastOpened`), store its body gzip-compressed via `CompressionStream('gzip')`; inflate transparently in `loadDoc(id)` via `DecompressionStream`.
- Store a tiny `{z:1}` marker on the record (or a separate `docs_z` store) so the loader knows to inflate.
- JSON text compresses ~5–10×. Caveat: text is usually small next to media, so this compounds with the media work rather than replacing it — the dominant byte lever remains images/GIF/video.

### Phase 4 — per-page sync

Replace the monolithic `state.json` with per-record cloud objects + a manifest.

- Layout: `<userId>/docs/<id>.json`, `<userId>/tables/<id>.json`, `<userId>/manifest.json` (`{ docs:{id:updatedAt}, tables:{...}, deleted:[...] }`), plus the existing media path.
- Push: upload only the records whose `updatedAt` advanced since the last synced manifest; a save uploads KB, not MB.
- Pull: diff local manifest vs remote manifest; fetch only changed records; apply deletions from `deleted[]`.
- **Must preserve** today's guarantees (do not weaken):
  - the **content allowlist** (`CONTENT_RE`) — only real content writes schedule a push;
  - the **stale-push guard** keyed on real `input`/`beforeinput` activity (`activelyEditing()`), so an idle device never clobbers newer remote work;
  - cache-busting reads of the manifest (the `meta.json` trick today) so a CDN-cached manifest can't make two devices look divergent.
- Conflict policy stays last-write-wins **per record** (not per workspace), which is the whole point — different pages no longer collide. Same-page concurrent edits remain LWW (acceptable for a single-user-multi-device product; CRDT is out of scope).

---

## 3. Risk + the synchronous-read constraint (§6 detail)

`DB.getDoc(id)` is called synchronously in hundreds of places and the codebase is explicitly designed around it (`js/core/storage.js` header comment). Phases 1–2 are achievable **without** making reads async:

- Boot: `await DB.load()` hydrates the index (Phase 2) or all docs (Phase 1) before the first render — unchanged contract.
- A page body that isn't cached yet is hydrated during `nav('editor', id)` / `openEditor`, which is already an async-friendly entry point (it does timeouts, focus, etc.). After hydration the body sits in `_docs` and every synchronous `getDoc` works as before.
- Only **full-text search across unopened pages** genuinely needs an async path; it becomes an explicit "search is working…" pass.

Phase 4 (sync) is the heavy lift and the one that needs the most test coverage (multi-device, offline edits, deletions, partial-failure uploads).

---

## 4. Suggested order & checkpoints

1. **Phase 1** — biggest bang-for-buck, self-contained, reversible (migrateBack). Ship + soak.
2. **Phase 2** — unlocks massive workspaces; verify sidebar/search/home read only the index.
3. **Phase 3** — opportunistic storage shrink; low risk once 1–2 land.
4. **Phase 4** — schedule deliberately; gate behind a flag and dual-write (old `state.json` + new per-record) for one release so rollback is trivial.

Each phase keeps the app fully working on its own; none requires the next.

---

## 5. Test checklist (per phase)

- Phase 1: create/edit/delete docs & tables; quota no longer hit by text; import/export round-trips; migration runs once and is idempotent; `migrateBack()` restores legacy keys.
- Phase 2: 5,000-page synthetic workspace boots fast; sidebar/home/search render with bodies evicted; opening a cold page hydrates correctly; LRU cap holds memory flat.
- Phase 3: cold doc stored compressed, opens identical to pre-compression; size drop measured; toggling hot/cold is transparent.
- Phase 4: two devices edit different pages → both survive; idle device never clobbers; deleted page propagates; offline edits reconcile on reconnect; allowlist + stale-push guard still hold.

---

## 6. Why Phase 2 and Phase 4 are deferred (decision)

After Phase 1 shipped, scoping 2 and 4 surfaced a risk/value imbalance specific to this app:

### Phase 2 (lazy bodies) — deferred, low value + high risk here

- **Media is already external.** Images/files live as IndexedDB *blobs*; document bodies
  hold only short refs + text. So holding all bodies in memory is cheap, and Phase 1
  already removed the boot **re-serialisation** cost (per-record writes) and the storage
  cap. The remaining lazy-boot/memory win is small for realistic workspaces.
- **It forces an async refactor of synchronous hot paths.** The dedup-safe `freeBlob`
  calls `collectRefs()` **synchronously**; `collectRefs` scans every doc's blocks. With
  lazy bodies that can't be answered synchronously, so `freeBlob`/GC/search/backlinks all
  become async — a wide blast radius.
- **Data-loss landmine.** If `getDocs()` returns a not-yet-hydrated "shallow" doc and any
  path saves it (e.g. `migrateInlineImages` iterates `getDocs()` and `saveDoc`s changed
  ones), it would overwrite the real body with empty blocks.

**If we do it later:** add a *persisted blob-ref index* (`docId → Set<blobId>`, maintained
on save) so `freeBlob`/GC never need live bodies; mark shallow docs and make `saveDoc`
refuse/merge them; convert search + backlinks to an explicit async hydrate-all. Treat as
its own change with its own test pass.

### Phase 4 (per-record sync) — deferred, cannot be validated locally

- The dev preview runs **local-only** (Supabase doesn't load in the sandbox), so the
  multi-device behaviours that matter — stale-push guard, deletion propagation, offline
  reconciliation — can't be exercised here. Shipping a rewritten sync layer to real
  synced data **untested** is the exact cross-device-clobber risk the current guards exist
  to prevent.

**If we do it later:** implement behind a flag with **dual-write** (keep writing the
monolithic `state.json` while also writing per-record objects + manifest) for one release,
verify on two real devices (different-page edits both survive; idle device never clobbers;
deletes propagate; offline edits reconcile), then flip the read path and retire the
monolith. Preserve `CONTENT_RE` and the `activelyEditing()` stale-push guard throughout.

Phase 1's per-record local storage is the prerequisite both build on, so this ordering
loses nothing.
