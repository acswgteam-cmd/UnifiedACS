
# 🎨 ACS Unified Log Artwork - Deployment Guide

Sistem manajemen log artwork terpadu yang terintegrasi dengan Supabase.

## 🚀 Database Setup (PENTING)

Jalankan perintah SQL ini di **Supabase SQL Editor** untuk membuat tabel yang dibutuhkan.

### 1. Core Master Data (Jalankan Pertama)

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
```

### 2. Operational Tables (Jalankan Kedua)

```sql
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

-- Tabel Internal Design Tasks
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
```

### 3. Transactional & Features (Jalankan Ketiga)

```sql
-- Tabel Artwork Logs (Pencatatan harian)
CREATE TABLE artwork_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_context TEXT NOT NULL,
  project_id UUID REFERENCES projects(id),
  lead_id UUID REFERENCES leads(id),
  internal_design_id UUID REFERENCES internal_designs(id),
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

-- Tabel Project Surveys (Form Evaluasi Kinerja)
CREATE TABLE project_surveys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) NOT NULL UNIQUE,
  rating_speed INTEGER NOT NULL,
  rating_quality INTEGER NOT NULL,
  rating_accuracy INTEGER NOT NULL,
  rating_coord_internal INTEGER NOT NULL,
  rating_coord_client INTEGER NOT NULL,
  rating_problem_solving INTEGER NOT NULL,
  rating_agility INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

### 4. Feature Updates (Jalankan Jika Belum Ada)

#### Clarification Request Loop (Update 2024)
Jalankan ini jika Anda mendapatkan error `Could not find the 'clarification_notes' column`.

```sql
ALTER TABLE project_surveys ADD COLUMN status TEXT DEFAULT 'SUBMITTED';
ALTER TABLE project_surveys ADD COLUMN clarification_notes TEXT;
```

#### Project Checklist
```sql
CREATE TABLE checklist_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE checklist_template_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES checklist_templates(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  size TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE project_checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  size TEXT,
  quantity INTEGER DEFAULT 1,
  notes TEXT,
  status TEXT DEFAULT 'NONE',
  source_template_id UUID REFERENCES checklist_templates(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

## 🛠 Features
- **Dashboard Analytics**: Visualisasi produksi bulanan (2D, 3D, Video).
- **Internal Design Portal**: Form khusus untuk permintaan antar departemen.
- **Project Evaluation**: Form survei kinerja tim per project.
- **Project & Lead Master**: Manajemen timeline event dan proposal.
- **Secure Links**: Link form publik yang diamankan dengan token rahasia.

---
*Built for ACS Creative Operations.*
