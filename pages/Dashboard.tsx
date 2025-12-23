
import React, { useMemo, useState } from 'react';
import { AppState, WorkContext, ArtworkLog, Project, Lead } from '../types';
import DateRangePicker from '../components/DateRangePicker';

interface Props {
  state: AppState;
}

const Dashboard: React.FC<Props> = ({ state }) => {
  const [filterStart, setFilterStart] = useState<string>('');
  const [filterEnd, setFilterEnd] = useState<string>('');
  const [weekOffset, setWeekOffset] = useState(0);

  const getWeekDays = (offset: number) => {
    const today = new Date();
    const day = today.getDay(); 
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) + (offset * 7); 
    const startOfWeek = new Date(today.setDate(diff));
    
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
  };

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const analytics = useMemo(() => {
    const { artworkLogs, projects, leads, designers, departments } = state;

    const filteredLogs = artworkLogs.filter(log => {
      const startMatch = !filterStart || log.start_date >= filterStart;
      const endMatch = !filterEnd || log.start_date <= filterEnd;
      return startMatch && endMatch;
    });

    const filteredLeads = leads.filter(l => {
        const startMatch = !filterStart || l.order_date >= filterStart;
        const endMatch = !filterEnd || l.order_date <= filterEnd;
        return startMatch && endMatch;
    });

    const filteredProjects = projects.filter(p => {
        const startMatch = !filterStart || p.start_date >= filterStart;
        const endMatch = !filterEnd || p.start_date <= filterEnd;
        return startMatch && endMatch;
    });

    const totalArtworks = filteredLogs.length;
    const totalProjects = filteredProjects.length; 
    const totalLeads = filteredLeads.length;

    const countByContext = (ctx: WorkContext) => filteredLogs.filter(l => l.work_context === ctx).length;
    const artworksProject = countByContext(WorkContext.PROJECT);
    const artworksLead = countByContext(WorkContext.LEAD);
    const artworksInternal = countByContext(WorkContext.INTERNAL);

    const calcAvgDuration = (ctx: WorkContext) => {
      const logs = filteredLogs.filter(l => l.work_context === ctx && l.end_date);
      if (!logs.length) return "0.0";
      const totalDays = logs.reduce((acc, l) => {
        const start = new Date(l.start_date);
        const end = new Date(l.end_date!);
        const diff = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 3600 * 24));
        return acc + diff;
      }, 0);
      return (totalDays / logs.length).toFixed(1);
    };

    const calcAvgDesigners = (ctx: WorkContext, entities: (Project | Lead)[]) => {
      if (!entities.length) return "0.0";
      const designerCounts = entities.map(entity => {
        const logs = filteredLogs.filter(l => {
          if (ctx === WorkContext.PROJECT) return l.project_id === entity.id;
          if (ctx === WorkContext.LEAD) return l.lead_id === entity.id;
          return false;
        });
        return new Set(logs.map(l => l.pic_designer_id)).size;
      });
      const total = designerCounts.reduce((a, b) => a + b, 0);
      return (total / entities.length).toFixed(1);
    };

    const avgDesignersProj = calcAvgDesigners(WorkContext.PROJECT, filteredProjects);
    const avgDesignersLead = calcAvgDesigners(WorkContext.LEAD, filteredLeads);

    const types = ["2D Design", "3D Design", "Video"];
    const getContextTypeSplit = (ctx: WorkContext) => {
      const contextLogs = filteredLogs.filter(l => l.work_context === ctx);
      const total = contextLogs.length;
      return types.map(t => {
        const count = contextLogs.filter(l => l.artwork_type === t).length;
        return {
          type: t,
          count,
          percentage: total ? Math.round((count / total) * 100) : 0
        };
      });
    };

    const departmentStats = departments.map(dept => {
      const logs = filteredLogs.filter(l => l.department_id === dept.id);
      const counts = {
        "2D Design": logs.filter(l => l.artwork_type === "2D Design").length,
        "3D Design": logs.filter(l => l.artwork_type === "3D Design").length,
        "Video": logs.filter(l => l.artwork_type === "Video").length,
        total: logs.length
      };
      return { ...dept, counts };
    }).sort((a, b) => b.counts.total - a.counts.total);

    const getMonthKey = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const months = Array.from(new Set(filteredLogs.map(l => getMonthKey(l.start_date)))).sort();
    const lastMonths = months.length > 0 ? months.slice(-6) : [];

    const monthlyData = lastMonths.map(month => {
      const logs = filteredLogs.filter(l => getMonthKey(l.start_date) === month);
      return {
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
        project: logs.filter(l => l.work_context === WorkContext.PROJECT).length,
        lead: logs.filter(l => l.work_context === WorkContext.LEAD).length,
        internal: logs.filter(l => l.work_context === WorkContext.INTERNAL).length,
      };
    });

    const teamStats = designers.map(d => {
      const logs = filteredLogs.filter(l => l.pic_designer_id === d.id);
      const uniqueProjects = new Set(logs.filter(l => l.work_context === WorkContext.PROJECT).map(l => l.project_id)).size;
      const uniqueLeads = new Set(logs.filter(l => l.work_context === WorkContext.LEAD).map(l => l.lead_id)).size;
      const completedLogs = logs.filter(l => l.end_date);
      const totalDays = completedLogs.reduce((acc, l) => {
        const start = new Date(l.start_date);
        const end = new Date(l.end_date!);
        return acc + Math.max(0, (end.getTime() - start.getTime()) / (1000 * 3600 * 24));
      }, 0);
      const avgDuration = completedLogs.length ? (totalDays / completedLogs.length).toFixed(1) : "0.0";

      return {
        ...d,
        projectArtworks: logs.filter(l => l.work_context === WorkContext.PROJECT).length,
        leadArtworks: logs.filter(l => l.work_context === WorkContext.LEAD).length,
        internalArtworks: logs.filter(l => l.work_context === WorkContext.INTERNAL).length,
        totalArtworks: logs.length,
        uniqueProjects,
        uniqueLeads,
        avgDuration
      };
    }).sort((a, b) => b.totalArtworks - a.totalArtworks);

    return {
      totalArtworks, totalProjects, totalLeads,
      artworksProject, artworksLead, artworksInternal,
      monthlyData, teamStats, departmentStats,
      avgDurProj: calcAvgDuration(WorkContext.PROJECT),
      avgDurLead: calcAvgDuration(WorkContext.LEAD),
      avgDurInt: calcAvgDuration(WorkContext.INTERNAL),
      avgDesignersProj, avgDesignersLead,
      projectTypeSplit: getContextTypeSplit(WorkContext.PROJECT),
      leadTypeSplit: getContextTypeSplit(WorkContext.LEAD),
      internalTypeSplit: getContextTypeSplit(WorkContext.INTERNAL),
      typeDistribution: types.map(t => ({
        label: t,
        percentage: totalArtworks ? Math.round((filteredLogs.filter(l => l.artwork_type === t).length / totalArtworks) * 100) : 0
      }))
    };
  }, [state, filterStart, filterEnd]);

  const cardClass = "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm";
  const labelClass = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block";

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Executive Studio Hub</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Tracking production for MICE, Travel, and Creative Operations.</p>
        </div>

        <div>
          <DateRangePicker 
            onChange={(start, end) => { setFilterStart(start); setFilterEnd(end); }}
            onReset={() => { setFilterStart(''); setFilterEnd(''); }}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard label="Total Assets Produced" value={analytics.totalArtworks} sub="Production in range" color="border-indigo-600" />
        <KPICard label="Active Event Projects" value={analytics.totalProjects} sub="Contracted MICE Ops" color="border-blue-600" />
        <KPICard label="New Service Requests" value={analytics.totalLeads} sub="Inquiries & Inbounds" color="border-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ContextMetricsCard title="MICE & Gatherings" count={analytics.artworksProject} duration={analytics.avgDurProj} avgDesigners={analytics.avgDesignersProj} typeSplit={analytics.projectTypeSplit} accentColor="bg-blue-600" lightColor="bg-blue-50" textColor="text-blue-700" />
        <ContextMetricsCard title="Travel & Direct Briefs" count={analytics.artworksLead} duration={analytics.avgDurLead} avgDesigners={analytics.avgDesignersLead} typeSplit={analytics.leadTypeSplit} accentColor="bg-emerald-600" lightColor="bg-emerald-50" textColor="text-emerald-700" />
        <ContextMetricsCard title="Internal Studio Units" count={analytics.artworksInternal} duration={analytics.avgDurInt} typeSplit={analytics.internalTypeSplit} accentColor="bg-purple-600" lightColor="bg-purple-50" textColor="text-purple-700" />
      </div>

      <section className={cardClass}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className={labelClass}>Operational Visibility</span>
            <h2 className="text-lg font-black text-slate-900">Weekly Production Schedule</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekOffset(prev => prev - 1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button onClick={() => setWeekOffset(0)} className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-slate-100 rounded-lg text-slate-900">Current Week</button>
            <button onClick={() => setWeekOffset(prev => prev + 1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {weekDays.map(day => {
            const dateStr = formatDate(day);
            const isToday = dateStr === formatDate(new Date());
            const dayProjects = state.projects.filter(p => dateStr >= p.start_date && dateStr <= p.end_date);
            const dayLeads = state.leads.filter(l => dateStr === l.order_date || dateStr === l.deadline);
            return (
              <div key={dateStr} className={`rounded-xl border p-3 flex flex-col gap-2 min-h-[160px] ${isToday ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex flex-col mb-1">
                  <span className={`text-[10px] font-black uppercase ${isToday ? 'text-indigo-600' : 'text-slate-500'}`}>{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  <span className={`text-sm font-black ${isToday ? 'text-indigo-900' : 'text-slate-900'}`}>{day.getDate()} {day.toLocaleDateString('en-US', { month: 'short' })}</span>
                </div>
                <div className="space-y-1.5 overflow-y-auto max-h-[120px]">
                  {dayProjects.map(p => <div key={p.id} className="bg-blue-600 text-white text-[9px] font-black p-1.5 rounded-md shadow-sm truncate">Event: {p.project_name}</div>)}
                  {dayLeads.map(l => <div key={l.id} className={`text-white text-[9px] font-black p-1.5 rounded-md shadow-sm truncate ${dateStr === l.deadline ? 'bg-red-500' : 'bg-emerald-600'}`}>{dateStr === l.deadline ? 'DUE: ' : 'REQ: '}{l.lead_name}</div>)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className={labelClass}>Studio Utilization</span>
            <h2 className="text-xl font-black text-slate-900">Studio Unit Demand Breakdown</h2>
          </div>
          <div className="flex gap-4">
             <LegendItem label="2D Design" color="bg-indigo-600" />
             <LegendItem label="3D/Stage" color="bg-blue-600" />
             <LegendItem label="Motion/Video" color="bg-purple-600" />
          </div>
        </div>
        <div className="space-y-6 overflow-y-auto max-h-[400px] pr-2">
          {analytics.departmentStats.map(dept => {
            const maxTotal = Math.max(...analytics.departmentStats.map(d => d.counts.total)) || 1;
            return (
              <div key={dept.id} className="grid grid-cols-1 md:grid-cols-4 items-center gap-4 group">
                <div className="md:col-span-1">
                  <h4 className="text-sm font-black text-slate-800">{dept.department_name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{dept.counts.total} Deliverables</p>
                </div>
                <div className="md:col-span-3 flex items-center gap-4">
                  <div className="flex-1 h-8 bg-slate-50 rounded-lg overflow-hidden flex border border-slate-100 shadow-inner relative">
                    <StackedSegment count={dept.counts["2D Design"]} max={maxTotal} color="bg-indigo-600" label="2D" />
                    <StackedSegment count={dept.counts["3D Design"]} max={maxTotal} color="bg-blue-600" label="3D" />
                    <StackedSegment count={dept.counts["Video"]} max={maxTotal} color="bg-purple-600" label="Video" />
                  </div>
                  <span className="text-[10px] font-black text-slate-600 w-8 text-right">{dept.counts.total > 0 ? `${Math.round((dept.counts.total / analytics.totalArtworks) * 100)}%` : '0%'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div>
        <span className={labelClass}>Creative Talent Performance (Selected Period)</span>
        <div className="flex overflow-x-auto flex-nowrap gap-6 mt-4 pb-8 snap-x scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          {analytics.teamStats.map(ds => (
            <div key={ds.id} className="flex-shrink-0 w-[360px] snap-start bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-xl transition-all group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-md group-hover:bg-indigo-600 transition-colors">
                  {ds.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-black text-slate-900 truncate tracking-tight">{ds.name}</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate">{ds.role}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <DesignerMiniStat label="Managed Events" value={ds.uniqueProjects} unit="Projects" bg="bg-blue-50" color="text-blue-700" />
                <DesignerMiniStat label="Direct Inquiries" value={ds.uniqueLeads} unit="Leads" bg="bg-emerald-50" color="text-emerald-700" />
                <DesignerMiniStat label="Avg Turnaround" value={ds.avgDuration} unit="Days" bg="bg-slate-50" color="text-slate-900" />
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Production Breakdown</span>
                <div className="flex justify-between items-center bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                  <span className="text-[10px] font-black text-blue-800 uppercase tracking-tighter">Project Assets</span>
                  <span className="text-xs font-black text-blue-900">{ds.projectArtworks}</span>
                </div>
                <div className="flex justify-between items-center bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-tighter">Lead Assets</span>
                  <span className="text-xs font-black text-emerald-900">{ds.leadArtworks}</span>
                </div>
                <div className="flex justify-between items-center bg-purple-50/50 p-2 rounded-lg border border-purple-100">
                  <span className="text-[10px] font-black text-purple-800 uppercase tracking-tighter">Internal Assets</span>
                  <span className="text-xs font-black text-purple-900">{ds.internalArtworks}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Total Output</span>
                <span className="text-xl font-black text-indigo-600">{ds.totalArtworks} <span className="text-[10px] text-slate-400">Items</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Dashboard Component Helpers ---
const KPICard = ({ label, value, sub, color }: { label: string, value: number, sub: string, color: string }) => (
  <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center border-l-4 ${color}`}>
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{label}</span>
    <div className="text-4xl font-black text-slate-900">{value}</div>
    <div className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tight">{sub}</div>
  </div>
);

const ContextMetricsCard: React.FC<{ title: string; count: number; duration: string; avgDesigners?: string; typeSplit: any[]; accentColor: string; lightColor: string; textColor: string; }> = ({ title, count, duration, avgDesigners, typeSplit, accentColor, lightColor, textColor }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
    <div className="flex items-center justify-between mb-4">
      <h3 className={`text-sm font-black uppercase tracking-wider ${textColor}`}>{title}</h3>
      <div className={`${lightColor} ${textColor} px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest`}>Throughput</div>
    </div>
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div><div className="text-3xl font-black text-slate-900">{count}</div><div className="text-[9px] font-bold text-slate-400 uppercase">Assets</div></div>
      <div className="border-l border-slate-100 pl-4"><div className="text-2xl font-black text-slate-900 leading-tight">~{duration}</div><div className="text-[9px] font-bold text-slate-400 uppercase">Avg Days</div></div>
      {avgDesigners && <div className="col-span-2 mt-2 pt-2 border-t border-slate-50"><div className="text-lg font-black text-slate-800 leading-tight">~{avgDesigners}</div><div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Avg Creative Team Size</div></div>}
    </div>
    <div className="space-y-3 mt-auto">
      {typeSplit.map(t => (
        <div key={t.type}>
          <div className="flex justify-between text-[9px] font-bold text-slate-600 uppercase mb-1"><span>{t.type}</span><span>{t.percentage}%</span></div>
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${accentColor}`} style={{ width: `${t.percentage}%` }}></div></div>
        </div>
      ))}
    </div>
  </div>
);

const StackedSegment = ({ count, max, color, label }: { count: number, max: number, color: string, label: string }) => (
  <div className={`h-full ${color} transition-all duration-700 relative group/segment`} style={{ width: `${(count / max) * 100}%` }}>
    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded opacity-0 group-hover/segment:opacity-100 whitespace-nowrap z-20 pointer-events-none">{label}: {count}</div>
  </div>
);

const DesignerMiniStat = ({ label, value, unit, bg, color }: { label: string, value: any, unit: string, bg: string, color: string }) => (
  <div className={`flex justify-between items-center p-2 rounded-lg ${bg}`}>
    <span className="text-[10px] font-bold text-slate-600 uppercase">{label}</span>
    <span className={`text-xs font-black ${color}`}>{value} {unit}</span>
  </div>
);

const LegendItem = ({ label, color }: { label: string, color: string }) => (
  <div className="flex items-center gap-1.5"><div className={`w-2.5 h-2.5 rounded-full ${color}`}></div><span className="text-[10px] font-black text-slate-400 uppercase">{label}</span></div>
);

export default Dashboard;
