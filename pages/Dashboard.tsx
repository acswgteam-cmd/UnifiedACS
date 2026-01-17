
import React, { useMemo, useState } from 'react';
import { AppState, WorkContext, ArtworkLog, Project, Lead } from '../types';
import DateRangePicker from '../components/DateRangePicker';

interface Props {
  state: AppState;
}

const Dashboard: React.FC<Props> = ({ state }) => {
  const [filterStart, setFilterStart] = useState<string>('');
  const [filterEnd, setFilterEnd] = useState<string>('');
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const analytics = useMemo(() => {
    const { artworkLogs, projects, leads, designers, departments } = state;

    const filteredLogs = artworkLogs.filter(log => {
      const startMatch = !filterStart || log.start_date >= filterStart;
      const endMatch = !filterEnd || log.start_date <= filterEnd;
      return startMatch && endMatch;
    });

    const totalArtworks = filteredLogs.length;
    const totalProjects = projects.length; 
    const totalLeads = leads.length;

    const countByContext = (ctx: WorkContext) => filteredLogs.filter(l => l.work_context === ctx).length;
    const artworksProject = countByContext(WorkContext.PROJECT);
    const artworksLead = countByContext(WorkContext.LEAD);
    const artworksInternal = countByContext(WorkContext.INTERNAL);

    // Global Splits for Pie Charts
    const globalTypeSplit = [
      { type: "2D Design", count: filteredLogs.filter(l => l.artwork_type === "2D Design").length, color: "#3b82f6" },
      { type: "3D Design", count: filteredLogs.filter(l => l.artwork_type === "3D Design").length, color: "#10b981" },
      { type: "Video", count: filteredLogs.filter(l => l.artwork_type === "Video").length, color: "#f97316" }
    ];

    const globalContextSplit = [
      { context: "Project", count: artworksProject, color: "#2563eb" },
      { context: "Lead", count: artworksLead, color: "#059669" },
      { context: "Internal", count: artworksInternal, color: "#7c3aed" }
    ];

    const calcAvgDuration = (ctx: WorkContext) => {
      const logs = filteredLogs.filter(l => l.work_context === ctx && l.end_date);
      if (!logs.length) return "0.0";
      const totalDays = logs.reduce((acc, l) => {
        const start = new Date(l.start_date);
        const end = new Date(l.end_date!);
        const diff = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
        return acc + diff;
      }, 0);
      return (totalDays / logs.length).toFixed(1);
    };

    const types = ["2D Design", "3D Design", "Video"];
    const getContextTypeSplit = (ctx: WorkContext) => {
      const contextLogs = filteredLogs.filter(l => l.work_context === ctx);
      const total = contextLogs.length;
      return types.map(t => {
        const actualCount = contextLogs.filter(l => l.artwork_type === t).length;
        return {
          type: t,
          count: actualCount,
          percentage: total ? Math.round((actualCount / total) * 100) : 0
        };
      });
    };

    const getMonthlyTrends = () => {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const trends = [];
      const now = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = `${monthNames[d.getMonth()]}`;
        
        const monthLogs = artworkLogs.filter(l => l.start_date.startsWith(monthKey));
        
        trends.push({
          label,
          "2D Design": monthLogs.filter(l => l.artwork_type === "2D Design").length,
          "3D Design": monthLogs.filter(l => l.artwork_type === "3D Design").length,
          "Video": monthLogs.filter(l => l.artwork_type === "Video").length,
          [WorkContext.PROJECT]: monthLogs.filter(l => l.work_context === WorkContext.PROJECT).length,
          [WorkContext.LEAD]: monthLogs.filter(l => l.work_context === WorkContext.LEAD).length,
          [WorkContext.INTERNAL]: monthLogs.filter(l => l.work_context === WorkContext.INTERNAL).length,
        });
      }
      return trends;
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

    const teamStats = designers.map(d => {
      const logs = filteredLogs.filter(l => l.pic_designer_id === d.id);
      const uniqueProjects = new Set(logs.filter(l => l.work_context === WorkContext.PROJECT).map(l => l.project_id)).size;
      const uniqueLeads = new Set(logs.filter(l => l.work_context === WorkContext.LEAD).map(l => l.lead_id)).size;
      const completedLogs = logs.filter(l => l.end_date);
      const totalDays = completedLogs.reduce((acc, l) => {
        const start = new Date(l.start_date);
        const end = new Date(l.end_date!);
        const diff = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
        return acc + diff;
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
      teamStats, departmentStats,
      globalTypeSplit, globalContextSplit,
      monthlyTrends: getMonthlyTrends(),
      avgDurProj: calcAvgDuration(WorkContext.PROJECT),
      avgDurLead: calcAvgDuration(WorkContext.LEAD),
      avgDurInt: calcAvgDuration(WorkContext.INTERNAL),
      projectTypeSplit: getContextTypeSplit(WorkContext.PROJECT),
      leadTypeSplit: getContextTypeSplit(WorkContext.LEAD),
      internalTypeSplit: getContextTypeSplit(WorkContext.INTERNAL),
    };
  }, [state, filterStart, filterEnd]);

  const cardClass = "bg-white p-7 rounded-3xl border border-slate-200 shadow-sm flex flex-col transition-all hover:shadow-md";
  const labelClass = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block";

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Executive Studio Hub</h1>
          <p className="text-slate-500 text-sm mt-1 font-bold">Tracking creative production for ACS Operations.</p>
        </div>
        <div>
          <DateRangePicker 
            onChange={(start, end) => { setFilterStart(start); setFilterEnd(end); }}
            onReset={() => { setFilterStart(''); setFilterEnd(''); }}
          />
        </div>
      </header>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard label="Total Artworks Produced" value={analytics.totalArtworks} sub="Production Output" color="border-indigo-600" />
        <KPICard label="Active Event Projects" value={analytics.totalProjects} sub="Managed Timelines" color="border-blue-600" />
        <KPICard label="New Service Inquiries" value={analytics.totalLeads} sub="Inbound Requests" color="border-emerald-600" />
      </div>

      {/* Detail Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ContextMetricsCard title="Project" count={analytics.artworksProject} duration={analytics.avgDurProj} typeSplit={analytics.projectTypeSplit} accentColor="bg-blue-600" lightColor="bg-blue-50" textColor="text-blue-700" />
        <ContextMetricsCard title="Lead" count={analytics.artworksLead} duration={analytics.avgDurLead} typeSplit={analytics.leadTypeSplit} accentColor="bg-emerald-600" lightColor="bg-emerald-50" textColor="text-emerald-700" />
        <ContextMetricsCard title="Internal" count={analytics.artworksInternal} duration={analytics.avgDurInt} typeSplit={analytics.internalTypeSplit} accentColor="bg-purple-600" lightColor="bg-purple-50" textColor="text-purple-700" />
      </div>

      {/* TOP ROW: TREND & DISTRIBUTION (SYMMETRIC) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className={`${cardClass} lg:col-span-8 h-[450px]`}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className={labelClass}>Production Velocity</span>
              <h2 className="text-xl font-black text-slate-900 uppercase">Artwork Type Trend</h2>
            </div>
            <div className="flex gap-4">
               <LegendItem label="2D" color="bg-blue-500" />
               <LegendItem label="3D" color="bg-emerald-500" />
               <LegendItem label="VIDEO" color="bg-orange-500" />
            </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            <TrendLineChart 
              data={analytics.monthlyTrends} 
              keys={["2D Design", "3D Design", "Video"]} 
              colors={["#3b82f6", "#10b981", "#f97316"]} 
            />
          </div>
        </section>

        <section className={`${cardClass} lg:col-span-4 h-[450px]`}>
          <div className="mb-6">
            <span className={labelClass}>Composition</span>
            <h2 className="text-xl font-black text-slate-900 uppercase">Distribution Split</h2>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-12">
            {/* Pie Chart 1: Types */}
            <div className="flex items-center gap-8 group">
              <div className="w-32 h-32 flex-shrink-0 relative">
                <SimplePieChart data={analytics.globalTypeSplit} total={analytics.totalArtworks} />
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Artwork Types</p>
                {analytics.globalTypeSplit.map(t => (
                  <div key={t.type} className="flex items-center justify-between gap-6 group/item">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: t.color }}></div>
                      <span className="text-[11px] font-black text-slate-700 uppercase">{t.type}</span>
                    </div>
                    <span className="text-[11px] font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                      {analytics.totalArtworks ? Math.round((t.count/analytics.totalArtworks)*100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* Pie Chart 2: Contexts */}
            <div className="flex items-center gap-8 group">
              <div className="w-32 h-32 flex-shrink-0 relative">
                <SimplePieChart data={analytics.globalContextSplit.map(c => ({ count: c.count, color: c.color }))} total={analytics.totalArtworks} />
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Work Contexts</p>
                {analytics.globalContextSplit.map(c => (
                  <div key={c.context} className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: c.color }}></div>
                      <span className="text-[11px] font-black text-slate-700 uppercase">{c.context}</span>
                    </div>
                    <span className="text-[11px] font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                      {analytics.totalArtworks ? Math.round((c.count/analytics.totalArtworks)*100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* BOTTOM ROW: CONTEXT TREND & DEPT REQUEST (SYMMETRIC) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className={`${cardClass} h-[450px]`}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className={labelClass}>Operational Flow</span>
              <h2 className="text-xl font-black text-slate-900 uppercase">Work Context Trend</h2>
            </div>
            <div className="flex gap-4">
               <LegendItem label="PROJECT" color="bg-blue-600" />
               <LegendItem label="LEAD" color="bg-emerald-600" />
               <LegendItem label="INTERNAL" color="bg-purple-600" />
            </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            <TrendLineChart 
              data={analytics.monthlyTrends} 
              keys={[WorkContext.PROJECT, WorkContext.LEAD, WorkContext.INTERNAL]} 
              colors={["#2563eb", "#059669", "#7c3aed"]} 
            />
          </div>
        </section>

        <section className={`${cardClass} h-[450px]`}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className={labelClass}>Department Demand</span>
              <h2 className="text-xl font-black text-slate-900 uppercase">Department Request</h2>
            </div>
            <div className="flex gap-4">
               <LegendItem label="2D DESIGN" color="bg-blue-500" />
               <LegendItem label="3D DESIGN" color="bg-emerald-500" />
               <LegendItem label="VIDEO" color="bg-orange-500" />
            </div>
          </div>
          <div className="space-y-6 overflow-y-auto pr-2 py-2 flex-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {analytics.departmentStats.map(dept => {
              const deptTotal = dept.counts.total || 1;
              const globalMax = Math.max(...analytics.departmentStats.map(d => d.counts.total)) || 1;
              return (
                <div key={dept.id} className="grid grid-cols-1 md:grid-cols-4 items-center gap-4 group/row pt-2">
                  <div className="md:col-span-1">
                    <h4 className="text-sm font-black text-slate-800 leading-tight uppercase tracking-tighter">{dept.department_name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{dept.counts.total} Artworks</p>
                  </div>
                  <div className="md:col-span-3 flex items-center gap-4">
                    <div className="flex-1 h-10 bg-slate-50 rounded-xl flex border border-slate-100 shadow-inner relative overflow-hidden">
                      <StackedSegment count={dept.counts["2D Design"]} total={deptTotal} globalMax={globalMax} color="bg-blue-500" label="2D DESIGN" />
                      <StackedSegment count={dept.counts["3D Design"]} total={deptTotal} globalMax={globalMax} color="bg-emerald-500" label="3D DESIGN" />
                      <StackedSegment count={dept.counts["Video"]} total={deptTotal} globalMax={globalMax} color="bg-orange-500" label="VIDEO" />
                    </div>
                    <span className="text-[11px] font-black text-slate-600 w-10 text-right">
                      {dept.counts.total > 0 ? `${Math.round((dept.counts.total / (analytics.totalArtworks || 1)) * 100)}%` : '0%'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Designer Talent Profile */}
      <div>
        <span className={labelClass}>Creative Talent Performance</span>
        <div className="flex overflow-x-auto flex-nowrap gap-6 mt-4 pb-8 snap-x scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          {analytics.teamStats.map(ds => (
            <div key={ds.id} className="flex-shrink-0 w-[380px] snap-start bg-white p-7 rounded-3xl border border-slate-200 hover:shadow-xl transition-all group">
              <div className="flex items-center gap-5 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-2xl shadow-lg group-hover:bg-indigo-600 transition-colors">
                  {ds.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-lg font-black text-slate-900 truncate tracking-tight uppercase">{ds.name}</h4>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest truncate">{ds.role}</p>
                </div>
              </div>

              {/* Enhanced Designer Mini Cards */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <DesignerMiniCard label="Events" value={ds.uniqueProjects} bg="bg-blue-50" color="text-blue-700" borderColor="border-blue-100" />
                <DesignerMiniCard label="Inquiries" value={ds.uniqueLeads} bg="bg-emerald-50" color="text-emerald-700" borderColor="border-emerald-100" />
                <DesignerMiniCard label="Avg Turn" value={ds.avgDuration} unit="d" bg="bg-amber-50" color="text-amber-700" borderColor="border-amber-100" />
              </div>

              <div className="space-y-3 pt-5 border-t border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Production Breakdown</span>
                <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-tighter">Project Production</span>
                  <span className="text-sm font-black text-slate-900">{ds.projectArtworks}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-tighter">Lead Responses</span>
                  <span className="text-sm font-black text-slate-900">{ds.leadArtworks}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-tighter">Internal Support</span>
                  <span className="text-sm font-black text-slate-900">{ds.internalArtworks}</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Total Output</span>
                <span className="text-3xl font-black text-indigo-600 tracking-tighter">{ds.totalArtworks} <span className="text-[11px] font-bold text-slate-400 ml-1">ARTWORKS</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SimplePieChart = ({ data, total }: { data: { count: number, color: string }[], total: number }) => {
  let cumulative = 0;
  const segments = data.map(item => {
    const percentage = total > 0 ? (item.count / total) * 100 : 0;
    const start = cumulative;
    cumulative += percentage;
    return `${item.color} ${start}% ${cumulative}%`;
  });

  return (
    <div 
      className="w-full h-full rounded-full shadow-lg border-4 border-white relative group/pie transition-transform hover:scale-105" 
      style={{ background: `conic-gradient(${segments.join(', ')})` }}
    >
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/pie:opacity-100 transition-opacity bg-white/90 rounded-full z-10 pointer-events-none p-4 text-center">
         <span className="text-[11px] font-black text-slate-900 uppercase leading-tight tracking-tighter">Global<br/>Production<br/>Metrics</span>
      </div>
    </div>
  );
};

const TrendLineChart = ({ data, keys, colors }: { data: any[], keys: string[], colors: string[] }) => {
  const width = 600;
  const height = 300;
  const padding = 45;
  
  const maxValue = useMemo(() => {
    return Math.max(...data.flatMap(d => keys.map(k => d[k])), 5);
  }, [data, keys]);

  const getY = (val: number) => height - padding - (val / maxValue) * (height - padding * 2);
  const getX = (idx: number) => padding + (idx / (data.length - 1)) * (width - padding * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
      {[0, 0.25, 0.5, 0.75, 1].map(p => (
        <line 
          key={p}
          x1={padding} y1={getY(maxValue * p)} 
          x2={width - padding} y2={getY(maxValue * p)} 
          stroke="#f1f5f9" strokeWidth="1.5" strokeDasharray="6 4"
        />
      ))}

      {keys.map((key, kIdx) => {
        const points = data.map((d, i) => `${getX(i)},${getY(d[key])}`).join(" ");
        return (
          <g key={key}>
            <polyline
              points={points}
              fill="none"
              stroke={colors[kIdx]}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-700"
            />
            {data.map((d, i) => (
              <g key={i} className="group/dot">
                <circle
                  cx={getX(i)}
                  cy={getY(d[key])}
                  r="6"
                  fill="white"
                  stroke={colors[kIdx]}
                  strokeWidth="3.5"
                  className="transition-all cursor-pointer hover:r-[9]"
                />
                <text
                  x={getX(i)}
                  y={getY(d[key]) - 16}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="900"
                  fill={colors[kIdx]}
                  className="opacity-0 group-hover/dot:opacity-100 transition-opacity drop-shadow-sm"
                >
                  {d[key]}
                </text>
                {/* Visual Label for high points or end points */}
                {(d[key] > (maxValue * 0.3) || i === data.length - 1) && (
                   <text x={getX(i)} y={getY(d[key]) - 16} textAnchor="middle" fontSize="10" fontWeight="900" fill={colors[kIdx]}>{d[key]}</text>
                )}
              </g>
            ))}
          </g>
        );
      })}

      {data.map((d, i) => (
        <text
          key={i}
          x={getX(i)}
          y={height - 12}
          textAnchor="middle"
          fontSize="11"
          fontWeight="800"
          className="fill-slate-400 uppercase tracking-widest"
        >
          {d.label}
        </text>
      ))}
    </svg>
  );
};

const KPICard = ({ label, value, sub, color }: { label: string, value: number, sub: string, color: string }) => (
  <div className={`bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-center border-l-[10px] ${color} transition-all hover:scale-[1.02] hover:shadow-lg`}>
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">{label}</span>
    <div className="text-5xl font-black text-slate-900 tracking-tighter">{value}</div>
    <div className="text-[11px] font-bold text-slate-400 mt-3 uppercase tracking-tight">{sub}</div>
  </div>
);

const ContextMetricsCard: React.FC<{ title: string; count: number; duration: string; typeSplit: any[]; accentColor: string; lightColor: string; textColor: string; }> = ({ title, count, duration, typeSplit, accentColor, lightColor, textColor }) => (
  <div className="bg-white p-7 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col transition-all hover:shadow-lg">
    <div className="flex items-center justify-between mb-6">
      <h3 className={`text-[11px] font-black uppercase tracking-widest ${textColor}`}>{title} Context</h3>
      <div className={`${lightColor} ${textColor} px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border border-white`}>Volume</div>
    </div>
    <div className="grid grid-cols-2 gap-4 mb-8">
      <div><div className="text-3xl font-black text-slate-900">{count}</div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Artworks</div></div>
      <div className="border-l border-slate-100 pl-5"><div className="text-2xl font-black text-slate-900 leading-tight">~{duration}</div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Avg Days</div></div>
    </div>
    <div className="space-y-4 mt-auto">
      {typeSplit.map(t => (
        <div key={t.type}>
          <div className="flex justify-between text-[10px] font-black text-slate-600 uppercase mb-2 tracking-tighter"><span>{t.type}</span><span>{t.percentage}%</span></div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner"><div className={`h-full ${accentColor} transition-all duration-1000`} style={{ width: `${t.percentage}%` }}></div></div>
        </div>
      ))}
    </div>
  </div>
);

const StackedSegment = ({ count, total, globalMax, color, label }: { count: number, total: number, globalMax: number, color: string, label: string }) => {
  if (count === 0) return null;
  const percentageOfDept = Math.round((count / total) * 100);
  return (
    <div 
      className={`h-full ${color} transition-all duration-700 relative group/segment cursor-pointer hover:brightness-110`} 
      style={{ width: `${(count / globalMax) * 100}%` }}
    >
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-4 py-3 rounded-2xl opacity-0 group-hover/segment:opacity-100 whitespace-nowrap z-[100] pointer-events-none shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
        <div className="flex flex-col items-center">
          <span className="opacity-60 text-[8px] uppercase tracking-widest mb-1 font-black">{label}</span>
          <span className="text-sm font-black tracking-tight">{count} <span className="text-[10px] opacity-60">UNITS</span> &bull; {percentageOfDept}%</span>
        </div>
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45 border-r border-b border-slate-700"></div>
      </div>
    </div>
  );
};

const DesignerMiniCard = ({ label, value, unit, bg, color, borderColor }: { label: string, value: any, unit?: string, bg: string, color: string, borderColor: string }) => (
  <div className={`flex flex-col items-center justify-center p-5 rounded-3xl ${bg} border ${borderColor} shadow-sm transition-all hover:scale-[1.05] hover:shadow-md`}>
    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</span>
    <div className={`text-3xl font-black leading-none tracking-tighter ${color}`}>
      {value}<span className="text-xs font-black ml-0.5 opacity-50">{unit}</span>
    </div>
  </div>
);

const LegendItem = ({ label, color }: { label: string, color: string }) => (
  <div className="flex items-center gap-2.5"><div className={`w-3.5 h-3.5 rounded-full ${color} shadow-sm`}></div><span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{label}</span></div>
);

export default Dashboard;
