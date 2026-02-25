
import React, { useMemo, useState } from 'react';
import { AppState, WorkContext, ArtworkLog, Project, Lead, DesignerEvaluation } from '../types';
import DateRangePicker from '../components/DateRangePicker';

interface Props {
  state: AppState;
}

const Dashboard: React.FC<Props> = ({ state }) => {
  const [filterStart, setFilterStart] = useState<string>('');
  const [filterEnd, setFilterEnd] = useState<string>('');

  // State for the Notes Modal
  const [viewNotes, setViewNotes] = useState<{ name: string; notes: any[]; projectEvals?: any[] } | null>(null);

  const analytics = useMemo(() => {
    const { artworkLogs, projects, leads, designers, departments, internalDesigns, projectSurveys, designerEvaluations } = state;

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
      const words = log.artwork_name.trim().split(/[\s-]+/);
      const topWords = words.slice(0, 2).join(' ').toUpperCase();
      if (topWords.trim().length > 1) {
        wordCounts[topWords] = (wordCounts[topWords] || 0) + 1;
      }
    });

    const topKeywords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([word, count]) => ({ word, count }));
    // -----------------------------

    const countByContext = (ctx: WorkContext) => filteredLogs.filter(l => l.work_context === ctx).length;
    const artworksProject = countByContext(WorkContext.PROJECT);
    const artworksLead = countByContext(WorkContext.LEAD);
    const artworksInternal = countByContext(WorkContext.INTERNAL);

    // Modern Gradient Definitions for Charts (Added hexGradient for SVG)
    const globalTypeSplit = [
      { type: "2D Design", count: filteredLogs.filter(l => l.artwork_type === "2D Design").length, gradient: "from-blue-400 to-cyan-500", hexGradient: ["#60a5fa", "#06b6d4"], solid: "#3b82f6" },
      { type: "3D Design", count: filteredLogs.filter(l => l.artwork_type === "3D Design").length, gradient: "from-emerald-400 to-teal-500", hexGradient: ["#34d399", "#14b8a6"], solid: "#10b981" },
      { type: "Video", count: filteredLogs.filter(l => l.artwork_type === "Video").length, gradient: "from-orange-400 to-rose-500", hexGradient: ["#fb923c", "#f43f5e"], solid: "#f97316" }
    ];

    const globalContextSplit = [
      { type: "Project", count: artworksProject, gradient: "from-blue-500 to-indigo-600", hexGradient: ["#3b82f6", "#4f46e5"], solid: "#2563eb" },
      { type: "Lead", count: artworksLead, gradient: "from-emerald-500 to-green-600", hexGradient: ["#10b981", "#16a34a"], solid: "#059669" },
      { type: "Internal", count: artworksInternal, gradient: "from-purple-500 to-fuchsia-600", hexGradient: ["#a855f7", "#c026d3"], solid: "#7c3aed" }
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

    // Corrected Department Stats: Only count Internal Requests
    const departmentStats = departments.map(dept => {
      // STRICT FILTER: Only include artwork logs where context is INTERNAL and matches department
      const logs = filteredLogs.filter(l => l.department_id === dept.id && l.work_context === WorkContext.INTERNAL);
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

    // --- TEAM EVALUATION LOGIC (uses designer_evaluations table) ---
    const EVAL_CRITERIA_KEYS = ['inisiatif', 'disiplin', 'penyelesaian_tugas', 'attitude', 'komunikasi', 'respon_masukan'];

    const teamStats = designers.map(d => {
      const logs = filteredLogs.filter(l => l.pic_designer_id === d.id);

      const projectsInvolvedCount = projects.filter(p =>
        p.pic_designer_id === d.id || (p.support_designer_ids || []).includes(d.id)
      ).length;

      const uniqueLeads = new Set(logs.filter(l => l.work_context === WorkContext.LEAD && l.lead_id).map(l => l.lead_id)).size;

      const leadLogs = logs.filter(l => l.work_context === WorkContext.LEAD && l.end_date);
      let avgLeadDuration = "0.0";
      if (leadLogs.length > 0) {
        const totalLeadDays = leadLogs.reduce((acc, l) => {
          const start = new Date(l.start_date);
          const end = new Date(l.end_date!);
          return acc + (Math.max(0, (end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);
        }, 0);
        avgLeadDuration = (totalLeadDays / leadLogs.length).toFixed(1);
      }

      // Designer Evaluation Score Logic (from designer_evaluations table)
      const myEvals = designerEvaluations.filter(ev => {
        if (ev.designer_id !== d.id) return false;
        const proj = projects.find(p => p.id === ev.project_id);
        if (!proj) return false;

        const startMatch = !filterStart || proj.start_date >= filterStart;
        const endMatch = !filterEnd || proj.start_date <= filterEnd;
        if (!startMatch || !endMatch) return false;

        const projectDesignerIds = new Set([proj.pic_designer_id, ...(proj.support_designer_ids || [])].filter(Boolean));
        return projectDesignerIds.has(d.id);
      });

      let avgRatingStr = null;
      let detailedScores: any = null;
      let evalNotes: any[] = [];
      let projectEvalDetails: any[] = [];

      if (myEvals.length > 0) {
        let accInisiatif = 0, accDisiplin = 0, accPenyelesaian = 0, accAttitude = 0, accKomunikasi = 0, accRespon = 0;
        let totalOverallSum = 0;

        myEvals.forEach(ev => {
          const scores = EVAL_CRITERIA_KEYS.map(k => (ev as any)[k] || 0).filter((v: number) => v > 0);
          const evAvg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
          totalOverallSum += evAvg;

          accInisiatif += ev.inisiatif || 0;
          accDisiplin += ev.disiplin || 0;
          accPenyelesaian += ev.penyelesaian_tugas || 0;
          accAttitude += ev.attitude || 0;
          accKomunikasi += ev.komunikasi || 0;
          accRespon += ev.respon_masukan || 0;

          const projName = projects.find(p => p.id === ev.project_id)?.project_name || 'Unknown Project';

          projectEvalDetails.push({
            id: ev.id,
            project_name: projName,
            project_id: ev.project_id,
            evaluator_name: ev.evaluator_name,
            avg: evAvg > 0 ? evAvg.toFixed(1) : '-',
            inisiatif: ev.inisiatif || 0,
            disiplin: ev.disiplin || 0,
            penyelesaian_tugas: ev.penyelesaian_tugas || 0,
            attitude: ev.attitude || 0,
            komunikasi: ev.komunikasi || 0,
            respon_masukan: ev.respon_masukan || 0,
            masukan: ev.masukan_pengembangan,
            date: ev.created_at
          });

          if (ev.masukan_pengembangan) {
            evalNotes.push({
              id: ev.id,
              project_name: projName,
              note: ev.masukan_pengembangan,
              date: ev.created_at
            });
          }
        });

        avgRatingStr = (totalOverallSum / myEvals.length).toFixed(1);

        detailedScores = {
          inisiatif: (accInisiatif / myEvals.length).toFixed(1),
          disiplin: (accDisiplin / myEvals.length).toFixed(1),
          penyelesaian_tugas: (accPenyelesaian / myEvals.length).toFixed(1),
          attitude: (accAttitude / myEvals.length).toFixed(1),
          komunikasi: (accKomunikasi / myEvals.length).toFixed(1),
          respon_masukan: (accRespon / myEvals.length).toFixed(1),
        };
      }

      return {
        ...d,
        projectArtworks: logs.filter(l => l.work_context === WorkContext.PROJECT).length,
        leadArtworks: logs.filter(l => l.work_context === WorkContext.LEAD).length,
        internalArtworks: logs.filter(l => l.work_context === WorkContext.INTERNAL).length,
        totalArtworks: logs.length,
        uniqueProjectsInvolved: projectsInvolvedCount,
        uniqueLeads,
        avgLeadDuration,
        avgRating: avgRatingStr,
        detailedScores,
        evalNotes,
        projectEvalDetails
      };
    }).sort((a, b) => b.totalArtworks - a.totalArtworks);

    const projectScoresMap: Record<string, { sum: number; count: number }> = {};
    const categoryScoresMap: Record<string, { sum: number; count: number }> = {};
    EVAL_CRITERIA_KEYS.forEach(k => categoryScoresMap[k] = { sum: 0, count: 0 });
    const devNotesCounts2: Record<string, number> = {};
    const devNotesCounts3: Record<string, number> = {};
    let globalEvalSum = 0;
    let globalEvalCount = 0;

    const filteredEvaluations = designerEvaluations.filter(ev => {
      if (!ev.project_id) return true;
      const proj = projects.find(p => p.id === ev.project_id);
      if (!proj) return false;
      const startMatch = !filterStart || proj.start_date >= filterStart;
      const endMatch = !filterEnd || proj.start_date <= filterEnd;
      return startMatch && endMatch;
    });

    filteredEvaluations.forEach(ev => {
      const scores = EVAL_CRITERIA_KEYS.map(k => (ev as any)[k] || 0).filter((v: number) => v > 0);
      if (scores.length > 0) {
        const evAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
        globalEvalSum += evAvg;
        globalEvalCount++;
        if (ev.project_id) {
          if (!projectScoresMap[ev.project_id]) projectScoresMap[ev.project_id] = { sum: 0, count: 0 };
          projectScoresMap[ev.project_id].sum += evAvg;
          projectScoresMap[ev.project_id].count++;
        }
        EVAL_CRITERIA_KEYS.forEach(k => {
          if ((ev as any)[k]) {
            categoryScoresMap[k].sum += (ev as any)[k];
            categoryScoresMap[k].count++;
          }
        });
      }
      if (ev.masukan_pengembangan) {
        const words = ev.masukan_pengembangan.trim().toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter((w: string) => w.length > 2);
        for (let i = 0; i < words.length - 1; i++) {
          const bigram = `${words[i]} ${words[i + 1]}`;
          if (bigram.length > 5) devNotesCounts2[bigram] = (devNotesCounts2[bigram] || 0) + 1;
        }
        for (let i = 0; i < words.length - 2; i++) {
          const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
          if (trigram.length > 8) devNotesCounts3[trigram] = (devNotesCounts3[trigram] || 0) + 1;
        }
      }
    });

    const evalProjectSummary = Object.entries(projectScoresMap).map(([pid, data]) => ({
      projectName: projects.find(p => p.id === pid)?.project_name || 'Unknown',
      avgScore: (data.sum / data.count).toFixed(2),
    })).sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));

    const evalCategorySummary = EVAL_CRITERIA_KEYS.map(k => ({
      category: k.replace('_', ' '),
      avgScore: categoryScoresMap[k].count > 0 ? (categoryScoresMap[k].sum / categoryScoresMap[k].count).toFixed(2) : '0.00'
    })).sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));

    const globalEvalAverage = globalEvalCount > 0 ? (globalEvalSum / globalEvalCount).toFixed(2) : '0.00';

    const topDevKeywords2 = Object.entries(devNotesCounts2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    const topDevKeywords3 = Object.entries(devNotesCounts3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    return {
      totalArtworks,
      totalProjectsCount: allProjects.length,
      totalLeadsCount: allLeads.length,
      totalInternalCount: allInternal.length,
      artworksProject, artworksLead, artworksInternal,
      teamStats, departmentStats, topKeywords, evalProjectSummary, evalCategorySummary, topDevKeywords2, topDevKeywords3, globalEvalAverage,
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
      statsData: {
        projects: { pics: projectPICs, locs: projectLocs },
        leads: { grades: leadGrades, reqs: leadRequesters },
        internal: { depts: internalDepts, reqs: internalRequesters }
      }
    };
  }, [state, filterStart, filterEnd]);

  const cardClass = "bg-white p-6 rounded-[20px] border border-[#EAEAEA] shadow-sm flex flex-col transition-all hover:shadow-md";
  const labelClass = "text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 relative">
      {/* EVALUATION DETAIL MODAL */}
      {viewNotes && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#1A1C20]/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setViewNotes(null)}>
          <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-2xl p-6 max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-zinc-100">
              <div>
                <h3 className="font-bold text-zinc-900 uppercase tracking-tight">Evaluasi Designer: {viewNotes.name}</h3>
                <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">{viewNotes.projectEvals?.length || 0} Project Evaluations</p>
              </div>
              <button onClick={() => setViewNotes(null)} className="p-1.5 rounded-lg hover:bg-[#F8F9FA] text-zinc-400 hover:text-zinc-700 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto pr-2 space-y-4">
              {(!viewNotes.projectEvals || viewNotes.projectEvals.length === 0) ? (
                <p className="text-center text-xs text-zinc-400 italic py-8">Belum ada evaluasi untuk designer ini.</p>
              ) : (
                <>
                  {/* Per-project evaluation cards */}
                  {viewNotes.projectEvals.map((pe: any, idx: number) => (
                    <div key={idx} className="bg-[#FCFCFC] p-4 rounded-xl border border-zinc-100">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[11px] font-bold text-zinc-900 uppercase truncate max-w-[60%]">{pe.project_name}</span>
                        <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-zinc-800 border border-indigo-200">{pe.avg}</span>
                      </div>
                      {pe.evaluator_name && (
                        <p className="text-[9px] font-bold text-zinc-400 uppercase mb-2">Evaluator: {pe.evaluator_name}</p>
                      )}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-2">
                        {[
                          { key: 'inisiatif', label: 'Inisiatif' },
                          { key: 'disiplin', label: 'Disiplin' },
                          { key: 'penyelesaian_tugas', label: 'Tugas' },
                          { key: 'attitude', label: 'Attitude' },
                          { key: 'komunikasi', label: 'Komunikasi' },
                          { key: 'respon_masukan', label: 'Respon' },
                        ].map(c => {
                          const score = pe[c.key] || 0;
                          const colorClass = score >= 4 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : score >= 3 ? 'bg-blue-100 text-blue-700 border-blue-200' : score >= 2 ? 'bg-amber-100 text-amber-700 border-amber-200' : score > 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-[#F8F9FA] text-zinc-400 border-[#EAEAEA]';
                          return (
                            <div key={c.key} className={`flex flex-col items-center py-1.5 px-1 rounded-lg border ${colorClass}`}>
                              <span className="text-[7px] font-bold uppercase tracking-tight">{c.label}</span>
                              <span className="text-[11px] font-bold">{score || '-'}</span>
                            </div>
                          );
                        })}
                      </div>
                      {pe.masukan && (
                        <div className="mt-2 pt-2 border-t border-[#EAEAEA]">
                          <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Masukan Pengembangan</span>
                          <p className="text-xs text-zinc-700 font-medium leading-relaxed italic mt-1">"{pe.masukan}"</p>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Removed duplicate note summary to avoid double content */}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Added relative z-20 to ensure datepicker pops over charts */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-20">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight uppercase">Executive Studio Hub</h1>
          <p className="text-zinc-500 text-sm font-medium">Creative Production Insights.</p>
        </div>
        {/* Pass filtered dates to DateRangePicker to properly control state */}
        <DateRangePicker
          startDate={filterStart}
          endDate={filterEnd}
          onChange={(start, end) => { setFilterStart(start); setFilterEnd(end); }}
          onReset={() => { setFilterStart(''); setFilterEnd(''); }}
          placeholder="Filter Date Range"
        />
      </header>

      {/* KPI Row - Vibrant Gradients */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <KPICard
          label="Total Artworks"
          value={analytics.totalArtworks}
          sub="Filtered Output"
          gradient="from-orange-400 to-red-500"
          keywords={analytics.topKeywords}
        />
        <KPICard
          label="Total Projects"
          value={analytics.totalProjectsCount}
          sub="All Statuses"
          gradient="from-blue-400 to-indigo-600"
          statsList={[
            { title: "Top 3 PIC", items: analytics.statsData.projects.pics },
            { title: "Top 3 Locations", items: analytics.statsData.projects.locs }
          ]}
        />
        <KPICard
          label="Total Leads"
          value={analytics.totalLeadsCount}
          sub="All Statuses"
          gradient="from-emerald-400 to-teal-600"
          statsList={[
            { title: "By Grade", items: analytics.statsData.leads.grades },
            { title: "Top Requesters", items: analytics.statsData.leads.reqs }
          ]}
        />
        <KPICard
          label="Total Tasks"
          value={analytics.totalInternalCount}
          sub="All Statuses"
          gradient="from-purple-400 to-fuchsia-600"
          statsList={[
            { title: "Top Depts", items: analytics.statsData.internal.depts },
            { title: "Top Requesters", items: analytics.statsData.internal.reqs }
          ]}
        />
      </div>

      {/* Volume Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <VolumeCard
          title="Project"
          count={analytics.artworksProject}
          duration={analytics.avgDurProj}
          typeSplit={analytics.projectTypeSplit}
          gradient="from-blue-500 to-cyan-500"
        />
        <VolumeCard
          title="Lead"
          count={analytics.artworksLead}
          duration={analytics.avgDurLead}
          typeSplit={analytics.leadTypeSplit}
          gradient="from-emerald-500 to-green-500"
        />
        <VolumeCard
          title="Internal"
          count={analytics.artworksInternal}
          duration={analytics.avgDurInt}
          typeSplit={analytics.internalTypeSplit}
          gradient="from-purple-500 to-pink-500"
        />
      </div>

      {/* GRAPHIC ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-tight">Artwork Type Trend</h2>
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
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-tight">Work Context Trend</h2>
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
          <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-tight mb-4">Distribution Split</h2>
          <div className="flex flex-col gap-8 h-full justify-center py-4">
            <PieRow title="By Artwork Type" data={analytics.globalTypeSplit} total={analytics.totalArtworks} />
            <div className="h-px bg-[#F8F9FA]"></div>
            <PieRow title="By Work Context" data={analytics.globalContextSplit} total={analytics.totalArtworks} />
          </div>
        </section>
      </div>

      {/* DEPARTMENT REQUEST VOLUME & HEATMAP */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className={cardClass}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-tight">Department Request Volume</h2>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">Internal Context Only</span>
            </div>
            <div className="flex gap-4">
              <LegendDot color="bg-blue-500" label="2D" />
              <LegendDot color="bg-emerald-500" label="3D" />
              <LegendDot color="bg-orange-500" label="Video" />
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
            <div className="space-y-6">
              {analytics.departmentStats.length === 0 ? (
                <div className="text-center py-8 text-xs font-bold text-zinc-400 italic border border-dashed border-[#EAEAEA] rounded-xl">
                  No internal department activity found in this period.
                </div>
              ) : analytics.departmentStats.map(dept => {
                const deptTotal = dept.counts.total || 0;
                const globalMax = Math.max(...analytics.departmentStats.map(d => d.counts.total)) || 1;
                const percentage = analytics.artworksInternal ? Math.round((deptTotal / analytics.artworksInternal) * 100) : 0;

                return (
                  <div key={dept.id} className="grid grid-cols-5 items-center gap-4">
                    <div className="col-span-1 min-w-0">
                      <p className="text-xs font-bold text-zinc-800 uppercase truncate leading-none mb-1">{dept.department_name}</p>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight">{deptTotal} Items</p>
                    </div>
                    <div className="col-span-3 flex flex-col gap-2">
                      <div className="h-3.5 bg-[#FCFCFC] rounded-full flex border border-zinc-100 overflow-hidden shadow-inner">
                        <StackedSegment count={dept.counts["2D Design"]} total={deptTotal} globalMax={globalMax} gradient="from-blue-400 to-cyan-500" />
                        <StackedSegment count={dept.counts["3D Design"]} total={deptTotal} globalMax={globalMax} gradient="from-emerald-400 to-teal-500" />
                        <StackedSegment count={dept.counts["Video"]} total={deptTotal} globalMax={globalMax} gradient="from-orange-400 to-rose-500" />
                      </div>
                      <div className="flex gap-3 text-[9px] font-bold uppercase tracking-tight">
                        <span className="text-blue-600">2D: {dept.counts["2D Design"]}</span>
                        <span className="text-emerald-600">3D: {dept.counts["3D Design"]}</span>
                        <span className="text-orange-600">Vid: {dept.counts["Video"]}</span>
                      </div>
                    </div>
                    <div className="col-span-1 text-right flex flex-col items-end">
                      <span className="text-xs font-bold text-zinc-900 bg-[#FCFCFC] px-2 py-1 rounded-md border border-zinc-100">
                        {percentage}%
                      </span>
                      <span className="text-[9px] font-bold text-zinc-400 mt-0.5">{deptTotal} / {analytics.artworksInternal}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* HEATMAP */}
        <section className={cardClass}>
          <div className="flex flex-col mb-4">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-tight">Heatmap Artwork Internal</h2>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">Volume by Department & Type</span>
          </div>
          <div className="overflow-x-auto overflow-y-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200 pr-2 flex-col flex-1 flex justify-center">
            <div className="min-w-fit w-full">
              {analytics.departmentStats.length === 0 ? (
                <div className="text-center py-8 text-xs font-bold text-zinc-400 italic border border-dashed border-[#EAEAEA] rounded-xl text-center w-full">
                  No internal department activity found in this period.
                </div>
              ) : (
                <div className="flex flex-col gap-[6px] w-full pt-2">
                  {["2D Design", "3D Design", "Video"].map(type => {
                    const maxVal = Math.max(...analytics.departmentStats.map(d => (d.counts as any)[type] || 0), 1);
                    return (
                      <div key={type} className="flex flex-row items-center gap-[6px]">
                        <div className="flex-shrink-0 w-24 text-[10px] font-semibold text-zinc-500 uppercase tracking-tight text-right pr-2">
                          {type === '2D Design' ? '2D Design' : type === '3D Design' ? '3D Design' : 'Video'}
                        </div>
                        <div className="flex flex-1 gap-[6px]">
                          {analytics.departmentStats.map(d => {
                            const val = (d.counts as any)[type] || 0;
                            const intensity = val / maxVal;

                            let bgClass = "bg-[#F4F4F5]";
                            let textColor = "text-transparent";

                            if (val > 0) {
                              if (intensity > 0.8) { bgClass = "bg-indigo-600"; textColor = "text-indigo-100"; }
                              else if (intensity > 0.6) { bgClass = "bg-indigo-500"; textColor = "text-indigo-50"; }
                              else if (intensity > 0.4) { bgClass = "bg-indigo-400"; textColor = "text-indigo-50"; }
                              else if (intensity > 0.2) { bgClass = "bg-indigo-300"; textColor = "text-indigo-900"; }
                              else { bgClass = "bg-indigo-200"; textColor = "text-indigo-900"; }
                            }

                            return (
                              <div
                                key={d.id}
                                className={`flex-1 h-10 min-w-[28px] rounded-[4px] flex items-center justify-center text-[10px] font-bold transition-all hover:opacity-80 ${bgClass} ${textColor} relative group`}
                                title={`${d.department_name} - ${type}: ${val}`}
                              >
                                <span className={val > 0 ? "opacity-100" : "opacity-0"}>{val}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Departments Headers Matrix X-axis */}
                  <div className="flex flex-row items-center gap-[6px] mt-1 hidden sm:flex">
                    <div className="flex-shrink-0 w-24"></div>
                    <div className="flex flex-1 gap-[6px]">
                      {analytics.departmentStats.map(d => (
                        <div key={d.id} className="flex-1 text-center text-[9px] font-semibold text-zinc-400 capitalize truncate" title={d.department_name}>
                          {d.department_name.split(' ')[0]}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* EVALUATION SUMMARY */}
      <section className={cardClass + " animate-slide-up"}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-tight">Evaluation Summary</h2>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">Overall Performance Insights</span>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#FCFCFC] p-4 rounded-xl border border-[#EAEAEA] flex flex-col h-full hover:shadow-sm transition-all">
            <div className="mb-5">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">Nilai Overall Review</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 tracking-tight">{analytics.globalEvalAverage}</span>
                <span className="text-xs font-bold text-zinc-400">/ 5.0</span>
              </div>
            </div>
            <h3 className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2.5">Rata-Rata Nilai Per Project (Top 5)</h3>
            <div className="mt-auto flex flex-col border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
              {analytics.evalProjectSummary.slice(0, 5).map((p: any, idx: number) => (
                <div key={idx} className={`flex justify-between items-center text-xs p-2.5 animate-fade-in ${idx !== Math.min(analytics.evalProjectSummary.length, 5) - 1 ? 'border-b border-zinc-100' : ''}`} style={{ animationDelay: `${idx * 50}ms` }}>
                  <span className="font-bold text-zinc-800 truncate max-w-[70%]">{p.projectName}</span>
                  <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">{p.avgScore}</span>
                </div>
              ))}
              {analytics.evalProjectSummary.length === 0 && <span className="text-xs text-zinc-400 italic p-2.5">No project stats</span>}
            </div>
          </div>
          <div className="bg-[#FCFCFC] p-4 rounded-xl border border-[#EAEAEA] flex flex-col h-full hover:shadow-sm transition-all">
            <h3 className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2.5">Rata-Rata Nilai Kategori</h3>
            <div className="mt-auto flex flex-col border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
              {analytics.evalCategorySummary.map((c: any, idx: number) => (
                <div key={idx} className={`flex justify-between items-center text-xs p-2.5 animate-fade-in ${idx !== analytics.evalCategorySummary.length - 1 ? 'border-b border-zinc-100' : ''}`} style={{ animationDelay: `${idx * 50}ms` }}>
                  <span className="font-bold text-zinc-800 uppercase tracking-tight">{c.category}</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">{c.avgScore}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#FCFCFC] p-4 rounded-xl border border-[#EAEAEA] flex flex-col h-full hover:shadow-sm transition-all overflow-hidden">
            <h3 className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Top 10 Keywords (Pengembangan Diri)</h3>
            <div className="flex flex-col gap-3 mt-auto flex-1 overflow-y-auto custom-scrollbar pr-1">
              <div>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight mb-1.5 block">2 Kombinasi Kata</span>
                <div className="flex flex-wrap gap-1.5">
                  {analytics.topDevKeywords2.map((k: any, idx: number) => (
                    <span key={`2w-${idx}`} className="px-2 py-1 bg-white text-zinc-700 rounded-lg text-[10px] font-bold border border-[#EAEAEA] shadow-sm animate-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
                      {k.word} <span className="text-[8px] text-zinc-400 font-medium">({k.count})</span>
                    </span>
                  ))}
                  {analytics.topDevKeywords2.length === 0 && <span className="text-[9px] text-zinc-400 italic">Kosong</span>}
                </div>
              </div>
              <div className="h-px bg-[#EAEAEA]"></div>
              <div>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight mb-1.5 block">3 Kombinasi Kata</span>
                <div className="flex flex-wrap gap-1.5">
                  {analytics.topDevKeywords3.map((k: any, idx: number) => (
                    <span key={`3w-${idx}`} className="px-2 py-1 bg-zinc-900 text-white rounded-lg text-[10px] font-bold shadow-sm animate-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
                      {k.word} <span className="text-[8px] text-zinc-400 font-medium">({k.count})</span>
                    </span>
                  ))}
                  {analytics.topDevKeywords3.length === 0 && <span className="text-[9px] text-zinc-400 italic">Kosong</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DESIGNER PERFORMANCE HORIZONTAL */}
      <div className="pt-2">
        <span className={labelClass}>Team Output & Performance</span>
        <div className="flex overflow-x-auto flex-nowrap gap-6 mt-4 pb-4 snap-x scrollbar-thin scrollbar-thumb-slate-300">
          {analytics.teamStats.map(ds => (
            <div key={ds.id} className="flex-shrink-0 w-[300px] snap-start bg-white p-6 rounded-[20px] border border-[#EAEAEA] shadow-sm group">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center font-bold text-lg group-hover:from-indigo-500 group-hover:to-purple-600 transition-all shadow-md">
                  {ds.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-zinc-900 truncate uppercase tracking-tight">{ds.name}</h4>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{ds.role}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-6">
                <MetricBox label="Projects" value={ds.uniqueProjectsInvolved} gradient="from-blue-50 to-indigo-50" textGradient="from-blue-600 to-indigo-600" />
                <MetricBox label="Leads" value={ds.uniqueLeads} gradient="from-emerald-50 to-teal-50" textGradient="from-emerald-600 to-teal-600" />
                <MetricBox label="Lead Days" value={ds.avgLeadDuration} unit="d" gradient="from-purple-50 to-fuchsia-50" textGradient="from-purple-600 to-fuchsia-600" />
              </div>

              <div className="space-y-3 pt-4 border-t border-zinc-100">
                <StatBar label="Project" value={ds.projectArtworks} max={ds.totalArtworks} gradient="from-blue-500 to-indigo-500" />
                <StatBar label="Lead" value={ds.leadArtworks} max={ds.totalArtworks} gradient="from-emerald-500 to-teal-500" />
                <StatBar label="Internal" value={ds.internalArtworks} max={ds.totalArtworks} gradient="from-purple-500 to-fuchsia-500" />
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-100 flex justify-between items-center">
                <span className="text-[10px] font-bold text-zinc-900 uppercase">Total Logged</span>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-700 to-slate-900 tracking-tight">{ds.totalArtworks}</span>
              </div>

              {/* EVALUATION SCORE SECTION (Bottom) */}
              <div className="mt-4 pt-4 border-t border-dashed border-[#EAEAEA]">
                <div
                  className="flex justify-between items-center mb-2 cursor-pointer hover:bg-[#FCFCFC] rounded p-1 -mx-1 transition-colors"
                  onClick={() => setViewNotes({ name: ds.name, notes: ds.evalNotes, projectEvals: ds.projectEvalDetails })}
                  title="Lihat detail evaluasi per project"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Designer Eval</span>
                    {ds.evalNotes.length > 0 && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>}
                  </div>
                  {ds.avgRating ? (
                    <span className="bg-gradient-to-r from-amber-100 to-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold border border-orange-200 hover:from-amber-200 hover:to-orange-200 transition-colors">
                      {ds.avgRating} / 5.0
                    </span>
                  ) : (
                    <span className="text-[9px] text-zinc-300 font-bold italic">No data</span>
                  )}
                </div>

                {ds.detailedScores && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <TinyScore label="Inisiatif" val={ds.detailedScores.inisiatif} />
                    <TinyScore label="Disiplin" val={ds.detailedScores.disiplin} />
                    <TinyScore label="Tugas" val={ds.detailedScores.penyelesaian_tugas} />
                    <TinyScore label="Attitude" val={ds.detailedScores.attitude} />
                    <TinyScore label="Komunikasi" val={ds.detailedScores.komunikasi} />
                    <TinyScore label="Respon" val={ds.detailedScores.respon_masukan} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Sub-Components ---

const TinyScore = ({ label, val }: { label: string, val: string }) => (
  <div className="flex justify-between items-center bg-[#FCFCFC] px-2 py-1 rounded border border-zinc-100">
    <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-tight">{label}</span>
    <span className="text-[9px] font-bold text-zinc-800">{val}</span>
  </div>
);

const TrendDataList = ({ data, cols }: { data: any[], cols: { key: string, label: string, color: string }[] }) => {
  const renderData = data;
  return (
    <div className="border-t border-zinc-100 pt-3 mt-auto">
      <div className="grid grid-cols-4 gap-2 mb-2 px-2">
        <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Month</div>
        {cols.map((c, i) => (
          <div key={i} className={`text-[9px] font-bold uppercase text-center tracking-wider ${c.color}`}>{c.label}</div>
        ))}
      </div>
      <div className="max-h-[120px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-100 pr-1">
        {renderData.map((d, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 py-1.5 border-b border-zinc-50 last:border-0 hover:bg-[#FCFCFC] rounded px-2">
            <div className="text-[10px] font-bold text-zinc-600 truncate">{d.label}</div>
            {cols.map((c, idx) => (
              <div key={idx} className="text-[10px] font-bold text-zinc-900 text-center">
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
    <span className="text-[9px] font-bold text-zinc-500 uppercase">{label}</span>
  </div>
);

const KPICard = ({ label, value, sub, gradient, keywords, statsList }: any) => (
  <div className="bg-white p-6 rounded-[20px] border border-[#EAEAEA] shadow-sm flex flex-col h-full transition-all hover:shadow-sm border border-[#EAEAEA] relative overflow-hidden group">
    {/* Decorative Gradient Background Opacity */}
    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-5 rounded-bl-full pointer-events-none transition-opacity group-hover:opacity-10`}></div>

    <div className="mb-4 relative z-10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">{label}</span>
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-sm`}>
          {/* Simple icon based on gradient type - just generic shapes for visual consistency */}
          <div className="w-3 h-3 bg-white/30 rounded-full"></div>
        </div>
      </div>
      <div className={`text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br ${gradient} tracking-tight`}>{value}</div>
      <p className="text-[10px] font-medium text-zinc-400 uppercase mt-1">{sub}</p>
    </div>

    <div className="mt-auto relative z-10">
      {keywords && keywords.length > 0 && (
        <div className="pt-3 border-t border-zinc-100">
          <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wide block mb-1.5">Top Keywords</span>
          <div className="flex flex-wrap gap-1">
            {keywords.map((k: any) => (
              <span key={k.word} className="px-1.5 py-0.5 bg-[#FCFCFC] text-zinc-600 rounded text-[9px] font-bold uppercase border border-[#EAEAEA]">
                {k.word} <span className="text-[7px] text-zinc-400">({k.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {statsList && statsList.length > 0 && (
        <div className="pt-3 border-t border-zinc-100 grid grid-cols-2 gap-3">
          {statsList.map((list: any, idx: number) => (
            <div key={idx}>
              <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wide block mb-1.5 truncate">{list.title}</span>
              <div className="flex flex-col gap-1">
                {list.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-[9px]">
                    <span className="font-bold text-zinc-600 truncate max-w-[70%]">{item.label}</span>
                    <span className="font-bold text-zinc-900 bg-[#FCFCFC] px-1 rounded">{item.count}</span>
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

const VolumeCard = ({ title, count, duration, typeSplit, gradient }: any) => {
  return (
    <div className="bg-white p-5 rounded-[20px] border border-[#EAEAEA] shadow-sm flex flex-col relative overflow-hidden group hover:shadow-md transition-all">
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${gradient}`}></div>
      <div className="flex justify-between items-center mb-4 pl-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">{title} Context</h3>
        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-[#F8F9FA] text-zinc-500`}>Volume</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-5 pl-3">
        <div>
          <div className={`text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${gradient}`}>{count}</div>
          <div className="text-[9px] font-bold text-zinc-400 uppercase">Artworks</div>
        </div>
        <div className="border-l border-zinc-100 pl-4">
          <div className="text-xl font-bold text-zinc-900">~{duration}</div>
          <div className="text-[9px] font-bold text-zinc-400 uppercase">Avg Days</div>
        </div>
      </div>
      <div className="space-y-2 mt-auto pl-3">
        {typeSplit.map((t: any) => (
          <div key={t.type}>
            <div className="flex justify-between text-[8px] font-bold text-zinc-500 uppercase mb-0.5"><span>{t.type}</span><span>{t.percentage}%</span></div>
            <div className="h-1.5 bg-[#F8F9FA] rounded-full overflow-hidden">
              <div className={`h-full bg-gradient-to-r ${gradient} opacity-80`} style={{ width: `${t.percentage}%` }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PieRow = ({ title, data, total }: any) => {
  // Use SVG for better gradients
  const size = 112; // w-28 = 7rem = 112px
  const radius = 50;
  const center = size / 2;

  let currentAngle = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          <defs>
            {data.map((d: any, i: number) => (
              <linearGradient key={`pie-grad-${i}`} id={`pie-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={d.hexGradient?.[0] || d.solid} />
                <stop offset="100%" stopColor={d.hexGradient?.[1] || d.solid} />
              </linearGradient>
            ))}
          </defs>
          {data.map((d: any, i: number) => {
            const percentage = total ? d.count / total : 0;
            if (percentage === 0) return null;

            const strokeWidth = 20; // Thickness of the donut
            const circumference = 2 * Math.PI * (size / 2 - strokeWidth / 2); // r = size/2 - strokeWidth/2
            const dashArray = `${percentage * circumference} ${circumference}`;
            const dashOffset = -currentAngle * circumference;

            currentAngle += percentage;

            // Simple approach using circle stroke for donut segments
            // This is easier than calculating paths for simple donut charts
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={size / 2 - strokeWidth / 2}
                fill="none"
                stroke={`url(#pie-grad-${i})`}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                className="transition-all duration-500 hover:opacity-90"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 m-auto w-16 h-16 bg-white rounded-full flex flex-col items-center justify-center shadow-sm z-10 pointer-events-none">
          <span className="text-lg font-bold text-zinc-900 leading-none">{total}</span>
          <span className="text-[8px] font-bold text-zinc-400 uppercase mt-0.5">Total</span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        <p className="text-[10px] font-bold text-zinc-400 uppercase mb-2 tracking-wider border-b border-zinc-100 pb-1 text-center sm:text-left">{title}</p>
        {data.map((d: any) => (
          <div key={d.type || d.context} className="flex justify-between items-center text-[10px] font-bold text-zinc-700">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${d.gradient}`}></div>
              <span className="uppercase truncate max-w-[85px]">{d.type || d.context}</span>
            </div>
            <span className="text-zinc-900 font-bold bg-[#FCFCFC] px-2 py-0.5 rounded border border-zinc-100 min-w-[3rem] text-center">
              {d.count} <span className="text-zinc-400 text-[8px] font-medium opacity-70">({total ? Math.round((d.count / total) * 100) : 0}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TrendLineChart = ({ data, keys, labels, colors }: any) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 400;
  const height = 200;
  const padding = 35;
  const maxValue = Math.max(...data.flatMap((d: any) => keys.map((k: string) => d[k])), 5);

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

        {keys.map((key: string, kIdx: number) => (
          <g key={key}>
            {/* Gradient Area Fill */}
            <path d={getAreaPath(key)} fill={`url(#grad-${kIdx})`} className="transition-all duration-300" />

            {/* Thinner Line */}
            <path
              d={getSmoothPath(key)}
              fill="none"
              stroke={colors[kIdx]}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300 shadow-sm"
            />

            {/* Permanent Nodes per Month */}
            {data.map((d: any, i: number) => (
              <circle
                key={`node-${key}-${i}`}
                cx={getX(i)}
                cy={getY(d[key])}
                r="3"
                fill="white"
                stroke={colors[kIdx]}
                strokeWidth="2"
                className="transition-all duration-300 hover:r-4"
              />
            ))}
          </g>
        ))}

        {/* Labels */}
        {data.map((d: any, i: number) => (
          <text key={i} x={getX(i)} y={height - 10} textAnchor="middle" fontSize="9" fontWeight="bold" className="fill-slate-400 uppercase tracking-tight">
            {d.label}
          </text>
        ))}

        {/* Hover Interaction Overlay */}
        {hoverIndex !== null && (
          <g>
            <line x1={getX(hoverIndex)} y1={padding} x2={getX(hoverIndex)} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 2" />
          </g>
        )}

        {/* Invisible Hit Targets */}
        {data.map((d: any, i: number) => (
          <rect key={`hit-${i}`} x={getX(i) - ((width - padding * 2) / (data.length - 1)) / 2} y={0} width={(width - padding * 2) / (data.length - 1)} height={height} fill="transparent" onMouseEnter={() => setHoverIndex(i)} />
        ))}
      </svg>

      {hoverIndex !== null && (
        <div className="absolute z-10 bg-[#1A1C20]/95 backdrop-blur-sm text-white p-3 rounded-xl shadow-sm border border-[#EAEAEA] pointer-events-none transform -translate-x-1/2 -translate-y-full border border-zinc-700/50" style={{ left: `${(getX(hoverIndex) / width) * 100}%`, top: '20px' }}>
          <p className="text-[10px] font-bold uppercase text-zinc-400 mb-2 tracking-wider text-center border-b border-zinc-700 pb-1">{data[hoverIndex].fullDate}</p>
          <div className="flex gap-4">
            {keys.map((key: string, kIdx: number) => (
              <div key={key} className="flex flex-col items-center">
                <span className="text-[9px] font-bold uppercase mb-0.5" style={{ color: colors[kIdx] }}>{labels[kIdx]}</span>
                <span className="text-sm font-bold">{data[hoverIndex][key]}</span>
              </div>
            ))}
          </div>
          <div className="absolute left-1/2 -bottom-1.5 w-3 h-3 bg-[#1A1C20] rotate-45 transform -translate-x-1/2 border-r border-b border-zinc-700/50"></div>
        </div>
      )}
    </div>
  );
};

const StackedSegment = ({ count, total, globalMax, gradient }: any) => {
  if (count === 0) return null;
  return <div className={`h-full bg-gradient-to-r ${gradient} border-r border-white/20 transition-all duration-1000`} style={{ width: `${(count / globalMax) * 100}%` }}></div>;
};

const MetricBox = ({ label, value, unit, gradient, textGradient, icon }: any) => (
  <div className={`flex flex-col items-center justify-center p-2.5 rounded-[20px] bg-gradient-to-br ${gradient} border border-white shadow-sm transition-transform hover:scale-[1.05]`}>
    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tight mb-0.5 opacity-80">{label}</span>
    <div className={`text-xl font-bold leading-none tracking-tight bg-clip-text text-transparent bg-gradient-to-br ${textGradient} flex items-center`}>
      {value}
      <span className="text-[10px] ml-0.5 opacity-60 font-bold text-zinc-400">{unit || icon}</span>
    </div>
  </div>
);

const StatBar = ({ label, value, max, gradient }: any) => (
  <div>
    <div className="flex justify-between text-[9px] font-bold text-zinc-500 uppercase mb-1 tracking-tight">
      <span>{label} Production</span>
      <span className="text-zinc-900">{value}</span>
    </div>
    <div className="h-1.5 bg-[#FCFCFC] rounded-full overflow-hidden border border-zinc-100 shadow-inner">
      <div className={`h-full bg-gradient-to-r ${gradient} transition-all duration-1000`} style={{ width: `${(value / (max || 1)) * 100}%` }}></div>
    </div>
  </div>
);

export default Dashboard;
