
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AppState, ArtworkLog } from './types';
import ArtworkLogPage from './pages/ArtworkLogPage';
import DepartmentMaster from './pages/DepartmentMaster';
import DesignerMaster from './pages/DesignerMaster';
import { ProjectMaster } from './pages/ProjectMaster';
import LeadMaster from './pages/LeadMaster';
import InternalDesignMaster from './pages/InternalDesignMaster';
import PublicLeadForm from './pages/PublicLeadForm';
import PublicInternalForm from './pages/PublicInternalForm';
import PublicProjectSurvey from './pages/PublicProjectSurvey';
import Dashboard from './pages/Dashboard';
import ReportGenerator from './pages/ReportGenerator';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { INITIAL_STATE } from './data/mockData';

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IconDashboard = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);
const IconArtwork = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
  </svg>
);
const IconDept = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const IconTeam = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconProject = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);
const IconLead = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconInternal = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const IconReport = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
  </svg>
);
const IconChevronLeft = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const IconChevronRight = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

// ─── App ──────────────────────────────────────────────────────────────────────
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
    designerEvaluations: [],
    projectChecklists: [],
    checklistTemplates: [],
    checklistTemplateItems: []
  });
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const fetchData = async () => {
    if (!supabase || useDemoMode) return;
    try {
      const MAX_ROWS = 50000;
      const [
        designersRes, departmentsRes, projectsRes, leadsRes, internalRes,
        logsRes, surveysRes, designerEvalsRes, checklistsRes, templatesRes, templateItemsRes
      ] = await Promise.all([
        supabase.from('designers').select('*').order('name'),
        supabase.from('departments').select('*').order('department_name'),
        supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(MAX_ROWS),
        supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(MAX_ROWS),
        supabase.from('internal_designs').select('*').order('created_at', { ascending: false }).limit(MAX_ROWS),
        supabase.from('artwork_logs').select('*').order('created_at', { ascending: false }).limit(MAX_ROWS),
        supabase.from('project_surveys').select('*').limit(MAX_ROWS),
        supabase.from('designer_evaluations').select('*').order('created_at', { ascending: false }).limit(MAX_ROWS),
        supabase.from('project_checklists').select('*').order('created_at', { ascending: true }).limit(MAX_ROWS),
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
        designerEvaluations: designerEvalsRes.data || [],
        projectChecklists: checklistsRes.data || [],
        checklistTemplates: templatesRes.data || [],
        checklistTemplateItems: templateItemsRes.data || []
      });
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  useEffect(() => {
    if (isSupabaseConfigured && !useDemoMode) {
      setLoading(true);
      fetchData().then(() => setLoading(false));
    } else if (useDemoMode) {
      setState({ ...INITIAL_STATE });
    }
  }, [useDemoMode]);

  useEffect(() => {
    if (!supabase || useDemoMode) return;
    const channel = supabase.channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [useDemoMode]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
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
    if (useDemoMode || !supabase || !confirm('Hapus log ini?')) return;
    const { error } = await supabase.from('artwork_logs').delete().eq('id', id);
    if (error) alert(`Hapus gagal: ${error.message}`);
    else fetchData();
  };

  // ─── DB Error Screen ─────────────────────────────────────────────────────────
  if (!isSupabaseConfigured && !useDemoMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="card p-10 max-w-lg w-full animate-scale-in" style={{ borderTop: '3px solid var(--color-error)' }}>
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-panel flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#fee2e2', color: 'var(--color-error)' }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div>
              <h1 className="font-display text-xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Database Connection Error</h1>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Aplikasi tidak dapat menemukan kredensial database. Pastikan <strong>Environment Variables</strong> sudah terpasang dengan benar.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => window.location.reload()} className="btn btn-primary btn-md flex-1">
              Refresh
            </button>
            <button
              onClick={() => { setState({ ...INITIAL_STATE }); setUseDemoMode(true); }}
              className="btn btn-secondary btn-md flex-1"
            >
              Demo Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/portal/v1/inquiry/:token" element={<PublicLeadForm onHostSubmit={() => fetchData()} currentLeads={state.leads} />} />
        <Route path="/portal/v1/internal/:token" element={<PublicInternalForm onHostSubmit={() => fetchData()} departments={state.departments} />} />
        <Route path="/portal/v1/survey/:token"   element={<PublicProjectSurvey />} />

        {/* Admin layout */}
        <Route path="/admin/*" element={
          <div className="flex flex-col md:flex-row h-screen overflow-hidden pb-[72px] md:pb-0" style={{ backgroundColor: 'var(--color-bg)' }}>
            {/* Loading bar */}
            {loading && <div className="progress-bar" />}

            {/* — Desktop Sidebar — */}
            <aside
              className={`hidden md:flex flex-col flex-shrink-0 h-full transition-all duration-300 sidebar ${collapsed ? 'w-[64px]' : 'w-[220px]'}`}
            >
              {/* Logo */}
              <div className={`flex items-center h-[56px] px-4 border-b ${collapsed ? 'justify-center' : 'justify-between'}`} style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                {!collapsed && (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-btn flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="white"><rect x="1" y="1" width="4" height="4" rx="1"/><rect x="7" y="1" width="4" height="4" rx="1"/><rect x="1" y="7" width="4" height="4" rx="1"/><rect x="7" y="7" width="4" height="4" rx="1"/></svg>
                    </div>
                    <span className="font-display font-bold text-sm text-white tracking-tight">ACS Unified</span>
                  </div>
                )}
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  className="flex items-center justify-center w-7 h-7 rounded-btn transition-colors"
                  style={{ color: '#71717a' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)', e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent', e.currentTarget.style.color = '#71717a')}
                  title={collapsed ? 'Expand' : 'Collapse'}
                >
                  {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
                </button>
              </div>

              {/* Nav */}
              <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto scrollbar-hide overflow-x-visible">
                <SidebarLink to="/admin/dashboard" icon={<IconDashboard />} label="Dashboard" collapsed={collapsed} />
                <SidebarLink to="/admin/reports"   icon={<IconReport />}    label="Report Gen" collapsed={collapsed} badge="BETA" />
                <SidebarLink to="/admin/artwork-logs" icon={<IconArtwork />} label="Artwork Logs" collapsed={collapsed} />

                {!collapsed && (
                  <p className="overline px-3 pt-5 pb-2">Master Data</p>
                )}
                {collapsed && <div className="my-3 mx-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }} />}

                <SidebarLink to="/admin/masters/departments" icon={<IconDept />}     label="Departments"    collapsed={collapsed} />
                <SidebarLink to="/admin/masters/designers"   icon={<IconTeam />}     label="Designers"      collapsed={collapsed} />
                <SidebarLink to="/admin/masters/projects"    icon={<IconProject />}  label="Projects"       collapsed={collapsed} />
                <SidebarLink to="/admin/masters/leads"       icon={<IconLead />}     label="Leads"          collapsed={collapsed} />
                <SidebarLink to="/admin/masters/internal"    icon={<IconInternal />} label="Internal Tasks" collapsed={collapsed} />
              </nav>

              {/* Footer */}
              <div className={`px-3 py-4 border-t ${collapsed ? 'text-center' : ''}`} style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-mono" style={{ color: '#52525b' }}>
                  {collapsed ? 'v1' : 'ACS Unified · v1.0'}
                </p>
              </div>
            </aside>

            {/* — Main content — */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Top bar (mobile logo + desktop right area) */}
              <header className="nav-top px-4 md:px-6 md:hidden">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-btn flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="white"><rect x="1" y="1" width="4" height="4" rx="1"/><rect x="7" y="1" width="4" height="4" rx="1"/><rect x="1" y="7" width="4" height="4" rx="1"/><rect x="7" y="7" width="4" height="4" rx="1"/></svg>
                  </div>
                  <span className="font-display font-bold text-sm tracking-tight" style={{ color: 'var(--color-text-primary)' }}>ACS Unified</span>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ backgroundColor: 'var(--color-bg)' }}>
                <div className="p-4 md:p-8">
                  <Routes>
                    <Route path="/"                   element={<Navigate to="/admin/dashboard" replace />} />
                    <Route path="/dashboard"          element={<Dashboard state={state} />} />
                    <Route path="/reports"            element={<ReportGenerator state={state} />} />
                    <Route path="/artwork-logs"       element={<ArtworkLogPage state={state} onAdd={handleAddLog} onUpdate={handleUpdateLog} onDelete={handleDeleteLog} />} />
                    <Route path="/masters/departments" element={<DepartmentMaster departments={state.departments} onUpdate={fetchData} />} />
                    <Route path="/masters/designers"   element={<DesignerMaster designers={state.designers} onUpdate={fetchData} />} />
                    <Route path="/masters/projects"    element={
                      <ProjectMaster
                        projects={state.projects}
                        designers={state.designers}
                        artworkLogs={state.artworkLogs}
                        designerEvaluations={state.designerEvaluations}
                        projectSurveys={state.projectSurveys}
                        projectChecklists={state.projectChecklists}
                        checklistTemplates={state.checklistTemplates}
                        checklistTemplateItems={state.checklistTemplateItems}
                        onUpdate={fetchData}
                      />
                    } />
                    <Route path="/masters/leads"    element={<LeadMaster leads={state.leads} onUpdate={fetchData} />} />
                    <Route path="/masters/internal" element={<InternalDesignMaster internalDesigns={state.internalDesigns} departments={state.departments} onUpdate={fetchData} />} />
                  </Routes>
                </div>
              </div>
            </main>

            {/* — Mobile bottom nav — */}
            <nav
              className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around items-stretch h-[64px] z-[100] border-t safe-bottom"
              style={{ backgroundColor: 'rgba(15,15,17,0.95)', backdropFilter: 'blur(16px)', borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <MobileNavItem to="/admin/dashboard"          icon={<IconDashboard />} label="Home" />
              <MobileNavItem to="/admin/reports"            icon={<IconReport />}    label="Report" />
              <MobileNavItem to="/admin/artwork-logs"       icon={<IconArtwork />}   label="Logs" />
              <MobileNavItem to="/admin/masters/projects"   icon={<IconProject />}   label="Projects" />
              <MobileNavItem to="/admin/masters/leads"      icon={<IconLead />}      label="Leads" />
              <MobileNavItem to="/admin/masters/internal"   icon={<IconInternal />}  label="Tasks" />
              <MobileNavItem to="/admin/masters/designers"  icon={<IconTeam />}      label="Team" />
              <MobileNavItem to="/admin/masters/departments" icon={<IconDept />}     label="Depts" />
            </nav>
          </div>
        } />

        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />

        {/* 404 */}
        <Route path="*" element={
          <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: 'var(--color-bg)' }}>
            <p className="overline mb-4">Error 404</p>
            <h1 className="font-display text-section font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>Page Not Found</h1>
            <p className="text-sm mb-8" style={{ color: 'var(--color-text-secondary)' }}>You do not have permission to view this resource.</p>
            <Link to="/admin/dashboard" className="btn btn-primary btn-md">Back to Dashboard</Link>
          </div>
        } />
      </Routes>
    </HashRouter>
  );
};

// ─── Sidebar Link ─────────────────────────────────────────────────────────────
const SidebarLink: React.FC<{
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  badge?: string;
}> = ({ to, icon, label, collapsed, badge }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-panel text-sm font-medium transition-all duration-150 ${
        collapsed ? 'justify-center' : ''
      } ${
        isActive
          ? 'sidebar-link active'
          : 'sidebar-link'
      }`}
    >
      <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 16, height: 16 }}>
        {icon}
      </span>

      {!collapsed && (
        <span className="flex-1 flex items-center justify-between min-w-0">
          <span className="truncate">{label}</span>
          {badge && (
            <span className="ml-2 px-1.5 py-0.5 rounded-chip text-[9px] font-bold uppercase tracking-wider flex-shrink-0"
              style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
              {badge}
            </span>
          )}
        </span>
      )}

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div
          className="absolute left-full ml-3 px-3 py-1.5 rounded-panel text-xs font-medium whitespace-nowrap pointer-events-none z-50
            opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0
            transition-all duration-150 shadow-dropdown animate-fade-in"
          style={{ backgroundColor: '#18181b', color: '#e4e4e7', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {label}
          {badge && <span className="ml-1.5 text-[9px] font-bold uppercase" style={{ color: '#a5b4fc' }}>{badge}</span>}
        </div>
      )}
    </Link>
  );
};

// ─── Mobile Nav Item ──────────────────────────────────────────────────────────
const MobileNavItem: React.FC<{ to: string; icon: React.ReactNode; label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center flex-1 min-w-0 py-2 gap-0.5 transition-all duration-150"
      style={{ color: isActive ? '#6366F1' : '#71717a' }}
    >
      <span className="flex items-center justify-center" style={{ width: 18, height: 18 }}>{icon}</span>
      <span className="text-[9px] font-semibold uppercase tracking-tight truncate max-w-full" style={{ fontFamily: 'var(--font-body)' }}>
        {label}
      </span>
    </Link>
  );
};

export default App;
