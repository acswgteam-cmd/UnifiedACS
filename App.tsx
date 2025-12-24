
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
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    designers: [],
    departments: [],
    projects: [],
    leads: [],
    artworkLogs: []
  });
  const [loading, setLoading] = useState(true);
  const [seenLeadsCount, setSeenLeadsCount] = useState<number>(() => {
    return parseInt(localStorage.getItem('acs_seen_leads_count') || '0');
  });

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [designers, departments, projects, leads, logs] = await Promise.all([
        supabase.from('designers').select('*').order('name'),
        supabase.from('departments').select('*').order('department_name'),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('artwork_logs').select('*').order('created_at', { ascending: false })
      ]);

      setState({
        designers: designers.data || [],
        departments: departments.data || [],
        projects: projects.data || [],
        leads: leads.data || [],
        artworkLogs: logs.data || []
      });
      
      const leadsCount = leads.data?.length || 0;
      if (!localStorage.getItem('acs_seen_leads_count')) {
        setSeenLeadsCount(leadsCount);
        localStorage.setItem('acs_seen_leads_count', leadsCount.toString());
      }
    } catch (error) {
      console.error("Error fetching database:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddLog = async (log: Omit<ArtworkLog, 'id'>) => {
    if (!supabase) {
      alert("Error: Supabase connection not established.");
      return;
    }
    
    const { error } = await supabase.from('artwork_logs').insert([log]);
    
    if (error) {
      console.error("Database Error:", error);
      alert(`Gagal Simpan: ${error.message}\n\nPastikan Anda sudah mengisi data Designer/Project di menu Master terlebih dahulu.`);
    } else {
      fetchData();
    }
  };

  const handleUpdateLog = async (log: ArtworkLog) => {
    if (!supabase) return;
    const { error } = await supabase.from('artwork_logs').update(log).eq('id', log.id);
    if (error) alert(`Update gagal: ${error.message}`);
    else fetchData();
  };

  const handleDeleteLog = async (id: string) => {
    if (!supabase || !confirm("Hapus log ini?")) return;
    const { error } = await supabase.from('artwork_logs').delete().eq('id', id);
    if (error) alert(`Hapus gagal: ${error.message}`);
    else fetchData();
  };

  const handleUpdateDepartments = async (depts: Department[]) => {
    // For master tables, we usually do fetchData after any DB operation
    fetchData();
  };
  
  const handleUpdateDesigners = async (designers: Designer[]) => {
    // If using the local master components that send the whole array, 
    // we need to handle specific logic or just refresh
    fetchData();
  };

  const unreadLeadsCount = useMemo(() => {
    return Math.max(0, state.leads.length - seenLeadsCount);
  }, [state.leads.length, seenLeadsCount]);

  const markLeadsAsSeen = () => {
    const currentCount = state.leads.length;
    setSeenLeadsCount(currentCount);
    localStorage.setItem('acs_seen_leads_count', currentCount.toString());
  };

  return (
    <HashRouter>
      <Routes>
        <Route path="/public/submit-lead" element={<PublicLeadForm onHostSubmit={() => fetchData()} currentLeads={state.leads} />} />
        
        <Route path="*" element={
          <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
            <aside className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col shadow-xl z-20">
              <div className="p-6">
                <h1 className="text-lg font-bold tracking-tight leading-tight">ACS UNIFIED<br/><span className="text-indigo-400">LOG ARTWORK</span></h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mt-2 font-bold text-white/60">Creative Operations</p>
              </div>
              <nav className="flex-1 px-4 py-4 space-y-1">
                <NavLink to="/dashboard">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  Dashboard
                </NavLink>
                <NavLink to="/artwork-logs">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                  Artwork Logs
                </NavLink>
                <div className="mt-8 mb-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Master Data</div>
                <NavLink to="/masters/departments">Departments</NavLink>
                <NavLink to="/masters/designers">Designers</NavLink>
                <NavLink to="/masters/projects">Projects</NavLink>
                <NavLink to="/masters/leads" badge={unreadLeadsCount} onClick={markLeadsAsSeen}>Leads</NavLink>
              </nav>
            </aside>

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
              {loading && <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600 animate-pulse z-50"></div>}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto p-6 sm:p-8">
                  {state.designers.length === 0 && !loading && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-medium">
                      ⚠️ <strong>Database Kosong:</strong> Silakan isi data di menu <strong>Designers</strong> dan <strong>Departments</strong> terlebih dahulu sebelum membuat Log.
                    </div>
                  )}
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
              </div>
            </main>
          </div>
        } />
      </Routes>
    </HashRouter>
  );
};

const NavLink: React.FC<{ to: string; children: React.ReactNode; badge?: number; onClick?: () => void }> = ({ to, children, badge = 0, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname.startsWith(to);
  return (
    <Link 
      to={to} onClick={onClick}
      className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 relative group ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
    >
      {children}
      {badge > 0 && !isActive ? <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-rose-500 text-white text-[10px] font-bold rounded-full px-1.5">{badge}</span> : null}
    </Link>
  );
};

export default App;
