
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

  return (
    <HashRouter>
      <Routes>
        <Route path="/portal/v1/inquiry/:token" element={<PublicLeadForm onHostSubmit={() => fetchData()} currentLeads={state.leads} />} />
        <Route path="/portal/v1/internal/:token" element={<PublicInternalForm onHostSubmit={() => fetchData()} departments={state.departments} />} />
        <Route path="/portal/v1/survey/:token" element={<PublicProjectSurvey />} />
        
        <Route path="/admin/*" element={
          <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
            <aside className={`${collapsed ? 'w-20' : 'w-64'} bg-slate-900 text-white flex-shrink-0 flex flex-col shadow-xl z-20 transition-all duration-300`}>
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
              <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto scrollbar-hide">
                <NavLink to="/admin/dashboard" icon="📊" label="Dashboard" collapsed={collapsed} />
                <NavLink to="/admin/artwork-logs" icon="🎨" label="Artwork Logs" collapsed={collapsed} />
                
                <div className={`mt-8 mb-2 px-3 text-[10px] font-bold text-slate-500 uppercase ${collapsed ? 'text-center' : ''}`}>
                  {collapsed ? '•••' : 'Master Data'}
                </div>
                
                <NavLink to="/admin/masters/departments" icon="🏢" label="Departments" collapsed={collapsed} />
                <NavLink to="/admin/masters/designers" icon="👥" label="Designers" collapsed={collapsed} />
                <NavLink to="/admin/masters/projects" icon="📁" label="Projects" collapsed={collapsed} />
                <NavLink to="/admin/masters/leads" icon="🎯" label="Leads" collapsed={collapsed} />
                <NavLink to="/admin/masters/internal" icon="🔧" label="Internal Tasks" collapsed={collapsed} />
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

const NavLink: React.FC<{ to: string; icon: string; label: string; collapsed: boolean }> = ({ to, icon, label, collapsed }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link 
      to={to} 
      className={`group relative flex items-center ${collapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-xl text-sm font-semibold transition-all ${isActive ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
    >
      <span className="text-xl leading-none">{icon}</span>
      {!collapsed && <span className="ml-3 truncate">{label}</span>}
      
      {/* Tooltip on Hover when Collapsed */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg border border-slate-700 font-bold tracking-wide">
          {label}
        </div>
      )}
    </Link>
  );
};

export default App;
