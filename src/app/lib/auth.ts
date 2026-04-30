import { createClient } from '@supabase/supabase-js';
import { publicAnonKey, supabaseUrl } from '/utils/supabase/info';

// Lazy initialization of Supabase client
let supabaseInstance: any = null;
let sessionCache: any = null;
let sessionCacheTime = 0;
const SESSION_CACHE_DURATION = 5000; // 5 seconds
const SESSION_REFRESH_THRESHOLD_MS = 60 * 1000;

const isSessionFresh = (session: any) => {
  if (!session?.expires_at) {
    return true;
  }
  return session.expires_at * 1000 > Date.now() + SESSION_REFRESH_THRESHOLD_MS;
};

const getSupabase = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, publicAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    });
  }
  return supabaseInstance;
};

export const auth = {
  async signUp(email: string, password: string, name: string) {
    const response = await fetch(`${supabaseUrl}/functions/v1/make-server-1a98deae/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({ email, password, name })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to sign up');
    }

    return data;
  },

  async signIn(email: string, password: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    // Clear session cache to force refresh
    sessionCache = null;
    sessionCacheTime = 0;

    return data;
  },

  async signOut() {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    // Clear session cache
    sessionCache = null;
    sessionCacheTime = 0;
  },

  async getSession() {
    try {
      // Return cached session if it's still fresh
      const now = Date.now();
      if (sessionCache !== null && (now - sessionCacheTime) < SESSION_CACHE_DURATION && isSessionFresh(sessionCache)) {
        return sessionCache;
      }

      const supabase = getSupabase();
      // Use a promise race to timeout after 2 seconds
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve({ data: { session: null }, error: null }), 2000)
      );

      const result: any = await Promise.race([sessionPromise, timeoutPromise]);
      const { data: { session }, error } = result;

      if (error) {
        console.warn('Session error:', error);
        if ((error as any)?.message?.toLowerCase().includes('invalid jwt')) {
          await supabase.auth.signOut();
        }
        sessionCache = null;
        sessionCacheTime = now;
        return null;
      }

      let resolvedSession = session;

      if (resolvedSession && !isSessionFresh(resolvedSession)) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn('Session refresh error:', refreshError);
          if ((refreshError as any)?.message?.toLowerCase().includes('invalid jwt')) {
            await supabase.auth.signOut();
          }
          sessionCache = null;
          sessionCacheTime = now;
          return null;
        }
        resolvedSession = refreshData?.session || null;
      }

      if (resolvedSession) {
        const { error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.warn('User validation error:', userError);
          if ((userError as any)?.message?.toLowerCase().includes('invalid jwt')) {
            await supabase.auth.signOut();
          }
          sessionCache = null;
          sessionCacheTime = now;
          return null;
        }
      }

      // Cache the session
      sessionCache = resolvedSession;
      sessionCacheTime = now;
      return resolvedSession;
    } catch (error) {
      console.warn('Failed to get session, using anonymous mode:', error);
      sessionCache = null;
      sessionCacheTime = Date.now();
      return null;
    }
  },

  async refreshSession() {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      if ((error as any)?.message?.toLowerCase().includes('invalid jwt')) {
        await supabase.auth.signOut();
        sessionCache = null;
        sessionCacheTime = Date.now();
        return null;
      }
      throw error;
    }
    sessionCache = data.session ?? null;
    sessionCacheTime = Date.now();
    return data.session ?? null;
  },

  async getUser() {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        throw error;
      }
      return data.user;
    } catch (error) {
      throw error;
    }
  }
};

export const supabase = getSupabase();
