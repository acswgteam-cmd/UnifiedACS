
import React, { useState, useMemo, useRef, useEffect, ChangeEvent } from 'react';
import { Project, Designer, ProjectSurvey, ProjectChecklist, ChecklistTemplate, ChecklistTemplateItem, ArtworkLog, WorkContext, DesignerEvaluation } from '../types';
import { supabase } from '../lib/supabase';
import { SURVEY_FORM_SECRET } from '../data/mockData';
import { ProjectEvaluationView } from '../components/ProjectEvaluationView';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Nama bulan untuk tampilan kalender
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Survey Question Keys mapping for display
const SURVEY_LABELS: Record<string, string> = {
  rating_speed: 'Kecepatan Delivery Output',
  rating_quality: 'Kualitas Output Final',
  rating_accuracy: 'Akurasi Implementasi Brief',
  rating_coord_internal: 'Koordinasi Internal Tim',
  rating_coord_client: 'Koordinasi dengan Klien',
  rating_problem_solving: 'Problem Solving Capability',
  rating_agility: 'Agility terhadap Perubahan',
  rating_impact: 'Impact Value Project'
};

const EVAL_CRITERIA = [
  { key: 'inisiatif', label: 'Inisiatif' },
  { key: 'disiplin', label: 'Disiplin' },
  { key: 'penyelesaian_tugas', label: 'Penyelesaian Tugas' },
  { key: 'attitude', label: 'Attitude' },
  { key: 'komunikasi', label: 'Komunikasi' },
  { key: 'respon_masukan', label: 'Respon Terhadap Masukan' },
];

// ... SimpleRichTextEditor component ...
const SimpleRichTextEditor = ({ initialValue, onSave, placeholder, height = "min-h-[150px]" }: { initialValue: string, onSave: (val: string) => void, placeholder?: string, height?: string }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (contentRef.current && contentRef.current.innerHTML !== initialValue) {
      contentRef.current.innerHTML = initialValue || '';
    }
  }, [initialValue]);
  const exec = (command: string, value: string | null = null) => {
    document.execCommand(command, false, value);
    if (contentRef.current) contentRef.current.focus();
  };
  const handleBlur = () => {
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      if (html !== initialValue) onSave(html);
    }
  };
  return (
    <div style={{ border: '1px solid var(--hl)', borderRadius: 'var(--r-lg)', overflow: 'hidden', backgroundColor: 'var(--s1)', display: 'flex', flexDirection: 'column', width: '100%' }}>
      <style>{`.rte-content ul { list-style-type: disc; margin-left: 1.5em; margin-bottom: 0.5em; } .rte-content ol { list-style-type: decimal; margin-left: 1.5em; margin-bottom: 0.5em; } .rte-content li { margin-bottom: 0.25em; } .rte-content b, .rte-content strong { font-weight: 700; } .rte-content i, .rte-content em { font-style: italic; } .rte-content u { text-decoration: underline; } .rte-content:empty::before { content: attr(data-placeholder); color: var(--ink-4); font-style: italic; pointer-events: none; }`}</style>
      <div style={{ display: 'flex', gap: 4, padding: 8, backgroundColor: 'var(--s3)', borderBottom: '1px solid var(--hl)', alignItems: 'center', flexShrink: 0 }}>
        {(['bold','italic','underline'] as const).map((cmd, i) => (
          <button key={cmd} type="button"
            style={{ padding: '4px 8px', borderRadius: 4, background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', fontSize: 12, fontWeight: 700, minWidth: 24 }}
            onMouseDown={(e) => { e.preventDefault(); exec(cmd); }}
            title={cmd.charAt(0).toUpperCase() + cmd.slice(1)}
          >{['B','I','U'][i]}</button>
        ))}
        <div style={{ width: 1, height: 16, backgroundColor: 'var(--hl-2)', margin: '0 4px' }} />
        <button type="button"
          style={{ padding: '4px 8px', borderRadius: 4, background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
          onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }} title="Bullet List">• List</button>
        <button type="button"
          style={{ padding: '4px 8px', borderRadius: 4, background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
          onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); }} title="Number List">1. List</button>
      </div>
      <div ref={contentRef} contentEditable
        style={{ padding: 16, flex: 1, outline: 'none', fontSize: 14, color: 'var(--ink-2)', overflowY: 'auto', minHeight: 150, backgroundColor: 'var(--s1)' }}
        className={`rte-content ${height}`}
        onBlur={handleBlur} dangerouslySetInnerHTML={{ __html: initialValue || '' }} data-placeholder={placeholder} />
    </div>
  );
};

// Sub-components moved UP to be available for ProjectMaster
const TableRow = ({ cl, idx, cellInputClass, onUpdate, onDelete }: any) => (
  <tr className="border-b border-zinc-100 hover:bg-[#FCFCFC] transition-colors group">
    <td className="px-3 py-2 text-center text-zinc-400 font-medium">{idx + 1}</td>
    <td className="px-3 py-2 relative"><div className="flex items-center gap-2"><input className={cellInputClass} defaultValue={cl.task_name} onBlur={(e) => onUpdate(cl.id, 'task_name', e.target.value)} placeholder="Task Name" /></div></td>
    <td className="px-3 py-2"><input className={cellInputClass} defaultValue={cl.size || ''} onBlur={(e) => onUpdate(cl.id, 'size', e.target.value)} placeholder="Size" /></td>
    <td className="px-3 py-2 text-center"><input type="number" className={`${cellInputClass} text-center`} defaultValue={cl.quantity} onBlur={(e) => onUpdate(cl.id, 'quantity', parseInt(e.target.value) || 0)} /></td>
    <td className="px-3 py-2"><input className={cellInputClass} defaultValue={cl.notes || ''} onBlur={(e) => onUpdate(cl.id, 'notes', e.target.value)} placeholder="Notes" /></td>
    <td className="px-3 py-2"><select value={cl.status} onChange={(e) => onUpdate(cl.id, 'status', e.target.value)} className={`w-full text-[10px] font-bold uppercase rounded py-1 px-1 outline-none cursor-pointer transition-colors bg-transparent hover:bg-[#F8F9FA] ${cl.status === 'DONE' ? 'text-emerald-600' : cl.status === 'ON PROGRESS' ? 'text-amber-600' : 'text-zinc-400'}`}><option value="NONE">Not Started</option><option value="ON PROGRESS">On Progress</option><option value="DONE">Done</option></select></td>
    <td className="px-3 py-2 text-right"><button onClick={() => onDelete(cl.id)} className="text-zinc-300 hover:text-red-500 text-[10px] font-bold uppercase transition-colors p-1 opacity-0 group-hover:opacity-100" title="Delete"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></td>
  </tr>
);

const AddRow = ({ newItem, updateNewItem, onAdd, newRowInputClass }: any) => (
  <tr className="bg-[#FCFCFC]/50 hover:bg-[#FCFCFC] transition-colors">
    <td className="px-3 py-2 text-center text-indigo-300 font-bold">+</td>
    <td className="px-3 py-2"><input placeholder="Add New Item..." className={newRowInputClass} value={newItem.task_name} onChange={e => updateNewItem('task_name', e.target.value)} onKeyDown={e => e.key === 'Enter' && onAdd()} /></td>
    <td className="px-3 py-2"><input placeholder="Size" className={newRowInputClass} value={newItem.size} onChange={e => updateNewItem('size', e.target.value)} onKeyDown={e => e.key === 'Enter' && onAdd()} /></td>
    <td className="px-3 py-2"><input type="number" placeholder="1" className={`${newRowInputClass} text-center`} value={newItem.quantity} onChange={e => updateNewItem('quantity', parseInt(e.target.value) || 0)} onKeyDown={e => e.key === 'Enter' && onAdd()} /></td>
    <td className="px-3 py-2"><input placeholder="Notes..." className={newRowInputClass} value={newItem.notes} onChange={e => updateNewItem('notes', e.target.value)} onKeyDown={e => e.key === 'Enter' && onAdd()} /></td>
    <td className="px-3 py-2"><span className="text-[10px] font-bold text-zinc-400 italic pl-2">Pending</span></td>
    <td className="px-3 py-2 text-right"><button onClick={onAdd} className="text-zinc-900 bg-zinc-100 px-3 py-1.5 rounded text-[10px] font-bold uppercase hover:bg-indigo-100 transition-colors">Add</button></td>
  </tr>
);

interface Props {
  projects: Project[];
  designers: Designer[];
  artworkLogs?: ArtworkLog[];
  designerEvaluations?: DesignerEvaluation[];
  projectSurveys?: ProjectSurvey[];
  projectChecklists?: ProjectChecklist[];
  checklistTemplates?: ChecklistTemplate[];
  checklistTemplateItems?: ChecklistTemplateItem[];
  onUpdate: () => void;
}

