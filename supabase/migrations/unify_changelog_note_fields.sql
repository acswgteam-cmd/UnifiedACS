-- ============================================================
-- Migration: Unified Changelog — tambah kolom note_title,
--   note_deadline, note_status ke internal_design_changelog
-- Tanggal: 2026-06-09
-- Jalankan di: Supabase Dashboard > SQL Editor
-- ============================================================

-- Tambah kolom untuk catatan yang berfungsi sebagai "task note"
ALTER TABLE internal_design_changelog
  ADD COLUMN IF NOT EXISTS note_title    TEXT,
  ADD COLUMN IF NOT EXISTS note_deadline DATE,
  ADD COLUMN IF NOT EXISTS note_status   TEXT DEFAULT 'OPEN';

-- Index untuk query berdasarkan deadline catatan
CREATE INDEX IF NOT EXISTS idx_changelog_note_deadline
  ON internal_design_changelog(note_deadline)
  WHERE note_deadline IS NOT NULL;

-- ============================================================
-- Setelah ini, tabel internal_task_notes sudah tidak dipakai
-- dari UI (tabel tetap ada di DB, datanya aman).
-- ============================================================
