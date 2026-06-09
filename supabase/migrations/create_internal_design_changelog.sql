-- ============================================================
-- Migration: Changelog & History untuk Internal Design Tasks
-- Tanggal: 2026-06-09
-- Jalankan di: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Buat tabel changelog
CREATE TABLE IF NOT EXISTS internal_design_changelog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  internal_design_id UUID NOT NULL REFERENCES internal_designs(id) ON DELETE CASCADE,

  -- Tipe perubahan
  -- 'TASK_CREATED' | 'STATUS_CHANGE' | 'DEADLINE_CHANGE' | 'DEPT_CHANGE' | 'BRIEF_CHANGE' | 'NOTE'
  change_type TEXT NOT NULL,

  -- Nilai lama dan baru (untuk perubahan field)
  old_value TEXT,
  new_value TEXT,

  -- Catatan manual dari user
  note TEXT,

  -- Link referensi (Google Drive, URL, dll)
  reference_link TEXT,

  -- URL gambar yang diupload ke Supabase Storage
  image_url TEXT,

  -- Nama user yang membuat entry
  changed_by TEXT DEFAULT 'Admin',

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Index untuk performa
CREATE INDEX IF NOT EXISTS idx_changelog_task_id 
  ON internal_design_changelog(internal_design_id);

CREATE INDEX IF NOT EXISTS idx_changelog_created_at 
  ON internal_design_changelog(created_at DESC);

-- 3. Row Level Security (RLS) — sesuaikan dengan setup project
ALTER TABLE internal_design_changelog ENABLE ROW LEVEL SECURITY;

-- Policy: izinkan semua operasi (sesuaikan jika ada auth)
CREATE POLICY "Allow all for internal_design_changelog"
  ON internal_design_changelog
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- OPTIONAL: Buat Storage Bucket untuk gambar changelog
-- Jalankan di Supabase Dashboard > Storage > New Bucket:
--   Name: changelog-images
--   Public: true (agar URL gambar bisa diakses langsung)
-- Atau via SQL (memerlukan extensions):
-- SELECT storage.create_bucket('changelog-images', ARRAY['image/webp', 'image/jpeg', 'image/png']);
-- ============================================================
