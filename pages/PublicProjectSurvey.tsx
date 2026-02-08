
import React, { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Project, ProjectChecklist, ChecklistTemplate, ChecklistTemplateItem, ProjectSurvey } from '../types';
import { supabase } from '../lib/supabase';
import { SURVEY_FORM_SECRET } from '../App';

const SURVEY_QUESTIONS = [
  {
    id: 'rating_speed',
    label: '1. Kecepatan Delivery Output',
    options: [
      { val: 1, text: 'Lambat' },
      { val: 2, text: 'Sesuai Timeline' },
      { val: 3, text: 'Lebih Cepat dari Timeline' }
    ]
  },
  {
    id: 'rating_quality',
    label: '2. Kualitas Output Final',
    options: [
      { val: 1, text: 'Di bawah standar' },
      { val: 2, text: 'Sesuai standar' },
      { val: 3, text: 'Di atas standar' }
    ]
  },
  {
    id: 'rating_accuracy',
    label: '3. Akurasi Implementasi Brief',
    options: [
      { val: 1, text: 'Banyak mismatch' },
      { val: 2, text: 'Sesuai brief' },
      { val: 3, text: 'Melebihi ekspektasi' }
    ]
  },
  {
    id: 'rating_coord_internal',
    label: '4. Koordinasi Internal Tim',
    options: [
      { val: 1, text: 'Tidak efektif' },
      { val: 2, text: 'Cukup efektif' },
      { val: 3, text: 'Proaktif & terstruktur' }
    ]
  },
  {
    id: 'rating_coord_client',
    label: '5. Koordinasi dengan Klien',
    options: [
      { val: 1, text: 'Tidak efektif' },
      { val: 2, text: 'Cukup efektif' },
      { val: 3, text: 'Proaktif & solutif' }
    ]
  },
  {
    id: 'rating_problem_solving',
    label: '6. Problem Solving Capability',
    options: [
      { val: 1, text: 'Issue tidak terselesaikan' },
      { val: 2, text: 'Terselesaikan standar' },
      { val: 3, text: 'Solusi cepat & berdampak' }
    ]
  },
  {
    id: 'rating_agility',
    label: '7. Agility terhadap Perubahan / Revisi',
    options: [
      { val: 1, text: 'Lambat beradaptasi' },
      { val: 2, text: 'Adaptif standar' },
      { val: 3, text: 'Cepat & fleksibel' }
    ]
  }
];

