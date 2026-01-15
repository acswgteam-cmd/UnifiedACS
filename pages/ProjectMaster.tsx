
import React, { useState, useMemo } from 'react';
import { Project, Designer } from '../types';
import { supabase } from '../lib/supabase';

interface Props {
  projects: Project[];
  designers: Designer[];
  onUpdate: () => void;
}

const ProjectMaster: React.FC<Props> = ({ projects, designers, onUpdate }) => {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // States for Filtering
  const [filterType, setFilterType] = useState('ALL');
  const [filterPIC, setFilterPIC] = useState('ALL');
  const [filterSupport, setFilterSupport] = useState('ALL');
  const [filterLocation, setFilterLocation] = useState('ALL');

  const [formData, setFormData] = useState<Partial<Project>>({
    project_name: '',
    start_date: '',
    end_date: '',
    location: '',
    pic_designer_id: designers[0]?.id || '',
    support_designer_ids: [],
    project_type: 'EVENT',
    status: 'ON PROGRESS',
    notes: ''
  });

  const getDesignerName = (id: string) => designers.find(d => d.id === id)?.name || 'N/A';
  
  const uniqueLocations = useMemo(() => {
    const locs = projects.map(p => p.location).filter(Boolean);
    return Array.from(new Set(locs)).sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchType = filterType === 'ALL' || p.project_type === filterType;
      const matchPIC = filterPIC === 'ALL' || p.pic_designer_id === filterPIC;
      const matchSupport = filterSupport === 'ALL' || (p.support_designer_ids && p.support_designer_ids.includes(filterSupport));
      const matchLoc = filterLocation === 'ALL' || p.location === filterLocation;
      return matchType && matchPIC && matchSupport && matchLoc;
    });
  }, [projects, filterType, filterPIC, filterSupport, filterLocation]);

  const toggleSupportDesigner = (id: string) => {
    const current = formData.support_designer_ids || [];
    if (current.includes(id)) {
      setFormData({ ...formData, support_designer_ids: current.filter(sid => sid !== id) });
    } else {
      setFormData({ ...formData, support_designer_ids: [...current, id] });
    }
  };

  const resetForm = () => {
    setFormData({
      project_name: '',
      start_date: '',
      end_date: '',
      location: '',
      pic_designer_id: designers[0]?.id || '',
      support_designer_ids: [],
      project_type: 'EVENT',
      status: 'ON PROGRESS',
      notes: ''
    });
    setEditingId(null);
    setIsAdding(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.project_name || !supabase) return;

    const { id, ...payload } = formData;

    if (editingId) {
      const { error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', editingId);
      if (error) alert(`Gagal Update: ${error.message}`);
      else {
        onUpdate();
        resetForm();
      }
    } else {
      const { error } = await supabase.from('projects').insert([payload]);
      if (error) {
        console.error(error);
        alert(`Gagal Simpan: ${error.message}`);
      } else {
        onUpdate();
        resetForm();
      }
    }
  };

  const handleEdit = (p: Project) => {
    setFormData({
      ...p,
      support_designer_ids: p.support_designer_ids || []
    });
    setEditingId(p.id);
    setIsAdding(true);
    setView('list');
  };

  const handleDelete = async (id: string) => {
    if (!supabase || !confirm('Hapus project ini?')) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) alert(error.message);
    else onUpdate();
  };

  const getColorTheme = (id: string) => {
    const themes = [
      { bg: 'bg-blue-50', border: 'border-blue-600', text: 'text-blue-900', accent: 'text-blue-700' },
      { bg: 'bg-amber-50', border: 'border-amber-600', text: 'text-amber-900', accent: 'text-amber-700' },
      { bg: 'bg-emerald-50', border: 'border-emerald-600', text: 'text-emerald-900', accent: 'text-emerald-700' },
      { bg: 'bg-rose-50', border: 'border-rose-600', text: 'text-rose-900', accent: 'text-rose-700' },
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return themes[Math.abs(hash) % themes.length];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ON HOLD': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'DONE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const navigateMonth = (direction: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const todayStr = new Date().toISOString().split('T')[0];
    const days = [];
    
    for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} className="min-h-[160px] bg-slate-100/50 border-r border-b border-slate-200"></div>);
    
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const dayProjects = filteredProjects.filter(p => dateStr >= p.start_date && dateStr <= p.end_date);
      
      days.push(
        <div key={d} className={`min-h-[160px] h-full border-r border-b border-slate-200 p-0 flex flex-col relative ${isToday ? 'bg-indigo-50/30' : 'bg-white'}`}>
          <div className="p-2">
            <span className={`text-[10px] font-black inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700'}`}>
              {String(d).padStart(2, '0')}
            </span>
          </div>
          <div className="flex flex-col space-y-1 pb-2">
            {dayProjects.map(p => {
              const theme = getColorTheme(p.id);
              const isStart = dateStr === p.start_date;
              return (
                <div key={p.id} className={`min-h-[56px] py-1.5 flex flex-col justify-center px-2 overflow-hidden ${isStart ? `rounded-l-md ml-1 border-l-4 ${theme.border}` : ''} ${theme.bg} ${theme.text}`}>
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="text-[10px] font-black truncate uppercase">{p.project_name}</span>
                    <span className={`text-[8px] font-black opacity-80 mt-0.5 truncate uppercase tracking-tighter`}>
                      PIC: {getDesignerName(p.pic_designer_id)}
                    </span>
                  </div>
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
  const filterSelectClass = "text-[10px] font-bold border-slate-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm uppercase tracking-tighter cursor-pointer";

  return (
    <div className="space-y-6 flex flex-col h-full relative">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Project Master</h1>
          <p className="text-slate-600 text-sm mt-1 font-bold">Manage your event project timelines & creative team.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-200 p-1 rounded-xl">
            <button onClick={() => setView('list')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${view === 'list' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>List View</button>
            <button onClick={() => setView('calendar')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${view === 'calendar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Calendar View</button>
          </div>
          {!isAdding && view === 'list' && (
            <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-black flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
              Add Project
            </button>
          )}
        </div>
      </header>

      {/* FILTER BAR */}
      <div className="bg-slate-100 p-4 rounded-2xl flex flex-wrap items-center gap-4 border border-slate-200 shadow-inner">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Type</span>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className={filterSelectClass}>
            <option value="ALL">All Types</option>
            <option value="EVENT">EVENT</option>
            <option value="TRAVEL">TRAVEL</option>
            <option value="WELLNESS">WELLNESS</option>
            <option value="CREATIVE">CREATIVE</option>
            <option value="TRAINING">TRAINING</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">PIC</span>
          <select value={filterPIC} onChange={e => setFilterPIC(e.target.value)} className={filterSelectClass}>
            <option value="ALL">All PICs</option>
            {designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Support</span>
          <select value={filterSupport} onChange={e => setFilterSupport(e.target.value)} className={filterSelectClass}>
            <option value="ALL">All Support</option>
            {designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Location</span>
          <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className={filterSelectClass}>
            <option value="ALL">All Locations</option>
            {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleSave} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl animate-in zoom-in duration-200 flex-shrink-0 mb-6">
          <h2 className="font-black text-slate-900 mb-8 flex items-center gap-2 uppercase tracking-tight">
            <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
            {editingId ? 'Edit Project Details' : 'Register New Project'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className="md:col-span-2">
              <label className={labelClass}>Project Name</label>
              <input type="text" required value={formData.project_name} onChange={e => setFormData({...formData, project_name: e.target.value})} className={inputClass} placeholder="e.g. Annual Report 2024" />
            </div>
            <div className="relative">
              <label className={labelClass}>Status</label>
              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className={inputClass}>
                <option value="ON PROGRESS">ON PROGRESS</option>
                <option value="ON HOLD">ON HOLD</option>
                <option value="DONE">DONE</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Project Type</label>
              <select value={formData.project_type} onChange={e => setFormData({...formData, project_type: e.target.value})} className={inputClass}>
                <option value="EVENT">EVENT</option>
                <option value="TRAVEL">TRAVEL</option>
                <option value="WELLNESS">WELLNESS</option>
                <option value="CREATIVE">CREATIVE</option>
                <option value="TRAINING">TRAINING</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Start Date</label>
              <input type="date" required value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>End Date</label>
              <input type="date" required value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Location</label>
              <input 
                type="text" 
                list="location-suggestions"
                placeholder="e.g. Remote, HQ" 
                value={formData.location || ''} 
                onChange={e => setFormData({...formData, location: e.target.value})} 
                className={inputClass} 
              />
              <datalist id="location-suggestions">
                {uniqueLocations.map(loc => <option key={loc} value={loc} />)}
              </datalist>
            </div>
            <div className="relative">
              <label className={labelClass}>PIC Designer (Primary)</label>
              <select value={formData.pic_designer_id} onChange={e => setFormData({...formData, pic_designer_id: e.target.value})} className={inputClass}>
                {designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            
            <div className="md:col-span-1">
              <label className={labelClass}>Support Designers</label>
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[46px]">
                {designers.map(d => {
                  const isSelected = formData.support_designer_ids?.includes(d.id);
                  if (formData.pic_designer_id === d.id) return null;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleSupportDesigner(d.id)}
                      className={`px-3 py-1 rounded-full text-[9px] font-black uppercase transition-all border ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-500 hover:border-indigo-400'}`}
                    >
                      {d.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-3">
              <label className={labelClass}>Keterangan / Notes</label>
              <textarea 
                rows={3}
                value={formData.notes || ''} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
                className={inputClass}
                placeholder="Catatan tambahan mengenai project ini..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
            <button type="button" onClick={resetForm} className="px-6 py-2.5 text-sm font-black text-slate-700 hover:text-slate-900 transition-colors uppercase">Cancel</button>
            <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-black shadow-lg hover:bg-indigo-700 transition-all uppercase tracking-widest">
              {editingId ? 'Update Project' : 'Commit Project'}
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 min-h-0">
        {view === 'list' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in duration-300">
            <div className="overflow-y-auto max-h-full">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr className="text-slate-900 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="px-6 py-4">Status & Name</th>
                    <th className="px-6 py-4">Timeline & Loc</th>
                    <th className="px-6 py-4">Lead & Team</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900 font-bold">
                  {filteredProjects.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <span className={`px-2 py-0.5 rounded-full border text-[8px] font-black uppercase self-start ${getStatusBadge(p.status)}`}>
                            {p.status}
                          </span>
                          <div className="flex flex-col leading-tight">
                            <span className="font-black uppercase">{p.project_name}</span>
                            <span className="text-[9px] text-indigo-500 tracking-widest uppercase">{p.project_type}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black">{p.start_date} <span className="text-slate-400">→</span> {p.end_date}</span>
                          <span className="text-[9px] text-slate-400 uppercase font-black">{p.location || 'No Location'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                            <span className="text-xs uppercase">{getDesignerName(p.pic_designer_id)}</span>
                          </div>
                          {p.support_designer_ids && p.support_designer_ids.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {p.support_designer_ids.map(sid => (
                                <span key={sid} className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase border border-slate-200">
                                  {getDesignerName(sid)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-4">
                          <button onClick={() => handleEdit(p)} className="text-indigo-700 hover:text-indigo-900 text-[10px] font-black uppercase tracking-widest">Edit</button>
                          <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700 text-[10px] font-black uppercase tracking-widest">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col animate-in fade-in duration-300">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
              <div className="flex gap-2">
                <button onClick={() => navigateMonth(-1)} className="p-1.5 hover:bg-slate-300 rounded-lg transition-colors"><svg className="w-5 h-5 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg></button>
                <button onClick={() => navigateMonth(1)} className="p-1.5 hover:bg-slate-300 rounded-lg transition-colors"><svg className="w-5 h-5 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              <div className="grid grid-cols-7 border-l border-slate-200">{renderCalendar()}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectMaster;
