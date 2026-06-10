
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AppState, ArtworkLog } from './types';
import { ThemeProvider, useTheme } from './lib/ThemeContext';
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
import {
  Dashboard as DashboardIcon,
  Palette,
  Building,
  Group,
  Folder,
  UserPlus,
  TaskList,
  Reports,
  NavArrowLeft,
  NavArrowRight,
  SunLight,
  HalfMoon
} from 'iconoir-react';

const IconDashboard = () => <DashboardIcon width="16" height="16" />;
const IconArtwork = () => <Palette width="16" height="16" />;
const IconDept = () => <Building width="16" height="16" />;
const IconTeam = () => <Group width="16" height="16" />;
const IconProject = () => <Folder width="16" height="16" />;
const IconLead = () => <UserPlus width="16" height="16" />;
const IconInternal = () => <TaskList width="16" height="16" />;
const IconReport = () => <Reports width="16" height="16" />;
const IconChevronLeft = () => <NavArrowLeft width="16" height="16" />;
const IconChevronRight = () => <NavArrowRight width="16" height="16" />;

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
    <ThemeProvider>
    <HashRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/portal/v1/inquiry/:token" element={<PublicLeadForm onHostSubmit={() => fetchData()} currentLeads={state.leads} />} />
        <Route path="/portal/v1/internal/:token" element={<PublicInternalForm onHostSubmit={() => fetchData()} departments={state.departments} />} />
        <Route path="/portal/v1/survey/:token"   element={<PublicProjectSurvey />} />

        {/* Admin layout */}
        <Route path="/admin/*" element={
          <div className="flex flex-col md:flex-row h-screen overflow-hidden pb-[72px] md:pb-0" style={{ backgroundColor: 'var(--color-canvas)' }}>
            {/* Loading bar */}
            {loading && <div className="progress-bar" />}

            {/* — Desktop Sidebar — */}
            <aside
              className={`hidden md:flex flex-col flex-shrink-0 h-full transition-all duration-300 sidebar ${collapsed ? 'w-[64px]' : 'w-[220px]'}`}
            >
              {/* Logo */}
              <div className={`flex items-center h-[48px] px-3 border-b ${collapsed ? 'justify-center' : 'justify-between'}`} style={{ borderColor: 'var(--color-hl)' }}>
                {!collapsed && (
                  <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="ACS Logo" className="w-5 h-5 rounded-full object-contain" />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: 'var(--color-ink)', letterSpacing: '-0.02em' }}>ACS Unified</span>
                  </div>
                )}
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  className="flex items-center justify-center w-6 h-6 rounded transition-colors btn-icon"
                  title={collapsed ? 'Expand' : 'Collapse'}
                >
                  {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
                </button>
              </div>

              {/* Nav */}
              <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto scrollbar-hide overflow-x-visible">
                <SidebarLink to="/admin/dashboard" icon={<IconDashboard />} label="Dashboard" collapsed={collapsed} />
                <SidebarLink to="/admin/reports"   icon={<IconReport />}    label="Report Gen" collapsed={collapsed} badge="BETA" />
                <SidebarLink to="/admin/artwork-logs" icon={<IconArtwork />} label="Artwork Logs" collapsed={collapsed} />


                {!collapsed && (
                  <p className="overline px-3 pt-5 pb-2">Master Data</p>
                )}
                {collapsed && <div className="my-3 mx-2 border-t" style={{ borderColor: 'var(--color-hl)' }} />}

                <SidebarLink to="/admin/masters/departments" icon={<IconDept />}     label="Departments"    collapsed={collapsed} />
                <SidebarLink to="/admin/masters/designers"   icon={<IconTeam />}     label="Designers"      collapsed={collapsed} />
                <SidebarLink to="/admin/masters/projects"    icon={<IconProject />}  label="Projects"       collapsed={collapsed} />
                <SidebarLink to="/admin/masters/leads"       icon={<IconLead />}     label="Leads"          collapsed={collapsed} />
                <SidebarLink to="/admin/masters/internal"    icon={<IconInternal />} label="Internal Tasks" collapsed={collapsed} />
              </nav>

              {/* Sidebar footer */}
              <div className={`px-3 py-3 border-t ${collapsed ? 'flex flex-col items-center gap-2' : 'flex items-center justify-between'}`} style={{ borderColor: 'var(--color-hl)' }}>
                {!collapsed && (
                  <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-4)' }}>
                    ACS Unified · v1.0
                  </p>
                )}
                <ThemeToggleButton collapsed={collapsed} />
              </div>
            </aside>

            {/* — Main content — */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Top bar (mobile logo + desktop right area) */}
              <header className="nav-top px-4 md:px-6 md:hidden">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="ACS Logo" className="w-6 h-6 rounded-full object-contain" />
                  <span className="font-display font-bold text-sm tracking-tight" style={{ color: 'var(--color-text-primary)' }}>ACS Unified</span>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--color-canvas)' }}>
                <div className="p-4 md:p-6">
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

            <nav
              className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around items-stretch h-[60px] z-[100] border-t"
              style={{ backgroundColor: 'rgba(1,1,2,0.95)', backdropFilter: 'blur(16px)', borderColor: 'var(--color-hl)' }}
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
    </ThemeProvider>
  );
};

/* ── Theme Toggle Button ── */
const IconSun = () => <SunLight width="15" height="15" />;
const IconMoon = () => <HalfMoon width="15" height="15" />;

const ThemeToggleButton: React.FC<{ collapsed: boolean }> = ({ collapsed }) => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      id="theme-toggle-btn"
      onClick={toggleTheme}
      className="theme-toggle"
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{ width: collapsed ? 32 : 32 }}
    >
      {theme === 'dark' ? <IconSun /> : <IconMoon />}
    </button>
  );
};

const SidebarLink: React.FC<{
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  badge?: string;
}> = ({ to, icon, label, collapsed, badge }) => {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/');

  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={`group relative flex items-center gap-2.5 px-2.5 py-1.5 text-sm font-medium transition-all duration-100 sidebar-link ${
        collapsed ? 'justify-center' : ''
      } ${
        isActive ? 'active' : ''
      }`}
    >
      <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 15, height: 15, opacity: isActive ? 1 : 0.7 }}>
        {icon}
      </span>

      {!collapsed && (
        <span className="flex-1 flex items-center justify-between min-w-0">
          <span className="truncate">{label}</span>
          {badge && (
            <span
              className="ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider flex-shrink-0"
              style={{ borderRadius: 3, backgroundColor: 'var(--color-primary-dim)', color: 'var(--color-primary)' }}
            >
              {badge}
            </span>
          )}
        </span>
      )}

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div
          className="absolute left-full ml-3 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap pointer-events-none z-50
            opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0
            transition-all duration-100"
          style={{ backgroundColor: 'var(--color-s3)', color: 'var(--color-ink)', border: '1px solid var(--color-hl-strong)', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
        >
          {label}
          {badge && <span className="ml-1.5 text-[9px] font-bold uppercase" style={{ color: 'var(--color-primary)' }}>{badge}</span>}
        </div>
      )}
    </Link>
  );
};

const MobileNavItem: React.FC<{ to: string; icon: React.ReactNode; label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center flex-1 min-w-0 py-2 gap-0.5 transition-all duration-150"
      style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-ink-4)' }}
    >
      <span className="flex items-center justify-center" style={{ width: 18, height: 18 }}>{icon}</span>
      <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-body)' }}>
        {label}
      </span>
    </Link>
  );
};

export default App;
