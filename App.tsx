
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AppState, ArtworkLog } from './types';
import ArtworkLogPage from './pages/ArtworkLogPage';
import DepartmentMaster from './pages/DepartmentMaster';
import DesignerMaster from './pages/DesignerMaster';
import ProjectMaster from './pages/ProjectMaster';
import LeadMaster from './pages/LeadMaster';
import InternalDesignMaster from './pages/InternalDesignMaster';
import PublicLeadForm from './pages/PublicLeadForm';
import PublicInternalForm from './pages/PublicInternalForm';
import Dashboard from './pages/Dashboard';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { INITIAL_STATE } from './data/mockData';

export const PUBLIC_FORM_SECRET = 'acs-creative-portal-v1-992837465';
export const INTERNAL_FORM_SECRET = 'acs-internal-request-v1-554219830';

const App: React.FC = () => {
  const [useDemoMode, setUseDemoMode] = useState(false);
  const [state, setState] = useState<AppState>({
    designers: [],
    departments: [],
    projects: [],
    leads: [],
    internalDesigns: [],
    artworkLogs: []
  });
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const fetchData = async () => {
    if (!supabase || useDemoMode) return;
    setLoading(true);
    try {
      const [designersRes, departmentsRes, projectsRes, leadsRes, internalRes, logsRes] = await Promise.all([
        supabase.from('designers').select('*').order('name'),
        supabase.from('departments').select('*').order('department_name'),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('internal_designs').select('*').order('created_at', { ascending: false }),
        supabase.from('artwork_logs').select('*').order('created_at', { ascending: false })
      ]);

      setState({
        designers: designersRes.data || [],
        departments: departmentsRes.data || [],
        projects: projectsRes.data || [],
        leads: leadsRes.data || [],
        internalDesigns: internalRes.data || [],
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
    } else if (useDemoMode) {
      setState(INITIAL_STATE);
    }
  }, [useDemoMode]);

  if (!isSupabaseConfigured && !useDemoMode) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-3xl shadow-2xl p-10 border-t-8 border-rose-500 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center text-2xl">⚠️</div>
            <h1 className="text-2xl font-black text-slate-900">Database Connection Error</h1>
          </div>
          <p className="text-slate-600 mb-6 font-medium leading-relaxed">
            Aplikasi tidak dapat menemukan kredensial database. Pastikan <strong>Environment Variables</strong> sudah terpasang.
          </p>
          <div className="space-y-4">
            <button onClick={() => window.location.reload()} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold">Refresh</button>
            <button onClick={() => { setState(INITIAL_STATE); setUseDemoMode(true); }} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">Demo Mode</button>
          </div>
        </div>
      </div>
    );
  }

  const handleAddLog = async (log: Omit<ArtworkLog, 'id'>) => {
    if (useDemoMode || !supabase) return;
    const { error } = await supabase.from('artwork_logs').insert([log]);
    if (error) alert(`Error: ${error.message}`);
    else fetchData();
  };

  const handleUpdateLog = async (log: ArtworkLog) => {
    if (useDemoMode || !supabase) return;
    const { error } = await supabase.from('artwork_logs').update(log).eq('id', log.id);
    if (error) alert(`Update failed: ${error.message}`);
    else fetchData();
  };

  const handleDeleteLog = async (id: string) => {
    if (useDemoMode || !supabase || !confirm("Hapus?")) return;
    const { error } = await supabase.from('artwork_logs').delete().eq('id', id);
    if (error) alert(`Hapus gagal: ${error.message}`);
    else fetchData();
  };

  return (
    <HashRouter>
      <Routes>
        <Route path="/portal/v1/inquiry/:token" element={<PublicLeadForm onHostSubmit={() => fetchData()} currentLeads={state.leads} />} />
        <Route path="/portal/v1/internal/:token" element={<PublicInternalForm onHostSubmit={() => fetchData()} departments={state.departments} />} />
        
        <Route path="/admin/*" element={
          <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
            <aside className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col shadow-xl z-20">
              <div className="p-6"><h1 className="text-lg font-bold tracking-tight">ACS UNIFIED<br/><span className="text-indigo-400">LOG ARTWORK</span></h1></div>
              <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto scrollbar-hide">
                <NavLink to="/admin/dashboard">Dashboard</NavLink>
                <NavLink to="/admin/artwork-logs">Artwork Logs</NavLink>
                <div className="mt-8 mb-2 px-3 text-[10px] font-bold text-slate-500 uppercase">Master Data</div>
                <NavLink to="/admin/masters/departments">Departments</NavLink>
                <NavLink to="/admin/masters/designers">Designers</NavLink>
                <NavLink to="/admin/masters/projects">Projects</NavLink>
                <NavLink to="/admin/masters/leads">Leads</NavLink>
                <NavLink to="/admin/masters/internal">Internal Tasks</NavLink>
              </nav>
            </aside>
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
              {loading && <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600 animate-pulse z-50"></div>}
              <div className="flex-1 overflow-y-auto p-8">
                <Routes>
                  <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard state={state} />} />
                  <Route path="/artwork-logs" element={<ArtworkLogPage state={state} onAdd={handleAddLog} onUpdate={handleUpdateLog} onDelete={handleDeleteLog} />} />
                  <Route path="/masters/departments" element={<DepartmentMaster departments={state.departments} onUpdate={fetchData} />} />
                  <Route path="/masters/designers" element={<DesignerMaster designers={state.designers} onUpdate={fetchData} />} />
                  <Route path="/masters/projects" element={<ProjectMaster projects={state.projects} designers={state.designers} onUpdate={fetchData} />} />
                  <Route path="/masters/leads" element={<LeadMaster leads={state.leads} onUpdate={fetchData} />} />
                  <Route path="/masters/internal" element={<InternalDesignMaster internalDesigns={state.internalDesigns} departments={state.departments} onUpdate={fetchData} />} />
                </Routes>
              </div>
            </main>
          </div>
        } />

        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        
        <Route path="*" element={
          <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-slate-900">Unauthorized Access</h1>
            <p className="text-slate-500 mt-2">You do not have permission to view this resource.</p>
            <Link to="/admin/dashboard" className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-lg font-bold">Back to App</Link>
          </div>
        } />
      </Routes>
    </HashRouter>
  );
};

const NavLink: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
      {children}
    </Link>
  );
};

export default App;
