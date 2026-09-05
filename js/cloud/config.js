/* ── Supabase connection ──────────────────────────────────────────────────
   These two values are PUBLIC by design. The anon key is meant to ship in
   browser code; it only grants what your Row-Level-Security policies allow
   (here: a signed-in user can read/write only their own folder in Storage).
   The secret `service_role` key must NEVER be put here.
─────────────────────────────────────────────────────────────────────────── */
const SUPABASE_URL = 'https://dahhesmiwrbnyferojdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhaGhlc21pd3JibnlmZXJvamR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjU3ODYsImV4cCI6MjA5NjcwMTc4Nn0.EymFR6fMSbVNNW35nCrQPA7364BPoWXvAmXI7c-QY0U';
const SUPABASE_BUCKET = 'libreta';

/* ── Sign-in callbacks ────────────────────────────────────────────────────
   A packaged app has no web origin for Google to redirect back to, so it claims
   a URL scheme instead (src-tauri/tauri.conf.json → plugins.deep-link). Both of
   the values below MUST be listed in Supabase → Authentication → URL
   Configuration → Redirect URLs, or the provider refuses to redirect:

     libreta://auth-callback                       (desktop app)
     https://josephdotdev.github.io/libreta-io/**  (web app; add your domain too)

   LIBRETA_WEB_URL is where emailed links (password resets) should land, since an
   email is opened by a browser, never by the app.
─────────────────────────────────────────────────────────────────────────── */
const NATIVE_SCHEME   = 'libreta://';
const NATIVE_REDIRECT = 'libreta://auth-callback';
const LIBRETA_WEB_URL = 'https://josephdotdev.github.io/libreta-io/app/';
