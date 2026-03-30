import React, { useState, useMemo, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { AppState, WorkContext } from '../types';

interface Props {
  state: AppState;
}

type SlideType = 'title' | 'divider' | 'general-dashboard' | 'team-dashboard' | 'project-dashboard';

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
    { id: 'divider', type: 'divider', dividerText: dividerText },
    { id: 'general-dashboard', type: 'general-dashboard' },
    { id: 'team-dashboard', type: 'team-dashboard', nextMoveText: nextMoveText }
  ]);

  useEffect(() => {
    const saved = localStorage.getItem('acs_saved_reports');
    if (saved) {
      try {
        setSavedReports(JSON.parse(saved));
      } catch(e) {}
    }
  }, []);

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

    return {
      totalArtworks: filteredLogs.length,
      allProjectsCount: allProjects.length,
      allLeadsCount: allLeads.length,
      allInternalCount: allInternal.length,
      globalEvalAverage: gCount > 0 ? parseFloat((gSum / gCount).toFixed(2)) : 0,
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
    const formattedDiff = Math.abs(diff) < 1 && diff !== 0 ? diff.toFixed(2) : diff.toString();
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
              <button 
                onClick={() => addSlide('title')} 
                className="w-full px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium text-sm transition-colors"
              >
                + Add Title Slide
              </button>
              <button 
                onClick={() => addSlide('divider')} 
                className="w-full px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg font-medium text-sm transition-colors"
              >
                + Add Divider Slide
              </button>
              <button 
                onClick={() => addSlide('general-dashboard')} 
                className="w-full px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg font-medium text-sm transition-colors"
              >
                + Add General Dashboard
              </button>
              <button 
                onClick={() => addSlide('team-dashboard')} 
                className="w-full px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg font-medium text-sm transition-colors"
              >
                + Add Team Dashboard
              </button>
              <button 
                onClick={() => addSlide('project-dashboard')} 
                className="w-full px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg font-medium text-sm transition-colors"
              >
                + Add Project Dashboard
              </button>
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
                        onClick={() => addSlide(slide.type, index)}
                        className="px-2 py-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-600 rounded text-xs font-medium"
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
                  <button key={rp.id} onClick={() => loadReport(rp)} className="w-full text-left p-2 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-100 transition-colors">
                    <div className="font-bold text-sm text-zinc-800">{rp.label}</div>
                    <div className="text-xs text-zinc-500 truncate">{new Date(rp.generatedAt).toLocaleDateString()}</div>
                  </button>
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
                  {/* Total Artworks & PIC */}
                  <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-sky-500 text-white rounded-xl flex-1 flex flex-col overflow-hidden">
                     <div className="flex flex-1 p-6">
                        <div className="flex-1 border-r border-white/20 pr-6 flex flex-col justify-center relative">
                           <div className="text-6xl font-semibold tracking-tight leading-none mb-3">{analytics.totalArtworks}</div>
                           <div className="font-bold text-sm tracking-widest uppercase mb-2 text-white/90">TOTAL ARTWORKS</div>
                           <div className="text-[10px] uppercase leading-relaxed font-semibold text-white/80 mt-auto">
                              ARTWORK PALING BANYAK MUNCUL:<br/><span className="italic text-white">{analytics.topKeywords || '-'}</span>
                           </div>
                        </div>
                        <div className="flex-1 pl-6 flex flex-col justify-center">
                           <div className="text-6xl font-semibold tracking-tight leading-none mb-3">{analytics.allProjectsCount}</div>
                           <div className="font-bold text-sm tracking-widest uppercase mb-4 text-white/90">PROJECT INCHARGE</div>
                           <div className="text-[10px] uppercase leading-relaxed font-bold space-y-1 mt-auto">
                             <div className="flex flex-col gap-1">
                               <div className="flex items-start gap-2">
                                 <span className="text-white/70 min-w-[70px]">TOP PIC:</span>
                                 <span className="text-white break-words">{analytics.projectPICs || '-'}</span>
                               </div>
                               <div className="flex items-start gap-2">
                                 <span className="text-white/70 min-w-[70px]">TOP LOCATION:</span>
                                 <span className="text-white break-words">{analytics.projectLocs || '-'}</span>
                               </div>
                             </div>
                           </div>
                        </div>
                     </div>
                     <div className="bg-slate-900/30 text-white text-sm font-semibold px-4 py-3 flex items-center justify-between">
                        {analytics.totalArtworks !== undefined && prevAnalytics.totalArtworks !== undefined ? (
                          <span>{analytics.totalArtworks - prevAnalytics.totalArtworks >= 0 ? '▲' : '▼'} {Math.abs(analytics.totalArtworks - prevAnalytics.totalArtworks)} artworks vs last month</span>
                        ) : <span>- artworks vs last month</span>}
                        {analytics.allProjectsCount !== undefined && prevAnalytics.allProjectsCount !== undefined ? (
                          <span>{analytics.allProjectsCount - prevAnalytics.allProjectsCount >= 0 ? '▲' : '▼'} {Math.abs(analytics.allProjectsCount - prevAnalytics.allProjectsCount)} projects vs last month</span>
                        ) : <span>- projects vs last month</span>}
                     </div>
                  </div>
                  
                  {/* Heatmap */}
                  <div className="w-[450px] bg-gradient-to-br from-sky-500 via-blue-500 to-cyan-500 text-white p-5 rounded-xl flex flex-col">
                     <div className="font-bold text-sm uppercase tracking-wider mb-4 text-white/90">GENERAL ARTWORK HEATMAP</div>
                     <div className="flex-1 flex flex-col justify-center">
                       <div className="grid grid-cols-[40px_1fr_1fr_1fr] gap-2 w-full text-center">
                         {/* Header implicitly below */}
                         {['2D', '3D', 'VDO'].map(type => (
                           <React.Fragment key={type}>
                             <div className="flex items-center text-xs font-bold text-white/80 uppercase">{type}</div>
                             {analytics.matrix.map((c, i) => {
                               const value = c[type as '2D'|'3D'|'VDO'];
                               const isMax = value === analytics.heatmapMax;
                               const isMin = value === analytics.heatmapMin;
                               const cellClass = isMax ? 'bg-emerald-500/80 text-white' : isMin ? 'bg-red-500/70 text-white' : 'bg-slate-500/80 text-white/80';
                               return (
                                 <div key={i} className={`py-3 rounded font-bold text-sm ${cellClass}`}>
                                   {value > 0 ? value : ''}
                                 </div>
                               );
                             })}
                           </React.Fragment>
                         ))}
                         {/* X-axis labels */}
                         <div></div>
                         <div className="text-[10px] font-bold text-white/70 uppercase mt-1">PROJECT</div>
                         <div className="text-[10px] font-bold text-white/70 uppercase mt-1">LEAD</div>
                         <div className="text-[10px] font-bold text-white/70 uppercase mt-1">INTERNAL</div>
                       </div>
                     </div>
                  </div>
               </div>

               {/* BOTTOM ROW */}
               <div className="flex gap-4 h-[240px]">
                  {/* LEADS */}
                  <div className="bg-gradient-to-br from-orange-500 via-amber-500 to-orange-400 text-white rounded-xl w-[280px] flex flex-col overflow-hidden">
                     <div className="flex flex-col justify-between flex-1 p-6">
                        <div className="text-7xl font-semibold tracking-tight leading-none mt-2">{analytics.allLeadsCount}</div>
                        <div>
                           <div className="font-bold text-xs tracking-widest uppercase mb-2 text-white/90">LEADS HANDLED</div>
                           <div className="text-[10px] uppercase font-bold grid grid-cols-[50px_1fr] gap-1 leading-relaxed">
                              <span className="text-white/80">GRADE</span>
                              <span className="truncate">
                                {analytics.leadGradesMap ? Object.entries(analytics.leadGradesMap).map(([grade, count], i) => (
                                  <span key={grade}>{grade}: {count}{i < Object.keys(analytics.leadGradesMap).length - 1 ? ', ' : ''}</span>
                                )) : '-'}
                              </span>
                              <span className="text-white/80">REQ</span><span className="truncate">: {analytics.leadRequesters || '-'}</span>
                           </div>
                        </div>
                     </div>
                     <MomFooter current={analytics.allLeadsCount} prev={prevAnalytics.allLeadsCount} label="leads" />
                  </div>

                  {/* INTERNAL */}
                  <div className="bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-400 text-white rounded-xl flex-1 flex flex-col overflow-hidden">
                     <div className="flex flex-col justify-between flex-1 p-6">
                        <div className="text-7xl font-semibold tracking-tight leading-none mt-2">{analytics.allInternalCount}</div>
                        <div>
                           <div className="font-bold text-xs tracking-widest uppercase mb-2 text-white/90">INTERNAL ARTWORKS</div>
                           <div className="text-[10px] uppercase font-bold grid grid-cols-[40px_1fr] gap-1 leading-relaxed">
                              <span className="text-white/80">DEPT</span><span className="truncate text-white">: {analytics.internalDepts || '-'}</span>
                           </div>
                        </div>
                     </div>
                     <MomFooter current={analytics.allInternalCount} prev={prevAnalytics.allInternalCount} label="internal" />
                  </div>

                  {/* PENILAIAN */}
                  <div className="bg-gradient-to-br from-fuchsia-600 via-pink-600 to-rose-600 text-white rounded-xl w-[320px] flex flex-col overflow-hidden">
                     <div className="flex flex-col justify-between flex-1 p-6">
                        <div className="text-7xl font-semibold tracking-tight leading-none mt-2 flex items-baseline">
                           {analytics.globalEvalAverage} <span className="text-3xl text-white/80 ml-1 font-bold">/5</span>
                        </div>
                        <div>
                           <div className="font-bold text-xs tracking-widest uppercase mb-2 text-white/90">PENILAIAN TEAM PROJECT (From PM)</div>
                           <div className="text-[10px] uppercase font-medium tracking-widest border-t border-white/20 pt-2 text-white">
                              {analytics.uniqueEvaluatedProjects} PROJECTS | {analytics.uniqueEvaluatedTeams} TEAM
                           </div>
                        </div>
                     </div>
                     <MomFooter current={parseFloat(analytics.globalEvalAverage)} prev={prevAnalytics.globalEvalAverage} label="avg score" />
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

            if (slide.type === 'project-dashboard') {
              return (
                <SlideWrapper key={slide.id} id={`slide-${index}`} title="PROJECT DASHBOARD">
                  <div className="flex-1 flex flex-col gap-5 mt-4 w-full h-[540px]">

                    {/* TOP ROW — 5 KPI Stats */}
                    <div className="flex gap-4 h-[190px]">

                      {/* 1. Jumlah Project */}
                      <div className="bg-gradient-to-br from-indigo-600 to-blue-500 text-white rounded-xl flex-1 flex flex-col justify-between p-5 overflow-hidden">
                        <div className="text-[10px] font-black uppercase tracking-widest text-white/70">Jumlah Project</div>
                        <div className="text-7xl font-semibold tracking-tight leading-none">{analytics.allProjectsCount}</div>
                        <div className="text-[10px] font-bold uppercase text-white/60">event / project terdaftar</div>
                      </div>

                      {/* 2. Jumlah Artwork khusus Project */}
                      <div className="bg-gradient-to-br from-sky-500 to-cyan-400 text-white rounded-xl flex-1 flex flex-col justify-between p-5 overflow-hidden">
                        <div className="text-[10px] font-black uppercase tracking-widest text-white/70">Artwork Project</div>
                        <div className="text-7xl font-semibold tracking-tight leading-none">{analytics.totalProjectArtworks}</div>
                        <div className="text-[10px] font-bold uppercase text-white/60">total artwork konteks project</div>
                      </div>

                      {/* 3. Rata-rata Tim ACS */}
                      <div className="bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white rounded-xl flex-1 flex flex-col justify-between p-5 overflow-hidden">
                        <div className="text-[10px] font-black uppercase tracking-widest text-white/70">Rata-rata Tim ACS</div>
                        <div className="text-7xl font-semibold tracking-tight leading-none">{analytics.avgTeamSize.toFixed(1)}</div>
                        <div className="text-[10px] font-bold uppercase text-white/60">orang / project</div>
                      </div>

                      {/* 4. Rata-rata Hari Kerja */}
                      <div className="bg-gradient-to-br from-rose-500 to-pink-500 text-white rounded-xl flex-1 flex flex-col justify-between p-5 overflow-hidden">
                        <div className="text-[10px] font-black uppercase tracking-widest text-white/70">Rata-rata Hari Kerja</div>
                        <div className="text-7xl font-semibold tracking-tight leading-none">{analytics.avgWorkDays.toFixed(1)}</div>
                        <div className="text-[10px] font-bold uppercase text-white/60">hari / project</div>
                      </div>

                    </div>

                    {/* BOTTOM ROW — 3 Insight Cards */}
                    <div className="flex gap-4 flex-1">

                      {/* Insight 1: Event with most artworks */}
                      <div className="bg-gradient-to-br from-amber-500 to-orange-400 text-white rounded-xl flex-1 flex flex-col justify-between p-5 overflow-hidden relative">
                        <div className="absolute top-3 right-3 bg-white/20 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">🏆 Terbanyak</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-2">Event Artwork Terbanyak</div>
                        <div className="text-2xl font-black leading-tight mb-1 break-words">
                          {analytics.mostArtworkProj ? analytics.mostArtworkProj.proj.project_name : '-'}
                        </div>
                        <div className="flex items-end justify-between mt-auto">
                          <div>
                            <div className="text-4xl font-black leading-none">{analytics.mostArtworkProj ? analytics.mostArtworkProj.artworkCount : 0}</div>
                            <div className="text-[10px] font-bold uppercase text-white/70">artworks</div>
                          </div>
                          <div className="text-right text-[10px] text-white/70 font-semibold uppercase">
                            <div>{analytics.mostArtworkProj ? analytics.mostArtworkProj.proj.start_date : '-'}</div>
                            <div>{analytics.mostArtworkProj ? (analytics.mostArtworkProj.proj.locations || []).join(', ') || '-' : '-'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Insight 2: Event with longest duration */}
                      <div className="bg-gradient-to-br from-teal-600 to-emerald-500 text-white rounded-xl flex-1 flex flex-col justify-between p-5 overflow-hidden relative">
                        <div className="absolute top-3 right-3 bg-white/20 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">⏱ Terlama</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-2">Event Durasi Kerja Terlama</div>
                        <div className="text-2xl font-black leading-tight mb-1 break-words">
                          {analytics.longestDurProj ? analytics.longestDurProj.proj.project_name : '-'}
                        </div>
                        <div className="flex items-end justify-between mt-auto">
                          <div>
                            <div className="text-4xl font-black leading-none">{analytics.longestDurProj ? analytics.longestDurProj.workDays : 0}</div>
                            <div className="text-[10px] font-bold uppercase text-white/70">hari kerja</div>
                          </div>
                          <div className="text-right text-[10px] text-white/70 font-semibold uppercase">
                            <div>{analytics.longestDurProj ? analytics.longestDurProj.proj.start_date : '-'}</div>
                            <div>{analytics.longestDurProj ? (analytics.longestDurProj.proj.locations || []).join(', ') || '-' : '-'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Insight 3: Event with most team */}
                      <div className="bg-gradient-to-br from-slate-700 to-zinc-600 text-white rounded-xl flex-1 flex flex-col justify-between p-5 overflow-hidden relative">
                        <div className="absolute top-3 right-3 bg-white/20 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">👥 Terbesar</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-2">Event Tim ACS Terbanyak</div>
                        <div className="text-2xl font-black leading-tight mb-1 break-words">
                          {analytics.mostTeamProj ? analytics.mostTeamProj.proj.project_name : '-'}
                        </div>
                        <div className="flex items-end justify-between mt-auto">
                          <div>
                            <div className="text-4xl font-black leading-none">{analytics.mostTeamProj ? analytics.mostTeamProj.teamSize : 0}</div>
                            <div className="text-[10px] font-bold uppercase text-white/70">anggota tim ACS</div>
                          </div>
                          <div className="text-right text-[10px] text-white/70 font-semibold uppercase">
                            <div>{analytics.mostTeamProj ? analytics.mostTeamProj.proj.start_date : '-'}</div>
                            <div>{analytics.mostTeamProj ? (analytics.mostTeamProj.proj.locations || []).join(', ') || '-' : '-'}</div>
                          </div>
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
