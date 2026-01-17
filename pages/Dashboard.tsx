
import React, { useMemo, useState } from 'react';
import { AppState, WorkContext, ArtworkLog, Project, Lead } from '../types';
import DateRangePicker from '../components/DateRangePicker';

interface Props {
  state: AppState;
}

const Dashboard: React.FC<Props> = ({ state }) => {
  const [filterStart, setFilterStart] = useState<string>('');
  const [filterEnd, setFilterEnd] = useState<string>('');

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

    const getContextTypeSplit = (ctx: WorkContext) => {
      const contextLogs = filteredLogs.filter(l => l.work_context === ctx);
      const total = contextLogs.length;
      return ["2D Design", "3D Design", "Video"].map(t => {
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
        const monthLogs = artworkLogs.filter(l => l.start_date.startsWith(monthKey));
        trends.push({
          label: monthNames[d.getMonth()],
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
      return {
        ...dept,
        counts: {
          "2D Design": logs.filter(l => l.artwork_type === "2D Design").length,
          "3D Design": logs.filter(l => l.artwork_type === "3D Design").length,
          "Video": logs.filter(l => l.artwork_type === "Video").length,
          total: logs.length
        }
      };
    }).sort((a, b) => b.counts.total - a.counts.total);

    const teamStats = designers.map(d => {
      const logs = filteredLogs.filter(l => l.pic_designer_id === d.id);
      const uniqueProjects = new Set(logs.filter(l => l.work_context === WorkContext.PROJECT).map(l => l.project_id)).size;
      const uniqueLeads = new Set(logs.filter(l => l.work_context === WorkContext.LEAD).map(l => l.lead_id)).size;
      const completedLogs = logs.filter(l => l.end_date);
      const totalDays = completedLogs.reduce((acc, l) => {
        const start = new Date(l.start_date);
        const end = new Date(l.end_date!);
        return acc + (Math.max(0, (end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);
      }, 0);
      return {
        ...d,
        projectArtworks: logs.filter(l => l.work_context === WorkContext.PROJECT).length,
        leadArtworks: logs.filter(l => l.work_context === WorkContext.LEAD).length,
        internalArtworks: logs.filter(l => l.work_context === WorkContext.INTERNAL).length,
        totalArtworks: logs.length,
        uniqueProjects,
        uniqueLeads,
        avgDuration: completedLogs.length ? (totalDays / completedLogs.length).toFixed(1) : "0.0"
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

  const cardClass = "bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col";
  const labelClass = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Executive Studio Hub</h1>
          <p className="text-slate-500 text-sm font-bold">Creative Ops Production Tracking.</p>
        </div>
        <DateRangePicker 
          onChange={(start, end) => { setFilterStart(start); setFilterEnd(end); }}
          onReset={() => { setFilterStart(''); setFilterEnd(''); }}
        />
      </header>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard label="Total Artworks" value={analytics.totalArtworks} sub="Production Yield" color="border-indigo-600" />
        <KPICard label="Active Projects" value={analytics.totalProjects} sub="MICE & Events" color="border-blue-600" />
        <KPICard label="Active Leads" value={analytics.totalLeads} sub="Service Inquiries" color="border-emerald-600" />
      </div>

      {/* Row 1: Context Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ContextMetricsCard title="Project" count={analytics.artworksProject} duration={analytics.avgDurProj} typeSplit={analytics.projectTypeSplit} accentColor="bg-blue-600" lightColor="bg-blue-50" textColor="text-blue-700" />
        <ContextMetricsCard title="Lead" count={analytics.artworksLead} duration={analytics.avgDurLead} typeSplit={analytics.leadTypeSplit} accentColor="bg-emerald-600" lightColor="bg-emerald-50" textColor="text-emerald-700" />
        <ContextMetricsCard title="Internal" count={analytics.artworksInternal} duration={analytics.avgDurInt} typeSplit={analytics.internalTypeSplit} accentColor="bg-purple-600" lightColor="bg-purple-50" textColor="text-purple-700" />
      </div>

      {/* Row 2: Symmetric Trend & Pie Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className={`${cardClass} lg:col-span-8 min-h-[400px]`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className={labelClass}>Production Velocity</span>
              <h2 className="text-lg font-black text-slate-900 uppercase">Artwork Type Trend</h2>
            </div>
            <div className="flex gap-3">
               <LegendItem label="2D" color="bg-blue-500" />
               <LegendItem label="3D" color="bg-emerald-500" />
               <LegendItem label="VIDEO" color="bg-orange-500" />
            </div>
          </div>
          <div className="flex-1 w-full overflow-hidden">
            <TrendLineChart 
              data={analytics.monthlyTrends} 
              keys={["2D Design", "3D Design", "Video"]} 
              colors={["#3b82f6", "#10b981", "#f97316"]} 
            />
          </div>
        </section>

        <section className={`${cardClass} lg:col-span-4 min-h-[400px]`}>
          <div className="mb-6">
            <span className={labelClass}>Composition</span>
            <h2 className="text-lg font-black text-slate-900 uppercase">Distribution Split</h2>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-8">
            <PieChartWithLegend 
              title="Artwork Types" 
              data={analytics.globalTypeSplit} 
              total={analytics.totalArtworks} 
            />
            <div className="h-px bg-slate-100"></div>
            <PieChartWithLegend 
              title="Work Contexts" 
              data={analytics.globalContextSplit.map(c => ({ count: c.count, color: c.color, type: c.context }))} 
              total={analytics.totalArtworks} 
            />
          </div>
        </section>
      </div>

      {/* Row 3: Symmetric Context Trend & Depts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <section className={`${cardClass} min-h-[400px]`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className={labelClass}>Operational Flow</span>
              <h2 className="text-lg font-black text-slate-900 uppercase">Work Context Trend</h2>
            </div>
            <div className="flex gap-3">
               <LegendItem label="PROJECT" color="bg-blue-600" />
               <LegendItem label="LEAD" color="bg-emerald-600" />
               <LegendItem label="INTERNAL" color="bg-purple-600" />
            </div>
          </div>
          <div className="flex-1 w-full overflow-hidden">
            <TrendLineChart 
              data={analytics.monthlyTrends} 
              keys={[WorkContext.PROJECT, WorkContext.LEAD, WorkContext.INTERNAL]} 
              colors={["#2563eb", "#059669", "#7c3aed"]} 
            />
          </div>
        </section>

        <section className={`${cardClass} min-h-[400px]`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className={labelClass}>Department Demand</span>
              <h2 className="text-lg font-black text-slate-900 uppercase">Department Requests</h2>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 pr-2">
            {analytics.departmentStats.map(dept => {
              const deptTotal = dept.counts.total || 0;
              const globalMax = Math.max(...analytics.departmentStats.map(d => d.counts.total)) || 1;
              return (
                <div key={dept.id} className="mb-4">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-[11px] font-black text-slate-700 uppercase">{dept.department_name}</span>
                    <span className="text-[10px] font-bold text-slate-400">{deptTotal} Artworks</span>
                  </div>
                  <div className="h-4 bg-slate-50 rounded-md flex border border-slate-100 overflow-hidden relative">
                    <StackedSegment count={dept.counts["2D Design"]} total={deptTotal} globalMax={globalMax} color="bg-blue-500" label="2D" />
                    <StackedSegment count={dept.counts["3D Design"]} total={deptTotal} globalMax={globalMax} color="bg-emerald-500" label="3D" />
                    <StackedSegment count={dept.counts["Video"]} total={deptTotal} globalMax={globalMax} color="bg-orange-500" label="VIDEO" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Row 4: Designer Cards */}
      <div>
        <span className={labelClass}>Creative Talent Performance</span>
        <div className="flex overflow-x-auto flex-nowrap gap-6 mt-4 pb-4 snap-x scrollbar-thin scrollbar-thumb-slate-300">
          {analytics.teamStats.map(ds => (
            <div key={ds.id} className="flex-shrink-0 w-[340px] snap-start bg-white p-6 rounded-3xl border border-slate-200 hover:shadow-lg transition-all group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-md group-hover:bg-indigo-600 transition-colors">
                  {ds.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-black text-slate-900 truncate uppercase tracking-tighter">{ds.name}</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{ds.role}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-6">
                <DesignerMiniCard label="Events" value={ds.uniqueProjects} bg="bg-blue-50" color="text-blue-700" />
                <DesignerMiniCard label="Inquiry" value={ds.uniqueLeads} bg="bg-emerald-50" color="text-emerald-700" />
                <DesignerMiniCard label="Avg" value={ds.avgDuration} unit="d" bg="bg-indigo-50" color="text-indigo-700" />
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Artwork Production</span>
                <StatRow label="Project" value={ds.projectArtworks} color="text-blue-800" bg="bg-blue-50/50" />
                <StatRow label="Lead" value={ds.leadArtworks} color="text-emerald-800" bg="bg-emerald-50/50" />
                <StatRow label="Internal" value={ds.internalArtworks} color="text-purple-800" bg="bg-purple-50/50" />
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[11px] font-black text-slate-900 uppercase">Total Items</span>
                <span className="text-2xl font-black text-indigo-600 tracking-tighter">{ds.totalArtworks}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Sub-Components ---

const PieChartWithLegend = ({ title, data, total }: { title: string, data: any[], total: number }) => (
  <div className="flex items-center gap-6 group">
    <div className="w-24 h-24 flex-shrink-0 relative">
      <SimplePieChart data={data} total={total} />
    </div>
    <div className="flex-1 space-y-1.5">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{title}</p>
      {data.map(item => (
        <div key={item.type || item.context} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
            <span className="text-[10px] font-black text-slate-700 uppercase truncate">{item.type || item.context}</span>
          </div>
          <span className="text-[10px] font-black text-slate-900 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
            {total ? Math.round((item.count / total) * 100) : 0}%
          </span>
        </div>
      ))}
    </div>
  </div>
);

const SimplePieChart = ({ data, total }: { data: any[], total: number }) => {
  let cumulative = 0;
  const segments = data.map(item => {
    const percentage = total > 0 ? (item.count / total) * 100 : 0;
    const start = cumulative;
    cumulative += percentage;
    return `${item.color} ${start}% ${cumulative}%`;
  });

  return (
    <div 
      className="w-full h-full rounded-full shadow-md border-4 border-white relative group/pie" 
      style={{ background: `conic-gradient(${segments.join(', ')})` }}
    >
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/pie:opacity-100 transition-opacity bg-white/95 rounded-full z-10 pointer-events-none p-2 text-center">
         <span className="text-[9px] font-black text-slate-900 uppercase leading-none">Global<br/>Stats</span>
      </div>
    </div>
  );
};

const TrendLineChart = ({ data, keys, colors }: { data: any[], keys: string[], colors: string[] }) => {
  const width = 600;
  const height = 240;
  const padding = 40;
  
  const maxValue = useMemo(() => {
    return Math.max(...data.flatMap(d => keys.map(k => d[k])), 5);
  }, [data, keys]);

  const getY = (val: number) => height - padding - (val / maxValue) * (height - padding * 2);
  const getX = (idx: number) => padding + (idx / (data.length - 1)) * (width - padding * 2);

  return (
    <svg 
      viewBox={`0 0 ${width} ${height}`} 
      className="w-full h-full" 
      preserveAspectRatio="xMidYMid meet"
    >
      {[0, 0.25, 0.5, 0.75, 1].map(p => (
        <line 
          key={p}
          x1={padding} y1={getY(maxValue * p)} 
          x2={width - padding} y2={getY(maxValue * p)} 
          stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4"
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
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-700"
            />
            {data.map((d, i) => (
              <g key={i} className="group/dot">
                <circle
                  cx={getX(i)}
                  cy={getY(d[key])}
                  r="5"
                  fill="white"
                  stroke={colors[kIdx]}
                  strokeWidth="3"
                />
                <text
                  x={getX(i)}
                  y={getY(d[key]) - 14}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="900"
                  fill={colors[kIdx]}
                  className="opacity-0 group-hover/dot:opacity-100 transition-opacity"
                >
                  {d[key]}
                </text>
                {/* Always show latest value */}
                {i === data.length - 1 && (
                   <text x={getX(i)} y={getY(d[key]) - 14} textAnchor="middle" fontSize="10" fontWeight="900" fill={colors[kIdx]}>{d[key]}</text>
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
          y={height - 10}
          textAnchor="middle"
          fontSize="10"
          fontWeight="800"
          className="fill-slate-400 uppercase tracking-tighter"
        >
          {d.label}
        </text>
      ))}
    </svg>
  );
};

const KPICard = ({ label, value, sub, color }: { label: string, value: number, sub: string, color: string }) => (
  <div className={`bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center border-l-8 ${color}`}>
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{label}</span>
    <div className="text-4xl font-black text-slate-900 tracking-tighter">{value}</div>
    <div className="text-[10px] font-bold text-slate-400 mt-2 uppercase">{sub}</div>
  </div>
);

const ContextMetricsCard: React.FC<{ title: string; count: number; duration: string; typeSplit: any[]; accentColor: string; lightColor: string; textColor: string; }> = ({ title, count, duration, typeSplit, accentColor, lightColor, textColor }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col transition-all hover:shadow-md">
    <div className="flex items-center justify-between mb-4">
      <h3 className={`text-xs font-black uppercase tracking-wider ${textColor}`}>{title} Context</h3>
      <div className={`${lightColor} ${textColor} px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest`}>Flow</div>
    </div>
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div><div className="text-3xl font-black text-slate-900">{count}</div><div className="text-[10px] font-bold text-slate-400 uppercase">Artworks</div></div>
      <div className="border-l border-slate-100 pl-4"><div className="text-2xl font-black text-slate-900 leading-tight">~{duration}</div><div className="text-[10px] font-bold text-slate-400 uppercase">Avg Days</div></div>
    </div>
    <div className="space-y-3 mt-auto">
      {typeSplit.map(t => (
        <div key={t.type}>
          <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase mb-1.5 tracking-tighter"><span>{t.type}</span><span>{t.percentage}%</span></div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${accentColor}`} style={{ width: `${t.percentage}%` }}></div></div>
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
      className={`h-full ${color} transition-all duration-700 relative group/segment cursor-help hover:brightness-110`} 
      style={{ width: `${(count / globalMax) * 100}%` }}
    >
      <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-3 py-2.5 rounded-xl opacity-0 group-hover/segment:opacity-100 whitespace-nowrap z-[100] pointer-events-none shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex flex-col items-center">
          <span className="opacity-70 text-[8px] uppercase tracking-widest mb-0.5 font-black">{label}</span>
          <span className="text-xs font-black">{count} <span className="text-[9px] opacity-60">UNITS</span> &bull; {percentageOfDept}%</span>
        </div>
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45"></div>
      </div>
    </div>
  );
};

const DesignerMiniCard = ({ label, value, unit, bg, color }: { label: string, value: any, unit?: string, bg: string, color: string }) => (
  <div className={`flex flex-col items-center justify-center p-3.5 rounded-2xl ${bg} border border-white shadow-sm transition-transform hover:scale-[1.05]`}>
    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</span>
    <div className={`text-2xl font-black leading-none tracking-tighter ${color}`}>
      {value}<span className="text-xs font-bold ml-0.5 opacity-60">{unit}</span>
    </div>
  </div>
);

const StatRow = ({ label, value, color, bg }: { label: string, value: number, color: string, bg: string }) => (
  <div className={`flex justify-between items-center ${bg} p-2 rounded-xl border border-slate-100/50`}>
    <span className={`text-[10px] font-black uppercase tracking-tighter ${color}`}>{label} Production</span>
    <span className="text-xs font-black text-slate-900">{value}</span>
  </div>
);

const LegendItem = ({ label, color }: { label: string, color: string }) => (
  <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${color}`}></div><span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{label}</span></div>
);

export default Dashboard;
