import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

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
  
  // Register the user with metadata (so trigger can use raw_user_meta_data->>'username')
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
}

export async function signIn(email, password) {
  if (!supabaseClient) throw new Error("Supabase is not configured.");
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

// --- DATABASE OPERATIONS ---

// Fetch Profile
export async function getProfile(userId) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (error) {
    console.error("Error loading profile from Supabase:", error);
    return null;
  }
  return data;
}

// Update Profile (balance, xp, level)
export async function updateProfile(userId, updates) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating profile in Supabase:", error);
    throw error;
  }
  return data;
}

// Fetch Stats
export async function getStats(userId) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from('stats')
    .select('*')
    .eq('profile_id', userId)
    .single();
    
  if (error) {
    console.error("Error loading stats from Supabase:", error);
    return null;
  }
  return data;
}

// Update Stats
export async function updateStats(userId, updates) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from('stats')
    .update(updates)
    .eq('profile_id', userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating stats in Supabase:", error);
    throw error;
  }
  return data;
}

// Fetch Top 10 for Leaderboard
export async function getLeaderboard(limit = 10) {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('username, balance, level, xp')
    .order('balance', { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error loading leaderboard from Supabase:", error);
    return [];
  }
  return data;
}
