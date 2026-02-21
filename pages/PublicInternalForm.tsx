
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { InternalDesign, Department } from '../types';
import { supabase } from '../lib/supabase';
import { INTERNAL_FORM_SECRET } from '../data/mockData';

interface Props {
  onHostSubmit?: () => void;
  departments: Department[];
}

const PublicInternalForm: React.FC<Props> = ({ onHostSubmit, departments }) => {
  const { token } = useParams<{ token: string }>();
  const isAuthorized = token === INTERNAL_FORM_SECRET;

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<InternalDesign>>({
    task_name: '',
    department_id: '',
    requester_name: '',
    deadline: '',
    brief: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorized) return;
    setLoading(true);

    // Pastikan data yang dikirim bersih (string kosong diubah ke null untuk UUID)
    const taskData = {
      task_name: formData.task_name,
      department_id: formData.department_id || null,
      requester_name: formData.requester_name,
      deadline: formData.deadline,
      brief: formData.brief || '',
      status: 'NEW' 
    };

    try {
      if (!supabase) throw new Error("DB connection missing");
      const { error } = await supabase.from('internal_designs').insert([taskData]);
      if (error) throw error;
      
      onHostSubmit?.();
      setSubmitted(true);
    } catch (err: any) {
      console.error("Internal Form Error:", err);
      alert(`Submission failed: ${err.message}. Pastikan tabel 'internal_designs' sudah dibuat di Supabase.`);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full rounded-xl border-zinc-300 text-zinc-900 text-base p-4 border focus:ring-4 focus:ring-purple-100 focus:border-purple-600 outline-none transition-all placeholder-slate-400 bg-white shadow-sm font-medium appearance-none";
  const labelClass = "text-sm font-semibold text-zinc-900 uppercase tracking-wide mb-2 block ml-1";

  if (!isAuthorized) return (
    <div className="min-h-screen bg-[#1A1C20] flex items-center justify-center p-6 text-white font-bold">
      403 UNAUTHORIZED PORTAL
    </div>
  );

  if (submitted) {
    return (
      <div className="min-h-screen bg-purple-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[20px] shadow-2xl p-10 text-center animate-in zoom-in duration-300 border-t-8 border-purple-600">
          <div className="w-20 h-20 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Request Sent!</h1>
          <p className="text-zinc-700 mb-8 font-medium">Internal creative task has been logged as 'NEW'. Our studio team will review it.</p>
          <button onClick={() => setSubmitted(false)} className="w-full py-4 bg-purple-600 text-white rounded-[20px] font-bold shadow-sm border border-[#EAEAEA]">Submit Another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-purple-50 py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-block px-4 py-1.5 bg-purple-600 text-white rounded-full text-[10px] font-bold uppercase tracking-wider mb-4">Internal Studio Portal</div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Internal Creative Request</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-[20px] shadow-2xl border border-[#EAEAEA] p-8 md:p-12 overflow-hidden relative">
          {loading && <div className="absolute top-0 left-0 w-full h-1.5 bg-purple-600 animate-pulse"></div>}
          <div className="space-y-8">
            <section className="space-y-6">
              <div>
                <label className={labelClass}>Task / Design Name</label>
                <input type="text" required value={formData.task_name} onChange={e => setFormData({...formData, task_name: e.target.value})} className={inputClass} placeholder="e.g. Sales Flyer Jan" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Your Department</label>
                  <select required value={formData.department_id} onChange={e => setFormData({...formData, department_id: e.target.value})} className={inputClass}>
                    <option value="">Select Department...</option>
                    {departments.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>PIC Requester</label>
                  <input type="text" required value={formData.requester_name} onChange={e => setFormData({...formData, requester_name: e.target.value})} className={inputClass} placeholder="Full Name" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Deadline</label>
                <input type="date" required value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} className={inputClass} />
              </div>
            </section>
            <section className="space-y-6">
              <div>
                <label className={labelClass}>Brief & Requirements</label>
                <textarea rows={4} placeholder="Describe what you need, size, colors, and links to assets..." value={formData.brief} onChange={e => setFormData({...formData, brief: e.target.value})} className={inputClass} />
              </div>
            </section>
            <button type="submit" disabled={loading} className="w-full py-5 bg-purple-600 text-white rounded-[20px] font-bold text-lg shadow-sm border border-[#EAEAEA] shadow-purple-100 hover:bg-purple-700 transition-all flex items-center justify-center gap-3">
              {loading ? 'Submitting...' : 'Send to Studio Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PublicInternalForm;
