
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

    const calcAvgDuration = (ctx: WorkContext) => {
      const logs = filteredLogs.filter(l => l.work_context === ctx && l.end_date);
      if (!logs.length) return "0.0";
      const totalDays = logs.reduce((acc, l) => {
        const start = new Date(l.start_date);
        const end = new Date(l.end_date!);
        // Adding +1 so same-day completion counts as 1 day
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

    // Monthly Trend Logic (Last 6 Months)
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
        // Adding +1 so same-day completion counts as 1 day
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
      monthlyTrends: getMonthlyTrends(),
      avgDurProj: calcAvgDuration(WorkContext.PROJECT),
      avgDurLead: calcAvgDuration(WorkContext.LEAD),
      avgDurInt: calcAvgDuration(WorkContext.INTERNAL),
      projectTypeSplit: getContextTypeSplit(WorkContext.PROJECT),
      leadTypeSplit: getContextTypeSplit(WorkContext.LEAD),
      internalTypeSplit: getContextTypeSplit(WorkContext.INTERNAL),
    };
  }, [state, filterStart, filterEnd]);

  const cardClass = "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm";
  const labelClass = "text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block";

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Studio Hub</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Tracking production for ACS Creative Operations.</p>
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
        <ContextMetricsCard title="Project" count={analytics.artworksProject} duration={analytics.avgDurProj} typeSplit={analytics.projectTypeSplit} accentColor="bg-blue-600" lightColor="bg-blue-50" textColor="text-blue-700" />
        <ContextMetricsCard title="Lead" count={analytics.artworksLead} duration={analytics.avgDurLead} typeSplit={analytics.leadTypeSplit} accentColor="bg-emerald-600" lightColor="bg-emerald-50" textColor="text-emerald-700" />
        <ContextMetricsCard title="Internal" count={analytics.artworksInternal} duration={analytics.avgDurInt} typeSplit={analytics.internalTypeSplit} accentColor="bg-purple-600" lightColor="bg-purple-50" textColor="text-purple-700" />
      </div>

      {/* NEW LINE CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className={cardClass}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className={labelClass}>Production Velocity</span>
              <h2 className="text-xl font-bold text-slate-900">Artwork Type Trend</h2>
            </div>
            <div className="flex gap-4">
               <LegendItem label="2D" color="bg-blue-500" />
               <LegendItem label="3D" color="bg-emerald-500" />
               <LegendItem label="VIDEO" color="bg-orange-500" />
            </div>
          </div>
          <div className="h-64 w-full">
            <TrendLineChart 
              data={analytics.monthlyTrends} 
              keys={["2D Design", "3D Design", "Video"]} 
              colors={["#3b82f6", "#10b981", "#f97316"]} 
            />
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className={labelClass}>Operational Flow</span>
              <h2 className="text-xl font-bold text-slate-900">Work Context Trend</h2>
            </div>
            <div className="flex gap-4">
               <LegendItem label="PROJECT" color="bg-blue-600" />
               <LegendItem label="LEAD" color="bg-emerald-600" />
               <LegendItem label="INTERNAL" color="bg-purple-600" />
            </div>
          </div>
          <div className="h-64 w-full">
            <TrendLineChart 
              data={analytics.monthlyTrends} 
              keys={[WorkContext.PROJECT, WorkContext.LEAD, WorkContext.INTERNAL]} 
              colors={["#2563eb", "#059669", "#7c3aed"]} 
            />
          </div>
        </section>
      </div>

      <section className={cardClass}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className={labelClass}>Department Demand</span>
            <h2 className="text-xl font-bold text-slate-900">Department request</h2>
          </div>
          <div className="flex gap-4">
             <LegendItem label="2D DESIGN" color="bg-blue-500" />
             <LegendItem label="3D DESIGN" color="bg-emerald-500" />
             <LegendItem label="VIDEO" color="bg-orange-500" />
          </div>
        </div>
        <div className="space-y-6 overflow-y-auto max-h-[400px] pr-2 py-4">
          {analytics.departmentStats.map(dept => {
            const deptTotal = dept.counts.total || 1;
            const globalMax = Math.max(...analytics.departmentStats.map(d => d.counts.total)) || 1;
            
            return (
              <div key={dept.id} className="grid grid-cols-1 md:grid-cols-4 items-center gap-4 group/row pt-2">
                <div className="md:col-span-1">
                  <h4 className="text-sm font-semibold text-slate-800 leading-tight">{dept.department_name}</h4>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">{dept.counts.total} Deliverables</p>
                </div>
                <div className="md:col-span-3 flex items-center gap-4">
                  <div className="flex-1 h-8 bg-slate-50 rounded-lg flex border border-slate-100 shadow-inner relative">
                    <StackedSegment 
                      count={dept.counts["2D Design"]} 
                      total={deptTotal}
                      globalMax={globalMax} 
                      color="bg-blue-500" 
                      label="2D DESIGN" 
                    />
                    <StackedSegment 
                      count={dept.counts["3D Design"]} 
                      total={deptTotal}
                      globalMax={globalMax} 
                      color="bg-emerald-500" 
                      label="3D DESIGN" 
                    />
                    <StackedSegment 
                      count={dept.counts["Video"]} 
                      total={deptTotal}
                      globalMax={globalMax} 
                      color="bg-orange-500" 
                      label="VIDEO" 
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 w-10 text-right">
                    {dept.counts.total > 0 ? `${Math.round((dept.counts.total / (analytics.totalArtworks || 1)) * 100)}%` : '0%'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div>
        <span className={labelClass}>Creative Talent Performance</span>
        <div className="flex overflow-x-auto flex-nowrap gap-6 mt-4 pb-8 snap-x scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          {analytics.teamStats.map(ds => (
            <div key={ds.id} className="flex-shrink-0 w-[360px] snap-start bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-xl transition-all group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-md group-hover:bg-indigo-600 transition-colors">
                  {ds.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-bold text-slate-900 truncate tracking-tight">{ds.name}</h4>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest truncate">{ds.role}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <DesignerMiniStat label="Managed Events" value={ds.uniqueProjects} unit="Projects" bg="bg-blue-50" color="text-blue-700" />
                <DesignerMiniStat label="Direct Inquiries" value={ds.uniqueLeads} unit="Leads" bg="bg-emerald-50" color="text-emerald-700" />
                <DesignerMiniStat label="Avg Turnaround" value={ds.avgDuration} unit="Days" bg="bg-slate-50" color="text-slate-900" />
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Production Breakdown</span>
                <div className="flex justify-between items-center bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-tighter">Project Assets</span>
                  <span className="text-xs font-bold text-blue-900">{ds.projectArtworks}</span>
                </div>
                <div className="flex justify-between items-center bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-tighter">Lead Assets</span>
                  <span className="text-xs font-bold text-emerald-900">{ds.leadArtworks}</span>
                </div>
                <div className="flex justify-between items-center bg-purple-50/50 p-2 rounded-lg border border-purple-100">
                  <span className="text-[10px] font-bold text-purple-800 uppercase tracking-tighter">Internal Assets</span>
                  <span className="text-xs font-bold text-purple-900">{ds.internalArtworks}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">Total Output</span>
                <span className="text-xl font-bold text-indigo-600">{ds.totalArtworks} <span className="text-[10px] font-medium text-slate-400">Items</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// HELPER COMPONENTS FOR VISUALIZATION

const TrendLineChart = ({ data, keys, colors }: { data: any[], keys: string[], colors: string[] }) => {
  const width = 500;
  const height = 200;
  const padding = 30;
  
  const maxValue = useMemo(() => {
    return Math.max(...data.flatMap(d => keys.map(k => d[k])), 5);
  }, [data, keys]);

  const getY = (val: number) => height - padding - (val / maxValue) * (height - padding * 2);
  const getX = (idx: number) => padding + (idx / (data.length - 1)) * (width - padding * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
      {/* Grid Lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(p => (
        <line 
          key={p}
          x1={padding} y1={getY(maxValue * p)} 
          x2={width - padding} y2={getY(maxValue * p)} 
          stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4"
        />
      ))}

      {/* Lines & Points */}
      {keys.map((key, kIdx) => {
        const points = data.map((d, i) => `${getX(i)},${getY(d[key])}`).join(" ");
        return (
          <g key={key}>
            <polyline
              points={points}
              fill="none"
              stroke={colors[kIdx]}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-700"
            />
            {data.map((d, i) => (
              <circle
                key={i}
                cx={getX(i)}
                cy={getY(d[key])}
                r="4"
                fill="white"
                stroke={colors[kIdx]}
                strokeWidth="2"
              />
            ))}
          </g>
        );
      })}

      {/* X Axis Labels */}
      {data.map((d, i) => (
        <text
          key={i}
          x={getX(i)}
          y={height - 5}
          textAnchor="middle"
          fontSize="10"
          className="fill-slate-400 font-bold uppercase tracking-tighter"
        >
          {d.label}
        </text>
      ))}
    </svg>
  );
};

