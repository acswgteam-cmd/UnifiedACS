import React, { useState, useMemo, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { AppState, WorkContext } from '../types';

interface Props {
  state: AppState;
}

type SlideType = 'title' | 'divider' | 'general-dashboard' | 'team-dashboard' | 'project-dashboard' | 'lead-dashboard' | 'lead-team-dashboard' | 'project-chart';

interface Slide {
  id: string;
  type: SlideType;
  title?: string;
  dividerText?: string;
  nextMoveText?: string;
}

class ReportGeneratorErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean; error?: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error('ReportGenerator caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-white text-red-700 text-base">
          Terjadi kesalahan pada halaman laporan. Silakan refresh atau kontak admin.
          <pre className="mt-2 text-xs text-red-500">{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const ReportGenerator: React.FC<Props> = ({ state }) => {
  const [targetMonth, setTargetMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));  const [targetYear, setTargetYear] = useState(String(new Date().getFullYear()));
  const [isFullYear, setIsFullYear] = useState(false);
  const [titleText, setTitleText] = useState('WORK MANAGEMENT REPORT');
  const [dividerText, setDividerText] = useState('MONTHLY PERFORMANCE SUMMARY');
  const [nextMoveText, setNextMoveText] = useState('1. Evaluasi singkat hasil dari penilaian project\n2. Pemantauan kriteria poin terendah project untuk ditingkatkan');
  
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Basic saving functionality via localStorage
  const [savedReports, setSavedReports] = useState<any[]>([]);

  // Slides management
  const [slides, setSlides] = useState<Slide[]>([
    { id: 'title', type: 'title', title: titleText },
    { id: 'general-dashboard', type: 'general-dashboard' },
    { id: 'team-dashboard', type: 'team-dashboard', nextMoveText: nextMoveText },
    { id: 'project-dashboard', type: 'project-dashboard' },
    { id: 'lead-dashboard', type: 'lead-dashboard' },
    { id: 'lead-team-dashboard', type: 'lead-team-dashboard' },
    { id: 'project-chart', type: 'project-chart' }
  ]);

  useEffect(() => {
    const saved = localStorage.getItem('acs_saved_reports');
    if (saved) {
      try {
        setSavedReports(JSON.parse(saved));
      } catch(e) {}
    }
    // Restore last-used slide config
    const savedSlides = localStorage.getItem('acs_active_slides');
    if (savedSlides) {
      try {
        const parsed = JSON.parse(savedSlides);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSlides(parsed);
        }
      } catch(e) {}
    }
  }, []);

  // Auto-persist slides whenever they change
  useEffect(() => {
    localStorage.setItem('acs_active_slides', JSON.stringify(slides));
  }, [slides]);

  // Update slides when text changes
  useEffect(() => {
    setSlides(prev => prev.map(slide => 
      slide.type === 'title' ? { ...slide, title: titleText } :
      slide.type === 'divider' ? { ...slide, dividerText: dividerText } :
      slide.type === 'team-dashboard' ? { ...slide, nextMoveText: nextMoveText } :
      slide
    ));
  }, [titleText, dividerText, nextMoveText]);

  // Slide management functions
  const addSlide = (type: SlideType, afterIndex?: number) => {
    const newSlide: Slide = {
      id: `${type}-${Date.now()}`,
      type,
      ...(type === 'title' && { title: 'CUSTOM TITLE' }),
      ...(type === 'divider' && { dividerText: 'CUSTOM DIVIDER TEXT' }),
      ...(type === 'team-dashboard' && { nextMoveText: 'Custom next move text' })
    };
    
    setSlides(prev => {
      if (afterIndex !== undefined) {
        const newSlides = [...prev];
        newSlides.splice(afterIndex + 1, 0, newSlide);
        return newSlides;
      }
      return [...prev, newSlide];
    });
  };

  const removeSlide = (slideId: string) => {
    setSlides(prev => prev.filter(slide => slide.id !== slideId));
  };
  
  const moveSlide = (index: number, direction: 'up' | 'down') => {
    setSlides(prev => {
      const newSlides = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newSlides.length) return prev;
      const [moved] = newSlides.splice(index, 1);
      newSlides.splice(targetIndex, 0, moved);
      return newSlides;
    });
  };

  const updateSlide = (slideId: string, updates: Partial<Slide>) => {
    setSlides(prev => prev.map(slide => 
      slide.id === slideId ? { ...slide, ...updates } : slide
    ));
  };

  const saveReport = () => {
    const newReport = {
      id: Date.now().toString(),
      targetMonth,
      targetYear,
      isFullYear,
      titleText,
      dividerText,
      nextMoveText,
      slides,
      generatedAt: new Date().toISOString(),
      label: isFullYear ? `Report ${targetYear}` : `Report ${targetMonth}/${targetYear}`
    };
    const updated = [newReport, ...savedReports];
    setSavedReports(updated);
    localStorage.setItem('acs_saved_reports', JSON.stringify(updated));
    alert('Report configuration saved!');
  };

  const loadReport = (rep: any) => {
    setTargetMonth(rep.targetMonth);
    setTargetYear(rep.targetYear);
    setIsFullYear(rep.isFullYear);
    setTitleText(rep.titleText);
    setDividerText(rep.dividerText);
    setNextMoveText(rep.nextMoveText || '');
    if (rep.slides) {
      setSlides(rep.slides);
    }
  };

  const filterStart = isFullYear 
    ? `${targetYear}-01-01`
    : `${targetYear}-${targetMonth}-01`;
  
  const filterEnd = isFullYear
    ? `${targetYear}-12-31`
    : (() => {
        const lastDay = new Date(parseInt(targetYear), parseInt(targetMonth), 0).getDate();
        return `${targetYear}-${targetMonth}-${lastDay}`;
      })();

  // Previous period boundaries (for MoM comparison)
  const prevPeriod = useMemo(() => {
    if (isFullYear) {
      const prevYear = parseInt(targetYear) - 1;
      return { start: `${prevYear}-01-01`, end: `${prevYear}-12-31` };
    }
    const d = new Date(parseInt(targetYear), parseInt(targetMonth) - 1, 1);
    d.setMonth(d.getMonth() - 1);
    const py = d.getFullYear();
    const pm = String(d.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(py, d.getMonth() + 1, 0).getDate();
    return { start: `${py}-${pm}-01`, end: `${py}-${pm}-${lastDay}` };
  }, [isFullYear, targetYear, targetMonth]);

  // Core Analytics Logic copied from Dashboard for accurate numbers
  const analytics = useMemo(() => {
    const { artworkLogs, projects, leads, designers, departments, internalDesigns, designerEvaluations } = state;

    const filteredLogs = artworkLogs.filter(log => log.start_date >= filterStart && log.start_date <= filterEnd);
    const totalArtworks = filteredLogs.length;

    const allProjects = projects.filter(p => p.start_date >= filterStart && p.start_date <= filterEnd);
    const projectPICs = getTopCounts(allProjects, p => designers.find(d => d.id === p.pic_designer_id)?.name || 'Unknown', 3);
    const projectLocs = getTopCounts(allProjects, p => (p as any).locations || (p as any).location || [], 3);

    const allLeads = leads.filter(l => l.order_date >= filterStart && l.order_date <= filterEnd);
    const leadGradesMap = getCountMap(allLeads, l => l.lead_grade || 'Unknown');
    const leadGrades = Object.entries(leadGradesMap).sort((a,b)=>b[1]-a[1]).map(([label, count]) => `${label}: ${count}`).join(', ');
    const leadRequesters = getTopCounts(allLeads, l => l.requester, 3);

    const allInternal = internalDesigns.filter(t => {
      const targetDate = t.created_at || t.deadline || '';
      return !targetDate || (targetDate >= filterStart && targetDate <= filterEnd);
    });
    const internalDepts = getTopCounts(allInternal, t => departments.find(d => d.id === t.department_id)?.department_name || 'Unknown', 3);

    // Matrix
    const matrix = [
      { ctx: WorkContext.PROJECT, 
        "2D": filteredLogs.filter(l => l.work_context === WorkContext.PROJECT && l.artwork_type === "2D Design").length,
        "3D": filteredLogs.filter(l => l.work_context === WorkContext.PROJECT && l.artwork_type === "3D Design").length,
        "VDO": filteredLogs.filter(l => l.work_context === WorkContext.PROJECT && l.artwork_type === "Video").length },
      { ctx: WorkContext.LEAD, 
        "2D": filteredLogs.filter(l => l.work_context === WorkContext.LEAD && l.artwork_type === "2D Design").length,
        "3D": filteredLogs.filter(l => l.work_context === WorkContext.LEAD && l.artwork_type === "3D Design").length,
        "VDO": filteredLogs.filter(l => l.work_context === WorkContext.LEAD && l.artwork_type === "Video").length },
      { ctx: WorkContext.INTERNAL, 
        "2D": filteredLogs.filter(l => l.work_context === WorkContext.INTERNAL && l.artwork_type === "2D Design").length,
        "3D": filteredLogs.filter(l => l.work_context === WorkContext.INTERNAL && l.artwork_type === "3D Design").length,
        "VDO": filteredLogs.filter(l => l.work_context === WorkContext.INTERNAL && l.artwork_type === "Video").length },
    ];
    const heatmapNumbers = matrix.flatMap(r => [r["2D"], r["3D"], r["VDO"]]);
    const heatmapMin = heatmapNumbers.length ? Math.min(...heatmapNumbers) : 0;
    const heatmapMax = heatmapNumbers.length ? Math.max(...heatmapNumbers) : 0;

    // Top Keywords
    const wordCounts: Record<string, number> = {};
    filteredLogs.forEach(log => {
      if (!log.artwork_name) return;
      const words = log.artwork_name.trim().split(/[\s-]+/);
      const topWords = words.slice(0, 3).join(' ').toUpperCase();
      if (topWords.trim().length > 1) {
        wordCounts[topWords] = (wordCounts[topWords] || 0) + 1;
      }
    });
    const topKeywords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(w => w[0]).join(', ');

    // Team Stats
    const EVAL_CRITERIA_KEYS = ['inisiatif', 'disiplin', 'penyelesaian_tugas', 'attitude', 'komunikasi', 'respon_masukan'];
    const teamStats = designers.map(d => {
      const logs = filteredLogs.filter(l => l.pic_designer_id === d.id);
      const projInvCount = allProjects.filter(p => p.pic_designer_id === d.id || (p.support_designer_ids || []).includes(d.id)).length;
      const uniqueLeads = new Set(logs.filter(l => l.work_context === WorkContext.LEAD && l.lead_id).map(l => l.lead_id)).size;
      
      const leadLogs = logs.filter(l => l.work_context === WorkContext.LEAD && l.end_date);
      let avgLeadDur = "0.0";
      if (leadLogs.length > 0) {
        const days = leadLogs.reduce((acc, l) => acc + (Math.max(0, (new Date(l.end_date!).getTime() - new Date(l.start_date).getTime()) / 86400000) + 1), 0);
        avgLeadDur = (days / leadLogs.length).toFixed(1);
      }

      const myEvals = designerEvaluations.filter(ev => {
        if (ev.designer_id !== d.id) return false;
        const proj = projects.find(p => p.id === ev.project_id);
        if (!proj) return false;
        if (proj.start_date < filterStart || proj.start_date > filterEnd) return false;
        return true;
      });

      let avgRatingStr = "0.0";
      let detailedScores: any = null;
      if (myEvals.length > 0) {
        let totalOverallSum = 0;
        let acc: any = { inisiatif: 0, disiplin: 0, penyelesaian_tugas: 0, attitude: 0, komunikasi: 0, respon_masukan: 0 };
        myEvals.forEach(ev => {
          const scores = EVAL_CRITERIA_KEYS.map(k => (ev as any)[k] || 0).filter((v: number) => v > 0);
          if (scores.length > 0) totalOverallSum += scores.reduce((a, b) => a + b, 0) / scores.length;
          EVAL_CRITERIA_KEYS.forEach(k => acc[k] += (ev as any)[k] || 0);
        });
        avgRatingStr = (totalOverallSum / myEvals.length).toFixed(1);
        detailedScores = {
          inisiatif: (acc.inisiatif / myEvals.length).toFixed(2),
          disiplin: (acc.disiplin / myEvals.length).toFixed(2),
          tugas: (acc.penyelesaian_tugas / myEvals.length).toFixed(2),
          attitude: (acc.attitude / myEvals.length).toFixed(2),
          komunikasi: (acc.komunikasi / myEvals.length).toFixed(2),
          respon: (acc.respon_masukan / myEvals.length).toFixed(2),
        };
      }

      return {
        ...d,
        pro: logs.filter(l => l.work_context === WorkContext.PROJECT).length,
        lead: logs.filter(l => l.work_context === WorkContext.LEAD).length,
        int: logs.filter(l => l.work_context === WorkContext.INTERNAL).length,
        totalArtworks: logs.length,
        projInvCount, uniqueLeads, avgLeadDur, avgRating: avgRatingStr, detailedScores
      };
    }).sort((a, b) => b.totalArtworks - a.totalArtworks);

    // Global Evaluation Avg
    let gSum = 0, gCount = 0;
    const globalEvals = designerEvaluations.filter(ev => {
      const proj = projects.find(p => p.id === ev.project_id);
      return proj && proj.start_date >= filterStart && proj.start_date <= filterEnd;
    });
    const uniqueEvaluatedProjects = new Set(globalEvals.map(e => e.project_id)).size;
    const uniqueEvaluatedTeams = new Set(globalEvals.map(e => e.designer_id)).size;

    globalEvals.forEach(ev => {
      const scores = EVAL_CRITERIA_KEYS.map(k => (ev as any)[k] || 0).filter((v: number) => v > 0);
      if (scores.length > 0) {
        gSum += scores.reduce((a, b) => a + b, 0) / scores.length;
        gCount++;
      }
    });

    // ---- Project Dashboard Analytics ----
    // Per-project: artwork count, team size (unique designers), workday duration
    const projectStats = allProjects.map(proj => {
      const projLogs = filteredLogs.filter(l => l.work_context === WorkContext.PROJECT && l.project_id === proj.id);
      const artworkCount = projLogs.length;

      // Unique ACS team members (PIC + support)
      const teamIds = new Set<string>();
      if (proj.pic_designer_id) teamIds.add(proj.pic_designer_id);
      (proj.support_designer_ids || []).forEach((id: string) => teamIds.add(id));
      const teamSize = teamIds.size;

      // Workdays: from earliest log start_date to latest log end_date (or project end_date)
      const dates = projLogs.flatMap(l => [l.start_date, l.end_date].filter(Boolean) as string[]);
      if (proj.end_date) dates.push(proj.end_date);
      if (proj.start_date) dates.push(proj.start_date);
      let workDays = 0;
      if (dates.length >= 2) {
        const minDate = dates.reduce((a, b) => a < b ? a : b);
        const maxDate = dates.reduce((a, b) => a > b ? a : b);
        workDays = Math.max(0, Math.round((new Date(maxDate).getTime() - new Date(minDate).getTime()) / 86400000) + 1);
      }

      return { proj, artworkCount, teamSize, workDays };
    });

    const totalProjectArtworks = projectStats.reduce((s, ps) => s + ps.artworkCount, 0);
    const avgTeamSize = projectStats.length > 0
      ? (projectStats.reduce((s, ps) => s + ps.teamSize, 0) / projectStats.length)
      : 0;
    const avgWorkDays = projectStats.length > 0
      ? (projectStats.reduce((s, ps) => s + ps.workDays, 0) / projectStats.length)
      : 0;

    // Insight: event with most artworks
    const mostArtworkProj = projectStats.length > 0
      ? projectStats.reduce((a, b) => a.artworkCount >= b.artworkCount ? a : b)
      : null;
    // Insight: event with longest duration
    const longestDurProj = projectStats.length > 0
      ? projectStats.reduce((a, b) => a.workDays >= b.workDays ? a : b)
      : null;
    // Insight: event with most team members
    const mostTeamProj = projectStats.length > 0
      ? projectStats.reduce((a, b) => a.teamSize >= b.teamSize ? a : b)
      : null;

    // ---- Monthly project data (last 12 months from filter end) ----
    const monthlyProjectData = (() => {
      const months: { label: string; key: string; projects: number; artworks: number }[] = [];
      const endDate = new Date(filterEnd);
      for (let i = 11; i >= 0; i--) {
        const d = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${y}-${m}`;
        const label = d.toLocaleString('id-ID', { month: 'short' }).toUpperCase();
        const monthProjects = projects.filter(p => p.start_date.startsWith(key));
        const monthArtworks = artworkLogs.filter(
          l => l.work_context === WorkContext.PROJECT && l.start_date.startsWith(key)
        );
        months.push({ label, key, projects: monthProjects.length, artworks: monthArtworks.length });
      }
      return months;
    })();

    // ---- Lead Dashboard Specific Analytics ----
    const leadStats = allLeads.map(l => {
      const leadLogs = filteredLogs.filter(log => log.work_context === WorkContext.LEAD && log.lead_id === l.id);
      const artworkCount = leadLogs.length;
      const dates = leadLogs.flatMap(log => [log.start_date, log.end_date].filter(Boolean) as string[]);
      let workDays = 0;
      if (dates.length >= 2) {
        const minDate = dates.reduce((a, b) => a < b ? a : b);
        const maxDate = dates.reduce((a, b) => a > b ? a : b);
        workDays = Math.max(0, Math.round((new Date(maxDate).getTime() - new Date(minDate).getTime()) / 86400000) + 1);
      } else if (dates.length === 1) {
        workDays = 1;
      }
      const totalRevisions = leadLogs.reduce((s, log) => s + (log.revision_count || 0), 0);
      return { lead: l, artworkCount, workDays, totalRevisions };
    });

    const totalLeadArtworks = filteredLogs.filter(l => l.work_context === WorkContext.LEAD).length;
    const avgLeadWorkDays = allLeads.length > 0 
      ? (leadStats.reduce((s, ls) => s + ls.workDays, 0) / allLeads.length)
      : 0;
    const avgLeadRevisions = totalLeadArtworks > 0
      ? (leadStats.reduce((s, ls) => s + ls.totalRevisions, 0) / totalLeadArtworks)
      : 0;

    const leadDurationData = leadStats.slice(0, 12).map(ls => ({
      label: ls.lead.lead_name || 'Lead',
      duration: ls.workDays
    }));

    return {
      totalArtworks, projectPICs, projectLocs, allProjectsCount: allProjects.length,
      allLeadsCount: allLeads.length, leadGrades, leadRequesters,
      leadGradesMap, allInternalCount: allInternal.length, internalDepts,
      matrix, topKeywords, teamStats,
      heatmapMin, heatmapMax,
      globalEvalAverage: gCount > 0 ? (gSum / gCount).toFixed(2) : '0.00',
      uniqueEvaluatedProjects, uniqueEvaluatedTeams,
      // Project dashboard
      projectStats,
      totalProjectArtworks,
      avgTeamSize,
      avgWorkDays,
      mostArtworkProj,
      longestDurProj,
      mostTeamProj,
      // Project chart
      monthlyProjectData,
      // Lead dashboard
      totalLeadArtworks,
      avgLeadWorkDays,
      avgLeadRevisions,
      leadDurationData
    };
  }, [state, filterStart, filterEnd]);

  // Previous month analytics (for MoM footer)
  const prevAnalytics = useMemo(() => {
    const { artworkLogs, projects, leads, internalDesigns, designerEvaluations } = state;
    const { start, end } = prevPeriod;

    const filteredLogs = artworkLogs.filter(l => l.start_date >= start && l.start_date <= end);
    const allProjects = projects.filter(p => p.start_date >= start && p.start_date <= end);
    const allLeads = leads.filter(l => l.order_date >= start && l.order_date <= end);
    const allInternal = internalDesigns.filter(t => {
      const d = (t as any).created_at || (t as any).deadline || '';
      return !d || (d >= start && d <= end);
    });

    const EVAL_CRITERIA_KEYS = ['inisiatif', 'disiplin', 'penyelesaian_tugas', 'attitude', 'komunikasi', 'respon_masukan'];
    const globalEvals = designerEvaluations.filter(ev => {
      const proj = projects.find(p => p.id === ev.project_id);
      return proj && proj.start_date >= start && proj.start_date <= end;
    });
    let gSum = 0, gCount = 0;
    globalEvals.forEach(ev => {
      const scores = EVAL_CRITERIA_KEYS.map(k => (ev as any)[k] || 0).filter((v: number) => v > 0);
      if (scores.length > 0) { gSum += scores.reduce((a, b) => a + b, 0) / scores.length; gCount++; }
    });

    // Prev period project-specific stats
    const prevProjectStats = allProjects.map(proj => {
      const projLogs = filteredLogs.filter(l => l.work_context === WorkContext.PROJECT && l.project_id === proj.id);
      const teamIds = new Set<string>();
      if (proj.pic_designer_id) teamIds.add(proj.pic_designer_id);
      (proj.support_designer_ids || []).forEach((id: string) => teamIds.add(id));
      const teamSize = teamIds.size;
      const dates = projLogs.flatMap(l => [l.start_date, l.end_date].filter(Boolean) as string[]);
      if (proj.end_date) dates.push(proj.end_date);
      if (proj.start_date) dates.push(proj.start_date);
      let workDays = 0;
      if (dates.length >= 2) {
        const minDate = dates.reduce((a, b) => a < b ? a : b);
        const maxDate = dates.reduce((a, b) => a > b ? a : b);
        workDays = Math.max(0, Math.round((new Date(maxDate).getTime() - new Date(minDate).getTime()) / 86400000) + 1);
      }
      return { artworkCount: projLogs.length, teamSize, workDays };
    });
    const prevTotalProjectArtworks = prevProjectStats.reduce((s, ps) => s + ps.artworkCount, 0);
    const prevAvgTeamSize = prevProjectStats.length > 0
      ? prevProjectStats.reduce((s, ps) => s + ps.teamSize, 0) / prevProjectStats.length : 0;
    const prevAvgWorkDays = prevProjectStats.length > 0
      ? prevProjectStats.reduce((s, ps) => s + ps.workDays, 0) / prevProjectStats.length : 0;

    // Prev period lead-specific stats
    const prevLeadLogs = filteredLogs.filter(l => l.work_context === WorkContext.LEAD);
    const prevTotalLeadArtworks = prevLeadLogs.length;
    const prevTotalLeadRevisions = prevLeadLogs.reduce((s, l) => s + (l.revision_count || 0), 0);
    const prevAvgLeadRevisions = prevTotalLeadArtworks > 0 ? prevTotalLeadRevisions / prevTotalLeadArtworks : 0;

    return {
      totalArtworks: filteredLogs.length,
      allProjectsCount: allProjects.length,
      allLeadsCount: allLeads.length,
      allInternalCount: allInternal.length,
      globalEvalAverage: gCount > 0 ? parseFloat((gSum / gCount).toFixed(2)) : 0,
      totalProjectArtworks: prevTotalProjectArtworks,
      avgTeamSize: prevAvgTeamSize,
      avgWorkDays: prevAvgWorkDays,
      totalLeadArtworks: prevTotalLeadArtworks,
      avgLeadWorkDays: allLeads.length > 0 
        ? allLeads.reduce((acc, l) => {
            const logs = filteredLogs.filter(log => log.work_context === WorkContext.LEAD && log.lead_id === l.id);
            const dates = logs.flatMap(log => [log.start_date, log.end_date].filter(Boolean) as string[]);
            if (dates.length >= 2) {
              const min = dates.reduce((a, b) => a < b ? a : b);
              const max = dates.reduce((a, b) => a > b ? a : b);
              return acc + (Math.max(0, Math.round((new Date(max).getTime() - new Date(min).getTime()) / 86400000) + 1));
            }
            return acc + (dates.length === 1 ? 1 : 0);
          }, 0) / allLeads.length 
        : 0,
      avgLeadRevisions: prevAvgLeadRevisions
    };
  }, [state, prevPeriod]);

  // MoM delta helpers
  const momDelta = (current: number, prev: number) => {
    const diff = current - prev;
    return { diff, up: diff > 0, same: diff === 0 };
  };

  const MomFooter = ({ current, prev, label }: { current: number; prev: number; label: string }) => {
    const { diff, up, same } = momDelta(current, prev);
    const arrow = same ? '●' : up ? '▲' : '▼';
    const arrowColor = same ? 'text-slate-300' : up ? 'text-emerald-400' : 'text-rose-300';
    const formattedDiff = parseFloat(Math.abs(diff).toFixed(2)).toString();
    const changeText = same ? 'No change' : `${up ? '+' : ''}${formattedDiff}`;
    return (
      <div className="px-4 py-2 rounded-b-xl" style={{ background: 'rgba(0,0,0,0.30)' }}>
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${arrowColor}`}>
          {arrow} {changeText} {label} vs last month
        </span>
      </div>
    );
  };

  function getTopCounts(items: any[], keyExtractor: (item: any) => string | string[], limit = 3) {
    const counts: Record<string, number> = {};
    items.forEach(item => {
      const keyOrKeys = keyExtractor(item);
      const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
      keys.forEach(k => { if (k) counts[k] = (counts[k] || 0) + 1; });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label]) => label).join(', ');
  }

  function getCountMap(items: any[], keyExtractor: (item: any) => string | string[]) {
    const counts: Record<string, number> = {};
    items.forEach(item => {
      const keyOrKeys = keyExtractor(item);
      const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
      keys.forEach(k => { if (k) counts[k] = (counts[k] || 0) + 1; });
    });
    return counts;
  }

  const generatePDF = async () => {
    setIsGenerating(true);
    
    // Give React time to flush the "isGenerating" state to the DOM
    // without this, the old DOM nodes might detach during the capture, causing html2canvas to fail.
    await new Promise(resolve => setTimeout(resolve, 150));

    try {
      const slides = document.querySelectorAll('.report-slide');
      if (slides.length === 0) throw new Error("No slides found in the document");

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      
      const fixClonedStyles = (clonedDoc: Document) => {
        const allElements = clonedDoc.querySelectorAll('*');
        allElements.forEach(clonedEl => {
          if (!(clonedEl instanceof HTMLElement)) return;
          if (clonedEl.classList.contains('text-transparent') || clonedEl.classList.contains('bg-clip-text')) {
             clonedEl.style.setProperty('-webkit-text-fill-color', '#1e293b', 'important');
             clonedEl.style.setProperty('-webkit-background-clip', 'initial', 'important');
             clonedEl.style.setProperty('background-clip', 'initial', 'important');
             clonedEl.style.setProperty('color', '#1e293b', 'important');
             clonedEl.style.setProperty('background-image', 'none', 'important');
             clonedEl.style.setProperty('background', 'none', 'important');
          }
        });
      };

      for (let i = 0; i < slides.length; i++) {
        const el = slides[i] as HTMLElement;
        
        const canvas = await html2canvas(el, { 
          scale: 2, 
          useCORS: true, 
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 1300,
          windowHeight: 800,
          onclone: (clonedDoc) => {
            // Find the exactly matching cloned element
            const clonedEl = clonedDoc.querySelectorAll('.report-slide')[i] as HTMLElement;
            if (clonedEl) {
               // Use transform scale(1) inside the clone ONLY, avoiding live DOM bugs.
               clonedEl.style.transform = 'scale(1)';
               clonedEl.style.transformOrigin = 'top left';
               clonedEl.style.margin = '0';
               // Give the document some breathing room to reflow if necessary
               clonedEl.style.position = 'relative';
            }
            fixClonedStyles(clonedDoc);
          }
        });

        const imgData = canvas.toDataURL('image/png', 1.0);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, 297, 167.0625);
        
        // Brief pause after adding the image to keep browser thread responsive
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      pdf.save(`Report_${isFullYear ? targetYear : `${targetYear}-${targetMonth}`}.pdf`);
    } catch(e: any) {
      console.error(e);
      let errorMsg = e?.message || e?.toString() || 'Unknown error occurred';
      if (errorMsg === '[object Object]') {
        try { errorMsg = JSON.stringify(e); } catch(err) {} 
      }
      alert('Error generating PDF: ' + errorMsg);
    }
    setIsGenerating(false);
  };

  const SlideWrapper = ({ children, title, id }: { children: React.ReactNode, title?: string, id?: string }) => (
    <div id={id} className="report-slide bg-gradient-to-br from-slate-50 via-sky-50 to-white relative overflow-hidden flex flex-col items-center justify-center shrink-0 border border-zinc-200 shadow-xl" 
         style={{ width: '1280px', height: '720px', transformOrigin: 'top left', transform: 'scale(0.65)', marginBottom: '-240px' }}>
      
      {/* Header */}
      {title && (
        <div className="absolute top-8 w-full px-12 z-20 flex justify-between items-start">
          <div className="flex items-center gap-2.5 text-zinc-800">
             <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
             <span className="font-bold text-lg tracking-tight">Werkudara Group</span>
          </div>
          <div className="bg-[#123661] text-white px-6 py-1.5 rounded-full font-bold text-sm tracking-widest shadow-sm">
            {title}
          </div>
        </div>
      )}

      {/* Slide Content */}
      <div className="w-full h-full pt-20 pb-16 px-12 z-10 flex text-left">
         {children}
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 w-full px-12 z-20 flex justify-between items-end">
        <div className="text-[10px] font-bold tracking-widest text-zinc-800">
          CONFIDENTIAL DOCUMENT, FOR INTERNAL USE ONLY <span className="text-zinc-500 font-normal">| &copy; {new Date().getFullYear()} Werkudara Group. All rights reserved.</span>
        </div>
      </div>
    </div>
  );

  // Group designers into chunks of 8
  const teamChunks = [];
  for (let i = 0; i < analytics.teamStats.length; i += 8) {
    teamChunks.push(analytics.teamStats.slice(i, i + 8));
  }
  if (teamChunks.length === 0) teamChunks.push([]);

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-3">
             <h1 className="text-3xl font-black text-zinc-900 tracking-tight uppercase">Report Generator</h1>
             <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest bg-pink-100 text-pink-600 border border-pink-200 rounded-md">BETA / EXPERIMENT</span>
          </div>
          <p className="text-zinc-500 font-medium">Create beautiful PDF reports automatically</p>
        </div>
        <div className="flex gap-3">
          <button onClick={saveReport} className="px-5 py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-xl font-bold shadow-sm transition-all">
             Save Config
          </button>
          <button onClick={generatePDF} disabled={isGenerating} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-2">
             {isGenerating ? 'Generating...' : 'Export to PDF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* left sidebar settings */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
            <h3 className="font-bold text-sm tracking-tight uppercase text-zinc-900">Period Settings</h3>
            
            <div className="flex items-center gap-2">
              <input type="checkbox" id="fullyear" checked={isFullYear} onChange={e => setIsFullYear(e.target.checked)} className="rounded text-indigo-600" />
              <label htmlFor="fullyear" className="text-sm font-bold text-zinc-700">1 Full Year</label>
            </div>

            {!isFullYear && (
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-1">Month</label>
                <select value={targetMonth} onChange={e => setTargetMonth(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-medium">
                  {Array.from({length: 12}).map((_, i) => (
                    <option key={i+1} value={String(i+1).padStart(2,'0')}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-1">Year</label>
              <select value={targetYear} onChange={e => setTargetYear(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-medium">
                {['2024','2025','2026','2027'].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
            <h3 className="font-bold text-sm tracking-tight uppercase text-zinc-900">Slide Management</h3>
            
            <div className="space-y-2">
              {(
                [
                  { type: 'title' as SlideType, label: '+ Add Title Slide', cls: 'bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                  { type: 'divider' as SlideType, label: '+ Add Divider Slide', cls: 'bg-purple-50 hover:bg-purple-100 text-purple-700' },
                  { type: 'general-dashboard' as SlideType, label: '+ Add General Dashboard', cls: 'bg-green-50 hover:bg-green-100 text-green-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                  { type: 'team-dashboard' as SlideType, label: '+ Add Team Dashboard', cls: 'bg-orange-50 hover:bg-orange-100 text-orange-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                  { type: 'project-dashboard' as SlideType, label: '+ Add Project Dashboard', cls: 'bg-teal-50 hover:bg-teal-100 text-teal-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                  { type: 'lead-dashboard' as SlideType, label: '+ Add Lead Summary', cls: 'bg-amber-50 hover:bg-amber-100 text-amber-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                  { type: 'lead-team-dashboard' as SlideType, label: '+ Add Lead Team', cls: 'bg-orange-50 hover:bg-orange-100 text-orange-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                  { type: 'project-chart' as SlideType, label: '+ Add Project Chart', cls: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                ] as { type: SlideType; label: string; cls: string }[]
              ).map(({ type, label, cls }) => {
                const isOnce = type !== 'divider';
                const alreadyAdded = isOnce && slides.some(s => s.type === type);
                return (
                  <button
                    key={type}
                    onClick={() => !alreadyAdded && addSlide(type)}
                    disabled={alreadyAdded}
                    className={`w-full px-3 py-2 rounded-lg font-medium text-sm transition-colors ${cls} ${alreadyAdded ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {alreadyAdded ? `✓ ${label.replace('+ ', '')}` : label}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-zinc-200 pt-4">
              <h4 className="font-bold text-xs tracking-tight uppercase text-zinc-700 mb-3">Current Slides ({slides.length})</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {slides.map((slide, index) => (
                  <div key={slide.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-zinc-800 capitalize">
                        {slide.type.replace('-', ' ')}
                      </div>
                      {slide.type === 'title' && slide.title && (
                        <div className="text-xs text-zinc-500 truncate max-w-32">{slide.title}</div>
                      )}
                      {slide.type === 'divider' && slide.dividerText && (
                        <div className="text-xs text-zinc-500 truncate max-w-32">{slide.dividerText}</div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => moveSlide(index, 'up')}
                        disabled={index === 0}
                        className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 rounded text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move Up"
                      >
                        ↑
                      </button>
                      <button 
                        onClick={() => moveSlide(index, 'down')}
                        disabled={index === slides.length - 1}
                        className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 rounded text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move Down"
                      >
                        ↓
                      </button>
                      <button 
                        onClick={() => addSlide(slide.type, index)}
                        className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 rounded text-xs font-medium"
                        title="Duplicate"
                      >
                        +
                      </button>
                      <button 
                        onClick={() => removeSlide(slide.id)}
                        disabled={slides.length <= 1}
                        className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {savedReports.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-3">
              <h3 className="font-bold text-sm tracking-tight uppercase text-zinc-900">Saved Reports</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {savedReports.map(rp => (
                  <div key={rp.id} className="flex items-center gap-2 p-2 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-100 transition-colors group">
                    <button onClick={() => loadReport(rp)} className="flex-1 text-left">
                      <div className="font-bold text-sm text-zinc-800">{rp.label}</div>
                      <div className="text-xs text-zinc-500 truncate">{new Date(rp.generatedAt).toLocaleDateString()}</div>
                    </button>
                    <button
                      onClick={() => {
                        const updated = savedReports.filter(r => r.id !== rp.id);
                        setSavedReports(updated);
                        localStorage.setItem('acs_saved_reports', JSON.stringify(updated));
                      }}
                      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md bg-red-100 hover:bg-red-200 text-red-500 text-xs font-black opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Hapus"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right side: slides preview */}
        <div className="md:col-span-3 bg-slate-100 rounded-3xl p-8 border border-zinc-200 overflow-x-auto flex flex-col gap-12 items-center" style={{ minHeight: '800px' }}>
          
          {slides.map((slide, index) => {
            if (slide.type === 'title') {
              return (
                <SlideWrapper key={slide.id} id={`slide-${index}`}>
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <h1 className="text-6xl font-semibold text-[#123661] uppercase tracking-tight mb-4">
                      {slide.title || titleText}
                    </h1>
                    <h2 className="text-3xl font-bold text-zinc-500 uppercase tracking-widest">
                      {isFullYear ? `YEAR ${targetYear}` : `${new Date(parseInt(targetYear), parseInt(targetMonth)-1).toLocaleString('id-ID',{month:'long'})} ${targetYear}`}
                    </h2>
                  </div>
                </SlideWrapper>
              );
            }

            if (slide.type === 'divider') {
              return (
                <SlideWrapper key={slide.id} id={`slide-${index}`}>
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="w-32 h-2 bg-blue-600 mb-8 rounded-full"></div>
                    <h1 className="text-5xl font-semibold text-zinc-800 uppercase tracking-tight">
                      {slide.dividerText || dividerText}
                    </h1>
                  </div>
                </SlideWrapper>
              );
            }

            if (slide.type === 'general-dashboard') {
              return (
                <SlideWrapper key={slide.id} id={`slide-${index}`} title="GENERAL DASHBOARD">
            <div className="flex-1 flex flex-col gap-4 mt-4 w-full h-[540px]">
               {/* TOP ROW */}
               <div className="flex gap-4 h-[280px]">
                  {/* Total Artworks & Projects — white card */}
                  <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100">
                     <div className="flex flex-1 p-6 gap-6">
                        {/* Artworks */}
                        <div className="flex-1 border-r border-slate-100 pr-6 flex flex-col justify-between">
                           <div>
                             <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Total Artworks</div>
                             <div className="flex items-baseline gap-3">
                               <div className="text-6xl font-semibold tracking-tight leading-none text-blue-600">{analytics.totalArtworks}</div>
                               {(() => {
                                 const diff = analytics.totalArtworks - prevAnalytics.totalArtworks;
                                 const color = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-slate-400';
                                 const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '●';
                                 return <span className={`text-sm font-black ${color}`}>{arrow} {Math.abs(diff)}</span>;
                               })()}
                             </div>
                           </div>
                           <div className="mt-3">
                             <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">Top Keywords</div>
                             <div className="text-[12px] font-bold text-slate-700 leading-relaxed">{analytics.topKeywords || '-'}</div>
                           </div>
                        </div>
                        {/* Projects */}
                        <div className="flex-1 flex flex-col justify-between">
                           <div>
                             <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Projects In-Charge</div>
                             <div className="flex items-baseline gap-3">
                               <div className="text-6xl font-semibold tracking-tight leading-none text-indigo-600">{analytics.allProjectsCount}</div>
                               {(() => {
                                 const diff = analytics.allProjectsCount - prevAnalytics.allProjectsCount;
                                 const color = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-slate-400';
                                 const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '●';
                                 return <span className={`text-sm font-black ${color}`}>{arrow} {Math.abs(diff)}</span>;
                               })()}
                             </div>
                           </div>
                           <div className="mt-3 space-y-2">
                             <div>
                               <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Top PIC</div>
                               <div className="text-[12px] font-bold text-slate-700 leading-relaxed">{analytics.projectPICs || '-'}</div>
                             </div>
                             <div>
                               <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Top Location</div>
                               <div className="text-[12px] font-bold text-slate-700 leading-relaxed">{analytics.projectLocs || '-'}</div>
                             </div>
                           </div>
                        </div>
                     </div>
                  </div>
                  
                  {/* Heatmap — white bg, single-hue blue scale */}
                  <div className="w-[420px] bg-white rounded-xl p-5 flex flex-col shadow-sm border border-slate-100">
                     <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Artwork Distribution Heatmap</div>
                     <div className="flex-1 flex flex-col justify-center">
                       <div className="grid grid-cols-[36px_1fr_1fr_1fr] gap-2 w-full text-center">
                         {['2D', '3D', 'VDO'].map(type => (
                           <React.Fragment key={type}>
                             <div className="flex items-center text-xs font-black text-slate-500 uppercase">{type}</div>
                             {analytics.matrix.map((c, i) => {
                               const value = c[type as '2D'|'3D'|'VDO'];
                               const ratio = analytics.heatmapMax > 0 ? value / analytics.heatmapMax : 0;
                               const bg = ratio === 0 ? '#f8fafc'
                                 : ratio < 0.25 ? '#dbeafe'
                                 : ratio < 0.5 ? '#93c5fd'
                                 : ratio < 0.75 ? '#3b82f6'
                                 : '#1d4ed8';
                               const textColor = ratio >= 0.5 ? '#ffffff' : '#1e3a8a';
                               return (
                                 <div key={i}
                                   className="py-3 rounded-lg font-black text-sm"
                                   style={{ background: bg, color: textColor }}>
                                   {value > 0 ? value : ''}
                                 </div>
                               );
                             })}
                           </React.Fragment>
                         ))}
                         <div></div>
                         <div className="text-[10px] font-black text-slate-400 uppercase mt-1.5">Project</div>
                         <div className="text-[10px] font-black text-slate-400 uppercase mt-1.5">Lead</div>
                         <div className="text-[10px] font-black text-slate-400 uppercase mt-1.5">Internal</div>
                       </div>
                     </div>
                  </div>
               </div>

               {/* BOTTOM ROW */}
               <div className="flex gap-4 h-[232px]">
                  {/* LEADS */}
                  <div className="bg-white rounded-xl w-[280px] flex flex-col overflow-hidden shadow-sm border border-slate-100">
                     <div className="flex flex-col justify-between flex-1 p-5">
                        <div>
                          <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Leads Handled</div>
                          <div className="flex items-baseline gap-3">
                            <div className="text-6xl font-semibold tracking-tight leading-none text-amber-500">{analytics.allLeadsCount}</div>
                            {(() => {
                              const diff = analytics.allLeadsCount - prevAnalytics.allLeadsCount;
                              const color = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-slate-400';
                              const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '●';
                              return <span className={`text-sm font-black ${color}`}>{arrow} {Math.abs(diff)}</span>;
                            })()}
                          </div>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Grade Breakdown</div>
                            <div className="text-[12px] font-bold text-slate-700 leading-relaxed">
                              {analytics.leadGradesMap ? Object.entries(analytics.leadGradesMap).map(([g, c], i) => (
                                <span key={g}>{g}: {c}{i < Object.keys(analytics.leadGradesMap).length - 1 ? ' · ' : ''}</span>
                              )) : '-'}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Top Requester</div>
                            <div className="text-[12px] font-bold text-slate-700 truncate">{analytics.leadRequesters || '-'}</div>
                          </div>
                        </div>
                     </div>
                  </div>

                  {/* INTERNAL */}
                  <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100">
                     <div className="flex flex-col justify-between flex-1 p-5">
                        <div>
                          <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Internal Artworks</div>
                          <div className="flex items-baseline gap-3">
                            <div className="text-6xl font-semibold tracking-tight leading-none text-yellow-500">{analytics.allInternalCount}</div>
                            {(() => {
                              const diff = analytics.allInternalCount - prevAnalytics.allInternalCount;
                              const color = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-slate-400';
                              const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '●';
                              return <span className={`text-sm font-black ${color}`}>{arrow} {Math.abs(diff)}</span>;
                            })()}
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Top Department</div>
                          <div className="text-[12px] font-bold text-slate-700 leading-relaxed">{analytics.internalDepts || '-'}</div>
                        </div>
                     </div>
                  </div>

                  {/* PROJECT EVALUATION */}
                  <div className="bg-white rounded-xl w-[300px] flex flex-col overflow-hidden shadow-sm border border-slate-100">
                     <div className="flex flex-col justify-between flex-1 p-5">
                        <div>
                          <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Project Evaluation (PM)</div>
                          <div className="flex items-baseline gap-3">
                            <div className="text-6xl font-semibold tracking-tight leading-none text-fuchsia-600 flex items-baseline">
                              {analytics.globalEvalAverage}<span className="text-2xl text-slate-400 ml-1 font-bold">/5</span>
                            </div>
                            {(() => {
                              const diff = parseFloat(analytics.globalEvalAverage) - prevAnalytics.globalEvalAverage;
                              const color = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-slate-400';
                              const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '●';
                              return <span className={`text-sm font-black ${color}`}>{arrow} {parseFloat(Math.abs(diff).toFixed(2))}</span>;
                            })()}
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <div className="text-[12px] font-bold text-slate-600 uppercase tracking-widest">
                            {analytics.uniqueEvaluatedProjects} Projects · {analytics.uniqueEvaluatedTeams} Team Members
                          </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </SlideWrapper>
            );
            }

            if (slide.type === 'team-dashboard') {
              return teamChunks.map((chunk, chunkIdx) => (
                <SlideWrapper key={`${slide.id}-chunk-${chunkIdx}`} id={`slide-${index}-team-${chunkIdx}`} title="TEAM DASHBOARD">
                  <div className="flex-1 flex w-full h-[540px] mt-6 relative gap-4">
                    
                    {/* Team Cards Grid */}
                    <div className="grid grid-cols-4 grid-rows-2 gap-4 w-[980px] h-full">
                      {chunk.map((ds: any, idx: number) => (
                        <div key={idx} className="bg-[#f0f2f1] rounded-2xl relative flex flex-col p-4 pt-12 shadow-sm border border-black/5">
                          {/* Avatar Overlapping Top */}
                          <div className="absolute -top-6 left-6 w-[52px] h-[52px] rounded-full bg-gradient-to-br from-indigo-400 to-blue-600 text-white flex items-center justify-center font-black text-xl shadow-lg border-2 border-white">
                            {ds.name.charAt(0)}
                          </div>
                          
                          {/* Name placeholder if wanted, but screenshot leaves it off and relies on data? Let's add name for usability */}
                          <div className="absolute top-2 right-4 text-[13px] font-extrabold uppercase text-zinc-900 max-w-[120px] text-right truncate">{ds.name}</div>

                          <div className="space-y-2 text-xs font-bold text-zinc-800 mt-2">
                            <div className="flex justify-between border-b border-black/5 pb-1"><span className="w-6">{ds.projInvCount}</span> <span className="text-zinc-500 font-medium">PROJECTS</span></div>
                            <div className="flex justify-between border-b border-black/5 pb-1"><span className="w-6">{ds.uniqueLeads}</span> <span className="text-zinc-500 font-medium">LEADS</span></div>
                            <div className="flex justify-between border-b border-black/5 pb-1 items-center">
                               <span><span className="w-6 inline-block">{ds.avgLeadDur}</span> <span className="text-zinc-500 font-medium">DAYS LEAD DELIVERY</span></span>
                               {parseFloat(ds.avgLeadDur) < 2.0 && parseFloat(ds.avgLeadDur) > 0 && 
                                 <div className="w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px]">★</div>
                               }
                            </div>
                            <div className="flex justify-between border-b border-black/5 pb-1"><span className="w-6">{ds.totalArtworks}</span> <span className="text-zinc-500 font-medium">ARTWORKS</span></div>
                            
                            <div className="text-[10px] font-black bg-zinc-200/50 p-1.5 rounded-md text-center border-b border-black/5 pb-1 mt-2">
                              PRO: {ds.pro} | LEAD: {ds.lead} | INT: {ds.int}
                            </div>

                            <div className="flex justify-between py-1 items-center pt-2">
                              <span><span className="w-6 inline-block">{ds.avgRating}</span> <span className="text-zinc-500 font-medium tracking-tight">PROJECT EVALUATION</span></span>
                              {parseFloat(ds.avgRating) >= 4.0 && 
                                 <div className="w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px]">★</div>
                               }
                            </div>
                          </div>

                          {/* Hapus detailed score hitam */}
                        </div>
                      ))}
                    </div>

                    {/* Next Move dihapus */}

                  </div>
                </SlideWrapper>
              ));
            }

            if (slide.type === 'lead-team-dashboard') {
              const leadDesigners = analytics.teamStats.filter(t => t.uniqueLeads > 0 || t.lead > 0);

              return (
                <SlideWrapper key={slide.id} id={`slide-${index}`} title="LEAD TEAM PERFORMANCE SUMMARY">
                  <div className="flex-1 flex flex-col gap-4 mt-6 w-full h-[540px]">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                             <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-400">Team Member</th>
                             <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-400 text-center">Leads Handled</th>
                             <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-400 text-center">Lead Artworks</th>
                             <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-400 text-center">Avg Duration</th>
                             <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-400 text-right">Efficiency</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leadDesigners.map((d, dIdx) => (
                            <tr key={dIdx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-6">
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-black text-sm uppercase shadow-sm">
                                     {d.name.charAt(0)}
                                   </div>
                                   <div className="flex flex-col">
                                      <span className="font-black text-slate-800 text-sm tracking-tight leading-none uppercase">{d.name}</span>
                                      <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{d.role || 'Personnel'}</span>
                                   </div>
                                </div>
                              </td>
                              <td className="py-3 px-6 text-center">
                                <span className="font-black text-orange-500 text-lg">{d.uniqueLeads}</span>
                              </td>
                              <td className="py-3 px-6 text-center">
                                <span className="font-black text-amber-500 text-lg">{d.lead}</span>
                              </td>
                              <td className="py-3 px-6 text-center">
                                <div className="flex flex-col items-center">
                                   <span className="font-black text-yellow-600 text-lg leading-none">{d.avgLeadDur}<span className="text-[10px] text-slate-400 ml-0.5">d</span></span>
                                   <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter mt-1">delivery avg</span>
                                </div>
                              </td>
                              <td className="py-3 px-6 text-right">
                                {parseFloat(d.avgLeadDur) > 0 && parseFloat(d.avgLeadDur) <= 1.5 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                     <span className="text-xs">⚡</span> OPTIMIZED
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                     STANDARD
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {leadDesigners.length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-300 gap-2">
                          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-xl opacity-50 text-slate-200">∅</div>
                          <div className="font-black uppercase tracking-[0.2em] text-[10px]">No activity in Lead context</div>
                        </div>
                      )}
                    </div>
                  </div>
                </SlideWrapper>
              );
            }

            if (slide.type === 'project-dashboard') {
              return (
                <SlideWrapper key={slide.id} id={`slide-${index}`} title="PROJECT DASHBOARD">
                  <div className="flex-1 flex flex-col gap-4 mt-4 w-full h-[540px]">

                    {/* TOP ROW — 4 KPI Stats (taller) */}
                    <div className="flex gap-4" style={{ height: '280px' }}>

                      {/* 1. Total Projects */}

                      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100">
                        <div className="flex flex-col justify-between flex-1 p-5">
                          <div className="text-xs font-black uppercase tracking-widest text-slate-400">Total Projects</div>
                          <div>
                            <div className="flex items-baseline gap-3">
                              <div className="text-8xl font-semibold tracking-tight leading-none text-indigo-600">{analytics.allProjectsCount}</div>
                              {(() => {
                                const diff = analytics.allProjectsCount - prevAnalytics.allProjectsCount;
                                const color = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-slate-400';
                                const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '●';
                                return <span className={`text-base font-black ${color}`}>{arrow} {Math.abs(diff)}</span>;
                              })()}
                            </div>
                            <div className="text-[11px] font-bold uppercase text-slate-400 mt-1">registered projects</div>
                          </div>
                        </div>
                      </div>

                      {/* 2. Project Artworks */}
                      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100">
                        <div className="flex flex-col justify-between flex-1 p-5">
                          <div className="text-xs font-black uppercase tracking-widest text-slate-400">Project Artworks</div>
                          <div>
                            <div className="flex items-baseline gap-3">
                              <div className="text-8xl font-semibold tracking-tight leading-none text-sky-500">{analytics.totalProjectArtworks}</div>
                              {(() => {
                                const diff = analytics.totalProjectArtworks - prevAnalytics.totalProjectArtworks;
                                const color = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-slate-400';
                                const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '●';
                                return <span className={`text-base font-black ${color}`}>{arrow} {Math.abs(diff)}</span>;
                              })()}
                            </div>
                            <div className="text-[11px] font-bold uppercase text-slate-400 mt-1">total project-context artworks</div>
                          </div>
                        </div>
                      </div>

                      {/* 3. Avg Team Size */}
                      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100">
                        <div className="flex flex-col justify-between flex-1 p-5">
                          <div className="text-xs font-black uppercase tracking-widest text-slate-400">Avg Team Size</div>
                          <div>
                            <div className="flex items-baseline gap-3">
                              <div className="text-8xl font-semibold tracking-tight leading-none text-violet-600">{parseFloat(analytics.avgTeamSize.toFixed(2)).toString()}</div>
                              {(() => {
                                const diff = analytics.avgTeamSize - prevAnalytics.avgTeamSize;
                                const color = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-slate-400';
                                const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '●';
                                return <span className={`text-base font-black ${color}`}>{arrow} {parseFloat(Math.abs(diff).toFixed(2))}</span>;
                              })()}
                            </div>
                            <div className="text-[11px] font-bold uppercase text-slate-400 mt-1">members / project</div>
                          </div>
                        </div>
                      </div>

                      {/* 4. Avg Workdays */}
                      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100">
                        <div className="flex flex-col justify-between flex-1 p-5">
                          <div className="text-xs font-black uppercase tracking-widest text-slate-400">Avg Workdays</div>
                          <div>
                            <div className="flex items-baseline gap-3">
                              <div className="text-8xl font-semibold tracking-tight leading-none text-rose-500">{parseFloat(analytics.avgWorkDays.toFixed(2)).toString()}</div>
                              {(() => {
                                const diff = analytics.avgWorkDays - prevAnalytics.avgWorkDays;
                                const color = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-slate-400';
                                const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '●';
                                return <span className={`text-base font-black ${color}`}>{arrow} {parseFloat(Math.abs(diff).toFixed(2))}</span>;
                              })()}
                            </div>
                            <div className="text-[11px] font-bold uppercase text-slate-400 mt-1">days / project</div>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* BOTTOM ROW — 3 Insight Cards */}
                    <div className="flex gap-4 flex-1">

                      {/* Insight 1: Most Artworks */}
                      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100">
                        <div className="flex flex-col justify-between flex-1 p-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Most Artwork Event</div>
                              <div className="bg-amber-100 text-amber-600 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">🏆 Top</div>
                            </div>
                            <div className="text-base font-black leading-tight text-slate-800 break-words">
                              {analytics.mostArtworkProj ? analytics.mostArtworkProj.proj.project_name : '-'}
                            </div>
                          </div>
                          <div className="flex items-end justify-between mt-3">
                            <div>
                              <div className="text-4xl font-black leading-none text-amber-500">{analytics.mostArtworkProj ? analytics.mostArtworkProj.artworkCount : 0}</div>
                              <div className="text-[11px] font-bold uppercase text-slate-400 mt-0.5">artworks</div>
                            </div>
                            <div className="text-right space-y-0.5">
                              <div className="text-[11px] font-bold text-slate-500">{analytics.mostArtworkProj ? analytics.mostArtworkProj.proj.start_date : '-'}</div>
                              <div className="text-[11px] font-bold text-slate-500">{analytics.mostArtworkProj ? (analytics.mostArtworkProj.proj.locations || []).join(', ') || '-' : '-'}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Insight 2: Longest Duration */}
                      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100">
                        <div className="flex flex-col justify-between flex-1 p-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Longest Duration Event</div>
                              <div className="bg-teal-100 text-teal-600 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">⏱ Longest</div>
                            </div>
                            <div className="text-base font-black leading-tight text-slate-800 break-words">
                              {analytics.longestDurProj ? analytics.longestDurProj.proj.project_name : '-'}
                            </div>
                          </div>
                          <div className="flex items-end justify-between mt-3">
                            <div>
                              <div className="text-4xl font-black leading-none text-teal-500">{analytics.longestDurProj ? analytics.longestDurProj.workDays : 0}</div>
                              <div className="text-[11px] font-bold uppercase text-slate-400 mt-0.5">workdays</div>
                            </div>
                            <div className="text-right space-y-0.5">
                              <div className="text-[11px] font-bold text-slate-500">{analytics.longestDurProj ? analytics.longestDurProj.proj.start_date : '-'}</div>
                              <div className="text-[11px] font-bold text-slate-500">{analytics.longestDurProj ? (analytics.longestDurProj.proj.locations || []).join(', ') || '-' : '-'}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Insight 3: Largest Team */}
                      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100">
                        <div className="flex flex-col justify-between flex-1 p-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Largest Team Event</div>
                              <div className="bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">👥 Biggest</div>
                            </div>
                            <div className="text-base font-black leading-tight text-slate-800 break-words">
                              {analytics.mostTeamProj ? analytics.mostTeamProj.proj.project_name : '-'}
                            </div>
                          </div>
                          <div className="flex items-end justify-between mt-3">
                            <div>
                              <div className="text-4xl font-black leading-none text-slate-600">{analytics.mostTeamProj ? analytics.mostTeamProj.teamSize : 0}</div>
                              <div className="text-[11px] font-bold uppercase text-slate-400 mt-0.5">team members</div>
                            </div>
                            <div className="text-right space-y-0.5">
                              <div className="text-[11px] font-bold text-slate-500">{analytics.mostTeamProj ? analytics.mostTeamProj.proj.start_date : '-'}</div>
                              <div className="text-[11px] font-bold text-slate-500">{analytics.mostTeamProj ? (analytics.mostTeamProj.proj.locations || []).join(', ') || '-' : '-'}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>

                  </div>
                </SlideWrapper>
              );
            }

            if (slide.type === 'lead-dashboard') {
              const LeadBarChart = ({ data }: { data: { label: string; duration: number }[] }) => {
                const maxVal = Math.max(...data.map(d => d.duration), 1);
                const colors = ['#f97316', '#fb923c', '#fdba74', '#fed7aa']; // Amber/Orange
                const W = 1100, H = 220;
                const padL = 60, padR = 20, padTop = 30, padBot = 40;
                const chartW = W - padL - padR;
                const chartH = H - padTop - padBot;
                const barWidth = (chartW / data.length) * 0.6;
                const gap = chartW / data.length;

                return (
                  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                    <defs>
                      <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#fbbf24" />
                      </linearGradient>
                    </defs>
                    {/* Gridlines */}
                    {[0, 1, 2, 3].map(i => {
                      const gv = (maxVal * i) / 3;
                      const y = padTop + chartH - (gv / maxVal) * chartH;
                      return (
                        <g key={i}>
                          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 2" />
                          <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontWeight="600">{Math.round(gv)}d</text>
                        </g>
                      );
                    })}
                    {data.map((d, i) => {
                      const bh = (d.duration / maxVal) * chartH;
                      const bx = padL + i * gap + (gap - barWidth) / 2;
                      const by = padTop + chartH - bh;
                      return (
                        <g key={i}>
                          {d.duration > 0 && <rect x={bx} y={by} width={barWidth} height={bh} rx="6" fill="url(#leadGrad)" />}
                          {d.duration > 0 && <text x={bx + barWidth / 2} y={by - 5} textAnchor="middle" fontSize="11" fill="#ea580c" fontWeight="800">{d.duration}</text>}
                          <text x={bx + barWidth / 2} y={padTop + chartH + 18} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="700" transform={`rotate(10, ${bx + barWidth / 2}, ${padTop + chartH + 18})`}>
                            {d.label.length > 15 ? d.label.substring(0, 13) + '..' : d.label}
                          </text>
                        </g>
                      );
                    })}
                    <line x1={padL} y1={padTop+chartH} x2={W-padR} y2={padTop+chartH} stroke="#e2e8f0" strokeWidth="2" />
                  </svg>
                );
              };

              return (
                <SlideWrapper key={slide.id} id={`slide-${index}`} title="LEAD DASHBOARD">
                  <div className="flex-1 flex flex-col gap-4 mt-4 w-full h-[540px]">
                    {/* TOP ROW — 4 KPI Stats */}
                    <div className="flex gap-4" style={{ height: '220px' }}>
                      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100 p-5 justify-between">
                         <div className="text-xs font-black uppercase tracking-widest text-slate-400">Total Leads</div>
                         <div>
                            <div className="flex items-baseline gap-3">
                               <div className="text-7xl font-semibold tracking-tight text-orange-500">{analytics.allLeadsCount}</div>
                               {(() => {
                                 const diff = analytics.allLeadsCount - prevAnalytics.allLeadsCount;
                                 const color = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-slate-400';
                                 return <span className={`text-base font-black ${color}`}>{diff > 0 ? '▲' : diff < 0 ? '▼' : '●'} {Math.abs(diff)}</span>;
                               })()}
                            </div>
                            <div className="text-[11px] font-bold uppercase text-slate-400 mt-1">lead requests / period</div>
                         </div>
                      </div>

                      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100 p-5 justify-between">
                         <div className="text-xs font-black uppercase tracking-widest text-slate-400">Lead Artworks</div>
                         <div>
                            <div className="flex items-baseline gap-3">
                               <div className="text-7xl font-semibold tracking-tight text-amber-500">{analytics.totalLeadArtworks}</div>
                               {(() => {
                                 const diff = analytics.totalLeadArtworks - prevAnalytics.totalLeadArtworks;
                                 const color = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-slate-400';
                                 return <span className={`text-base font-black ${color}`}>{diff > 0 ? '▲' : diff < 0 ? '▼' : '●'} {Math.abs(diff)}</span>;
                               })()}
                            </div>
                            <div className="text-[11px] font-bold uppercase text-slate-400 mt-1">total artwork count</div>
                         </div>
                      </div>

                      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100 p-5 justify-between">
                         <div className="text-xs font-black uppercase tracking-widest text-slate-400">Avg Workdays</div>
                         <div>
                            <div className="flex items-baseline gap-3">
                               <div className="text-7xl font-semibold tracking-tight text-yellow-500">{parseFloat(analytics.avgLeadWorkDays.toFixed(2)).toString()}</div>
                               {(() => {
                                 const diff = analytics.avgLeadWorkDays - (prevAnalytics.avgLeadWorkDays || 0);
                                 const color = diff > 0 ? 'text-red-500' : diff < 0 ? 'text-emerald-500' : 'text-slate-400';
                                 return <span className={`text-base font-black ${color}`}>{diff > 0 ? '▲' : diff < 0 ? '▼' : '●'} {parseFloat(Math.abs(diff).toFixed(2))}</span>;
                               })()}
                            </div>
                            <div className="text-[11px] font-bold uppercase text-slate-400 mt-1">days / lead processing</div>
                         </div>
                      </div>

                      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100 p-5 justify-between">
                         <div className="text-xs font-black uppercase tracking-widest text-slate-400">Avg Lead Revisions</div>
                         <div>
                            <div className="flex items-baseline gap-3">
                               <div className="text-7xl font-semibold tracking-tight text-rose-500">{parseFloat(analytics.avgLeadRevisions.toFixed(2)).toString()}</div>
                               {(() => {
                                 const diff = analytics.avgLeadRevisions - (prevAnalytics.avgLeadRevisions || 0);
                                 const color = diff > 0 ? 'text-red-500' : diff < 0 ? 'text-emerald-500' : 'text-slate-400';
                                 return <span className={`text-base font-black ${color}`}>{diff > 0 ? '▲' : diff < 0 ? '▼' : '●'} {parseFloat(Math.abs(diff).toFixed(2))}</span>;
                               })()}
                            </div>
                            <div className="text-[11px] font-bold uppercase text-slate-400 mt-1">revisions / artwork</div>
                         </div>
                      </div>
                    </div>

                    {/* Chart Per Lead Duration */}
                    <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col p-6 overflow-hidden">
                       <div className="mb-4">
                          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Processing Time per Lead</div>
                          <div className="text-xl font-black text-slate-800 leading-tight">Lead Duration (Days)</div>
                       </div>
                       <div className="flex-1 flex items-end">
                          <LeadBarChart data={analytics.leadDurationData} />
                       </div>
                    </div>
                  </div>
                </SlideWrapper>
              );
            }

            if (slide.type === 'project-chart') {
              // SVG bar chart helper
              const SvgBarChart = ({
                data,
                valueKey,
                colorFrom,
                colorTo,
                labelColor,
                gradId,
              }: {
                data: { label: string; key: string; projects: number; artworks: number }[];
                valueKey: 'projects' | 'artworks';
                colorFrom: string;
                colorTo: string;
                labelColor: string;
                gradId: string;
              }) => {
                const values = data.map(d => d[valueKey]);
                const maxVal = Math.max(...values, 1);
                const W = 560, H = 280;
                const padL = 44, padR = 16, padTop = 36, padBot = 36;
                const chartW = W - padL - padR;
                const chartH = H - padTop - padBot;
                const barW = (chartW / data.length) * 0.55;
                const gap = chartW / data.length;

                // Y gridlines (0, 1/3, 2/3, max)
                const gridLines = [0, 1, 2, 3].map(i => maxVal * i / 3);

                return (
                  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={colorFrom} />
                        <stop offset="100%" stopColor={colorTo} />
                      </linearGradient>
                    </defs>

                    {/* Grid lines + Y labels */}
                    {gridLines.map((gv, gi) => {
                      const y = padTop + chartH - (gv / maxVal) * chartH;
                      return (
                        <g key={gi}>
                          <line x1={padL} y1={y} x2={W - padR} y2={y}
                            stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 3" />
                          <text x={padL - 6} y={y + 4} textAnchor="end"
                            fontSize="11" fill="#94a3b8" fontWeight="600">
                            {parseFloat(gv.toFixed(1)) % 1 === 0 ? Math.round(gv) : parseFloat(gv.toFixed(1))}
                          </text>
                        </g>
                      );
                    })}

                    {/* Bars + value labels + X labels */}
                    {data.map((d, i) => {
                      const val = d[valueKey];
                      const bh = val > 0 ? Math.max(4, (val / maxVal) * chartH) : 0;
                      const bx = padL + i * gap + (gap - barW) / 2;
                      const by = padTop + chartH - bh;
                      return (
                        <g key={i}>
                          {/* Bar */}
                          {val > 0 && (
                            <rect x={bx} y={by} width={barW} height={bh}
                              rx="6" ry="6" fill={`url(#${gradId})`} />
                          )}
                          {/* Value label above bar */}
                          {val > 0 && (
                            <text x={bx + barW / 2} y={by - 6}
                              textAnchor="middle" fontSize="12"
                              fill={labelColor} fontWeight="800">
                              {val}
                            </text>
                          )}
                          {/* X label */}
                          <text x={bx + barW / 2} y={padTop + chartH + 20}
                            textAnchor="middle" fontSize="11"
                            fill={val > 0 ? '#64748b' : '#cbd5e1'} fontWeight="700">
                            {d.label}
                          </text>
                        </g>
                      );
                    })}

                    {/* Baseline */}
                    <line x1={padL} y1={padTop + chartH} x2={W - padR} y2={padTop + chartH}
                      stroke="#e2e8f0" strokeWidth="1.5" />
                  </svg>
                );
              };

              return (
                <SlideWrapper key={slide.id} id={`slide-${index}`} title="PROJECT DASHBOARD">
                  <div className="flex-1 flex flex-col gap-6 mt-4 w-full h-[540px]">

                    <div className="flex gap-6 flex-1">

                      {/* Chart 1: Jumlah Project per Bulan */}
                      <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col p-5 overflow-hidden">
                        <div className="mb-3">
                          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Projects per Month</div>
                          <div className="text-xl font-black text-slate-800 leading-tight">
                            Total Projects
                          </div>
                        </div>
                        <div className="flex-1 flex items-end">
                          <SvgBarChart
                            data={analytics.monthlyProjectData}
                            valueKey="projects"
                            colorFrom="#818cf8"
                            colorTo="#c4b5fd"
                            labelColor="#4f46e5"
                            gradId="grad-projects"
                          />
                        </div>
                      </div>

                      {/* Chart 2: Jumlah Artwork Project per Bulan */}
                      <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col p-5 overflow-hidden">
                        <div className="mb-3">
                          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Artworks per Month</div>
                          <div className="text-xl font-black text-slate-800 leading-tight">
                            Total Project Artworks
                          </div>
                        </div>
                        <div className="flex-1 flex items-end">
                          <SvgBarChart
                            data={analytics.monthlyProjectData}
                            valueKey="artworks"
                            colorFrom="#38bdf8"
                            colorTo="#818cf8"
                            labelColor="#0ea5e9"
                            gradId="grad-artworks"
                          />
                        </div>
                      </div>

                    </div>

                  </div>
                </SlideWrapper>
              );
            }

            return null;
          })}
          
        </div>
      </div>
    </div>
  );
};

export default (props: Props) => (
  <ReportGeneratorErrorBoundary>
    <ReportGenerator {...props} />
  </ReportGeneratorErrorBoundary>
);
