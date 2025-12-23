
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Ambil variabel environment dari Vite
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

// Hanya inisialisasi jika kunci tersedia untuk mencegah crash
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

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
