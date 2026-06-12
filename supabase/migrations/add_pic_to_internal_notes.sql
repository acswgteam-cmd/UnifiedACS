-- ============================================================
-- Migration: Add pic_designer_id to internal_design_changelog & internal_task_notes
-- Tanggal: 2026-06-12
-- Jalankan di: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Tambah kolom pic_designer_id ke internal_design_changelog
ALTER TABLE internal_design_changelog
  ADD COLUMN IF NOT EXISTS pic_designer_id UUID REFERENCES designers(id) ON DELETE SET NULL;

-- Index untuk query pic_designer_id
CREATE INDEX IF NOT EXISTS idx_changelog_pic_designer
  ON internal_design_changelog(pic_designer_id)
  WHERE pic_designer_id IS NOT NULL;

-- 2. Tambah kolom pic_designer_id ke internal_task_notes (tabel legacy/cadangan)
ALTER TABLE internal_task_notes
  ADD COLUMN IF NOT EXISTS pic_designer_id UUID REFERENCES designers(id) ON DELETE SET NULL;
