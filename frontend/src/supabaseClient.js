import { createClient } from '@supabase/supabase-js';

// Use the same Supabase project as the backend's SUPABASE_URL on Render.
const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

/** Single client for auth and data access (RLS uses the signed-in session). */
export const supabase =
  url && anonKey ? createClient(url, anonKey) : null;
