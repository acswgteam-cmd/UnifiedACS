
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Lead } from '../types';
import { supabase } from '../lib/supabase';
import { PUBLIC_FORM_SECRET } from '../data/mockData';
import { getOffHourStatus } from '../lib/holidayUtils';

interface Props {
  onHostSubmit?: (leads: Lead[]) => void;
  currentLeads?: Lead[];
}

const PublicLeadForm: React.FC<Props> = ({ onHostSubmit, currentLeads = [] }) => {
  const { token } = useParams<{ token: string }>();
  const isAuthorized = token === PUBLIC_FORM_SECRET;

  const offHourStatus = getOffHourStatus();

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
    if (!isAuthorized) return;
    setLoading(true);

    // Force inject status as 'ON PROGRESS' to ensure public users can't override it
    const leadData = {
      ...formData,
      status: 'ON PROGRESS'
    };

    try {
      if (!supabase) throw new Error("Database connection not found");

      const { data, error } = await supabase.from('leads').insert([leadData]).select();
      if (error) throw error;
      
      if (onHostSubmit && data && data.length > 0) {
        onHostSubmit([...currentLeads, data[0]]);
      }
      
      setSubmitted(true);
    } catch (err: any) {
      console.error("Submission failed:", err);
      alert(`Submission failed: ${err.message || 'Please check your connection'}`);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full rounded-xl border-zinc-300 text-zinc-900 text-base p-4 border focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all placeholder-slate-400 bg-white shadow-sm font-medium appearance-none";
  const labelClass = "text-sm font-semibold text-zinc-900 uppercase tracking-wide mb-2 block ml-1";

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#1A1C20] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[20px] shadow-2xl p-10 text-center animate-in zoom-in duration-300">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Access Denied</h1>
          <p className="text-zinc-500 mb-8 font-medium">Invalid or expired inquiry token. Please contact the design department for a valid link.</p>
          <div className="p-4 bg-[#FCFCFC] rounded-[20px] text-[10px] text-zinc-400 font-mono break-all">
            ERR_INVALID_AUTH_TOKEN_V1
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[20px] shadow-2xl p-10 text-center animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Request Submitted!</h1>
          <p className="text-zinc-700 mb-8 font-medium">Your creative request has been queued. Our designers will review it shortly.</p>
          <button 
            onClick={() => setSubmitted(false)}
            className="w-full py-4 bg-[#1A1C20] text-white rounded-[20px] font-bold shadow-sm border border-[#EAEAEA] hover:bg-[#FAFAFA]800 transition-colors"
          >
            Submit Another Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        {offHourStatus.show && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl font-bold text-center shadow-sm flex items-center justify-center gap-3">
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            <span>{offHourStatus.message}</span>
          </div>
        )}
        <div className="text-center mb-10">
          <div className="inline-block px-4 py-1.5 bg-zinc-900 text-white rounded-full text-[10px] font-bold uppercase tracking-wider mb-4">
            Creative Support Request
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Inquiry Request</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-[20px] shadow-2xl border border-[#EAEAEA] p-8 md:p-12 overflow-hidden relative">
          {loading && <div className="absolute top-0 left-0 w-full h-1.5 bg-zinc-900 animate-pulse"></div>}
          
          <div className="space-y-8">
            <section className="space-y-6">
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 border-b-2 border-zinc-100 pb-2">
                <span className="text-zinc-900">01</span> Project Details
              </h2>
              <div>
                <label className={labelClass}>Project Name</label>
                <input type="text" required value={formData.lead_name} onChange={e => setFormData({...formData, lead_name: e.target.value})} className={inputClass} placeholder="Nama project Anda..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className={labelClass}>PIC</label>
                  <input type="text" required value={formData.requester} onChange={e => setFormData({...formData, requester: e.target.value})} className={inputClass} placeholder="Nama Anda" />
                </div>
                <div>
                  <label className={labelClass}>Deadline</label>
                  <input type="date" required value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} className={inputClass} />
                </div>
                <div className="relative">
                  <label className={labelClass}>Grade</label>
                  <select value={formData.lead_grade} onChange={e => setFormData({...formData, lead_grade: e.target.value})} className={inputClass}>
                    <option value="A">Grade A (High)</option>
                    <option value="B">Grade B (Standard)</option>
                    <option value="C">Grade C (Low)</option>
                  </select>
                  <div className="pointer-events-none absolute right-4 top-[50px] text-zinc-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 border-b-2 border-zinc-100 pb-2">
                <span className="text-zinc-900">02</span> Brief & Artworks
              </h2>
              <div>
                <label className={labelClass}>Brief / Scope of Work</label>
                <textarea rows={4} placeholder="Tulis brief singkat anda disini..." value={formData.brief} onChange={e => setFormData({...formData, brief: e.target.value})} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>LINK BRIEF (Gdrive/ OneDrive)</label>
                <input type="url" placeholder="https://..." value={formData.drive_link} onChange={e => setFormData({...formData, drive_link: e.target.value})} className={inputClass} />
              </div>
            </section>

            <button type="submit" disabled={loading} className="w-full py-5 bg-zinc-900 text-white rounded-[20px] font-bold text-lg shadow-sm border border-[#EAEAEA] shadow-indigo-100 hover:bg-black transition-all flex items-center justify-center gap-3">
              {loading ? 'Submitting...' : 'Send Request to Design Team'}
              {!loading && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PublicLeadForm;
