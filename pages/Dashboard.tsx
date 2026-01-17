
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
      { type: "Project", count: artworksProject, color: "#2563eb" },
      { type: "Lead", count: artworksLead, color: "#059669" },
      { type: "Internal", count: artworksInternal, color: "#7c3aed" }
    ];

    const calcAvgDuration = (ctx: WorkContext) => {
      const logs = filteredLogs.filter(l => l.work_context === ctx && l.end_date);
      if (!logs.length) return "0.0";
      const totalDays = logs.reduce((acc, l) => {
        const start = new Date(l.start_date);
        const end = new Date(l.end_date!);
        return acc + (Math.max(0, (end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);
      }, 0);
      return (totalDays / logs.length).toFixed(1);
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
      projectTypeSplit: ["2D Design", "3D Design", "Video"].map(t => ({
        type: t,
        percentage: artworksProject ? Math.round((filteredLogs.filter(l => l.work_context === WorkContext.PROJECT && l.artwork_type === t).length / artworksProject) * 100) : 0
      })),
      leadTypeSplit: ["2D Design", "3D Design", "Video"].map(t => ({
        type: t,
        percentage: artworksLead ? Math.round((filteredLogs.filter(l => l.work_context === WorkContext.LEAD && l.artwork_type === t).length / artworksLead) * 100) : 0
      })),
      internalTypeSplit: ["2D Design", "3D Design", "Video"].map(t => ({
        type: t,
        percentage: artworksInternal ? Math.round((filteredLogs.filter(l => l.work_context === WorkContext.INTERNAL && l.artwork_type === t).length / artworksInternal) * 100) : 0
      })),
    };
  }, [state, filterStart, filterEnd]);

  const cardClass = "bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col transition-all hover:shadow-md";
  const labelClass = "text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">Executive Studio Hub</h1>
          <p className="text-slate-500 text-sm font-medium">Monitoring Creative Operations & Production.</p>
        </div>
        <DateRangePicker 
          onChange={(start, end) => { setFilterStart(start); setFilterEnd(end); }}
          onReset={() => { setFilterStart(''); setFilterEnd(''); }}
        />
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard label="Total Artworks" value={analytics.totalArtworks} sub="Production Output" color="border-indigo-600" />
        <KPICard label="Active Projects" value={analytics.totalProjects} sub="Managed Timelines" color="border-blue-600" />
        <KPICard label="Active Leads" value={analytics.totalLeads} sub="Service Inquiries" color="border-emerald-600" />
      </div>

      {/* Context Volume Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <VolumeCard title="Project" count={analytics.artworksProject} duration={analytics.avgDurProj} typeSplit={analytics.projectTypeSplit} color="blue" />
        <VolumeCard title="Lead" count={analytics.artworksLead} duration={analytics.avgDurLead} typeSplit={analytics.leadTypeSplit} color="emerald" />
        <VolumeCard title="Internal" count={analytics.artworksInternal} duration={analytics.avgDurInt} typeSplit={analytics.internalTypeSplit} color="purple" />
      </div>

      {/* MAIN ROW: 3 CHARTS IN ONE LINE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend 1: Type */}
        <section className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase">Artwork Type Trend</h2>
            <div className="flex gap-2">
               <div className="w-2 h-2 rounded-full bg-blue-500"></div>
               <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
               <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            </div>
          </div>
          <div className="h-[220px] w-full">
            <TrendLineChart data={analytics.monthlyTrends} keys={["2D Design", "3D Design", "Video"]} colors={["#3b82f6", "#10b981", "#f97316"]} />
          </div>
        </section>

        {/* Trend 2: Context */}
        <section className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase">Work Context Trend</h2>
            <div className="flex gap-2">
               <div className="w-2 h-2 rounded-full bg-blue-600"></div>
               <div className="w-2 h-2 rounded-full bg-emerald-600"></div>
               <div className="w-2 h-2 rounded-full bg-purple-600"></div>
            </div>
          </div>
          <div className="h-[220px] w-full">
            <TrendLineChart data={analytics.monthlyTrends} keys={[WorkContext.PROJECT, WorkContext.LEAD, WorkContext.INTERNAL]} colors={["#2563eb", "#059669", "#7c3aed"]} />
          </div>
        </section>

        {/* Composition: Pie Charts */}
        <section className={cardClass}>
          <h2 className="text-sm font-bold text-slate-900 uppercase mb-4">Distribution Split</h2>
          <div className="flex flex-col gap-6">
            <PieRow title="By Type" data={analytics.globalTypeSplit} total={analytics.totalArtworks} />
            <div className="h-px bg-slate-100"></div>
            <PieRow title="By Context" data={analytics.globalContextSplit} total={analytics.totalArtworks} />
          </div>
        </section>
      </div>

      {/* Department Request Section */}
      <section className={cardClass}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase">Department Request Volume</h2>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Demand</span>
        </div>
        <div className="max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
          <div className="space-y-5">
            {analytics.departmentStats.map(dept => {
              const deptTotal = dept.counts.total || 0;
              const globalMax = Math.max(...analytics.departmentStats.map(d => d.counts.total)) || 1;
              return (
                <div key={dept.id} className="grid grid-cols-4 items-center gap-4">
                  <div className="col-span-1">
                    <p className="text-xs font-bold text-slate-800 uppercase leading-tight truncate">{dept.department_name}</p>
                    <p className="text-[9px] font-medium text-slate-400 uppercase">{deptTotal} Artworks</p>
                  </div>
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="flex-1 h-3 bg-slate-50 rounded-full flex border border-slate-100 overflow-hidden">
                      <StackedSegment count={dept.counts["2D Design"]} total={deptTotal} globalMax={globalMax} color="bg-blue-500" />
                      <StackedSegment count={dept.counts["3D Design"]} total={deptTotal} globalMax={globalMax} color="bg-emerald-500" />
                      <StackedSegment count={dept.counts["Video"]} total={deptTotal} globalMax={globalMax} color="bg-orange-500" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 w-8 text-right">
                      {analytics.totalArtworks ? Math.round((deptTotal / analytics.totalArtworks) * 100) : 0}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Designer Performance */}
      <div className="pt-2">
        <span className={labelClass}>Team Output Performance</span>
        <div className="flex overflow-x-auto flex-nowrap gap-6 mt-4 pb-4 snap-x scrollbar-thin scrollbar-thumb-slate-300">
          {analytics.teamStats.map(ds => (
            <div key={ds.id} className="flex-shrink-0 w-[320px] snap-start bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg group-hover:bg-indigo-600 transition-colors">
                  {ds.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate uppercase">{ds.name}</h4>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{ds.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-6">
                <DesignerMetric label="Event" value={ds.uniqueProjects} color="text-blue-700" bg="bg-blue-50" />
                <DesignerMetric label="Lead" value={ds.uniqueLeads} color="text-emerald-700" bg="bg-emerald-50" />
                <DesignerMetric label="Avg" value={ds.avgDuration} unit="d" color="text-indigo-700" bg="bg-indigo-50" />
              </div>
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <StatBar label="Project" value={ds.projectArtworks} max={ds.totalArtworks} color="bg-blue-500" />
                <StatBar label="Lead" value={ds.leadArtworks} max={ds.totalArtworks} color="bg-emerald-500" />
                <StatBar label="Internal" value={ds.internalArtworks} max={ds.totalArtworks} color="bg-purple-500" />
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-900 uppercase">Total Items</span>
                <span className="text-xl font-bold text-indigo-600 tracking-tighter">{ds.totalArtworks}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Smaller Clean Sub-Components ---

const KPICard = ({ label, value, sub, color }: any) => (
  <div className={`bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-l-8 ${color}`}>
    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{label}</span>
    <div className="text-3xl font-bold text-slate-900 tracking-tight">{value}</div>
    <p className="text-[10px] font-medium text-slate-400 uppercase mt-1">{sub}</p>
  </div>
);

const VolumeCard = ({ title, count, duration, typeSplit, color }: any) => {
  const colors: any = {
    blue: "text-blue-700 bg-blue-50 border-blue-100 bg-blue-600",
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-100 bg-emerald-600",
    purple: "text-purple-700 bg-purple-50 border-purple-100 bg-purple-600",
  };
  const parts = colors[color].split(' ');
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className={`text-xs font-bold uppercase tracking-wider ${parts[0]}`}>{title} Context</h3>
        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${parts[1]} ${parts[0]}`}>Volume</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-5">
        <div><div className="text-2xl font-bold text-slate-900">{count}</div><div className="text-[9px] font-bold text-slate-400 uppercase">Artworks</div></div>
        <div className="border-l border-slate-100 pl-4"><div className="text-xl font-bold text-slate-900">~{duration}</div><div className="text-[9px] font-bold text-slate-400 uppercase">Avg Days</div></div>
      </div>
      <div className="space-y-2 mt-auto">
        {typeSplit.map((t:any) => (
          <div key={t.type}>
            <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase mb-0.5"><span>{t.type}</span><span>{t.percentage}%</span></div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${parts[3]}`} style={{ width: `${t.percentage}%` }}></div></div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PieRow = ({ title, data, total }: any) => (
  <div className="flex items-center gap-4">
    <div className="w-16 h-16 rounded-full shadow-inner border-2 border-white relative flex-shrink-0" 
      style={{ background: `conic-gradient(${data.map((d:any, i:number) => {
        const percentage = total ? (d.count / total) * 100 : 0;
        const start = data.slice(0, i).reduce((acc:any, curr:any) => acc + (total ? (curr.count / total) * 100 : 0), 0);
        return `${d.color} ${start}% ${start + percentage}%`;
      }).join(', ')})` }}
    ></div>
    <div className="flex-1 space-y-1">
      <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">{title}</p>
      {data.map((d:any) => (
        <div key={d.type || d.context} className="flex justify-between items-center text-[10px] font-bold text-slate-700">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div><span className="uppercase truncate max-w-[80px]">{d.type || d.context}</span></div>
          <span className="text-slate-400">{total ? Math.round((d.count / total) * 100) : 0}%</span>
        </div>
      ))}
    </div>
  </div>
);

const TrendLineChart = ({ data, keys, colors }: any) => {
  const width = 400; const height = 180; const padding = 30;
  const maxValue = Math.max(...data.flatMap((d:any) => keys.map((k:string) => d[k])), 5);
  const getY = (val: number) => height - padding - (val / maxValue) * (height - padding * 2);
  const getX = (idx: number) => padding + (idx / (data.length - 1)) * (width - padding * 2);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      {[0, 0.5, 1].map(p => <line key={p} x1={padding} y1={getY(maxValue * p)} x2={width - padding} y2={getY(maxValue * p)} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />)}
      {keys.map((key:string, kIdx:number) => (
        <polyline key={key} points={data.map((d:any, i:number) => `${getX(i)},${getY(d[key])}`).join(" ")} fill="none" stroke={colors[kIdx]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {data.map((d:any, i:number) => <text key={i} x={getX(i)} y={height - 8} textAnchor="middle" fontSize="9" fontWeight="bold" className="fill-slate-400 uppercase">{d.label}</text>)}
      {keys.map((key:string, kIdx:number) => (
        <g key={`vals-${key}`}>
          <circle cx={getX(data.length - 1)} cy={getY(data[data.length - 1][key])} r="4" fill="white" stroke={colors[kIdx]} strokeWidth="2" />
          <text x={getX(data.length - 1)} y={getY(data[data.length - 1][key]) - 10} textAnchor="middle" fontSize="9" fontWeight="bold" fill={colors[kIdx]}>{data[data.length - 1][key]}</text>
        </g>
      ))}
    </svg>
  );
};

const StackedSegment = ({ count, total, globalMax, color }: any) => {
  if (count === 0) return null;
  return <div className={`h-full ${color}`} style={{ width: `${(count / globalMax) * 100}%` }}></div>;
};

const DesignerMetric = ({ label, value, unit, color, bg }: any) => (
  <div className={`flex flex-col items-center justify-center p-2 rounded-xl ${bg} border border-white shadow-sm`}>
    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">{label}</span>
    <div className={`text-lg font-bold leading-none ${color}`}>{value}<span className="text-[10px] ml-0.5 opacity-60">{unit}</span></div>
  </div>
);

const StatBar = ({ label, value, max, color }: any) => (
  <div>
    <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase mb-1"><span>{label}</span><span>{value}</span></div>
    <div className="h-1 bg-slate-50 rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${(value / (max || 1)) * 100}%` }}></div></div>
  </div>
);

const LegendItem = ({ label, color }: any) => (
  <div className="flex items-center gap-1.5"><div className={`w-2.5 h-2.5 rounded-full ${color}`}></div><span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{label}</span></div>
);

export default Dashboard;
