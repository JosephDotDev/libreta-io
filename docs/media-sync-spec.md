# Spec: Cross-Device Media Sync (per-blob, content-addressed)

**Status:** Approved design — not yet built.
**Decision:** v1 uses **eager-on-reconcile** fetch. Lazy/on-demand fetch is a documented v2.
**Context:** As of the storage restructure, sync runs in per-record `records` mode
(`js/cloud/sync.js`, `DEFAULT_SYNC_MODE`). Structured data (docs/tables/kv) syncs per
record; **media blobs currently do not sync at all** — they live only in each device's
local IndexedDB. This spec closes that gap without reintroducing the egress problem the
restructure fixed.

---

## 1. Goal & non-goals
- **Goal:** an `img_` blob referenced on one device becomes available on every other
  device, with each unique blob crossing the wire **at most once per device, ever**.
- **Non-goals (v1):** cloud-side garbage collection of orphaned blobs; lazy/on-demand
  fetch (v2); mutating a blob in place (content-addressing makes blobs immutable).

## 2. Why content-addressing makes this cheap
Blobs are already content-addressed: `img_<sha256[:40]>` (`blobId()`, `js/core/storage.js`).
- **Immutable:** bytes behind a ref never change → no cache-busting needed (unlike
  `state.json`), and once a device has it in IndexedDB it never re-downloads. This is the
  opposite of the June 23rd full-snapshot-re-download failure mode.
- **Globally stable ref:** no ID remapping across devices; a doc record referencing
  `img_abc…` means the same blob everywhere.
- **Dedup already exists:** `storeBlob()` collapses identical bytes to one ref.

## 3. Cloud layout (additive to the existing `rec/` model)
```
<uid>/blob/<ref>           # one immutable object per blob (ref = img_<40hex>)
<uid>/rec/blobs.json       # { v, updatedAt, refs:{ "<ref>": uploadedAtISO } }  — union set
<uid>/rec/manifest.json    # gains ONE field: blobsUpdatedAt (ISO)
```
- `blob/<ref>` objects sit under the user's folder → covered by the existing per-folder
  RLS policy. **Action item: verify the Storage policy is prefix-based on `<uid>/`**, not
  an exact match on `state.json` / `rec/`.
- `blobs.json` is the authoritative "what exists in the cloud" oracle, so devices never
  404-probe and never re-upload.

## 4. The manifest stays small (egress-critical decision)
Do **not** inline the blob set into `manifest.json` — that file is re-downloaded on every
reconcile (every editing pause), and one entry per image would re-create a smaller version
of the original egress problem at scale. Instead:
- `manifest.json` carries a single `blobsUpdatedAt` timestamp.
- `blobs.json` is fetched **only when** `blobsUpdatedAt` differs from the device's cached
  value.
- Steady state: manifest stays tiny; `blobs.json` is silent.

## 5. Reconcile integration (`reconcileRecords`, `js/cloud/sync.js`)
Add a **media phase** after the existing doc/table apply + `DB.load()`, before the final
`rerenderView()`:

**A. Download (only when `blobsUpdatedAt` changed):**
1. Fetch `blobs.json`.
2. `need = collectRefs()` (`js/media/blob-gc.js`) ∩ `blobs.refs` — blobs this workspace
   references *and* that exist in the cloud.
3. `missing = need − IDB.keys()`.
4. For each missing ref: signed-URL fetch `blob/<ref>` → `IDB.put(ref, blob)`.
   **No cache-buster** (immutable). Best-effort; a failure just retries next reconcile.
5. If any landed: `preloadBlobs()` + the existing `rerenderView()` path picks them up.

**B. Upload:**
1. `toUpload = collectRefs() − blobs.refs`.
2. **Upload blob objects first, then `blobs.json` (union-merged), then bump
   `manifest.blobsUpdatedAt`** — ordering matters so a referencing doc record never lands
   in the cloud pointing at a blob that isn't there yet. Tolerate-and-retry on the download
   side covers the residual window.
3. Track a **device-local** confirmed set (`libreta_blob_uploaded`, non-`folio_` so it
   never rides the snapshot) to skip re-work within a session.

