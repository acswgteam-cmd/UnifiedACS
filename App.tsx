
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
import PublicProjectSurvey from './pages/PublicProjectSurvey';
import Dashboard from './pages/Dashboard';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { INITIAL_STATE } from './data/mockData';

export const PUBLIC_FORM_SECRET = 'acs-creative-portal-v1-992837465';
export const INTERNAL_FORM_SECRET = 'acs-internal-request-v1-554219830';
export const SURVEY_FORM_SECRET = 'acs-project-eval-v1-11223344';

const App: React.FC = () => {
  const [useDemoMode, setUseDemoMode] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [state, setState] = useState<AppState>({
    designers: [],
    departments: [],
    projects: [],
    leads: [],
    internalDesigns: [],
    artworkLogs: [],
    projectSurveys: [],
    projectChecklists: [],
    checklistTemplates: [],
    checklistTemplateItems: []
  });
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const fetchData = async () => {
    if (!supabase || useDemoMode) return;
    try {
      const [
        designersRes, 
        departmentsRes, 
        projectsRes, 
        leadsRes, 
        internalRes, 
        logsRes, 
        surveysRes, 
        checklistsRes,
        templatesRes,
        templateItemsRes
      ] = await Promise.all([
        supabase.from('designers').select('*').order('name'),
        supabase.from('departments').select('*').order('department_name'),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('internal_designs').select('*').order('created_at', { ascending: false }),
        supabase.from('artwork_logs').select('*').order('created_at', { ascending: false }),
        supabase.from('project_surveys').select('*'),
        supabase.from('project_checklists').select('*').order('created_at', { ascending: true }),
        supabase.from('checklist_templates').select('*').order('name'),
        supabase.from('checklist_template_items').select('*').order('created_at')
      ]);

      setState({
        designers: designersRes.data || [],
        departments: departmentsRes.data || [],
        projects: projectsRes.data || [],
        leads: leadsRes.data || [],
        internalDesigns: internalRes.data || [],
        artworkLogs: logsRes.data || [],
        projectSurveys: surveysRes.data || [],
        projectChecklists: checklistsRes.data || [],
        checklistTemplates: templatesRes.data || [],
        checklistTemplateItems: templateItemsRes.data || []
      });
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  // Initial Load
  useEffect(() => {
    if (isSupabaseConfigured && !useDemoMode) {
      setLoading(true);
      fetchData().then(() => setLoading(false));
    } else if (useDemoMode) {
      setState({ ...INITIAL_STATE });
    }
  }, [useDemoMode]);

  // REALTIME SUBSCRIPTION setup
  useEffect(() => {
    if (!supabase || useDemoMode) return;

    // Subscribe to all changes in the 'public' schema
    const channel = supabase.channel('db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          console.log('Realtime change detected:', payload);
          fetchData(); // Trigger data refresh automatically
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
            <button onClick={() => { setState({ ...INITIAL_STATE }); setUseDemoMode(true); }} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">Demo Mode</button>
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

  // SVGs for Icons - Solid White
  const icons = {
    dashboard: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z"/><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z"/></svg>,
    artwork: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/></svg>,
    dept: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd"/></svg>,
    team: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/></svg>,
    project: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd"/><path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z"/></svg>,
    lead: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd"/></svg>,
    internal: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/></svg>
  };

  return (
    <HashRouter>
      <Routes>
        <Route path="/portal/v1/inquiry/:token" element={<PublicLeadForm onHostSubmit={() => fetchData()} currentLeads={state.leads} />} />
        <Route path="/portal/v1/internal/:token" element={<PublicInternalForm onHostSubmit={() => fetchData()} departments={state.departments} />} />
        <Route path="/portal/v1/survey/:token" element={<PublicProjectSurvey />} />
        
        <Route path="/admin/*" element={
          <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
            {/* Sidebar: Added overflow-visible for tooltips when collapsed */}
            <aside className={`${collapsed ? 'w-20 overflow-visible' : 'w-64 overflow-hidden'} bg-slate-900 text-white flex-shrink-0 flex flex-col shadow-xl z-20 transition-all duration-300 relative`}>
              <div className={`p-4 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
                {!collapsed && <h1 className="text-lg font-bold tracking-tight leading-tight">ACS UNIFIED<br/><span className="text-indigo-400">LOG ARTWORK</span></h1>}
                <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                  {collapsed ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
                  )}
                </button>
              </div>
              {/* Nav: Switch overflow based on state to allow tooltips when collapsed */}
              <nav className={`flex-1 px-3 py-4 space-y-2 ${collapsed ? 'overflow-visible' : 'overflow-y-auto scrollbar-hide'}`}>
                <NavLink to="/admin/dashboard" icon={icons.dashboard} label="Dashboard" collapsed={collapsed} />
                <NavLink to="/admin/artwork-logs" icon={icons.artwork} label="Artwork Logs" collapsed={collapsed} />
                
                <div className={`mt-8 mb-2 px-3 text-[10px] font-bold text-slate-500 uppercase ${collapsed ? 'text-center' : ''}`}>
                  {collapsed ? '•••' : 'Master Data'}
                </div>
                
                <NavLink to="/admin/masters/departments" icon={icons.dept} label="Departments" collapsed={collapsed} />
                <NavLink to="/admin/masters/designers" icon={icons.team} label="Designers" collapsed={collapsed} />
                <NavLink to="/admin/masters/projects" icon={icons.project} label="Projects" collapsed={collapsed} />
                <NavLink to="/admin/masters/leads" icon={icons.lead} label="Leads" collapsed={collapsed} />
                <NavLink to="/admin/masters/internal" icon={icons.internal} label="Internal Tasks" collapsed={collapsed} />
              </nav>
            </aside>
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
              {loading && <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600 animate-pulse z-50"></div>}
              <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <Routes>
                  <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard state={state} />} />
                  <Route path="/artwork-logs" element={<ArtworkLogPage state={state} onAdd={handleAddLog} onUpdate={handleUpdateLog} onDelete={handleDeleteLog} />} />
                  <Route path="/masters/departments" element={<DepartmentMaster departments={state.departments} onUpdate={fetchData} />} />
                  <Route path="/masters/designers" element={<DesignerMaster designers={state.designers} onUpdate={fetchData} />} />
                  <Route path="/masters/projects" element={<ProjectMaster 
                    projects={state.projects} 
                    designers={state.designers} 
                    projectSurveys={state.projectSurveys} 
                    projectChecklists={state.projectChecklists} 
                    checklistTemplates={state.checklistTemplates}
                    checklistTemplateItems={state.checklistTemplateItems}
                    onUpdate={fetchData} 
                  />} />
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

const NavLink: React.FC<{ to: string; icon: React.ReactNode; label: string; collapsed: boolean }> = ({ to, icon, label, collapsed }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link 
      to={to} 
      className={`group relative flex items-center ${collapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-xl text-sm font-semibold transition-all ${isActive ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
    >
      <span className="text-xl leading-none flex items-center justify-center">{icon}</span>
      {!collapsed && <span className="ml-3 truncate">{label}</span>}
      
      {/* Tooltip on Hover when Collapsed */}
      {collapsed && (
        <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap z-50 shadow-xl border border-slate-700 font-bold tracking-wide transform translate-x-2 group-hover:translate-x-0">
          {label}
          {/* Arrow */}
          <div className="absolute top-1/2 right-full -mt-1 -mr-[1px] border-4 border-transparent border-r-slate-900"></div>
        </div>
      )}
    </Link>
  );
};

export default App;
