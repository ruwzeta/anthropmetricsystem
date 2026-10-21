/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Without it (and the key) tester sign-in stays on the device. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable (anon) key. Safe in the browser; row-level security protects the data. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
