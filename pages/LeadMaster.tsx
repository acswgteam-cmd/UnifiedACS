
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

    // Bersihkan payload
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
      if (error) alert(`Gagal Simpan: ${error.message}. Pastikan tabel 'leads' sudah sesuai.`);
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

  // Fungsi PDF tetap sama
  const downloadPDF = (e: React.MouseEvent | null, lead: Lead) => {
    if (e) e.stopPropagation();
    const doc = new jsPDF() as any;
    doc.text(`LEAD REPORT: ${lead.lead_name}`, 20, 20);
    doc.text(`Requester: ${lead.requester}`, 20, 30);
    doc.text(`Deadline: ${lead.deadline}`, 20, 40);
    doc.text(`Brief: ${lead.brief || '-'}`, 20, 50);
    doc.save(`Lead_${lead.id}.pdf`);
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const days = [];
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayLeads = leads.filter(l => dateStr >= l.order_date && dateStr <= l.deadline);
      days.push(
        <div key={d} className="min-h-[160px] h-full bg-white border-r border-b border-slate-200 p-2">
          <span className="text-[10px] font-bold text-slate-500">{d}</span>
          <div className="space-y-1 mt-1">
            {dayLeads.map(l => (
              <div key={l.id} className="text-[9px] bg-indigo-50 p-1 rounded font-bold truncate text-indigo-700">{l.lead_name}</div>
            ))}
          </div>
        </div>
      );
    }
    return days;
  };

  const labelClass = "text-[11px] font-semibold text-slate-900 uppercase mb-1.5 block tracking-wide";
  const inputClass = "w-full rounded-lg border-slate-300 text-slate-900 text-sm p-3 border bg-white focus:ring-2 focus:ring-indigo-600 outline-none shadow-sm font-medium";

  return (
    <div className="space-y-6 flex flex-col h-full relative">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">Lead Registry</h1>
          <p className="text-slate-600 text-sm mt-1 font-semibold">Monitor all design requests.</p>
        </div>
        <div className="flex gap-4">
           <button onClick={() => setView(v => v === 'list' ? 'calendar' : 'list')} className="px-4 py-2 bg-slate-200 rounded-lg text-xs font-bold uppercase">{view === 'list' ? 'Calendar' : 'List'}</button>
           <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg">New Lead</button>
        </div>
      </header>

      {isAdding && (
        <form onSubmit={handleSave} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl animate-in zoom-in duration-200 flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>Lead Name</label>
              <input type="text" required value={formData.lead_name} onChange={e => setFormData({...formData, lead_name: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Requester</label>
              <input type="text" required value={formData.requester} onChange={e => setFormData({...formData, requester: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Deadline</label>
              <input type="date" required value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end gap-4">
            <button type="button" onClick={resetForm} className="px-6 py-2.5 text-sm font-bold text-slate-500">Cancel</button>
            <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold">Save Lead</button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-auto">
        {view === 'list' ? (
          <div className="space-y-4">
            {leads.map(l => (
              <div key={l.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex justify-between items-center group">
                <div>
                  <h3 className="text-lg font-bold">{l.lead_name}</h3>
                  <p className="text-xs text-slate-500">REQ: {l.requester} | DEADLINE: {l.deadline}</p>
                </div>
                <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => downloadPDF(e, l)} className="text-emerald-600 font-bold text-[10px]">PDF</button>
                  <button onClick={(e) => handleEdit(e, l)} className="text-indigo-600 font-bold text-[10px]">EDIT</button>
                  <button onClick={(e) => handleDelete(e, l.id)} className="text-red-500 font-bold text-[10px]">DELETE</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 h-full flex flex-col">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
               <h3 className="font-bold">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
            </div>
            <div className="grid grid-cols-7 flex-1 overflow-auto">{renderCalendar()}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadMaster;
