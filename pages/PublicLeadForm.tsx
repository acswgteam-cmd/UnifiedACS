
import React, { useState } from 'react';
import { Lead } from '../types';
import { supabase } from '../lib/supabase';

interface Props {
  onHostSubmit?: (leads: Lead[]) => void;
  currentLeads?: Lead[];
}

const PublicLeadForm: React.FC<Props> = ({ onHostSubmit, currentLeads = [] }) => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Lead>>({
    lead_name: '',
    requester: '',
    order_date: new Date().toISOString().split('T')[0],
    deadline: '',
    lead_grade: 'B',
    brief: '',
    drive_link: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const newLead: Lead = {
      ...formData as Lead,
      id: `lead-${Date.now()}`
    };

    try {
      if (supabase) {
        const { error } = await supabase.from('leads').insert([newLead]);
        if (error) throw error;
      }
      
      if (onHostSubmit) {
        onHostSubmit([...currentLeads, newLead]);
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Submission failed:", err);
      alert("Failed to submit request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full rounded-xl border-slate-400 text-slate-900 text-base p-4 border focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all placeholder-slate-500 bg-white shadow-sm font-black";
  const labelClass = "text-sm font-black text-slate-900 uppercase tracking-wide mb-2 block ml-1";

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Request Submitted!</h1>
          <p className="text-slate-700 mb-8 font-black">Your creative request has been queued. Our designers will review it shortly.</p>
          <button 
            onClick={() => setSubmitted(false)}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg hover:bg-slate-800 transition-colors"
          >
            Submit Another Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-block px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
            Creative Support Request
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Artwork Request Portal</h1>
          <p className="text-slate-800 mt-2 font-black italic">Internal Submission Form for ACS Department</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 md:p-12 overflow-hidden relative">
          {loading && (
            <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600 animate-pulse"></div>
          )}
          
          <div className="space-y-8">
            <section className="space-y-6">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 border-b-2 border-slate-100 pb-2">
                <span className="text-indigo-600 font-black">01</span> Project Details
              </h2>
              <div>
                <label className={labelClass}>Request Name / Title</label>
                <input 
                  type="text" required placeholder="e.g. Social Media KV for Jan 2024"
                  value={formData.lead_name} onChange={e => setFormData({...formData, lead_name: e.target.value})}
                  className={inputClass} 
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Requester (Your Name/Dept)</label>
                  <input 
                    type="text" required placeholder="e.g. Budi - Marketing"
                    value={formData.requester} onChange={e => setFormData({...formData, requester: e.target.value})}
                    className={inputClass} 
                  />
                </div>
                <div>
                  <label className={labelClass}>Desired Deadline</label>
                  <input 
                    type="date" required
                    value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})}
                    className={inputClass} 
                  />
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 border-b-2 border-slate-100 pb-2">
                <span className="text-indigo-600 font-black">02</span> Brief & Assets
              </h2>
              <div>
                <label className={labelClass}>Brief / Scope of Work</label>
                <textarea 
                  rows={4} placeholder="Describe what you need, size, format, and key message..."
                  value={formData.brief} onChange={e => setFormData({...formData, brief: e.target.value})}
                  className={inputClass} 
                />
              </div>
              <div>
                <label className={labelClass}>Link to Assets (G-Drive/Dropbox)</label>
                <input 
                  type="url" placeholder="https://..."
                  value={formData.drive_link} onChange={e => setFormData({...formData, drive_link: e.target.value})}
                  className={inputClass} 
                />
              </div>
            </section>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? 'Submitting...' : 'Send Request to Design Team'}
              {!loading && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>}
            </button>
          </div>
        </form>

        <p className="text-center text-slate-600 text-xs mt-8 font-black uppercase tracking-widest">
          ACS Artwork Management System v2.0 &bull; Secure Internal Form
        </p>
      </div>
    </div>
  );
};

export default PublicLeadForm;
