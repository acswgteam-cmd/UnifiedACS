
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import { AppState, WorkContext, ArtworkLog, Project, Lead, DesignerEvaluation } from '../types';
import DateRangePicker from '../components/DateRangePicker';

interface Props {
  state: AppState;
}

// --- Draggable Dashboard Widget System ---
const WIDGET_STORAGE_KEY = 'dashboard_widget_order_v2';

const DEFAULT_WIDGET_ORDER = [
  'kpi-artworks', 'kpi-projects', 'kpi-leads', 'kpi-tasks',
  'vol-project', 'vol-lead', 'vol-internal',
  'chart-artwork-trend', 'chart-context-trend', 'chart-distribution',
  'chart-dept-volume', 'heatmap-general', 'heatmap-internal', 'chart-lead-duration',
  'eval-summary',
  'team-stats',
];

const WIDGET_LABELS: Record<string, string> = {
  'kpi-artworks': '💎 Total Artworks',
  'kpi-projects': '📁 Total Projects',
  'kpi-leads': '🎯 Total Leads',
  'kpi-tasks': '📋 Total Tasks',
  'vol-project': '📊 Project Volume',
  'vol-lead': '📉 Lead Volume',
  'vol-internal': '🏠 Internal Volume',
  'chart-artwork-trend': '📈 Artwork Trend',
  'chart-context-trend': '📅 Context Trend',
  'chart-distribution': '🍕 Split Distribution',
  'chart-dept-volume': '🏢 Dept Volume',
  'heatmap-general': '🔥 General Heatmap',
  'heatmap-internal': '🔥 Internal Heatmap',
  'chart-lead-duration': '⏱️ Lead Duration',
  'eval-summary': '⭐ Eval Summary',
  'team-stats': '👥 Team Stats',
};

const DEFAULT_WIDGET_SIZES: Record<string, { w: number, h: number }> = {
  'kpi-artworks': { w: 30, h: 2 },
  'kpi-projects': { w: 30, h: 2 },
  'kpi-leads': { w: 30, h: 2 },
  'kpi-tasks': { w: 30, h: 2 },
  'vol-project': { w: 40, h: 4 },
  'vol-lead': { w: 40, h: 4 },
  'vol-internal': { w: 40, h: 4 },
  'chart-artwork-trend': { w: 40, h: 10 },
  'chart-context-trend': { w: 40, h: 10 },
  'chart-distribution': { w: 40, h: 10 },
  'chart-dept-volume': { w: 72, h: 40 },
  'heatmap-general': { w: 48, h: 12 },
  'heatmap-internal': { w: 48, h: 16 },
  'chart-lead-duration': { w: 48, h: 12 },
  'eval-summary': { w: 120, h: 5 },
  'team-stats': { w: 120, h: 5 },
};

const WIDGET_SIZE_STORAGE_KEY = 'dashboard_widget_sizes_v12';

