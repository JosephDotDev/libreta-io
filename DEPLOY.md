# Deploying Libreta

Libreta is a **static site** (HTML/CSS/JS) with **cloud sync** layered on top via
Supabase (Auth + Storage). The *app* is hosted on Vercel; your *content* lives in
two places: the browser (localStorage + IndexedDB, for speed/offline) and your
Supabase account (so it follows you across devices).

## What gets deployed
Run **`./build.sh`** — it assembles a clean `dist/` folder with exactly the files
the browser needs (index.html, manifest, favicon, robots, css/, js/) and leaves
out private/backup files (`.claude/`, `Outdated Versions/`, notes). **Deploy the
`dist/` folder.** Re-run `./build.sh` after any change and redeploy.

> Cache note: asset URLs carry `?v=N`. After editing any css/js, bump `N` in
> `index.html` (one find/replace) so browsers fetch the new file.

---

## ★ Your setup: Vercel (app) + Supabase (sync) + libreta.io

### 1. Deploy the app to Vercel
From this folder:
```bash
./build.sh
cd dist
npx vercel login      # browser auth
npx vercel --prod     # answer: setup=y, project name "libreta", dir "./"
```
You get a live `https://libreta-*.vercel.app` URL. Re-run `npx vercel --prod`
from `dist/` to ship updates later.

### 2. Point Supabase Auth at the live domain
Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL** → `https://libreta.io`
- **Redirect URLs** → add `https://libreta.io/**` and `https://*.vercel.app/**`

(Without this, login is rejected on any domain except the ones listed.)

### 3. Attach the domain
```bash
npx vercel domains add libreta.io
```
or Project → **Settings → Domains → Add**. Create the DNS records Vercel shows at
your registrar — typically `A @ → 76.76.21.21` and `CNAME www → cname.vercel-dns.com`.
SSL auto-provisions once DNS resolves.

---

## How sync works (so future-you remembers)
- **Auth:** Supabase email+password. The login gate is `js/cloud/sync.js`; email
  confirmation is OFF in the dashboard (single-user convenience).
- **Data:** on login the app PULLS a snapshot from Storage bucket `libreta` at
  `<userId>/state.json`; on any change it debounce-PUSHES a fresh snapshot back.
- **A snapshot** = every `folio_*` localStorage key + every IndexedDB media blob
  (as data URLs). So docs, databases, home notes, settings, and images all travel.
- **Model:** last-write-wins, synced on load + on save (not live/real-time).
  Fine for one person across devices; don't edit the same workspace on two
  devices simultaneously.
- **Keys:** `js/cloud/config.js` holds the project URL + anon key. The anon key
  is PUBLIC by design (RLS limits it to the signed-in user's own folder). The
  `service_role` key must never be committed.
- **Storage access** is gated by an RLS policy on `storage.objects`: a signed-in
  user may read/write only the folder named after their `auth.uid()`.

## Backups (belt and suspenders)
Even with cloud sync, **Settings → Data & Backup → Export** writes a portable JSON
of everything; Import restores it (accepts both `libreta` and legacy `folio`
backups). Good before any risky change.

## Note on indexing
`index.html` ships with `noindex, nofollow` and `robots.txt` disallows crawlers —
appropriate for a private, login-gated personal workspace. Remove those if you
ever want the marketing/landing side to be search-discoverable.