Cost after convergence: `collectRefs()` is in-memory and cheap; the network arms are empty
unless something genuinely changed.

## 6. Concurrency: self-healing, not locked
`blobs.json` is a union set written read-modify-write. If two devices add different blobs
simultaneously and one overwrite loses the other's entry, it **self-heals**: the dropped
device still references the blob via its docs, so the next reconcile recomputes `toUpload`
and re-adds it. Never-remove + union + derive-from-docs means convergence without locking.

## 7. Deletion / GC (deliberately conservative in v1)
- Local `gcBlobs()` (`js/media/blob-gc.js`) stays as-is — it only reclaims local IDB.
- **Do not delete cloud blobs in v1.** A blob a device GC'd locally may still be referenced
  by another device, a version snapshot, or a trashed page elsewhere — and `collectRefs()`
  only sees *this* device's view. Orphaned cloud blobs are cheap storage; deleting one
  another device needs costs a broken image + re-upload. Storage is the cheap axis; egress
  is the one we're protecting.
- v2 option: a periodic, conservative cloud GC that unions refs across the manifest's live
  doc set — documented, not built.

## 8. Edge cases to honor
- **All ref sites travel:** `collectRefs()` already covers block `src`/`fileId`/`icon`/
  `images[]`, `meta.cover`/`icon`/`bg`, prop values, table cells, **version snapshots**,
  **trash**, and **custom fonts**. Routing through it means restoring an old version on
  another device keeps its images — a real cross-device fix, not just parity.
- **First reconcile after rollout:** each device uploads its locally-referenced blobs once
  (bounded ingress burst, not egress). New devices download referenced blobs once.
- **25 MB upload cap** (`MAX_UPLOAD_BYTES`, `js/core/storage.js`) already bounds per-object
  size; nothing new needed.
- **Offline:** `storeBlob` still works locally; a missing cloud blob → broken-image
  fallback that resolves on the next reconcile tick (poll/realtime already re-fire
  `reconcileRecords`).
- **CSP:** `connect-src` already allows `https://*.supabase.co` (`vercel.json`) —
  signed-URL blob fetches are covered.

## 9. Rollout (mirror the mono→dual→records caution)
Gate behind a device-local flag `libreta_media_sync` (`off` default → `on`), so it can be
verified on two real devices before flipping the default — exactly how `DEFAULT_SYNC_MODE`
was rolled out. Keep the bucket **private + signed URLs**; do not make it public-read.
Since each blob is fetched once per device, signed URLs (which defeat CDN caching) cost
nothing extra here.

## 10. Egress accounting (the whole point)
- **Per device, lifetime:** Σ(unique referenced blob bytes) downloaded once — the floor.
- **Steady state:** zero blob egress — only the tiny `manifest.json` poll, unchanged.
- **`blobs.json`:** fetched only on a real blob-set change.

## 11. v2 — lazy fetch (deferred, the bigger egress win)
v1 downloads all referenced blobs on reconcile (eager) for simplicity and offline
availability. A v2 **fetch-on-render** path (download a blob only when a page using it is
opened on that device) would mean a device never pays egress for images on pages it never
views — a meaningful saving for a media-heavy page rarely opened on a second device. It
requires making `srcFor()` (`js/core/storage.js`) async-capable with a placeholder-then-swap,
a wider change — hence deferred. Recorded so the eager v1 is a conscious choice, not the
ceiling.

---

## Build checklist (when greenlit)
- [ ] Verify Storage RLS policy is prefix-based on `<uid>/` (covers `blob/` + `rec/`).
- [ ] Add `libreta_media_sync` flag + accessor (mirror `_syncMode()`).
- [ ] `manifest.json`: read/write `blobsUpdatedAt`.
- [ ] `blobs.json` read/union-write helpers (reuse `_dlJson` / `_uploadJson`).
- [ ] Media phase in `reconcileRecords` (download missing, then upload new — ordering!).
- [ ] Device-local `libreta_blob_uploaded` confirmed-set cache.
- [ ] Signed-URL blob fetch helper (no cache-buster — immutable).
- [ ] Two-device verification before flipping default; bump `?v=` for changed files.
