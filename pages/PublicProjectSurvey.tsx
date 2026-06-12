
import React, { useState, useEffect, useMemo, useRef, ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Project, ProjectChecklist, ChecklistTemplate, ChecklistTemplateItem, ProjectSurvey, Designer, DesignerEvaluation } from '../types';
import { supabase } from '../lib/supabase';
import { SURVEY_FORM_SECRET } from '../data/mockData';
import { Dropdown } from '../components/Dropdown';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

const EVAL_CRITERIA = [
  { key: 'inisiatif', label: 'Inisiatif' },
  { key: 'disiplin', label: 'Disiplin' },
  { key: 'penyelesaian_tugas', label: 'Penyelesaian Tugas' },
  { key: 'attitude', label: 'Attitude' },
  { key: 'komunikasi', label: 'Komunikasi' },
  { key: 'respon_masukan', label: 'Respon Terhadap Masukan' },
];

interface TableRowProps {
  cl: ProjectChecklist;
  idx: number;
  isEditable: boolean;
  cellInputClass: string;
  handleLocalChange: (id: string, field: keyof ProjectChecklist, value: any) => void;
  handleSaveItem: (id: string, field: keyof ProjectChecklist, value: any) => void;
  handleDeleteItem: (id: string) => void;
}

const TableRow: React.FC<TableRowProps> = ({ cl, idx, isEditable, cellInputClass, handleLocalChange, handleSaveItem, handleDeleteItem }) => (
  <tr key={cl.id} className="hover:bg-[#FCFCFC] transition-colors group border-b border-zinc-50 last:border-0">
    <td className="px-6 py-2 text-center text-zinc-400">{idx + 1}</td>
    <td className="px-6 py-2">
      <div className="flex items-center gap-2">
        <input
          className={cellInputClass}
          value={cl.task_name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleLocalChange(cl.id, 'task_name', e.target.value)}
          onBlur={(e: ChangeEvent<HTMLInputElement>) => handleSaveItem(cl.id, 'task_name', e.target.value)}
          readOnly={!isEditable}
          placeholder="Task Name"
        />
      </div>
    </td>
    <td className="px-6 py-2">
      <input
        className={cellInputClass}
        value={cl.size || ''}
        onChange={(e: ChangeEvent<HTMLInputElement>) => handleLocalChange(cl.id, 'size', e.target.value)}
        onBlur={(e: ChangeEvent<HTMLInputElement>) => handleSaveItem(cl.id, 'size', e.target.value)}
        readOnly={!isEditable}
        placeholder="Size"
      />
    </td>
    <td className="px-6 py-2 text-center">
      <input
        type="number"
        className={`${cellInputClass} text-center`}
        value={cl.quantity}
        onChange={(e: ChangeEvent<HTMLInputElement>) => handleLocalChange(cl.id, 'quantity', parseInt(e.target.value) || 0)}
        onBlur={(e: ChangeEvent<HTMLInputElement>) => handleSaveItem(cl.id, 'quantity', parseInt(e.target.value) || 0)}
        readOnly={!isEditable}
      />
    </td>
    <td className="px-6 py-2">
      <input
        className={cellInputClass}
        value={cl.notes || ''}
        onChange={(e: ChangeEvent<HTMLInputElement>) => handleLocalChange(cl.id, 'notes', e.target.value)}
        onBlur={(e: ChangeEvent<HTMLInputElement>) => handleSaveItem(cl.id, 'notes', e.target.value)}
        readOnly={!isEditable}
        placeholder="Notes"
      />
    </td>
    <td className="px-6 py-2">
      {isEditable ? (
        <div className="w-full min-w-[120px]">
          <Dropdown
            value={cl.status}
            onChange={(val) => {
              handleLocalChange(cl.id, 'status', val);
              handleSaveItem(cl.id, 'status', val);
            }}
            options={[
              { value: 'NONE', label: 'Not Started' },
              { value: 'ON PROGRESS', label: 'On Progress' },
              { value: 'DONE', label: 'Done' }
            ]}
          />
        </div>
      ) : (
        <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded border ${cl.status === 'DONE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
          cl.status === 'ON PROGRESS' ? 'bg-amber-100 text-amber-700 border-amber-200' :
            'bg-[#F8F9FA] text-zinc-500 border-[#EAEAEA]'
          }`}>
          {cl.status}
        </span>
      )}
    </td>
    <td className="px-6 py-2 text-right">
      {isEditable && (
        <button onClick={() => handleDeleteItem(cl.id)} className="text-zinc-300 hover:text-red-500 p-1 transition-colors opacity-0 group-hover:opacity-100">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      )}
    </td>
  </tr>
);

interface AddRowProps {
  newItem: { task_name: string; size: string; quantity: number; notes: string };
  updateNewItem: (field: string, val: any) => void;
  onAdd: () => void;
  newRowInputClass: string;
}

const AddRow: React.FC<AddRowProps> = ({ newItem, updateNewItem, onAdd, newRowInputClass }) => (
  <tr className="bg-[#FCFCFC]/50 hover:bg-[#FCFCFC] transition-colors">
    <td className="px-6 py-4 text-center text-indigo-400 font-bold">+</td>
    <td className="px-6 py-4">
      <input
        placeholder="Add Item Name..."
        className={newRowInputClass}
        value={newItem.task_name}
        onChange={(e: ChangeEvent<HTMLInputElement>) => updateNewItem('task_name', e.target.value)}
        onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && onAdd()}
      />
    </td>
    <td className="px-6 py-4">
      <input
        placeholder="Size"
        className={newRowInputClass}
        value={newItem.size}
        onChange={(e: ChangeEvent<HTMLInputElement>) => updateNewItem('size', e.target.value)}
        onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && onAdd()}
      />
    </td>
    <td className="px-6 py-4">
      <input
        type="number"
        placeholder="1"
        className={`${newRowInputClass} text-center`}
        value={newItem.quantity}
        onChange={(e: ChangeEvent<HTMLInputElement>) => updateNewItem('quantity', parseInt(e.target.value) || 0)}
        onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && onAdd()}
      />
    </td>
    <td className="px-6 py-4">
      <input
        placeholder="Notes..."
        className={newRowInputClass}
        value={newItem.notes}
        onChange={(e: ChangeEvent<HTMLInputElement>) => updateNewItem('notes', e.target.value)}
        onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && onAdd()}
      />
    </td>
    <td className="px-6 py-4 text-center text-[10px] text-zinc-400 font-bold italic">Pending</td>
    <td className="px-6 py-4 text-right">
      <button onClick={onAdd} className="bg-zinc-900 text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase hover:bg-black shadow-sm">Add</button>
    </td>
  </tr>
);

const PublicProjectSurvey: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const isAuthorized = token === SURVEY_FORM_SECRET;

  const [loading, setLoading] = useState(true);
  const [surveyDisabled, setSurveyDisabled] = useState(false);
  const [activeTab, setActiveTab] = useState<'evaluation' | 'checklist'>('checklist');

  // Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [designersData, setDesignersData] = useState<Designer[]>([]);
  // Store full survey objects mapped by project_id
  const [projectSurveysMap, setProjectSurveysMap] = useState<Record<string, ProjectSurvey>>({});
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Designer Evaluation State
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [evaluatorName, setEvaluatorName] = useState('');
  // Per-designer eval data: { [designer_id]: { kategori, job_title, inisiatif, ... } }
  const [designerEvalsForm, setDesignerEvalsForm] = useState<Record<string, Partial<DesignerEvaluation>>>({});

  // AI Scan State
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clarification State (This state is no longer used for designer evaluations, but kept for project surveys if needed elsewhere)
  const [clarificationRequested, setClarificationRequested] = useState(false);
  const [clarificationMessage, setClarificationMessage] = useState('');

  // Checklist State
  const [checklists, setChecklists] = useState<ProjectChecklist[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [templateItems, setTemplateItems] = useState<ChecklistTemplateItem[]>([]);

  // New Item State per group
  const [newItemsMap, setNewItemsMap] = useState<Record<string, { task_name: string, size: string, quantity: number, notes: string }>>({});

  const isEditable = useMemo(() => {
    return selectedProject?.status === 'ON PROGRESS';
  }, [selectedProject]);

  // 1. Fetch Projects & Templates (Initial Load)
  useEffect(() => {
    if (!isAuthorized || !supabase) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Check if surveys are enabled
        const { data: settingData } = await supabase.from('app_settings').select('value').eq('key', 'survey_enabled').single();
        if (settingData && settingData.value === 'false') {
          setSurveyDisabled(true);
        }

        const MAX_ROWS = 1000000;
        const [projRes, survRes, tplRes, tplItemsRes, designersRes] = await Promise.all([
          supabase.from('projects').select('*').in('status', ['DONE', 'ON PROGRESS', 'ON HOLD']).order('end_date', { ascending: false }).limit(MAX_ROWS),
          supabase.from('project_surveys').select('*').limit(MAX_ROWS),
          supabase.from('checklist_templates').select('*').order('name').limit(MAX_ROWS),
          supabase.from('checklist_template_items').select('*').limit(MAX_ROWS),
          supabase.from('designers').select('*').order('name')
        ]);

        if (projRes.error) throw projRes.error;

        setProjects(projRes.data || []);
        setDesignersData(designersRes.data || []);

        const surveyMap: Record<string, ProjectSurvey> = {};
        survRes.data?.forEach(s => {
          surveyMap[s.project_id] = s;
        });
        setProjectSurveysMap(surveyMap);

        setTemplates(tplRes.data || []);
        setTemplateItems(tplItemsRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isAuthorized]);

  // 2. Fetch Checklists & existing evaluations when a project is selected
  useEffect(() => {
    if (!selectedProject || !supabase) return;

    // Reset States
    setSubmitted(false);
    setEvaluatorName('');
    setDesignerEvalsForm({});
    setClarificationRequested(false); // Reset clarification state
    setClarificationMessage('');

    const initProjectData = async () => {
      // Fetch existing designer evaluations for this project
      const { data: existingEvals } = await supabase
        .from('designer_evaluations')
        .select('*')
        .eq('project_id', selectedProject.id);

      if (existingEvals && existingEvals.length > 0) {
        // Populate form with existing data
        setSubmitted(true);
        setEvaluatorName(existingEvals[0].evaluator_name || '');
        const formMap: Record<string, Partial<DesignerEvaluation>> = {};
        existingEvals.forEach(ev => {
          formMap[ev.designer_id] = ev;
        });
        setDesignerEvalsForm(formMap);
      } else {
        // Initialize empty form for each designer involved in the project
        const allDesignerIds = new Set<string>();
        if (selectedProject.pic_designer_id) allDesignerIds.add(selectedProject.pic_designer_id);
        (selectedProject.support_designer_ids || []).forEach(did => allDesignerIds.add(did));

        const formMap: Record<string, Partial<DesignerEvaluation>> = {};
        allDesignerIds.forEach(did => {
          formMap[did] = { designer_id: did, project_id: selectedProject.id };
        });
        setDesignerEvalsForm(formMap);
      }

      fetchChecklists();
    };

    initProjectData();
  }, [selectedProject]);

  const fetchChecklists = async () => {
    if (!selectedProject || !supabase) return;
    const { data } = await supabase.from('project_checklists').select('*').eq('project_id', selectedProject.id).order('created_at').limit(10000);
    setChecklists(data || []);
  };

  const calculateAverageScore = (survey: ProjectSurvey) => {
    const impact = survey.rating_impact || 0;
    const sum =
      (survey.rating_speed || 0) +
      (survey.rating_quality || 0) +
      (survey.rating_accuracy || 0) +
      (survey.rating_coord_internal || 0) +
      (survey.rating_coord_client || 0) +
      (survey.rating_problem_solving || 0) +
      (survey.rating_agility || 0) +
      impact;
    return (sum / 8).toFixed(1);
  };

  // Group checklists by Template ID
  const groupedChecklists = useMemo(() => {
    const groups: Record<string, ProjectChecklist[]> = {};
    const manualItems: ProjectChecklist[] = [];

    // Sort first to ensure order within groups
    const sortedChecklists = [...checklists].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

    sortedChecklists.forEach(item => {
      if (item.source_template_id) {
        if (!groups[item.source_template_id]) groups[item.source_template_id] = [];
        groups[item.source_template_id].push(item);
      } else {
        manualItems.push(item);
      }
    });

    return { groups, manualItems };
  }, [checklists]);

  const activeTemplatesInProject = useMemo(() => {
    const templateIds = new Set<string>();
    checklists.forEach(cl => {
      if (cl.source_template_id) templateIds.add(cl.source_template_id);
    });
    return templateIds;
  }, [checklists]);

  // --- DESIGNER EVALUATION HANDLERS ---
  const handleEvalFieldChange = (designerId: string, field: string, value: any) => {
    setDesignerEvalsForm(prev => ({
      ...prev,
      [designerId]: {
        ...(prev[designerId] || {}),
        [field]: value
      }
    }));
  };

  // --- AI SCREENSHOT SCAN ---
  const fuzzyMatchDesigner = (name: string, designers: Designer[]): string | null => {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedName = normalize(name);

    // Exact match first
    for (const d of designers) {
      if (normalize(d.name) === normalizedName) return d.id;
    }
    // Partial match (name contains or is contained)
    for (const d of designers) {
      const dn = normalize(d.name);
      if (dn.includes(normalizedName) || normalizedName.includes(dn)) return d.id;
    }
    // Word-level match (any word in name matches)
    const nameWords = normalizedName.split(/\s+/).filter(w => w.length > 2);
    for (const d of designers) {
      const dWords = normalize(d.name).split(/\s+/);
      if (nameWords.some(nw => dWords.some(dw => dw.includes(nw) || nw.includes(dw)))) return d.id;
    }
    return null;
  };

  const handleAIScan = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!GEMINI_API_KEY) {
      setAiError('Gemini API Key belum diset. Tambahkan VITE_GEMINI_API_KEY di file .env');
      return;
    }

    setAiProcessing(true);
    setAiError(null);

    try {
      // Read file as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data:image/...;base64, prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const mimeType = file.type || 'image/png';

      // Build list of designers in this project for context
      const projectDesignerNames = Object.keys(designerEvalsForm).map(did => {
        const d = designersData.find(x => x.id === did);
        return d?.name || 'Unknown';
      });

      const prompt = `Analyze this Excel screenshot of a designer performance evaluation table.
Extract ALL rows of evaluation data.

The table columns may include: NO, Nama, Kategori, Job Title, Inisiatif, Disiplin, Penyelesaian Tugas, Attitude, Komunikasi, Respon Terhadap Masukan, Average, and Masukan untuk Pengembangan Diri.

Known designer names in this project: ${projectDesignerNames.join(', ')}

Return ONLY valid JSON array with this exact structure (no markdown, no code blocks, just raw JSON):
[
  {
    "nama": "designer full name as shown",
    "kategori": "category text or null",
    "job_title": "job title text or null",
    "inisiatif": number_1_to_5_or_null,
    "disiplin": number_1_to_5_or_null,
    "penyelesaian_tugas": number_1_to_5_or_null,
    "attitude": number_1_to_5_or_null,
    "komunikasi": number_1_to_5_or_null,
    "respon_masukan": number_1_to_5_or_null,
    "masukan_pengembangan": "feedback text or null"
  }
]

IMPORTANT: Extract ALL rows. Return raw JSON only, no explanations.`;

      // Call Gemini API
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inlineData: { mimeType, data: base64 } }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096
            }
          })
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) throw new Error('No response from Gemini API');

      // Parse JSON (handle markdown code blocks)
      let jsonStr = textContent.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      }

      const extracted: any[] = JSON.parse(jsonStr);

      if (!Array.isArray(extracted) || extracted.length === 0) {
        throw new Error('Tidak ada data yang terdeteksi dari screenshot.');
      }

      // Match extracted names to designer IDs and fill form
      let matchCount = 0;
      const updatedForm = { ...designerEvalsForm };
      const projectDesigners = Object.keys(designerEvalsForm).map(did => designersData.find(x => x.id === did)).filter(Boolean) as Designer[];

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

      setDesignerEvalsForm(updatedForm);

      if (matchCount === 0) {
        setAiError(`⚠️ ${extracted.length} baris terdeteksi, tapi tidak ada nama yang cocok dengan designer project ini. Nama yang terdeteksi: ${extracted.map(r => r.nama).join(', ')}`);
      } else {
        setAiError(null);
        alert(`✅ Berhasil! ${matchCount} dari ${extracted.length} designer berhasil diisi otomatis.`);
      }
    } catch (err: any) {
      console.error('AI Scan error:', err);
      setAiError(`❌ Error: ${err.message}`);
    } finally {
      setAiProcessing(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmitDesignerEvals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !supabase) return;

    setSubmitting(true);
    try {
      const entries = Object.entries(designerEvalsForm);
      const payloads = entries.map(([designerId, ev]) => ({
        project_id: selectedProject.id,
        designer_id: designerId,
        evaluator_name: evaluatorName,
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
      setSubmitted(true);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const calcDesignerAvg = (ev: Partial<DesignerEvaluation>) => {
    const scores = EVAL_CRITERIA.map(c => (ev as any)[c.key] || 0).filter((v: number) => v > 0);
    return scores.length > 0 ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : '-';
  };

  // --- CHECKLIST HANDLERS ---
  const updateNewItemState = (templateId: string | null, field: string, value: any) => {
    const mapKey = templateId || 'manual';
    setNewItemsMap(prev => ({
      ...prev,
      [mapKey]: {
        ...(prev[mapKey] || { task_name: '', size: '', quantity: 1, notes: '' }),
        [field]: value
      }
    }));
  };

  const handleAddItem = async (templateId: string | null) => {
    if (!selectedProject || !supabase) return;
    if (!isEditable) return;

    const mapKey = templateId || 'manual';
    const currentNewItem = newItemsMap[mapKey] || { task_name: '', size: '', quantity: 1, notes: '' };

    if (!currentNewItem.task_name.trim()) return;

    const payload = {
      project_id: selectedProject.id,
      task_name: currentNewItem.task_name,
      size: currentNewItem.size,
      quantity: currentNewItem.quantity,
      notes: currentNewItem.notes,
      status: 'NONE',
      source_template_id: templateId
    };

    const { error } = await supabase.from('project_checklists').insert([payload]);
    if (error) alert(error.message);
    else {
      // Reset specific input
      setNewItemsMap(prev => ({
        ...prev,
        [mapKey]: { task_name: '', size: '', quantity: 1, notes: '' }
      }));
      fetchChecklists();
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!supabase) return;
    if (!isEditable) return;

    // Optimistic update
    setChecklists(prev => prev.filter(c => c.id !== id));
    await supabase.from('project_checklists').delete().eq('id', id);
  };

  // INLINE EDIT: Update state immediately for UI response
  const handleLocalChange = (id: string, field: keyof ProjectChecklist, value: any) => {
    if (!isEditable) return;
    setChecklists(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  // INLINE EDIT: Save to DB on Blur
  const handleSaveItem = async (id: string, field: keyof ProjectChecklist, value: any) => {
    if (!supabase || !isEditable) return;
    await supabase.from('project_checklists').update({ [field]: value }).eq('id', id);
  };

  const handleToggleTemplate = async (templateId: string) => {
    if (!selectedProject || !supabase) return;
    if (!isEditable) return; // Guard clause

    if (activeTemplatesInProject.has(templateId)) {
      if (!confirm("Remove all items from this template?")) return;
      await supabase.from('project_checklists').delete().eq('project_id', selectedProject.id).eq('source_template_id', templateId);
      fetchChecklists();
    } else {
      // Add Items
      const itemsToAdd = templateItems
        .filter(ti => ti.template_id === templateId)
        .map(ti => ({
          project_id: selectedProject.id,
          task_name: ti.task_name,
          size: ti.size,
          notes: ti.notes,
          quantity: 1,
          status: 'NONE',
          source_template_id: templateId
        }));

      if (itemsToAdd.length === 0) return alert("Empty template");

      await supabase.from('project_checklists').insert(itemsToAdd);
      fetchChecklists();
    }
  };

  // Styles for inline inputs
  const cellInputClass = "w-full bg-transparent border-b border-transparent focus:border-indigo-600 outline-none text-xs font-bold text-zinc-700 py-1 px-1 transition-colors placeholder-slate-300";
  const newRowInputClass = "w-full bg-white border border-zinc-300 rounded px-2 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none";

  // --- RENDERING ---

  if (!isAuthorized) return (
    <div className="min-h-screen bg-[#1A1C20] flex items-center justify-center p-6 text-white font-bold">
      403 UNAUTHORIZED
    </div>
  );

  if (submitted && activeTab === 'evaluation' && !selectedProject) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[20px] shadow-2xl p-10 text-center animate-in zoom-in duration-300 border-t-8 border-indigo-600">
          <div className="w-20 h-20 bg-indigo-100 text-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Thank You!</h1>
          <p className="text-zinc-700 mb-8 font-medium">Evaluasi Anda telah disimpan.</p>
          <button onClick={() => { setSubmitted(false); setSelectedProject(null); setEvaluatorName(''); window.location.reload(); }} className="w-full py-4 bg-zinc-900 text-white rounded-[20px] font-bold shadow-sm border border-[#EAEAEA]">Back to Projects</button>
        </div>
      </div>
    );
  }

  // --- SCREEN 1: PROJECT LIST ---
  if (!selectedProject) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] py-6 md:py-12 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 bg-[#1A1C20] text-white rounded-full text-[10px] font-bold uppercase tracking-wider mb-4">ACS Project Portal</div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight uppercase">Select Project</h1>
            <p className="text-zinc-500 mt-2 font-medium">Choose a project to manage design requests.</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(p => {
                const survey = projectSurveysMap[p.id];
                const status = survey?.status || 'NONE'; // Default if undefined
                const isClarificationNeeded = status === 'CLARIFICATION_REQUESTED';
                const isDone = status === 'SUBMITTED';

                // Card Classes
                const baseCard = "w-full text-left relative p-6 rounded-[20px] border transition-all duration-300 flex flex-col h-full shadow-sm min-h-[180px]";
                const activeCard = "bg-white border-[#EAEAEA] hover:shadow-sm border border-[#EAEAEA] hover:-translate-y-1 hover:border-indigo-300 cursor-pointer group";
                const clarificationCard = "bg-amber-50 border-amber-300 hover:border-amber-500 hover:shadow-sm border border-[#EAEAEA] hover:-translate-y-1 cursor-pointer group";
                const doneCard = "bg-[#F8F9FA] border-zinc-300 cursor-default opacity-90";

                const cardClass = `${baseCard} ${isClarificationNeeded ? clarificationCard : (isDone ? doneCard : activeCard)}`;
                const avgScore = isDone ? calculateAverageScore(survey) : null;

                const CardContent = (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${p.status === 'DONE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : p.status === 'ON HOLD' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {p.status}
                      </span>
                      {isClarificationNeeded && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-white uppercase bg-amber-500 px-2 py-0.5 rounded shadow-sm animate-pulse">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          Action Required
                        </span>
                      )}
                      {isDone && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 uppercase bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                          Submitted
                        </span>
                      )}
                    </div>

                    <h3 className={`text-lg font-bold uppercase leading-tight mb-4 ${isDone ? 'text-zinc-500' : 'text-zinc-900 group-hover:text-zinc-900'} transition-colors`}>
                      {p.project_name}
                    </h3>

                    <div className="mt-auto pt-4 border-t border-[#EAEAEA]/50 w-full">
                      {isDone && avgScore ? (
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">Your Rating</span>
                          <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-[#EAEAEA]">
                            <span className="text-amber-500 text-xs">★</span>
                            <span className="text-xs font-bold text-zinc-700">{avgScore} / 3.0</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 uppercase">
                          <span>End: {p.end_date}</span>
                          <span>{p.project_type}</span>
                        </div>
                      )}
                    </div>
                  </>
                );

                if (isDone) {
                  return <div key={p.id} className={cardClass}>{CardContent}</div>;
                }

                return (
                  <button key={p.id} onClick={() => { setSelectedProject(p); setActiveTab('checklist'); }} className={cardClass}>{CardContent}</button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- SCREEN 2: PROJECT HUB (TABS) ---
  return (
    <div className="min-h-screen bg-[#FCFCFC] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-[#EAEAEA] px-4 md:px-6 py-3 md:py-4 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <button onClick={() => setSelectedProject(null)} className="p-2.5 bg-[#F8F9FA] rounded-lg hover:bg-[#FAFAFA]200 text-zinc-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-base md:text-xl font-bold text-zinc-900 uppercase tracking-tight leading-none truncate">{selectedProject.project_name}</h1>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Project Portal</span>
            </div>
          </div>

          <div className="flex bg-[#F8F9FA] p-1 rounded-xl gap-1">
            <span className="px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wide bg-white text-zinc-800 shadow-sm">
              Design Checklist
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-8">
        <div className="max-w-5xl mx-auto">

          {/* Design Checklist - always shown */}
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white p-4 md:p-6 rounded-[16px] md:rounded-[20px] border border-[#EAEAEA] shadow-sm">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-3">Quick Add from Templates</span>
              {isEditable ? (
                <div className="flex flex-wrap gap-2">
                  {templates.map(t => {
                    const isActive = activeTemplatesInProject.has(t.id);
                    return (
                      <button key={t.id} onClick={() => handleToggleTemplate(t.id)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase border transition-all ${isActive ? 'bg-zinc-100 border-indigo-200 text-zinc-800' : 'bg-white border-[#EAEAEA] text-zinc-600 hover:border-indigo-300 hover:text-zinc-900'}`}>{isActive ? '✓ ' : '+ '} {t.name}</button>
                    );
                  })}
                  {templates.length === 0 && <span className="text-xs text-zinc-400 italic">No templates available.</span>}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Project Status is {selectedProject.status}. Checklist modification is locked.
                </div>
              )}
            </div>

            <div className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm overflow-hidden">
              <div className="p-6 border-b border-zinc-100">
                <h2 className="text-lg font-bold text-zinc-900 uppercase tracking-wide">Design Request List</h2>
                <p className="text-xs text-zinc-500 mt-1">List all design assets needed for this project.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead className="bg-[#FCFCFC] text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-[#EAEAEA]">
                    <tr>
                      <th className="px-6 py-4 text-center w-12">#</th>
                      <th className="px-6 py-4">Design Item</th>
                      <th className="px-6 py-4 w-32">Size</th>
                      <th className="px-6 py-4 text-center w-20">Qty</th>
                      <th className="px-6 py-4">Notes</th>
                      <th className="px-6 py-4 w-32">Status</th>
                      <th className="px-6 py-4 text-right w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-zinc-700">
                    {Array.from(activeTemplatesInProject).map(templateId => {
                      const items = groupedChecklists.groups[templateId] || [];
                      const templateName = templates.find(t => t.id === templateId)?.name || 'Unknown Template';
                      const newItemState = newItemsMap[templateId] || { task_name: '', size: '', quantity: 1, notes: '' };
                      return (
                        <React.Fragment key={templateId}>
                          <tr className="bg-zinc-100 border-y border-[#EAEAEA]">
                            <td colSpan={7} className="px-6 py-2">
                              <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-2">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> {templateName}
                              </span>
                            </td>
                          </tr>
                          {items.map((cl, idx) => (<TableRow key={cl.id} cl={cl} idx={idx} isEditable={isEditable} cellInputClass={cellInputClass} handleLocalChange={handleLocalChange} handleSaveItem={handleSaveItem} handleDeleteItem={handleDeleteItem} />))}
                          {isEditable && <AddRow newItem={newItemState} updateNewItem={(field: string, val: any) => updateNewItemState(templateId, field, val)} onAdd={() => handleAddItem(templateId)} newRowInputClass={newRowInputClass} />}
                        </React.Fragment>
                      );
                    })}
                    <React.Fragment key="manual">
                      <tr className="bg-[#F8F9FA] border-y border-[#EAEAEA]">
                        <td colSpan={7} className="px-6 py-2">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Additional / Manual Items
                          </span>
                        </td>
                      </tr>
                      {groupedChecklists.manualItems.map((cl, idx) => (<TableRow key={cl.id} cl={cl} idx={idx} isEditable={isEditable} cellInputClass={cellInputClass} handleLocalChange={handleLocalChange} handleSaveItem={handleSaveItem} handleDeleteItem={handleDeleteItem} />))}
                      {isEditable && <AddRow newItem={newItemsMap['manual'] || { task_name: '', size: '', quantity: 1, notes: '' }} updateNewItem={(field: string, val: any) => updateNewItemState(null, field, val)} onAdd={() => handleAddItem(null)} newRowInputClass={newRowInputClass} />}
                    </React.Fragment>
                  </tbody>
                </table>
              </div>
              {checklists.length === 0 && <div className="p-8 text-center text-xs text-zinc-400 font-bold italic">No items yet. Add manually or pick a template above.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProjectSurvey;
