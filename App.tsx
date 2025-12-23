
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { INITIAL_STATE } from './data/mockData';
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
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [designers, departments, projects, leads, logs] = await Promise.all([
        supabase.from('designers').select('*'),
        supabase.from('departments').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('leads').select('*'),
        supabase.from('artwork_logs').select('*').order('created_at', { ascending: false })
      ]);

      setState({
        designers: designers.data || [],
        departments: departments.data || [],
        projects: projects.data || [],
        leads: leads.data || [],
        artworkLogs: logs.data || []
      });
    } catch (error) {
      console.error("Error fetching database:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddLog = async (log: ArtworkLog) => {
    setState(s => ({ ...s, artworkLogs: [log, ...s.artworkLogs] }));
    if (supabase) {
      const { error } = await supabase.from('artwork_logs').insert([log]);
      if (error) console.error("Database sync error:", error);
    }
  };

  const handleUpdateLog = async (updatedLog: ArtworkLog) => {
    setState(s => ({
      ...s,
      artworkLogs: s.artworkLogs.map(l => l.id === updatedLog.id ? updatedLog : l)
    }));
    if (supabase) {
      const { error } = await supabase.from('artwork_logs').update(updatedLog).eq('id', updatedLog.id);
      if (error) console.error("Database sync error:", error);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this log entry?')) return;
    setState(s => ({
      ...s,
      artworkLogs: s.artworkLogs.filter(l => l.id !== id)
    }));
    if (supabase) {
      const { error } = await supabase.from('artwork_logs').delete().eq('id', id);
      if (error) console.error("Database sync error:", error);
    }
  };

  const handleUpdateDepartments = (deps: Department[]) => setState(s => ({ ...s, departments: deps }));
  const handleUpdateDesigners = (des: Designer[]) => setState(s => ({ ...s, designers: des }));
  const handleUpdateProjects = (projs: Project[]) => setState(s => ({ ...s, projects: projs }));
  
  const handleUpdateLeads = async (leads: Lead[]) => {
    setState(s => ({ ...s, leads: leads }));
  };

  return (
    <HashRouter>
      <Routes>
        <Route path="/public/submit-lead" element={<PublicLeadForm onHostSubmit={handleUpdateLeads} currentLeads={state.leads} />} />
        
        <Route path="*" element={
          <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
            <aside className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col shadow-xl z-20">
              <div className="p-6">
                <h1 className="text-xl font-bold tracking-tight">CREATIVE<span className="text-indigo-400">LOG</span></h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mt-1 font-semibold text-white/60">Creative Operations</p>
              </div>
              <nav className="flex-1 px-4 py-4 space-y-1">
                <NavLink to="/dashboard">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  Analytics Dashboard
                </NavLink>
                <NavLink to="/artwork-logs">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                  Artwork Logs
                </NavLink>
                <div className="mt-8 mb-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Master Registry</div>
                <NavLink to="/masters/departments">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                  Departments
                </NavLink>
                <NavLink to="/masters/designers">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                  Designers
                </NavLink>
                <NavLink to="/masters/projects">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                  Projects
                </NavLink>
                <NavLink to="/masters/leads">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/></svg>
                  Leads
                </NavLink>
              </nav>
              <div className="p-4 bg-slate-800/50 mt-auto">
                <Link to="/public/submit-lead" target="_blank" className="block text-center p-2 rounded bg-indigo-600/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-colors">
                  Open Public Form ↗
                </Link>
              </div>
            </aside>

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
              {loading && <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600 animate-pulse z-50"></div>}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto p-6 sm:p-8">
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard state={state} />} />
                    <Route path="/artwork-logs" element={<ArtworkLogPage state={state} onAdd={handleAddLog} onUpdate={handleUpdateLog} onDelete={handleDeleteLog} />} />
                    <Route path="/masters/departments" element={<DepartmentMaster departments={state.departments} onUpdate={handleUpdateDepartments} />} />
                    <Route path="/masters/designers" element={<DesignerMaster designers={state.designers} onUpdate={handleUpdateDesigners} />} />
                    <Route path="/masters/projects" element={<ProjectMaster projects={state.projects} designers={state.designers} onUpdate={handleUpdateProjects} />} />
                    <Route path="/masters/leads" element={<LeadMaster leads={state.leads} onUpdate={handleUpdateLeads} />} />
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

const NavLink: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => {
  const location = useLocation();
  const isActive = location.pathname.startsWith(to);
  return (
    <Link to={to} className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
      {children}
    </Link>
  );
};

export default App;
