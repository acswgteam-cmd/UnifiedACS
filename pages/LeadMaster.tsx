
import React, { useState, useMemo } from 'react';
import { Lead } from '../types';

interface Props {
  leads: Lead[];
  onUpdate: (leads: Lead[]) => void;
}

const LeadMaster: React.FC<Props> = ({ leads, onUpdate }) => {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [formData, setFormData] = useState<Partial<Lead>>({
    lead_name: '',
    requester: '',
    order_date: new Date().toISOString().split('T')[0],
    deadline: '',
    lead_grade: 'B',
    brief: '',
    drive_link: ''
  });

  const resetForm = () => {
    setFormData({
      lead_name: '',
      requester: '',
      order_date: new Date().toISOString().split('T')[0],
      deadline: '',
      lead_grade: 'B',
      brief: '',
      drive_link: ''
    });
    setEditingId(null);
    setIsAdding(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lead_name || !formData.requester) return;

    if (editingId) {
      onUpdate(leads.map(l => l.id === editingId ? { ...l, ...formData as Lead } : l));
    } else {
      const newLead: Lead = {
        ...formData as Lead,
        id: `lead-${Date.now()}`
      };
      onUpdate([...leads, newLead]);
    }
    resetForm();
  };

  const handleEdit = (l: Lead) => {
    setFormData(l);
    setEditingId(l.id);
    setIsAdding(true);
    setView('list');
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this lead?')) {
      onUpdate(leads.filter(l => l.id !== id));
    }
  };

  const getGradeTheme = (grade: string) => {
    switch (grade) {
      case 'A': return { bg: 'bg-orange-50', border: 'border-orange-600', text: 'text-orange-900', accent: 'text-orange-700' };
      case 'B': return { bg: 'bg-blue-50', border: 'border-blue-600', text: 'text-blue-900', accent: 'text-blue-700' };
      default: return { bg: 'bg-slate-100', border: 'border-slate-500', text: 'text-slate-800', accent: 'text-slate-600' };
    }
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const sortedLeads = useMemo(() => [...leads].sort((a, b) => a.id.localeCompare(b.id)), [leads]);

  const navigateMonth = (direction: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const days = [];
    for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} className="min-h-[160px] bg-slate-100/50 border-r border-b border-slate-200"></div>);
    for (let d = 1; d <= totalDays; d++) {
      const dayOfWeek = (startDay + d - 1) % 7;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayLeads = sortedLeads.filter(l => dateStr >= l.order_date && dateStr <= l.deadline);
      days.push(
        <div key={d} className="min-h-[160px] h-full bg-white border-r border-b border-slate-200 p-0 flex flex-col relative">
          <span className="text-[10px] font-black text-slate-700 block p-2">{String(d).padStart(2, '0')}</span>
          <div className="flex flex-col space-y-1 pb-2">
            {dayLeads.map(l => {
              const theme = getGradeTheme(l.lead_grade);
              const isStart = dateStr === l.order_date;
              return (
                <div key={l.id} className={`min-h-[56px] py-1.5 flex flex-col justify-center px-2 overflow-hidden ${isStart ? `rounded-l-md ml-1 border-l-4 ${theme.border}` : ''} ${theme.bg} ${theme.text}`}>
                  <div className="flex flex-col min-w-0 leading-tight">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black truncate">{l.lead_name}</span>
                      <span className={`flex-shrink-0 px-1 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter text-white ${l.lead_grade === 'A' ? 'bg-orange-600' : l.lead_grade === 'B' ? 'bg-blue-600' : 'bg-slate-600'}`}>
                        Grade {l.lead_grade}
                      </span>
                    </div>
                    <span className={`text-[8px] font-black ${theme.accent} truncate mt-1`}>Req: {l.requester}</span>
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

  const labelClass = "text-[11px] font-black text-slate-900 uppercase mb-1.5 block";
  const inputClass = "w-full rounded-lg border-slate-300 text-slate-900 text-sm p-3 border bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all placeholder-slate-400 shadow-sm font-semibold appearance-none";

  return (
    <div className="space-y-6 flex flex-col h-full">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Lead Master</h1>
          <p className="text-slate-600 text-sm mt-1 font-bold">Monitoring request lifecycles from order to deadline.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-200 p-1 rounded-xl">
            <button onClick={() => setView('list')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${view === 'list' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>List View</button>
            <button onClick={() => setView('calendar')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${view === 'calendar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Calendar View</button>
          </div>
          {!isAdding && view === 'list' && (
            <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-black flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
              Create Lead
            </button>
          )}
        </div>
      </header>

      {isAdding && (
        <form onSubmit={handleSave} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl animate-in zoom-in duration-200 flex-shrink-0">
          <h2 className="font-black text-slate-900 mb-8 flex items-center gap-2">
            <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
            {editingId ? 'Edit Lead Entry' : 'Register New Lead'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-2">
              <label className={labelClass}>Lead/Project Name</label>
              <input type="text" required value={formData.lead_name} onChange={e => setFormData({...formData, lead_name: e.target.value})} className={inputClass} placeholder="e.g. Social Media Ad Set" />
            </div>
            <div className="relative">
              <label className={labelClass}>Lead Grade</label>
              <select value={formData.lead_grade} onChange={e => setFormData({...formData, lead_grade: e.target.value})} className={inputClass}>
                <option value="A">Grade A (High Priority)</option>
                <option value="B">Grade B (Standard)</option>
                <option value="C">Grade C (Low Priority)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 top-6 flex items-center px-3 text-slate-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
            <div>
              <label className={labelClass}>Requester Name/Unit</label>
              <input type="text" required value={formData.requester} onChange={e => setFormData({...formData, requester: e.target.value})} className={inputClass} placeholder="e.g. Marketing Team" />
            </div>
            <div>
              <label className={labelClass}>Order Date</label>
              <input type="date" required value={formData.order_date} onChange={e => setFormData({...formData, order_date: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Deadline</label>
              <input type="date" required value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} className={inputClass} />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className={labelClass}>Creative Brief</label>
              <textarea rows={3} value={formData.brief} onChange={e => setFormData({...formData, brief: e.target.value})} className={inputClass} placeholder="Describe scope..." />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className={labelClass}>Asset / Drive Link</label>
              <input type="url" value={formData.drive_link} onChange={e => setFormData({...formData, drive_link: e.target.value})} className={inputClass} placeholder="https://drive.google.com/..." />
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
            <button type="button" onClick={resetForm} className="px-6 py-2.5 text-sm font-black text-slate-700 hover:text-slate-900 transition-colors">Cancel</button>
            <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-black shadow-lg hover:bg-indigo-700 transition-all">
              {editingId ? 'Update Lead' : 'Commit Lead'}
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 min-h-0">
        {view === 'list' ? (
          <div className="overflow-y-auto h-full pr-2 animate-in fade-in duration-300 space-y-4">
            {leads.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300"><p className="text-slate-500 font-black italic">No leads in queue.</p></div>
            ) : leads.map(l => (
              <div key={l.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 text-slate-900">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-black truncate">{l.lead_name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${l.lead_grade === 'A' ? 'bg-red-100 text-red-800' : l.lead_grade === 'B' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'}`}>Grade {l.lead_grade}</span>
                    </div>
                    <p className="text-xs font-black uppercase text-slate-600 tracking-tight">Requester: <span className="text-indigo-700">{l.requester}</span></p>
                    <p className="text-sm mt-3 line-clamp-2 font-bold italic text-slate-700">{l.brief || 'No brief provided.'}</p>
                  </div>
                  <div className="flex flex-col md:items-end gap-3 font-black text-[11px] uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEdit(l)} className="p-2 text-slate-600 hover:text-indigo-700 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
                      <button onClick={() => handleDelete(l.id)} className="p-2 text-slate-600 hover:text-red-600 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-slate-500">DEADLINE</span>
                      <span className="text-red-800 bg-red-50 px-2 py-0.5 rounded mt-0.5 border border-red-100">{l.deadline}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col animate-in fade-in duration-300">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
              <div className="flex gap-2">
                <button onClick={() => navigateMonth(-1)} className="p-1.5 hover:bg-slate-300 rounded-lg transition-colors"><svg className="w-5 h-5 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg></button>
                <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-white border border-slate-300 rounded-lg text-slate-900">Today</button>
                <button onClick={() => navigateMonth(1)} className="p-1.5 hover:bg-slate-300 rounded-lg transition-colors"><svg className="w-5 h-5 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                  <div key={d} className="py-3 text-center text-[10px] font-black text-slate-900 uppercase tracking-widest border-r border-slate-200 last:border-0">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 border-l border-slate-200">{renderCalendar()}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadMaster;
