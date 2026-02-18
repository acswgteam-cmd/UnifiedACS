
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, Designer, ProjectSurvey, ProjectChecklist, ChecklistTemplate, ChecklistTemplateItem } from '../types';
import { supabase } from '../lib/supabase';
import { SURVEY_FORM_SECRET } from '../App';

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
  rating_impact: 'Impact Value Project' // Added New Field
};

// --- Rich Text Editor Component ---
const SimpleRichTextEditor = ({ initialValue, onSave, placeholder, height = "min-h-[150px]" }: { initialValue: string, onSave: (val: string) => void, placeholder?: string, height?: string }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Update internal ref if initialValue changes externally
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
      if (html !== initialValue) {
        onSave(html);
      }
    }
  };

  const btnClass = "p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors text-xs font-bold min-w-[24px]";

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col w-full">
      {/* Inject styles specifically for the editor content to override Tailwind resets */}
      <style>{`
        .rte-content ul { list-style-type: disc; margin-left: 1.5em; margin-bottom: 0.5em; }
        .rte-content ol { list-style-type: decimal; margin-left: 1.5em; margin-bottom: 0.5em; }
        .rte-content li { margin-bottom: 0.25em; }
        .rte-content b, .rte-content strong { font-weight: 700; }
        .rte-content i, .rte-content em { font-style: italic; }
        .rte-content u { text-decoration: underline; }
      `}</style>
      
      <div className="flex gap-1 p-2 bg-slate-50 border-b border-slate-100 items-center shrink-0">
        <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); exec('bold'); }} title="Bold">B</button>
        <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); exec('italic'); }} title="Italic">I</button>
        <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); exec('underline'); }} title="Underline">U</button>
        <div className="w-px h-4 bg-slate-300 mx-1"></div>
        <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }} title="Bullet List">• List</button>
        <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); }} title="Number List">1. List</button>
      </div>
      <div 
        ref={contentRef}
        contentEditable
        className={`rte-content p-4 flex-1 outline-none text-sm text-slate-700 overflow-y-auto ${height}`}
        onBlur={handleBlur}
        dangerouslySetInnerHTML={{ __html: initialValue || '' }}
        data-placeholder={placeholder}
      />
    </div>
  );
};

interface Props {
  projects: Project[];
  designers: Designer[];
  projectSurveys?: ProjectSurvey[];
  projectChecklists?: ProjectChecklist[];
  checklistTemplates?: ChecklistTemplate[];
  checklistTemplateItems?: ChecklistTemplateItem[];
  onUpdate: () => void;
}

