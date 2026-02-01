
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
    const { artworkLogs, projects, leads, designers, departments, internalDesigns, projectSurveys } = state;

    const filteredLogs = artworkLogs.filter(log => {
      const startMatch = !filterStart || log.start_date >= filterStart;
      const endMatch = !filterEnd || log.start_date <= filterEnd;
      return startMatch && endMatch;
    });

    const totalArtworks = filteredLogs.length;
    
    // --- Helper for Counting ---
    const getTopCounts = (items: any[], keyExtractor: (item: any) => string | string[], limit = 3) => {
      const counts: Record<string, number> = {};
      items.forEach(item => {
        const keyOrKeys = keyExtractor(item);
        const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
        keys.forEach(k => {
          if (k) counts[k] = (counts[k] || 0) + 1;
        });
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([label, count]) => ({ label, count }));
    };

    // --- Projects Stats (ALL Statuses) ---
    const allProjects = projects;
    const projectPICs = getTopCounts(allProjects, p => designers.find(d => d.id === p.pic_designer_id)?.name || 'Unknown');
    const projectLocs = getTopCounts(allProjects, p => (p as any).locations || (p as any).location || []);

    // --- Leads Stats (ALL Statuses) ---
    const allLeads = leads;
    const leadGrades = getTopCounts(allLeads, l => l.lead_grade);
    const leadRequesters = getTopCounts(allLeads, l => l.requester);

    // --- Internal Tasks Stats (ALL Statuses) ---
    const allInternal = internalDesigns;
    const internalDepts = getTopCounts(allInternal, t => departments.find(d => d.id === t.department_id)?.department_name || 'Unknown');
    const internalRequesters = getTopCounts(allInternal, t => t.requester_name);

    // --- Keyword Analysis Logic ---
    const wordCounts: Record<string, number> = {};
    filteredLogs.forEach(log => {
      if (!log.artwork_name) return;
      const firstWord = log.artwork_name.trim().split(/[\s-]+/)[0].toUpperCase();
      if (firstWord.length > 1) {
        wordCounts[firstWord] = (wordCounts[firstWord] || 0) + 1;
      }
    });

    const topKeywords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));
    // -----------------------------

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
      // Reverse loop to get past 6 months up to now
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthLogs = artworkLogs.filter(l => l.start_date.startsWith(monthKey));
        trends.push({
          label: monthNames[d.getMonth()],
          fullDate: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
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
    })
    .filter(d => d.counts.total > 0) // Filter out departments with 0 artworks
    .sort((a, b) => b.counts.total - a.counts.total);

    // --- TEAM EVALUATION LOGIC ---
    // Calculate average evaluation score for each designer
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

      // --- Survey Score Calculation ---
      // Find projects where this designer is PIC or Support
      const involvedProjectIds = projects.filter(p => 
        p.pic_designer_id === d.id || (p.support_designer_ids || []).includes(d.id)
      ).map(p => p.id);
      
      const relevantSurveys = projectSurveys.filter(s => involvedProjectIds.includes(s.project_id));
      
      let avgRatingStr = "N/A";
      
      if (relevantSurveys.length > 0) {
        let totalScoreSum = 0;
        relevantSurveys.forEach(survey => {
          // Average of the 7 questions (max 3)
          const sum7 = survey.rating_speed + survey.rating_quality + survey.rating_accuracy + 
                       survey.rating_coord_internal + survey.rating_coord_client + 
                       survey.rating_problem_solving + survey.rating_agility;
          totalScoreSum += (sum7 / 7);
        });
        avgRatingStr = (totalScoreSum / relevantSurveys.length).toFixed(1); // e.g. "2.8"
      }

      return {
        ...d,
        projectArtworks: logs.filter(l => l.work_context === WorkContext.PROJECT).length,
        leadArtworks: logs.filter(l => l.work_context === WorkContext.LEAD).length,
        internalArtworks: logs.filter(l => l.work_context === WorkContext.INTERNAL).length,
        totalArtworks: logs.length,
        uniqueProjects,
        uniqueLeads,
        avgDuration: completedLogs.length ? (totalDays / completedLogs.length).toFixed(1) : "0.0",
        avgRating: avgRatingStr
      };
    }).sort((a, b) => b.totalArtworks - a.totalArtworks);

    return {
      totalArtworks, 
      totalProjectsCount: allProjects.length,
      totalLeadsCount: allLeads.length,
      totalInternalCount: allInternal.length,
      artworksProject, artworksLead, artworksInternal,
      teamStats, departmentStats, topKeywords,
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
      // Stats for Cards (Based on All items)
      statsData: {
        projects: { pics: projectPICs, locs: projectLocs },
        leads: { grades: leadGrades, reqs: leadRequesters },
        internal: { depts: internalDepts, reqs: internalRequesters }
      }
    };
  }, [state, filterStart, filterEnd]);

  const cardClass = "bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col transition-all hover:shadow-md";
  const labelClass = "text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">Executive Studio Hub</h1>
          <p className="text-slate-500 text-sm font-medium">Creative Production Insights.</p>
        </div>
        <DateRangePicker 
          onChange={(start, end) => { setFilterStart(start); setFilterEnd(end); }}
          onReset={() => { setFilterStart(''); setFilterEnd(''); }}
        />
      </header>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <KPICard 
          label="Total Artworks" 
          value={analytics.totalArtworks} 
          sub="Filtered Output" 
          color="border-indigo-600"
          keywords={analytics.topKeywords}
        />
        <KPICard 
          label="Total Projects" 
          value={analytics.totalProjectsCount} 
          sub="All Statuses" 
          color="border-blue-600"
          statsList={[
            { title: "Top 3 PIC", items: analytics.statsData.projects.pics },
            { title: "Top 3 Locations", items: analytics.statsData.projects.locs }
          ]}
        />
        <KPICard 
          label="Total Leads" 
          value={analytics.totalLeadsCount} 
          sub="All Statuses" 
          color="border-emerald-600" 
          statsList={[
             { title: "By Grade", items: analytics.statsData.leads.grades },
             { title: "Top Requesters", items: analytics.statsData.leads.reqs }
          ]}
        />
        <KPICard 
          label="Total Tasks" 
          value={analytics.totalInternalCount} 
          sub="All Statuses" 
          color="border-purple-600" 
          statsList={[
             { title: "Top Depts", items: analytics.statsData.internal.depts },
             { title: "Top Requesters", items: analytics.statsData.internal.reqs }
          ]}
        />
      </div>

      {/* Volume Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <VolumeCard title="Project" count={analytics.artworksProject} duration={analytics.avgDurProj} typeSplit={analytics.projectTypeSplit} color="blue" />
        <VolumeCard title="Lead" count={analytics.artworksLead} duration={analytics.avgDurLead} typeSplit={analytics.leadTypeSplit} color="emerald" />
        <VolumeCard title="Internal" count={analytics.artworksInternal} duration={analytics.avgDurInt} typeSplit={analytics.internalTypeSplit} color="purple" />
      </div>

      {/* GRAPHIC ROW: TYPE TREND, CONTEXT TREND, PIE CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Artwork Type Trend</h2>
            <div className="flex gap-2">
               <LegendDot color="bg-blue-500" label="2D" />
               <LegendDot color="bg-emerald-500" label="3D" />
               <LegendDot color="bg-orange-500" label="Video" />
            </div>
          </div>
          <div className="h-[240px] w-full mb-4">
            <TrendLineChart 
              data={analytics.monthlyTrends} 
              keys={["2D Design", "3D Design", "Video"]} 
              labels={["2D", "3D", "VDO"]}
              colors={["#3b82f6", "#10b981", "#f97316"]} 
            />
          </div>
          <TrendDataList 
            data={analytics.monthlyTrends} 
            cols={[
              { key: '2D Design', label: '2D', color: 'text-blue-600' },
              { key: '3D Design', label: '3D', color: 'text-emerald-600' },
              { key: 'Video', label: 'Video', color: 'text-orange-600' }
            ]} 
          />
        </section>

        <section className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Work Context Trend</h2>
            <div className="flex gap-2">
               <LegendDot color="bg-blue-600" label="Proj" />
               <LegendDot color="bg-emerald-600" label="Lead" />
               <LegendDot color="bg-purple-600" label="Int" />
            </div>
          </div>
          <div className="h-[240px] w-full mb-4">
            <TrendLineChart 
              data={analytics.monthlyTrends} 
              keys={[WorkContext.PROJECT, WorkContext.LEAD, WorkContext.INTERNAL]} 
              labels={["PRJ", "LED", "INT"]}
              colors={["#2563eb", "#059669", "#7c3aed"]} 
            />
          </div>
          <TrendDataList 
            data={analytics.monthlyTrends} 
            cols={[
              { key: WorkContext.PROJECT, label: 'PRJ', color: 'text-blue-700' },
              { key: WorkContext.LEAD, label: 'LED', color: 'text-emerald-700' },
              { key: WorkContext.INTERNAL, label: 'INT', color: 'text-purple-700' }
            ]} 
          />
        </section>

        <section className={cardClass}>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight mb-4">Distribution Split</h2>
          <div className="flex flex-col gap-8 h-full justify-center py-4">
            <PieRow title="By Artwork Type" data={analytics.globalTypeSplit} total={analytics.totalArtworks} />
            <div className="h-px bg-slate-100"></div>
            <PieRow title="By Work Context" data={analytics.globalContextSplit} total={analytics.totalArtworks} />
          </div>
        </section>
      </div>

      {/* DEPARTMENT REQUEST VOLUME */}
      <section className={cardClass}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Department Request Volume</h2>
          <div className="flex gap-4">
            <LegendDot color="bg-blue-500" label="2D" />
            <LegendDot color="bg-emerald-500" label="3D" />
            <LegendDot color="bg-orange-500" label="Video" />
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
          <div className="space-y-6">
            {analytics.departmentStats.length === 0 ? (
               <div className="text-center py-8 text-xs font-bold text-slate-400 italic border border-dashed border-slate-200 rounded-xl">
                 No department activity found in this period.
               </div>
            ) : analytics.departmentStats.map(dept => {
              const deptTotal = dept.counts.total || 0;
              const globalMax = Math.max(...analytics.departmentStats.map(d => d.counts.total)) || 1;
              return (
                <div key={dept.id} className="grid grid-cols-5 items-center gap-4">
                  <div className="col-span-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 uppercase truncate leading-none mb-1">{dept.department_name}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{deptTotal} Total Artworks</p>
                  </div>
                  <div className="col-span-3 flex flex-col gap-2">
                    <div className="h-3.5 bg-slate-50 rounded-full flex border border-slate-100 overflow-hidden shadow-inner">
                      <StackedSegment count={dept.counts["2D Design"]} total={deptTotal} globalMax={globalMax} color="bg-blue-500" />
                      <StackedSegment count={dept.counts["3D Design"]} total={deptTotal} globalMax={globalMax} color="bg-emerald-500" />
                      <StackedSegment count={dept.counts["Video"]} total={deptTotal} globalMax={globalMax} color="bg-orange-500" />
                    </div>
                    {/* Detailed Counts for each type */}
                    <div className="flex gap-3 text-[9px] font-bold uppercase tracking-tight">
                       <span className="text-blue-600">2D: {dept.counts["2D Design"]}</span>
                       <span className="text-emerald-600">3D: {dept.counts["3D Design"]}</span>
                       <span className="text-orange-600">Vid: {dept.counts["Video"]}</span>
                    </div>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-xs font-bold text-slate-900 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                      {analytics.totalArtworks ? Math.round((deptTotal / analytics.totalArtworks) * 100) : 0}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* DESIGNER PERFORMANCE HORIZONTAL */}
      <div className="pt-2">
        <span className={labelClass}>Team Output & Performance</span>
        <div className="flex overflow-x-auto flex-nowrap gap-6 mt-4 pb-4 snap-x scrollbar-thin scrollbar-thumb-slate-300">
          {analytics.teamStats.map(ds => (
            <div key={ds.id} className="flex-shrink-0 w-[300px] snap-start bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg group-hover:bg-indigo-600 transition-colors">
                  {ds.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate uppercase tracking-tighter">{ds.name}</h4>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{ds.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-6">
                <MetricBox label="Projects" value={ds.uniqueProjects} color="text-blue-700" bg="bg-blue-50" />
                <MetricBox label="Avg Score" value={ds.avgRating} color="text-orange-600" bg="bg-orange-50" icon="★" />
                <MetricBox label="Avg Days" value={ds.avgDuration} unit="d" color="text-indigo-700" bg="bg-indigo-50" />
              </div>
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <StatBar label="Project" value={ds.projectArtworks} max={ds.totalArtworks} color="bg-blue-600" />
                <StatBar label="Lead" value={ds.leadArtworks} max={ds.totalArtworks} color="bg-emerald-600" />
                <StatBar label="Internal" value={ds.internalArtworks} max={ds.totalArtworks} color="bg-purple-600" />
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-900 uppercase">Total Logged</span>
                <span className="text-xl font-bold text-indigo-600 tracking-tighter">{ds.totalArtworks}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Sub-Components ---

const TrendDataList = ({ data, cols }: { data: any[], cols: { key: string, label: string, color: string }[] }) => {
  const renderData = data; 
  return (
    <div className="border-t border-slate-100 pt-3 mt-auto">
      <div className="grid grid-cols-4 gap-2 mb-2 px-2">
         <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Month</div>
         {cols.map((c, i) => (
           <div key={i} className={`text-[9px] font-black uppercase text-center tracking-widest ${c.color}`}>{c.label}</div>
         ))}
      </div>
      <div className="max-h-[120px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-100 pr-1">
        {renderData.map((d, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 py-1.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded px-2">
            <div className="text-[10px] font-bold text-slate-600 truncate">{d.label}</div>
            {cols.map((c, idx) => (
              <div key={idx} className="text-[10px] font-black text-slate-900 text-center">
                {d[c.key] || 0}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const LegendDot = ({ color, label }: { color: string, label: string }) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-2 h-2 rounded-full ${color}`}></div>
    <span className="text-[9px] font-bold text-slate-500 uppercase">{label}</span>
  </div>
);

const KPICard = ({ label, value, sub, color, keywords, statsList }: any) => (
  <div className={`bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-l-8 flex flex-col h-full ${color}`}>
    <div className="mb-4">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{label}</span>
      <div className="text-3xl font-bold text-slate-900 tracking-tight">{value}</div>
      <p className="text-[10px] font-medium text-slate-400 uppercase mt-1">{sub}</p>
    </div>
    
    <div className="mt-auto">
      {keywords && keywords.length > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide block mb-1.5">Top Keywords</span>
          <div className="flex flex-wrap gap-1">
            {keywords.map((k: any) => (
              <span key={k.word} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase border border-slate-200">
                {k.word} <span className="text-[7px] text-slate-400">({k.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {statsList && statsList.length > 0 && (
        <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3">
          {statsList.map((list: any, idx: number) => (
            <div key={idx}>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide block mb-1.5 truncate">{list.title}</span>
              <div className="flex flex-col gap-1">
                {list.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-[9px]">
                    <span className="font-bold text-slate-600 truncate max-w-[70%]">{item.label}</span>
                    <span className="font-black text-slate-900 bg-slate-50 px-1 rounded">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

const VolumeCard = ({ title, count, duration, typeSplit, color }: any) => {
  const themes: any = {
    blue: "text-blue-700 bg-blue-50 border-blue-100 accent-blue-600",
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-100 accent-emerald-600",
    purple: "text-purple-700 bg-purple-50 border-purple-100 accent-purple-600",
  };
  const theme = themes[color];
  const parts = theme.split(' ');
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
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${color === 'blue' ? 'bg-blue-600' : color === 'emerald' ? 'bg-emerald-600' : 'bg-purple-600'}`} style={{ width: `${t.percentage}%` }}></div></div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PieRow = ({ title, data, total }: any) => (
  <div className="flex flex-col sm:flex-row items-center gap-6">
    <div className="relative w-28 h-28 flex-shrink-0">
      <div 
        className="w-full h-full rounded-full" 
        style={{ 
          background: `conic-gradient(${data.map((d:any, i:number) => {
            const percentage = total ? (d.count / total) * 100 : 0;
            const start = data.slice(0, i).reduce((acc:any, curr:any) => acc + (total ? (curr.count / total) * 100 : 0), 0);
            return `${d.color} ${start}% ${start + percentage}%`;
          }).join(', ')})` 
        }}
      ></div>
      <div className="absolute inset-0 m-auto w-16 h-16 bg-white rounded-full flex flex-col items-center justify-center shadow-sm">
         <span className="text-lg font-black text-slate-900 leading-none">{total}</span>
         <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Total</span>
      </div>
    </div>
    
    <div className="flex-1 w-full space-y-2">
      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider border-b border-slate-100 pb-1 text-center sm:text-left">{title}</p>
      {data.map((d:any) => (
        <div key={d.type || d.context} className="flex justify-between items-center text-[10px] font-bold text-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></div>
            <span className="uppercase truncate max-w-[85px]">{d.type || d.context}</span>
          </div>
          <span className="text-slate-900 font-bold bg-slate-50 px-2 py-0.5 rounded border border-slate-100 min-w-[3rem] text-center">
            {d.count} <span className="text-slate-400 text-[8px] font-medium opacity-70">({total ? Math.round((d.count / total) * 100) : 0}%)</span>
          </span>
        </div>
      ))}
    </div>
  </div>
);

const TrendLineChart = ({ data, keys, labels, colors }: any) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 400; 
  const height = 200; 
  const padding = 35;
  const maxValue = Math.max(...data.flatMap((d:any) => keys.map((k:string) => d[k])), 5);

  const getY = (val: number) => height - padding - (val / maxValue) * (height - padding * 2);
  const getX = (idx: number) => padding + (idx / (data.length - 1)) * (width - padding * 2);

  const getSmoothPath = (key: string) => {
    const points = data.map((d: any, i: number) => ({ x: getX(i), y: getY(d[key]) }));
    if (points.length === 0) return "";
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  };

  const getAreaPath = (key: string) => {
    const line = getSmoothPath(key);
    if (!line) return "";
    const lastX = getX(data.length - 1);
    const firstX = getX(0);
    const bottomY = height - padding;
    return `${line} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
  };

  return (
    <div className="relative w-full h-full" onMouseLeave={() => setHoverIndex(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          {colors.map((color: string, i: number) => (
            <linearGradient key={`grad-${i}`} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          ))}
        </defs>
        {[0, 0.5, 1].map(p => <line key={p} x1={padding} y1={getY(maxValue * p)} x2={width - padding} y2={getY(maxValue * p)} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />)}
        {keys.map((key:string, kIdx:number) => (
          <g key={key}>
            <path d={getAreaPath(key)} fill={`url(#grad-${kIdx})`} className="transition-all duration-300" />
            <path d={getSmoothPath(key)} fill="none" stroke={colors[kIdx]} strokeWidth={hoverIndex !== null ? "2.5" : "3.5"} strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-300 shadow-sm" />
          </g>
        ))}
        {data.map((d:any, i:number) => (
          <text key={i} x={getX(i)} y={height - 10} textAnchor="middle" fontSize="9" fontWeight="bold" className="fill-slate-400 uppercase tracking-tighter">
            {d.label}
          </text>
        ))}
        {hoverIndex !== null && (
          <g>
            <line x1={getX(hoverIndex)} y1={padding} x2={getX(hoverIndex)} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 2" />
            {keys.map((key: string, kIdx: number) => (
              <circle key={`dot-${kIdx}`} cx={getX(hoverIndex)} cy={getY(data[hoverIndex][key])} r="4" fill="white" stroke={colors[kIdx]} strokeWidth="2.5" className="transition-all duration-150" />
            ))}
          </g>
        )}
        {data.map((d: any, i: number) => (
          <rect key={`hit-${i}`} x={getX(i) - ((width - padding * 2) / (data.length - 1)) / 2} y={0} width={(width - padding * 2) / (data.length - 1)} height={height} fill="transparent" onMouseEnter={() => setHoverIndex(i)} />
        ))}
      </svg>
      {hoverIndex !== null && (
        <div className="absolute z-10 bg-slate-900/95 backdrop-blur-sm text-white p-3 rounded-xl shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full border border-slate-700/50" style={{ left: `${(getX(hoverIndex) / width) * 100}%`, top: '20px' }}>
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest text-center border-b border-slate-700 pb-1">{data[hoverIndex].fullDate}</p>
          <div className="flex gap-4">
            {keys.map((key: string, kIdx: number) => (
              <div key={key} className="flex flex-col items-center">
                <span className="text-[9px] font-bold uppercase mb-0.5" style={{ color: colors[kIdx] }}>{labels[kIdx]}</span>
                <span className="text-sm font-black">{data[hoverIndex][key]}</span>
              </div>
            ))}
          </div>
          <div className="absolute left-1/2 -bottom-1.5 w-3 h-3 bg-slate-900 rotate-45 transform -translate-x-1/2 border-r border-b border-slate-700/50"></div>
        </div>
      )}
    </div>
  );
};

const StackedSegment = ({ count, total, globalMax, color }: any) => {
  if (count === 0) return null;
  return <div className={`h-full ${color} border-r border-white/20 transition-all duration-1000`} style={{ width: `${(count / globalMax) * 100}%` }}></div>;
};

const MetricBox = ({ label, value, unit, color, bg, icon }: any) => (
  <div className={`flex flex-col items-center justify-center p-2.5 rounded-2xl ${bg} border border-white shadow-sm transition-transform hover:scale-[1.05]`}>
    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">{label}</span>
    <div className={`text-xl font-bold leading-none tracking-tighter ${color} flex items-center`}>
      {value}
      <span className="text-[10px] ml-0.5 opacity-60 font-black">{unit || icon}</span>
    </div>
  </div>
);

const StatBar = ({ label, value, max, color }: any) => (
  <div>
    <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase mb-1 tracking-tight">
      <span>{label} Production</span>
      <span className="text-slate-900">{value}</span>
    </div>
    <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100 shadow-inner">
      <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${(value / (max || 1)) * 100}%` }}></div>
    </div>
  </div>
);

export default Dashboard;
