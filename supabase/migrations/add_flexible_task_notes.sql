-- ============================================================
-- Migration: Flexible Deadline + Sub-Notes per Internal Task
-- Tanggal: 2026-06-09
-- Jalankan di: Supabase Dashboard > SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. Ubah kolom deadline di internal_designs jadi NULLABLE
--    (task tanpa deadline tetap bisa disimpan)
-- ──────────────────────────────────────────────────────────
ALTER TABLE internal_designs
  ALTER COLUMN deadline DROP NOT NULL;

-- ──────────────────────────────────────────────────────────
-- 2. Buat tabel internal_task_notes
--    Sub-catatan per task. Setiap catatan bisa punya
--    deadline sendiri (opsional) dan status OPEN/DONE.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS internal_task_notes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  internal_design_id UUID NOT NULL REFERENCES internal_designs(id) ON DELETE CASCADE,

  -- Judul catatan (wajib), misal: "Cari gambar", "Desain layout"
  title           TEXT NOT NULL,

  -- Isi detail catatan / progress (opsional)
  content         TEXT,

  -- Deadline catatan ini (opsional, bisa berbeda dari deadline task utama)
  deadline        DATE,

  -- Status catatan: OPEN atau DONE
  status          TEXT NOT NULL DEFAULT 'OPEN'
                  CHECK (status IN ('OPEN', 'DONE')),

  -- Link referensi (Google Drive, URL, dll)
  reference_link  TEXT,

  -- URL gambar screenshot (upload ke Storage)
  image_url       TEXT,

  -- Nama yang membuat catatan
  created_by      TEXT DEFAULT 'Admin',

  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ──────────────────────────────────────────────────────────
-- 3. Index untuk performa query
-- ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_task_notes_design_id
  ON internal_task_notes(internal_design_id);

CREATE INDEX IF NOT EXISTS idx_task_notes_deadline
  ON internal_task_notes(deadline)
  WHERE deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_notes_status
  ON internal_task_notes(status);

-- ──────────────────────────────────────────────────────────
-- 4. Trigger: auto-update updated_at saat row diubah
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_task_notes_updated_at
  BEFORE UPDATE ON internal_task_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ──────────────────────────────────────────────────────────
-- 5. Row Level Security (RLS)
-- ──────────────────────────────────────────────────────────
ALTER TABLE internal_task_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for internal_task_notes"
  ON internal_task_notes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ──────────────────────────────────────────────────────────
-- SELESAI
-- Setelah menjalankan ini, pastikan juga bucket Storage
-- "changelog-images" sudah ada (dari migration sebelumnya).
-- ──────────────────────────────────────────────────────────
