import React, { useState, useMemo } from 'react';
import { Project, Designer, DesignerEvaluation } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar } from 'recharts';

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
    validEvaluations.forEach(ev => {
        const scores = EVAL_CRITERIA.map(c => (ev as any)[c.key] || 0).filter((v: number) => v > 0);
        if (scores.length > 0) {
            overallScoreSum += scores.reduce((a, b) => a + b, 0) / scores.length;
            overallScoreCount++;
        }
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
        });
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
            const prompt = `Berikut adalah daftar masukan evaluasi pengembangan diri untuk seorang designer:\n${feedbacks.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nBuatkan rangkuman komprehensif tentang apa saja perbaikan atau pengembangan utama yang harus dilakukan oleh desainer ini. Tidak ada batasan panjang teks. Gunakan bahasa Indonesia profesional dan konstruktif.`;

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
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                    <div>
                        <h2 className="text-sm font-bold tracking-widest uppercase text-white/60 mb-1">Project Evaluation Dashboard</h2>
                        <div className="text-4xl font-black tracking-tight">{avgOverallScore} <span className="text-lg text-white/50 font-bold">/5</span></div>
                        <p className="text-xs font-medium text-white/70 mt-2">Nilai rata-rata seluruh evaluasi designer</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-white/10 backdrop-blur-sm border border-white/10 px-6 py-4 rounded-2xl text-center min-w-[130px]">
                            <div className="text-3xl font-black mb-1">{evaluatedProjectIds.length}<span className="text-xl text-white/50 font-bold">/{projects.length}</span></div>
                            <div className="text-[10px] font-bold tracking-widest uppercase text-white/60">Total Project</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm border border-white/10 px-6 py-4 rounded-2xl text-center min-w-[130px]">
                            <div className="text-3xl font-black mb-1">{evaluatedDesignerIds.length}<span className="text-xl text-white/50 font-bold">/{designers.length}</span></div>
                            <div className="text-[10px] font-bold tracking-widest uppercase text-white/60">Total Tim</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toggles */}
            <div className="flex gap-2 bg-[#F8F9FA] p-1.5 rounded-xl w-fit mb-6 border border-[#EAEAEA]">
                <button onClick={() => setActiveTab('project')} className={`px-8 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'project' ? 'bg-white text-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)]' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100/50'}`}>View By Project</button>
                <button onClick={() => setActiveTab('team')} className={`px-8 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'team' ? 'bg-white text-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)]' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100/50'}`}>View By Team</button>
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
                        <div className="space-y-3">
                            {projectStats.map(p => (
                                <div key={p.id} className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm overflow-hidden transition-all hover:border-indigo-200">
                                    <div className="p-5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-4 cursor-pointer select-none" onClick={() => toggleProject(p.id)}>
                                        <div className="flex-1 min-w-[250px]">
                                            <span className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase mb-1 block">{p.date} &bull; Eval: {p.evaluator}</span>
                                            <h4 className="text-base font-bold text-zinc-900 uppercase">{p.name}</h4>
                                            <p className="text-xs font-semibold text-zinc-500 mt-1 uppercase line-clamp-1"><span className="text-zinc-800">L:</span> {p.lead} <span className="mx-1 text-zinc-300">|</span> <span className="text-zinc-800">S:</span> {p.support}</p>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-center">
                                                <div className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase mb-1">Score</div>
                                                <div className={`text-lg font-black px-4 py-1.5 rounded-xl ${getScoreColor(p.avgScore)}`}>{p.avgScore.toFixed(2)}</div>
                                            </div>
                                            <div className={`p-2 rounded-full transition-transform ${expandedProjects[p.id] ? 'rotate-180 bg-zinc-100' : 'bg-[#F8F9FA]'}`}>
                                                <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    {expandedProjects[p.id] && (
                                        <div className="px-5 pb-5 pt-2 border-t border-zinc-50 bg-[#FCFCFC] animate-in slide-in-from-top-2 duration-200">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr>
                                                        <th className="py-3 px-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-[#EAEAEA]">Nama</th>
                                                        {EVAL_CRITERIA.map(c => (
                                                            <th key={c.key} className="py-3 px-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-center w-16 border-b border-[#EAEAEA]" title={c.label}>{c.key.substring(0, 3)}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-100">
                                                    {p.evals.map(ev => {
                                                        const dName = designers.find(d => d.id === ev.designer_id)?.name || 'Unknown';
                                                        return (
                                                            <tr key={ev.id} className="hover:bg-white transition-colors">
                                                                <td className="py-2.5 px-2 text-xs font-bold text-zinc-800 uppercase">{dName}</td>
                                                                {EVAL_CRITERIA.map(c => {
                                                                    const val = (ev as any)[c.key];
                                                                    return (
                                                                        <td key={c.key} className="py-2.5 px-2 text-center">
                                                                            {val ? <span className={`inline-block w-8 py-1 rounded text-[10px] font-bold ${getScoreColor(val)}`}>{val}</span> : <span className="text-zinc-300">-</span>}
                                                                        </td>
                                                                    )
                                                                })}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}
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
                        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {teamStats.map(t => {
                                const getShortLabel = (label: string) => {
                                    if (label === 'Penyelesaian Tugas') return 'TUGAS';
                                    if (label === 'Respon Terhadap Masukan') return 'RESPON/FEEDBACK';
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
                                                    <Radar name="Designer" dataKey="A" stroke="#10B981" fill="#10B981" fillOpacity={0.2} strokeWidth={2} />
                                                </RadarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Team List View */}
                        <div className="space-y-3 mt-6">
                            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-4 border-b border-zinc-100 pb-3">Daftar Detail Evaluasi Tim</h3>
                            {teamStats.map(t => (
                                <div key={`list-${t.id}`} className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm overflow-hidden transition-all hover:border-emerald-200">
                                    <div className="p-5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-4 cursor-pointer select-none" onClick={() => toggleTeam(t.id)}>
                                        <div className="flex-1 min-w-[200px]">
                                            <h4 className="text-base font-bold text-zinc-900 uppercase">{t.name}</h4>
                                            <p className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase mt-1">{t.role} &bull; {t.projectsCount} Project(s)</p>
                                        </div>
                                        {/* Compact Categories Average */}
                                        <div className="hidden lg:flex gap-4">
                                            {EVAL_CRITERIA.map(c => (
                                                <div key={c.key} className="text-center">
                                                    <div className="text-[9px] font-bold text-zinc-400 tracking-widest uppercase mb-1">{c.key.substring(0, 3)}</div>
                                                    <div className={`text-xs font-black px-2 py-0.5 rounded-md ${getScoreColor(t.catAvgs[c.key] || 0)}`}>{(t.catAvgs[c.key] || 0).toFixed(1)}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-6 lg:ml-8">
                                            <div className="text-center">
                                                <div className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase mb-1">Avg Score</div>
                                                <div className={`text-lg font-black px-4 py-1.5 rounded-xl ${getScoreColor(t.avgScore)}`}>{t.avgScore.toFixed(2)}</div>
                                            </div>
                                            <div className={`p-2 rounded-full transition-transform ${expandedTeams[t.id] ? 'rotate-180 bg-zinc-100' : 'bg-[#F8F9FA]'}`}>
                                                <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    {expandedTeams[t.id] && (
                                        <div className="px-5 pb-5 pt-4 border-t border-zinc-50 bg-[#FCFCFC] animate-in slide-in-from-top-2 duration-200">

                                            {/* AI Summary Section */}
                                            <div className="mb-6 bg-gradient-to-r from-emerald-50 to-[#FCFCFC] border border-emerald-100 p-4 rounded-2xl relative">
                                                <div className="flex justify-between items-start mb-3">
                                                    <h5 className="text-[11px] font-black uppercase tracking-widest text-emerald-800 flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>AI Rangkuman Pengembangan Diri</h5>
                                                    {!aiSummaries[t.id] && (
                                                        <button onClick={() => handleGenerateSummary(t.id, t.evals)} disabled={isGeneratingAi[t.id]} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest shadow-sm">
                                                            {isGeneratingAi[t.id] ? 'Generating...' : 'Generate Summary'}
                                                        </button>
                                                    )}
                                                </div>
                                                {aiSummaries[t.id] ? (
                                                    <div className="text-sm font-medium text-emerald-950 leading-relaxed whitespace-pre-wrap">{aiSummaries[t.id]}</div>
                                                ) : (
                                                    <p className="text-xs font-semibold text-emerald-600/60 italic">Klik tombol generate untuk melihat rangkuman masukan dari seluruh project secara otomatis.</p>
                                                )}
                                            </div>

                                            {/* Project Participations & Feedback */}
                                            <div className="space-y-3">
                                                {t.evals.map((ev, idx) => {
                                                    const proj = projects.find(p => p.id === ev.project_id);
                                                    return (
                                                        <div key={idx} className="bg-white p-4 rounded-xl border border-[#EAEAEA]">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="text-xs font-bold text-zinc-800 uppercase">{proj?.project_name || 'Unknown Project'}</span>
                                                                <span className="text-[10px] font-bold text-zinc-400 bg-[#F8F9FA] px-2 py-1 rounded-md uppercase border">{proj?.start_date}</span>
                                                            </div>
                                                            {ev.masukan_pengembangan ? (
                                                                <p className="text-xs font-medium text-zinc-600 italic bg-[#FCFCFC] p-3 rounded-lg border border-zinc-100">"{ev.masukan_pengembangan}"</p>
                                                            ) : (
                                                                <p className="text-[10px] font-bold text-zinc-400 italic">Tidak ada catatan masukan pengembangan.</p>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
