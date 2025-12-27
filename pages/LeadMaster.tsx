
import React, { useState, useMemo } from 'react';
import { Lead } from '../types';
import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabase';

interface Props {
  leads: Lead[];
  onUpdate: () => void;
}

const LeadMaster: React.FC<Props> = ({ leads, onUpdate }) => {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lead_name || !formData.requester || !supabase) return;

    if (editingId) {
      const { error } = await supabase.from('leads').update(formData).eq('id', editingId);
      if (error) alert(error.message);
      else {
        onUpdate();
        resetForm();
      }
    } else {
      const { error } = await supabase.from('leads').insert([formData]);
      if (error) alert(error.message);
      else {
        onUpdate();
        resetForm();
      }
    }
  };

  const handleEdit = (e: React.MouseEvent, l: Lead) => {
    e.stopPropagation();
    setFormData(l);
    setEditingId(l.id);
    setIsAdding(true);
    setView('list');
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!supabase || !confirm('Are you sure you want to delete this lead?')) return;
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) alert(error.message);
    else onUpdate();
  };

  const downloadPDF = (e: React.MouseEvent | null, lead: Lead) => {
    if (e) e.stopPropagation();
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    }) as any;

    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('ACS UNIFIED LOG ARTWORK', 20, 20);
    doc.setFontSize(9);
    doc.text('LEAD REPORT / PRODUCTION SPECIFICATION', 20, 28);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(16);
    doc.text(lead.lead_name.toUpperCase(), 20, 60);

    doc.setDrawColor(79, 70, 229); 
    doc.setLineWidth(0.4);
    doc.roundedRect(160, 52, 30, 10, 2, 2, 'D');
    doc.setFontSize(8);
    doc.text(`GRADE ${lead.lead_grade}`, 168, 58.5);

    doc.setDrawColor(226, 232, 240); 
    doc.line(20, 65, 190, 65);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('REQUESTER', 20, 80);
    doc.setFont('helvetica', 'normal');
    doc.text(lead.requester, 60, 80);

    doc.setFont('helvetica', 'bold');
    doc.text('ORDER DATE', 20, 90);
    doc.setFont('helvetica', 'normal');
    doc.text(lead.order_date, 60, 90);

    doc.setFont('helvetica', 'bold');
    doc.text('DEADLINE', 20, 100);
    doc.setTextColor(185, 28, 28); 
    doc.text(lead.deadline, 60, 100);
    doc.setTextColor(15, 23, 42);

    doc.setFont('helvetica', 'bold');
    doc.text('CREATIVE BRIEF & SCOPE', 20, 120);
    doc.setFont('helvetica', 'normal');
    const splitBrief = doc.splitTextToSize(lead.brief || 'No brief provided.', 170);
    doc.text(splitBrief, 20, 130);

    if (lead.drive_link) {
      doc.setFont('helvetica', 'bold');
      doc.text('ASSET REPOSITORY', 20, 180);
      doc.setTextColor(79, 70, 229);
      doc.text(lead.drive_link, 20, 188);
    }

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.text(`Generated on ${new Date().toLocaleString()} | ACS Internal Operations`, 20, 280);

    doc.save(`Lead_${lead.id}.pdf`);
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
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayLeads = sortedLeads.filter(l => dateStr >= l.order_date && dateStr <= l.deadline);
      days.push(
        <div key={d} className="min-h-[160px] h-full bg-white border-r border-b border-slate-200 p-0 flex flex-col relative">
          <span className="text-[10px] font-bold text-slate-700 block p-2">{String(d).padStart(2, '0')}</span>
          <div className="flex flex-col space-y-1 pb-2">
            {dayLeads.map(l => {
              const theme = getGradeTheme(l.lead_grade);
              const isStart = dateStr === l.order_date;
              return (
                <div 
                  key={l.id} 
                  onClick={() => setSelectedLead(l)}
                  className={`cursor-pointer min-h-[56px] py-1.5 flex flex-col justify-center px-2 overflow-hidden hover:brightness-95 transition-all ${isStart ? `rounded-l-md ml-1 border-l-4 ${theme.border}` : ''} ${theme.bg} ${theme.text}`}
                >
                  <div className="flex flex-col min-w-0 leading-tight">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold truncate">{l.lead_name}</span>
                    </div>
                    <span className={`text-[8px] font-semibold ${theme.accent} truncate mt-1`}>Req: {l.requester}</span>
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

  const labelClass = "text-[11px] font-semibold text-slate-900 uppercase mb-1.5 block tracking-wide";
  const inputClass = "w-full rounded-lg border-slate-300 text-slate-900 text-sm p-3 border bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all placeholder-slate-400 shadow-sm font-medium appearance-none";

  return (
    <div className="space-y-6 flex flex-col h-full relative">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">Lead Registry</h1>
          <p className="text-slate-600 text-sm mt-1 font-semibold">Monitoring request lifecycles from order to deadline.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-200 p-1 rounded-xl">
            <button onClick={() => setView('list')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'list' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>List View</button>
            <button onClick={() => setView('calendar')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'calendar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Calendar View</button>
          </div>
          {!isAdding && view === 'list' && (
            <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
              Create Lead
            </button>
          )}
        </div>
      </header>

      {isAdding && (
        <form onSubmit={handleSave} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl animate-in zoom-in duration-200 flex-shrink-0">
          <h2 className="font-bold text-slate-900 mb-8 flex items-center gap-2">
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
            <button type="button" onClick={resetForm} className="px-6 py-2.5 text-sm font-bold text-slate-700 hover:text-slate-900 transition-colors">Cancel</button>
            <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg hover:bg-indigo-700 transition-all">
              {editingId ? 'Update Lead' : 'Commit Lead'}
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 min-h-0">
        {view === 'list' ? (
          <div className="overflow-y-auto h-full pr-2 animate-in fade-in duration-300 space-y-4">
            {leads.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300"><p className="text-slate-500 font-semibold italic">No leads in queue.</p></div>
            ) : leads.map(l => (
              <div 
                key={l.id} 
                onClick={() => setSelectedLead(l)}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group cursor-pointer relative"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 text-slate-900">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold truncate">{l.lead_name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${l.lead_grade === 'A' ? 'bg-red-100 text-red-800' : l.lead_grade === 'B' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'}`}>Grade {l.lead_grade}</span>
                    </div>
                    <p className="text-xs font-semibold uppercase text-slate-600 tracking-tight">Requester: <span className="text-indigo-700 font-bold">{l.requester}</span></p>
                    <p className="text-sm mt-3 line-clamp-2 font-medium italic text-slate-700 leading-relaxed">{l.brief || 'No brief provided.'}</p>
                  </div>
                  <div className="flex flex-col md:items-end gap-3 font-semibold text-[11px] uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => downloadPDF(e, l)}
                        className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                        title="Download PDF Report"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      </button>
                      <button onClick={(e) => handleEdit(e, l)} className="p-2 text-slate-400 hover:text-indigo-700 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
                      <button onClick={(e) => handleDelete(e, l.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col animate-in fade-in duration-300">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-slate-900 text-sm uppercase tracking-widest">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
              <div className="flex gap-2">
                <button onClick={() => navigateMonth(-1)} className="p-1.5 hover:bg-slate-300 rounded-lg transition-colors"><svg className="w-5 h-5 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg></button>
                <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-white border border-slate-300 rounded-lg text-slate-900">Today</button>
                <button onClick={() => navigateMonth(1)} className="p-1.5 hover:bg-slate-300 rounded-lg transition-colors"><svg className="w-5 h-5 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                  <div key={d} className="py-3 text-center text-[10px] font-bold text-slate-900 uppercase tracking-widest border-r border-slate-200 last:border-0">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 border-l border-slate-200">{renderCalendar()}</div>
            </div>
          </div>
        )}
      </div>

      {selectedLead && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-custom transition-all"
          onClick={() => setSelectedLead(null)}
        >
          <div 
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-slate-900 px-8 py-6 text-white flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Lead Specification</span>
                <h2 className="text-xl font-bold truncate max-w-md">{selectedLead.lead_name}</h2>
              </div>
              <button 
                onClick={() => setSelectedLead(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Grade</span>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${selectedLead.lead_grade === 'A' ? 'bg-orange-600 text-white' : 'bg-indigo-600 text-white'}`}>
                    {selectedLead.lead_grade}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Requester</span>
                  <span className="text-sm font-bold text-slate-900 truncate block">{selectedLead.requester}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Order Date</span>
                  <span className="text-sm font-semibold text-slate-700 block">{selectedLead.order_date}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Deadline</span>
                  <span className="text-sm font-bold text-red-700 block">{selectedLead.deadline}</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Creative Brief & Scope</span>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-slate-800 text-sm leading-relaxed font-medium italic whitespace-pre-wrap">
                  {selectedLead.brief || "No brief was provided for this lead."}
                </div>
              </div>

              {selectedLead.drive_link && (
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Reference Assets</span>
                  <a 
                    href={selectedLead.drive_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100 hover:bg-indigo-100 transition-colors group"
                  >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                    <span className="text-sm font-bold truncate">{selectedLead.drive_link}</span>
                  </a>
                </div>
              )}
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex gap-4">
                <button 
                  onClick={(e) => downloadPDF(e, selectedLead)}
                  className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg hover:bg-slate-800 transition-all"
                >
                  Download PDF
                </button>
              </div>
              <button 
                onClick={() => setSelectedLead(null)}
                className="text-xs font-bold uppercase text-slate-400 hover:text-slate-900 tracking-widest"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadMaster;
