
import React, { useState, useMemo, useRef } from 'react';
import { Project, Designer, ProjectSurvey, ProjectChecklist } from '../types';
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
  rating_agility: 'Agility terhadap Perubahan'
};

interface Props {
  projects: Project[];
  designers: Designer[];
  projectSurveys?: ProjectSurvey[];
  projectChecklists?: ProjectChecklist[];
  onUpdate: () => void;
}

const ProjectMaster: React.FC<Props> = ({ projects, designers, projectSurveys = [], projectChecklists = [], onUpdate }) => {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'checklist'>('details');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [newLocInput, setNewLocInput] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Checklist Edit State
  const [clEditingId, setClEditingId] = useState<string | null>(null);
  const [checklistForm, setChecklistForm] = useState<Partial<ProjectChecklist>>({
    task_name: '', size: '', quantity: 1, notes: '', status: 'NONE'
  });

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
  
  // Ambil semua lokasi unik dari data project yang ada untuk dropdown saran
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

  // --- SURVEY HANDLERS ---
  const handleDeleteSurvey = async (id: string) => {
    if (!supabase || !confirm("Are you sure you want to delete this evaluation result? This cannot be undone.")) return;
    const { error } = await supabase.from('project_surveys').delete().eq('id', id);
    if (error) alert(error.message);
    else onUpdate();
  };

  // --- CHECKLIST HANDLERS ---
  const filteredChecklists = useMemo(() => {
    if (!selectedProject) return [];
    return projectChecklists.filter(cl => cl.project_id === selectedProject.id);
  }, [selectedProject, projectChecklists]);

  const handleSaveChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !supabase) return;

    const payload = {
      project_id: selectedProject.id,
      task_name: checklistForm.task_name,
      size: checklistForm.size,
      quantity: checklistForm.quantity,
      notes: checklistForm.notes,
      status: checklistForm.status || 'NONE'
    };

    if (clEditingId) {
      const { error } = await supabase.from('project_checklists').update(payload).eq('id', clEditingId);
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.from('project_checklists').insert([payload]);
      if (error) alert(error.message);
    }
    
    // Reset Checklist Form
    setChecklistForm({ task_name: '', size: '', quantity: 1, notes: '', status: 'NONE' });
    setClEditingId(null);
    onUpdate();
  };

  const handleEditChecklist = (cl: ProjectChecklist) => {
    setChecklistForm(cl);
    setClEditingId(cl.id);
  };

  const handleDeleteChecklist = async (id: string) => {
    if (!supabase || !confirm("Delete this item?")) return;
    const { error } = await supabase.from('project_checklists').delete().eq('id', id);
    if (error) alert(error.message);
    else onUpdate();
  };

  const handleStatusChangeChecklist = async (id: string, status: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('project_checklists').update({ status }).eq('id', id);
    if (error) alert(error.message);
    else onUpdate();
  };

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

  return (
    <div className="space-y-6 flex flex-col h-full relative">
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

            <div className="md:col-span-3"><label className={labelClass}>Notes / Keterangan</label><textarea rows={3} value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} className={inputClass} placeholder="Catatan project..." /></div>
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

      {/* SELECTED PROJECT MODAL (Overlay) */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-slate-900/40" onClick={() => setSelectedProject(null)}>
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl p-0 animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-start flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase ${getStatusBadge(selectedProject.status)}`}>{selectedProject.status}</span>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 uppercase leading-none">{selectedProject.project_name}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Timeline: {selectedProject.start_date} → {selectedProject.end_date}</p>
                </div>
              </div>
              <button onClick={() => setSelectedProject(null)} className="p-1.5 text-slate-400 hover:text-slate-900 bg-white rounded-lg border border-slate-200"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 bg-white flex-shrink-0 px-6">
              <button 
                onClick={() => setActiveTab('details')}
                className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'details' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                Project Details
              </button>
              <button 
                onClick={() => setActiveTab('checklist')}
                className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'checklist' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                Design Checklist
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {activeTab === 'details' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-2 gap-6">
                    <div><span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">PIC Designer</span><p className="font-bold text-slate-800 uppercase flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-600"></span>{getDesignerName(selectedProject.pic_designer_id)}</p></div>
                    <div><span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Support Team</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedProject.support_designer_ids && selectedProject.support_designer_ids.length > 0 ? selectedProject.support_designer_ids.map(sid => (
                          <span key={sid} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-black rounded border border-slate-200 uppercase">{getDesignerName(sid)}</span>
                        )) : <span className="text-xs text-slate-400 italic">No support</span>}
                      </div>
                    </div>
                  </div>
                  <div><span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Locations</span><div className="flex flex-wrap gap-2">{Array.isArray((selectedProject as any).locations) && (selectedProject as any).locations.length > 0 ? (selectedProject as any).locations.map((loc:string) => <span key={loc} className="px-2 py-1 bg-slate-100 text-[10px] font-black rounded border uppercase">{loc}</span>) : (typeof (selectedProject as any).locations === 'string' && (selectedProject as any).locations ? <span className="px-2 py-1 bg-slate-100 text-[10px] font-black rounded border uppercase">{(selectedProject as any).locations}</span> : <p className="font-bold text-slate-400 text-xs italic">HQ</p>)}</div></div>
                  <div><span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Notes / Keterangan</span><div className="p-4 bg-slate-50 rounded-xl text-sm italic text-slate-700 whitespace-pre-wrap border border-slate-100">{selectedProject.notes || 'No notes.'}</div></div>
                  
                  {/* SURVEY EVALUATION */}
                  <div className="pt-6 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                         Post-Project Evaluation
                      </h3>
                    </div>

                    {(() => {
                      const survey = projectSurveys.find(s => s.project_id === selectedProject.id);
                      if (!survey) {
                        return (
                          <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center">
                            <p className="text-[10px] font-bold text-slate-400 italic">No evaluation submitted yet.</p>
                            <button onClick={handleCopySurveyLink} className="mt-2 text-[9px] font-black text-indigo-600 uppercase hover:underline">Copy Survey Link</button>
                          </div>
                        );
                      }
                      return (
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 relative">
                          <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
                            <div className="text-[9px] font-bold text-slate-400 uppercase">Submitted: {new Date(survey!.created_at).toLocaleDateString()}</div>
                            <button onClick={() => handleDeleteSurvey(survey!.id)} className="text-red-500 text-[9px] font-black uppercase hover:underline">Delete Result</button>
                          </div>
                          <div className="grid grid-cols-1 gap-y-2">
                            {Object.entries(SURVEY_LABELS).map(([key, label]) => {
                               const score = (survey as any)[key];
                               let color = 'bg-slate-200 text-slate-500';
                               if (score === 3) color = 'bg-emerald-100 text-emerald-700';
                               else if (score === 2) color = 'bg-blue-100 text-blue-700';
                               else if (score === 1) color = 'bg-amber-100 text-amber-700';
                               return (
                                 <div key={key} className="flex justify-between items-center">
                                   <span className="text-[9px] font-bold text-slate-600 uppercase w-3/4 pr-2">{label}</span>
                                   <span className={`text-[9px] font-black px-2 py-0.5 rounded ${color}`}>{score} / 3</span>
                                 </div>
                               );
                            })}
                          </div>
                          {survey?.notes && <div className="mt-3 text-[10px] text-slate-600 italic bg-white p-2 rounded border border-slate-100">"{survey.notes}"</div>}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {activeTab === 'checklist' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* ADD CHECKLIST FORM */}
                  <form onSubmit={handleSaveChecklist} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">{clEditingId ? 'Edit Checklist Item' : 'Add Design Checklist'}</h3>
                    <div className="grid grid-cols-6 gap-2 mb-3">
                      <div className="col-span-2">
                         <input required type="text" placeholder="Design Name" value={checklistForm.task_name} onChange={e => setChecklistForm({...checklistForm, task_name: e.target.value})} className="w-full text-xs font-bold p-2 border border-slate-300 rounded focus:border-indigo-500 outline-none" />
                      </div>
                      <div className="col-span-1">
                         <input type="text" placeholder="Size (e.g. A4)" value={checklistForm.size} onChange={e => setChecklistForm({...checklistForm, size: e.target.value})} className="w-full text-xs font-bold p-2 border border-slate-300 rounded focus:border-indigo-500 outline-none" />
                      </div>
                      <div className="col-span-1">
                         <input type="number" min="1" placeholder="Qty" value={checklistForm.quantity} onChange={e => setChecklistForm({...checklistForm, quantity: parseInt(e.target.value) || 0})} className="w-full text-xs font-bold p-2 border border-slate-300 rounded focus:border-indigo-500 outline-none" />
                      </div>
                      <div className="col-span-2">
                         <input type="text" placeholder="Notes..." value={checklistForm.notes} onChange={e => setChecklistForm({...checklistForm, notes: e.target.value})} className="w-full text-xs font-bold p-2 border border-slate-300 rounded focus:border-indigo-500 outline-none" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                       {clEditingId && <button type="button" onClick={() => { setClEditingId(null); setChecklistForm({ task_name: '', size: '', quantity: 1, notes: '', status: 'NONE' }); }} className="px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase">Cancel</button>}
                       <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded shadow-sm hover:bg-indigo-700">{clEditingId ? 'Update Item' : 'Add Item'}</button>
                    </div>
                  </form>

                  {/* CHECKLIST TABLE */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-center w-10">No</th>
                          <th className="px-4 py-3">Design Name</th>
                          <th className="px-4 py-3">Size</th>
                          <th className="px-4 py-3 text-center">Qty</th>
                          <th className="px-4 py-3">Notes</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                        {filteredChecklists.length === 0 ? (
                          <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic text-xs">No checklist items added yet.</td></tr>
                        ) : filteredChecklists.map((cl, idx) => (
                          <tr key={cl.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-center text-slate-400">{idx + 1}</td>
                            <td className="px-4 py-3 text-slate-900 uppercase">{cl.task_name}</td>
                            <td className="px-4 py-3">{cl.size || '-'}</td>
                            <td className="px-4 py-3 text-center">{cl.quantity}</td>
                            <td className="px-4 py-3 text-slate-500 italic truncate max-w-[150px]">{cl.notes || '-'}</td>
                            <td className="px-4 py-3">
                              <select 
                                value={cl.status} 
                                onChange={(e) => handleStatusChangeChecklist(cl.id, e.target.value)}
                                className={`text-[9px] font-black uppercase rounded py-1 px-2 border outline-none cursor-pointer ${
                                  cl.status === 'DONE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                  cl.status === 'ON PROGRESS' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                  'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                <option value="NONE">None</option>
                                <option value="ON PROGRESS">On Progress</option>
                                <option value="DONE">Done</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => handleEditChecklist(cl)} className="text-indigo-600 hover:text-indigo-800"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
                                <button onClick={() => handleDeleteChecklist(cl.id)} className="text-red-400 hover:text-red-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button onClick={() => setSelectedProject(null)} className="px-6 py-2 bg-slate-900 text-white rounded-lg text-xs font-black uppercase">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectMaster;
