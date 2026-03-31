import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { AppState, WorkContext } from '../types';

interface Props {
  state: AppState;
}

type SlideType = 'title' | 'divider' | 'general-dashboard' | 'team-dashboard' | 'project-dashboard' | 'lead-dashboard' | 'lead-team-dashboard' | 'project-chart' | 'internal-dashboard' | 'internal-chart' | 'team-project-chart' | 'google-ads';

interface Slide {
  id: string;
  type: SlideType;
  title?: string;
  dividerText?: string;
  nextMoveText?: string;
  spreadsheetUrl?: string;
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


const GoogleAdsSummaryContent: React.FC<{ url?: string }> = ({ url }) => {
    const defaultUrl = "https://docs.google.com/spreadsheets/d/1TJX3LrTiqhFTpK52UaV_G6Wr5b37mPkVZxB0ezAHNTQ/gviz/tq?tqx=out:csv&sheet=KeywordData";
    const fetchUrl = url || defaultUrl;
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'clicks', direction: 'desc' });

    const fetchData = async () => {
        // Try to load from cache first for instant feedback if possible
        const cacheKey = `gads_cache_${fetchUrl}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached && loading) {
            try {
                const { timestamp, data: cachedData } = JSON.parse(cached);
                // Cache valid for 30 minutes
                if (Date.now() - timestamp < 30 * 60 * 1000) {
                    setData(cachedData);
                    setLoading(false);
                }
            } catch(e) {}
        }

        setLoading(true);
        setError(null);
        try {
            let targetUrl = fetchUrl;
            
            // URL Transformation
            if (targetUrl.includes('/edit')) {
                const gidMatch = targetUrl.match(/[#&?]gid=([0-9]+)/);
                const gid = gidMatch ? gidMatch[1] : null;
                targetUrl = targetUrl.replace(/\/edit.*$/, '/gviz/tq?tqx=out:csv');
                if (gid) targetUrl += `&gid=${gid}`;
            }

            const proxyServers = [
                `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
                `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
                `https://thingproxy.freeboard.io/fetch/${targetUrl}`
            ];

            // RACE the proxies for the fastest response
            const csvText = await Promise.any(proxyServers.map(async (proxyUrl) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout per proxy
                
                try {
                    const resp = await fetch(proxyUrl, { cache: 'no-cache', signal: controller.signal });
                    clearTimeout(timeoutId);
                    if (!resp.ok) throw new Error("Failed");
                    const text = await resp.text();
                    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html') || text.length < 10) {
                        throw new Error("Invalid format");
                    }
                    return text;
                } catch (e) {
                    clearTimeout(timeoutId);
                    throw e;
                }
            }));

            if (!csvText) throw new Error("No data received");

            // Robust CSV Parsing with Header Normalization
            const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
            if (lines.length > 0) {
                const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ''));
                
                // Melakukan normalisasi header agar tahan terhadap perbedaan huruf besar/kecil atau spasi
                const headerMap: Record<string, string> = {};
                rawHeaders.forEach(h => {
                    const normalized = h.toLowerCase().replace(/[^a-z]/g, '');
                    if (normalized.includes('keyword')) headerMap[h] = 'keyword';
                    else if (normalized.includes('date')) headerMap[h] = 'date';
                    else if (normalized.includes('clicks')) headerMap[h] = 'clicks';
                    else if (normalized.includes('impressions')) headerMap[h] = 'impressions';
                    else if (normalized.includes('cost')) headerMap[h] = 'cost';
                    else if (normalized.includes('conversions')) headerMap[h] = 'conversions';
                    else headerMap[h] = h;
                });

                const parsed = lines.slice(1).map(line => {
                    let row: string[] = [];
                    let cell = "";
                    let inQuotes = false;
                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        if (char === '"') inQuotes = !inQuotes;
                        else if (char === "," && !inQuotes) {
                            row.push(cell.trim());
                            cell = "";
                        } else cell += char;
                    }
                    row.push(cell.trim());
                    
                    let obj: any = {};
                    rawHeaders.forEach((h, i) => {
                        let val = row[i]?.replace(/^"|"$/g, '') || '';
                        const targetKey = headerMap[h];
                        
                        // Membersihkan angka dari simbol mata uang, koma pemisah ribuan, atau spasi
                        if (['clicks', 'impressions', 'cost', 'conversions'].includes(targetKey)) {
                            // Hapus semua karakter kecuali angka, titik desimal, dan tanda minus
                            const cleanNum = val.replace(/[^0-9.\-]/g, '');
                            obj[targetKey] = parseFloat(cleanNum) || 0;
                        } else if (targetKey === 'keyword') {
                            obj['keyword'] = val;
                        } else if (targetKey === 'date') {
                            obj['date'] = val;
                        } else {
                            obj[h] = val; // fallback ke header asli
                        }
                    });
                    return obj;
                });
                setData(parsed);
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: parsed }));
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [fetchUrl]);

    const totals = useMemo(() => {
        return data.reduce((acc, curr) => ({
            clicks: acc.clicks + (curr.clicks || 0),
            impressions: acc.impressions + (curr.impressions || 0),
            cost: acc.cost + (curr.cost || 0),
            conversions: acc.conversions + (curr.conversions || 0),
        }), { clicks: 0, impressions: 0, cost: 0, conversions: 0 });
    }, [data]);

    const chartData = useMemo(() => {
        const grouped: Record<string, any> = {};
        data.forEach(item => {
            const dateStr = item.date;
            if (!dateStr) return;
            if (!grouped[dateStr]) grouped[dateStr] = { date: dateStr, clicks: 0, conversions: 0 };
            grouped[dateStr].clicks += item.clicks;
            grouped[dateStr].conversions += item.conversions;
        });
        return Object.values(grouped).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [data]);

    const filteredData = useMemo(() => {
        let result = [...data].filter(item => 
            (item.keyword || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        const config = sortConfig;
        result.sort((a,b) => {
            if (config) {
                const aVal = a[config.key];
                const bVal = b[config.key];
                if (aVal < bVal) return config.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return config.direction === 'asc' ? 1 : -1;
            }
            // Tie-breaker or default sort: Click > Conv > Impr
            if (b.clicks !== a.clicks) return b.clicks - a.clicks;
            if (b.conversions !== a.conversions) return b.conversions - a.conversions;
            return b.impressions - a.impressions;
        });
        return result;
    }, [data, searchTerm, sortConfig]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    if (loading) return (
        <div className="flex-1 flex flex-col items-center justify-center h-[540px]">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-indigo-600 mb-6"></div>
            <div className="text-xl font-black uppercase tracking-widest text-slate-400">Loading Ads Performance...</div>
        </div>
    );

    if (error) return (
        <div className="flex-1 flex flex-col items-center justify-center h-[540px] text-center p-20 bg-rose-50/30 rounded-3xl border-2 border-dashed border-rose-200">
            <div className="text-rose-500 text-6xl mb-6">🚫</div>
            <div className="text-2xl font-black text-slate-800 uppercase tracking-tight">Syncing Service Failed</div>
            <div className="text-slate-500 font-medium max-w-sm mt-2">{error}</div>
            <button onClick={fetchData} className="mt-8 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-lg transition-all active:scale-95">RETRY CONNECTION</button>
        </div>
    );

    return (
        <div className="flex-1 flex flex-col gap-5 mt-4 w-full h-[540px]">
             {/* Scorecards */}
             <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Total Clicks", val: (totals.clicks || 0).toLocaleString('id-ID'), color: "text-blue-500", icon: "🖱️" },
                  { label: "Total Impressions", val: (totals.impressions || 0).toLocaleString('id-ID'), color: "text-indigo-500", icon: "👁️" },
                  { label: "Total Cost", val: "Rp " + Math.floor(totals.cost || 0).toLocaleString('id-ID'), color: "text-emerald-500", icon: "💰" },
                  { label: "Total Conversions", val: (totals.conversions || 0).toLocaleString('id-ID'), color: "text-rose-500", icon: "🎯" },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between h-[110px] overflow-hidden">
                     <div className="flex justify-between items-start">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{s.label}</div>
                        <span className="text-base opacity-80">{s.icon}</span>
                     </div>
                     <div className={`text-2xl font-black tracking-tight leading-none truncate ${s.color}`} title={s.val}>{s.val}</div>
                     <div className="text-[8px] font-bold uppercase text-slate-300 mt-1">performance metric</div>
                  </div>
                ))}
             </div>

             <div className="grid grid-cols-12 gap-5 flex-1 min-h-0">
                {/* Chart */}
                <div className="col-span-5 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                   <div className="flex justify-between items-end mb-6">
                      <div>
                         <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">Conversion Trend</div>
                         <div className="text-xl font-black text-slate-800 tracking-tight leading-none">Activity vs Results</div>
                      </div>
                      <button onClick={fetchData} className="text-[9px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-100/50 transition-colors">⟳ REFRESH</button>
                   </div>
                   <div className="flex-1 w-full -ml-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorAdsClicks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" fontSize={9} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} hide />
                        <YAxis fontSize={9} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold'}} />
                        <Legend iconType="circle" wrapperStyle={{fontSize: "9px", fontWeight: "900", textTransform: "uppercase", paddingTop: "15px"}} />
                        <Area type="monotone" dataKey="clicks" stroke="#6366f1" fillOpacity={1} fill="url(#colorAdsClicks)" strokeWidth={3} />
                        <Area type="monotone" dataKey="conversions" stroke="#f43f5e" fillOpacity={0} strokeWidth={3} strokeDasharray="5 5" />
                      </AreaChart>
                    </ResponsiveContainer>
                   </div>
                </div>

                {/* Table */}
                <div className="col-span-7 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                   <div className="p-4 px-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search Keywords Breakdown</div>
                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="Search Keywords..." 
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          className="bg-white border border-slate-200 rounded-xl py-1.5 pl-3 pr-8 text-[11px] font-bold w-56 outline-none focus:border-indigo-400 shadow-sm transition-all"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 text-[12px]">🔍</span>
                      </div>
                   </div>
                   <div className="flex-1 overflow-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                         <thead className="bg-[#fcfdfe] sticky top-0 z-10 border-b border-slate-100">
                            <tr>
                               {[
                                 { label: "Search Keyword", key: "keyword" },
                                 { label: "Clicks", key: "clicks" },
                                 { label: "Impressions", key: "impressions" },
                                 { label: "Cost", key: "cost" },
                                 { label: "Conversions", key: "conversions" },
                               ].map(h => (
                                 <th 
                                   key={h.key} 
                                   onClick={() => requestSort(h.key)}
                                   className="px-6 py-3 font-bold uppercase tracking-widest text-slate-500 cursor-pointer hover:text-indigo-600 transition-colors group text-[10px]"
                                 >
                                   <div className="flex items-center gap-1.5 justify-between">
                                      {h.label}
                                      <span className={`transition-opacity ${sortConfig?.key === h.key ? 'opacity-100' : 'opacity-20 group-hover:opacity-50'}`}>
                                        {sortConfig?.key === h.key ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                                      </span>
                                   </div>
                                 </th>
                               ))}
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {filteredData.map((row, idx) => (
                               <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-6 py-2.5 text-slate-600 font-bold uppercase tracking-tight text-[10px] leading-tight max-w-[200px] break-words">{row.keyword || '-'}</td>
                                  <td className="px-6 py-2.5 font-bold text-slate-600">{(row.clicks || 0).toLocaleString('id-ID')}</td>
                                  <td className="px-6 py-2.5 font-bold text-slate-500">{(row.impressions || 0).toLocaleString('id-ID')}</td>
                                  <td className="px-6 py-2.5 font-bold text-emerald-600 text-[10px]">Rp {Math.floor(row.cost || 0).toLocaleString('id-ID')}</td>
                                  <td className="px-6 py-2.5 text-rose-500 font-bold">{(row.conversions || 0).toLocaleString('id-ID')}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                      {filteredData.length === 0 && (
                        <div className="p-16 flex flex-col items-center justify-center opacity-30">
                           <span className="text-4xl mb-2">🔎</span>
                           <div className="text-[10px] font-black uppercase tracking-widest">No matching results</div>
                        </div>
                      )}
                   </div>
                </div>
             </div>
        </div>
    );
};

const ReportGenerator: React.FC<Props> = ({ state }) => {
  const [targetMonth, setTargetMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));  const [targetYear, setTargetYear] = useState(String(new Date().getFullYear()));
  const [isFullYear, setIsFullYear] = useState(false);
  const [titleText, setTitleText] = useState('WORK MANAGEMENT REPORT');
  const [dividerText, setDividerText] = useState('MONTHLY PERFORMANCE SUMMARY');
  const [nextMoveText, setNextMoveText] = useState('1. Evaluasi singkat hasil dari penilaian project\n2. Pemantauan kriteria poin terendah project untuk ditingkatkan');
  
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Basic saving functionality via localStorage
  const [savedReports, setSavedReports] = useState<any[]>([]);

  // Core Slide Management
  const [slides, setSlides] = useState<Slide[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('acs_active_slides');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch(e) {}
    }
    return [
      { id: 'title', type: 'title', title: 'WORK MANAGEMENT REPORT' },
      { id: 'general-dashboard', type: 'general-dashboard' },
      { id: 'team-dashboard', type: 'team-dashboard', nextMoveText: '1. Evaluasi singkat hasil dari penilaian project\n2. Pemantauan kriteria poin terendah project untuk ditingkatkan' },
      { id: 'project-dashboard', type: 'project-dashboard' },
      { id: 'lead-dashboard', type: 'lead-dashboard' },
      { id: 'lead-team-dashboard', type: 'lead-team-dashboard' },
      { id: 'internal-dashboard', type: 'internal-dashboard' },
      { id: 'internal-chart', type: 'internal-chart' },
      { id: 'team-project-chart', type: 'team-project-chart' },
      { id: 'project-chart', type: 'project-chart' }
    ];
  });

  useEffect(() => {
    const saved = localStorage.getItem('acs_saved_reports');
    if (saved) {
      try {
        setSavedReports(JSON.parse(saved));
      } catch(e) {}
    }
  }, []);

  // Auto-persist slides whenever they change
  useEffect(() => {
    localStorage.setItem('acs_active_slides', JSON.stringify(slides));
  }, [slides]);

  // Update slide texts ONLY if they are the default ones or when user explicitly changes global text
  useEffect(() => {
    setSlides(prev => prev.map(slide => {
      if (slide.type === 'title' && !slide.title) return { ...slide, title: titleText };
      if (slide.type === 'divider' && !slide.dividerText) return { ...slide, dividerText: dividerText };
      return slide;
    }));
  }, [titleText, dividerText]);

  // Slide management functions
  const addSlide = (type: SlideType, afterIndex?: number) => {
    const newSlide: Slide = {
      id: `${type}-${Date.now()}`,
      type,
      ...(type === 'title' && { title: titleText }),
      ...(type === 'divider' && { dividerText: dividerText }),
      ...(type === 'team-dashboard' && { nextMoveText: nextMoveText }),
      ...(type === 'google-ads' && { spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1TJX3LrTiqhFTpK52UaV_G6Wr5b37mPkVZxB0ezAHNTQ/gviz/tq?tqx=out:csv&sheet=KeywordData' })
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

    // ---- Internal Dashboard Specific Analytics ----
    const internalStats = allInternal.map(t => {
      const taskLogs = filteredLogs.filter(log => log.work_context === WorkContext.INTERNAL && log.internal_design_id === t.id);
      const artworkCount = taskLogs.length;
      const dates = taskLogs.flatMap(log => [log.start_date, log.end_date].filter(Boolean) as string[]);
      let workDays = 0;
      if (dates.length >= 2) {
        const minDate = dates.reduce((a, b) => a < b ? a : b);
        const maxDate = dates.reduce((a, b) => a > b ? a : b);
        workDays = Math.max(0, Math.round((new Date(maxDate).getTime() - new Date(minDate).getTime()) / 86400000) + 1);
      } else if (dates.length === 1) {
        workDays = 1;
      }
      const totalRevisions = taskLogs.reduce((s, log) => s + (log.revision_count || 0), 0);
      return { task: t, artworkCount, workDays, totalRevisions };
    });

    const totalInternalArtworksFiltered = filteredLogs.filter(l => l.work_context === WorkContext.INTERNAL).length;
    const avgInternalWorkDays = allInternal.length > 0 
      ? (internalStats.reduce((s, is) => s + is.workDays, 0) / allInternal.length)
      : 0;
    const avgInternalRevisions = totalInternalArtworksFiltered > 0
      ? (internalStats.reduce((s, is) => s + is.totalRevisions, 0) / totalInternalArtworksFiltered)
      : 0;
    
    const internalDeptStats = departments.map(d => {
      const artworks = filteredLogs.filter(l => {
        if (l.work_context !== WorkContext.INTERNAL) return false;
        if (l.department_id === d.id) return true;
        const task = state.internalDesigns.find(t => t.id === l.internal_design_id);
        return task && task.department_id === d.id;
      }).length;
      return { label: d.department_name, count: artworks };
    }).filter(ds => ds.count > 0).sort((a,b) => b.count - a.count);

    // ---- Internal Team Type Breakdown (Stacked) ----
    const internalTeamTypeStats = designers.map(d => {
      const logs = filteredLogs.filter(l => l.work_context === WorkContext.INTERNAL && l.pic_designer_id === d.id);
      return {
        label: d.name,
        "2D Design": logs.filter(l => l.artwork_type === "2D Design").length,
        "3D Design": logs.filter(l => l.artwork_type === "3D Design").length,
        "Video": logs.filter(l => l.artwork_type === "Video").length,
        total: logs.length
      };
    }).filter(t => t.total > 0).sort((a,b) => b.total - a.total).slice(0, 10);

    // ---- Monthly Internal Data (Trend) ----
    const monthlyInternalData = (() => {
      const months: { label: string; count: number }[] = [];
      const endDate = new Date(filterEnd);
      for (let i = 11; i >= 0; i--) {
        const d = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${y}-${m}`;
        const label = d.toLocaleString('id-ID', { month: 'short' }).toUpperCase();
        const monthArtworks = artworkLogs.filter(
          l => l.work_context === WorkContext.INTERNAL && l.start_date.startsWith(key)
        );
        months.push({ label, count: monthArtworks.length });
      }
      return months;
    })();

    // ---- Team Project Charts Analytics ----
    const teamProjectStats = designers.map(d => {
      const picCount = allProjects.filter(p => p.pic_designer_id === d.id).length;
      const supportCount = allProjects.filter(p => (p.support_designer_ids || []).includes(d.id)).length;
      const artworkCount = filteredLogs.filter(l => l.work_context === WorkContext.PROJECT && l.pic_designer_id === d.id).length;
      return {
        label: d.name,
        picCount,
        supportCount,
        artworkCount,
        total: picCount + supportCount + artworkCount
      };
    }).filter(t => t.total > 0).sort((a,b) => b.artworkCount - a.artworkCount).slice(0, 8); // Top 8 for visibility

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
      leadDurationData,
      // Internal dashboard
      totalInternalArtworks: totalInternalArtworksFiltered,
      avgInternalWorkDays,
      avgInternalRevisions,
      internalDeptStats,
      // Internal chart
      internalTeamTypeStats,
      monthlyInternalData,
      // Team project chart
      teamProjectStats
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
      avgLeadRevisions: prevAvgLeadRevisions,
      // Internal previous analytics
      totalInternalArtworks: filteredLogs.filter(l => l.work_context === WorkContext.INTERNAL).length,
      avgInternalWorkDays: allInternal.length > 0 
        ? (allInternal.reduce((acc, t) => {
            const logs = filteredLogs.filter(log => log.work_context === WorkContext.INTERNAL && log.internal_design_id === t.id);
            const dates = logs.flatMap(log => [log.start_date, log.end_date].filter(Boolean) as string[]);
            if (dates.length >= 2) {
              const min = dates.reduce((a, b) => a < b ? a : b);
              const max = dates.reduce((a, b) => a > b ? a : b);
              return acc + (Math.max(0, Math.round((new Date(max).getTime() - new Date(min).getTime()) / 86400000) + 1));
            }
            return acc + (dates.length === 1 ? 1 : 0);
          }, 0) / allInternal.length)
        : 0,
      avgInternalRevisions: filteredLogs.filter(l => l.work_context === WorkContext.INTERNAL).length > 0
        ? filteredLogs.filter(l => l.work_context === WorkContext.INTERNAL).reduce((s, l) => s + (l.revision_count || 0), 0) / filteredLogs.filter(l => l.work_context === WorkContext.INTERNAL).length
        : 0
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


  const generateHTML = () => {
    setIsGenerating(true);
    try {
      const reportSlides = Array.from(document.querySelectorAll('.report-slide'));
      if (reportSlides.length === 0) {
        alert('Tidak ada slide untuk diekspor.');
        setIsGenerating(false);
        return;
      }
      
      let slidesHTML = '';
      reportSlides.forEach((slide) => {
        // Deep clone so we can modify inline styles for export
        const clone = slide.cloneNode(true) as HTMLElement;
        clone.style.transform = 'none';
        clone.style.position = 'absolute';
        clone.style.top = '0';
        clone.style.left = '0';
        clone.style.margin = '0';
        clone.style.boxShadow = 'none';
        
        slidesHTML += `
          <div class="slide-wrapper" style="width: 1280px; height: 720px; page-break-after: always; overflow: hidden; position: relative; background: white; margin-bottom: 40px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
            ${clone.outerHTML}
          </div>
        `;
      });
      
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Report - ${isFullYear ? targetYear : `${targetMonth}-${targetYear}`}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        body {
            background-color: #f1f5f9;
            font-family: 'Inter', sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 40px;
            margin: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .report-slide {
            transform: none !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
        }
        @media print {
            body { 
                background-color: white !important; 
                padding: 0 !important; 
                display: block;
            }
            .slide-wrapper {
                margin: 0 !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                page-break-after: always;
            }
            @page {
                size: 1280px 720px;
                margin: 0;
            }
        }
    </style>
</head>
<body>
    ${slidesHTML}
    <script>
      // Allow react components to render briefly, then trigger print
      setTimeout(() => {
         window.print();
      }, 1500);
    </script>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Report_${isFullYear ? targetYear : `${targetYear}-${targetMonth}`}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch(e) {
      console.error(e);
      alert('Gagal mengekspor HTML.');
    } finally {
      setIsGenerating(false);
    }
  };

  const SlideWrapper = ({ children, title, id }: { children: React.ReactNode, title?: string, id?: string }) => (
    <div className="slide-preview-container" style={{ width: '832px', height: '468px', marginBottom: '20px', position: 'relative' }}>
      <div id={id} className="report-slide bg-gradient-to-br from-slate-50 via-sky-50 to-white relative overflow-hidden flex flex-col items-center justify-center shrink-0 border border-zinc-200 shadow-xl" 
           style={{ width: '1280px', height: '720px', transformOrigin: 'top left', transform: 'scale(0.65)', position: 'absolute', top: 0, left: 0 }}>
        
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
        <div className="w-full h-full pt-20 pb-16 px-12 z-10 flex text-left text-zinc-900">
           {children}
        </div>
  
        {/* Footer */}
        <div className="absolute bottom-8 w-full px-12 z-20 flex justify-between items-end">
          <div className="text-[10px] font-bold tracking-widest text-zinc-800">
            CONFIDENTIAL DOCUMENT, FOR INTERNAL USE ONLY <span className="text-zinc-500 font-normal">| &copy; {new Date().getFullYear()} Werkudara Group. All rights reserved.</span>
          </div>
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
          <button onClick={generateHTML} disabled={isGenerating} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-2">
             <span className="text-lg">🌐</span> {isGenerating ? 'Wait..' : 'Export Report (HTML)'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* left sidebar settings */}
        <div className="md:col-span-1 space-y-6 sticky top-6 self-start">
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
                  { type: 'title' as SlideType, label: 'Title Slide', cls: 'bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                  { type: 'divider' as SlideType, label: 'Divider Slide', cls: 'bg-purple-50 hover:bg-purple-100 text-purple-700' },
                  { type: 'general-dashboard' as SlideType, label: 'General Dashboard', cls: 'bg-green-50 hover:bg-green-100 text-green-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                  { type: 'team-dashboard' as SlideType, label: 'Team Dashboard', cls: 'bg-orange-50 hover:bg-orange-100 text-orange-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                  { type: 'project-dashboard' as SlideType, label: 'Project Dashboard', cls: 'bg-teal-50 hover:bg-teal-100 text-teal-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                  { type: 'lead-dashboard' as SlideType, label: 'Lead Summary', cls: 'bg-amber-50 hover:bg-amber-100 text-amber-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                  { type: 'lead-team-dashboard' as SlideType, label: 'Lead Team', cls: 'bg-orange-50 hover:bg-orange-100 text-orange-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                  { type: 'internal-dashboard' as SlideType, label: 'Internal Dashboard', cls: 'bg-violet-50 hover:bg-violet-100 text-violet-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                  { type: 'internal-chart' as SlideType, label: 'Internal Trend', cls: 'bg-pink-50 hover:bg-pink-100 text-pink-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                  { type: 'team-project-chart' as SlideType, label: 'Team Project Engagement', cls: 'bg-sky-50 hover:bg-sky-100 text-sky-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                  { type: 'project-chart' as SlideType, label: 'Project Chart', cls: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed' },
                  { type: 'google-ads' as SlideType, label: 'Google Ads Summary', cls: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700' },
                ] as { type: SlideType; label: string; cls: string }[]
              ).map(({ type, label, cls }) => {
                const isOnce = type !== 'divider';
                const alreadyAdded = isOnce && slides.some(s => s.type === type);
                return (
                  <button
                    key={type}
                    onClick={() => !alreadyAdded && addSlide(type)}
                    disabled={alreadyAdded}
                    className={`w-full px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider text-left transition-colors ${cls} ${alreadyAdded ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {alreadyAdded ? `✓ ${label}` : `+ ${label}`}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-zinc-200 pt-4">
              <h4 className="font-bold text-xs tracking-tight uppercase text-zinc-700 mb-3">Current Slides ({slides.length})</h4>
              <div className="space-y-1 max-h-[800px] overflow-y-auto pr-1">
                {slides.map((slide, index) => (
                  <div key={slide.id} className="flex items-center justify-between p-1.5 bg-slate-50 rounded-lg border border-slate-200 group">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-black text-[11px] text-zinc-800 uppercase truncate">
                        {slide.type.replace(/-/g, ' ')}
                      </div>
                      {slide.type === 'title' && (
                        <input 
                          className="text-[10px] font-bold text-zinc-500 bg-transparent border-none focus:ring-0 focus:outline-none w-full p-0"
                          value={slide.title || ''}
                          onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
                          placeholder="Edit title..."
                        />
                      )}
                      {slide.type === 'divider' && (
                        <input 
                          className="text-[10px] font-bold text-zinc-500 bg-transparent border-none focus:ring-0 focus:outline-none w-full p-0"
                          value={slide.dividerText || ''}
                          onChange={(e) => updateSlide(slide.id, { dividerText: e.target.value })}
                          placeholder="Edit divider text..."
                        />
                      )}
                      {slide.type === 'google-ads' && (
                        <div className="mt-1 flex flex-col gap-1">
                           <label className="text-[8px] font-black uppercase text-zinc-400">Sheet Link (CSV)</label>
                           <input 
                             className="text-[9px] font-bold text-indigo-600 bg-indigo-50/50 rounded px-1.5 py-1 border border-indigo-100/50 focus:ring-1 focus:ring-indigo-300 focus:outline-none w-full truncate"
                             value={slide.spreadsheetUrl || ''}
                             onChange={(e) => updateSlide(slide.id, { spreadsheetUrl: e.target.value })}
                             placeholder="Paste CSV link here..."
                           />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => moveSlide(index, 'up')}
                        disabled={index === 0}
                        className="w-5 h-5 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 text-zinc-500 rounded text-[10px] disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move Up"
                      >
                        ↑
                      </button>
                      <button 
                        onClick={() => moveSlide(index, 'down')}
                        disabled={index === slides.length - 1}
                        className="w-5 h-5 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 text-zinc-500 rounded text-[10px] disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move Down"
                      >
                        ↓
                      </button>
                      <button 
                        onClick={() => addSlide(slide.type, index)}
                        className="w-5 h-5 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 text-zinc-500 rounded text-[10px] font-black"
                        title="Duplicate"
                      >
                        +
                      </button>
                      <button 
                        onClick={() => removeSlide(slide.id)}
                        disabled={slides.length <= 1}
                        className="w-5 h-5 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 rounded text-[10px] font-black disabled:opacity-50 disabled:cursor-not-allowed"
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
              const allTeamItems = analytics.teamStats.filter(t => t.totalArtworks > 0);
              // Mencari nilai tertinggi untuk penandaan
              const maxProj = Math.max(...allTeamItems.map(t => t.projInvCount), 1);
              const maxLeads = Math.max(...allTeamItems.map(t => t.uniqueLeads), 1);
              const maxArtworks = Math.max(...allTeamItems.map(t => t.totalArtworks), 1);
              const maxEval = Math.max(...allTeamItems.map(t => parseFloat(String(t.avgRating || 0))), 0.1);
              const durations = allTeamItems.map(t => parseFloat(t.avgLeadDur)).filter(v => v > 0);
              const bestDur = durations.length > 0 ? Math.min(...durations) : 999;

              return (
                <SlideWrapper key={slide.id} id={`slide-${index}`} title="TEAM PERFORMANCE DASHBOARD">
                  <div className="flex-1 mt-4 w-full h-[540px] overflow-hidden flex flex-col">
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex-1 flex flex-col overflow-hidden">
                      <div className="w-full h-full flex flex-col text-left">
                        {/* THE HEADER */}
                        <div className="flex bg-slate-50/50 border-b border-slate-100 px-4">
                           <div className="w-[180px] py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Team Member</div>
                           <div className="w-[80px] py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Projects</div>
                           <div className="w-[80px] py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Leads</div>
                           <div className="w-[100px] py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Delivery</div>
                           <div className="w-[120px] py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Total Artworks</div>
                           <div className="w-[180px] py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Breakdown (P|L|I)</div>
                           <div className="w-[120px] py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Avg Eval</div>
                        </div>
                        {/* THE BODY */}
                        <div className="flex-1 overflow-hidden flex flex-col divide-y divide-slate-50">
                          {allTeamItems.map((ds: any, idx: number) => {
                            const artworkShare = (ds.totalArtworks / maxArtworks) * 100;
                            const isTopProj = ds.projInvCount === maxProj && maxProj > 0;
                            const isTopLeads = ds.uniqueLeads === maxLeads && maxLeads > 0;
                            const isTopArtworks = ds.totalArtworks === maxArtworks && maxArtworks > 0;
                            const isTopEval = parseFloat(ds.avgRating || 0) === maxEval && maxEval > 0;
                            const isBestDur = parseFloat(ds.avgLeadDur) === bestDur && bestDur < 999;

                            return (
                              <div key={idx} className="flex px-4 items-center hover:bg-slate-50/30 transition-colors py-1">
                                <div className="w-[180px] px-2 flex items-center gap-2">
                                     <div className={`w-7 h-7 shrink-0 rounded-full ${isTopArtworks ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'} flex items-center justify-center font-black text-xs uppercase shadow-sm`}>
                                       {ds.name.charAt(0)}
                                     </div>
                                     <div className="flex flex-col min-w-0 pb-1">
                                        <div className="font-black text-slate-800 text-[11px] tracking-tight truncate uppercase leading-tight mt-1">{ds.name}</div>
                                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter truncate leading-tight">{ds.role || 'Personnel'}</div>
                                     </div>
                                </div>
                                <div className="w-[80px] px-2 flex justify-center">
                                  <span className={`font-black text-xs ${isTopProj ? 'text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded' : 'text-slate-600'}`}>{ds.projInvCount}</span>
                                </div>
                                <div className="w-[80px] px-2 flex justify-center">
                                  <span className={`font-black text-xs ${isTopLeads ? 'text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded' : 'text-slate-600'}`}>{ds.uniqueLeads}</span>
                                </div>
                                <div className="w-[100px] px-2 flex justify-center">
                                     <div className="flex items-center gap-1">
                                        <span className={`font-black text-[11px] ${isBestDur ? 'text-emerald-600 bg-emerald-50 px-1 rounded' : 'text-slate-600'}`}>{ds.avgLeadDur}</span>
                                        {parseFloat(ds.avgLeadDur) < 2.0 && parseFloat(ds.avgLeadDur) > 0 && 
                                          <span className="text-emerald-500 text-[10px]">★</span>
                                        }
                                     </div>
                                </div>
                                <div className="w-[120px] px-2 flex flex-col items-end justify-center">
                                    <span className={`font-black ${isTopArtworks ? 'text-indigo-600 text-sm' : 'text-slate-900 text-[11px]'} leading-none -mb-0.5`}>{ds.totalArtworks}</span>
                                    <div className="w-16 h-[3px] bg-slate-100 rounded mt-1.5 overflow-hidden flex justify-end">
                                       <div className={`h-full ${isTopArtworks ? 'bg-indigo-600' : 'bg-indigo-400'}`} style={{ width: `${artworkShare}%` }}></div>
                                    </div>
                                </div>
                                <div className="w-[180px] px-2 flex justify-center">
                                     <div className="flex gap-1 p-0.5 bg-slate-50 rounded border border-slate-100 items-center">
                                        <div className="text-[9px] font-black text-slate-500 px-1 border-r border-slate-200">P:{ds.pro}</div>
                                        <div className="text-[9px] font-black text-slate-500 px-1 border-r border-slate-200">L:{ds.lead}</div>
                                        <div className="text-[9px] font-black text-slate-500 px-1">I:{ds.int}</div>
                                     </div>
                                </div>
                                <div className="w-[120px] px-2 flex justify-end items-center gap-1">
                                     <span className={`font-black text-[11px] ${isTopEval ? 'text-fuchsia-600 bg-fuchsia-50 px-1 rounded' : 'text-slate-600'}`}>{ds.avgRating}</span>
                                     {parseFloat(ds.avgRating) >= 4.0 && 
                                       <span className="text-fuchsia-500 text-[10px]">★</span>
                                     }
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </SlideWrapper>
              );
            }

            if (slide.type === 'lead-team-dashboard') {
              const leadDesigners = analytics.teamStats.filter(t => t.uniqueLeads > 0 || t.lead > 0);
              
              // Find maximum values to highlight top performers
              const maxLeads = leadDesigners.length > 0 ? Math.max(...leadDesigners.map(d => d.uniqueLeads)) : 0;
              const maxArtworks = leadDesigners.length > 0 ? Math.max(...leadDesigners.map(d => d.lead)) : 0;
              const maxDuration = leadDesigners.length > 0 ? Math.max(...leadDesigners.map(d => parseFloat(d.avgLeadDur))) : 0;

              return (
                <SlideWrapper key={slide.id} id={`slide-${index}`} title="LEAD TEAM PERFORMANCE SUMMARY">
                  <div className="flex-1 flex flex-col gap-4 mt-6 w-full h-[540px]">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                      <div className="w-full text-left">
                        {/* THE HEADER */}
                        <div className="flex bg-slate-50 border-b border-slate-100">
                           <div className="flex-1 py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-400">Team Member</div>
                           <div className="w-[160px] py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-400 text-center">Leads Handled</div>
                           <div className="w-[160px] py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-400 text-center">Lead Artworks</div>
                           <div className="w-[160px] py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-400 text-center">Avg Duration</div>
                           <div className="w-[160px] py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-400 text-right">Efficiency</div>
                        </div>
                        {/* THE BODY */}
                        <div className="flex flex-col">
                          {leadDesigners.map((d, dIdx) => {
                            const isMaxLeads = d.uniqueLeads === maxLeads && maxLeads > 0;
                            const isMaxArtworks = d.lead === maxArtworks && maxArtworks > 0;
                            const isMaxDuration = parseFloat(d.avgLeadDur) === maxDuration && maxDuration > 0;
                            const hasAnyMax = isMaxLeads || isMaxArtworks || isMaxDuration;

                            return (
                              <div key={dIdx} className="flex border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                <div className="flex-1 py-3 px-6 flex items-center gap-3">
                                     <div className={`w-8 h-8 shrink-0 rounded-full ${hasAnyMax ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-orange-100 text-orange-600'} flex items-center justify-center font-black text-sm uppercase shadow-sm`}>
                                       {d.name.charAt(0)}
                                     </div>
                                     <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-black text-slate-800 text-sm tracking-tight leading-none uppercase">{d.name}</span>
                                          {hasAnyMax && <span className="text-amber-500 text-xs" title="Top Performer">👑</span>}
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider truncate">{d.role || 'Personnel'}</div>
                                     </div>
                                </div>
                                <div className="w-[160px] py-3 px-6 flex flex-col items-center justify-center">
                                     <span className={`font-black ${isMaxLeads ? 'text-orange-600 scale-110' : 'text-orange-500'} text-lg transition-transform`}>{d.uniqueLeads}</span>
                                     {isMaxLeads && <span className="text-[7px] font-black uppercase tracking-tighter bg-orange-100 text-orange-700 px-1 rounded mt-0.5">Most Leads</span>}
                                </div>
                                <div className="w-[160px] py-3 px-6 flex flex-col items-center justify-center">
                                     <span className={`font-black ${isMaxArtworks ? 'text-amber-600 scale-110' : 'text-amber-500'} text-lg transition-transform`}>{d.lead}</span>
                                     {isMaxArtworks && <span className="text-[7px] font-black uppercase tracking-tighter bg-amber-100 text-amber-700 px-1 rounded mt-0.5">Most Artworks</span>}
                                </div>
                                <div className="w-[160px] py-3 px-6 flex flex-col items-center justify-center">
                                     <span className={`font-black ${isMaxDuration ? 'text-rose-600' : 'text-yellow-600'} text-lg leading-none`}>
                                       {d.avgLeadDur}<span className="text-[10px] text-slate-400 ml-0.5">d</span>
                                     </span>
                                     <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter mt-1">delivery avg</span>
                                     {isMaxDuration && <span className="text-[7px] font-black uppercase tracking-tighter bg-rose-50 text-rose-600 px-1 rounded mt-0.5 border border-rose-100">Longest</span>}
                                </div>
                                <div className="w-[160px] py-3 px-6 flex items-center justify-end">
                                  {parseFloat(d.avgLeadDur) > 0 && parseFloat(d.avgLeadDur) <= 1.5 ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                       <span className="text-xs">⚡</span> OPTIMIZED
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                       STANDARD
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
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
                            <div className="flex flex-col gap-2">
                               <div className="text-8xl font-semibold tracking-tight leading-none text-indigo-600">{analytics.allProjectsCount}</div>
                               <div className="flex items-center gap-2">
                                  {(() => {
                                    const diff = analytics.allProjectsCount - prevAnalytics.allProjectsCount;
                                    const color = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-slate-400';
                                    const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '●';
                                    return <span className={`text-base font-black ${color}`}>{arrow} {Math.abs(diff)}</span>;
                                  })()}
                                  <div className="text-[11px] font-bold uppercase text-slate-400">registered projects</div>
                               </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 2. Project Artworks */}
                      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100">
                        <div className="flex flex-col justify-between flex-1 p-5">
                          <div className="text-xs font-black uppercase tracking-widest text-slate-400">Project Artworks</div>
                          <div>
                            <div className="flex flex-col gap-2">
                               <div className="text-8xl font-semibold tracking-tight leading-none text-sky-500">{analytics.totalProjectArtworks}</div>
                               <div className="flex items-center gap-2">
                                  {(() => {
                                    const diff = analytics.totalProjectArtworks - prevAnalytics.totalProjectArtworks;
                                    const color = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-slate-400';
                                    const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '●';
                                    return <span className={`text-base font-black ${color}`}>{arrow} {Math.abs(diff)}</span>;
                                  })()}
                                  <div className="text-[11px] font-bold uppercase text-slate-400">project artworks</div>
                               </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 3. Avg Team Size */}
                      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100">
                        <div className="flex flex-col justify-between flex-1 p-5">
                          <div className="text-xs font-black uppercase tracking-widest text-slate-400">Avg Team Size</div>
                          <div>
                            <div className="flex flex-col gap-2">
                               <div className="text-8xl font-semibold tracking-tight leading-none text-violet-600">{parseFloat(analytics.avgTeamSize.toFixed(2)).toString()}</div>
                               <div className="flex items-center gap-2">
                                  {(() => {
                                    const diff = analytics.avgTeamSize - prevAnalytics.avgTeamSize;
                                    const color = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-slate-400';
                                    const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '●';
                                    return <span className={`text-base font-black ${color}`}>{arrow} {parseFloat(Math.abs(diff).toFixed(2))}</span>;
                                  })()}
                                  <div className="text-[11px] font-bold uppercase text-slate-400">members / project</div>
                               </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 4. Avg Workdays */}
                      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100">
                        <div className="flex flex-col justify-between flex-1 p-5">
                          <div className="text-xs font-black uppercase tracking-widest text-slate-400">Avg Workdays</div>
                          <div>
                            <div className="flex flex-col gap-2">
                               <div className="text-8xl font-semibold tracking-tight leading-none text-rose-500">{parseFloat(analytics.avgWorkDays.toFixed(2)).toString()}</div>
                               <div className="flex items-center gap-2">
                                  {(() => {
                                    const diff = analytics.avgWorkDays - prevAnalytics.avgWorkDays;
                                    const color = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-slate-400';
                                    const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '●';
                                    return <span className={`text-base font-black ${color}`}>{arrow} {parseFloat(Math.abs(diff).toFixed(2))}</span>;
                                  })()}
                                  <div className="text-[11px] font-bold uppercase text-slate-400">days / project</div>
                               </div>
                            </div>
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
                          <div className="flex flex-col mt-4 gap-2">
                             <div className="flex items-baseline justify-between">
                                <div className="text-4xl font-black leading-none text-amber-500">{analytics.mostArtworkProj ? analytics.mostArtworkProj.artworkCount : 0}</div>
                                <div className="text-right">
                                   <div className="text-[11px] font-bold text-slate-500">{analytics.mostArtworkProj ? analytics.mostArtworkProj.proj.start_date : '-'}</div>
                                </div>
                             </div>
                             <div className="flex justify-between items-end border-t border-slate-50 pt-2">
                                <div className="text-[11px] font-bold uppercase text-slate-400">artworks</div>
                                <div className="text-[11px] font-bold text-slate-500 max-w-[140px] truncate text-right" title={analytics.mostArtworkProj ? (analytics.mostArtworkProj.proj.locations || []).join(', ') : ''}>
                                   {analytics.mostArtworkProj ? (analytics.mostArtworkProj.proj.locations || []).join(', ') || '-' : '-'}
                                </div>
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
                          <div className="flex flex-col mt-4 gap-2">
                             <div className="flex items-baseline justify-between">
                                <div className="text-4xl font-black leading-none text-teal-500">{analytics.longestDurProj ? analytics.longestDurProj.workDays : 0}</div>
                                <div className="text-right">
                                   <div className="text-[11px] font-bold text-slate-500">{analytics.longestDurProj ? analytics.longestDurProj.proj.start_date : '-'}</div>
                                </div>
                             </div>
                             <div className="flex justify-between items-end border-t border-slate-50 pt-2">
                                <div className="text-[11px] font-bold uppercase text-slate-400">workdays</div>
                                <div className="text-[11px] font-bold text-slate-500 max-w-[140px] truncate text-right" title={analytics.longestDurProj ? (analytics.longestDurProj.proj.locations || []).join(', ') : ''}>
                                   {analytics.longestDurProj ? (analytics.longestDurProj.proj.locations || []).join(', ') || '-' : '-'}
                                </div>
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
                          <div className="flex flex-col mt-4 gap-2">
                             <div className="flex items-baseline justify-between">
                                <div className="text-4xl font-black leading-none text-slate-600">{analytics.mostTeamProj ? analytics.mostTeamProj.teamSize : 0}</div>
                                <div className="text-right">
                                   <div className="text-[11px] font-bold text-slate-500">{analytics.mostTeamProj ? analytics.mostTeamProj.proj.start_date : '-'}</div>
                                </div>
                             </div>
                             <div className="flex justify-between items-end border-t border-slate-50 pt-2">
                                <div className="text-[11px] font-bold uppercase text-slate-400">team members</div>
                                <div className="text-[11px] font-bold text-slate-500 max-w-[140px] truncate text-right" title={analytics.mostTeamProj ? (analytics.mostTeamProj.proj.locations || []).join(', ') : ''}>
                                   {analytics.mostTeamProj ? (analytics.mostTeamProj.proj.locations || []).join(', ') || '-' : '-'}
                                </div>
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
                const len = Math.max(data.length, 1);
                const barWidth = (chartW / len) * 0.6;
                const gap = chartW / len;

                return (
                  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
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
                          {d.duration > 0 && <rect x={bx} y={by} width={barWidth} height={bh} rx="6" fill="#f59e0b" />}
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

            if (slide.type === 'internal-dashboard') {
              const DepartmentBarChart = ({ data }: { data: { label: string; count: number }[] }) => {
                const max = Math.max(...data.map(d => d.count), 1);
                return (
                  <div className="w-full h-full flex items-end justify-between px-1 gap-2 pt-12 pb-2">
                    {data.map((d, i) => (
                      <div key={i} className="flex flex-col items-center gap-3 h-full flex-1 min-w-0">
                        <div className="flex-1 w-full bg-slate-50/50 rounded-lg relative flex flex-col justify-end overflow-visible border border-slate-100/30">
                           <div className="bg-gradient-to-t from-indigo-500 via-indigo-600 to-violet-600 rounded-lg transition-all duration-1000 origin-bottom shadow-lg flex items-start justify-center" 
                                style={{ height: `${(d.count / max) * 100}%` }}>
                              <div className="absolute -top-9 px-2.5 py-1 bg-slate-900 text-white text-[12px] font-black rounded-lg shadow-xl flex items-center justify-center whitespace-nowrap border border-slate-700/50">
                                {d.count}
                                <div className="absolute top-[85%] left-1/2 -mb-2 border-[6px] border-transparent border-t-slate-900 -translate-x-1/2"></div>
                              </div>
                           </div>
                        </div>
                        <div className="h-12 w-full flex items-start justify-center pt-2 overflow-hidden">
                          <span className="text-[11px] font-black uppercase text-slate-800 tracking-tighter text-center leading-[1.1] break-words px-0.5" style={{ wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {d.label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              };

              return (
                <SlideWrapper key={slide.id} id={`slide-${index}`} title="INTERNAL ARTWORKS SUMMARY">
                  <div className="flex-1 flex flex-col gap-6 mt-6 w-full h-[540px]">
                    
                    {/* Top Row: 3 KPI Cards */}
                    <div className="flex gap-6 h-[220px]">
                      
                      <div className="bg-white rounded-2xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100 p-6 justify-between">
                         <div className="text-xs font-black uppercase tracking-widest text-slate-400">Total Internal Artworks</div>
                         <div>
                            <div className="flex items-baseline gap-3">
                               <div className="text-8xl font-semibold tracking-tight text-indigo-600">{analytics.totalInternalArtworks}</div>
                               {(() => {
                                 const diff = analytics.totalInternalArtworks - prevAnalytics.totalInternalArtworks;
                                 const color = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-rose-500' : 'text-slate-400';
                                 return <span className={`text-lg font-black ${color}`}>{diff > 0 ? '▲' : diff < 0 ? '▼' : '●'} {Math.abs(diff)}</span>;
                               })()}
                            </div>
                            <div className="text-[11px] font-bold uppercase text-slate-400 mt-1">artworks in period</div>
                         </div>
                      </div>

                      <div className="bg-white rounded-2xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100 p-6 justify-between">
                         <div className="text-xs font-black uppercase tracking-widest text-slate-400">Avg Internal Workdays</div>
                         <div>
                            <div className="flex items-baseline gap-3">
                               <div className="text-8xl font-semibold tracking-tight text-sky-500">{parseFloat(analytics.avgInternalWorkDays.toFixed(1)).toString()}</div>
                               {(() => {
                                 const diff = analytics.avgInternalWorkDays - prevAnalytics.avgInternalWorkDays;
                                 const color = diff > 0 ? 'text-rose-500' : diff < 0 ? 'text-emerald-500' : 'text-slate-400';
                                 return <span className={`text-lg font-black ${color}`}>{diff > 0 ? '▲' : diff < 0 ? '▼' : '●'} {parseFloat(Math.abs(diff).toFixed(1))}</span>;
                               })()}
                            </div>
                            <div className="text-[11px] font-bold uppercase text-slate-400 mt-1">days / internal task</div>
                         </div>
                      </div>

                      <div className="bg-white rounded-2xl flex-1 flex flex-col overflow-hidden shadow-sm border border-slate-100 p-6 justify-between">
                         <div className="text-xs font-black uppercase tracking-widest text-slate-400">Avg Internal Revisions</div>
                         <div>
                            <div className="flex items-baseline gap-3">
                               <div className="text-8xl font-semibold tracking-tight text-violet-500">{parseFloat(analytics.avgInternalRevisions.toFixed(2)).toString()}</div>
                               {(() => {
                                 const diff = analytics.avgInternalRevisions - prevAnalytics.avgInternalRevisions;
                                 const color = diff > 0 ? 'text-rose-500' : diff < 0 ? 'text-emerald-500' : 'text-slate-400';
                                 return <span className={`text-lg font-black ${color}`}>{diff > 0 ? '▲' : diff < 0 ? '▼' : '●'} {parseFloat(Math.abs(diff).toFixed(2))}</span>;
                               })()}
                            </div>
                            <div className="text-[11px] font-bold uppercase text-slate-400 mt-1">revisions / internal artwork</div>
                         </div>
                      </div>

                    </div>

                    {/* Bottom Row: Dept Bar Chart */}
                    <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col p-8 overflow-hidden">
                       <div className="mb-6 flex justify-between items-end">
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Artworks Distribution</div>
                            <div className="text-2xl font-black text-slate-800 leading-tight">By Department</div>
                          </div>
                          <div className="text-[11px] font-black uppercase text-slate-300">Internal work context only</div>
                       </div>
                       <div className="flex-1 flex items-end">
                          <DepartmentBarChart data={analytics.internalDeptStats} />
                       </div>
                    </div>

                  </div>
                </SlideWrapper>
              );
            }

            if (slide.type === 'internal-chart') {
              const StackedInternalBarChart = ({ data }: { data: any[] }) => {
                const values = data.map(d => d.total);
                const maxVal = Math.max(...values, 1);
                const W = 1100, H = 190;
                const padL = 60, padR = 20, padTop = 20, padBot = 30;
                const chartW = W - padL - padR;
                const chartH = H - padTop - padBot;
                const len = Math.max(data.length, 1);
                const barWidth = (chartW / len) * 0.5;
                const gap = chartW / len;

                return (
                  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
                    {[0, 1, 2, 3].map(i => {
                      const gv = (maxVal * i) / 3;
                      const y = padTop + chartH - (gv / maxVal) * chartH;
                      return (
                        <g key={i}>
                          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 2" />
                          <text x={padL - 10} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontWeight="600">{Math.round(gv)}</text>
                        </g>
                      );
                    })}
                    {data.map((d, i) => {
                      const bx = padL + i * gap + (gap - barWidth) / 2;
                      let currentY = padTop + chartH;
                      const types = [
                        { key: '2D Design', color: '#6366f1' }, // Indigo
                        { key: '3D Design', color: '#ec4899' }, // Pink
                        { key: 'Video', color: '#f59e0b' }      // Amber
                      ];

                      return (
                        <g key={i}>
                          {types.map((type, tIdx) => {
                            const val = d[type.key];
                            if (val === 0) return null;
                            const bh = (val / maxVal) * chartH;
                            currentY -= bh;
                            return <rect key={tIdx} x={bx} y={currentY} width={barWidth} height={bh} fill={type.color} />;
                          })}
                          <text x={bx + barWidth/2} y={padTop + chartH + 18} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="800">{d.label.split(' ')[0]}</text>
                          {d.total > 0 && <text x={bx + barWidth/2} y={currentY - 5} textAnchor="middle" fontSize="11" fill="#1e293b" fontWeight="900">{d.total}</text>}
                        </g>
                      );
                    })}
                  </svg>
                );
              };

              const InternalTrendLine = ({ data }: { data: any[] }) => {
                const values = data.map(d => d.count);
                const maxVal = Math.max(...values, 5);
                const W = 1100, H = 140;
                const padL = 60, padR = 40, padTop = 20, padBot = 30;
                const chartW = W - padL - padR;
                const chartH = H - padTop - padBot;
                const gap = chartW / Math.max(data.length - 1, 1);
                const points = data.map((d, i) => `${padL + i * gap},${padTop + chartH - (d.count / maxVal) * chartH}`).join(' ');

                return (
                  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
                    {[0, 1, 2, 3].map(i => {
                      const gv = (maxVal * i) / 3;
                      const y = padTop + chartH - (gv / maxVal) * chartH;
                      return <line key={i} x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeWidth="1" />;
                    })}
                    <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {data.map((d, i) => (
                      <g key={i}>
                        <circle cx={padL + i * gap} cy={padTop + chartH - (d.count/maxVal)*chartH} r="4" fill="#6366f1" stroke="white" strokeWidth="2" />
                        <text x={padL + i * gap} y={padTop + chartH + 20} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="700">{d.label}</text>
                        {d.count > 0 && <text x={padL + i * gap} y={padTop + chartH - (d.count/maxVal)*chartH - 8} textAnchor="middle" fontSize="10" fill="#4f46e5" fontWeight="900">{d.count}</text>}
                      </g>
                    ))}
                  </svg>
                );
              };

              return (
                <SlideWrapper key={slide.id} id={`slide-${index}`} title="INTERNAL ARTWORK ANALYTICS">
                  <div className="flex-1 flex flex-col gap-4 mt-2">
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Internal per Team Member</h3>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-[#6366f1]"></div><span className="text-[8px] font-black text-slate-500 uppercase">2D</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-[#ec4899]"></div><span className="text-[8px] font-black text-slate-500 uppercase">3D</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-[#f59e0b]"></div><span className="text-[8px] font-black text-slate-500 uppercase">Video</span></div>
                        </div>
                      </div>
                      <div className="flex justify-center"><StackedInternalBarChart data={analytics.internalTeamTypeStats} /></div>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex-1">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Monthly Trend Summary</h3>
                      <div className="flex justify-center"><InternalTrendLine data={analytics.monthlyInternalData} /></div>
                    </div>
                  </div>
                </SlideWrapper>
              );
            }

            if (slide.type === 'team-project-chart') {
              const TeamProjectBarChart = ({ data, valKey, color, label }: { data: any[], valKey: string, color: string, label: string }) => {
                const maxVal = Math.max(...data.map(d => d[valKey]), 1);
                const W = 1100, H = 125;
                const padL = 40, padR = 20, padTop = 25, padBot = 30;
                const chartW = W - padL - padR;
                const chartH = H - padTop - padBot;
                const len = Math.max(data.length, 1);
                const barW = (chartW / len) * 0.4;
                const gap = chartW / len;

                return (
                  <div className="flex flex-col items-center w-full">
                    <div className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-[0.2em]">{label}</div>
                    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
                      {[0, 1, 2, 3].map(i => {
                        const gv = (maxVal * i) / 3;
                        const y = padTop + chartH - (gv / maxVal) * chartH;
                        return <line key={i} x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 2" />;
                      })}
                      {data.map((d, i) => {
                        const val = d[valKey];
                        const bx = padL + i * gap + (gap - barW) / 2;
                        const bh = (val / maxVal) * chartH;
                        const by = padTop + chartH - bh;
                        return (
                          <g key={i}>
                            <rect x={bx} y={by} width={barW} height={bh} fill={color} rx="4" />
                            {val > 0 && <text x={bx + barW/2} y={by - 5} textAnchor="middle" fontSize="10" fill={color} fontWeight="900">{val}</text>}
                            <text x={bx + barW/2} y={padTop + chartH + 18} textAnchor="middle" fontSize="10" fill="#94a3b8" fontWeight="800">
                              {d.label.split(' ')[0]}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                );
              };

              return (
                <SlideWrapper key={slide.id} id={`slide-${index}`} title="TEAM PROJECT ENGAGEMENT">
                   <div className="flex-1 flex flex-col justify-center gap-4 mt-2">
                      <div className="bg-white rounded-xl p-3 px-6 shadow-sm border border-slate-100 flex-1 flex flex-col items-center justify-center">
                         <TeamProjectBarChart data={analytics.teamProjectStats} valKey="picCount" color="#6366f1" label="PIC Involvement Count" />
                      </div>
                      <div className="bg-white rounded-xl p-3 px-6 shadow-sm border border-slate-100 flex-1 flex flex-col items-center justify-center">
                         <TeamProjectBarChart data={analytics.teamProjectStats} valKey="supportCount" color="#ec4899" label="Support Presence Count" />
                      </div>
                      <div className="bg-white rounded-xl p-3 px-6 shadow-sm border border-slate-100 flex-1 flex flex-col items-center justify-center">
                         <TeamProjectBarChart data={analytics.teamProjectStats} valKey="artworkCount" color="#f59e0b" label="Project Artwork Output" />
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
                const len = Math.max(data.length, 1);
                const barW = (chartW / len) * 0.55;
                const gap = chartW / len;

                // Y gridlines (0, 1/3, 2/3, max)
                const gridLines = [0, 1, 2, 3].map(i => maxVal * i / 3);

                return (
                  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>

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
                              rx="6" ry="6" fill={colorFrom} />
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

            if (slide.type === 'google-ads') {
              return (
                <SlideWrapper key={slide.id} id={`slide-${index}`} title="SEARCH TERM PERFORMANCE">
                  <GoogleAdsSummaryContent url={slide.spreadsheetUrl} />
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
