
import React, { useState, useEffect } from 'react';
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
    internal_design_id: null,
    department_id: null,
    notes: ''
  });

  // Sync department automatically if an internal task is selected
  useEffect(() => {
    if (formData.work_context === WorkContext.INTERNAL && formData.internal_design_id) {
      const selectedTask = state.internalDesigns.find(t => t.id === formData.internal_design_id);
      if (selectedTask) {
        setFormData(prev => ({ ...prev, department_id: selectedTask.department_id }));
      }
    }
  }, [formData.internal_design_id, formData.work_context, state.internalDesigns]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setFormData(prev => ({ 
      ...prev, 
      [name]: val === "" ? null : val,
      // Reset linked entities when changing context to keep data clean
      ...(name === 'work_context' ? { project_id: null, lead_id: null, internal_design_id: null, department_id: null, approval_required: false } : {})
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { id, ...logData } = formData as ArtworkLog;
    onSubmit(logData);
    
    setFormData(prev => ({
      ...prev,
      artwork_name: '',
      notes: '',
      revision_count: 0,
      approval_required: false
    }));
  };

  // Styles for the compact horizontal layout
  const headerClass = "text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 pb-1";
  const inputBase = "w-full text-xs font-semibold bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-0 rounded-lg transition-all placeholder-slate-400 outline-none";
  const selectBase = `${inputBase} py-2 px-1 cursor-pointer`;
  const textBase = `${inputBase} py-2 px-2`;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
        <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide">Quick Log Entry</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {/* Header Row - visible on larger screens */}
        <div className="hidden lg:flex gap-2 px-1">
          <div className="w-24 shrink-0"><label className={headerClass}>Context</label></div>
          <div className="flex-1 min-w-[140px]"><label className={headerClass}>Reference / Link</label></div>
          <div className="flex-[2] min-w-[200px]"><label className={headerClass}>Artwork Name</label></div>
          <div className="w-24 shrink-0"><label className={headerClass}>Type</label></div>
          <div className="w-28 shrink-0"><label className={headerClass}>PIC</label></div>
          <div className="w-48 shrink-0"><label className={headerClass}>Timeline (Start - End)</label></div>
          <div className="w-12 shrink-0 text-center"><label className={headerClass}>Rev</label></div>
          <div className="flex-1"><label className={headerClass}>Notes</label></div>
          <div className="w-10 shrink-0"></div>
        </div>

        {/* Input Row */}
        <div className="flex flex-col lg:flex-row gap-2 items-start lg:items-center">
          
          {/* Context */}
          <div className="w-full lg:w-24 shrink-0">
            <select name="work_context" value={formData.work_context} onChange={handleChange} className={`${selectBase} font-bold text-indigo-700 bg-indigo-50/50`}>
              <option value={WorkContext.PROJECT}>PROJECT</option>
              <option value={WorkContext.LEAD}>LEAD</option>
              <option value={WorkContext.INTERNAL}>INTERNAL</option>
            </select>
          </div>

          {/* Dynamic Reference Selector */}
          <div className="w-full lg:flex-1 lg:min-w-[140px]">
            {formData.work_context === WorkContext.PROJECT && (
              <select name="project_id" value={formData.project_id || ""} onChange={handleChange} required className={selectBase}>
                <option value="">Select Project...</option>
                {state.projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
            )}
            {formData.work_context === WorkContext.LEAD && (
              <select name="lead_id" value={formData.lead_id || ""} onChange={handleChange} required className={selectBase}>
                <option value="">Select Lead...</option>
                {state.leads.map(l => <option key={l.id} value={l.id}>{l.lead_name}</option>)}
              </select>
            )}
            {formData.work_context === WorkContext.INTERNAL && (
              <div className="flex gap-1">
                 <select name="internal_design_id" value={formData.internal_design_id || ""} onChange={handleChange} className={`${selectBase} w-1/2`}>
                  <option value="">Link Task...</option>
                  {state.internalDesigns.map(id => <option key={id.id} value={id.id}>{id.task_name}</option>)}
                </select>
                <select name="department_id" value={formData.department_id || ""} onChange={handleChange} required className={`${selectBase} w-1/2`}>
                  <option value="">Dept...</option>
                  {state.departments.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Name */}
          <div className="w-full lg:flex-[2] lg:min-w-[200px]">
            <input type="text" name="artwork_name" value={formData.artwork_name} onChange={handleChange} required placeholder="Artwork Name..." className={`${textBase} font-bold`} />
          </div>

          {/* Type */}
          <div className="w-full lg:w-24 shrink-0">
            <select name="artwork_type" value={formData.artwork_type} onChange={handleChange} className={selectBase}>
              <option value="2D Design">2D</option>
              <option value="3D Design">3D</option>
              <option value="Video">Video</option>
            </select>
          </div>

          {/* PIC */}
          <div className="w-full lg:w-28 shrink-0">
            <select name="pic_designer_id" value={formData.pic_designer_id} onChange={handleChange} className={selectBase}>
              {state.designers.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Timeline */}
          <div className="w-full lg:w-48 shrink-0 flex gap-1">
            <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} className={textBase} title="Start Date" />
            <input type="date" name="end_date" value={formData.end_date} onChange={handleChange} className={textBase} title="End Date" />
          </div>

          {/* Rev */}
          <div className="w-full lg:w-12 shrink-0">
            <input type="number" name="revision_count" value={formData.revision_count} onChange={handleChange} min="0" placeholder="0" className={`${textBase} text-center`} title="Revision Count" />
          </div>

          {/* Notes */}
          <div className="w-full lg:flex-1">
            <input type="text" name="notes" value={formData.notes || ''} onChange={handleChange} placeholder="Notes..." className={textBase} />
          </div>

          {/* Action */}
          <div className="w-full lg:w-10 shrink-0 flex justify-end">
            <button type="submit" className="w-full h-[34px] bg-slate-900 hover:bg-indigo-600 text-white rounded-lg shadow-md transition-colors flex items-center justify-center" title="Add Log">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
            </button>
          </div>

        </div>
      </form>
    </div>
  );
};

export default ArtworkForm;