const Dashboard: React.FC<Props> = ({ state }) => {
  const [filterStart, setFilterStart] = useState<string>('');
  const [filterEnd, setFilterEnd] = useState<string>('');

  // State for the Notes Modal
  const [viewNotes, setViewNotes] = useState<{ name: string; notes: any[]; projectEvals?: any[] } | null>(null);

  // --- Drag & Drop Layout State ---
  const [isEditMode, setIsEditMode] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(WIDGET_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        // Merge: keep saved order but add any new widgets not yet in saved
        const merged = parsed.filter((id: string) => DEFAULT_WIDGET_ORDER.includes(id));
        DEFAULT_WIDGET_ORDER.forEach(id => { if (!merged.includes(id)) merged.push(id); });
        return merged;
      }
    } catch { }
    return DEFAULT_WIDGET_ORDER;
  });

  const [widgetSizes, setWidgetSizes] = useState<Record<string, { w: number, h: number }>>(() => {
    try {
      const saved = localStorage.getItem(WIDGET_SIZE_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch { }
    return DEFAULT_WIDGET_SIZES;
  });
  const dragSrcRef = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const saveLayout = useCallback((order: string[], sizes?: any) => {
    try {
      localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(order));
      if (sizes) localStorage.setItem(WIDGET_SIZE_STORAGE_KEY, JSON.stringify(sizes));
    } catch { }
  }, []);

  const handleResize = useCallback((id: string, w: number, h: number) => {
    setWidgetSizes(prev => {
      const next = {
        w: Math.max(10, Math.min(120, w)),
        h: Math.max(10, Math.min(200, h))
      };
      const newSizes = { ...prev, [id]: next };
      saveLayout(widgetOrder, newSizes);
      return newSizes;
    });
  }, [widgetOrder, saveLayout]);

  const handleDragStart = useCallback((id: string) => {
    dragSrcRef.current = id;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragSrcRef.current && dragSrcRef.current !== id) setDragOver(id);
  }, []);

  const handleDrop = useCallback((targetId: string) => {
    const src = dragSrcRef.current;
    if (!src || src === targetId) { setDragOver(null); return; }
    setWidgetOrder(prev => {
      const next = [...prev];
      const srcIdx = next.indexOf(src);
      const tgtIdx = next.indexOf(targetId);
      next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, src);
      saveLayout(next);
      return next;
    });
    dragSrcRef.current = null;
    setDragOver(null);
  }, [saveLayout]);

  const handleDragEnd = useCallback(() => {
    dragSrcRef.current = null;
    setDragOver(null);
  }, []);

  const resetLayout = useCallback(() => {
    setWidgetOrder(DEFAULT_WIDGET_ORDER);
    setWidgetSizes(DEFAULT_WIDGET_SIZES);
    saveLayout(DEFAULT_WIDGET_ORDER, DEFAULT_WIDGET_SIZES);
  }, [saveLayout]);
  // ----------------------------------

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
    const allProjects = projects.filter(p => {
      const startMatch = !filterStart || p.start_date >= filterStart;
      const endMatch = !filterEnd || p.start_date <= filterEnd;
      return startMatch && endMatch;
    });
    const projectPICs = getTopCounts(allProjects, p => designers.find(d => d.id === p.pic_designer_id)?.name || 'Unknown');
    const projectLocs = getTopCounts(allProjects, p => (p as any).locations || (p as any).location || []);

    // --- Leads Stats (ALL Statuses) ---
    const allLeads = leads.filter(l => {
      const startMatch = !filterStart || l.order_date >= filterStart;
      const endMatch = !filterEnd || l.order_date <= filterEnd;
      return startMatch && endMatch;
    });
    const leadGrades = getTopCounts(allLeads, l => l.lead_grade);
    const leadRequesters = getTopCounts(allLeads, l => l.requester);

    // --- Internal Tasks Stats (ALL Statuses) ---
    const allInternal = internalDesigns.filter(t => {
      const targetDate = t.created_at || t.deadline || '';
      const startMatch = !filterStart || !targetDate || targetDate >= filterStart;
      const endMatch = !filterEnd || !targetDate || targetDate <= filterEnd;
      return startMatch && endMatch;
    });
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

    // --- Lead Duration by Month (avg days per lead artwork, grouped by month) ---
    const getLeadDurationByMonth = () => {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const result = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const leadLogs = filteredLogs.filter(l =>
          l.work_context === WorkContext.LEAD &&
          l.end_date &&
          l.start_date.startsWith(monthKey)
        );
        let avgDays = 0;
        let totalItems = leadLogs.length;
        if (leadLogs.length > 0) {
          const totalDays = leadLogs.reduce((acc, l) => {
            const start = new Date(l.start_date);
            const end = new Date(l.end_date!);
            return acc + (Math.max(0, (end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);
          }, 0);
          avgDays = parseFloat((totalDays / leadLogs.length).toFixed(1));
        }
        result.push({
          label: monthNames[d.getMonth()],
          fullDate: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
          avgDays,
          totalItems,
        });
      }
      return result;
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

      const projectsInvolvedCount = allProjects.filter(p =>
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
      leadDurationByMonth: getLeadDurationByMonth(),
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
      },
      contextTypeMatrix: [
        {
          ctx: WorkContext.PROJECT, label: 'Project',
          "2D Design": filteredLogs.filter(l => l.work_context === WorkContext.PROJECT && l.artwork_type === "2D Design").length,
          "3D Design": filteredLogs.filter(l => l.work_context === WorkContext.PROJECT && l.artwork_type === "3D Design").length,
          "Video": filteredLogs.filter(l => l.work_context === WorkContext.PROJECT && l.artwork_type === "Video").length,
        },
        {
          ctx: WorkContext.LEAD, label: 'Lead',
          "2D Design": filteredLogs.filter(l => l.work_context === WorkContext.LEAD && l.artwork_type === "2D Design").length,
          "3D Design": filteredLogs.filter(l => l.work_context === WorkContext.LEAD && l.artwork_type === "3D Design").length,
          "Video": filteredLogs.filter(l => l.work_context === WorkContext.LEAD && l.artwork_type === "Video").length,
        },
        {
          ctx: WorkContext.INTERNAL, label: 'Internal',
          "2D Design": filteredLogs.filter(l => l.work_context === WorkContext.INTERNAL && l.artwork_type === "2D Design").length,
          "3D Design": filteredLogs.filter(l => l.work_context === WorkContext.INTERNAL && l.artwork_type === "3D Design").length,
          "Video": filteredLogs.filter(l => l.work_context === WorkContext.INTERNAL && l.artwork_type === "Video").length,
        }
      ]
    };
  }, [state, filterStart, filterEnd]);

  const cardClass = "p-3 md:p-5 rounded-md border flex flex-col transition-all hover:border-[var(--color-hl-strong)] relative" +
    " bg-[var(--color-s1)] border-[var(--color-hl)]";
  const labelClass = "text-[10px] font-bold uppercase tracking-wider mb-1 block" +
    " text-[var(--color-ink-4)]";

  const dateLabel = (filterStart && filterEnd) ? `${filterStart}_to_${filterEnd}` : (filterStart || filterEnd ? (filterStart || filterEnd) : 'All_Time');

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-12 relative">
      {/* EVALUATION DETAIL MODAL */}
      {viewNotes && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#1A1C20]/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setViewNotes(null)}>
          <div className="bg-[var(--color-s1)] rounded-md shadow-2xl w-full max-w-2xl p-6 max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-[var(--color-hl)]">
              <div>
                <h3 className="font-bold text-[var(--color-ink)] uppercase tracking-tight">Evaluasi Designer: {viewNotes.name}</h3>
                <p className="text-[10px] text-[var(--color-ink-4)] font-bold uppercase mt-0.5">{viewNotes.projectEvals?.length || 0} Project Evaluations</p>
              </div>
              <button onClick={() => setViewNotes(null)} className="p-1.5 rounded-lg hover:bg-[var(--color-s2)] text-[var(--color-ink-4)] hover:text-[var(--color-ink-2)] transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto pr-2 space-y-4">
              {(!viewNotes.projectEvals || viewNotes.projectEvals.length === 0) ? (
                <p className="text-center text-xs text-[var(--color-ink-4)] italic py-8">Belum ada evaluasi untuk designer ini.</p>
              ) : (
                <>
                  {/* Per-project evaluation cards */}
                  {viewNotes.projectEvals.map((pe: any, idx: number) => (
                    <div key={idx} className="bg-[var(--color-s2)] p-4 rounded-xl border border-[var(--color-hl)]">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[11px] font-bold text-[var(--color-ink)] uppercase truncate max-w-[60%]">{pe.project_name}</span>
                        <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-[var(--color-ink)] border border-indigo-200">{pe.avg}</span>
                      </div>
                      {pe.evaluator_name && (
                        <p className="text-[9px] font-bold text-[var(--color-ink-4)] uppercase mb-2">Evaluator: {pe.evaluator_name}</p>
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
                          const colorClass = score >= 4 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : score >= 3 ? 'bg-blue-100 text-blue-700 border-blue-200' : score >= 2 ? 'bg-amber-100 text-amber-700 border-amber-200' : score > 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-[var(--color-s2)] text-[var(--color-ink-4)] border-[var(--color-hl)]';
                          return (
                            <div key={c.key} className={`flex flex-col items-center py-1.5 px-1 rounded-lg border ${colorClass}`}>
                              <span className="text-[7px] font-bold uppercase tracking-tight">{c.label}</span>
                              <span className="text-[11px] font-bold">{score || '-'}</span>
                            </div>
                          );
                        })}
                      </div>
                      {pe.masukan && (
                        <div className="mt-2 pt-2 border-t border-[var(--color-hl)]">
                          <span className="text-[8px] font-bold text-[var(--color-ink-4)] uppercase tracking-wider">Masukan Pengembangan</span>
                          <p className="text-xs text-[var(--color-ink-2)] font-medium leading-relaxed italic mt-1">"{pe.masukan}"</p>
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
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-20 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight uppercase" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>Executive Studio Hub</h1>
          <p className="text-sm font-medium" style={{ color: 'var(--color-ink-3)' }}>Creative Production Insights.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker
            startDate={filterStart}
            endDate={filterEnd}
            onChange={(start, end) => { setFilterStart(start); setFilterEnd(end); }}
            onReset={() => { setFilterStart(''); setFilterEnd(''); }}
            placeholder="Filter Date Range"
          />
          {/* Edit Layout Toggle */}
          {isEditMode && (
            <button
              onClick={resetLayout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors btn-ghost border border-[var(--color-hl)]"
              title="Reset ke layout default"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
          <button
            onClick={() => setIsEditMode(v => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all ${isEditMode
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'btn-secondary'
              }`}
            title={isEditMode ? 'Selesai edit layout' : 'Edit & susun ulang layout dashboard'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {isEditMode
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />}
            </svg>
            <span className="hidden sm:inline">{isEditMode ? 'Selesai' : 'Edit Layout'}</span>
          </button>
          <button
            onClick={() => handleDownloadZip(dateLabel, analytics.teamStats)}
            className="flex items-center gap-2 px-3 py-1.5 btn-primary text-sm download-btn"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden sm:inline">Export ZIP</span>
          </button>
        </div>
      </header>

      {/* Jiggle Animation Style */}
      <style>{`
        @keyframes jiggle {
          0% { transform: rotate(-0.5deg); }
          50% { transform: rotate(0.5deg); }
          100% { transform: rotate(-0.5deg); }
        }
        .animate-jiggle {
          animation: jiggle 0.2s ease-in-out infinite;
        }
      `}</style>

      {/* Edit Mode Banner */}
      {isEditMode && (
        <div className="flex items-center gap-3 px-4 py-3 border rounded-lg text-sm font-medium animate-slide-up" style={{ backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
          <div className="flex flex-col">
            <span className="font-semibold">Mode Edit Aktif</span>
            <span style={{ fontSize: 11, color: 'var(--color-ink-3)' }}>Setiap card kini bisa dipindah. Layout tersimpan otomatis.</span>
          </div>
        </div>
      )}

      <div
        id="dashboard-content"
        className="grid grid-flow-row-dense gap-2 md:gap-3 pt-2"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(120, minmax(0, 1fr))',
          gridAutoRows: 'minmax(10px, auto)'
        }}
      >
        {widgetOrder.map(widgetId => {
          const size = widgetSizes[widgetId] || { w: 120, h: 20 };
          const combinedStyle = {
            gridColumn: `span ${size.w} / span ${size.w}`,
            gridRow: `span ${size.h} / span ${size.h}`
          };

          return (
            <DraggableWidget
              key={widgetId}
              id={widgetId}
              isEditMode={isEditMode}
              isDragOver={dragOver === widgetId}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onResize={handleResize}
              label={WIDGET_LABELS[widgetId]}
              style={combinedStyle}
              size={size}
            >
              {widgetId === 'kpi-artworks' && (
                <KPICard
                  id="kpi-artworks" filename={`Total_Artworks_${dateLabel}`}
                  label="Total Artworks"
                  value={analytics.totalArtworks}
                  sub="Filtered Output"
                  gradient="from-orange-400 to-red-500"
                  keywords={analytics.topKeywords}
                />
              )}
              {widgetId === 'kpi-projects' && (
                <KPICard
                  id="kpi-projects" filename={`Total_Projects_${dateLabel}`}
                  label="Total Projects"
                  value={analytics.totalProjectsCount}
                  sub="All Statuses"
                  gradient="from-blue-400 to-indigo-600"
                  statsList={[
                    { title: "Top 3 PIC", items: analytics.statsData.projects.pics },
                    { title: "Top 3 Locations", items: analytics.statsData.projects.locs }
                  ]}
                />
              )}
              {widgetId === 'kpi-leads' && (
                <KPICard
                  id="kpi-leads" filename={`Total_Leads_${dateLabel}`}
                  label="Total Leads"
                  value={analytics.totalLeadsCount}
                  sub="All Statuses"
                  gradient="from-emerald-400 to-teal-600"
                  statsList={[
                    { title: "By Grade", items: analytics.statsData.leads.grades },
                    { title: "Top Requesters", items: analytics.statsData.leads.reqs }
                  ]}
                />
              )}
              {widgetId === 'kpi-tasks' && (
                <KPICard
                  id="kpi-tasks" filename={`Total_Tasks_${dateLabel}`}
                  label="Total Tasks"
                  value={analytics.totalInternalCount}
                  sub="All Statuses"
                  gradient="from-purple-400 to-fuchsia-600"
                  statsList={[
                    { title: "Top Depts", items: analytics.statsData.internal.depts },
                    { title: "Top Requesters", items: analytics.statsData.internal.reqs }
                  ]}
                />
              )}

              {widgetId === 'vol-project' && (
                <VolumeCard
                  id="vol-project" filename={`Volume_Project_${dateLabel}`}
                  title="Project"
                  count={analytics.artworksProject}
                  duration={analytics.avgDurProj}
                  typeSplit={analytics.projectTypeSplit}
                  gradient="from-blue-500 to-cyan-500"
                />
              )}
              {widgetId === 'vol-lead' && (
                <VolumeCard
                  id="vol-lead" filename={`Volume_Lead_${dateLabel}`}
                  title="Lead"
                  count={analytics.artworksLead}
                  duration={analytics.avgDurLead}
                  typeSplit={analytics.leadTypeSplit}
                  gradient="from-emerald-500 to-green-500"
                />
              )}
              {widgetId === 'vol-internal' && (
                <VolumeCard
                  id="vol-internal" filename={`Volume_Internal_${dateLabel}`}
                  title="Internal"
                  count={analytics.artworksInternal}
                  duration={analytics.avgDurInt}
                  typeSplit={analytics.internalTypeSplit}
                  gradient="from-purple-500 to-pink-500"
                />
              )}

              {widgetId === 'chart-artwork-trend' && (
                <section id="chart-artwork-trend" className={cardClass + " h-full"}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-[var(--color-ink)] uppercase tracking-tight">Artwork Type Trend</h2>
                    <div className="flex gap-2">
                      <LegendDot color="bg-blue-500" label="2D" />
                      <LegendDot color="bg-emerald-500" label="3D" />
                      <LegendDot color="bg-orange-500" label="Video" />
                    </div>
                  </div>
                  <div className="w-full mb-4">
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
              )}

              {widgetId === 'chart-context-trend' && (
                <section id="chart-context-trend" className={cardClass + " h-full"}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-[var(--color-ink)] uppercase tracking-tight">Work Context Trend</h2>
                    <div className="flex gap-2">
                      <LegendDot color="bg-blue-600" label="Proj" />
                      <LegendDot color="bg-emerald-600" label="Lead" />
                      <LegendDot color="bg-purple-600" label="Int" />
                    </div>
                  </div>
                  <div className="w-full mb-4">
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
              )}

              {widgetId === 'chart-distribution' && (
                <section id="chart-distribution" className={cardClass + " h-full"}>
                  <h2 className="text-sm font-bold text-[var(--color-ink)] uppercase tracking-tight mb-4">Distribution Split</h2>
                  <div className="flex flex-col gap-8 h-full justify-center py-4">
                    <PieRow title="By Artwork Type" data={analytics.globalTypeSplit} total={analytics.totalArtworks} />
                    <div className="h-px bg-[var(--color-s2)]"></div>
                    <PieRow title="By Work Context" data={analytics.globalContextSplit} total={analytics.totalArtworks} />
                  </div>
                </section>
              )}

              {widgetId === 'chart-dept-volume' && (
                <section id="chart-dept-volume" className={cardClass + " h-full"}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex flex-col">
                      <h2 className="text-sm font-bold text-[var(--color-ink)] uppercase tracking-tight">Department Request Volume</h2>
                      <span className="text-[10px] text-[var(--color-ink-4)] font-bold uppercase tracking-wide">Internal Context Only</span>
                    </div>
                    <div className="flex gap-4">
                      <LegendDot color="bg-blue-500" label="2D" />
                      <LegendDot color="bg-emerald-500" label="3D" />
                      <LegendDot color="bg-orange-500" label="Video" />
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                      <div className="space-y-6">
                        {analytics.departmentStats.length === 0 ? (
                          <div className="text-center py-8 text-xs font-bold text-[var(--color-ink-4)] italic border border-dashed border-[var(--color-hl)] rounded-xl">
                            No internal department activity found in this period.
                          </div>
                        ) : analytics.departmentStats.map(dept => {
                          const deptTotal = dept.counts.total || 0;
                          const globalMax = Math.max(...analytics.departmentStats.map(d => d.counts.total)) || 1;
                          const percentage = analytics.artworksInternal ? Math.round((deptTotal / analytics.artworksInternal) * 100) : 0;

                          return (
                            <div key={dept.id} className="grid grid-cols-3 md:grid-cols-5 items-center gap-2 md:gap-4">
                              <div className="col-span-1 min-w-0">
                                <p className="text-xs font-bold text-[var(--color-ink)] uppercase truncate leading-none mb-1">{dept.department_name}</p>
                                <p className="text-[9px] font-bold text-[var(--color-ink-4)] uppercase tracking-tight">{deptTotal} Items</p>
                              </div>
                              <div className="col-span-1 hidden md:flex md:flex-col md:gap-2">
                                <div className="h-3.5 bg-[var(--color-s2)] rounded-full flex border border-[var(--color-hl)] overflow-hidden shadow-inner">
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
                              <div className="col-span-1 flex flex-wrap gap-1.5 md:hidden">
                                <span className="text-blue-600 text-[9px] font-bold">2D:{dept.counts["2D Design"]}</span>
                                <span className="text-emerald-600 text-[9px] font-bold">3D:{dept.counts["3D Design"]}</span>
                                <span className="text-orange-600 text-[9px] font-bold">V:{dept.counts["Video"]}</span>
                              </div>
                              <div className="col-span-1 text-right flex flex-col items-end">
                                <span className="text-xs font-bold text-[var(--color-ink)] bg-[var(--color-s2)] px-2 py-1 rounded-md border border-[var(--color-hl)]">
                                  {percentage}%
                                </span>
                                <span className="text-[9px] font-bold text-[var(--color-ink-4)] mt-0.5 hidden md:block">{deptTotal} / {analytics.artworksInternal}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {widgetId === 'heatmap-general' && (
                <section id="heatmap-general" className={cardClass + " h-full"}>
                  <div className="flex flex-col mb-4">
                    <h2 className="text-sm font-bold text-[var(--color-ink)] uppercase tracking-tight">Heatmap General Context</h2>
                    <span className="text-[10px] text-[var(--color-ink-4)] font-bold uppercase tracking-wide">Volume by Context</span>
                  </div>
                  <div className="overflow-x-auto overflow-y-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200 pr-2 flex-col flex-1 flex justify-center">
                    <div className="min-w-fit w-full">
                      <div className="flex flex-col gap-[6px] w-full pt-2">
                        {["2D Design", "3D Design", "Video"].map(type => {
                          const maxVal = Math.max(...analytics.contextTypeMatrix.map(c => (c as any)[type] || 0), 1);
                          const colorKey = type === '2D Design' ? 'emerald' : type === '3D Design' ? 'orange' : 'purple';
                          return (
                            <div key={type} className="flex flex-row items-center gap-[4px] md:gap-[6px]">
                              <div className="flex-shrink-0 w-10 md:w-24 text-[8px] md:text-[10px] font-semibold text-[var(--color-ink-3)] uppercase tracking-tight text-right pr-1 md:pr-2">
                                {type === '2D Design' ? '2D' : type === '3D Design' ? '3D' : 'VDO'}
                              </div>
                              <div className="flex flex-1 gap-[4px] md:gap-[6px]">
                                {analytics.contextTypeMatrix.map(c => {
                                  const val = (c as any)[type] || 0;
                                  const intensity = val / maxVal;
                                  let bgClass = "bg-[var(--color-s2)] border border-[var(--color-hl)]";
                                  let textColor = "text-[var(--color-ink-4)] opacity-40";
                                  if (val > 0) {
                                    if (intensity > 0.8) { bgClass = `bg-${colorKey}-600 border-none`; textColor = "text-white"; }
                                    else if (intensity > 0.6) { bgClass = `bg-${colorKey}-500 border-none`; textColor = "text-white"; }
                                    else if (intensity > 0.4) { bgClass = `bg-${colorKey}-400 border-none`; textColor = "text-white"; }
                                    else if (intensity > 0.2) { bgClass = `bg-${colorKey}-300 border-none`; textColor = "text-black"; }
                                    else { bgClass = `bg-${colorKey}-200 border-none`; textColor = "text-black"; }
                                  }
                                  return (
                                    <div key={c.ctx} className={`flex-1 h-7 md:h-10 min-w-[20px] md:min-w-[28px] rounded-[4px] flex items-center justify-center text-[8px] md:text-[10px] font-bold transition-all hover:opacity-80 ${bgClass} ${val > 0 ? textColor : ''} relative group`} title={`${c.label} - ${type}: ${val}`}>
                                      <span className={val > 0 ? "opacity-100" : "opacity-30 text-[var(--color-ink-4)]"}>{val}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex flex-row items-center gap-[4px] md:gap-[6px] mt-1">
                          <div className="flex-shrink-0 w-10 md:w-24"></div>
                          <div className="flex flex-1 gap-[4px] md:gap-[6px]">
                            {analytics.contextTypeMatrix.map(c => (
                              <div key={c.ctx} className="flex-1 text-center text-[9px] font-semibold text-[var(--color-ink-4)] uppercase tracking-tight truncate" title={c.label}>{c.label}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {widgetId === 'heatmap-internal' && (
                <section id="heatmap-internal" className={cardClass + " h-full"}>
                  <div className="flex flex-col mb-4">
                    <h2 className="text-sm font-bold text-[var(--color-ink)] uppercase tracking-tight">Heatmap Artwork Internal</h2>
                    <span className="text-[10px] text-[var(--color-ink-4)] font-bold uppercase tracking-wide">Volume by Dept & Type</span>
                  </div>
                  <div className="overflow-x-auto overflow-y-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200 pr-2 flex-col flex-1 flex justify-center">
                    <div className="min-w-fit w-full">
                      {analytics.departmentStats.length === 0 ? (
                        <div className="text-center py-8 text-xs font-bold text-[var(--color-ink-4)] italic border border-dashed border-[var(--color-hl)] rounded-xl text-center w-full">
                          No internal activity found.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-[6px] w-full pt-2">
                          {["2D Design", "3D Design", "Video"].map(type => {
                            const maxVal = Math.max(...analytics.departmentStats.map(d => (d.counts as any)[type] || 0), 1);
                            const colorKey = type === '2D Design' ? 'cyan' : type === '3D Design' ? 'rose' : 'blue';
                            return (
                              <div key={type} className="flex flex-row items-center gap-[4px] md:gap-[6px]">
                                <div className="flex-shrink-0 w-10 md:w-24 text-[8px] md:text-[10px] font-semibold text-[var(--color-ink-3)] uppercase tracking-tight text-right pr-1 md:pr-2">
                                  {type === '2D Design' ? '2D' : type === '3D Design' ? '3D' : 'VDO'}
                                </div>
                                <div className="flex flex-1 gap-[4px] md:gap-[6px]">
                                  {analytics.departmentStats.map(d => {
                                    const val = (d.counts as any)[type] || 0;
                                    const intensity = val / maxVal;
                                    let bgClass = "bg-[var(--color-s2)] border border-[var(--color-hl)]";
                                    let textColor = "text-[var(--color-ink-4)] opacity-40";
                                    if (val > 0) {
                                      if (intensity > 0.8) { bgClass = `bg-${colorKey}-600 border-none`; textColor = "text-white"; }
                                      else if (intensity > 0.6) { bgClass = `bg-${colorKey}-500 border-none`; textColor = "text-white"; }
                                      else if (intensity > 0.4) { bgClass = `bg-${colorKey}-400 border-none`; textColor = "text-white"; }
                                      else if (intensity > 0.2) { bgClass = `bg-${colorKey}-300 border-none`; textColor = "text-black"; }
                                      else { bgClass = `bg-${colorKey}-200 border-none`; textColor = "text-black"; }
                                    }
                                    return (
                                      <div key={d.id} className={`flex-1 h-7 md:h-10 min-w-[20px] md:min-w-[28px] rounded-[4px] flex items-center justify-center text-[8px] md:text-[10px] font-bold transition-all hover:opacity-80 ${bgClass} ${val > 0 ? textColor : ''} relative group`} title={`${d.department_name} - ${type}: ${val}`}>
                                        <span className={val > 0 ? "opacity-100" : "opacity-30 text-[var(--color-ink-4)]"}>{val}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          <div className="flex flex-row items-center gap-[4px] md:gap-[6px] mt-1">
                            <div className="flex-shrink-0 w-10 md:w-24"></div>
                            <div className="flex flex-1 gap-[4px] md:gap-[6px]">
                              {analytics.departmentStats.map(d => (
                                <div key={d.id} className="flex-1 text-center text-[9px] font-semibold text-[var(--color-ink-4)] capitalize truncate" title={d.department_name}>{d.department_name.split(' ')[0]}</div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {widgetId === 'chart-lead-duration' && (
                <section id="chart-lead-duration" className="bg-white p-3 md:p-4 rounded-md border border-[var(--color-hl)] shadow-sm flex flex-col h-full transition-all hover:shadow-md relative">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-bold text-[var(--color-ink)] uppercase tracking-tight">Lead Duration per Month</h2>
                    <span className="text-[10px] text-[var(--color-ink-4)] font-bold uppercase tracking-wide">Avg Processing Days</span>
                  </div>
                  <LeadDurationBarChart data={analytics.leadDurationByMonth} />
                </section>
              )}

              {widgetId === 'eval-summary' && (
                <section id="eval-summary" className="bg-[var(--color-s1)] p-4 rounded-md border border-[var(--color-hl)] shadow-card flex flex-col h-full animate-slide-up hover:border-[var(--color-hl-2)] transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col">
                      <h2 className="text-[12px] font-medium text-[var(--color-ink-2)] tracking-tight">Evaluation Summary</h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 flex-1">
                    <div className="bg-[var(--color-s2)] p-3 rounded-md border border-[var(--color-hl)] flex flex-col h-full hover:border-[var(--color-hl-2)] transition-all">
                      <div className="mb-4">
                        <span className="text-[11px] text-[var(--color-ink-3)] font-medium mb-1 block">Nilai Overall Review</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-semibold text-[var(--color-ink)] tracking-tight font-display">{analytics.globalEvalAverage}</span>
                          <span className="text-[12px] font-medium text-[var(--color-ink-4)]">/ 5.0</span>
                        </div>
                      </div>
                      <h3 className="text-[10px] text-[var(--color-ink-3)] font-medium mb-2">Top 5 Projects</h3>
                      <div className="mt-auto flex flex-col border border-[var(--color-hl)] rounded-md overflow-hidden bg-[var(--color-s1)]">
                        {analytics.evalProjectSummary.slice(0, 5).map((p: any, idx: number) => (
                          <div key={idx} className={`flex justify-between items-center text-[11px] p-2 ${idx !== Math.min(analytics.evalProjectSummary.length, 5) - 1 ? 'border-b border-[var(--color-hl)]' : ''}`}>
                            <span className="font-medium text-[var(--color-ink-2)] truncate max-w-[70%]">{p.projectName}</span>
                            <span className="font-medium text-[var(--color-ink)] bg-[var(--color-s3)] px-1.5 py-0.5 rounded">{p.avgScore}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-[var(--color-s2)] p-3 rounded-md border border-[var(--color-hl)] flex flex-col h-full hover:border-[var(--color-hl-2)] transition-all">
                      <h3 className="text-[11px] text-[var(--color-ink-3)] font-medium mb-3">Nilai Kategori</h3>
                      <div className="mt-auto flex flex-col border border-[var(--color-hl)] rounded-md overflow-hidden bg-[var(--color-s1)]">
                        {analytics.evalCategorySummary.map((c: any, idx: number) => (
                          <div key={idx} className={`flex justify-between items-center text-[11px] p-2 ${idx !== analytics.evalCategorySummary.length - 1 ? 'border-b border-[var(--color-hl)]' : ''}`}>
                            <span className="font-medium text-[var(--color-ink-2)]">{c.category}</span>
                            <span className="font-medium text-[var(--color-ink)] bg-[var(--color-s3)] px-1.5 py-0.5 rounded">{c.avgScore}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-[var(--color-s2)] p-3 rounded-md border border-[var(--color-hl)] flex flex-col h-full hover:border-[var(--color-hl-2)] transition-all overflow-hidden">
                      <h3 className="text-[11px] text-[var(--color-ink-3)] font-medium mb-3">Top Keywords</h3>
                      <div className="flex flex-col gap-3 mt-auto flex-1 overflow-y-auto custom-scrollbar pr-1">
                        <div>
                          <span className="text-[10px] font-medium text-[var(--color-ink-4)] mb-1.5 block">2-Word Bigrams</span>
                          <div className="flex flex-wrap gap-1.5">
                            {analytics.topDevKeywords2.slice(0, 8).map((k: any, idx: number) => (
                              <span key={`2w-${idx}`} className="px-1.5 py-0.5 bg-[var(--color-s1)] text-[var(--color-ink-2)] rounded text-[10px] font-medium border border-[var(--color-hl)]">
                                {k.word} <span className="text-[9px] text-[var(--color-ink-4)] ml-1">{k.count}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="h-px bg-[var(--color-hl)]"></div>
                        <div>
                          <span className="text-[10px] font-medium text-[var(--color-ink-4)] mb-1.5 block">3-Word Trigrams</span>
                          <div className="flex flex-wrap gap-1.5">
                            {analytics.topDevKeywords3.slice(0, 5).map((k: any, idx: number) => (
                              <span key={`3w-${idx}`} className="px-1.5 py-0.5 bg-[var(--color-ink)] text-[var(--canvas)] rounded text-[10px] font-medium">
                                {k.word} <span className="text-[9px] opacity-70 ml-1">{k.count}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {widgetId === 'team-stats' && (
                <section id="team-stats" className="col-span-12">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
                    <span className="text-[12px] font-medium text-[var(--color-ink-2)] tracking-tight">Team Output & Performance</span>
                    <Link
                      to="/admin/world"
                      title="Open ACS World"
                      className="flex items-center gap-1.5 transition-all hover:scale-105"
                      style={{
                        padding: '3px 8px',
                        borderRadius: 5,
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)',
                        border: '1px solid rgba(99,102,241,0.28)',
                        textDecoration: 'none',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(99,102,241,0.28) 0%, rgba(139,92,246,0.28) 100%)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)'; }}
                    >
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                        <polygon points="7,1 13,4.5 13,9.5 7,13 1,9.5 1,4.5" fill="rgba(99,102,241,0.3)" stroke="rgba(165,180,252,0.8)" strokeWidth="1" />
                        <polygon points="7,1 13,4.5 7,8 1,4.5" fill="rgba(99,102,241,0.5)" stroke="rgba(165,180,252,0.5)" strokeWidth="0.5" />
                        <circle cx="7" cy="7" r="1.5" fill="rgba(165,180,252,0.9)" />
                      </svg>
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(165,180,252,0.8)', letterSpacing: '0.06em', fontFamily: 'monospace' }}>ACS WORLD</span>
                    </Link>
                  </div>
                  <div className="flex overflow-x-auto flex-nowrap gap-4 md:gap-5 mt-3 pb-4 snap-x scrollbar-thin scrollbar-thumb-[var(--color-hl-2)]">
                    {analytics.teamStats.map(ds => (
                      <div key={ds.id} id={`team-stat-${ds.id}`} className="relative flex-shrink-0 w-[260px] md:w-[280px] snap-start bg-[var(--color-s1)] p-4 rounded-md border border-[var(--color-hl)] shadow-card group hover:border-[var(--color-hl-2)] transition-colors">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-8 h-8 rounded bg-[var(--color-s2)] text-[var(--color-ink)] border border-[var(--color-hl)] flex items-center justify-center font-semibold text-sm transition-colors group-hover:border-[var(--color-ink-4)] shadow-sm">
                            {ds.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-[12px] font-semibold text-[var(--color-ink)] truncate tracking-tight">{ds.name}</h4>
                            <p className="text-[11px] text-[var(--color-ink-3)] font-medium">{ds.role}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-5">
                          <MetricBox label="Projects" value={ds.uniqueProjectsInvolved} color="cyan" />
                          <MetricBox label="Leads" value={ds.uniqueLeads} color="rose" />
                          <MetricBox label="Lead Days" value={ds.avgLeadDuration} unit="d" color="orange" />
                        </div>
                        <div className="space-y-3 pt-4 border-t border-[var(--color-hl)]">
                          <StatBar label="Project" value={ds.projectArtworks} max={ds.totalArtworks} color="#06b6d4" />
                          <StatBar label="Lead" value={ds.leadArtworks} max={ds.totalArtworks} color="#f43f5e" />
                          <StatBar label="Internal" value={ds.internalArtworks} max={ds.totalArtworks} color="#f59e0b" />
                        </div>
                        <div className="mt-5 pt-3 border-t border-[var(--color-hl)] flex justify-between items-center">
                          <span className="text-[11px] font-medium text-[var(--color-ink-3)]">Total Logged</span>
                          <span className="text-lg font-semibold text-[var(--color-ink)] tracking-tight font-display">{ds.totalArtworks}</span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-dashed border-[var(--color-hl)]">
                          <div
                            className="flex justify-between items-center mb-2 cursor-pointer hover:bg-[var(--color-s2)] rounded px-2 py-1 -mx-2 transition-colors"
                            onClick={() => setViewNotes({ name: ds.name, notes: ds.evalNotes, projectEvals: ds.projectEvalDetails })}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-medium text-[var(--color-ink-4)]">Designer Eval</span>
                              {ds.evalNotes.length > 0 && <span className="w-1.5 h-1.5 bg-[#f43f5e] rounded-full"></span>}
                            </div>
                            {ds.avgRating ? (
                              <span className="bg-[var(--color-s2)] text-[var(--color-ink)] px-1.5 py-0.5 rounded text-[10px] font-medium border border-[var(--color-hl)] group-hover:border-[var(--color-hl-2)] transition-colors">
                                {ds.avgRating} / 5.0
                              </span>
                            ) : (
                              <span className="text-[10px] text-[var(--color-ink-4)] font-medium">No data</span>
                            )}
                          </div>
                          {ds.detailedScores && (
                            <div className="grid grid-cols-2 gap-1.5 mt-2">
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
                </section>
              )}
            </DraggableWidget>
          );
        })}
      </div>
    </div>
  );
};

// --- Sub-Components ---

// DraggableWidget: wraps each dashboard section row for drag-and-drop reordering
interface DraggableWidgetProps {
  id: string;
  isEditMode: boolean;
  isDragOver: boolean;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (id: string) => void;
  onDragEnd: () => void;
  onResize?: (id: string, dw: number, dh: number) => void;
  label: string;
  className?: string;
  style?: React.CSSProperties;
  size?: { w: number, h: number };
  children: React.ReactNode;
}

const DraggableWidget: React.FC<DraggableWidgetProps> = ({
  id, isEditMode, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd, onResize, label, className = "", style, size = { w: 120, h: 4 }, children
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.w;
    const startH = size.h;

    const container = document.getElementById('dashboard-content');
    if (!container || !widgetRef.current) return;

    const colWidth = container.offsetWidth / 120;
    const rowHeight = 10; // Match minmax(10px, auto)

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const dw = Math.round(dx / colWidth);
      const dh = Math.round(dy / rowHeight);

      const newW = Math.max(10, Math.min(120, startW + dw));
      const newH = Math.max(10, Math.min(200, startH + dh));

      if (newW !== size.w || newH !== size.h) {
        onResize?.(id, newW, newH);
      }
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      ref={widgetRef}
      draggable={isEditMode && !isResizing}
      onDragStart={() => onDragStart(id)}
      onDragOver={(e) => onDragOver(e, id)}
      onDrop={() => onDrop(id)}
      onDragEnd={onDragEnd}
      style={style}
      className={`transition-all duration-300 relative ${className} ${isEditMode
          ? 'cursor-grab active:cursor-grabbing z-20 '
          : ''
        } ${isDragOver
          ? 'ring-4 ring-blue-400 ring-offset-4 rounded-md scale-[0.98] opacity-40 bg-blue-50'
          : ''
        } ${isResizing ? ' z-50 scale-[1.01]' : ''} group/widget`}
    >
      {isEditMode && (
        <>
          {/* Exact iPhone-style Thick Rounded Corner Resize Handle */}
          <div
            className="absolute -bottom-1.5 -right-1.5 w-10 h-10 cursor-nwse-resize z-50 flex items-end justify-end p-1 group/handle"
            onMouseDown={handleResizeStart}
          >
            <div className="w-7 h-7 border-r-[7px] border-b-[7px] border-[var(--color-hl-strong)]/90 rounded-br-[18px] group-hover/handle:border-white transition-colors"></div>
            {/* Inner highlight to make it look 'thick' and 'blobby' */}
            <div className="absolute bottom-[5px] right-[5px] w-6 h-6 border-r-[3px] border-b-[3px] border-white/40 rounded-br-[14px]"></div>
          </div>
        </>
      )}
      <div className={`${isEditMode ? 'pointer-events-none' : ''} h-full`}>
        {children}
      </div>
    </div>
  );
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fixClonedStyles = (clonedDoc: Document) => {
  const allElements = clonedDoc.querySelectorAll('*');
  allElements.forEach(el => {
    if (!(el instanceof HTMLElement)) return;

    // 1. Fix gradient text — the big invisible numbers
    // html2canvas cannot render background-clip:text, so gradient shows as solid block
    // covering the text. We must remove the gradient and set a solid text color.
    if (el.classList.contains('text-transparent') || el.classList.contains('bg-clip-text')) {
      el.style.setProperty('-webkit-text-fill-color', '#1e293b', 'important');
      el.style.setProperty('-webkit-background-clip', 'initial', 'important');
      el.style.setProperty('background-clip', 'initial', 'important');
      el.style.setProperty('color', '#1e293b', 'important');
      el.style.setProperty('background-image', 'none', 'important');
      el.style.setProperty('background', 'none', 'important');
    }

    // 2. Hide decorative gradient blobs (the rounded circle in KPI corners)
    // html2canvas renders opacity-5 at full opacity, causing visual blockage
    if (el.classList.contains('pointer-events-none') && el.classList.contains('rounded-bl-full')) {
      el.style.setProperty('display', 'none', 'important');
    }

    // 3. Fix any element with very low opacity that html2canvas might misrender
    if (el.classList.contains('opacity-5') || el.classList.contains('opacity-10')) {
      el.style.setProperty('opacity', '0.05', 'important');
    }

    // 4. Fix text truncation — remove ellipsis/clipping so full text shows
    if (el.classList.contains('truncate')) {
      el.style.setProperty('overflow', 'visible', 'important');
      el.style.setProperty('text-overflow', 'clip', 'important');
      el.style.setProperty('white-space', 'normal', 'important');
    }

    // 5. Fix overflow-hidden on card containers — prevents content clipping
    if (el.classList.contains('overflow-hidden')) {
      el.style.setProperty('overflow', 'visible', 'important');
    }

    // 6. Remove max-w constraints that limit text width
    const classStr = el.className;
    if (typeof classStr === 'string' && classStr.match(/max-w-\[/)) {
      el.style.setProperty('max-width', 'none', 'important');
    }
  });
};

const handleDownloadZip = async (dateLabel: string, teamStats: any[]) => {
  const zip = new JSZip();
  const folder = zip.folder(`Dashboard_Cards_${dateLabel}`);
  if (!folder) return;

  const exportItems = [
    { id: 'kpi-artworks', name: `Total_Artworks_${dateLabel}.png` },
    { id: 'kpi-projects', name: `Total_Projects_${dateLabel}.png` },
    { id: 'kpi-leads', name: `Total_Leads_${dateLabel}.png` },
    { id: 'kpi-tasks', name: `Total_Tasks_${dateLabel}.png` },
    { id: 'vol-project', name: `Volume_Project_${dateLabel}.png` },
    { id: 'vol-lead', name: `Volume_Lead_${dateLabel}.png` },
    { id: 'vol-internal', name: `Volume_Internal_${dateLabel}.png` },
    { id: 'chart-artwork-trend', name: `Artwork_Type_Trend_${dateLabel}.png` },
    { id: 'chart-context-trend', name: `Work_Context_Trend_${dateLabel}.png` },
    { id: 'chart-distribution', name: `Distribution_Split_${dateLabel}.png` },
    { id: 'chart-dept-volume', name: `Department_Request_Volume_${dateLabel}.png` },
    { id: 'heatmap-general', name: `Heatmap_General_Context_${dateLabel}.png` },
    { id: 'heatmap-internal', name: `Heatmap_Artwork_Internal_${dateLabel}.png` },
    { id: 'chart-lead-duration', name: `Lead_Duration_Per_Month_${dateLabel}.png` },
    { id: 'eval-summary', name: `Evaluation_Summary_${dateLabel}.png` },
    ...teamStats.map(ds => ({
      id: `team-stat-${ds.id}`,
      name: `Team_Stat_${ds.name.replace(/\s+/g, '_')}_${dateLabel}.png`
    }))
  ];

  const buttons = document.querySelectorAll<HTMLElement>('.download-btn');
  buttons.forEach(btn => btn.style.display = 'none');

  let capturedCount = 0;

  try {
    for (const item of exportItems) {
      const element = document.getElementById(item.id);
      if (!element) continue;

      try {
        const canvas = await html2canvas(element, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: element.scrollWidth + 40,
          windowHeight: element.scrollHeight + 40,
          onclone: (_clonedDoc) => {
            fixClonedStyles(_clonedDoc);
          }
        });
        const dataUri = canvas.toDataURL('image/png');
        const base64Data = dataUri.replace(/^data:image\/png;base64,/, "");
        folder.file(item.name, base64Data, { base64: true });
        capturedCount++;
      } catch (cardError) {
        console.warn(`Skipped card "${item.name}":`, cardError);
      }

      // Small delay between captures to ease memory pressure
      await delay(150);
    }

    if (capturedCount > 0) {
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `Dashboard_Cards_${dateLabel}.zip`);
    } else {
      console.error("No cards were captured.");
    }
  } catch (error) {
    console.error("Error generating ZIP:", error);
  } finally {
    buttons.forEach(btn => btn.style.display = '');
  }
};

const TinyScore = ({ label, val }: { label: string, val: string }) => (
  <div className="flex justify-between items-center bg-[var(--color-s2)] px-1.5 py-0.5 rounded">
    <span className="text-[9px] font-medium text-[var(--color-ink-3)]">{label}</span>
    <span className="text-[10px] font-semibold text-[var(--color-ink)]">{val}</span>
  </div>
);

const TrendDataList = ({ data, cols }: { data: any[], cols: { key: string, label: string, color: string }[] }) => {
  const renderData = data;
  return (
    <div className="border-t border-[var(--color-hl)] pt-3 mt-auto">
      <div className="grid grid-cols-4 gap-2 mb-2 px-2">
        <div className="text-[9px] font-bold text-[var(--color-ink-4)] uppercase tracking-wider">Month</div>
        {cols.map((c, i) => (
          <div key={i} className={`text-[9px] font-bold uppercase text-center tracking-wider ${c.color}`}>{c.label}</div>
        ))}
      </div>
      <div className="max-h-[120px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-100 pr-1">
        {renderData.map((d, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 py-1.5 border-b border-zinc-50 last:border-0 hover:bg-[var(--color-s2)] rounded px-2">
            <div className="text-[10px] font-bold text-[var(--color-ink-2)] truncate">{d.label}</div>
            {cols.map((c, idx) => (
              <div key={idx} className="text-[10px] font-bold text-[var(--color-ink)] text-center">
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
    <span className="text-[9px] font-bold text-[var(--color-ink-3)] uppercase">{label}</span>
  </div>
);

const KPICard = ({ id, filename, label, value, sub, gradient, keywords, statsList }: any) => {
  const colorMap: any = {
    'orange': '#f59e0b',
    'blue': '#3b82f6',
    'emerald': '#10b981',
    'purple': '#a855f7',
    'rose': '#f43f5e',
    'cyan': '#06b6d4',
  };
  
  const accentColor = Object.keys(colorMap).find(k => gradient?.includes(k)) ? colorMap[Object.keys(colorMap).find(k => gradient?.includes(k))!] : '#5E6AD2';

  return (
    <div id={id} className="bg-[var(--color-s1)] p-5 md:p-6 rounded-md border border-[var(--color-hl)] shadow-card flex flex-col h-full transition-all hover:border-[var(--color-hl-2)] relative overflow-hidden group">
      <div className="mb-5 relative z-10 flex-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-medium text-[var(--color-ink-2)] tracking-tight">{label}</span>
          <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]`} style={{ background: accentColor }}></div>
        </div>
        <div className="text-4xl font-semibold tracking-tight font-display" style={{ color: accentColor }}>{value}</div>
        <p className="text-[12px] text-[var(--color-ink-3)] mt-2">{sub}</p>
      </div>

    <div className="mt-auto relative z-10">
      {keywords && keywords.length > 0 && (
        <div className="pt-4 border-t border-[var(--color-hl)]">
          <span className="text-[11px] font-medium text-[var(--color-ink-3)] mb-2.5 block">Top Keywords</span>
          <div className="flex flex-wrap gap-2">
            {keywords.map((k: any) => (
              <span key={k.word} className="px-2.5 py-1 bg-[var(--color-s2)] text-[var(--color-ink-2)] rounded-md text-[11px] font-medium">
                {k.word} <span className="text-[10px] text-[var(--color-ink-4)] ml-1">{k.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {statsList && statsList.length > 0 && (
        <div className="pt-4 border-t border-[var(--color-hl)] grid grid-cols-2 gap-5">
          {statsList.map((list: any, idx: number) => (
            <div key={idx}>
              <span className="text-[11px] font-medium text-[var(--color-ink-3)] mb-2 block truncate">{list.title}</span>
              <div className="flex flex-col gap-2">
                {list.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-[12px]">
                    <span className="text-[var(--color-ink-2)] truncate max-w-[70%]">{item.label}</span>
                    <span className="text-[var(--color-ink)] font-medium">{item.count}</span>
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
};

const VolumeCard = ({ id, filename, title, count, duration, typeSplit, gradient }: any) => {
  const colorMap: any = {
    'orange': '#f59e0b',
    'blue': '#3b82f6',
    'emerald': '#10b981',
    'purple': '#a855f7',
    'rose': '#f43f5e',
    'cyan': '#06b6d4',
  };
  const accentColor = Object.keys(colorMap).find(k => gradient?.includes(k)) ? colorMap[Object.keys(colorMap).find(k => gradient?.includes(k))!] : '#5E6AD2';

  return (
    <div id={id} className="bg-[var(--color-s1)] p-5 md:p-6 rounded-md border border-[var(--color-hl)] shadow-card flex flex-col h-full relative overflow-hidden group hover:border-[var(--color-hl-2)] transition-all">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-[13px] font-medium text-[var(--color-ink-2)] tracking-tight">{title} Context</h3>
        <span className="px-2 py-1 rounded-md text-[11px] font-medium" style={{ color: accentColor, backgroundColor: `${accentColor}15` }}>Volume</span>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <div className="text-3xl font-semibold tracking-tight font-display" style={{ color: accentColor }}>{count}</div>
          <div className="text-[12px] text-[var(--color-ink-3)] mt-1">Artworks</div>
        </div>
        <div className="border-l border-[var(--color-hl)] pl-5">
          <div className="text-3xl font-semibold text-[var(--color-ink)] tracking-tight font-display">~{duration}</div>
          <div className="text-[12px] text-[var(--color-ink-3)] mt-1">Avg Days</div>
        </div>
      </div>
      <div className="space-y-4 mt-auto">
        {typeSplit.map((t: any, idx: number) => {
          const barColors = ['#5E6AD2', '#10b981', '#f59e0b', '#a855f7', '#f43f5e'];
          const barColor = barColors[idx % barColors.length];
          return (
            <div key={t.type}>
              <div className="flex justify-between text-[12px] mb-2"><span className="text-[var(--color-ink-2)]">{t.type}</span><span style={{ color: barColor }}>{t.percentage}%</span></div>
              <div className="h-[4px] bg-[var(--color-s3)] rounded-full overflow-hidden">
                <div className="h-full" style={{ width: `${t.percentage}%`, backgroundColor: barColor }}></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PieRow = ({ title, data, total }: any) => {
  const size = 100;
  const radius = 46;
  const strokeWidth = 8;
  let currentAngle = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          {data.map((d: any, i: number) => {
            const percentage = total ? d.count / total : 0;
            if (percentage === 0) return null;
            const circumference = 2 * Math.PI * radius;
            const dashArray = `${percentage * circumference} ${circumference}`;
            const dashOffset = -currentAngle * circumference;
            currentAngle += percentage;
            
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={d.hexGradient?.[0] || d.solid}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                className="transition-all duration-500 hover:opacity-90"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 m-auto flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-semibold text-[var(--color-ink)]">{total}</span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-3">
        <p className="text-[13px] font-medium text-[var(--color-ink-2)] mb-4 pb-2 border-b border-[var(--color-hl)]">{title}</p>
        {data.map((d: any) => (
          <div key={d.type || d.context} className="flex justify-between items-center text-[13px] text-[var(--color-ink)]">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.hexGradient?.[0] || d.solid }}></div>
              <span>{d.type || d.context}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-[var(--color-ink-3)]">{total ? Math.round((d.count / total) * 100) : 0}%</span>
              <span className="font-medium min-w-[28px] text-right">{d.count}</span>
            </div>
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
    <div className="relative w-full h-auto max-w-full" onMouseLeave={() => setHoverIndex(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <defs>
          {colors.map((color: string, i: number) => (
            <linearGradient key={`grad-${i}`} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          ))}
        </defs>
        {[0, 0.5, 1].map(p => <line key={p} x1={padding} y1={getY(maxValue * p)} x2={width - padding} y2={getY(maxValue * p)} stroke="var(--color-hl)" strokeWidth="1" strokeDasharray="3 3" />)}

        {keys.map((key: string, kIdx: number) => (
          <g key={key}>
            {/* Gradient Area Fill */}
            <path d={getAreaPath(key)} fill={`url(#grad-${kIdx})`} className="transition-all duration-300" />

            {/* Thinner Line */}
            <path
              d={getSmoothPath(key)}
              fill="none"
              stroke={colors[kIdx]}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />

            {/* Permanent Nodes per Month */}
            {data.map((d: any, i: number) => (
              <circle
                key={`node-${key}-${i}`}
                cx={getX(i)}
                cy={getY(d[key])}
                r="2.5"
                fill="var(--color-s1)"
                stroke={colors[kIdx]}
                strokeWidth="1.5"
                className="transition-all duration-300"
              />
            ))}
          </g>
        ))}

        {/* Labels */}
        {data.map((d: any, i: number) => (
          <text key={i} x={getX(i)} y={height - 10} textAnchor="middle" fontSize="10" className="fill-[var(--color-ink-3)]">
            {d.label}
          </text>
        ))}

        {hoverIndex !== null && (
          <g>
            <line x1={getX(hoverIndex)} y1={padding} x2={getX(hoverIndex)} y2={height - padding} stroke="var(--color-hl-2)" strokeWidth="1" strokeDasharray="3 3" />
          </g>
        )}

        {/* Invisible Hit Targets */}
        {data.map((d: any, i: number) => (
          <rect key={`hit-${i}`} x={getX(i) - ((width - padding * 2) / (data.length - 1)) / 2} y={0} width={(width - padding * 2) / (data.length - 1)} height={height} fill="transparent" onMouseEnter={() => setHoverIndex(i)} />
        ))}
      </svg>

      {hoverIndex !== null && (
        <div className="absolute z-10 bg-[var(--color-s2)] text-[var(--color-ink)] p-3 rounded-md shadow-dropdown border border-[var(--color-hl)] pointer-events-none transform -translate-x-1/2 -translate-y-full" style={{ left: `${(getX(hoverIndex) / width) * 100}%`, top: '20px' }}>
          <p className="text-[11px] font-medium text-[var(--color-ink-3)] mb-2 border-b border-[var(--color-hl)] pb-1.5">{data[hoverIndex].fullDate}</p>
          <div className="flex gap-4">
            {keys.map((key: string, kIdx: number) => (
              <div key={key} className="flex flex-col">
                <span className="text-[10px] font-medium mb-1" style={{ color: colors[kIdx] }}>{labels[kIdx]}</span>
                <span className="text-lg font-semibold">{data[hoverIndex][key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const LeadDurationBarChart = ({ data }: { data: { label: string; fullDate: string; avgDays: number; totalItems: number }[] }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const maxVal = Math.max(...data.map(d => d.avgDays), 1);
  const width = 700;
  const height = 110;
  const paddingLeft = 28;
  const paddingRight = 10;
  const paddingTop = 14;
  const paddingBottom = 18;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const barCount = data.length;
  const barGap = 20;
  const barWidth = Math.min(48, (chartWidth - barGap * (barCount - 1)) / barCount);
  const totalBarsWidth = barCount * barWidth + (barCount - 1) * barGap;
  const offsetX = paddingLeft + (chartWidth - totalBarsWidth) / 2;

  // Grid lines (only 3 for compact height)
  const gridLines = [];
  const gridCount = 3;
  for (let i = 0; i <= gridCount; i++) {
    const val = (maxVal / gridCount) * i;
    const y = paddingTop + chartHeight - (val / maxVal) * chartHeight;
    gridLines.push({ val, y });
  }

  return (
    <div className="relative w-full h-auto max-w-full overflow-visible" onMouseLeave={() => setHoverIdx(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" overflow="visible">
        <defs>
          <linearGradient id="lead-bar-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id="lead-bar-grad-hover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#c4b5fd" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={paddingLeft} y1={g.y} x2={width - paddingRight} y2={g.y} stroke="var(--color-hl)" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "3 3"} />
            <text x={paddingLeft - 6} y={g.y + 3} textAnchor="end" fontSize="9" className="fill-[var(--color-ink-4)]">
              {g.val.toFixed(g.val % 1 === 0 ? 0 : 1)}
            </text>
          </g>
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const barH = maxVal > 0 ? (d.avgDays / maxVal) * chartHeight : 0;
          const x = offsetX + i * (barWidth + barGap);
          const y = paddingTop + chartHeight - barH;
          const isHovered = hoverIdx === i;

          return (
            <g key={i} onMouseEnter={() => setHoverIdx(i)}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barH, 0)}
                rx={2}
                fill={isHovered ? "var(--color-primary-hover)" : "var(--color-primary)"}
                className="transition-all duration-200"
              />
              {d.avgDays > 0 && (
                <text x={x + barWidth / 2} y={y - 10} textAnchor="middle" fontSize="11" fontWeight="bold" className="fill-[var(--color-ink-2)]">
                  {d.avgDays}
                </text>
              )}
              <text x={x + barWidth / 2} y={height - 4} textAnchor="middle" fontSize="10" className="fill-[var(--color-ink-3)]">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hoverIdx !== null && data[hoverIdx] && (
        <div
          className="absolute z-10 bg-[#1A1C20]/95 backdrop-blur-sm text-white px-3 py-2 rounded-lg shadow-sm pointer-events-none transform -translate-x-1/2 border border-zinc-700/50"
          style={{
            left: `${((offsetX + hoverIdx * (barWidth + barGap) + barWidth / 2) / width) * 100}%`,
            bottom: '100%',
            marginBottom: '4px',
          }}
        >
          <p className="text-[9px] font-bold uppercase text-[var(--color-ink-4)] mb-1 tracking-wider text-center">{data[hoverIdx].fullDate}</p>
          <div className="flex gap-3 items-center justify-center">
            <span className="text-[9px] font-bold text-indigo-400">{data[hoverIdx].avgDays || '–'} <span className="text-[var(--color-ink-3)]">days</span></span>
            <span className="text-[9px] font-bold text-emerald-400">{data[hoverIdx].totalItems} <span className="text-[var(--color-ink-3)]">items</span></span>
          </div>
        </div>
      )}
    </div>
  );
};

const StackedSegment = ({ count, total, globalMax, gradient }: any) => {
  if (count === 0) return null;
  return <div className={`h-full bg-gradient-to-r ${gradient} border-r border-white/20 transition-all duration-1000`} style={{ width: `${(count / globalMax) * 100}%` }}></div>;
};

const MetricBox = ({ label, value, unit, color }: any) => {
  const colorMap: any = {
    'blue': '#3b82f6',
    'emerald': '#10b981',
    'purple': '#a855f7',
    'orange': '#f59e0b',
    'rose': '#f43f5e',
    'cyan': '#06b6d4',
  };
  const accentColor = colorMap[color] || '#5E6AD2';

  return (
    <div className={`metric-box flex flex-col items-center justify-center p-2 rounded bg-[var(--color-s2)] border border-[var(--color-hl)] transition-all hover:border-[var(--color-hl-2)]`}>
      <span className="text-[9px] font-medium text-[var(--color-ink-3)] mb-1">{label}</span>
      <div className={`text-lg font-semibold leading-none font-display flex items-center`} style={{ color: accentColor }}>
        {value}
        {unit && <span className="text-[10px] ml-0.5 font-medium opacity-70">{unit}</span>}
      </div>
    </div>
  );
};

const StatBar = ({ label, value, max, color }: any) => (
  <div>
    <div className="flex justify-between text-[11px] font-medium text-[var(--color-ink-2)] mb-1.5">
      <span>{label}</span>
      <span style={{ color: color }}>{value}</span>
    </div>
    <div className="h-[4px] bg-[var(--color-s3)] rounded-full overflow-hidden">
      <div className="h-full transition-all duration-1000 shadow-[0_0_8px_rgba(0,0,0,0.2)]" style={{ width: `${(value / (max || 1)) * 100}%`, backgroundColor: color }}></div>
    </div>
  </div>
);

export default Dashboard;
