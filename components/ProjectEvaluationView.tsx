import React, { useState, useMemo } from 'react';
import { Project, Designer, DesignerEvaluation } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar } from 'recharts';
import ReactMarkdown from 'react-markdown';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

const EVAL_CRITERIA = [
    { key: 'inisiatif', label: 'Inisiatif' },
    { key: 'disiplin', label: 'Disiplin' },
    { key: 'penyelesaian_tugas', label: 'Penyelesaian Tugas' },
    { key: 'attitude', label: 'Attitude' },
    { key: 'komunikasi', label: 'Komunikasi' },
    { key: 'respon_masukan', label: 'Respon Terhadap Masukan' },
];

interface ProjectEvaluationViewProps {
    projects: Project[];
    designers: Designer[];
    designerEvaluations: DesignerEvaluation[];
    getDesignerName: (id: string) => string;
}

export const ProjectEvaluationView: React.FC<ProjectEvaluationViewProps> = ({ projects, designers, designerEvaluations, getDesignerName }) => {
    const [activeTab, setActiveTab] = useState<'project' | 'team'>('project');
    const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
    const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
    const [aiSummaries, setAiSummaries] = useState<Record<string, string>>({});
    const [isGeneratingAi, setIsGeneratingAi] = useState<Record<string, boolean>>({});

    const toggleProject = (id: string) => setExpandedProjects(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleTeam = (id: string) => setExpandedTeams(prev => ({ ...prev, [id]: !prev[id] }));

    // --- Data Filtering ---
    const validEvaluations = useMemo(() => {
        return designerEvaluations.filter(ev => {
            const proj = projects.find(p => p.id === ev.project_id);
            if (!proj) return false;
            const validIds = new Set(
                [proj.pic_designer_id, ...(proj.support_designer_ids || [])].filter(Boolean)
            );
            return validIds.has(ev.designer_id);
        });
    }, [designerEvaluations, projects]);

    // --- Aggregate Stats ---
    const evaluatedProjectIds = Array.from(new Set(validEvaluations.map(e => e.project_id)));
    const evaluatedDesignerIds = Array.from(new Set(validEvaluations.map(e => e.designer_id)));

    let overallScoreSum = 0;
    let overallScoreCount = 0;
    const overallCatAvgs: Record<string, { sum: number, count: number }> = {};
    EVAL_CRITERIA.forEach(c => { overallCatAvgs[c.key] = { sum: 0, count: 0 }; });

    validEvaluations.forEach(ev => {
        const scores = EVAL_CRITERIA.map(c => (ev as any)[c.key] || 0).filter((v: number) => v > 0);
        if (scores.length > 0) {
            overallScoreSum += scores.reduce((a, b) => a + b, 0) / scores.length;
            overallScoreCount++;
        }
        EVAL_CRITERIA.forEach(c => {
            const score = (ev as any)[c.key] || 0;
            if (score > 0) {
                overallCatAvgs[c.key].sum += score;
                overallCatAvgs[c.key].count++;
            }
        });
    });
    const avgOverallScore = overallScoreCount > 0 ? (overallScoreSum / overallScoreCount).toFixed(2) : '0.00';

    // --- View By Project Data ---
    const projectStats = useMemo(() => {
        return evaluatedProjectIds.map(pid => {
            const projEvals = validEvaluations.filter(e => e.project_id === pid);
            const proj = projects.find(p => p.id === pid);
            let pSum = 0;
            let pCount = 0;
            projEvals.forEach(ev => {
                const evScores = EVAL_CRITERIA.map(c => (ev as any)[c.key] || 0).filter((v: number) => v > 0);
                if (evScores.length > 0) {
                    pSum += evScores.reduce((a, b) => a + b, 0) / evScores.length;
                    pCount++;
                }
            });
            const EvaluatorName = projEvals[0]?.evaluator_name || '-';
            return {
                id: pid,
                name: proj?.project_name || 'Unknown Project',
                date: proj?.start_date || '',
                lead: proj ? getDesignerName(proj.pic_designer_id) : '-',
                support: proj?.support_designer_ids?.map(sid => getDesignerName(sid)).join(', ') || '-',
                avgScore: pCount > 0 ? (pSum / pCount) : 0,
                evaluator: EvaluatorName,
                evals: projEvals
            };
        }).sort((a, b) => a.date.localeCompare(b.date));
    }, [evaluatedProjectIds, validEvaluations, projects, getDesignerName]);

    const pChartData = projectStats.map(p => ({
        name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
        score: parseFloat(p.avgScore.toFixed(2))
    }));

    // --- View By Team Data ---
    const teamStats = useMemo(() => {
        return designers.map(designer => {
            const did = designer.id;
            const dEvals = validEvaluations.filter(e => e.designer_id === did);
            let tSum = 0;
            let tCount = 0;
            const catSums: Record<string, number> = {};
            const catCounts: Record<string, number> = {};
            EVAL_CRITERIA.forEach(c => { catSums[c.key] = 0; catCounts[c.key] = 0; });

            dEvals.forEach(ev => {
                const evScores = EVAL_CRITERIA.map(c => (ev as any)[c.key] || 0).filter((v: number) => v > 0);
                if (evScores.length > 0) {
                    tSum += evScores.reduce((a, b) => a + b, 0) / evScores.length;
                    tCount++;
                }
                EVAL_CRITERIA.forEach(c => {
                    const score = (ev as any)[c.key] || 0;
                    if (score > 0) {
                        catSums[c.key] += score;
                        catCounts[c.key]++;
                    }
                });
            });

            const catAvgs: Record<string, number> = {};
            EVAL_CRITERIA.forEach(c => {
                catAvgs[c.key] = catCounts[c.key] > 0 ? (catSums[c.key] / catCounts[c.key]) : 0;
            });

            return {
                id: did,
                name: designer?.name || 'Unknown Designer',
                role: designer?.role || 'Designer',
                projectsCount: dEvals.length,
                avgScore: tCount > 0 ? (tSum / tCount) : 0,
                evals: dEvals,
                catAvgs
            };
        }).sort((a, b) => b.projectsCount - a.projectsCount || b.avgScore - a.avgScore);
    }, [evaluatedDesignerIds, validEvaluations, designers]);

    const tChartData = teamStats.map(t => ({
        name: t.name,
        score: parseFloat(t.avgScore.toFixed(2))
    }));

    const handleGenerateSummary = async (teamId: string, evals: DesignerEvaluation[]) => {
        if (!GEMINI_API_KEY) {
            alert("Gemini API Key is not set.");
            return;
        }
        const feedbacks = evals
            .filter(e => e.masukan_pengembangan && e.masukan_pengembangan.trim().length > 0)
            .map(e => e.masukan_pengembangan);

        if (feedbacks.length === 0) {
            setAiSummaries(prev => ({ ...prev, [teamId]: "Tidak ada masukan pengembangan yang perlu di-summary." }));
            return;
        }

        setIsGeneratingAi(prev => ({ ...prev, [teamId]: true }));
        try {
            const prompt = `Berikut adalah daftar masukan evaluasi pengembangan diri untuk seorang designer:\n${feedbacks.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nBuatkan rangkuman komprehensif tentang apa saja perbaikan atau pengembangan utama yang harus dilakukan oleh desainer ini. Format dalam bentuk bullet points maksimal 7 poin. Gunakan bahasa Indonesia profesional dan konstruktif.`;

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3 } })
                }
            );
            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
                setAiSummaries(prev => ({ ...prev, [teamId]: text.trim() }));
            }
        } catch (err: any) {
            alert("Gagal membuat AI summary: " + err.message);
        } finally {
            setIsGeneratingAi(prev => ({ ...prev, [teamId]: false }));
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 4) return 'text-emerald-600 bg-emerald-50';
        if (score >= 3) return 'text-indigo-600 bg-indigo-50';
        if (score >= 2) return 'text-amber-600 bg-amber-50';
        return 'text-rose-600 bg-rose-50';
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Top Banner Stats */}
            <div className="bg-gradient-to-br from-zinc-900 to-[#1A1C20] rounded-[24px] p-8 text-white mb-6 shadow-xl relative overflow-hidden flex-shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 w-full">
                    <div className="flex-shrink-0">
                        <h2 className="text-sm font-bold tracking-widest uppercase text-white/60 mb-1">Project Evaluation Dashboard</h2>
                        <div className="text-4xl font-black tracking-tight">{avgOverallScore} <span className="text-lg text-white/50 font-bold">/5</span></div>
                        <p className="text-xs font-medium text-white/70 mt-2">Nilai rata-rata seluruh evaluasi</p>
                    </div>

                    <div className="flex-1 flex justify-center w-full px-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <div className="flex gap-4 md:gap-6 lg:gap-8 min-w-max">
                            {EVAL_CRITERIA.map(c => {
                                const avg = overallCatAvgs[c.key].count > 0 ? (overallCatAvgs[c.key].sum / overallCatAvgs[c.key].count).toFixed(2) : '0.00';
                                return (
                                    <div key={c.key} className="flex flex-col items-center justify-center gap-1.5">
                                        <div className="text-[9px] md:text-[10px] font-medium text-white/40 uppercase tracking-widest text-center max-w-[120px] leading-tight">
                                            {c.label}
                                        </div>
                                        <div className="text-lg md:text-xl font-bold text-emerald-400/90">{avg}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="flex gap-4 flex-shrink-0 w-full md:w-auto overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <div className="bg-white/10 backdrop-blur-sm border border-white/10 px-6 py-4 rounded-2xl text-center flex-1 md:flex-none min-w-[130px]">
                            <div className="text-3xl font-black mb-1">{evaluatedProjectIds.length}<span className="text-xl text-white/50 font-bold">/{projects.length}</span></div>
                            <div className="text-[10px] font-bold tracking-widest uppercase text-white/60">Total Project</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm border border-white/10 px-6 py-4 rounded-2xl text-center flex-1 md:flex-none min-w-[130px]">
                            <div className="text-3xl font-black mb-1">{evaluatedDesignerIds.length}<span className="text-xl text-white/50 font-bold">/{designers.length}</span></div>
                            <div className="text-[10px] font-bold tracking-widest uppercase text-white/60">Total Tim</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toggles */}
            <div className="flex gap-2 bg-[#F8F9FA] p-1.5 rounded-xl w-full sm:w-fit mb-6 border border-[#EAEAEA]">
                <button onClick={() => setActiveTab('project')} className={`flex-1 sm:flex-none px-4 sm:px-8 py-2.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'project' ? 'bg-white text-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)]' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100/50'}`}>View By Project</button>
                <button onClick={() => setActiveTab('team')} className={`flex-1 sm:flex-none px-4 sm:px-8 py-2.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'team' ? 'bg-white text-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)]' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100/50'}`}>View By Team</button>
            </div>

            <div className="flex-1 overflow-y-auto pb-8 custom-scrollbar">
                {activeTab === 'project' && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                        {/* Project Line Chart */}
                        <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm">
                            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-6 border-b border-zinc-100 pb-3">Trend Evaluasi Berdasarkan Project</h3>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={pChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#A1A1AA', fontWeight: 600 }} dy={10} />
                                        <YAxis domain={[1, 5]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#A1A1AA', fontWeight: 600 }} dx={-10} />
                                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontWeight: 700, fontSize: '11px' }} />
                                        <Line type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, fill: '#4F46E5', strokeWidth: 0 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Project List */}
                        <div className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm overflow-hidden animate-in fade-in duration-300">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs md:text-sm border-collapse min-w-[600px] md:min-w-full">
                                    <thead className="bg-[#F8F9FA] border-b border-[#EAEAEA] font-bold text-[10px] uppercase text-zinc-500 tracking-wider">
                                        <tr>
                                            <th className="px-5 py-4">Timeline & Project Name</th>
                                            <th className="px-5 py-4">PIC & Support</th>
                                            <th className="px-5 py-4">Evaluator</th>
                                            <th className="px-5 py-4 text-center">Avg Score</th>
                                            <th className="px-5 py-4 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {projectStats.map(p => (
                                            <React.Fragment key={p.id}>
                                                <tr className="hover:bg-[#FCFCFC] transition-colors cursor-pointer group font-bold text-zinc-800 uppercase" onClick={() => toggleProject(p.id)}>
                                                    <td className="px-5 py-4">
                                                        <div className="font-bold text-zinc-900 mb-1 leading-tight">{p.name}</div>
                                                        <div className="text-[10px] font-bold text-zinc-500">{p.date}</div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="text-[11px] font-bold text-zinc-800 line-clamp-1"><span className="text-zinc-400">L:</span> {p.lead}</div>
                                                        <div className="text-[10px] font-bold text-zinc-500 mt-1 line-clamp-1"><span className="text-zinc-400">S:</span> {p.support}</div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="text-[11px] font-bold text-zinc-800">{p.evaluator}</div>
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <span className={`inline-block px-3 py-1 rounded-xl text-sm font-black ${getScoreColor(p.avgScore)}`}>{p.avgScore.toFixed(2)}</span>
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        <div className={`p-2 rounded-full inline-block transition-transform ${expandedProjects[p.id] ? 'rotate-180 bg-zinc-100' : 'bg-[#F8F9FA]'}`}>
                                                            <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedProjects[p.id] && (
                                                    <tr className="bg-[#FCFCFC]">
                                                        <td colSpan={5} className="p-0 border-t border-zinc-50">
                                                            <div className="px-5 pb-5 pt-2 animate-in slide-in-from-top-2 duration-200">
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full text-left text-xs md:text-sm border-collapse min-w-[500px] md:min-w-full">
                                                                        <thead>
                                                                            <tr>
                                                                                <th className="py-3 px-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-[#EAEAEA]">Nama</th>
                                                                                {EVAL_CRITERIA.map(c => (
                                                                                    <th key={c.key} className="py-3 px-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-center w-16 border-b border-[#EAEAEA]" title={c.label}>{c.key.substring(0, 3)}</th>
                                                                                ))}
                                                                                <th className="py-3 px-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-[#EAEAEA] min-w-[150px]">Catatan / Feedback</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-zinc-100">
                                                                            {p.evals.map(ev => {
                                                                                const dName = designers.find(d => d.id === ev.designer_id)?.name || 'Unknown';
                                                                                return (
                                                                                    <tr key={ev.id} className="hover:bg-white transition-colors">
                                                                                        <td className="py-2.5 px-2 text-xs font-bold text-zinc-800 uppercase align-top pt-3">{dName}</td>
                                                                                        {EVAL_CRITERIA.map(c => {
                                                                                            const val = (ev as any)[c.key];
                                                                                            return (
                                                                                                <td key={c.key} className="py-2.5 px-2 text-center align-top pt-3">
                                                                                                    {val ? <span className={`inline-block w-8 py-1 rounded text-[10px] font-bold ${getScoreColor(val)}`}>{val}</span> : <span className="text-zinc-300">-</span>}
                                                                                                </td>
                                                                                            )
                                                                                        })}
                                                                                        <td className="py-2.5 px-2 align-top pt-3">
                                                                                            {ev.masukan_pengembangan ? (
                                                                                                <p className="text-[10px] text-zinc-600 italic bg-[#FCFCFC] p-2 rounded-lg border border-zinc-100 mb-1 leading-relaxed">"{ev.masukan_pengembangan}"</p>
                                                                                            ) : (
                                                                                                <p className="text-[10px] text-zinc-400 italic">Tidak ada catatan.</p>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'team' && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                        {/* Team Line Chart */}
                        <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm">
                            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-6 border-b border-zinc-100 pb-3">Trend Evaluasi Berdasarkan Tim / Designer</h3>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={tChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#A1A1AA', fontWeight: 600 }} dy={10} />
                                        <YAxis domain={[0, 5]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#A1A1AA', fontWeight: 600 }} dx={-10} />
                                        <Tooltip cursor={{ fill: '#F4F4F5' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontWeight: 700, fontSize: '11px' }} />
                                        <Bar dataKey="score" fill="#10B981" radius={[4, 4, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Visual Radar Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {teamStats.map(t => {
                                const getShortLabel = (label: string) => {
                                    if (label === 'Penyelesaian Tugas') return 'TUGAS';
                                    if (label === 'Respon Terhadap Masukan') return 'FEEDBACK';
                                    return label.toUpperCase();
                                };

                                const radarData = EVAL_CRITERIA.map(c => ({
                                    subject: getShortLabel(c.label),
                                    A: t.catAvgs[c.key] || 0,
                                    fullMark: 5,
                                }));
                                return (
                                    <div key={t.id} className="bg-white p-3 rounded-2xl border border-[#EAEAEA] shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col items-center hover:border-emerald-300 transition-colors">
                                        <div className="text-center mb-1.5 line-clamp-1 w-full px-1">
                                            <h4 className="text-sm font-black text-zinc-900 uppercase tracking-tight truncate">{t.name}</h4>
                                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest truncate">{t.role}</p>
                                        </div>
                                        <div className={`text-xs font-black px-2.5 py-0.5 rounded-lg mb-2 ${getScoreColor(t.avgScore)}`}>{t.avgScore.toFixed(2)} Score</div>
                                        <div className="w-full h-[120px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                                                    <PolarGrid stroke="#EAEAEA" />
                                                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8, fill: '#A1A1AA', fontWeight: 700 }} />
                                                    <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                                                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontWeight: 700, fontSize: '10px' }} />
                                                    <Radar name="Designer" dataKey="A" stroke="#10B981" fill="#10B981" fillOpacity={0.2} strokeWidth={2} />
                                                </RadarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Team List View */}
                        <div className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm overflow-hidden animate-in fade-in duration-300 mt-6">
                            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest p-6 border-b border-[#EAEAEA] bg-[#F8F9FA]">Daftar Detail Evaluasi Tim</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs md:text-sm border-collapse min-w-[500px] md:min-w-full">
                                    <thead className="bg-[#FCFCFC] border-b border-[#EAEAEA] font-bold text-[10px] uppercase text-zinc-500 tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Designer & Role</th>
                                            <th className="px-6 py-4 hidden lg:table-cell text-center">Criteria Averages</th>
                                            <th className="px-6 py-4 text-center">Avg Score</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {teamStats.map(t => (
                                            <React.Fragment key={t.id}>
                                                <tr className="hover:bg-[#FCFCFC] transition-colors cursor-pointer group font-bold text-zinc-800 uppercase" onClick={() => toggleTeam(t.id)}>
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-zinc-900 mb-1">{t.name}</div>
                                                        <div className="text-[10px] font-bold text-zinc-500">{t.role} &bull; {t.projectsCount} Project(s)</div>
                                                    </td>
                                                    <td className="px-6 py-4 hidden lg:table-cell">
                                                        <div className="flex gap-2 justify-center">
                                                            {EVAL_CRITERIA.map(c => (
                                                                <div key={c.key} className="text-center w-10">
                                                                    <div className="text-[8px] font-bold text-zinc-400 uppercase mb-0.5">{c.key.substring(0, 3)}</div>
                                                                    <div className={`text-[10px] font-black px-1.5 py-0.5 rounded ${getScoreColor(t.catAvgs[c.key] || 0)}`}>{(t.catAvgs[c.key] || 0).toFixed(1)}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-block px-3 py-1 rounded-xl text-sm font-black ${getScoreColor(t.avgScore)}`}>{t.avgScore.toFixed(2)}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className={`p-2 rounded-full inline-block transition-transform ${expandedTeams[t.id] ? 'rotate-180 bg-zinc-100' : 'bg-[#F8F9FA]'}`}>
                                                            <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedTeams[t.id] && (
                                                    <tr className="bg-[#FCFCFC]">
                                                        <td colSpan={4} className="p-0 border-t border-zinc-50">
                                                            <div className="p-6 animate-in slide-in-from-top-2 duration-200">

                                                                {/* AI Summary Section */}
                                                                <div className="mb-6 bg-gradient-to-r from-emerald-50 to-[#FCFCFC] border border-emerald-100 p-5 rounded-2xl relative shadow-sm">
                                                                    <div className="flex justify-between items-start mb-4">
                                                                        <h5 className="text-[11px] font-black uppercase tracking-widest text-emerald-800 flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>AI Rangkuman Pengembangan Diri</h5>
                                                                        {!aiSummaries[t.id] && (
                                                                            <button onClick={() => handleGenerateSummary(t.id, t.evals)} disabled={isGeneratingAi[t.id]} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm">
                                                                                {isGeneratingAi[t.id] ? 'Generating...' : 'Generate Summary'}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    {aiSummaries[t.id] ? (
                                                                        <div className="text-[13px] font-medium text-emerald-950 leading-relaxed max-w-none bg-white p-4 rounded-xl border border-emerald-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                                                                            <ReactMarkdown
                                                                                components={{
                                                                                    h1: ({ node, ...props }) => <h1 className="text-lg font-bold mt-4 mb-2 uppercase tracking-tight" {...props} />,
                                                                                    h2: ({ node, ...props }) => <h2 className="text-base font-bold mt-3 mb-2 uppercase tracking-tight" {...props} />,
                                                                                    h3: ({ node, ...props }) => <h3 className="text-sm font-bold mt-2 mb-1 uppercase tracking-tight" {...props} />,
                                                                                    p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                                                                                    ul: ({ node, ...props }) => <ul className="list-disc ml-5 mb-3" {...props} />,
                                                                                    ol: ({ node, ...props }) => <ol className="list-decimal ml-5 mb-3" {...props} />,
                                                                                    li: ({ node, ...props }) => <li className="mb-1.5 pl-1" {...props} />,
                                                                                    strong: ({ node, ...props }) => <strong className="font-black text-emerald-900" {...props} />,
                                                                                    em: ({ node, ...props }) => <em className="italic text-emerald-800" {...props} />,
                                                                                }}
                                                                            >
                                                                                {aiSummaries[t.id]}
                                                                            </ReactMarkdown>
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-xs font-semibold text-emerald-600/60 italic bg-white p-4 rounded-xl border border-emerald-50">Klik tombol generate untuk melihat rangkuman masukan dari seluruh project secara otomatis.</p>
                                                                    )}
                                                                </div>

                                                                {/* Project Participations & Feedback */}
                                                                <div className="bg-white rounded-xl border border-[#EAEAEA] shadow-sm overflow-hidden">
                                                                    <div className="overflow-x-auto">
                                                                        <table className="w-full text-left text-xs md:text-sm border-collapse min-w-[500px] md:min-w-full">
                                                                            <thead className="bg-[#F8F9FA] border-b border-[#EAEAEA]">
                                                                                <tr>
                                                                                    <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Project</th>
                                                                                    {EVAL_CRITERIA.map(c => (
                                                                                        <th key={c.key} className="py-3 px-2 text-[9px] font-bold text-zinc-500 uppercase tracking-wider text-center w-12" title={c.label}>{c.key.substring(0, 3)}</th>
                                                                                    ))}
                                                                                    <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider min-w-[200px]">Catatan / Feedback</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-zinc-100">
                                                                                {t.evals.map((ev, idx) => {
                                                                                    const proj = projects.find(p => p.id === ev.project_id);
                                                                                    return (
                                                                                        <tr key={idx} className="hover:bg-[#FCFCFC] transition-colors">
                                                                                            <td className="py-3 px-4 text-[11px] font-bold text-zinc-800 uppercase align-top">
                                                                                                {proj?.project_name || 'Unknown Project'}
                                                                                                <div className="text-[9px] text-zinc-400 mt-1 uppercase">{proj?.start_date}</div>
                                                                                            </td>
                                                                                            {EVAL_CRITERIA.map(c => {
                                                                                                const val = (ev as any)[c.key];
                                                                                                return (
                                                                                                    <td key={c.key} className="py-3 px-2 text-center align-top">
                                                                                                        {val ? <span className={`inline-block py-0.5 px-1.5 rounded text-[10px] font-black ${getScoreColor(val)}`}>{val}</span> : <span className="text-zinc-300">-</span>}
                                                                                                    </td>
                                                                                                )
                                                                                            })}
                                                                                            <td className="py-3 px-4 align-top">
                                                                                                {ev.masukan_pengembangan ? (
                                                                                                    <div className="text-[11px] font-medium text-zinc-600 bg-white p-3 rounded-xl border border-[#EAEAEA] leading-relaxed italic shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                                                                                                        "{ev.masukan_pengembangan}"
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <p className="text-[10px] text-zinc-400 italic mt-1">Tidak ada catatan.</p>
                                                                                                )}
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>

                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
