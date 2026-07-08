# Spec: Cross-Device Media Sync (per-blob, content-addressed)

**Status:** Built, flag-gated OFF by default (`libreta_media_sync`). Needs two-real-device
verification before flipping the default — see rollout section.
**Decision:** v1 uses **eager-on-reconcile** fetch. Lazy/on-demand fetch is a documented v2.
**Context:** As of the storage restructure, sync runs in per-record `records` mode
(`js/cloud/sync.js`, `DEFAULT_SYNC_MODE`). Structured data (docs/tables/kv) syncs per
record; **media blobs currently do not sync at all** — they live only in each device's
local IndexedDB. This spec closes that gap without reintroducing the egress problem the
restructure fixed.

**Implementation note:** section 4/5 below describe the as-shipped design, which differs
from the original draft in one way: there is no `manifest.blobsUpdatedAt` field. Building
it revealed a simpler gate — see "As shipped" callout in section 4.

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
<uid>/rec/blobs.json       # { v, refs:{ "<ref>": uploadedAtISO } }  — union set
```
- `blob/<ref>` objects sit under the user's folder → covered by the existing per-folder
  RLS policy. **Action item: verify the Storage policy is prefix-based on `<uid>/`**, not
  an exact match on `state.json` / `rec/` (unverified — no dashboard/CLI access from this
  environment; the existing `rec/doc/`, `rec/tbl/`, `rec/kv.json` paths already work under
  the current policy, which is at least suggestive that it's prefix-based, but confirm
  before relying on it for `blob/`).
- `blobs.json` is the authoritative "what exists in the cloud" oracle, so devices never
  404-probe and never re-upload.

## 4. Gating the network (egress-critical decision) — AS SHIPPED
The original draft put a `blobsUpdatedAt` timestamp on `manifest.json` as the trigger for
fetching `blobs.json`. Building it, a simpler gate fell out that needs no manifest change
at all: **compute the missing/unconfirmed diff from purely local state first**, and only
touch the network if that diff is non-empty.
- `needsMediaSync(refs, idbKeys, known)` (pure, `js/cloud/sync.js`) returns true iff some
  referenced blob is either absent from local IndexedDB, or present but not yet in the
  device's local `known`-synced set (`libreta_blob_known`, a plain array in localStorage,
  non-`folio_` so it never rides the snapshot).
- `blobs.json` is fetched **only when** `needsMediaSync` is true.
- Steady state (nothing referenced changed): `needsMediaSync` is a synchronous, in-memory
  check — zero network, and it doesn't even need `manifest.json` to grow a field.
- Why this covers the case `blobsUpdatedAt` was meant for (a doc referencing a new blob
  arriving from another device): the referencing doc's own `updatedAt` always changes
  when a doc is saved (`DB.saveDoc`/`saveTbl` always bump it), so the doc/table reconcile
  phase already downloads it — `collectRefs()` (run right after) picks up the new ref
  immediately, and `needsMediaSync` sees it's missing from IDB without needing a separate
  cloud-side "did the blob set change" signal.

## 5. Reconcile integration (`reconcileRecords`, `js/cloud/sync.js`) — AS SHIPPED
`reconcileMedia()` runs right after the existing doc/table downloads are applied and
`DB.load()` refreshes the cache (so `collectRefs()` sees any ref that just arrived via a
downloaded doc), and *before* this device uploads its own changed docs/tables (so a doc
about to be pushed doesn't outrun its own blob upload). Two pure functions do the decision
work — unit-tested in `tests/media-reconcile-tests.js` (run via `tests/media-reconcile.html`
or `runMediaReconcileTests(Cloud.needsMediaSync, Cloud.planMedia)` in console), mirroring
`planReconcile`'s truth-table pattern:

1. `refs = collectRefs()`; bail immediately if empty or the flag is off.
2. `if(!needsMediaSync(refs, idbKeys, known)) return;` — steady state, zero network.
3. Fetch `blobs.json` once (only reached when there's real work).
4. `plan = planMedia(refs, idbKeys, known, remote.refs)` classifies every ref into:
   - `download` — missing locally, cloud has it → signed-URL fetch `blob/<ref>` (no
     cache-buster — immutable), `IDB.put`, mark known.
   - `upload` — held locally, cloud lacks it → `_uploadBlobObject` then add to
     `blobs.json`'s `refs`, mark known.
   - `skip` — held locally, cloud already has it (another device uploaded the same
     content-addressed ref) → just mark known, no redundant re-upload.
   - *(neither):* missing locally AND cloud doesn't have it either (race — the
     originating device hasn't uploaded yet) → left alone, naturally retried next
     reconcile since it's still "missing" then.
5. If anything downloaded, `preloadBlobs()` rebuilds object URLs so the image renders.
6. `blobs.json` is only re-uploaded if something was actually added to it (`cloudChanged`).

Cost after convergence: `collectRefs()` + the local diff are cheap and synchronous; no
network call happens unless something genuinely changed.

## 6. Concurrency: mostly self-healing, one known gap
`blobs.json` is a union set written read-modify-write. For a device whose upload gets
clobbered by a concurrent write from another device, self-healing is **partial**: on its
*own* next reconcile, `needsMediaSync` no longer flags that ref, because the device already
added it to its local `known` set the moment its own upload call succeeded — it doesn't
re-verify that the write survived in `blobs.json`. So the uploading device is unaffected
(the blob is already in its own IndexedDB), but a *different* device that was relying on
`blobs.json` to discover that ref would not find it, and would never retry, since nothing
locally marks it "still missing" (unlike the doc/table reconcile, where `localManifest()`
is recomputed fresh from ground truth — a doc's own `updatedAt` — every pass; the `known`
set here is a cache, not a re-derivation). This requires two devices writing `blobs.json`
in the same short window and is judged low-probability for a personal/dual-device tool;
flagging rather than fixing for v1. If it matters in practice, the fix is to stop trusting
`known` as permanent and periodically re-verify a sample against `blobs.json`, or drop the
local cache and always diff against a freshly-fetched remote set (trading away some of the
"zero network in steady state" property for stronger convergence guarantees).

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

## Build checklist
- [ ] Verify Storage RLS policy is prefix-based on `<uid>/` (covers `blob/` + `rec/`) —
      **not done from this environment** (no dashboard/CLI access); check manually.
- [x] Add `libreta_media_sync` flag + accessor (`_mediaSyncOn`/`setMediaSync`, mirrors
      `_syncMode()`) — exposed as `Cloud.setMediaSync`/`Cloud.mediaSyncOn`.
- [x] ~~`manifest.json`: read/write `blobsUpdatedAt`~~ — superseded, see section 4.
- [x] `blobs.json` read/union-write helpers (reused `_dlJson` / `_uploadJson`).
- [x] Media phase in `reconcileRecords`, positioned after doc/table download + `DB.load()`,
      before doc/table upload.
- [x] Device-local confirmed-set cache: `libreta_blob_known` (not `libreta_blob_uploaded` —
      renamed since it also covers refs *downloaded* from the cloud, not just uploaded).
- [x] Signed-URL blob fetch helper (`_dlBlob`, no cache-buster — immutable) + upload helper
      (`_uploadBlobObject`, 1-year `cacheControl` since content never changes).
- [x] Pure decision core extracted (`needsMediaSync`, `planMedia`) and unit-tested —
      `tests/media-reconcile-tests.js` / `tests/media-reconcile.html`, 8/8 passing against
      the real `Cloud.needsMediaSync`/`Cloud.planMedia` (not a re-implementation).
- [x] Regression-checked: existing `planReconcile` suite still 18/18; app boots clean
      (local-only mode, no console errors); `storeBlob`→`IDB` pipeline unaffected.
- [ ] Two-device verification before flipping the default (`DEFAULT` stays off — flip via
      `Cloud.setMediaSync(true)` on two real devices/browsers first).
- [x] Bumped cache-bust `?v=` in `index.html` (68 → 69) for the changed `sync.js`.