const KPICard = ({ label, value, sub, color }: { label: string, value: number, sub: string, color: string }) => (
  <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center border-l-4 ${color}`}>
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{label}</span>
    <div className="text-3xl font-bold text-slate-900">{value}</div>
    <div className="text-[10px] font-semibold text-slate-400 mt-2 uppercase tracking-tight">{sub}</div>
  </div>
);

const ContextMetricsCard: React.FC<{ title: string; count: number; duration: string; typeSplit: any[]; accentColor: string; lightColor: string; textColor: string; }> = ({ title, count, duration, typeSplit, accentColor, lightColor, textColor }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
    <div className="flex items-center justify-between mb-4">
      <h3 className={`text-sm font-bold uppercase tracking-wider ${textColor}`}>{title}</h3>
      <div className={`${lightColor} ${textColor} px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest`}>Throughput</div>
    </div>
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div><div className="text-2xl font-bold text-slate-900">{count}</div><div className="text-[9px] font-semibold text-slate-400 uppercase">Assets</div></div>
      <div className="border-l border-slate-100 pl-4"><div className="text-xl font-bold text-slate-900 leading-tight">~{duration}</div><div className="text-[9px] font-semibold text-slate-400 uppercase">Avg Days</div></div>
    </div>
    <div className="space-y-3 mt-auto">
      {typeSplit.map(t => (
        <div key={t.type}>
          <div className="flex justify-between text-[9px] font-semibold text-slate-600 uppercase mb-1"><span>{t.type}</span><span>{t.percentage}%</span></div>
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${accentColor}`} style={{ width: `${t.percentage}%` }}></div></div>
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
      className={`h-full ${color} transition-all duration-700 relative group/segment cursor-help hover:brightness-110 first:rounded-l last:rounded-r`} 
      style={{ width: `${(count / globalMax) * 100}%` }}
    >
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-3 py-2 rounded-lg opacity-0 group-hover/segment:opacity-100 whitespace-nowrap z-[100] pointer-events-none shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex flex-col items-center">
          <span className="opacity-70 text-[8px] uppercase tracking-widest mb-0.5">{label}</span>
          <span className="text-xs">{count} <span className="text-[10px] opacity-70">Units</span> &bull; {percentageOfDept}%</span>
        </div>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-slate-700"></div>
      </div>
    </div>
  );
};

const DesignerMiniStat = ({ label, value, unit, bg, color }: { label: string, value: any, unit: string, bg: string, color: string }) => (
  <div className={`flex justify-between items-center p-2 rounded-lg ${bg}`}>
    <span className="text-[10px] font-semibold text-slate-600 uppercase">{label}</span>
    <span className={`text-xs font-bold ${color}`}>{value} {unit}</span>
  </div>
);

const LegendItem = ({ label, color }: { label: string, color: string }) => (
  <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${color}`}></div><span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{label}</span></div>
);

export default Dashboard;
