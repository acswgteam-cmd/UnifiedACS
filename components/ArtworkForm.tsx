
import React, { useState } from 'react';
import { WorkContext, ArtworkLog, AppState } from '../types';

interface Props {
  state: AppState;
  onSubmit: (log: Omit<ArtworkLog, 'id'>) => void;
}

const ArtworkForm: React.FC<Props> = ({ state, onSubmit }) => {
  const [formData, setFormData] = useState<Partial<ArtworkLog>>({
    work_context: WorkContext.PROJECT,
    artwork_name: '',
    artwork_type: '2D Design',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    pic_designer_id: state.designers[0]?.id || '',
    revision_count: 0,
    approval_required: false,
    project_id: null,
    lead_id: null,
    department_id: null,
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setFormData(prev => ({ 
      ...prev, 
      [name]: val === "" ? null : val, // Ensure empty strings are null for DB FKs
      ...(name === 'work_context' ? { project_id: null, lead_id: null, department_id: null } : {})
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Remove ID and ensure foreign keys are proper
    const { id, ...logData } = formData as ArtworkLog;
    
    onSubmit(logData);
    
    setFormData(prev => ({
      ...prev,
      artwork_name: '',
      notes: ''
    }));
  };

  const labelClass = "text-xs font-black text-slate-900 uppercase tracking-tight mb-1.5 block";
  const inputClass = "w-full rounded-lg border-slate-300 text-slate-900 text-sm p-2.5 border bg-white focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder-slate-400 shadow-sm font-semibold appearance-none";

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-8 animate-in slide-in-from-top duration-300">
      <h2 className="text-xl font-bold mb-8 text-slate-900 flex items-center gap-2">
        <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
        Log Production Activity
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
        <div className="space-y-1">
          <label className={labelClass}>Work Context</label>
          <div className="relative">
            <select name="work_context" value={formData.work_context} onChange={handleChange} className={inputClass}>
              <option value={WorkContext.PROJECT}>Project-Linked</option>
              <option value={WorkContext.LEAD}>Direct Lead</option>
              <option value={WorkContext.INTERNAL}>Internal Department</option>
            </select>
          </div>
        </div>

        {formData.work_context === WorkContext.PROJECT && (
          <div className="space-y-1">
            <label className={labelClass}>Select Project</label>
            <select name="project_id" value={formData.project_id || ""} onChange={handleChange} required className={inputClass}>
              <option value="">Choose Project...</option>
              {state.projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </div>
        )}

        {formData.work_context === WorkContext.LEAD && (
          <div className="space-y-1">
            <label className={labelClass}>Select Lead</label>
            <select name="lead_id" value={formData.lead_id || ""} onChange={handleChange} required className={inputClass}>
              <option value="">Choose Lead...</option>
              {state.leads.map(l => <option key={l.id} value={l.id}>{l.lead_name}</option>)}
            </select>
          </div>
        )}

        {formData.work_context === WorkContext.INTERNAL && (
          <div className="space-y-1">
            <label className={labelClass}>Department</label>
            <select name="department_id" value={formData.department_id || ""} onChange={handleChange} required className={inputClass}>
              <option value="">Choose Department...</option>
              {state.departments.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
            </select>
          </div>
        )}

        <div className="space-y-1">
          <label className={labelClass}>Artwork Name</label>
          <input type="text" name="artwork_name" value={formData.artwork_name} onChange={handleChange} required placeholder="e.g. KV Social Media Jan" className={inputClass} />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Artwork Type</label>
          <select name="artwork_type" value={formData.artwork_type} onChange={handleChange} className={inputClass}>
            <option value="2D Design">2D Design</option>
            <option value="3D Design">3D Design</option>
            <option value="Video">Video</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Designer (PIC)</label>
          <select name="pic_designer_id" value={formData.pic_designer_id} onChange={handleChange} className={inputClass}>
            {state.designers.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelClass}>Start Date</label>
            <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>End Date</label>
            <input type="date" name="end_date" value={formData.end_date} onChange={handleChange} className={inputClass} />
          </div>
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Revision Count</label>
          <input type="number" name="revision_count" value={formData.revision_count} onChange={handleChange} min="0" className={inputClass} />
        </div>

        <div className="md:col-span-2 lg:col-span-3 space-y-1">
          <label className={labelClass}>Activity Notes</label>
          <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className={inputClass} placeholder="Summarize changes or current status..." />
        </div>
      </div>

      <div className="mt-8 flex justify-end items-center gap-6">
        <button type="submit" className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          Commit Log Entry
        </button>
      </div>
    </form>
  );
};

export default ArtworkForm;
