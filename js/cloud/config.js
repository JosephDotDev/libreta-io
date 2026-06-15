/* ── Supabase connection ──────────────────────────────────────────────────
   These two values are PUBLIC by design. The anon key is meant to ship in
   browser code; it only grants what your Row-Level-Security policies allow
   (here: a signed-in user can read/write only their own folder in Storage).
   The secret `service_role` key must NEVER be put here.
─────────────────────────────────────────────────────────────────────────── */
const SUPABASE_URL = 'https://dahhesmiwrbnyferojdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhaGhlc21pd3JibnlmZXJvamR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjU3ODYsImV4cCI6MjA5NjcwMTc4Nn0.EymFR6fMSbVNNW35nCrQPA7364BPoWXvAmXI7c-QY0U';
const SUPABASE_BUCKET = 'libreta';
