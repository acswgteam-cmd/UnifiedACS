
import React, { useState, useEffect } from 'react';
import { WorkContext, ArtworkLog, AppState } from '../types';
import DateRangePicker from './DateRangePicker';

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
      ...(name === 'work_context' ? { project_id: null, lead_id: null, internal_design_id: null, department_id: null, approval_required: false } : {})
    }));
  };

  const handleDateChange = (start: string, end: string) => {
    setFormData(prev => ({ ...prev, start_date: start, end_date: end }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { id, ...logData } = formData as ArtworkLog;
    onSubmit(logData);
    
    // Reset form but PERSIST THE DATES to allow bulk entry for the same range
    setFormData(prev => ({
      ...prev,
      artwork_name: '',
      notes: '',
      revision_count: 0,
      approval_required: false,
      // start_date and end_date are intentionally omitted here to persist their values
    }));
  };

  // Styles
  const headerClass = "text-[9px] font-black text-[var(--color-ink-4)] uppercase tracking-widest px-1 pb-1";
  const inputBase = "w-full text-xs font-bold bg-[var(--color-s1)] border border-[var(--color-hl)] focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-lg transition-all placeholder-[var(--color-ink-4)] outline-none text-[var(--color-ink)] shadow-sm";
  const selectBase = `${inputBase} py-2.5 px-2 cursor-pointer h-[38px]`;
  const textBase = `${inputBase} py-2.5 px-3 h-[38px]`;

  return (
    // Removed overflow-hidden and added z-30 to ensure datepicker pops out correctly
    <div className="bg-[var(--color-s2)] rounded-2xl border border-[var(--color-hl)] p-5 mb-8 relative z-30">
      
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-md bg-[var(--color-s3)] text-[var(--color-ink)] flex items-center justify-center">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
        </div>
        <div>
          <h2 className="text-xs font-black text-[var(--color-ink)] uppercase tracking-wide">New Entry</h2>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Header Row */}
        <div className="hidden lg:flex gap-3 px-1">
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
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
          
          {/* Context */}
          <div className="w-full lg:w-24 shrink-0">
            <select name="work_context" value={formData.work_context} onChange={handleChange} className={selectBase}>
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
              <div className="flex gap-2">
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
            <input type="text" name="artwork_name" value={formData.artwork_name} onChange={handleChange} required placeholder="Artwork Name..." className={`${textBase}`} />
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

          {/* Timeline - Merged into single DateRangePicker */}
          <div className="w-full lg:w-48 shrink-0 relative z-40">
            <DateRangePicker 
              startDate={formData.start_date}
              endDate={formData.end_date}
              onChange={handleDateChange}
              className={`${inputBase} h-[38px]`}
              placeholder="Select Dates"
              showPresets={false}
            />
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
            <button type="submit" className="w-full h-[38px] bg-slate-900 hover:bg-indigo-600 text-white rounded-lg shadow-sm transition-colors flex items-center justify-center border border-transparent" title="Add Log">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
            </button>
          </div>

        </div>
      </form>
    </div>
  );
};

export default ArtworkForm;
