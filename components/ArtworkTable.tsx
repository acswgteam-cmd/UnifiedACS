import React, { useState, useMemo } from 'react';
import { WorkContext, ArtworkLog, AppState } from '../types';

interface Props {
  state: AppState;
  onUpdate: (log: ArtworkLog) => void;
  onDelete: (id: string) => void;
}

const ArtworkTable: React.FC<Props> = ({ state, onUpdate, onDelete }) => {
  const [filterContext, setFilterContext] = useState<string>('ALL');
  const [filterDesigner, setFilterDesigner] = useState<string>('ALL');
  const [filterDept, setFilterDept] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<ArtworkLog>>({});

  const getContextLabelForSearch = (log: ArtworkLog): string => {
    switch (log.work_context) {
      case WorkContext.PROJECT: return state.projects.find(p => p.id === log.project_id)?.project_name || 'Project';
      case WorkContext.LEAD: return state.leads.find(l => l.id === log.lead_id)?.lead_name || 'Lead';
      case WorkContext.INTERNAL:
        const dept = state.departments.find(d => d.id === log.department_id)?.department_name || 'Internal';
        const task = state.internalDesigns.find(it => it.id === log.internal_design_id)?.task_name;
        return task ? `${task} (${dept})` : dept;
    }
  };

  const filteredLogs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return state.artworkLogs.filter(log => {
      const matchContext = filterContext === 'ALL' || log.work_context === filterContext;
      const matchDesigner = filterDesigner === 'ALL' || log.pic_designer_id === filterDesigner;
      const matchDept = filterDept === 'ALL' || log.department_id === filterDept;

      if (!matchContext || !matchDesigner || !matchDept) return false;

      if (!query) return true;

      const designerName = state.designers.find(d => d.id === log.pic_designer_id)?.name || '';
      const contextLabel = getContextLabelForSearch(log);
      const searchableFields = [
        log.artwork_name,
        log.artwork_type,
        log.work_context,
        designerName,
        contextLabel,
        log.notes || '',
        log.start_date,
        log.end_date,
      ].join(' ').toLowerCase();

      return searchableFields.includes(query);
    });
  }, [state.artworkLogs, filterContext, filterDesigner, filterDept, searchQuery, state.designers, state.projects, state.leads, state.departments, state.internalDesigns]);

  const getContextLabel = (log: ArtworkLog) => {
    switch (log.work_context) {
      case WorkContext.PROJECT: return state.projects.find(p => p.id === log.project_id)?.project_name || 'Project';
      case WorkContext.LEAD: return state.leads.find(l => l.id === log.lead_id)?.lead_name || 'Lead';
      case WorkContext.INTERNAL:
        const dept = state.departments.find(d => d.id === log.department_id)?.department_name || 'Internal';
        const task = state.internalDesigns.find(it => it.id === log.internal_design_id)?.task_name;
        return task ? `${task} (${dept})` : dept;
    }
  };

  const getDesignerName = (id: string) => {
    return state.designers.find(d => d.id === id)?.name || 'Unknown';
  };

  const getContextColor = (context: WorkContext) => {
    switch (context) {
      case WorkContext.PROJECT: return 'bg-blue-100 text-blue-800';
      case WorkContext.LEAD: return 'bg-emerald-100 text-emerald-800';
      case WorkContext.INTERNAL: return 'bg-purple-100 text-purple-800';
    }
  };

  const handleStartEdit = (log: ArtworkLog) => {
    setEditingId(log.id);
    setEditFormData({ ...log });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleSaveEdit = () => {
    if (editingId) {
      onUpdate(editFormData as ArtworkLog);
      setEditingId(null);
      setEditFormData({});
    }
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let val: string | number | boolean = (type === 'checkbox' && e.target instanceof HTMLInputElement) ? e.target.checked : value;

    // Prevent negative numbers for revision_count
    if (name === 'revision_count') {
      const num = parseInt(value, 10);
      val = (isNaN(num) || num < 0) ? 0 : num;
    }

    setEditFormData(prev => ({ ...prev, [name]: val }));
  };

  const editInputClass = "text-[11px] border-slate-300 rounded bg-white p-1 border font-bold text-slate-900 w-full";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-4 z-10">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Logged Production ({filteredLogs.length})</h3>

        {/* Search Bar */}
        <div className="relative mr-auto">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search artwork..."
            className="text-[11px] font-bold border border-slate-300 rounded-lg py-1.5 pl-8 pr-7 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-700 w-52 placeholder-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 border-l border-slate-300 pl-4">
          <label className="text-[10px] font-black text-slate-700 uppercase">Context</label>
          <select value={filterContext} onChange={(e) => setFilterContext(e.target.value)} className="text-[10px] font-bold border-slate-400 rounded-lg p-1.5 bg-white border">
            <option value="ALL">All Context</option>
            <option value={WorkContext.PROJECT}>Projects</option>
            <option value={WorkContext.LEAD}>Leads</option>
            <option value={WorkContext.INTERNAL}>Internal</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black text-slate-700 uppercase">PIC</label>
          <select value={filterDesigner} onChange={(e) => setFilterDesigner(e.target.value)} className="text-[10px] font-bold border-slate-400 rounded-lg p-1.5 bg-white border">
            <option value="ALL">All Designers</option>
            {state.designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
        <table className="w-full text-left text-[10px] md:text-sm border-collapse min-w-[440px] md:min-w-0">
          <thead className="sticky top-0 z-10 bg-slate-100">
            <tr className="border-b border-slate-200 text-slate-800 font-black uppercase text-[10px] tracking-wider">
              <th className="px-2 md:px-6 py-3 md:py-4">Artwork Name & Type</th>
              <th className="px-2 md:px-6 py-3 md:py-4">Context</th>
              <th className="px-2 md:px-6 py-3 md:py-4">PIC</th>
              <th className="px-2 md:px-6 py-3 md:py-4">Timeline</th>
              <th className="px-2 md:px-6 py-3 md:py-4 text-center">Rev</th>
              <th className="px-2 md:px-6 py-3 md:py-4 text-right">Act</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredLogs.map(log => {
              const isEditing = editingId === log.id;
              if (isEditing) {
                return (
                  <tr key={log.id} className="bg-indigo-50/20">
                    <td className="px-6 py-4">
                      <input
                        name="artwork_name"
                        value={editFormData.artwork_name}
                        onChange={handleEditChange}
                        className={`${editInputClass} mb-2`}
                        placeholder="Artwork Name"
                      />
                      <select
                        name="artwork_type"
                        value={editFormData.artwork_type}
                        onChange={handleEditChange}
                        className={editInputClass}
                      >
                        <option value="2D Design">2D Design</option>
                        <option value="3D Design">3D Design</option>
                        <option value="Video">Video</option>
                      </select>
                    </td>
                    <td className="px-6 py-4"><div className="text-[10px] font-black text-slate-400 uppercase">{log.work_context}</div></td>
                    <td className="px-6 py-4">
                      <select name="pic_designer_id" value={editFormData.pic_designer_id} onChange={handleEditChange} className={editInputClass}>
                        {state.designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <input type="date" name="start_date" value={editFormData.start_date} onChange={handleEditChange} className={editInputClass} />
                        <input type="date" name="end_date" value={editFormData.end_date || ''} onChange={handleEditChange} className={editInputClass} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="number"
                        name="revision_count"
                        min="0"
                        value={editFormData.revision_count}
                        onChange={handleEditChange}
                        className={`${editInputClass} text-center w-12`}
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={handleSaveEdit} className="text-[10px] font-black uppercase bg-indigo-600 text-white px-2 py-1 rounded">Save</button>
                        <button onClick={handleCancelEdit} className="text-[10px] font-black uppercase bg-slate-200 text-slate-600 px-2 py-1 rounded">No</button>
                      </div>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-2 md:px-6 py-2 md:py-4">
                    <div className="font-bold text-slate-900 text-[10px] md:text-sm leading-tight">{log.artwork_name}</div>
                    <span className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-wider border border-slate-200 px-1 py-0.5 rounded bg-slate-100 inline-block mt-0.5">
                      {log.artwork_type}
                    </span>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4">
                    <span className={`inline-flex px-1 py-0.5 rounded text-[7px] md:text-[9px] font-black uppercase mb-0.5 ${getContextColor(log.work_context)}`}>{log.work_context}</span>
                    <div className="text-[9px] md:text-[11px] font-bold text-slate-600 uppercase truncate max-w-[100px] md:max-w-[180px]">{getContextLabel(log)}</div>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-[10px] md:text-sm font-bold text-slate-800">{getDesignerName(log.pic_designer_id)}</td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-[9px] md:text-[11px] font-bold text-slate-500 uppercase">{log.start_date} &bull; {log.end_date || '...'}</td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-center font-black text-slate-900 text-[10px] md:text-xs">{log.revision_count}</td>
                  <td className="px-2 md:px-6 py-2 md:py-4 text-right">
                    <div className="flex justify-end gap-1.5 md:gap-3">
                      <button onClick={() => handleStartEdit(log)} className="text-indigo-600 p-1 rounded hover:bg-indigo-50" title="Edit">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                      </button>
                      <button onClick={() => onDelete(log.id)} className="text-red-500 p-1 rounded hover:bg-red-50" title="Delete">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ArtworkTable;