export const ProjectMaster: React.FC<Props> = ({ projects, designers, artworkLogs = [], designerEvaluations = [], projectSurveys = [], projectChecklists = [], checklistTemplates = [], checklistTemplateItems = [], onUpdate }) => {
  const [view, setView] = useState<'list' | 'calendar' | 'board' | 'evaluation'>('list');
  const [boardGroup, setBoardGroup] = useState<'status' | 'type' | 'pic' | 'location'>('status');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'checklist'>('details');
  const [artworkFilter, setArtworkFilter] = useState<string | null>(null);
  const [artworkEditingId, setArtworkEditingId] = useState<string | null>(null);
  const [artworkFormData, setArtworkFormData] = useState<Partial<ArtworkLog>>({
    artwork_name: '', artwork_type: '2D Design', start_date: '', end_date: '', pic_designer_id: designers[0]?.id || '', revision_count: 0, approval_required: false, notes: ''
  });
  const [isAddingArtwork, setIsAddingArtwork] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [newLocInput, setNewLocInput] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Checklist States
  const [newItemsMap, setNewItemsMap] = useState<Record<string, { task_name: string, size: string, quantity: number, notes: string }>>({});
  const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedTemplateForEdit, setSelectedTemplateForEdit] = useState<ChecklistTemplate | null>(null);
  const [newTemplateItem, setNewTemplateItem] = useState({ task_name: '', size: '', notes: '' });
  const [editingTemplateNameId, setEditingTemplateNameId] = useState<string | null>(null);
  const [tempTemplateName, setTempTemplateName] = useState('');

  // --- Evaluation Form State ---
  const [evalEditing, setEvalEditing] = useState(false);
  const [evalSubmitting, setEvalSubmitting] = useState(false);
  const [evalEvaluatorName, setEvalEvaluatorName] = useState('');
  const [evalForm, setEvalForm] = useState<Record<string, Partial<DesignerEvaluation>>>({});
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const evalFileInputRef = useRef<HTMLInputElement>(null);

  // Reset eval form state when switching projects
  useEffect(() => {
    setEvalEditing(false);
    setEvalForm({});
    setEvalEvaluatorName('');
    setAiError(null);
    setEvalSubmitting(false);
    setArtworkFilter(null);
    setArtworkEditingId(null);
    setIsAddingArtwork(false);
  }, [selectedProject?.id]);

  // Filters
  const [filterType, setFilterType] = useState('ALL');
  const [filterPIC, setFilterPIC] = useState('ALL');
  const [filterLocation, setFilterLocation] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [formData, setFormData] = useState<Partial<Project>>({
    project_name: '', start_date: '', end_date: '', locations: [], pic_designer_id: designers[0]?.id || '', support_designer_ids: [], project_type: 'EVENT', status: 'ON PROGRESS', notes: ''
  });

  const getDesignerName = (id: string) => designers.find(d => d.id === id)?.name || 'N/A';
  const uniqueLocations = useMemo(() => { const locsSet = new Set<string>(); projects.forEach(p => { const locs = (p as any).locations || (p as any).location; if (Array.isArray(locs)) locs.forEach(l => l && locsSet.add(l)); else if (typeof locs === 'string' && locs.trim() !== '') locsSet.add(locs.trim()); }); return Array.from(locsSet).sort(); }, [projects]);
  const filteredProjects = useMemo(() => { return projects.filter(p => { const matchType = filterType === 'ALL' || p.project_type === filterType; const matchPIC = filterPIC === 'ALL' || p.pic_designer_id === filterPIC; const locs = (p as any).locations || (p as any).location || []; const normalizedLocs = Array.isArray(locs) ? locs : [locs]; const matchLoc = filterLocation === 'ALL' || normalizedLocs.includes(filterLocation); const matchStatus = filterStatus === 'ALL' || p.status === filterStatus; return matchType && matchPIC && matchLoc && matchStatus; }); }, [projects, filterType, filterPIC, filterLocation, filterStatus]);

  const projectBoardGroups = useMemo(() => {
    const groups: Record<string, Project[]> = {};
    filteredProjects.forEach(p => {
      let key = 'Unassigned';
      if (boardGroup === 'status') key = p.status || 'UNASSIGNED';
      else if (boardGroup === 'type') key = p.project_type || 'UNASSIGNED';
      else if (boardGroup === 'pic') key = getDesignerName(p.pic_designer_id) || 'UNASSIGNED';
      else if (boardGroup === 'location') {
        const locs = (p as any).locations || (p as any).location || [];
        const normLocs = Array.isArray(locs) ? locs : [locs];
        key = normLocs[0] || 'NO LOCATION';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }, [filteredProjects, boardGroup, designers]);

  const calendarLanes = useMemo(() => { const year = currentDate.getFullYear(); const month = currentDate.getMonth(); const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0]; const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0]; const visibleProjects = filteredProjects.filter(p => p.start_date <= endOfMonth && p.end_date >= startOfMonth); const sorted = [...visibleProjects].sort((a, b) => a.start_date.localeCompare(b.start_date)); const lanes: Project[][] = []; sorted.forEach(project => { let placed = false; for (let i = 0; i < lanes.length; i++) { const lastInLane = lanes[i][lanes[i].length - 1]; if (project.start_date > lastInLane.end_date) { lanes[i].push(project); placed = true; break; } } if (!placed) lanes.push([project]); }); return lanes; }, [filteredProjects, currentDate]);

  const dashboardStats = useMemo(() => {
    const totalProjects = projects.length;
    const byStatus = {
      'ON PROGRESS': projects.filter(p => p.status === 'ON PROGRESS').length,
      'ON HOLD': projects.filter(p => p.status === 'ON HOLD').length,
      'DONE': projects.filter(p => p.status === 'DONE').length,
    };

    const doneProjects = projects.filter(p => p.status === 'DONE');
    const evaluatedProjectsCount = doneProjects.filter(p => designerEvaluations.some(e => e.project_id === p.id)).length;

    let totalScore = 0;
    let evalCount = 0;
    const detailSums: Record<string, number> = {};
    const detailCounts: Record<string, number> = {};
    EVAL_CRITERIA.forEach(c => {
      detailSums[c.key] = 0;
      detailCounts[c.key] = 0;
    });

    designerEvaluations.forEach(ev => {
      const scores = EVAL_CRITERIA.map(c => (ev as any)[c.key] || 0).filter((v: number) => v > 0);
      if (scores.length > 0) {
        totalScore += scores.reduce((a, b) => a + b, 0) / scores.length;
        evalCount++;
      }
      EVAL_CRITERIA.forEach(c => {
        const score = (ev as any)[c.key] || 0;
        if (score > 0) {
          detailSums[c.key] += score;
          detailCounts[c.key]++;
        }
      });
    });
    const avgScore = evalCount > 0 ? (totalScore / evalCount).toFixed(1) : '0.0';

    const detailAverages: Record<string, string> = {};
    EVAL_CRITERIA.forEach(c => {
      detailAverages[c.key] = detailCounts[c.key] > 0 ? (detailSums[c.key] / detailCounts[c.key]).toFixed(1) : '0.0';
    });

    const totalTeamSize = projects.reduce((acc, p) => acc + 1 + (p.support_designer_ids?.length || 0), 0);
    const avgTeamSize = totalProjects > 0 ? (totalTeamSize / totalProjects).toFixed(1) : '0.0';

    return { totalProjects, byStatus, evaluatedProjectsCount, doneCount: doneProjects.length, avgScore, avgTeamSize, detailAverages };
  }, [projects, designerEvaluations]);

  const handleCopyChecklistLink = () => { const publicUrl = `${window.location.origin}${window.location.pathname}#/portal/v1/survey/${SURVEY_FORM_SECRET}`; navigator.clipboard.writeText(publicUrl); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); };
  const toggleSupportDesigner = (id: string) => { const current = formData.support_designer_ids || []; if (current.includes(id)) { setFormData({ ...formData, support_designer_ids: current.filter(sid => sid !== id) }); } else { setFormData({ ...formData, support_designer_ids: [...current, id] }); } };
  const addLocation = () => { const val = newLocInput.trim(); if (!val) return; const current = formData.locations || []; if (!current.includes(val)) { setFormData({ ...formData, locations: [...current, val] }); } setNewLocInput(''); };
  const removeLocation = (loc: string) => { setFormData({ ...formData, locations: (formData.locations || []).filter(l => l !== loc) }); };

  // --- Evaluation Form Handlers ---
  const handleEvalFieldChange = (designerId: string, field: string, value: any) => {
    setEvalForm(prev => ({
      ...prev,
      [designerId]: {
        ...(prev[designerId] || {}),
        [field]: value
      }
    }));
  };

  const fuzzyMatchDesigner = (name: string, designerList: Designer[]): string | null => {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedName = normalize(name);
    for (const d of designerList) { if (normalize(d.name) === normalizedName) return d.id; }
    for (const d of designerList) { const dn = normalize(d.name); if (dn.includes(normalizedName) || normalizedName.includes(dn)) return d.id; }
    const nameWords = normalizedName.split(/\s+/).filter(w => w.length > 2);
    for (const d of designerList) { const dWords = normalize(d.name).split(/\s+/); if (nameWords.some(nw => dWords.some(dw => dw.includes(nw) || nw.includes(dw)))) return d.id; }
    return null;
  };

  const handleAIScan = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!GEMINI_API_KEY) { setAiError('Gemini API Key belum diset.'); return; }
    setAiProcessing(true);
    setAiError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => { const result = reader.result as string; resolve(result.split(',')[1]); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const mimeType = file.type || 'image/png';
      const projectDesignerNames = Object.keys(evalForm).map(did => designers.find(x => x.id === did)?.name || 'Unknown');
      const prompt = `Analyze this Excel screenshot of a designer performance evaluation table.
Extract ALL rows of evaluation data.
The table columns may include: NO, Nama, Kategori, Job Title, Inisiatif, Disiplin, Penyelesaian Tugas, Attitude, Komunikasi, Respon Terhadap Masukan, Average, and Masukan untuk Pengembangan Diri.
Known designer names in this project: ${projectDesignerNames.join(', ')}
Return ONLY valid JSON array with this exact structure (no markdown, no code blocks, just raw JSON):
[{"nama":"designer full name","kategori":"category or null","job_title":"job title or null","inisiatif":number_1_to_5_or_null,"disiplin":number_1_to_5_or_null,"penyelesaian_tugas":number_1_to_5_or_null,"attitude":number_1_to_5_or_null,"komunikasi":number_1_to_5_or_null,"respon_masukan":number_1_to_5_or_null,"masukan_pengembangan":"feedback text or null"}]
IMPORTANT: Extract ALL rows. Return raw JSON only, no explanations.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 4096 } })
        }
      );
      if (!response.ok) { const errText = await response.text(); throw new Error(`Gemini API error: ${response.status} - ${errText}`); }
      const data = await response.json();
      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) throw new Error('No response from Gemini API');
      let jsonStr = textContent.trim();
      if (jsonStr.startsWith('```')) { jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim(); }
      const extracted: any[] = JSON.parse(jsonStr);
      if (!Array.isArray(extracted) || extracted.length === 0) throw new Error('Tidak ada data yang terdeteksi dari screenshot.');

      let matchCount = 0;
      const updatedForm = { ...evalForm };
      const projectDesigners = Object.keys(evalForm).map(did => designers.find(x => x.id === did)).filter(Boolean) as Designer[];
      for (const row of extracted) {
        const matchedId = fuzzyMatchDesigner(row.nama, projectDesigners);
        if (matchedId && updatedForm[matchedId]) {
          updatedForm[matchedId] = {
            ...updatedForm[matchedId],
            kategori: row.kategori || updatedForm[matchedId].kategori,
            job_title: row.job_title || updatedForm[matchedId].job_title,
            inisiatif: row.inisiatif || updatedForm[matchedId].inisiatif,
            disiplin: row.disiplin || updatedForm[matchedId].disiplin,
            penyelesaian_tugas: row.penyelesaian_tugas || updatedForm[matchedId].penyelesaian_tugas,
            attitude: row.attitude || updatedForm[matchedId].attitude,
            komunikasi: row.komunikasi || updatedForm[matchedId].komunikasi,
            respon_masukan: row.respon_masukan || updatedForm[matchedId].respon_masukan,
            masukan_pengembangan: row.masukan_pengembangan || updatedForm[matchedId].masukan_pengembangan,
          };
          matchCount++;
        }
      }
      setEvalForm(updatedForm);
      if (matchCount === 0) {
        setAiError(`⚠️ ${extracted.length} baris terdeteksi, tapi tidak ada nama yang cocok. Nama: ${extracted.map(r => r.nama).join(', ')}`);
      } else {
        setAiError(null);
        alert(`✅ Berhasil! ${matchCount} dari ${extracted.length} designer diisi otomatis.`);
      }
    } catch (err: any) {
      console.error('AI Scan error:', err);
      setAiError(`❌ Error: ${err.message}`);
    } finally {
      setAiProcessing(false);
      if (evalFileInputRef.current) evalFileInputRef.current.value = '';
    }
  };
  const resetForm = () => { setFormData({ project_name: '', start_date: '', end_date: '', locations: [], pic_designer_id: designers[0]?.id || '', support_designer_ids: [], project_type: 'EVENT', status: 'ON PROGRESS', notes: '' }); setEditingId(null); setIsAdding(false); setNewLocInput(''); };
  const handleSave = async (e: React.FormEvent) => { e.preventDefault(); if (!formData.project_name || !supabase) return; let finalLocations = [...(formData.locations || [])]; if (newLocInput.trim() && !finalLocations.includes(newLocInput.trim())) { finalLocations.push(newLocInput.trim()); } const savePayload = { project_name: formData.project_name, start_date: formData.start_date, end_date: formData.end_date, locations: finalLocations, pic_designer_id: formData.pic_designer_id, support_designer_ids: formData.support_designer_ids || [], project_type: formData.project_type, status: formData.status, notes: formData.notes }; if (editingId) { const { error } = await supabase.from('projects').update(savePayload).eq('id', editingId); if (error) alert(`Error: ${error.message}`); else { onUpdate(); resetForm(); } } else { const { error } = await supabase.from('projects').insert([savePayload]); if (error) alert(`Error: ${error.message}`); else { onUpdate(); resetForm(); } } };
  const handleEdit = (p: Project) => { let rawLocs = (p as any).locations || (p as any).location || []; let normalizedLocations = Array.isArray(rawLocs) ? rawLocs : (rawLocs ? [rawLocs] : []); setFormData({ ...p, support_designer_ids: p.support_designer_ids || [], locations: normalizedLocations }); setEditingId(p.id); setIsAdding(true); setView('list'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleDelete = async (e: React.MouseEvent, id: string) => { e.stopPropagation(); if (!supabase || !confirm('Hapus project ini?')) return; const { error } = await supabase.from('projects').delete().eq('id', id); if (error) alert(error.message); else onUpdate(); };
  const getStatusBadge = (status: string) => { switch (status) { case 'ON HOLD': return 'bg-amber-500/10 text-amber-500'; case 'DONE': return 'bg-emerald-500/10 text-emerald-500'; default: return 'bg-blue-500/10 text-blue-500'; } };
  const handleDeleteSurvey = async (id: string) => { if (!supabase || !confirm("Are you sure you want to delete this evaluation result? This cannot be undone.")) return; const { error } = await supabase.from('project_surveys').delete().eq('id', id); if (error) alert(error.message); else onUpdate(); };
  const handleDeleteEvaluation = async (projectId: string) => { if (!supabase || !confirm("Hapus semua evaluasi untuk project ini?")) return; const { error } = await supabase.from('designer_evaluations').delete().eq('project_id', projectId); if (error) alert("Failed to delete: " + error.message); else onUpdate(); };

  const handleStatusUpdate = async (newStatus: string) => { if (!selectedProject || !supabase) return; setSelectedProject({ ...selectedProject, status: newStatus as any }); const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', selectedProject.id); if (error) { alert("Failed to update status: " + error.message); onUpdate(); } else { onUpdate(); } };
  const handleNotesUpdate = async (newNotes: string) => { if (!selectedProject || !supabase) return; const { error } = await supabase.from('projects').update({ notes: newNotes }).eq('id', selectedProject.id); if (error) { console.error("Failed to save notes:", error.message); } else { setSelectedProject(prev => prev ? { ...prev, notes: newNotes } : null); onUpdate(); } };

  // Artwork stats for the selected project
  const projectArtworkLogs = useMemo(() => {
    if (!selectedProject) return [];
    return artworkLogs.filter(l => l.work_context === WorkContext.PROJECT && l.project_id === selectedProject.id);
  }, [selectedProject, artworkLogs]);

  const projectArtworkStats = useMemo(() => {
    return {
      total: projectArtworkLogs.length,
      '2D Design': projectArtworkLogs.filter(l => l.artwork_type === '2D Design').length,
      '3D Design': projectArtworkLogs.filter(l => l.artwork_type === '3D Design').length,
      'Video': projectArtworkLogs.filter(l => l.artwork_type === 'Video').length,
    };
  }, [projectArtworkLogs]);

  const filteredArtworkLogs = useMemo(() => {
    if (!artworkFilter) return [];
    if (artworkFilter === 'total') return projectArtworkLogs;
    return projectArtworkLogs.filter(l => l.artwork_type === artworkFilter);
  }, [projectArtworkLogs, artworkFilter]);

  const resetArtworkForm = () => {
    setArtworkFormData({ artwork_name: '', artwork_type: '2D Design', start_date: '', end_date: '', pic_designer_id: designers[0]?.id || '', revision_count: 0, approval_required: false, notes: '' });
    setArtworkEditingId(null);
    setIsAddingArtwork(false);
  };

  const handleSaveArtwork = async () => {
    if (!supabase || !selectedProject || !artworkFormData.artwork_name?.trim()) return;
    const payload = {
      work_context: WorkContext.PROJECT,
      project_id: selectedProject.id,
      artwork_name: artworkFormData.artwork_name,
      artwork_type: artworkFormData.artwork_type || '2D Design',
      start_date: artworkFormData.start_date || new Date().toISOString().split('T')[0],
      end_date: artworkFormData.end_date || artworkFormData.start_date || new Date().toISOString().split('T')[0],
      pic_designer_id: artworkFormData.pic_designer_id || designers[0]?.id || '',
      revision_count: artworkFormData.revision_count || 0,
      approval_required: artworkFormData.approval_required || false,
      notes: artworkFormData.notes || '',
    };
    if (artworkEditingId) {
      const { error } = await supabase.from('artwork_logs').update(payload).eq('id', artworkEditingId);
      if (error) alert('Error: ' + error.message);
      else { onUpdate(); resetArtworkForm(); }
    } else {
      const { error } = await supabase.from('artwork_logs').insert([payload]);
      if (error) alert('Error: ' + error.message);
      else { onUpdate(); resetArtworkForm(); }
    }
  };

  const handleEditArtwork = (log: ArtworkLog) => {
    setArtworkFormData({ ...log });
    setArtworkEditingId(log.id);
    setIsAddingArtwork(true);
  };

  const handleDeleteArtwork = async (id: string) => {
    if (!supabase || !confirm('Hapus artwork log ini?')) return;
    const { error } = await supabase.from('artwork_logs').delete().eq('id', id);
    if (error) alert(error.message);
    else onUpdate();
  };

  const filteredChecklists = useMemo(() => { if (!selectedProject) return []; return projectChecklists.filter(cl => cl.project_id === selectedProject.id).sort((a, b) => { const dateA = a.created_at || ''; const dateB = b.created_at || ''; const dateCompare = dateA.localeCompare(dateB); if (dateCompare !== 0) return dateCompare; return a.id.localeCompare(b.id); }); }, [selectedProject, projectChecklists]);
  const groupedChecklists = useMemo(() => { const groups: Record<string, ProjectChecklist[]> = {}; const manualItems: ProjectChecklist[] = []; filteredChecklists.forEach(item => { if (item.source_template_id) { if (!groups[item.source_template_id]) groups[item.source_template_id] = []; groups[item.source_template_id].push(item); } else { manualItems.push(item); } }); return { groups, manualItems }; }, [filteredChecklists]);
  const sortedActiveTemplateIds = useMemo(() => { const ids = Object.keys(groupedChecklists.groups); return ids.sort((a, b) => { const nameA = checklistTemplates.find(t => t.id === a)?.name || ''; const nameB = checklistTemplates.find(t => t.id === b)?.name || ''; return nameA.localeCompare(nameB); }); }, [groupedChecklists, checklistTemplates]);
  const activeTemplatesSet = useMemo(() => new Set(Object.keys(groupedChecklists.groups)), [groupedChecklists]);
  const handleToggleTemplate = async (templateId: string) => { if (!selectedProject || !supabase) return; if (activeTemplatesSet.has(templateId)) { const { error } = await supabase.from('project_checklists').delete().eq('project_id', selectedProject.id).eq('source_template_id', templateId); if (error) alert("Error removing template items: " + error.message); else onUpdate(); } else { const itemsToAdd = checklistTemplateItems.filter(ti => ti.template_id === templateId).map(ti => ({ project_id: selectedProject.id, task_name: ti.task_name, size: ti.size, notes: ti.notes, quantity: 1, status: 'NONE', source_template_id: templateId })); if (itemsToAdd.length === 0) { alert("This template has no items defined."); return; } const { error } = await supabase.from('project_checklists').insert(itemsToAdd); if (error) alert("Error applying template: " + error.message); else onUpdate(); } };
  const handleUpdateChecklistField = async (id: string, field: keyof ProjectChecklist, value: any) => { if (!supabase) return; const { error } = await supabase.from('project_checklists').update({ [field]: value }).eq('id', id); if (error) console.error("Error updating checklist:", error.message); else onUpdate(); };
  const handleDeleteChecklist = async (id: string) => { if (!supabase) return; const { error } = await supabase.from('project_checklists').delete().eq('id', id); if (error) alert(error.message); else onUpdate(); };
  const handleAddNewItem = async (templateId: string | null) => { if (!selectedProject || !supabase) return; const mapKey = templateId || 'manual'; const currentNewItem = newItemsMap[mapKey] || { task_name: '', size: '', quantity: 1, notes: '' }; if (!currentNewItem.task_name.trim()) return; const payload = { project_id: selectedProject.id, task_name: currentNewItem.task_name, size: currentNewItem.size, quantity: currentNewItem.quantity, notes: currentNewItem.notes, status: 'NONE', source_template_id: templateId }; const { error } = await supabase.from('project_checklists').insert([payload]); if (error) alert(error.message); else { setNewItemsMap(prev => ({ ...prev, [mapKey]: { task_name: '', size: '', quantity: 1, notes: '' } })); onUpdate(); } };
  const updateNewItemState = (templateId: string | null, field: string, value: any) => { const mapKey = templateId || 'manual'; setNewItemsMap(prev => ({ ...prev, [mapKey]: { ...(prev[mapKey] || { task_name: '', size: '', quantity: 1, notes: '' }), [field]: value } })); };
  const handleAddTemplate = async () => { if (!newTemplateName.trim() || !supabase) return; const { error } = await supabase.from('checklist_templates').insert([{ name: newTemplateName }]); if (error) alert(error.message); else { setNewTemplateName(''); onUpdate(); } };
  const handleEditTemplateNameStart = (template: ChecklistTemplate) => { setEditingTemplateNameId(template.id); setTempTemplateName(template.name); };
  const handleEditTemplateNameSave = async () => { if (!supabase || !editingTemplateNameId) return; const { error } = await supabase.from('checklist_templates').update({ name: tempTemplateName }).eq('id', editingTemplateNameId); if (error) alert(error.message); else { setEditingTemplateNameId(null); onUpdate(); } };
  const handleDeleteTemplate = async (id: string) => { if (!supabase || !confirm("Delete this template and all its items?")) return; const { error } = await supabase.from('checklist_templates').delete().eq('id', id); if (error) alert(error.message); else { if (selectedTemplateForEdit?.id === id) setSelectedTemplateForEdit(null); onUpdate(); } };
  const handleAddTemplateItem = async () => { if (!selectedTemplateForEdit || !newTemplateItem.task_name || !supabase) return; const { error } = await supabase.from('checklist_template_items').insert([{ template_id: selectedTemplateForEdit.id, task_name: newTemplateItem.task_name, size: newTemplateItem.size, notes: newTemplateItem.notes }]); if (error) alert(error.message); else { setNewTemplateItem({ task_name: '', size: '', notes: '' }); onUpdate(); } };
  const handleUpdateTemplateItem = async (itemId: string, field: keyof ChecklistTemplateItem, value: any) => { if (!supabase) return; const { error } = await supabase.from('checklist_template_items').update({ [field]: value }).eq('id', itemId); if (error) console.error("Update failed", error); else onUpdate(); };
  const handleDeleteTemplateItem = async (id: string) => { if (!supabase) return; const { error } = await supabase.from('checklist_template_items').delete().eq('id', id); if (error) alert(error.message); else onUpdate(); };

  const renderCalendar = () => { const year = currentDate.getFullYear(); const month = currentDate.getMonth(); const totalDays = new Date(year, month + 1, 0).getDate(); const startDay = new Date(year, month, 1).getDay(); const todayStr = new Date().toISOString().split('T')[0]; const days = []; for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} className="min-h-[160px] bg-[#F8F9FA]/50 border-r border-b border-[#EAEAEA]"></div>); for (let d = 1; d <= totalDays; d++) { const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; const isToday = dateStr === todayStr; days.push(<div key={d} className={`min-h-[160px] h-full border-r border-b border-[#EAEAEA] p-0 flex flex-col relative ${isToday ? 'bg-zinc-100/30' : 'bg-white'}`}> <div className="p-2 flex-shrink-0"> <span className={`text-[10px] font-bold inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-zinc-900 text-white' : 'text-zinc-700'}`}>{d}</span> </div> <div className="flex flex-col space-y-1 pb-2 flex-1"> {calendarLanes.map((lane, laneIdx) => { const project = lane.find(p => dateStr >= p.start_date && dateStr <= p.end_date); if (!project) return <div key={`spacer-${laneIdx}`} className="min-h-[58px] py-1.5 w-full"></div>; const themes = [{ bg: 'bg-blue-50', border: 'border-blue-600', text: 'text-blue-900' }, { bg: 'bg-amber-50', border: 'border-amber-600', text: 'text-amber-900' }, { bg: 'bg-emerald-50', border: 'border-emerald-600', text: 'text-emerald-900' }, { bg: 'bg-rose-50', border: 'border-rose-600', text: 'text-rose-900' }]; const theme = themes[Math.abs(project.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % themes.length]; const isStart = dateStr === project.start_date; return (<div key={project.id} onClick={() => { setSelectedProject(project); setActiveTab('details'); }} className={`cursor-pointer min-h-[58px] py-1.5 flex flex-col justify-center px-2 overflow-hidden transition-all hover:brightness-95 ${theme.bg} ${theme.text} ${isStart ? `rounded-l-md ml-1 border-l-4 ${theme.border}` : ''} ${dateStr === project.end_date ? 'rounded-r-md mr-1' : ''}`}> <span className="text-[10px] font-bold truncate uppercase">{project.project_name}</span> <span className="text-[8px] font-bold opacity-80 mt-0.5 truncate uppercase">PIC: {getDesignerName(project.pic_designer_id)}</span> </div>); })} </div> </div>); } return days; };

  const labelClass = "text-[11px] font-bold uppercase mb-1.5 block tracking-wide" ;
  const inputClass = "w-full rounded-lg text-sm p-3 border outline-none font-semibold shadow-sm transition-all focus:ring-2 focus:ring-indigo-500";
  const cellInputClass = "w-full bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-xs font-bold py-1 px-1 transition-colors";
  const newRowInputClass = "w-full rounded-sm focus:border-indigo-500 outline-none text-xs py-1.5 px-2";

  if (selectedProject) {
    return (
      <div className="flex flex-col h-full animate-in slide-in-from-right duration-300 relative">
        {/* MODAL START */}
        {isManageTemplatesOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 md:p-6 bg-[#1A1C20]/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsManageTemplatesOpen(false)}>
            <div className="bg-white w-full max-w-6xl h-[95vh] md:h-[85vh] rounded-[12px] md:rounded-[20px] shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="p-4 md:p-6 border-b border-[#EAEAEA] bg-[#FCFCFC] flex justify-between items-center">
                <h3 className="text-sm md:text-xl font-bold text-zinc-900 uppercase tracking-tight">Manage Templates</h3>
                <button onClick={() => setIsManageTemplatesOpen(false)} className="p-2 bg-white rounded-lg hover:bg-[#FAFAFA]200 text-zinc-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-[#EAEAEA] bg-white p-3 md:p-4 flex flex-col flex-shrink-0 max-h-[30vh] md:max-h-none">
                  <div className="flex gap-2 mb-4">
                    <input type="text" placeholder="New Template Name" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} className="w-full text-xs font-bold p-2.5 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none" />
                    <button onClick={handleAddTemplate} className="px-4 bg-zinc-900 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-black">Add</button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {checklistTemplates.map(t => (
                      <div key={t.id} onClick={() => setSelectedTemplateForEdit(t)} className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center group transition-all ${selectedTemplateForEdit?.id === t.id ? 'bg-zinc-100 border-indigo-300 ring-1 ring-indigo-200' : 'bg-[#FCFCFC] border-[#EAEAEA] hover:border-indigo-300 hover:bg-white'}`}>
                        {editingTemplateNameId === t.id ? (
                          <div className="flex items-center gap-1 w-full">
                            <input className="w-full text-xs font-bold p-1 border border-indigo-300 rounded bg-white" value={tempTemplateName} onChange={(e) => setTempTemplateName(e.target.value)} onBlur={handleEditTemplateNameSave} onKeyDown={(e) => e.key === 'Enter' && handleEditTemplateNameSave()} autoFocus onClick={(e) => e.stopPropagation()} />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 overflow-hidden flex-1">
                            <span className="text-xs font-bold text-zinc-800 uppercase truncate">{t.name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                          <button onClick={(e) => { e.stopPropagation(); handleEditTemplateNameStart(t); }} className="p-1 text-zinc-400 hover:text-zinc-900 hover:bg-indigo-100 rounded"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 p-4 md:p-8 bg-[#FCFCFC] overflow-y-auto">
                  {selectedTemplateForEdit ? (
                    <div className="space-y-8 max-w-4xl mx-auto">
                      <div className="flex justify-between items-end border-b border-[#EAEAEA] pb-4">
                        <div>
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Editing Template</span>
                          <h4 className="text-2xl font-bold text-zinc-900 uppercase tracking-tight">{selectedTemplateForEdit.name}</h4>
                        </div>
                        <span className="text-xs font-bold text-zinc-500 bg-[#FAFAFA]200 px-3 py-1 rounded-full">{checklistTemplateItems.filter(ti => ti.template_id === selectedTemplateForEdit.id).length} Items</span>
                      </div>

                      <div className="bg-white p-5 rounded-[20px] border border-[#EAEAEA] shadow-sm grid grid-cols-4 gap-3">
                        <input type="text" placeholder="Design Name" value={newTemplateItem.task_name} onChange={e => setNewTemplateItem({ ...newTemplateItem, task_name: e.target.value })} className="col-span-2 text-xs font-bold p-3 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none" />
                        <input type="text" placeholder="Size (e.g. A4)" value={newTemplateItem.size} onChange={e => setNewTemplateItem({ ...newTemplateItem, size: e.target.value })} className="col-span-1 text-xs font-bold p-3 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none" />
                        <button onClick={handleAddTemplateItem} className="col-span-1 bg-zinc-900 text-white rounded-xl text-xs font-bold uppercase tracking-wide shadow-md hover:bg-black transition-all">Add Item</button>
                        <input type="text" placeholder="Default Notes (Optional)" value={newTemplateItem.notes} onChange={e => setNewTemplateItem({ ...newTemplateItem, notes: e.target.value })} className="col-span-4 text-xs font-bold p-3 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none" />
                      </div>

                      <div className="space-y-3">
                        {checklistTemplateItems.filter(ti => ti.template_id === selectedTemplateForEdit.id).map(ti => (
                          <div key={ti.id} className="bg-white p-4 rounded-xl border border-[#EAEAEA] flex justify-between items-start gap-4 hover:shadow-md transition-shadow group">
                            <div className="flex-1 grid grid-cols-12 gap-4">
                              <div className="col-span-5"><span className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">Item Name</span><input className="w-full text-sm font-bold text-zinc-900 uppercase bg-transparent border-b border-transparent focus:border-zinc-900 outline-none pb-1 transition-colors" defaultValue={ti.task_name} onBlur={(e) => handleUpdateTemplateItem(ti.id, 'task_name', e.target.value)} placeholder="Item Name" /></div>
                              <div className="col-span-3"><span className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">Size</span><input className="w-full text-xs font-bold text-zinc-600 bg-transparent border-b border-transparent focus:border-zinc-900 outline-none pb-1 transition-colors" defaultValue={ti.size} onBlur={(e) => handleUpdateTemplateItem(ti.id, 'size', e.target.value)} placeholder="Size" /></div>
                              <div className="col-span-4"><span className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">Default Notes</span><input className="w-full text-xs font-medium text-zinc-500 bg-transparent border-b border-transparent focus:border-zinc-900 outline-none pb-1 transition-colors italic" defaultValue={ti.notes} onBlur={(e) => handleUpdateTemplateItem(ti.id, 'notes', e.target.value)} placeholder="Notes" /></div>
                            </div>
                            <button onClick={() => handleDeleteTemplateItem(ti.id)} className="text-zinc-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all self-center opacity-0 group-hover:opacity-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                      <div className="w-20 h-20 bg-[#FAFAFA]200 rounded-full flex items-center justify-center mb-4 text-4xl">📝</div>
                      <h4 className="text-xl font-bold text-zinc-400 uppercase">No Template Selected</h4>
                      <p className="text-zinc-400 text-sm font-medium mt-2">Select a template from the sidebar to manage its items.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* MODAL END */}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4 mb-4 md:mb-6 pb-3 md:pb-4 border-b border-[#EAEAEA]">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button onClick={() => setSelectedProject(null)} className="p-2 bg-white border border-zinc-300 rounded-lg hover:bg-[#FCFCFC] text-zinc-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-zinc-900 uppercase tracking-tight">{selectedProject.project_name}</h1>
              <p className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase">{selectedProject.start_date} → {selectedProject.end_date} &bull; {selectedProject.project_type}</p>
            </div>
          </div>
          <div className="w-full md:w-auto">
            <select value={selectedProject.status} onChange={(e) => handleStatusUpdate(e.target.value)} className={`w-full md:w-48 px-4 py-2.5 rounded-xl border-2 text-sm font-bold uppercase outline-none cursor-pointer hover:opacity-90 transition-all shadow-sm appearance-none text-center ${selectedProject.status === 'DONE' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : selectedProject.status === 'ON HOLD' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-blue-100 text-blue-800 border-blue-300'}`}>
              <option value="ON PROGRESS">ON PROGRESS</option><option value="ON HOLD">ON HOLD</option><option value="DONE">DONE</option>
            </select>
          </div>
        </div>

        <div className="flex gap-1 bg-[#F8F9FA] p-1 rounded-xl w-full md:w-fit mb-4 md:mb-6">
          <button onClick={() => setActiveTab('details')} className={`flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-2 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'details' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>Details</button>
          <button onClick={() => setActiveTab('checklist')} className={`flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-2 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'checklist' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>Checklist</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
              <div className="bg-white p-6 rounded-[20px] border border-[var(--color-hl)] shadow-sm h-fit"><h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-4 border-b border-zinc-100 pb-2">Information</h3><div className="space-y-4"><div><span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">PIC Designer</span><p className="font-bold text-zinc-800 uppercase flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-zinc-900"></span>{getDesignerName(selectedProject.pic_designer_id)}</p></div><div><span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Support Team</span><div className="flex flex-wrap gap-1">{selectedProject.support_designer_ids && selectedProject.support_designer_ids.length > 0 ? selectedProject.support_designer_ids.map(sid => (<span key={sid} className="px-2 py-0.5 bg-zinc-100 text-zinc-600 text-[9px] font-bold rounded uppercase">{getDesignerName(sid)}</span>)) : <span className="text-xs text-zinc-400 italic">No support</span>}</div></div><div><span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Locations</span><div className="flex flex-wrap gap-2">{Array.isArray((selectedProject as any).locations) && (selectedProject as any).locations.length > 0 ? (selectedProject as any).locations.map((loc: string) => <span key={loc} className="px-2 py-1 bg-zinc-100 text-[10px] font-bold rounded uppercase">{loc}</span>) : (typeof (selectedProject as any).locations === 'string' && (selectedProject as any).locations ? <span className="px-2 py-1 bg-zinc-100 text-[10px] font-bold rounded uppercase">{(selectedProject as any).locations}</span> : <p className="font-bold text-zinc-400 text-xs italic">HQ</p>)}</div></div></div>

                {/* Artwork Summary */}
                <div className="mt-4 pt-4 border-t border-zinc-100">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Artwork Summary</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'total', label: 'Total', value: projectArtworkStats.total, bg: 'bg-zinc-100', border: 'border-[#EAEAEA]', text: 'text-zinc-800', subText: 'text-indigo-400', activeBg: 'bg-zinc-200', activeBorder: 'border-zinc-400' },
                      { key: '2D Design', label: '2D Design', value: projectArtworkStats['2D Design'], bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', subText: 'text-blue-400', activeBg: 'bg-blue-100', activeBorder: 'border-blue-400' },
                      { key: '3D Design', label: '3D Design', value: projectArtworkStats['3D Design'], bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', subText: 'text-emerald-400', activeBg: 'bg-emerald-100', activeBorder: 'border-emerald-400' },
                      { key: 'Video', label: 'Video', value: projectArtworkStats['Video'], bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700', subText: 'text-rose-400', activeBg: 'bg-rose-100', activeBorder: 'border-rose-400' },
                    ].map(card => {
                      const isActive = artworkFilter === card.key;
                      return (
                        <div
                          key={card.key}
                          onClick={() => { setArtworkFilter(isActive ? null : card.key); resetArtworkForm(); }}
                          className={`rounded-xl p-3 text-center border cursor-pointer transition-all hover:shadow-sm ${isActive ? `${card.activeBg} ${card.activeBorder} ring-1 ring-offset-1 ring-zinc-300 shadow-sm` : `${card.bg} ${card.border}`
                            }`}
                        >
                          <p className={`text-2xl font-bold leading-none ${card.text}`}>{card.value}</p>
                          <p className={`text-[9px] font-bold uppercase mt-1 tracking-wider ${card.subText}`}>{card.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* INLINE ARTWORK LIST (shown when filter is active) */}
              {artworkFilter && (
                <div className="bg-white p-4 md:p-6 rounded-[20px] border border-[#EAEAEA] shadow-sm lg:col-span-3 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Artwork Logs</h3>
                      <span className="text-[9px] font-bold text-zinc-400 uppercase bg-[#F8F9FA] px-2 py-0.5 rounded border border-[#EAEAEA]">{artworkFilter === 'total' ? 'All Types' : artworkFilter} — {filteredArtworkLogs.length} items</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isAddingArtwork && (
                        <button onClick={() => { resetArtworkForm(); setIsAddingArtwork(true); if (artworkFilter !== 'total') setArtworkFormData(prev => ({ ...prev, artwork_type: artworkFilter! })); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-black transition-colors shadow-sm">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                          Add Artwork
                        </button>
                      )}
                      <button onClick={() => { setArtworkFilter(null); resetArtworkForm(); }} className="p-1.5 rounded-lg hover:bg-[#F8F9FA] text-zinc-400 hover:text-zinc-700 transition-colors" title="Close">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>

                  {/* Add/Edit Form */}
                  {isAddingArtwork && (
                    <div className="bg-[#FCFCFC] p-4 rounded-xl border border-[#EAEAEA] mb-4 animate-in fade-in duration-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div className="col-span-2">
                          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Artwork Name</label>
                          <input type="text" value={artworkFormData.artwork_name || ''} onChange={e => setArtworkFormData(p => ({ ...p, artwork_name: e.target.value }))} className="w-full rounded-lg border border-zinc-300 text-sm p-2.5 font-semibold outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600" placeholder="Design name..." />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Type</label>
                          <select value={artworkFormData.artwork_type || '2D Design'} onChange={e => setArtworkFormData(p => ({ ...p, artwork_type: e.target.value }))} className="w-full rounded-lg border border-zinc-300 text-sm p-2.5 font-semibold outline-none focus:ring-2 focus:ring-indigo-600">
                            <option value="2D Design">2D Design</option>
                            <option value="3D Design">3D Design</option>
                            <option value="Video">Video</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">PIC Designer</label>
                          <select value={artworkFormData.pic_designer_id || ''} onChange={e => setArtworkFormData(p => ({ ...p, pic_designer_id: e.target.value }))} className="w-full rounded-lg border border-zinc-300 text-sm p-2.5 font-semibold outline-none focus:ring-2 focus:ring-indigo-600">
                            {designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                        <div>
                          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Start Date</label>
                          <input type="date" value={artworkFormData.start_date || ''} onChange={e => setArtworkFormData(p => ({ ...p, start_date: e.target.value }))} className="w-full rounded-lg border border-zinc-300 text-sm p-2.5 font-semibold outline-none focus:ring-2 focus:ring-indigo-600" />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">End Date</label>
                          <input type="date" value={artworkFormData.end_date || ''} onChange={e => setArtworkFormData(p => ({ ...p, end_date: e.target.value }))} className="w-full rounded-lg border border-zinc-300 text-sm p-2.5 font-semibold outline-none focus:ring-2 focus:ring-indigo-600" />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Revisions</label>
                          <input type="number" min="0" value={artworkFormData.revision_count || 0} onChange={e => setArtworkFormData(p => ({ ...p, revision_count: parseInt(e.target.value) || 0 }))} onWheel={e => (e.target as HTMLInputElement).blur()} className="w-full rounded-lg border border-zinc-300 text-sm p-2.5 font-semibold outline-none focus:ring-2 focus:ring-indigo-600" />
                        </div>
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={artworkFormData.approval_required || false} onChange={e => setArtworkFormData(p => ({ ...p, approval_required: e.target.checked }))} className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-[10px] font-bold text-zinc-600 uppercase">Approval Required</span>
                          </label>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Notes</label>
                          <input type="text" value={artworkFormData.notes || ''} onChange={e => setArtworkFormData(p => ({ ...p, notes: e.target.value }))} className="w-full rounded-lg border border-zinc-300 text-sm p-2.5 font-semibold outline-none focus:ring-2 focus:ring-indigo-600" placeholder="Optional notes..." />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={resetArtworkForm} className="px-4 py-2 text-xs font-bold text-zinc-500 uppercase hover:text-zinc-700 transition-colors">Cancel</button>
                        <button onClick={handleSaveArtwork} className="px-5 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-black transition-colors shadow-sm">{artworkEditingId ? 'Update' : 'Save'}</button>
                      </div>
                    </div>
                  )}

                  {/* Artwork List Table */}
                  {filteredArtworkLogs.length === 0 && !isAddingArtwork ? (
                    <div className="text-center py-8 text-xs font-bold text-zinc-400 italic border border-dashed border-[#EAEAEA] rounded-xl">
                      No artwork logs found for this filter.
                    </div>
                  ) : filteredArtworkLogs.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-[#EAEAEA]">
                      <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                        <thead className="bg-[#FCFCFC] border-b border-[#EAEAEA]">
                          <tr>
                            <th className="px-3 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Artwork Name</th>
                            <th className="px-3 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider w-24">Type</th>
                            <th className="px-3 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">PIC</th>
                            <th className="px-3 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Start</th>
                            <th className="px-3 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">End</th>
                            <th className="px-3 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider text-center w-14">Rev</th>
                            <th className="px-3 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider text-right w-20"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredArtworkLogs.map(log => {
                            const typeBadge = log.artwork_type === '2D Design' ? 'bg-blue-50 text-blue-700 border-blue-200' : log.artwork_type === '3D Design' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200';
                            return (
                              <tr key={log.id} className="hover:bg-[#FCFCFC] transition-colors group">
                                <td className="px-3 py-2.5">
                                  <span className="font-bold text-zinc-800 text-[11px] uppercase">{log.artwork_name}</span>
                                  {log.notes && <p className="text-[9px] text-zinc-400 font-medium mt-0.5 italic truncate max-w-[200px]">{log.notes}</p>}
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${typeBadge}`}>{log.artwork_type === '2D Design' ? '2D' : log.artwork_type === '3D Design' ? '3D' : 'VDO'}</span>
                                </td>
                                <td className="px-3 py-2.5 text-[10px] font-bold text-zinc-700 uppercase">{getDesignerName(log.pic_designer_id)}</td>
                                <td className="px-3 py-2.5 text-[10px] font-bold text-zinc-600">{log.start_date}</td>
                                <td className="px-3 py-2.5 text-[10px] font-bold text-zinc-600">{log.end_date}</td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="text-[10px] font-bold text-zinc-700">{log.revision_count}</span>
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEditArtwork(log)} className="p-1 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Edit">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                    </button>
                                    <button onClick={() => handleDeleteArtwork(log.id)} className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white p-6 rounded-[20px] border border-[#EAEAEA] shadow-sm h-fit lg:col-span-2 min-h-[350px] flex flex-col"><h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-4 border-b border-zinc-100 pb-2">Notes & Updates</h3><div className="flex-1 flex flex-col"><SimpleRichTextEditor initialValue={selectedProject.notes || ''} onSave={handleNotesUpdate} placeholder="Write project notes here (bold, lists supported)..." /></div></div>

              <div className="bg-white p-6 rounded-[20px] border border-[#EAEAEA] shadow-sm lg:col-span-3">
                <div className="flex justify-between items-center mb-4 border-b border-zinc-100 pb-2">
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Designer Evaluation</h3>
                  <div className="flex items-center gap-2">
                    {!evalEditing ? (
                      <div className="flex gap-2">
                        {designerEvaluations.some(e => e.project_id === selectedProject.id) && (
                          <button onClick={() => handleDeleteEvaluation(selectedProject.id)} className="text-[10px] font-bold text-white uppercase bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors">🗑️ Hapus Evaluasi</button>
                        )}
                        <button onClick={() => {
                          // Initialize form with existing data or empty entries for each designer
                          const projectDesignerIds = [selectedProject.pic_designer_id, ...(selectedProject.support_designer_ids || [])].filter(Boolean) as string[];
                          const existingEvals = designerEvaluations.filter(e => e.project_id === selectedProject.id);
                          const form: Record<string, Partial<DesignerEvaluation>> = {};
                          projectDesignerIds.forEach(did => {
                            const existing = existingEvals.find(e => e.designer_id === did);
                            if (existing) {
                              form[did] = { ...existing };
                            } else {
                              form[did] = { kategori: '', job_title: '', inisiatif: undefined, disiplin: undefined, penyelesaian_tugas: undefined, attitude: undefined, komunikasi: undefined, respon_masukan: undefined, masukan_pengembangan: '' };
                            }
                          });
                          setEvalForm(form);
                          setEvalEvaluatorName(existingEvals[0]?.evaluator_name || '');
                          setEvalEditing(true);
                          setAiError(null);
                        }} className="text-[10px] font-bold text-white uppercase bg-zinc-900 hover:bg-black px-3 py-1.5 rounded-lg transition-colors">✏️ Edit Evaluasi</button>
                      </div>
                    ) : (
                      <button onClick={() => setEvalEditing(false)} className="text-[10px] font-bold text-zinc-500 uppercase hover:text-zinc-700 px-3 py-1.5 rounded-lg border border-[#EAEAEA] transition-colors">Batal</button>
                    )}
                  </div>
                </div>

                {!evalEditing ? (
                  (() => {
                    // Only show evaluations for designers that belong to this project
                    const projectDesignerIds = new Set([selectedProject.pic_designer_id, ...(selectedProject.support_designer_ids || [])].filter(Boolean));
                    const evals = designerEvaluations.filter(e => e.project_id === selectedProject.id && projectDesignerIds.has(e.designer_id));
                    if (evals.length === 0) {
                      return (
                        <div className="p-8 bg-[#FCFCFC] rounded-xl border border-dashed border-zinc-300 text-center">
                          <p className="text-xs font-bold text-zinc-400 italic mb-2">Belum ada evaluasi designer.</p>
                          <p className="text-[10px] text-zinc-400">Klik Edit Evaluasi untuk mengisi evaluasi designer.</p>
                        </div>
                      );
                    }

                    const calcAvg = (ev: DesignerEvaluation) => {
                      const scores = EVAL_CRITERIA.map(c => (ev as any)[c.key] || 0).filter((v: number) => v > 0);
                      return scores.length > 0 ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : '-';
                    };

                    const getScoreColor = (score: number) => {
                      if (score >= 4) return 'bg-emerald-100 text-emerald-700';
                      if (score >= 3) return 'bg-blue-100 text-blue-700';
                      if (score >= 2) return 'bg-amber-100 text-amber-700';
                      return 'bg-red-100 text-red-700';
                    };

                    return (
                      <div className="space-y-4">
                        {evals[0]?.evaluator_name && (
                          <div className="bg-zinc-100 border border-[#EAEAEA] p-3 rounded-lg flex justify-between items-center">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Evaluator</span>
                            <span className="text-sm font-bold text-black uppercase">{evals[0].evaluator_name}</span>
                          </div>
                        )}
                        <div className="overflow-x-auto rounded-xl border border-[#EAEAEA]">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-[#FCFCFC] border-b border-[#EAEAEA]">
                              <tr>
                                <th className="px-3 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Designer</th>
                                <th className="px-3 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Kategori</th>
                                <th className="px-3 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Job Title</th>
                                {EVAL_CRITERIA.map(c => (
                                  <th key={c.key} className="px-2 py-2.5 text-[8px] font-bold text-zinc-500 uppercase tracking-wider text-center w-16">{c.label}</th>
                                ))}
                                <th className="px-3 py-2.5 text-[9px] font-bold text-zinc-900 uppercase tracking-wider text-center w-16">Rata²</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {evals.map(ev => {
                                const designerName = designers.find(d => d.id === ev.designer_id)?.name || 'Unknown';
                                const avg = calcAvg(ev);
                                return (
                                  <tr key={ev.id} className="hover:bg-[#FCFCFC] transition-colors">
                                    <td className="px-3 py-3">
                                      <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-zinc-1000"></span>
                                        <span className="font-bold text-zinc-800 uppercase text-[11px]">{designerName}</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-3 text-[10px] font-bold text-zinc-600">{ev.kategori || '-'}</td>
                                    <td className="px-3 py-3 text-[10px] font-bold text-zinc-600">{ev.job_title || '-'}</td>
                                    {EVAL_CRITERIA.map(c => {
                                      const score = (ev as any)[c.key];
                                      return (
                                        <td key={c.key} className="px-2 py-3 text-center">
                                          {score ? (
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${getScoreColor(score)}`}>{score}</span>
                                          ) : (
                                            <span className="text-zinc-300">-</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-3 text-center">
                                      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-zinc-800 border border-indigo-200">{avg}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {/* Show masukan pengembangan per designer */}
                        {evals.filter(ev => ev.masukan_pengembangan).length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Masukan Pengembangan Diri</h4>
                            {evals.filter(ev => ev.masukan_pengembangan).map(ev => {
                              const designerName = designers.find(d => d.id === ev.designer_id)?.name || 'Unknown';
                              return (
                                <div key={ev.id} className="bg-[#FCFCFC] p-3 rounded-lg border border-zinc-100">
                                  <span className="text-[9px] font-bold text-zinc-900 uppercase">{designerName}</span>
                                  <p className="text-xs text-zinc-600 mt-1 italic">"{ev.masukan_pengembangan}"</p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })())
                  : (
                    /* --- EDIT MODE --- */
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!supabase || !selectedProject) return;
                      setEvalSubmitting(true);
                      try {
                        const entries = Object.entries(evalForm);
                        const payloads = entries.map(([designerId, ev]) => ({
                          project_id: selectedProject.id,
                          designer_id: designerId,
                          evaluator_name: evalEvaluatorName,
                          kategori: ev.kategori || null,
                          job_title: ev.job_title || null,
                          inisiatif: ev.inisiatif || null,
                          disiplin: ev.disiplin || null,
                          penyelesaian_tugas: ev.penyelesaian_tugas || null,
                          attitude: ev.attitude || null,
                          komunikasi: ev.komunikasi || null,
                          respon_masukan: ev.respon_masukan || null,
                          masukan_pengembangan: ev.masukan_pengembangan || null,
                        }));
                        const { error } = await supabase.from('designer_evaluations').upsert(payloads, { onConflict: 'project_id,designer_id' });
                        if (error) throw error;
                        setEvalEditing(false);
                        onUpdate();
                      } catch (err: any) {
                        alert(`Error: ${err.message}`);
                      } finally {
                        setEvalSubmitting(false);
                      }
                    }} className="space-y-4">
                      {/* AI Scan Button */}
                      {GEMINI_API_KEY && (
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-purple-50 p-4 rounded-xl border border-purple-100">
                          <div>
                            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">AI Auto-Fill</span>
                            <p className="text-[9px] text-purple-400 font-medium mt-0.5">Upload screenshot tabel evaluasi Excel untuk mengisi otomatis</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => evalFileInputRef.current?.click()}
                            disabled={aiProcessing}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide border shadow-sm transition-all flex-shrink-0 ${aiProcessing
                              ? 'bg-purple-100 border-purple-200 text-purple-400 cursor-wait'
                              : 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] active:scale-95'
                              }`}
                          >
                            {aiProcessing ? (
                              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Scanning...</>
                            ) : (
                              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> 📷 Scan Screenshot (AI)</>
                            )}
                          </button>
                          <input ref={evalFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAIScan} />
                        </div>
                      )}
                      {aiError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">{aiError}</div>
                      )}

                      {/* Evaluator Name */}
                      <div className="bg-[#FCFCFC] p-4 rounded-xl border border-zinc-100">
                        <label className="text-[10px] font-bold text-zinc-900 uppercase tracking-wide mb-2 block">Nama Pemberi Evaluasi</label>
                        <input type="text" placeholder="Tulis nama evaluator..." value={evalEvaluatorName} onChange={e => setEvalEvaluatorName(e.target.value)} className="w-full p-2.5 rounded-lg border border-zinc-300 text-sm font-bold outline-none focus:border-zinc-900 focus:ring-2 focus:ring-indigo-200 transition-all" />
                      </div>

                      {/* Per-Designer Evaluation Table */}
                      <div className="overflow-x-auto rounded-xl border border-[#EAEAEA]">
                        <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                          <thead className="bg-[#FCFCFC] border-b border-[#EAEAEA]">
                            <tr>
                              <th className="px-3 py-3 text-[9px] font-bold text-zinc-500 uppercase tracking-wider sticky left-0 bg-[#FCFCFC] z-10 min-w-[120px]">Designer</th>
                              <th className="px-3 py-3 text-[9px] font-bold text-zinc-500 uppercase tracking-wider min-w-[100px]">Kategori</th>
                              <th className="px-3 py-3 text-[9px] font-bold text-zinc-500 uppercase tracking-wider min-w-[100px]">Job Title</th>
                              {EVAL_CRITERIA.map(c => (
                                <th key={c.key} className="px-2 py-3 text-[8px] font-bold text-zinc-500 uppercase tracking-wider text-center w-[70px]">{c.label}</th>
                              ))}
                              <th className="px-3 py-3 text-[9px] font-bold text-zinc-900 uppercase tracking-wider text-center w-[60px]">Rata²</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {Object.entries(evalForm).map(([designerId, ev]) => {
                              const designerName = designers.find(d => d.id === designerId)?.name || 'Unknown';
                              const scores = EVAL_CRITERIA.map(c => (ev as any)[c.key] || 0).filter((v: number) => v > 0);
                              const avg = scores.length > 0 ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : '-';
                              return (
                                <tr key={designerId} className="hover:bg-[#FCFCFC] transition-colors">
                                  <td className="px-3 py-3 sticky left-0 bg-white z-10">
                                    <div className="flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-zinc-1000 flex-shrink-0"></span>
                                      <span className="font-bold text-zinc-800 uppercase text-[11px]">{designerName}</span>
                                    </div>
                                  </td>
                                  <td className="px-2 py-2">
                                    <input type="text" placeholder="Kategori" value={ev.kategori || ''} onChange={e => handleEvalFieldChange(designerId, 'kategori', e.target.value)} className="w-full px-2 py-1.5 rounded border border-[#EAEAEA] text-[11px] font-bold outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
                                  </td>
                                  <td className="px-2 py-2">
                                    <input type="text" placeholder="Job Title" value={ev.job_title || ''} onChange={e => handleEvalFieldChange(designerId, 'job_title', e.target.value)} className="w-full px-2 py-1.5 rounded border border-[#EAEAEA] text-[11px] font-bold outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
                                  </td>
                                  {EVAL_CRITERIA.map(c => (
                                    <td key={c.key} className="px-1 py-2 text-center">
                                      <input
                                        type="number"
                                        min="1" max="5" step="0.5"
                                        placeholder="-"
                                        value={(ev as any)[c.key] || ''}
                                        onChange={e => handleEvalFieldChange(designerId, c.key, parseFloat(e.target.value) || undefined)}
                                        onWheel={e => (e.target as HTMLInputElement).blur()}
                                        className="w-[50px] px-1 py-1.5 rounded border border-[#EAEAEA] text-[11px] font-bold text-center outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-white"
                                      />
                                    </td>
                                  ))}
                                  <td className="px-3 py-2 text-center">
                                    <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-zinc-800 border border-indigo-200">{avg}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Masukan Pengembangan per Designer */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Masukan Pengembangan Diri</h4>
                        {Object.entries(evalForm).map(([designerId, ev]) => {
                          const designerName = designers.find(d => d.id === designerId)?.name || 'Unknown';
                          return (
                            <div key={designerId} className="bg-[#FCFCFC] p-3 rounded-xl border border-zinc-100">
                              <label className="text-[9px] font-bold text-zinc-900 uppercase tracking-wide block mb-1.5">{designerName}</label>
                              <textarea rows={2} placeholder="Masukan untuk pengembangan diri designer ini..." value={ev.masukan_pengembangan || ''} onChange={e => handleEvalFieldChange(designerId, 'masukan_pengembangan', e.target.value)} className="w-full p-2.5 rounded-lg border border-[#EAEAEA] text-xs font-medium outline-none focus:border-zinc-900 focus:ring-1 focus:ring-indigo-200 transition-colors" />
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-end">
                        <button type="submit" disabled={evalSubmitting} className="px-6 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wide bg-zinc-900 text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                          {evalSubmitting ? '⏳ Saving...' : '💾 Simpan'}
                        </button>
                      </div>
                    </form>
                  )}
              </div>
            </div>
          )}

          {activeTab === 'checklist' && (
            <div className="grid grid-cols-1 gap-6 animate-in fade-in duration-300">
              <div className="bg-white p-4 rounded-xl border border-[#EAEAEA] shadow-sm flex items-center gap-4 flex-wrap"><div className="flex items-center gap-2"><span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Templates:</span><button onClick={() => setIsManageTemplatesOpen(true)} className="text-[10px] font-bold text-zinc-900 underline hover:text-indigo-800">Manage</button></div><div className="h-6 w-px bg-[#FAFAFA]200 mx-2"></div><div className="flex flex-wrap gap-2">{checklistTemplates.map(t => { const isActive = activeTemplatesSet.has(t.id); return (<button key={t.id} onClick={() => handleToggleTemplate(t.id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${isActive ? 'bg-zinc-900 border-indigo-600 text-white shadow-md' : 'bg-[#FCFCFC] border-[#EAEAEA] text-zinc-600 hover:border-indigo-300'}`}> {t.name} {isActive && '✓'} </button>); })} {checklistTemplates.length === 0 && <span className="text-[10px] text-zinc-400 italic">No templates available. Create one in 'Manage'.</span>} </div></div>
              <div className="bg-white rounded-lg border border-[#EAEAEA] shadow-sm overflow-hidden"><table className="w-full text-left text-xs border-collapse"><thead className="bg-[#FCFCFC] border-b border-[#EAEAEA]"><tr><th className="px-3 py-2.5 text-center w-10 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">#</th><th className="px-3 py-2.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Design Spec</th><th className="px-3 py-2.5 w-32 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Size</th><th className="px-3 py-2.5 text-center w-16 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Qty</th><th className="px-3 py-2.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Notes</th><th className="px-3 py-2.5 w-32 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Status</th><th className="px-3 py-2.5 text-right w-16 text-[10px] font-bold text-zinc-500 uppercase tracking-wider"></th></tr></thead><tbody className="text-zinc-700">{sortedActiveTemplateIds.map(templateId => { const items = groupedChecklists.groups[templateId] || []; const templateName = checklistTemplates.find(t => t.id === templateId)?.name || 'Unknown Template'; const newItemState = newItemsMap[templateId] || { task_name: '', size: '', quantity: 1, notes: '' }; return (<React.Fragment key={templateId}> <tr className="bg-zinc-100 border-y border-[#EAEAEA]"> <td colSpan={7} className="px-3 py-1.5"> <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-2"> <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> {templateName} </span> </td> </tr> {items.map((cl, idx) => (<TableRow key={cl.id} cl={cl} idx={idx} cellInputClass={cellInputClass} onUpdate={handleUpdateChecklistField} onDelete={handleDeleteChecklist} />))} <AddRow newItem={newItemState} updateNewItem={(field: any, val: any) => updateNewItemState(templateId, field, val)} onAdd={() => handleAddNewItem(templateId)} newRowInputClass={newRowInputClass} /> </React.Fragment>); })} <React.Fragment key="manual"> <tr className="bg-[#F8F9FA] border-y border-[#EAEAEA]"> <td colSpan={7} className="px-3 py-1.5"> <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2"> <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Additional / Manual Items </span> </td> </tr> {groupedChecklists.manualItems.map((cl, idx) => (<TableRow key={cl.id} cl={cl} idx={idx} cellInputClass={cellInputClass} onUpdate={handleUpdateChecklistField} onDelete={handleDeleteChecklist} />))} <AddRow newItem={newItemsMap['manual'] || { task_name: '', size: '', quantity: 1, notes: '' }} updateNewItem={(field: any, val: any) => updateNewItemState(null, field, val)} onAdd={() => handleAddNewItem(null)} newRowInputClass={newRowInputClass} /> </React.Fragment> </tbody></table></div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 flex flex-col h-full relative">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0"><div><h1 className="text-2xl font-bold text-zinc-900 tracking-tight uppercase">Project Master</h1><p className="text-zinc-600 text-sm mt-1 font-bold">Manage event project timelines.</p></div><div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
        <button onClick={handleCopyChecklistLink} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 border ${copySuccess ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-zinc-300 text-zinc-700 hover:border-zinc-900'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>{copySuccess ? 'Checklist Link Copied!' : 'Checklist Link'}</button><div className="flex bg-[#FAFAFA] p-1 rounded-xl"><button onClick={() => setView('list')} className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`} title="List View"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg></button><button onClick={() => setView('board')} className={`p-2 rounded-lg transition-all ${view === 'board' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`} title="Board View"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" /><path d="M9 3v18M15 3v18" strokeWidth="2" /></svg></button><button onClick={() => setView('calendar')} className={`p-2 rounded-lg transition-all ${view === 'calendar' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`} title="Calendar View"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" /><path d="M16 2v4M8 2v4M3 10h18" strokeWidth="2" /></svg></button><button onClick={() => setView('evaluation')} className={`p-2 rounded-lg transition-all ${view === 'evaluation' ? 'bg-yellow-500 text-white shadow-sm' : 'bg-transparent text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700'}`} title="Evaluation View"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 8V6a2 2 0 00-2-2H7a2 2 0 00-2 2v2M5 8h14a2 2 0 012 2v2a5 5 0 01-5 5H8a5 5 0 01-5-5v-2a2 2 0 012-2zm7 9v4m-4 0h8" /></svg></button></div>{!isAdding && (<button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-bold shadow-sm border border-[#EAEAEA]">Add Project</button>)}</div></header>

      {view === 'evaluation' ? (
        <div className="flex-1 bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm overflow-hidden p-6 animate-in slide-in-from-bottom-2 duration-300">
          <ProjectEvaluationView
            projects={projects}
            designers={designers}
            designerEvaluations={designerEvaluations || []}
            getDesignerName={getDesignerName}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {/* Card 1: Project Overview */}
            <div className="bg-white p-3 md:p-5 rounded-[16px] md:rounded-[20px] border border-[#EAEAEA] shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Total Projects</span>
                  <div className="text-xl md:text-3xl font-bold text-zinc-900">{dashboardStats.totalProjects}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Avg Team Size</span>
                  <div className="text-xl font-bold text-zinc-900">{dashboardStats.avgTeamSize} <span className="text-[10px] text-zinc-400 font-bold">Orang</span></div>
                </div>
              </div>
              <div className="flex gap-2 text-[10px] font-bold mt-2 uppercase">
                <span className="flex-1 text-center text-blue-600 border px-1.5 py-1.5 rounded-lg bg-blue-50 border-blue-200" title="ON PROGRESS">{dashboardStats.byStatus['ON PROGRESS']} PROG</span>
                <span className="flex-1 text-center text-amber-600 border px-1.5 py-1.5 rounded-lg bg-amber-50 border-amber-200" title="ON HOLD">{dashboardStats.byStatus['ON HOLD']} HOLD</span>
                <span className="flex-1 text-center text-emerald-600 border px-1.5 py-1.5 rounded-lg bg-emerald-50 border-emerald-200" title="DONE">{dashboardStats.byStatus['DONE']} DONE</span>
              </div>
            </div>

            {/* Card 2: Evaluation Score */}
            <div className="bg-white p-3 md:p-5 rounded-[16px] md:rounded-[20px] border border-[#EAEAEA] shadow-sm md:col-span-2">
              <div className="flex flex-col md:flex-row gap-6 h-full items-center">
                {/* Left side: Avg Score & Evaluated Count */}
                <div className="flex flex-col justify-center min-w-[140px] pr-6 md:border-r border-[#EAEAEA]">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 text-center md:text-left">Avg Score</span>
                  <div className="text-4xl font-bold text-zinc-900 tracking-tight text-center md:text-left">{dashboardStats.avgScore} <span className="text-sm text-zinc-400 font-bold">/5</span></div>
                  <div className="text-[10px] font-bold text-zinc-500 uppercase mt-2 text-center md:text-left bg-[#F8F9FA] px-2 py-1.5 rounded-lg inline-block self-center md:self-start border border-[#EAEAEA]">
                    {dashboardStats.evaluatedProjectsCount} / {dashboardStats.doneCount} Evaluated
                  </div>
                </div>

                {/* Right side: Detailed scores */}
                <div className="flex-1 w-full flex flex-col justify-center">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mt-2 md:mt-0">
                    {EVAL_CRITERIA.map(c => {
                      const shortLabel = c.key === 'penyelesaian_tugas' ? 'Tugas' : c.key === 'respon_masukan' ? 'Feedback' : c.label;
                      const score = parseFloat(dashboardStats.detailAverages[c.key]);
                      const colorClass = score >= 4.5 ? 'text-emerald-700' : score >= 3.5 ? 'text-indigo-700' : score > 0 ? 'text-rose-700' : 'text-zinc-500';
                      const bgClass = score >= 4.5 ? 'bg-emerald-50 border-emerald-100' : score >= 3.5 ? 'bg-indigo-50 border-indigo-100' : score > 0 ? 'bg-rose-50 border-rose-100' : 'bg-[#FCFCFC] border-[#EAEAEA]';
                      return (
                        <div key={c.key} className={`flex justify-between items-center text-[9px] rounded-lg px-2.5 py-2 border shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${bgClass}`}>
                          <span className="text-zinc-600 uppercase font-bold tracking-tight truncate pr-2" title={c.label}>{shortLabel}</span>
                          <span className={`text-xs font-bold ${colorClass}`}>{dashboardStats.detailAverages[c.key]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#F8F9FA] p-4 rounded-[20px] flex flex-wrap items-center gap-4 border border-[#EAEAEA]">{[['Status', filterStatus, setFilterStatus, ['ALL', 'ON PROGRESS', 'ON HOLD', 'DONE']], ['Type', filterType, setFilterType, ['ALL', 'EVENT', 'TRAVEL', 'WELLNESS', 'CREATIVE', 'TRAINING']], ['PIC', filterPIC, setFilterPIC, ['ALL', ...designers.map(d => d.id)]], ['Location', filterLocation, setFilterLocation, ['ALL', ...uniqueLocations]]].map(([lbl, val, set, opts]: any) => (<div key={lbl as string} className="flex flex-col gap-1"><span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider px-1">{lbl as string}</span><select value={val as string} onChange={e => (set as any)(e.target.value)} className="text-[10px] font-bold border-[#EAEAEA] rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500 uppercase tracking-tight cursor-pointer">{opts.map((o: any) => <option key={o} value={o}>{o === 'ALL' ? `All ${lbl}` : (lbl === 'PIC' ? getDesignerName(o) : o)}</option>)}</select></div>))}</div>
          {isAdding && (<form onSubmit={handleSave} className="bg-white p-8 rounded-[20px] border border-[#EAEAEA] shadow-sm border border-[#EAEAEA] animate-in zoom-in duration-200 flex-shrink-0 mb-6"><h2 className="font-bold text-zinc-900 mb-8 uppercase tracking-tight flex items-center gap-2"><span className="w-2 h-2 bg-zinc-900 rounded-full"></span>{editingId ? 'Edit Project' : 'New Project'}</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8"><div className="md:col-span-2"><label className={labelClass}>Project Name</label><input type="text" required value={formData.project_name} onChange={e => setFormData({ ...formData, project_name: e.target.value })} className={inputClass} placeholder="Annual Event 2024" /></div><div><label className={labelClass}>Status</label><select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })} className={inputClass}><option value="ON PROGRESS">ON PROGRESS</option><option value="ON HOLD">ON HOLD</option><option value="DONE">DONE</option></select></div><div><label className={labelClass}>Project Type</label><select value={formData.project_type} onChange={e => setFormData({ ...formData, project_type: e.target.value })} className={inputClass}><option value="EVENT">EVENT</option><option value="TRAVEL">TRAVEL</option><option value="WELLNESS">WELLNESS</option><option value="CREATIVE">CREATIVE</option><option value="TRAINING">TRAINING</option></select></div><div><label className={labelClass}>Start Date</label><input type="date" required value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>End Date</label><input type="date" required value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} className={inputClass} /></div><div className="md:col-span-1"><label className={labelClass}>Locations</label><div className="flex gap-2 mb-2"><input type="text" list="loc-suggestions" placeholder="Pilih/Ketik..." value={newLocInput} onChange={e => setNewLocInput(e.target.value)} className={inputClass} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLocation())} /><button type="button" onClick={addLocation} className="px-5 bg-[#1A1C20] text-white rounded-lg text-sm font-bold uppercase tracking-wider">ADD</button></div><div className="flex flex-wrap gap-2 p-3 bg-[#FCFCFC] border border-[#EAEAEA] rounded-xl min-h-[58px] items-center">{formData.locations?.map(loc => (<span key={loc} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-zinc-300 text-zinc-800 rounded-lg text-[10px] font-bold uppercase shadow-sm">{loc}<button type="button" onClick={() => removeLocation(loc)} className="text-red-500"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></button></span>))}</div><datalist id="loc-suggestions">{uniqueLocations.map(loc => <option key={loc} value={loc} />)}</datalist></div><div><label className={labelClass}>PIC Designer</label><select value={formData.pic_designer_id} onChange={e => setFormData({ ...formData, pic_designer_id: e.target.value })} className={inputClass}>{designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div><div className="md:col-span-1"><label className={labelClass}>Support Designers</label><div className="flex flex-wrap gap-2 p-3 bg-[#FCFCFC] border border-[#EAEAEA] rounded-xl min-h-[58px]">{designers.map(d => { if (d.id === formData.pic_designer_id) return null; const isSelected = formData.support_designer_ids?.includes(d.id); return (<button key={d.id} type="button" onClick={() => toggleSupportDesigner(d.id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${isSelected ? 'bg-zinc-900 border-indigo-600 text-white shadow-md' : 'bg-white border-zinc-300 text-zinc-500 hover:border-indigo-400'}`}>{d.name}</button>); })}</div></div><div className="md:col-span-3"><label className={labelClass}>Notes / Keterangan</label><SimpleRichTextEditor initialValue={formData.notes || ''} onSave={(val) => setFormData({ ...formData, notes: val })} placeholder="Catatan project (bisa format list, bold, dll)..." /></div></div><div className="flex justify-end gap-4 pt-6 border-t border-zinc-100"><button type="button" onClick={resetForm} className="px-6 py-2.5 text-sm font-bold text-zinc-700 uppercase">Cancel</button><button type="submit" className="px-8 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-bold shadow-sm border border-[#EAEAEA] uppercase tracking-wider">{editingId ? 'Update' : 'Save'}</button></div></form>)}
          <div className="flex-1 min-h-0">{view === 'list' ? (<div className="bg-white rounded-[16px] md:rounded-[20px] border border-[#EAEAEA] shadow-sm overflow-hidden flex flex-col h-full"><div className="overflow-auto max-h-full"><table className="w-full text-left text-[10px] md:text-sm border-collapse min-w-[420px] md:min-w-0"><thead className="sticky top-0 z-10 bg-[#F8F9FA] font-bold uppercase text-[9px] md:text-[10px] tracking-wider border-b border-[#EAEAEA]"><tr><th className="px-2 md:px-6 py-2.5 md:py-4">Name & Status</th><th className="px-2 md:px-6 py-2.5 md:py-4">Timeline</th><th className="px-2 md:px-6 py-2.5 md:py-4">PIC</th><th className="px-2 md:px-6 py-2.5 md:py-4 text-right">Act</th></tr></thead><tbody className="divide-y divide-slate-200 font-bold text-zinc-900">{filteredProjects.map(p => { const locs = (p as any).locations || (p as any).location || []; const normalizedLocs = Array.isArray(locs) ? locs : [locs]; return (<tr key={p.id} onClick={() => { setSelectedProject(p); setActiveTab('details'); }} className="hover:bg-[#FCFCFC] transition-colors cursor-pointer"><td className="px-2 md:px-6 py-2 md:py-4"><div className="flex flex-col gap-1"><span className={`px-1.5 md:px-2 py-0.5 rounded-full text-[7px] md:text-[8px] font-bold uppercase self-start ${getStatusBadge(p.status).replace('border', '')}`}>{p.status}</span><span className="font-bold uppercase text-[10px] md:text-sm leading-tight">{p.project_name}</span></div></td><td className="px-2 md:px-6 py-2 md:py-4"><div className="flex flex-col"><span className="text-[9px] md:text-[11px] font-bold">{p.start_date} → {p.end_date}</span><div className="flex flex-wrap gap-1 mt-0.5">{normalizedLocs.map(l => <span key={l} className="text-[7px] md:text-[8px] bg-[var(--s3)] text-[var(--ink-2)] px-1.5 py-0.5 rounded uppercase font-bold border-none">{l}</span>)}</div></div></td><td className="px-2 md:px-6 py-2 md:py-4"><div className="flex flex-col gap-1"><div className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-zinc-900 rounded-full"></span><span className="text-[9px] md:text-xs uppercase">{getDesignerName(p.pic_designer_id)}</span></div><div className="flex flex-wrap gap-0.5 md:gap-1">{p.support_designer_ids?.map(sid => (<span key={sid} className="px-1.5 py-0.5 bg-[var(--s3)] text-[var(--ink-4)] text-[7px] md:text-[8px] rounded uppercase font-bold border-none">{getDesignerName(sid)}</span>))}</div></div></td><td className="px-2 md:px-6 py-2 md:py-4 text-right"><div className="flex justify-end gap-1.5 md:gap-4"><button onClick={(e) => { e.stopPropagation(); handleEdit(p); }} className="text-zinc-800 p-1 rounded hover:bg-zinc-100" title="Edit"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" /></svg></button><button onClick={(e) => { e.stopPropagation(); handleDelete(e, p.id); }} className="text-red-500 p-1 rounded hover:bg-red-50" title="Delete"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></td></tr>); })}</tbody></table></div></div>) : view === 'board' ? (
            <div className="h-full flex flex-col pt-2 border-t border-[#EAEAEA] overflow-hidden">
              <div className="flex items-center gap-3 mb-4 shrink-0 flex-wrap">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Group By:</span>
                <div className="flex bg-[#FAFAFA]200 p-1 rounded-xl">
                  {[
                    { id: 'status', label: 'Status' },
                    { id: 'type', label: 'Type' },
                    { id: 'pic', label: 'PIC Designer' },
                    { id: 'location', label: 'Location' }
                  ].map(opt => (
                    <button key={opt.id} onClick={() => setBoardGroup(opt.id as any)} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${boardGroup === opt.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-x-auto flex gap-6 pb-4 items-start custom-scrollbar">
                {Object.keys(projectBoardGroups).sort().map((groupKey, idx) => {
                  const headerColors = [
                    'border-t-blue-500 bg-blue-50 text-blue-900',
                    'border-t-emerald-500 bg-emerald-50 text-emerald-900',
                    'border-t-purple-500 bg-purple-50 text-purple-900',
                    'border-t-amber-500 bg-amber-50 text-amber-900',
                    'border-t-rose-500 bg-rose-50 text-rose-900',
                    'border-t-cyan-500 bg-cyan-50 text-cyan-900',
                    'border-t-indigo-500 bg-indigo-50 text-indigo-900'
                  ];
                  const theme = headerColors[idx % headerColors.length];
                  return (
                    <div key={groupKey} className="w-64 md:w-80 flex-shrink-0 bg-zinc-50/50 rounded-2xl flex flex-col max-h-full border border-zinc-100 shadow-sm">
                      <div className={`p-4 border-b border-zinc-100 border-t-4 uppercase tracking-tight font-bold text-sm flex justify-between items-center rounded-t-2xl shrink-0 ${theme}`}>
                        <span className="truncate pr-2">{groupKey}</span>
                        <span className="bg-white/60 text-current text-[10px] px-2 py-0.5 rounded-full">{projectBoardGroups[groupKey].length}</span>
                      </div>
                      <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                        {projectBoardGroups[groupKey].map(p => {
                          const locs = (p as any).locations || (p as any).location || [];
                          const normalizedLocs = Array.isArray(locs) ? locs : [locs];
                          return (
                            <div key={p.id} onClick={() => { setSelectedProject(p); setActiveTab('details'); }} className="bg-white p-4 rounded-xl shadow-sm border border-[#EAEAEA] cursor-pointer hover:shadow-md transition-shadow group">
                              <div className="flex justify-between items-start mb-2">
                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase ${getStatusBadge(p.status).replace('border', '')}`}>{p.status}</span>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={(e) => { e.stopPropagation(); handleEdit(p); }} className="text-zinc-400 hover:text-indigo-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" /></svg></button>
                                </div>
                              </div>
                              <h4 className="font-bold text-zinc-900 text-sm uppercase leading-tight mb-2 tracking-tight line-clamp-2" title={p.project_name}>{p.project_name}</h4>
                              <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-zinc-50">
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-zinc-400 font-bold uppercase">Timeline</span>
                                  <span className="text-zinc-800 font-bold tracking-tight">{p.start_date.slice(5)} to {p.end_date.slice(5)}</span>
                                </div>
                                <div className="flex justify-between text-[10px] items-center">
                                  <span className="text-zinc-400 font-bold uppercase">PIC Lead</span>
                                  <div className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-zinc-800 rounded-full"></span>
                                    <span className="text-zinc-800 font-bold uppercase truncate max-w-[100px]">{getDesignerName(p.pic_designer_id)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (<div className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm overflow-hidden h-full flex flex-col"><div className="p-4 border-b border-[#EAEAEA] bg-[#FCFCFC] flex items-center justify-between"><h3 className="font-bold text-zinc-900 text-sm uppercase">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3><div className="flex gap-2"><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1.5 hover:bg-[#FAFAFA]300 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg></button><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1.5 hover:bg-[#FAFAFA]300 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg></button></div></div><div className="overflow-y-auto flex-1"><div className="grid grid-cols-7 border-l border-[#EAEAEA]">{renderCalendar()}</div></div></div>)}</div>
        </>
      )}
    </div>
  );
};
