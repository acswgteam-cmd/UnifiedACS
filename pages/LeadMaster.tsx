
import React, { useState, useMemo } from 'react';
import { Lead } from '../types';
import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabase';
import { PUBLIC_FORM_SECRET } from '../App';

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
  const [copySuccess, setCopySuccess] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Lead>>({
    lead_name: '',
    requester: '',
    order_date: new Date().toISOString().split('T')[0],
    deadline: '',
    lead_grade: 'B',
    brief: '',
    drive_link: ''
  });

  const handleCopyLink = () => {
    // Menghasilkan link dengan token terenkripsi
    const publicUrl = `${window.location.origin}${window.location.pathname}#/portal/v1/inquiry/${PUBLIC_FORM_SECRET}`;
    navigator.clipboard.writeText(publicUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

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

    const { id, ...payload } = formData;

    if (editingId) {
      const { error } = await supabase.from('leads').update(payload).eq('id', editingId);
      if (error) alert(`Gagal Update: ${error.message}`);
      else {
        onUpdate();
        resetForm();
      }
    } else {
      const { error } = await supabase.from('leads').insert([payload]);
      if (error) alert(`Gagal Simpan: ${error.message}`);
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
    if (!supabase || !confirm('Hapus lead ini?')) return;
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) alert(error.message);
    else onUpdate();
  };

  const downloadPDF = (e: React.MouseEvent | null, lead: Lead) => {
    if (e) e.stopPropagation();
    const doc = new jsPDF() as any;
    doc.setFontSize(18);
    doc.text(`LEAD SPECIFICATION: ${lead.lead_name}`, 20, 20);
    doc.setFontSize(10);
    doc.text(`Requester: ${lead.requester}`, 20, 35);
    doc.text(`Deadline: ${lead.deadline}`, 20, 45);
    doc.text(`Grade: ${lead.lead_grade}`, 20, 55);
    doc.text(`Brief:`, 20, 70);
    const splitBrief = doc.splitTextToSize(lead.brief || '-', 170);
    doc.text(splitBrief, 20, 80);
    doc.save(`Lead_${lead.lead_name}.pdf`);
  };

  // Helper for consistent coloring
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
    const days = [];

    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-[160px] bg-slate-100/50 border-r border-b border-slate-200"></div>);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayLeads = leads.filter(l => dateStr >= l.order_date && dateStr <= l.deadline);
      
      days.push(
        <div key={d} className="min-h-[160px] h-full bg-white border-r border-b border-slate-200 p-0 flex flex-col relative">
          <span className="text-[10px] font-black text-slate-700 block p-2">{String(d).padStart(2, '0')}</span>
          <div className="flex flex-col space-y-1 pb-2">
            {dayLeads.map(l => {
              const theme = getColorTheme(l.id);
              const isStart = dateStr === l.order_date;
              return (
                <div 
                  key={l.id} 
                  onClick={() => setSelectedLead(l)}
                  className={`cursor-pointer min-h-[60px] py-1.5 flex flex-col justify-center px-2 overflow-hidden transition-all hover:brightness-95 ${isStart ? `rounded-l-md ml-1 border-l-4 ${theme.border}` : ''} ${theme.bg} ${theme.text}`}
                >
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="text-[10px] font-black truncate uppercase">{l.lead_name}</span>
                    <span className="text-[8px] font-black opacity-80 mt-0.5 truncate uppercase tracking-tighter">
                      PIC: {l.requester}
                    </span>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-[7px] font-black px-1 rounded border ${theme.border} uppercase`}>
                        Grade {l.lead_grade}
                      </span>
                    </div>
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

  const labelClass = "text-[11px] font-bold text-slate-900 uppercase mb-1.5 block tracking-wide";
  const inputClass = "w-full rounded-lg border-slate-300 text-slate-900 text-sm p-3 border bg-white focus:ring-2 focus:ring-indigo-600 outline-none shadow-sm font-medium";

  return (
    <div className="space-y-6 flex flex-col h-full relative">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">Lead Registry</h1>
          <p className="text-slate-600 text-sm mt-1 font-semibold">Monitor and manage all design inquiries.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleCopyLink}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 border ${copySuccess ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-300 text-slate-700 hover:border-indigo-500'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
            {copySuccess ? 'Copied Link!' : 'Copy Secured Link'}
          </button>
          <div className="flex bg-slate-200 p-1 rounded-lg">
            <button onClick={() => setView('list')} className={`px-4 py-1 rounded-md text-xs font-bold ${view === 'list' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-600'}`}>List</button>
            <button onClick={() => setView('calendar')} className={`px-4 py-1 rounded-md text-xs font-bold ${view === 'calendar' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-600'}`}>Calendar</button>
          </div>
          <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
            New Lead
          </button>
        </div>
      </header>

      {isAdding && (
        <form onSubmit={handleSave} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl animate-in zoom-in duration-200 flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="md:col-span-2">
              <label className={labelClass}>Lead Name</label>
              <input type="text" required value={formData.lead_name} onChange={e => setFormData({...formData, lead_name: e.target.value})} className={inputClass} placeholder="Project title..." />
            </div>
            <div>
              <label className={labelClass}>Grade</label>
              <select value={formData.lead_grade} onChange={e => setFormData({...formData, lead_grade: e.target.value})} className={inputClass}>
                <option value="A">Grade A (High)</option>
                <option value="B">Grade B (Standard)</option>
                <option value="C">Grade C (Low)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Requester</label>
              <input type="text" required value={formData.requester} onChange={e => setFormData({...formData, requester: e.target.value})} className={inputClass} placeholder="Name/Dept" />
            </div>
            <div>
              <label className={labelClass}>Deadline</label>
              <input type="date" required value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} className={inputClass} />
            </div>
            <div className="md:col-span-3">
              <label className={labelClass}>Brief</label>
              <textarea value={formData.brief} onChange={e => setFormData({...formData, brief: e.target.value})} className={inputClass} rows={3} placeholder="Production scope..." />
            </div>
          </div>
          <div className="flex justify-end gap-4">
            <button type="button" onClick={resetForm} className="px-6 py-2.5 text-sm font-bold text-slate-500">Cancel</button>
            <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-all">Commit Lead</button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-auto">
        {view === 'list' ? (
          <div className="space-y-4">
            {leads.length === 0 ? (
              <div className="p-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 font-bold italic">No leads found.</div>
            ) : leads.map(l => (
              <div key={l.id} onClick={() => setSelectedLead(l)} className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group cursor-pointer hover:shadow-md transition-all">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-slate-900 truncate">{l.lead_name}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${l.lead_grade === 'A' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}`}>Grade {l.lead_grade}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Req: <span className="text-slate-900">{l.requester}</span> &bull; Deadline: <span className="text-red-600 font-black">{l.deadline}</span></p>
                </div>
                <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => downloadPDF(e, l)} className="p-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors" title="PDF"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></button>
                  <button onClick={(e) => handleEdit(e, l)} className="p-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors" title="Edit"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
                  <button onClick={(e) => handleDelete(e, l.id)} className="p-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors" title="Delete"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
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
                 <button onClick={() => navigateMonth(1)} className="p-1.5 hover:bg-slate-300 rounded-lg transition-colors"><svg className="w-5 h-5 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg></button>
               </div>
            </div>
            <div className="overflow-y-auto flex-1">
               <div className="grid grid-cols-7 border-l border-slate-200">
                 {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                   <div key={d} className="py-2 text-center text-[9px] font-black uppercase text-slate-400 bg-slate-50 border-b border-r border-slate-200">{d}</div>
                 ))}
                 {renderCalendar()}
               </div>
            </div>
          </div>
        )}
      </div>

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-slate-900/40" onClick={() => setSelectedLead(null)}>
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-bold text-slate-900">{selectedLead.lead_name}</h2>
              <button onClick={() => setSelectedLead(null)} className="p-1 text-slate-400 hover:text-slate-900"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-[10px] font-bold text-slate-400 uppercase">Requester</span><p className="font-bold text-slate-800">{selectedLead.requester}</p></div>
                <div><span className="text-[10px] font-bold text-slate-400 uppercase">Deadline</span><p className="font-bold text-red-600">{selectedLead.deadline}</p></div>
              </div>
              <div><span className="text-[10px] font-bold text-slate-400 uppercase">Brief</span><div className="p-4 bg-slate-50 rounded-xl text-sm italic text-slate-700 whitespace-pre-wrap">{selectedLead.brief || 'No brief provided.'}</div></div>
              {selectedLead.drive_link && (
                <div><span className="text-[10px] font-bold text-slate-400 uppercase">Reference Assets</span><a href={selectedLead.drive_link} target="_blank" rel="noreferrer" className="block p-3 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold truncate hover:bg-indigo-100 transition-colors">{selectedLead.drive_link}</a></div>
              )}
            </div>
            <button onClick={() => setSelectedLead(null)} className="w-full mt-8 py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs">Close Details</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadMaster;
