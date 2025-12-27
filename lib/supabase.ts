
import { createClient } from '@supabase/supabase-js';

// Optimized detection for Vite
const getEnv = (key: string): string => {
  // 1. Try Vite's import.meta.env (Primary for Vite projects)
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[key]) {
      return metaEnv[key];
    }
  } catch (e) {}

  // 2. Try global process.env (Vercel Node.js/Shims)
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch (e) {}
  
  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);
export const missingVars = {
  url: !supabaseUrl,
  key: !supabaseAnonKey
};

if (!isSupabaseConfigured) {
  console.warn("Supabase Configuration Missing. App will prompt for Demo Mode.");
}