const PublicProjectSurvey: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const isAuthorized = token === SURVEY_FORM_SECRET;

  const [loading, setLoading] = useState(true);
  // Default tab changed to 'checklist'
  const [activeTab, setActiveTab] = useState<'evaluation' | 'checklist'>('checklist');
  
  // Data State
  const [projects, setProjects] = useState<Project[]>([]);
  // Changed from Set<string> to Record<string, string> to store specific status
  const [projectSurveyStatus, setProjectSurveyStatus] = useState<Record<string, string>>({});
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // Evaluation State
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  
  // Clarification State
  const [clarificationRequested, setClarificationRequested] = useState(false);
  const [clarificationMessage, setClarificationMessage] = useState('');

  // Checklist State
  const [checklists, setChecklists] = useState<ProjectChecklist[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [templateItems, setTemplateItems] = useState<ChecklistTemplateItem[]>([]);
  
  // New Item State per group: key = templateId (or 'manual') -> value = item data
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
        const [projRes, survRes, tplRes, tplItemsRes] = await Promise.all([
          supabase.from('projects').select('*').in('status', ['DONE', 'ON PROGRESS', 'ON HOLD']).order('end_date', { ascending: false }),
          supabase.from('project_surveys').select('project_id, status'),
          supabase.from('checklist_templates').select('*').order('name'),
          supabase.from('checklist_template_items').select('*')
        ]);

        if (projRes.error) throw projRes.error;

        setProjects(projRes.data || []);
        
        // Map project_id -> status
        const statusMap: Record<string, string> = {};
        survRes.data?.forEach(s => {
          statusMap[s.project_id] = s.status || 'SUBMITTED';
        });
        setProjectSurveyStatus(statusMap);

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

  // 2. Fetch Checklists & Specific Survey Data when a project is selected
  useEffect(() => {
    if (!selectedProject || !supabase) return;
    
    // Reset States
    setSubmitted(false);
    setRatings({});
    setNotes('');
    setClarificationRequested(false);
    setClarificationMessage('');

    const initProjectData = async () => {
      // Check for existing survey data to handle clarification state
      const { data: surveyData } = await supabase
        .from('project_surveys')
        .select('*')
        .eq('project_id', selectedProject.id)
        .single();

      if (surveyData) {
        // If status column exists and is populated
        if (surveyData.status === 'CLARIFICATION_REQUESTED') {
          // If clarification is requested, populate form and show edit mode
          setClarificationRequested(true);
          setClarificationMessage(surveyData.clarification_notes || 'Please review your evaluation.');
          setRatings({
            rating_speed: surveyData.rating_speed,
            rating_quality: surveyData.rating_quality,
            rating_accuracy: surveyData.rating_accuracy,
            rating_coord_internal: surveyData.rating_coord_internal,
            rating_coord_client: surveyData.rating_coord_client,
            rating_problem_solving: surveyData.rating_problem_solving,
            rating_agility: surveyData.rating_agility
          });
          setNotes(surveyData.notes || '');
          setSubmitted(false); // Ensure form is visible
        } else {
          // Normal submitted state
          setSubmitted(true);
        }
      }

      fetchChecklists();
    };

    initProjectData();
  }, [selectedProject]);

  const fetchChecklists = async () => {
    if (!selectedProject || !supabase) return;
    const { data } = await supabase.from('project_checklists').select('*').eq('project_id', selectedProject.id).order('created_at');
    setChecklists(data || []);
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

  // --- SURVEY HANDLERS ---
  const handleRatingChange = (questionId: string, val: number) => {
    setRatings(prev => ({ ...prev, [questionId]: val }));
  };

  const handleSubmitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !supabase) return;
    
    setSubmitting(true);
    try {
      const payload = {
        project_id: selectedProject.id,
        rating_speed: ratings['rating_speed'],
        rating_quality: ratings['rating_quality'],
        rating_accuracy: ratings['rating_accuracy'],
        rating_coord_internal: ratings['rating_coord_internal'],
        rating_coord_client: ratings['rating_coord_client'],
        rating_problem_solving: ratings['rating_problem_solving'],
        rating_agility: ratings['rating_agility'],
        notes: notes,
        status: 'SUBMITTED', // Reset status to submitted on update
        clarification_notes: null // Clear the clarification flag notes on resolve
      };

      // Upsert: Updates if exists, Inserts if new
      const { error } = await supabase.from('project_surveys').upsert(payload, { onConflict: 'project_id' });

      if (error) {
        throw error;
      } else {
        setSubmitted(true);
        // Update local cache so we don't need to refetch list
        setProjectSurveyStatus(prev => ({ ...prev, [selectedProject.id]: 'SUBMITTED' }));
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('clarification_notes') || err.message.includes('status'))) {
        alert("DATABASE ERROR: Missing required columns in 'project_surveys' table. Please ask the administrator to run the 'Clarification Request Update' SQL migration found in README.md");
      } else {
        alert(`Error submitting survey: ${err.message}`);
      }
    } finally {
      setSubmitting(false);
    }
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
  const cellInputClass = "w-full bg-transparent border-b border-transparent focus:border-indigo-600 outline-none text-xs font-bold text-slate-700 py-1 px-1 transition-colors placeholder-slate-300";
  const newRowInputClass = "w-full bg-white border border-slate-300 rounded px-2 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none";

  // --- RENDERING ---

  if (!isAuthorized) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white font-bold">
      403 UNAUTHORIZED
    </div>
  );

  if (submitted && !clarificationRequested) {
    return (
      <div className="min-h-screen bg-indigo-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center animate-in zoom-in duration-300 border-t-8 border-indigo-600">
          <div className="w-20 h-20 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Thank You!</h1>
          <p className="text-slate-700 mb-8 font-medium">Your evaluation has been recorded.</p>
          <button onClick={() => { setSubmitted(false); setSelectedProject(null); setRatings({}); setNotes(''); window.location.reload(); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">Back to Projects</button>
        </div>
      </div>
    );
  }

  // --- SCREEN 1: PROJECT LIST ---
  if (!selectedProject) {
    return (
      <div className="min-h-screen bg-slate-100 py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 bg-slate-900 text-white rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">ACS Project Portal</div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Select Project</h1>
            <p className="text-slate-500 mt-2 font-medium">Choose a project to evaluate or manage design requests.</p>
          </div>

          {loading ? (
             <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(p => {
                const surveyStatus = projectSurveyStatus[p.id];
                const isClarificationNeeded = surveyStatus === 'CLARIFICATION_REQUESTED';
                const isDone = surveyStatus === 'SUBMITTED';
                
                return (
                  <button 
                    key={p.id}
                    onClick={() => { setSelectedProject(p); setActiveTab('checklist'); }}
                    className={`text-left relative p-6 rounded-2xl border transition-all duration-300 group flex flex-col h-full shadow-sm hover:shadow-xl hover:-translate-y-1 ${isClarificationNeeded ? 'bg-amber-50 border-amber-300 hover:border-amber-500' : 'bg-white border-slate-200 hover:border-indigo-300'}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${p.status === 'DONE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : p.status === 'ON HOLD' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {p.status}
                      </span>
                      {isClarificationNeeded ? (
                        <span className="flex items-center gap-1 text-[9px] font-black text-white uppercase bg-amber-500 px-2 py-0.5 rounded shadow-sm animate-pulse">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                          Action Required
                        </span>
                      ) : isDone ? (
                        <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-200 px-2 py-0.5 rounded">Eval Done</span>
                      ) : null}
                    </div>
                    <h3 className="text-lg font-black text-slate-900 uppercase leading-tight mb-2 group-hover:text-indigo-600 transition-colors">{p.project_name}</h3>
                    <div className="mt-auto pt-4 border-t border-slate-100 w-full">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                        <span>End: {p.end_date}</span>
                        <span>{p.project_type}</span>
                      </div>
                    </div>
                  </button>
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-4">
             <button onClick={() => setSelectedProject(null)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
             </button>
             <div>
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">{selectedProject.project_name}</h1>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project Portal</span>
             </div>
           </div>
           
           <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
             {/* DESIGN CHECKLIST TAB (First) */}
             <button 
               onClick={() => setActiveTab('checklist')}
               className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${activeTab === 'checklist' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Design Checklist
             </button>
             
             {/* EVALUATION SURVEY TAB (Second, Distinct Style) */}
             <button 
               onClick={() => setActiveTab('evaluation')}
               className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all flex items-center gap-1.5 ${
                 activeTab === 'evaluation' 
                 ? 'bg-amber-400 text-amber-900 shadow-md ring-1 ring-amber-500/20' 
                 : 'text-slate-500 hover:text-amber-700 hover:bg-amber-50'
               }`}
             >
               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
               {clarificationRequested ? '⚠️ Action Required' : 'Evaluation Survey'}
             </button>
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-5xl mx-auto">
          
          {/* TAB 2: CHECKLIST */}
          {activeTab === 'checklist' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
               {/* Template Selector */}
               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Quick Add from Templates</span>
                  {isEditable ? (
                    <div className="flex flex-wrap gap-2">
                       {templates.map(t => {
                         const isActive = activeTemplatesInProject.has(t.id);
                         return (
                           <button 
                              key={t.id}
                              onClick={() => handleToggleTemplate(t.id)}
                              className={`px-4 py-2 rounded-lg text-xs font-black uppercase border transition-all ${
                                isActive 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                              }`}
                           >
                             {isActive ? '✓ ' : '+ '} {t.name}
                           </button>
                         );
                       })}
                       {templates.length === 0 && <span className="text-xs text-slate-400 italic">No templates available.</span>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                        Project Status is {selectedProject.status}. Checklist modification is locked.
                    </div>
                  )}
               </div>

               {/* Checklist Table */}
               <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">Design Request List</h2>
                    <p className="text-xs text-slate-500 mt-1">List all design assets needed for this project.</p>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
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
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                      {/* RENDER TEMPLATE GROUPS */}
                      {Array.from(activeTemplatesInProject).map(templateId => {
                        const items = groupedChecklists.groups[templateId] || [];
                        const templateName = templates.find(t => t.id === templateId)?.name || 'Unknown Template';
                        const newItemState = newItemsMap[templateId] || { task_name: '', size: '', quantity: 1, notes: '' };

                        return (
                          <React.Fragment key={templateId}>
                            {/* DIVIDER ROW */}
                            <tr className="bg-indigo-50 border-y border-indigo-100">
                              <td colSpan={7} className="px-6 py-2">
                                <span className="text-[10px] font-black text-indigo-800 uppercase tracking-widest flex items-center gap-2">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                                  {templateName}
                                </span>
                              </td>
                            </tr>
                            {items.map((cl, idx) => (
                              <TableRow 
                                key={cl.id} 
                                cl={cl} 
                                idx={idx} 
                                isEditable={isEditable}
                                cellInputClass={cellInputClass} 
                                handleLocalChange={handleLocalChange}
                                handleSaveItem={handleSaveItem}
                                handleDeleteItem={handleDeleteItem}
                              />
                            ))}
                            {/* Add Item Row for this Template */}
                            {isEditable && (
                              <AddRow 
                                newItem={newItemState}
                                updateNewItem={(field: string, val: any) => updateNewItemState(templateId, field, val)}
                                onAdd={() => handleAddItem(templateId)}
                                newRowInputClass={newRowInputClass}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}

                      {/* RENDER MANUAL / ADDITIONAL ITEMS */}
                      <React.Fragment key="manual">
                        <tr className="bg-slate-100 border-y border-slate-200">
                          <td colSpan={7} className="px-6 py-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                              Additional / Manual Items
                            </span>
                          </td>
                        </tr>
                        {groupedChecklists.manualItems.map((cl, idx) => (
                          <TableRow 
                            key={cl.id} 
                            cl={cl} 
                            idx={idx} 
                            isEditable={isEditable}
                            cellInputClass={cellInputClass} 
                            handleLocalChange={handleLocalChange}
                            handleSaveItem={handleSaveItem}
                            handleDeleteItem={handleDeleteItem}
                          />
                        ))}
                        {/* Add Item Row for Manual */}
                        {isEditable && (
                          <AddRow 
                            newItem={newItemsMap['manual'] || { task_name: '', size: '', quantity: 1, notes: '' }}
                            updateNewItem={(field: string, val: any) => updateNewItemState(null, field, val)}
                            onAdd={() => handleAddItem(null)}
                            newRowInputClass={newRowInputClass}
                          />
                        )}
                      </React.Fragment>
                    </tbody>
                  </table>
                  {checklists.length === 0 && <div className="p-8 text-center text-xs text-slate-400 font-bold italic">No items yet. Add manually or pick a template above.</div>}
               </div>
            </div>
          )}

          {/* TAB 1: EVALUATION */}
          {activeTab === 'evaluation' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
               {/* Clarification Alert */}
               {clarificationRequested && (
                 <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm mb-6 flex items-start gap-4">
                    <div className="p-2 bg-white rounded-full text-amber-500 shadow-sm">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-amber-800 uppercase tracking-wide">Clarification Requested</h3>
                      <p className="text-xs text-amber-700 font-bold mt-1">From Design Team: "{clarificationMessage}"</p>
                      <p className="text-[10px] text-amber-600 mt-2">Please update your evaluation below and resubmit.</p>
                    </div>
                 </div>
               )}

               {submitted && !clarificationRequested ? (
                 <div className="p-10 bg-white rounded-3xl border border-slate-200 text-center shadow-sm">
                    <div className="text-4xl mb-4">✅</div>
                    <h2 className="text-xl font-bold text-slate-900">Evaluation Completed</h2>
                    <p className="text-slate-500 text-sm mt-2">Thank you for submitting your feedback for this project.</p>
                 </div>
               ) : (
                 <form onSubmit={handleSubmitSurvey} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-8 border-b border-slate-100 bg-amber-50">
                      <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                        <span className="text-amber-500 text-xl">★</span> PM Performance Survey
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">Rate the design team's performance for this specific project.</p>
                    </div>
                    <div className="p-8 space-y-8">
                      {SURVEY_QUESTIONS.map((q) => (
                        <div key={q.id}>
                          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">{q.label}</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {q.options.map((opt) => {
                              const isSelected = ratings[q.id] === opt.val;
                              return (
                                <button
                                  key={opt.val}
                                  type="button"
                                  onClick={() => handleRatingChange(q.id, opt.val)}
                                  className={`p-4 rounded-xl border text-left transition-all duration-200 flex flex-col gap-1
                                    ${isSelected 
                                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-inner ring-1 ring-amber-500' 
                                      : 'border-slate-200 bg-white text-slate-500 hover:border-amber-300'
                                    }
                                  `}
                                >
                                  <span className="text-xs font-bold uppercase leading-tight">{opt.text}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <div>
                        <label className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3 block">Project Manager Notes</label>
                        <textarea 
                          rows={3}
                          maxLength={200}
                          placeholder="Any specific feedback..."
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          className="w-full p-4 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={submitting || !SURVEY_QUESTIONS.every(q => ratings[q.id] !== undefined)}
                        className="w-full py-4 rounded-xl font-bold text-sm shadow-lg uppercase tracking-widest bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {submitting ? 'Submitting...' : (clarificationRequested ? 'Update Evaluation' : 'Submit Evaluation')}
                      </button>
                    </div>
                 </form>
               )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

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
  <tr key={cl.id} className="hover:bg-slate-50 transition-colors group border-b border-slate-50 last:border-0">
    <td className="px-6 py-2 text-center text-slate-400">{idx + 1}</td>
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
          <select 
            value={cl.status} 
            onChange={(e) => {
              const val = e.target.value;
              handleLocalChange(cl.id, 'status', val);
              handleSaveItem(cl.id, 'status', val);
            }}
            className={`w-full text-[10px] font-black uppercase rounded py-1 px-1 outline-none cursor-pointer transition-colors bg-transparent hover:bg-slate-100 ${
              cl.status === 'DONE' ? 'text-emerald-600' :
              cl.status === 'ON PROGRESS' ? 'text-amber-600' :
              'text-slate-400'
            }`}
          >
            <option value="NONE">Not Started</option>
            <option value="ON PROGRESS">On Progress</option>
            <option value="DONE">Done</option>
          </select>
       ) : (
          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${
            cl.status === 'DONE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
            cl.status === 'ON PROGRESS' ? 'bg-amber-100 text-amber-700 border-amber-200' :
            'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            {cl.status}
          </span>
       )}
    </td>
    <td className="px-6 py-2 text-right">
       {isEditable && (
         <button onClick={() => handleDeleteItem(cl.id)} className="text-slate-300 hover:text-red-500 p-1 transition-colors opacity-0 group-hover:opacity-100">
           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
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
  <tr className="bg-slate-50/50 hover:bg-slate-50 transition-colors">
    <td className="px-6 py-4 text-center text-indigo-400 font-black">+</td>
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
    <td className="px-6 py-4 text-center text-[10px] text-slate-400 font-bold italic">Pending</td>
    <td className="px-6 py-4 text-right">
      <button onClick={onAdd} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-[10px] font-black uppercase hover:bg-indigo-700 shadow-sm">Add</button>
    </td>
  </tr>
);

export default PublicProjectSurvey;
