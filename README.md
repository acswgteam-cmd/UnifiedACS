
# 🎨 ACS Unified Log Artwork - Deployment Guide

Sistem manajemen log artwork terpadu yang terintegrasi dengan Supabase.

## 🚀 Database Setup (PENTING)

Jika Anda melihat error "table not found", Anda perlu menjalankan perintah SQL berikut di **Supabase SQL Editor**:

```sql
-- Tabel Master Departments
CREATE TABLE departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabel Master Designers
CREATE TABLE designers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabel Master Projects
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  locations JSONB DEFAULT '[]',
  pic_designer_id UUID REFERENCES designers(id),
  support_designer_ids JSONB DEFAULT '[]',
  project_type TEXT,
  notes TEXT,
  status TEXT DEFAULT 'ON PROGRESS',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabel Master Leads
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_name TEXT NOT NULL,
  requester TEXT NOT NULL,
  order_date DATE NOT NULL,
  deadline DATE NOT NULL,
  lead_grade TEXT,
  brief TEXT,
  drive_link TEXT,
  status TEXT DEFAULT 'ON PROGRESS',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabel Internal Design Tasks (BARU)
CREATE TABLE internal_designs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id),
  requester_name TEXT NOT NULL,
  deadline DATE NOT NULL,
  brief TEXT,
  status TEXT DEFAULT 'NEW',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabel Artwork Logs
CREATE TABLE artwork_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_context TEXT NOT NULL,
  project_id UUID REFERENCES projects(id),
  lead_id UUID REFERENCES leads(id),
  internal_design_id UUID REFERENCES internal_designs(id), -- Kolom Baru
  department_id UUID REFERENCES departments(id),
  artwork_name TEXT NOT NULL,
  artwork_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  pic_designer_id UUID REFERENCES designers(id),
  revision_count INTEGER DEFAULT 0,
  approval_required BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

## 🛠 Features
- **Dashboard Analytics**: Visualisasi produksi bulanan (2D, 3D, Video).
- **Internal Design Portal**: Form khusus untuk permintaan antar departemen.
- **Project & Lead Master**: Manajemen timeline event dan proposal.
- **Secure Links**: Link form publik yang diamankan dengan token rahasia.

---
*Built for ACS Creative Operations.*
