// Public runtime config.
//
// Keep credentials out of git:
// - Set these values via `.env` locally and via provider env vars (Netlify, etc.) in production.
// - This file intentionally contains no hardcoded keys.
//
// Vite exposes env vars via `import.meta.env` (only `VITE_*` are exposed to the browser).

type ViteEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PROJECT_ID?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

const env = (import.meta as unknown as { env: ViteEnv }).env;

function deriveProjectIdFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname; // <project>.supabase.co
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export const supabaseUrl =
  env.VITE_SUPABASE_URL ||
  (env.VITE_SUPABASE_PROJECT_ID
    ? `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`
    : "");

export const projectId =
  env.VITE_SUPABASE_PROJECT_ID ||
  deriveProjectIdFromUrl(env.VITE_SUPABASE_URL) ||
  "";

export const publicAnonKey = env.VITE_SUPABASE_ANON_KEY || "";
