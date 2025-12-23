# 🎨 Creative Log Pro - Deployment Guide

A scalable unified artwork logging and creative operations management system.

## 🚀 Quick Start Deployment

### 1. Database Setup (Supabase)
1. Create a new project on [Supabase](https://supabase.com/).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Copy and paste the SQL schema found in `lib/supabase.ts` and run it. This will create all necessary tables: `designers`, `departments`, `projects`, `leads`, and `artwork_logs`.
4. Go to **Project Settings > API** to get your `Project URL` and `anon public` key.

### 2. Version Control (GitHub)
1. Initialize a git repository in your project folder.
2. Push the code to a new GitHub repository.

### 3. Hosting & CI/CD (Vercel)
1. Import your GitHub repository to [Vercel](https://vercel.com/).
2. In the **Environment Variables** section, add the following:
   - `VITE_SUPABASE_URL`: (Your Supabase Project URL)
   - `VITE_SUPABASE_ANON_KEY`: (Your Supabase Anon Key)
3. Click **Deploy**.

## 🛠 Features
- **Unified Logging**: Sync artwork production across Projects, Leads, and Internal Depts.
- **Advanced Dashboard**: Real-time analytics with custom Date Range Picker.
- **Master Registry**: Manage Designers, Departments, and Project Timelines.
- **Export Ready**: Download filtered data as CSV for reporting.
- **Public Entry**: Dedicated public form for creative requests/leads.

## 💻 Tech Stack
- **Frontend**: React 19, Tailwind CSS, React Router 7.
- **Backend/DB**: Supabase (PostgreSQL).
- **Deployment**: Vercel.
- **Environment**: Vite.

---
*Built with precision for Creative Operations.*
