
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

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<ArtworkLog>>({});

  const filteredLogs = useMemo(() => {
    return state.artworkLogs.filter(log => {
      const matchContext = filterContext === 'ALL' || log.work_context === filterContext;
      const matchDesigner = filterDesigner === 'ALL' || log.pic_designer_id === filterDesigner;
      const matchDept = filterDept === 'ALL' || log.department_id === filterDept;
      return matchContext && matchDesigner && matchDept;
    });
  }, [state.artworkLogs, filterContext, filterDesigner, filterDept]);

  const getContextLabel = (log: ArtworkLog) => {
    switch (log.work_context) {
      case WorkContext.PROJECT: return state.projects.find(p => p.id === log.project_id)?.project_name || 'Project';
      case WorkContext.LEAD: return state.leads.find(l => l.id === log.lead_id)?.lead_name || 'Lead';
      case WorkContext.INTERNAL: return state.departments.find(d => d.id === log.department_id)?.department_name || 'Internal';
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

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert("No data available to export.");
      return;
    }

    // Define CSV headers
    const headers = [
      "ID",
      "Artwork Name",
      "Type",
      "Context",
      "Entity Name",
      "Designer (PIC)",
      "Start Date",
      "End Date",
      "Revisions",
      "Approval Req",
      "Notes"
    ];

    // Map logs to CSV rows
    const rows = filteredLogs.map(log => [
      log.id,
      `"${log.artwork_name.replace(/"/g, '""')}"`, // Escape quotes
      log.artwork_type,
      log.work_context,
      `"${getContextLabel(log).replace(/"/g, '""')}"`,
      getDesignerName(log.pic_designer_id),
      log.start_date,
      log.end_date || 'Ongoing',
      log.revision_count,
      log.approval_required ? "YES" : "NO",
      `"${(log.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `creative_log_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setEditFormData(prev => ({ ...prev, [name]: val }));
  };

  const editInputClass = "text-xs border-slate-300 rounded bg-white p-1 border font-bold text-slate-900 w-full";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-4 z-10">
        <h3 className="text-sm font-black text-slate-900 mr-auto uppercase tracking-wide">Logged Artworks ({filteredLogs.length})</h3>
        
        {/* Export Button */}
        <button 
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Download CSV
        </button>

        <div className="flex items-center gap-2 border-l border-slate-300 pl-4">
          <label className="text-[10px] font-black text-slate-700 uppercase">Context</label>
          <select 
            value={filterContext} 
            onChange={(e) => setFilterContext(e.target.value)}
            className="text-xs border-slate-400 rounded bg-white p-1.5 border font-bold text-slate-900"
          >
            <option value="ALL">All Contexts</option>
            <option value={WorkContext.PROJECT}>Projects</option>
            <option value={WorkContext.LEAD}>Leads</option>
            <option value={WorkContext.INTERNAL}>Internal</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black text-slate-700 uppercase">Designer</label>
          <select 
            value={filterDesigner} 
            onChange={(e) => setFilterDesigner(e.target.value)}
            className="text-xs border-slate-400 rounded bg-white p-1.5 border font-bold text-slate-900"
          >
            <option value="ALL">All Designers</option>
            {state.designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black text-slate-700 uppercase">Dept</label>
          <select 
            value={filterDept} 
            onChange={(e) => setFilterDept(e.target.value)}
            className="text-xs border-slate-400 rounded bg-white p-1.5 border font-bold text-slate-900"
          >
            <option value="ALL">All Depts</option>
            {state.departments.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-100">
            <tr className="border-b border-slate-200 text-slate-800 font-black uppercase text-[10px] tracking-wider">
              <th className="px-4 py-4">Artwork Details</th>
              <th className="px-4 py-4">Context Entity</th>
              <th className="px-4 py-4">PIC</th>
              <th className="px-4 py-4">Timeline</th>
              <th className="px-4 py-4 text-center">Revs</th>
              <th className="px-4 py-4">Approval</th>
              <th className="px-4 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500 italic font-bold">No logs found matching your filters.</td>
              </tr>
            ) : filteredLogs.map(log => {
              const isEditing = editingId === log.id;
              
              if (isEditing) {
                return (
                  <tr key={log.id} className="bg-indigo-50/30">
                    <td className="px-4 py-4">
                      <input 
                        name="artwork_name" 
                        value={editFormData.artwork_name} 
                        onChange={handleEditChange} 
                        className={editInputClass} 
                      />
                      <select 
                        name="artwork_type" 
                        value={editFormData.artwork_type} 
                        onChange={handleEditChange} 
                        className={`${editInputClass} mt-1`}
                      >
                        <option value="2D Design">2D Design</option>
                        <option value="3D Design">3D Design</option>
                        <option value="Video">Video</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-[10px] font-black text-slate-400 uppercase mb-1">{editFormData.work_context}</div>
                      <div className="text-sm font-black text-slate-600">{getContextLabel(log)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <select 
                        name="pic_designer_id" 
                        value={editFormData.pic_designer_id} 
                        onChange={handleEditChange} 
                        className={editInputClass}
                      >
                        {state.designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <input type="date" name="start_date" value={editFormData.start_date} onChange={handleEditChange} className={editInputClass} />
                        <span className="text-slate-400">→</span>
                        <input type="date" name="end_date" value={editFormData.end_date || ''} onChange={handleEditChange} className={editInputClass} />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <input 
                        type="number" 
                        name="revision_count" 
                        value={editFormData.revision_count} 
                        onChange={handleEditChange} 
                        className={`${editInputClass} text-center w-12 mx-auto`} 
                      />
                    </td>
                    <td className="px-4 py-4">
                      {log.work_context === WorkContext.PROJECT && (
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            name="approval_required" 
                            checked={editFormData.approval_required} 
                            onChange={handleEditChange} 
                          />
                          <span className="text-[10px] font-black uppercase text-slate-500">Req Req</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={handleSaveEdit} className="text-[10px] font-black uppercase bg-indigo-600 text-white px-2 py-1 rounded shadow-sm hover:bg-indigo-700">Save</button>
                        <button onClick={handleCancelEdit} className="text-[10px] font-black uppercase bg-slate-200 text-slate-600 px-2 py-1 rounded shadow-sm hover:bg-slate-300">Cancel</button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="font-black text-slate-900">{log.artwork_name}</div>
                    <div className="text-[11px] font-black text-indigo-700 uppercase mt-0.5">{log.artwork_type}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight mb-1 ${getContextColor(log.work_context)}`}>
                      {log.work_context}
                    </span>
                    <div className="text-sm font-black text-slate-800 truncate max-w-[150px]">
                      {getContextLabel(log)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-black text-slate-900">
                      {getDesignerName(log.pic_designer_id)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-xs font-bold text-slate-700">
                      {log.start_date} <span className="mx-1 text-slate-500">→</span> {log.end_date || 'Ongoing'}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="inline-block bg-slate-900 text-white px-2 py-0.5 rounded font-black text-[10px]">
                      {log.revision_count}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {log.work_context === WorkContext.PROJECT ? (
                      log.approval_required ? (
                        <span className="inline-flex items-center gap-1 text-orange-800 bg-orange-100 px-2 py-1 rounded font-black text-[10px] uppercase">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                          Approval Req
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Optional</span>
                      )
                    ) : (
                      <span className="text-slate-400 text-xs italic font-bold">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => handleStartEdit(log)} 
                        className="text-indigo-600 hover:text-indigo-800 font-black text-[10px] uppercase tracking-wider"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => onDelete(log.id)} 
                        className="text-red-500 hover:text-red-700 font-black text-[10px] uppercase tracking-wider"
                      >
                        Delete
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
