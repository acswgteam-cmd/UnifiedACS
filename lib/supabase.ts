
import { createClient } from '@supabase/supabase-js';

// Comprehensive environment variable lookup
const getEnv = (key: string): string => {
  // 1. Try global process.env (Standard for many CI/CD and shims)
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch (e) {}

  // 2. Try Vite's import.meta.env
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[key]) {
      return metaEnv[key];
    }
  } catch (e) {}

  // 3. Try window.process.env
  try {
    if (typeof window !== 'undefined' && (window as any).process?.env?.[key]) {
      return (window as any).process?.env?.[key];
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

// Log status for debugging (visible in browser console)
if (!isSupabaseConfigured) {
  console.warn("Supabase Configuration Status:", {
    urlFound: !!supabaseUrl,
    keyFound: !!supabaseAnonKey,
    detectionPath: "Checked process.env, import.meta.env, and window.process.env"
  });
}


/**
 * SQL Schema (Gunakan ini di SQL Editor Supabase):
 * 
 * -- 1. Tables
 * CREATE TABLE designers (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name TEXT, role TEXT, active BOOLEAN DEFAULT true);
 * CREATE TABLE departments (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), department_name TEXT, active BOOLEAN DEFAULT true);
 * CREATE TABLE projects (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), project_name TEXT, start_date DATE, end_date DATE, location TEXT, pic_designer_id UUID REFERENCES designers(id), support_designer_ids UUID[], project_type TEXT);
 * CREATE TABLE leads (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), lead_name TEXT, requester TEXT, order_date DATE, deadline DATE, lead_grade TEXT, brief TEXT, drive_link TEXT);
 * CREATE TABLE artwork_logs (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   work_context TEXT,
 *   project_id UUID REFERENCES projects(id),
 *   lead_id UUID REFERENCES leads(id),
 *   department_id UUID REFERENCES departments(id),
 *   artwork_name TEXT,
 *   artwork_type TEXT,
 *   start_date DATE,
 *   end_date DATE,
 *   pic_designer_id UUID REFERENCES designers(id),
 *   revision_count INT DEFAULT 0,
 *   approval_required BOOLEAN DEFAULT false,
 *   notes TEXT
 * );
 */
