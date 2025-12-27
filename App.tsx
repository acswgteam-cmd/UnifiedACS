
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AppState, ArtworkLog, Department, Designer, Project, Lead } from './types';
import ArtworkLogPage from './pages/ArtworkLogPage';
import DepartmentMaster from './pages/DepartmentMaster';
import DesignerMaster from './pages/DesignerMaster';
import ProjectMaster from './pages/ProjectMaster';
import LeadMaster from './pages/LeadMaster';
import PublicLeadForm from './pages/PublicLeadForm';
import Dashboard from './pages/Dashboard';
import { supabase, isSupabaseConfigured, missingVars } from './lib/supabase';
import { INITIAL_STATE } from './data/mockData';

const App: React.FC = () => {
  const [useDemoMode, setUseDemoMode] = useState(false);
  const [state, setState] = useState<AppState>({
    designers: [],
    departments: [],
    projects: [],
    leads: [],
    artworkLogs: []
  });
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const fetchData = async () => {
    if (!supabase || useDemoMode) return;
    setLoading(true);
    try {
      const [designersRes, departmentsRes, projectsRes, leadsRes, logsRes] = await Promise.all([
        supabase.from('designers').select('*').order('name'),
        supabase.from('departments').select('*').order('department_name'),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('artwork_logs').select('*').order('created_at', { ascending: false })
      ]);

      setState({
        designers: designersRes.data || [],
        departments: departmentsRes.data || [],
        projects: projectsRes.data || [],
        leads: leadsRes.data || [],
        artworkLogs: logsRes.data || []
      });
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSupabaseConfigured && !useDemoMode) {
      fetchData();
    }
  }, [useDemoMode]);

  // MOVE EARLY RETURN AFTER HOOKS to avoid Error 310 (Hook Rule Violation)
  if (!isSupabaseConfigured && !useDemoMode) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-3xl shadow-2xl p-10 border-t-8 border-rose-500 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center text-2xl">⚠️</div>
            <h1 className="text-2xl font-black text-slate-900">Database Connection Error</h1>
          </div>
          
          <p className="text-slate-600 mb-6 font-medium leading-relaxed">
            Aplikasi tidak dapat menemukan kredensial database. Pastikan <strong>Environment Variables</strong> berikut sudah terpasang di Vercel:
          </p>
          
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-8 space-y-4">
            <div className="flex items-center justify-between">
              <code className="text-xs font-bold text-slate-700">VITE_SUPABASE_URL</code>
              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${missingVars.url ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                {missingVars.url ? "Missing" : "Detected"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <code className="text-xs font-bold text-slate-700">VITE_SUPABASE_ANON_KEY</code>
              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${missingVars.key ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                {missingVars.key ? "Missing" : "Detected"}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Periksa Lagi & Refresh
            </button>
            
            <button 
              onClick={() => {
                setState(INITIAL_STATE);
                setUseDemoMode(true);
              }}
              className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all text-sm"
            >
              Masuk dengan Data Demo (Hanya Lihat)
            </button>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
              ACS Creative Operations & bull; Support ID: ERR_ENV_MISSING
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleAddLog = async (log: Omit<ArtworkLog, 'id'>) => {
    if (useDemoMode) {
      alert("Mode Demo: Tidak dapat menyimpan ke database.");
      return;
    }
    if (!supabase) return;
    const { error } = await supabase.from('artwork_logs').insert([log]);
    if (error) alert(`Error: ${error.message}`);
    else fetchData();
  };

  const handleUpdateLog = async (log: ArtworkLog) => {
    if (useDemoMode) return;
    if (!supabase) return;
    const { error } = await supabase.from('artwork_logs').update(log).eq('id', log.id);
    if (error) alert(`Update failed: ${error.message}`);
    else fetchData();
  };

  const handleDeleteLog = async (id: string) => {
    if (useDemoMode) return;
    if (!supabase || !confirm("Hapus?")) return;
    const { error } = await supabase.from('artwork_logs').delete().eq('id', id);
    if (error) alert(`Hapus gagal: ${error.message}`);
    else fetchData();
  };

  return (
    <HashRouter>
      <Routes>
        <Route path="/public/submit-lead" element={<PublicLeadForm onHostSubmit={() => fetchData()} currentLeads={state.leads} />} />
        <Route path="*" element={
          <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
            {useDemoMode && (
              <div className="absolute top-0 left-0 w-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.2em] py-1 text-center z-[100] shadow-sm">
                Demo Mode Active (Read Only)
              </div>
            )}
            <aside className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col shadow-xl z-20">
              <div className="p-6">
                <h1 className="text-lg font-bold tracking-tight">ACS UNIFIED<br/><span className="text-indigo-400">LOG ARTWORK</span></h1>
              </div>
              <nav className="flex-1 px-4 py-4 space-y-1">
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/artwork-logs">Artwork Logs</NavLink>
                <div className="mt-8 mb-2 px-3 text-[10px] font-bold text-slate-500 uppercase">Master Data</div>
                <NavLink to="/masters/departments">Departments</NavLink>
                <NavLink to="/masters/designers">Designers</NavLink>
                <NavLink to="/masters/projects">Projects</NavLink>
                <NavLink to="/masters/leads">Leads</NavLink>
              </nav>
            </aside>
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
              {loading && <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600 animate-pulse z-50"></div>}
              <div className="flex-1 overflow-y-auto p-8">
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard state={state} />} />
                  <Route path="/artwork-logs" element={<ArtworkLogPage state={state} onAdd={handleAddLog} onUpdate={handleUpdateLog} onDelete={handleDeleteLog} />} />
                  <Route path="/masters/departments" element={<DepartmentMaster departments={state.departments} onUpdate={fetchData} />} />
                  <Route path="/masters/designers" element={<DesignerMaster designers={state.designers} onUpdate={fetchData} />} />
                  <Route path="/masters/projects" element={<ProjectMaster projects={state.projects} designers={state.designers} onUpdate={fetchData} />} />
                  <Route path="/masters/leads" element={<LeadMaster leads={state.leads} onUpdate={fetchData} />} />
                </Routes>
              </div>
            </main>
          </div>
        } />
      </Routes>
    </HashRouter>
  );
};

const NavLink: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => {
  const location = useLocation();
  const isActive = location.pathname.startsWith(to);
  return (
    <Link to={to} className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold ${isActive ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
      {children}
    </Link>
  );
};

export default App;