const ProjectMaster: React.FC<Props> = ({ 
  projects, 
  designers, 
  projectSurveys = [], 
  projectChecklists = [], 
  checklistTemplates = [],
  checklistTemplateItems = [],
  onUpdate 
}) => {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Navigation State
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'checklist'>('details');

  const [currentDate, setCurrentDate] = useState(new Date());
  const [newLocInput, setNewLocInput] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Clarification State
  const [isClarifying, setIsClarifying] = useState(false);
  const [clarificationNote, setClarificationNote] = useState('');

  // Checklist & Template State
  // New Item State is now a map: key = templateId (or 'manual') -> value = item data
  const [newItemsMap, setNewItemsMap] = useState<Record<string, { task_name: string, size: string, quantity: number, notes: string }>>({});
  
  const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState(false);
  
  // Template Management Local State
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedTemplateForEdit, setSelectedTemplateForEdit] = useState<ChecklistTemplate | null>(null);
  const [newTemplateItem, setNewTemplateItem] = useState({ task_name: '', size: '', notes: '' });
  const [editingTemplateNameId, setEditingTemplateNameId] = useState<string | null>(null);
  const [tempTemplateName, setTempTemplateName] = useState('');

  // States for Filtering
  const [filterType, setFilterType] = useState('ALL');
  const [filterPIC, setFilterPIC] = useState('ALL');
  const [filterLocation, setFilterLocation] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [formData, setFormData] = useState<Partial<Project>>({
    project_name: '',
    start_date: '',
    end_date: '',
    locations: [],
    pic_designer_id: designers[0]?.id || '',
    support_designer_ids: [],
    project_type: 'EVENT',
    status: 'ON PROGRESS',
    notes: ''
  });

  const getDesignerName = (id: string) => designers.find(d => d.id === id)?.name || 'N/A';
  
  const uniqueLocations = useMemo(() => {
    const locsSet = new Set<string>();
    projects.forEach(p => {
      const locs = (p as any).locations || (p as any).location;
      if (Array.isArray(locs)) {
        locs.forEach(l => l && locsSet.add(l));
      } else if (typeof locs === 'string' && locs.trim() !== '') {
        locsSet.add(locs.trim());
      }
    });
    return Array.from(locsSet).sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchType = filterType === 'ALL' || p.project_type === filterType;
      const matchPIC = filterPIC === 'ALL' || p.pic_designer_id === filterPIC;
      const locs = (p as any).locations || (p as any).location || [];
      const normalizedLocs = Array.isArray(locs) ? locs : [locs];
      const matchLoc = filterLocation === 'ALL' || normalizedLocs.includes(filterLocation);
      const matchStatus = filterStatus === 'ALL' || p.status === filterStatus;
      return matchType && matchPIC && matchLoc && matchStatus;
    });
  }, [projects, filterType, filterPIC, filterLocation, filterStatus]);

  // CALENDAR LANE LOGIC
  const calendarLanes = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
    const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];

    const visibleProjects = filteredProjects.filter(p => p.start_date <= endOfMonth && p.end_date >= startOfMonth);
    const sorted = [...visibleProjects].sort((a, b) => a.start_date.localeCompare(b.start_date));

    const lanes: Project[][] = [];
    sorted.forEach(project => {
      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        const lastInLane = lanes[i][lanes[i].length - 1];
        if (project.start_date > lastInLane.end_date) {
          lanes[i].push(project);
          placed = true;
          break;
        }
      }
      if (!placed) lanes.push([project]);
    });
    return lanes;
  }, [filteredProjects, currentDate]);

  const handleCopySurveyLink = () => {
    const publicUrl = `${window.location.origin}${window.location.pathname}#/portal/v1/survey/${SURVEY_FORM_SECRET}`;
    navigator.clipboard.writeText(publicUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const toggleSupportDesigner = (id: string) => {
    const current = formData.support_designer_ids || [];
    if (current.includes(id)) {
      setFormData({ ...formData, support_designer_ids: current.filter(sid => sid !== id) });
    } else {
      setFormData({ ...formData, support_designer_ids: [...current, id] });
    }
  };

  const addLocation = () => {
    const val = newLocInput.trim();
    if (!val) return;
    const current = formData.locations || [];
    if (!current.includes(val)) {
      setFormData({ ...formData, locations: [...current, val] });
    }
    setNewLocInput('');
  };

  const removeLocation = (loc: string) => {
    setFormData({ ...formData, locations: (formData.locations || []).filter(l => l !== loc) });
  };

  const resetForm = () => {
    setFormData({
      project_name: '',
      start_date: '',
      end_date: '',
      locations: [],
      pic_designer_id: designers[0]?.id || '',
      support_designer_ids: [],
      project_type: 'EVENT',
      status: 'ON PROGRESS',
      notes: ''
    });
    setEditingId(null);
    setIsAdding(false);
    setNewLocInput('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.project_name || !supabase) return;

    let finalLocations = [...(formData.locations || [])];
    if (newLocInput.trim() && !finalLocations.includes(newLocInput.trim())) {
      finalLocations.push(newLocInput.trim());
    }

    const savePayload = {
      project_name: formData.project_name,
      start_date: formData.start_date,
      end_date: formData.end_date,
      locations: finalLocations,
      pic_designer_id: formData.pic_designer_id,
      support_designer_ids: formData.support_designer_ids || [],
      project_type: formData.project_type,
      status: formData.status,
      notes: formData.notes
    };

    if (editingId) {
      const { error } = await supabase.from('projects').update(savePayload).eq('id', editingId);
      if (error) alert(`Error: ${error.message}`);
      else { onUpdate(); resetForm(); }
    } else {
      const { error } = await supabase.from('projects').insert([savePayload]);
      if (error) alert(`Error: ${error.message}`);
      else { onUpdate(); resetForm(); }
    }
  };

  const handleEdit = (p: Project) => {
    let rawLocs = (p as any).locations || (p as any).location || [];
    let normalizedLocations = Array.isArray(rawLocs) ? rawLocs : (rawLocs ? [rawLocs] : []);

    setFormData({ 
      ...p, 
      support_designer_ids: p.support_designer_ids || [], 
      locations: normalizedLocations 
    });
    setEditingId(p.id);
    setIsAdding(true);
    setView('list');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!supabase || !confirm('Hapus project ini?')) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) alert(error.message);
    else onUpdate();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ON HOLD': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'DONE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const handleDeleteSurvey = async (id: string) => {
    if (!supabase || !confirm("Are you sure you want to delete this evaluation result? This cannot be undone.")) return;
    const { error } = await supabase.from('project_surveys').delete().eq('id', id);
    if (error) alert(error.message);
    else onUpdate();
  };

  const handleSubmitClarification = async (surveyId: string) => {
    if (!supabase || !clarificationNote.trim()) return;
    
    const { error } = await supabase.from('project_surveys').update({
      status: 'CLARIFICATION_REQUESTED',
      clarification_notes: clarificationNote
    }).eq('id', surveyId);

    if (error) alert("Error: " + error.message);
    else {
      setIsClarifying(false);
      setClarificationNote('');
      onUpdate();
    }
  };

  // --- DETAIL VIEW UPDATERS ---
  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedProject || !supabase) return;
    
    // Optimistic Update
    setSelectedProject({ ...selectedProject, status: newStatus as any });
    
    const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', selectedProject.id);
    if (error) {
      alert("Failed to update status: " + error.message);
      onUpdate(); // Revert on fail
    } else {
      onUpdate(); // Sync global
    }
  };

  const handleNotesUpdate = async (newNotes: string) => {
    if (!selectedProject || !supabase) return;
    
    // No need to set state here as the editor maintains it, but we can sync selectedProject if needed
    // The editor calls this on blur.
    
    const { error } = await supabase.from('projects').update({ notes: newNotes }).eq('id', selectedProject.id);
    if (error) {
      console.error("Failed to save notes:", error.message);
    } else {
      // Update local state to reflect saved
      setSelectedProject(prev => prev ? { ...prev, notes: newNotes } : null);
      onUpdate();
    }
  };

  const filteredChecklists = useMemo(() => {
    if (!selectedProject) return [];
    return projectChecklists
      .filter(cl => cl.project_id === selectedProject.id)
      .sort((a, b) => {
        const dateA = a.created_at || '';
        const dateB = b.created_at || '';
        const dateCompare = dateA.localeCompare(dateB);
        if (dateCompare !== 0) return dateCompare;
        return a.id.localeCompare(b.id);
      });
  }, [selectedProject, projectChecklists]);

  const groupedChecklists = useMemo(() => {
    const groups: Record<string, ProjectChecklist[]> = {};
    const manualItems: ProjectChecklist[] = [];
    filteredChecklists.forEach(item => {
      if (item.source_template_id) {
        if (!groups[item.source_template_id]) groups[item.source_template_id] = [];
        groups[item.source_template_id].push(item);
      } else {
        manualItems.push(item);
      }
    });
    return { groups, manualItems };
  }, [filteredChecklists]);

  const sortedActiveTemplateIds = useMemo(() => {
    const ids = Object.keys(groupedChecklists.groups);
    return ids.sort((a, b) => {
      const nameA = checklistTemplates.find(t => t.id === a)?.name || '';
      const nameB = checklistTemplates.find(t => t.id === b)?.name || '';
      return nameA.localeCompare(nameB);
    });
  }, [groupedChecklists, checklistTemplates]);

  const activeTemplatesSet = useMemo(() => new Set(Object.keys(groupedChecklists.groups)), [groupedChecklists]);

  const handleToggleTemplate = async (templateId: string) => {
    if (!selectedProject || !supabase) return;
    if (activeTemplatesSet.has(templateId)) {
      const { error } = await supabase.from('project_checklists').delete().eq('project_id', selectedProject.id).eq('source_template_id', templateId);
      if (error) alert("Error removing template items: " + error.message);
      else onUpdate();
    } else {
      const itemsToAdd = checklistTemplateItems.filter(ti => ti.template_id === templateId).map(ti => ({
          project_id: selectedProject.id,
          task_name: ti.task_name,
          size: ti.size,
          notes: ti.notes,
          quantity: 1,
          status: 'NONE',
          source_template_id: templateId
        }));
      if (itemsToAdd.length === 0) { alert("This template has no items defined."); return; }
      const { error } = await supabase.from('project_checklists').insert(itemsToAdd);
      if (error) alert("Error applying template: " + error.message);
      else onUpdate();
    }
  };

  const handleUpdateChecklistField = async (id: string, field: keyof ProjectChecklist, value: any) => {
    if (!supabase) return;
    const { error } = await supabase.from('project_checklists').update({ [field]: value }).eq('id', id);
    if (error) console.error("Error updating checklist:", error.message);
    else onUpdate();
  };

  const handleDeleteChecklist = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('project_checklists').delete().eq('id', id);
    if (error) alert(error.message);
    else onUpdate();
  };

  const handleAddNewItem = async (templateId: string | null) => {
    if (!selectedProject || !supabase) return;
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
      setNewItemsMap(prev => ({ ...prev, [mapKey]: { task_name: '', size: '', quantity: 1, notes: '' } }));
      onUpdate();
    }
  };

  const updateNewItemState = (templateId: string | null, field: string, value: any) => {
    const mapKey = templateId || 'manual';
    setNewItemsMap(prev => ({ ...prev, [mapKey]: { ...(prev[mapKey] || { task_name: '', size: '', quantity: 1, notes: '' }), [field]: value } }));
  };

  // Template CRUD Handlers (Simplified for brevity)
  const handleAddTemplate = async () => { if (!newTemplateName.trim() || !supabase) return; const { error } = await supabase.from('checklist_templates').insert([{ name: newTemplateName }]); if (error) alert(error.message); else { setNewTemplateName(''); onUpdate(); } };
  const handleEditTemplateNameStart = (template: ChecklistTemplate) => { setEditingTemplateNameId(template.id); setTempTemplateName(template.name); };
  const handleEditTemplateNameSave = async () => { if (!supabase || !editingTemplateNameId) return; const { error } = await supabase.from('checklist_templates').update({ name: tempTemplateName }).eq('id', editingTemplateNameId); if (error) alert(error.message); else { setEditingTemplateNameId(null); onUpdate(); } };
  const handleDeleteTemplate = async (id: string) => { if (!supabase || !confirm("Delete this template and all its items?")) return; const { error } = await supabase.from('checklist_templates').delete().eq('id', id); if (error) alert(error.message); else { if (selectedTemplateForEdit?.id === id) setSelectedTemplateForEdit(null); onUpdate(); } };
  const handleAddTemplateItem = async () => { if (!selectedTemplateForEdit || !newTemplateItem.task_name || !supabase) return; const { error } = await supabase.from('checklist_template_items').insert([{ template_id: selectedTemplateForEdit.id, task_name: newTemplateItem.task_name, size: newTemplateItem.size, notes: newTemplateItem.notes }]); if (error) alert(error.message); else { setNewTemplateItem({ task_name: '', size: '', notes: '' }); onUpdate(); } };
  const handleUpdateTemplateItem = async (itemId: string, field: keyof ChecklistTemplateItem, value: any) => { if (!supabase) return; const { error } = await supabase.from('checklist_template_items').update({ [field]: value }).eq('id', itemId); if (error) console.error("Update failed", error); else onUpdate(); };
  const handleDeleteTemplateItem = async (id: string) => { if (!supabase) return; const { error } = await supabase.from('checklist_template_items').delete().eq('id', id); if (error) alert(error.message); else onUpdate(); };

  // --- RENDERING HELPERS ---
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startDay = new Date(year, month, 1).getDay();
    const todayStr = new Date().toISOString().split('T')[0];
    const days = [];
    
    for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} className="min-h-[160px] bg-slate-100/50 border-r border-b border-slate-200"></div>);
    
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      
      days.push(
        <div key={d} className={`min-h-[160px] h-full border-r border-b border-slate-200 p-0 flex flex-col relative ${isToday ? 'bg-indigo-50/30' : 'bg-white'}`}>
          <div className="p-2 flex-shrink-0">
            <span className={`text-[10px] font-black inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>{d}</span>
          </div>
          <div className="flex flex-col space-y-1 pb-2 flex-1">
            {calendarLanes.map((lane, laneIdx) => {
              const project = lane.find(p => dateStr >= p.start_date && dateStr <= p.end_date);
              if (!project) return <div key={`spacer-${laneIdx}`} className="min-h-[58px] py-1.5 w-full"></div>;
              const themes = [{ bg: 'bg-blue-50', border: 'border-blue-600', text: 'text-blue-900' }, { bg: 'bg-amber-50', border: 'border-amber-600', text: 'text-amber-900' }, { bg: 'bg-emerald-50', border: 'border-emerald-600', text: 'text-emerald-900' }, { bg: 'bg-rose-50', border: 'border-rose-600', text: 'text-rose-900' }];
              const theme = themes[Math.abs(project.id.split('').reduce((a,b)=>a+b.charCodeAt(0),0)) % themes.length];
              const isStart = dateStr === project.start_date;
              return (
                <div key={project.id} onClick={() => { setSelectedProject(project); setActiveTab('details'); }} className={`cursor-pointer min-h-[58px] py-1.5 flex flex-col justify-center px-2 overflow-hidden transition-all hover:brightness-95 ${theme.bg} ${theme.text} ${isStart ? `rounded-l-md ml-1 border-l-4 ${theme.border}` : ''} ${dateStr === project.end_date ? 'rounded-r-md mr-1' : ''}`}>
                  <span className="text-[10px] font-black truncate uppercase">{project.project_name}</span>
                  <span className="text-[8px] font-black opacity-80 mt-0.5 truncate uppercase">PIC: {getDesignerName(project.pic_designer_id)}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return days;
  };

  const labelClass = "text-[11px] font-black text-slate-900 uppercase mb-1.5 block tracking-wide";
  const inputClass = "w-full rounded-lg border-slate-300 text-slate-900 text-sm p-3 border bg-white focus:ring-2 focus:ring-indigo-600 outline-none placeholder-slate-400 font-semibold shadow-sm transition-all";
  
  // Style for Compact Table Input (Always Editable)
  const cellInputClass = "w-full bg-transparent border-b border-transparent focus:border-indigo-600 outline-none text-xs font-bold text-slate-700 py-1 px-1 transition-colors placeholder-slate-300";
  const newRowInputClass = "w-full bg-white border border-slate-200 rounded-sm focus:border-indigo-600 outline-none text-xs text-slate-700 py-1.5 px-2";

  // === RENDER DETAIL VIEW ===
  if (selectedProject) {
    return (
      <div className="flex flex-col h-full animate-in slide-in-from-right duration-300 relative">
        {/* TEMPLATE MANAGER MODAL (Preserved) */}
        {isManageTemplatesOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsManageTemplatesOpen(false)}>
             {/* ... Same as original ... */}
             <div className="bg-white w-full max-w-6xl h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Manage Checklist Templates</h3>
                <button onClick={() => setIsManageTemplatesOpen(false)} className="p-2 bg-white rounded-lg hover:bg-slate-200 text-slate-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
              </div>
              
              <div className="flex flex-1 overflow-hidden">
                <div className="w-80 border-r border-slate-200 bg-white p-4 flex flex-col flex-shrink-0">
                   <div className="flex gap-2 mb-4">
                      <input type="text" placeholder="New Template Name" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} className="w-full text-xs font-bold p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none" />
                      <button onClick={handleAddTemplate} className="px-4 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-indigo-700">Add</button>
                   </div>
                   <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                     {checklistTemplates.map(t => (
                       <div key={t.id} onClick={() => setSelectedTemplateForEdit(t)} className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center group transition-all ${selectedTemplateForEdit?.id === t.id ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200' : 'bg-slate-50 border-slate-200 hover:border-indigo-300 hover:bg-white'}`}>
                          {editingTemplateNameId === t.id ? (
                            <div className="flex items-center gap-1 w-full">
                              <input 
                                className="w-full text-xs font-bold p-1 border border-indigo-300 rounded bg-white"
                                value={tempTemplateName}
                                onChange={(e) => setTempTemplateName(e.target.value)}
                                onBlur={handleEditTemplateNameSave}
                                onKeyDown={(e) => e.key === 'Enter' && handleEditTemplateNameSave()}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                              <span className="text-xs font-black text-slate-800 uppercase truncate">{t.name}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                             <button onClick={(e) => { e.stopPropagation(); handleEditTemplateNameStart(t); }} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-100 rounded">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                             </button>
                             <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                             </button>
                          </div>
                       </div>
                     ))}
                   </div>
                </div>

                <div className="flex-1 p-8 bg-slate-50 overflow-y-auto">
                   {selectedTemplateForEdit ? (
                     <div className="space-y-8 max-w-4xl mx-auto">
                        <div className="flex justify-between items-end border-b border-slate-200 pb-4">
                          <div>
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Editing Template</span>
                             <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{selectedTemplateForEdit.name}</h4>
                          </div>
                          <span className="text-xs font-bold text-slate-500 bg-slate-200 px-3 py-1 rounded-full">{checklistTemplateItems.filter(ti => ti.template_id === selectedTemplateForEdit.id).length} Items</span>
                        </div>
                        
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-4 gap-3">
                           <input type="text" placeholder="Design Name" value={newTemplateItem.task_name} onChange={e => setNewTemplateItem({...newTemplateItem, task_name: e.target.value})} className="col-span-2 text-xs font-bold p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none" />
                           <input type="text" placeholder="Size (e.g. A4)" value={newTemplateItem.size} onChange={e => setNewTemplateItem({...newTemplateItem, size: e.target.value})} className="col-span-1 text-xs font-bold p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none" />
                           <button onClick={handleAddTemplateItem} className="col-span-1 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wide shadow-md hover:bg-indigo-700 transition-all">Add Item</button>
                           <input type="text" placeholder="Default Notes (Optional)" value={newTemplateItem.notes} onChange={e => setNewTemplateItem({...newTemplateItem, notes: e.target.value})} className="col-span-4 text-xs font-bold p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none" />
                        </div>

                        <div className="space-y-3">
                           {checklistTemplateItems.filter(ti => ti.template_id === selectedTemplateForEdit.id).map(ti => (
                             <div key={ti.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-start gap-4 hover:shadow-md transition-shadow group">
                                <div className="flex-1 grid grid-cols-12 gap-4">
                                   <div className="col-span-5">
                                      <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Item Name</span>
                                      <input 
                                        className="w-full text-sm font-black text-slate-900 uppercase bg-transparent border-b border-transparent focus:border-indigo-500 outline-none pb-1 transition-colors"
                                        defaultValue={ti.task_name}
                                        onBlur={(e) => handleUpdateTemplateItem(ti.id, 'task_name', e.target.value)}
                                        placeholder="Item Name"
                                      />
                                   </div>
                                   <div className="col-span-3">
                                      <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Size</span>
                                      <input 
                                        className="w-full text-xs font-bold text-slate-600 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none pb-1 transition-colors"
                                        defaultValue={ti.size}
                                        onBlur={(e) => handleUpdateTemplateItem(ti.id, 'size', e.target.value)}
                                        placeholder="Size"
                                      />
                                   </div>
                                   <div className="col-span-4">
                                      <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Default Notes</span>
                                      <input 
                                        className="w-full text-xs font-medium text-slate-500 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none pb-1 transition-colors italic"
                                        defaultValue={ti.notes}
                                        onBlur={(e) => handleUpdateTemplateItem(ti.id, 'notes', e.target.value)}
                                        placeholder="Notes"
                                      />
                                   </div>
                                </div>
                                <button onClick={() => handleDeleteTemplateItem(ti.id)} className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all self-center opacity-0 group-hover:opacity-100">
                                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                             </div>
                           ))}
                           {checklistTemplateItems.filter(ti => ti.template_id === selectedTemplateForEdit.id).length === 0 && (
                             <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                                <p className="text-slate-400 text-sm font-bold italic">No items in this template yet.</p>
                                <p className="text-slate-300 text-xs mt-1">Use the form above to add checklist items.</p>
                             </div>
                           )}
                        </div>
                     </div>
                   ) : (
                     <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                        <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-4xl">📝</div>
                        <h4 className="text-xl font-black text-slate-400 uppercase">No Template Selected</h4>
                        <p className="text-slate-400 text-sm font-medium mt-2">Select a template from the sidebar to manage its items.</p>
                     </div>
                   )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header Navigation & Status - Redesigned */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button onClick={() => setSelectedProject(null)} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            </button>
            <div>
               <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{selectedProject.project_name}</h1>
               <p className="text-xs font-bold text-slate-500 uppercase">Timeline: {selectedProject.start_date} → {selectedProject.end_date} &bull; Type: {selectedProject.project_type}</p>
            </div>
          </div>
          
          {/* Bigger Status Dropdown positioned to the right */}
          <div className="w-full md:w-auto">
             <select 
                value={selectedProject.status} 
                onChange={(e) => handleStatusUpdate(e.target.value)}
                className={`w-full md:w-48 px-4 py-2.5 rounded-xl border-2 text-sm font-black uppercase outline-none cursor-pointer hover:opacity-90 transition-all shadow-sm appearance-none text-center ${
                  selectedProject.status === 'DONE' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 
                  selectedProject.status === 'ON HOLD' ? 'bg-amber-100 text-amber-800 border-amber-300' : 
                  'bg-blue-100 text-blue-800 border-blue-300'
                }`}
              >
                <option value="ON PROGRESS">ON PROGRESS</option>
                <option value="ON HOLD">ON HOLD</option>
                <option value="DONE">DONE</option>
              </select>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-6">
          <button 
            onClick={() => setActiveTab('details')}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${activeTab === 'details' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Project Details
          </button>
          <button 
            onClick={() => setActiveTab('checklist')}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${activeTab === 'checklist' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Design Checklist
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
               {/* Metadata Column */}
               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Information</h3>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">PIC Designer</span>
                      <p className="font-bold text-slate-800 uppercase flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-600"></span>{getDesignerName(selectedProject.pic_designer_id)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Support Team</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedProject.support_designer_ids && selectedProject.support_designer_ids.length > 0 ? selectedProject.support_designer_ids.map(sid => (
                          <span key={sid} className="px-2 py-0.5 bg-slate-50 text-slate-600 text-[9px] font-black rounded border border-slate-200 uppercase">{getDesignerName(sid)}</span>
                        )) : <span className="text-xs text-slate-400 italic">No support</span>}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Locations</span>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray((selectedProject as any).locations) && (selectedProject as any).locations.length > 0 ? (selectedProject as any).locations.map((loc:string) => <span key={loc} className="px-2 py-1 bg-slate-50 text-[10px] font-black rounded border uppercase">{loc}</span>) : (typeof (selectedProject as any).locations === 'string' && (selectedProject as any).locations ? <span className="px-2 py-1 bg-slate-100 text-[10px] font-black rounded border uppercase">{(selectedProject as any).locations}</span> : <p className="font-bold text-slate-400 text-xs italic">HQ</p>)}
                      </div>
                    </div>
                  </div>
               </div>

               {/* Notes Column */}
               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit lg:col-span-2 min-h-[350px] flex flex-col">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Notes & Updates</h3>
                  <div className="flex-1 flex flex-col">
                    <SimpleRichTextEditor 
                      initialValue={selectedProject.notes || ''} 
                      onSave={handleNotesUpdate}
                      placeholder="Write project notes here (bold, lists supported)..."
                    />
                  </div>
               </div>

               {/* Survey Section */}
               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-3">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Post-Project Evaluation</h3>
                    {!projectSurveys.find(s => s.project_id === selectedProject.id) && (
                      <button onClick={handleCopySurveyLink} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Copy Survey Link</button>
                    )}
                  </div>

                  {(() => {
                      const survey = projectSurveys.find(s => s.project_id === selectedProject.id);
                      if (!survey) {
                        return (
                          <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center">
                            <p className="text-xs font-bold text-slate-400 italic mb-2">No evaluation submitted yet.</p>
                            <p className="text-[10px] text-slate-400">Send the survey link to the project manager after completion.</p>
                          </div>
                        );
                      }
                      
                      const isRequested = survey.status === 'CLARIFICATION_REQUESTED';

                      return (
                        <div className="flex flex-col gap-6">
                           {isRequested && (
                             <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3">
                               <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                               </div>
                               <div>
                                 <p className="text-xs font-black text-amber-800 uppercase">Pending Client Update</p>
                                 <p className="text-xs text-amber-700 mt-0.5">Waiting for the client to revise their evaluation based on your clarification request.</p>
                               </div>
                             </div>
                           )}

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                  {Object.entries(SURVEY_LABELS).slice(0, 4).map(([key, label]) => {
                                    const score = (survey as any)[key];
                                    let color = 'bg-slate-100 text-slate-500';
                                    if (score === 3) color = 'bg-emerald-100 text-emerald-700';
                                    else if (score === 2) color = 'bg-blue-100 text-blue-700';
                                    else if (score === 1) color = 'bg-amber-100 text-amber-700';
                                    return (
                                      <div key={key} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase pr-2">{label}</span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${color}`}>{score} / 3</span>
                                      </div>
                                    );
                                  })}
                              </div>
                              <div className="space-y-2">
                                  {Object.entries(SURVEY_LABELS).slice(4).map(([key, label]) => {
                                    const score = (survey as any)[key];
                                    let color = 'bg-slate-100 text-slate-500';
                                    if (score === 3) color = 'bg-emerald-100 text-emerald-700';
                                    else if (score === 2) color = 'bg-blue-100 text-blue-700';
                                    else if (score === 1) color = 'bg-amber-100 text-amber-700';
                                    return (
                                      <div key={key} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase pr-2">{label}</span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${color}`}>{score} / 3</span>
                                      </div>
                                    );
                                  })}
                                  {survey.notes && (
                                    <div className="mt-2 text-[10px] text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-200">
                                      <strong>Client Notes:</strong> "{survey.notes}"
                                    </div>
                                  )}
                              </div>
                           </div>

                           {/* Request Clarification Section */}
                           {!isRequested && (
                             <div className="pt-4 border-t border-slate-100 mt-2">
                                {isClarifying ? (
                                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Internal Note for Clarification</label>
                                    <textarea 
                                      className="w-full text-xs font-medium p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none mb-3"
                                      placeholder="Explain what needs to be revised..."
                                      rows={3}
                                      value={clarificationNote}
                                      onChange={(e) => setClarificationNote(e.target.value)}
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button onClick={() => setIsClarifying(false)} className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-200 rounded">Cancel</button>
                                      <button onClick={() => handleSubmitClarification(survey.id)} className="px-4 py-1.5 text-[10px] font-black uppercase bg-amber-500 text-white rounded shadow-sm hover:bg-amber-600">Send Request</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex justify-between items-center">
                                    <div className="text-[10px] text-slate-400 italic">Is this evaluation inaccurate?</div>
                                    <div className="flex gap-4">
                                      <button onClick={() => handleDeleteSurvey(survey.id)} className="text-red-400 hover:text-red-600 text-[10px] font-black uppercase">Delete Result</button>
                                      <button onClick={() => setIsClarifying(true)} className="text-amber-500 hover:text-amber-700 text-[10px] font-black uppercase bg-amber-50 px-3 py-1.5 rounded border border-amber-100 hover:border-amber-300 transition-all">Request Clarification</button>
                                    </div>
                                  </div>
                                )}
                             </div>
                           )}
                        </div>
                      );
                  })()}
               </div>
            </div>
          )}

          {/* ... Checklist Tab Content (Unchanged) ... */}
          {activeTab === 'checklist' && (
             <div className="grid grid-cols-1 gap-6 animate-in fade-in duration-300">
                {/* ... existing checklist code ... */}
                {/* TEMPLATE SECTION */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 flex-wrap">
                   <div className="flex items-center gap-2">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Templates:</span>
                     <button onClick={() => setIsManageTemplatesOpen(true)} className="text-[10px] font-bold text-indigo-600 underline hover:text-indigo-800">Manage</button>
                   </div>
                   <div className="h-6 w-px bg-slate-200 mx-2"></div>
                   <div className="flex flex-wrap gap-2">
                     {checklistTemplates.map(t => {
                       const isActive = activeTemplatesSet.has(t.id);
                       return (
                         <button 
                            key={t.id}
                            onClick={() => handleToggleTemplate(t.id)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${
                              isActive 
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300'
                            }`}
                         >
                           {t.name} {isActive && '✓'}
                         </button>
                       );
                     })}
                     {checklistTemplates.length === 0 && <span className="text-[10px] text-slate-400 italic">No templates available. Create one in 'Manage'.</span>}
                   </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5 text-center w-10 text-[10px] font-bold text-slate-500 uppercase tracking-wider">#</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Design Spec</th>
                        <th className="px-3 py-2.5 w-32 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Size</th>
                        <th className="px-3 py-2.5 text-center w-16 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notes</th>
                        <th className="px-3 py-2.5 w-32 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-3 py-2.5 text-right w-16 text-[10px] font-bold text-slate-500 uppercase tracking-wider"></th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700">
                      {/* RENDER TEMPLATE GROUPS */}
                      {sortedActiveTemplateIds.map(templateId => {
                        const items = groupedChecklists.groups[templateId] || [];
                        const templateName = checklistTemplates.find(t => t.id === templateId)?.name || 'Unknown Template';
                        const newItemState = newItemsMap[templateId] || { task_name: '', size: '', quantity: 1, notes: '' };

                        return (
                          <React.Fragment key={templateId}>
                            {/* DIVIDER ROW */}
                            <tr className="bg-indigo-50 border-y border-indigo-100">
                              <td colSpan={7} className="px-3 py-1.5">
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
                                cellInputClass={cellInputClass} 
                                onUpdate={handleUpdateChecklistField} 
                                onDelete={handleDeleteChecklist} 
                              />
                            ))}
                            {/* Add Item Row for this Template */}
                            <AddRow 
                              newItem={newItemState}
                              updateNewItem={(field, val) => updateNewItemState(templateId, field, val)}
                              onAdd={() => handleAddNewItem(templateId)}
                              newRowInputClass={newRowInputClass}
                            />
                          </React.Fragment>
                        );
                      })}

                      {/* RENDER MANUAL / ADDITIONAL ITEMS */}
                      <React.Fragment key="manual">
                        <tr className="bg-slate-100 border-y border-slate-200">
                          <td colSpan={7} className="px-3 py-1.5">
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
                            cellInputClass={cellInputClass} 
                            onUpdate={handleUpdateChecklistField} 
                            onDelete={handleDeleteChecklist} 
                          />
                        ))}
                        {/* Add Item Row for Manual */}
                        <AddRow 
                          newItem={newItemsMap['manual'] || { task_name: '', size: '', quantity: 1, notes: '' }}
                          updateNewItem={(field, val) => updateNewItemState(null, field, val)}
                          onAdd={() => handleAddNewItem(null)}
                          newRowInputClass={newRowInputClass}
                        />
                      </React.Fragment>
                    </tbody>
                  </table>
                </div>
             </div>
          )}
        </div>
      </div>
    );
  }

  // ... (Rest of the component remains unchanged) ...
  return (
    <div className="space-y-6 flex flex-col h-full relative">
      {/* ... (Header and View Toggle logic preserved) ... */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Project Master</h1>
          <p className="text-slate-600 text-sm mt-1 font-bold">Manage event project timelines.</p>
        </div>
        <div className="flex items-center gap-4">
           {/* Copy Survey Link Button */}
          <button onClick={handleCopySurveyLink} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 border ${copySuccess ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-300 text-slate-700 hover:border-indigo-500'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
            {copySuccess ? 'Survey Link Copied!' : 'Eval Survey Link'}
          </button>
          
          <div className="flex bg-slate-200 p-1 rounded-xl">
            <button onClick={() => setView('list')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${view === 'list' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}>List</button>
            <button onClick={() => setView('calendar')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${view === 'calendar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}>Calendar</button>
          </div>
          {!isAdding && view === 'list' && (
            <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-black shadow-lg">Add Project</button>
          )}
        </div>
      </header>

      {/* FILTER BAR */}
      <div className="bg-slate-100 p-4 rounded-2xl flex flex-wrap items-center gap-4 border border-slate-200">
        {[['Status', filterStatus, setFilterStatus, ['ALL', 'ON PROGRESS', 'ON HOLD', 'DONE']], ['Type', filterType, setFilterType, ['ALL', 'EVENT', 'TRAVEL', 'WELLNESS', 'CREATIVE', 'TRAINING']], ['PIC', filterPIC, setFilterPIC, ['ALL', ...designers.map(d=>d.id)]], ['Location', filterLocation, setFilterLocation, ['ALL', ...uniqueLocations]]].map(([lbl, val, set, opts]: any) => (
          <div key={lbl as string} className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{lbl as string}</span>
            <select value={val as string} onChange={e => (set as any)(e.target.value)} className="text-[10px] font-bold border-slate-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500 uppercase tracking-tighter cursor-pointer">
              {opts.map((o:any) => <option key={o} value={o}>{o === 'ALL' ? `All ${lbl}` : (lbl === 'PIC' ? getDesignerName(o) : o)}</option>)}
            </select>
          </div>
        ))}
      </div>

      {isAdding && (
        <form onSubmit={handleSave} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl animate-in zoom-in duration-200 flex-shrink-0 mb-6">
          <h2 className="font-black text-slate-900 mb-8 uppercase tracking-tight flex items-center gap-2"><span className="w-2 h-2 bg-indigo-600 rounded-full"></span>{editingId ? 'Edit Project' : 'New Project'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className="md:col-span-2"><label className={labelClass}>Project Name</label><input type="text" required value={formData.project_name} onChange={e => setFormData({...formData, project_name: e.target.value})} className={inputClass} placeholder="Annual Event 2024" /></div>
            <div><label className={labelClass}>Status</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className={inputClass}><option value="ON PROGRESS">ON PROGRESS</option><option value="ON HOLD">ON HOLD</option><option value="DONE">DONE</option></select></div>
            <div><label className={labelClass}>Project Type</label><select value={formData.project_type} onChange={e => setFormData({...formData, project_type: e.target.value})} className={inputClass}><option value="EVENT">EVENT</option><option value="TRAVEL">TRAVEL</option><option value="WELLNESS">WELLNESS</option><option value="CREATIVE">CREATIVE</option><option value="TRAINING">TRAINING</option></select></div>
            <div><label className={labelClass}>Start Date</label><input type="date" required value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className={inputClass} /></div>
            <div><label className={labelClass}>End Date</label><input type="date" required value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className={inputClass} /></div>
            
            <div className="md:col-span-1">
              <label className={labelClass}>Locations (Dropdown Saran Lokasi + Manual)</label>
              <div className="flex gap-2 mb-2">
                <input type="text" list="loc-suggestions" placeholder="Pilih/Ketik..." value={newLocInput} onChange={e => setNewLocInput(e.target.value)} className={inputClass} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLocation())} />
                <button type="button" onClick={addLocation} className="px-5 bg-slate-900 text-white rounded-lg text-sm font-black uppercase tracking-widest">ADD</button>
              </div>
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[58px] items-center">
                {formData.locations?.map(loc => (
                  <span key={loc} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 text-slate-800 rounded-lg text-[10px] font-black uppercase shadow-sm">
                    {loc}
                    <button type="button" onClick={() => removeLocation(loc)} className="text-red-500"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button>
                  </span>
                ))}
              </div>
              <datalist id="loc-suggestions">{uniqueLocations.map(loc => <option key={loc} value={loc} />)}</datalist>
            </div>

            <div><label className={labelClass}>PIC Designer</label><select value={formData.pic_designer_id} onChange={e => setFormData({...formData, pic_designer_id: e.target.value})} className={inputClass}>{designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            
            <div className="md:col-span-1">
              <label className={labelClass}>Support Designers</label>
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[58px]">
                {designers.map(d => {
                  if (d.id === formData.pic_designer_id) return null;
                  const isSelected = formData.support_designer_ids?.includes(d.id);
                  return (
                    <button key={d.id} type="button" onClick={() => toggleSupportDesigner(d.id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-300 text-slate-500 hover:border-indigo-400'}`}>
                      {d.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-3">
              <label className={labelClass}>Notes / Keterangan</label>
              <SimpleRichTextEditor 
                initialValue={formData.notes || ''} 
                onSave={(val) => setFormData({...formData, notes: val})} 
                placeholder="Catatan project (bisa format list, bold, dll)..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
            <button type="button" onClick={resetForm} className="px-6 py-2.5 text-sm font-black text-slate-700 uppercase">Cancel</button>
            <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-black shadow-lg uppercase tracking-widest">{editingId ? 'Update' : 'Save'}</button>
          </div>
        </form>
      )}

      <div className="flex-1 min-h-0">
        {view === 'list' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="overflow-y-auto max-h-full">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr><th className="px-6 py-4">Status & Name</th><th className="px-6 py-4">Timeline & Loc</th><th className="px-6 py-4">Lead & Team</th><th className="px-6 py-4 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-bold text-slate-900">
                  {filteredProjects.map(p => {
                    const locs = (p as any).locations || (p as any).location || [];
                    const normalizedLocs = Array.isArray(locs) ? locs : [locs];
                    return (
                      <tr key={p.id} onClick={() => { setSelectedProject(p); setActiveTab('details'); }} className="hover:bg-slate-50 transition-colors cursor-pointer">
                        <td className="px-6 py-4"><div className="flex flex-col gap-2"><span className={`px-2 py-0.5 rounded-full border text-[8px] font-black uppercase self-start ${getStatusBadge(p.status)}`}>{p.status}</span><span className="font-black uppercase">{p.project_name}</span></div></td>
                        <td className="px-6 py-4"><div className="flex flex-col"><span className="text-[11px] font-black">{p.start_date} → {p.end_date}</span><div className="flex flex-wrap gap-1 mt-1">{normalizedLocs.map(l => <span key={l} className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded border uppercase">{l}</span>)}</div></div></td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-indigo-600 rounded-full"></span><span className="text-xs uppercase">{getDesignerName(p.pic_designer_id)}</span></div>
                            <div className="flex flex-wrap gap-1">
                              {p.support_designer_ids?.map(sid => (
                                <span key={sid} className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 text-[8px] rounded uppercase font-bold text-slate-400">{getDesignerName(sid)}</span>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right"><div className="flex justify-end gap-4"><button onClick={(e) => { e.stopPropagation(); handleEdit(p); }} className="text-indigo-700 text-[10px] font-black uppercase">Edit</button><button onClick={(e) => { e.stopPropagation(); handleDelete(e, p.id); }} className="text-red-500 text-[10px] font-black uppercase">Delete</button></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between"><h3 className="font-black text-slate-900 text-sm uppercase">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3><div className="flex gap-2"><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1))} className="p-1.5 hover:bg-slate-300 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg></button><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1))} className="p-1.5 hover:bg-slate-300 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg></button></div></div>
            <div className="overflow-y-auto flex-1"><div className="grid grid-cols-7 border-l border-slate-200">{renderCalendar()}</div></div>
          </div>
        )}
      </div>
    </div>
  );
};

// ... (Sub-components TableRow and AddRow remain unchanged) ...
const TableRow = ({ cl, idx, cellInputClass, onUpdate, onDelete }: any) => (
  <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
    <td className="px-3 py-2 text-center text-slate-400 font-medium">{idx + 1}</td>
    <td className="px-3 py-2 relative">
       <div className="flex items-center gap-2">
          <input 
            className={cellInputClass}
            defaultValue={cl.task_name}
            onBlur={(e) => onUpdate(cl.id, 'task_name', e.target.value)}
            placeholder="Task Name"
          />
       </div>
    </td>
    <td className="px-3 py-2">
      <input 
        className={cellInputClass}
        defaultValue={cl.size || ''}
        onBlur={(e) => onUpdate(cl.id, 'size', e.target.value)}
        placeholder="Size"
      />
    </td>
    <td className="px-3 py-2 text-center">
      <input 
        type="number"
        className={`${cellInputClass} text-center`}
        defaultValue={cl.quantity}
        onBlur={(e) => onUpdate(cl.id, 'quantity', parseInt(e.target.value) || 0)}
      />
    </td>
    <td className="px-3 py-2">
      <input 
        className={cellInputClass}
        defaultValue={cl.notes || ''}
        onBlur={(e) => onUpdate(cl.id, 'notes', e.target.value)}
        placeholder="Notes"
      />
    </td>
    <td className="px-3 py-2">
      <select 
        value={cl.status} 
        onChange={(e) => onUpdate(cl.id, 'status', e.target.value)}
        className={`w-full text-[10px] font-bold uppercase rounded py-1 px-1 outline-none cursor-pointer transition-colors bg-transparent hover:bg-slate-100 ${
          cl.status === 'DONE' ? 'text-emerald-600' :
          cl.status === 'ON PROGRESS' ? 'text-amber-600' :
          'text-slate-400'
        }`}
      >
        <option value="NONE">Not Started</option>
        <option value="ON PROGRESS">On Progress</option>
        <option value="DONE">Done</option>
      </select>
    </td>
    <td className="px-3 py-2 text-right">
      <button onClick={() => onDelete(cl.id)} className="text-slate-300 hover:text-red-500 text-[10px] font-black uppercase transition-colors p-1 opacity-0 group-hover:opacity-100" title="Delete">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </td>
  </tr>
);

const AddRow = ({ newItem, updateNewItem, onAdd, newRowInputClass }: any) => (
  <tr className="bg-slate-50/50 hover:bg-slate-50 transition-colors">
    <td className="px-3 py-2 text-center text-indigo-300 font-black">+</td>
    <td className="px-3 py-2">
      <input 
        placeholder="Add New Item..." 
        className={newRowInputClass}
        value={newItem.task_name}
        onChange={e => updateNewItem('task_name', e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onAdd()}
      />
    </td>
    <td className="px-3 py-2">
      <input 
        placeholder="Size" 
        className={newRowInputClass}
        value={newItem.size}
        onChange={e => updateNewItem('size', e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onAdd()}
      />
    </td>
    <td className="px-3 py-2">
      <input 
        type="number"
        placeholder="1" 
        className={`${newRowInputClass} text-center`}
        value={newItem.quantity}
        onChange={e => updateNewItem('quantity', parseInt(e.target.value) || 0)}
        onKeyDown={e => e.key === 'Enter' && onAdd()}
      />
    </td>
    <td className="px-3 py-2">
      <input 
        placeholder="Notes..." 
        className={newRowInputClass}
        value={newItem.notes}
        onChange={e => updateNewItem('notes', e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onAdd()}
      />
    </td>
    <td className="px-3 py-2">
       <span className="text-[10px] font-bold text-slate-400 italic pl-2">Pending</span>
    </td>
    <td className="px-3 py-2 text-right">
      <button onClick={onAdd} className="text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded text-[10px] font-black uppercase hover:bg-indigo-100 transition-colors">
        Add
      </button>
    </td>
  </tr>
);

export default ProjectMaster;
