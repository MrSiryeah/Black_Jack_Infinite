import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

// Helper: Timeout wrapper for promises to prevent infinite hangs
function withTimeout(promise, ms = 8000, errorMessage = "Connection timed out. Please try again.") {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms))
  ]);
}

// Initialize Supabase client dynamically
export function initSupabase(url, key) {
  if (!url || !key) {
    supabaseClient = null;
    return false;
  }
  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    return true;
  } catch (e) {
    console.error("Failed to initialize Supabase client:", e);
    supabaseClient = null;
    return false;
  }
}

// Get raw client reference
export function getSupabase() {
  return supabaseClient;
}

// Helper: check if Supabase is initialized
export function isConnected() {
  return supabaseClient !== null;
}

// --- AUTHENTICATION ---

export async function signUp(email, password, username) {
  if (!supabaseClient) throw new Error("Supabase is not configured.");
  
  return withTimeout(
    (async () => {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username
          }
        }
      });
      if (error) throw error;
      return data;
    })(),
    10000,
    "Supabase sign up timed out. Their servers might be experiencing issues."
  );
}

export async function signIn(email, password) {
  if (!supabaseClient) throw new Error("Supabase is not configured.");
  
  return withTimeout(
    (async () => {
      // Clear any stuck/stale session first
      try {
        await supabaseClient.auth.signOut();
      } catch (e) {
        // Ignore errors during cleanup sign-out
      }
      
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return data;
    })(),
    10000,
    "Supabase sign in timed out. Their servers might be experiencing issues."
  );
}

export async function signOut() {
  if (!supabaseClient) return;
  return withTimeout(
    (async () => {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
    })(),
    5000,
    "Sign out timed out."
  );
}

// --- DATABASE OPERATIONS ---

// Fetch Profile
export async function getProfile(userId) {
  if (!supabaseClient) return null;
  
  try {
    return await withTimeout(
      (async () => {
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
          
        if (error) throw error;
        return data;
      })(),
      6000,
      "Timeout loading profile."
    );
  } catch (error) {
    console.error("Error loading profile from Supabase:", error);
    return null;
  }
}

// Update Profile (balance, xp, level)
export async function updateProfile(userId, updates) {
  if (!supabaseClient) return null;

  return withTimeout(
    (async () => {
      const { data, error } = await supabaseClient
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    })(),
    6000,
    "Timeout saving profile."
  );
}

// Fetch Stats
export async function getStats(userId) {
  if (!supabaseClient) return null;

  try {
    return await withTimeout(
      (async () => {
        const { data, error } = await supabaseClient
          .from('stats')
          .select('*')
          .eq('profile_id', userId)
          .single();
          
        if (error) throw error;
        return data;
      })(),
      6000,
      "Timeout loading statistics."
    );
  } catch (error) {
    console.error("Error loading stats from Supabase:", error);
    return null;
  }
}

// Update Stats
export async function updateStats(userId, updates) {
  if (!supabaseClient) return null;

  return withTimeout(
    (async () => {
      const { data, error } = await supabaseClient
        .from('stats')
        .update(updates)
        .eq('profile_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    })(),
    6000,
    "Timeout saving statistics."
  );
}

// Fetch Top 10 for Leaderboard
export async function getLeaderboard(limit = 10) {
  if (!supabaseClient) return [];

  try {
    return await withTimeout(
      (async () => {
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('username, balance, level, xp')
          .order('balance', { ascending: false })
          .limit(limit);

        if (error) throw error;
        return data;
      })(),
      7000,
      "Timeout loading leaderboard."
    );
  } catch (error) {
    console.error("Error loading leaderboard from Supabase:", error);
    return [];
  }
}

// Create fallback profile and stats dynamically if trigger fails or is delayed
export async function createFallbackProfile(userId, email, username) {
  if (!supabaseClient) return null;
  
  try {
    return await withTimeout(
      (async () => {
        // 1. Check if profile already exists
        const { data: existing } = await supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
          
        if (existing) return existing;

        // 2. Create profile
        const { data: profile, error: pError } = await supabaseClient
          .from('profiles')
          .insert([{
            id: userId,
            username: username || email.split('@')[0] || 'Player',
            balance: 1000,
            xp: 0,
            level: 1
          }])
          .select()
          .single();

        if (pError) {
          console.warn("Profile insert collision/error, retrying fetch...", pError);
          await new Promise(r => setTimeout(r, 600));
          const { data: retryProfile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          if (retryProfile) return retryProfile;
          throw pError;
        }

        // 3. Create stats
        const { error: sError } = await supabaseClient
          .from('stats')
          .insert([{
            profile_id: userId,
            hands_played: 0,
            hands_won: 0,
            hands_lost: 0,
            hands_tied: 0,
            blackjacks: 0,
            highest_balance: 1000
          }]);

        if (sError) {
          console.warn("Stats insert error (might already exist):", sError);
        }

        return profile;
      })(),
      8000,
      "Timeout setting up user profile."
    );
  } catch (e) {
    console.error("Error in fallback profile setup:", e);
    // Final check
    try {
      const { data: finalCheck } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      return finalCheck;
    } catch (err) {
      return null;
    }
  }
}
