
import React, { useState, useMemo } from 'react';
import { InternalDesign, Department, InternalStatus } from '../types';
import { supabase } from '../lib/supabase';
import { INTERNAL_FORM_SECRET } from '../App';

interface Props {
  internalDesigns: InternalDesign[];
  departments: Department[];
  onUpdate: () => void;
}

const InternalDesignMaster: React.FC<Props> = ({ internalDesigns, departments, onUpdate }) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDept, setFilterDept] = useState<string>('ALL');
  const [copySuccess, setCopySuccess] = useState(false);
  const [selectedTask, setSelectedTask] = useState<InternalDesign | null>(null);

  const getDeptName = (id: string) => departments.find(d => d.id === id)?.department_name || 'N/A';

  const filteredTasks = useMemo(() => {
    return internalDesigns.filter(t => {
      const matchStatus = filterStatus === 'ALL' || t.status === filterStatus;
      const matchDept = filterDept === 'ALL' || t.department_id === filterDept;
      return matchStatus && matchDept;
    });
  }, [internalDesigns, filterStatus, filterDept]);

  const handleCopyLink = () => {
    const publicUrl = `${window.location.origin}${window.location.pathname}#/portal/v1/internal/${INTERNAL_FORM_SECRET}`;
    navigator.clipboard.writeText(publicUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const updateStatus = async (id: string, newStatus: InternalStatus) => {
    if (!supabase) return;
    const { error } = await supabase.from('internal_designs').update({ status: newStatus }).eq('id', id);
    if (error) alert(error.message);
    else onUpdate();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ON PROGRESS': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'ON REVIEW': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'DONE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'ON HOLD': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-slate-50 text-slate-500';
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">Internal Design Tasks</h1>
          <p className="text-slate-600 text-sm mt-1 font-semibold">Manage inter-department creative requests.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleCopyLink} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 border ${copySuccess ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-300 text-slate-700 hover:border-indigo-500'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
            {copySuccess ? 'Link Copied!' : 'Copy Internal Form Link'}
          </button>
        </div>
      </header>

      <div className="bg-slate-100 p-4 rounded-2xl flex flex-wrap items-center gap-4 border border-slate-200">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Status Filter</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-[10px] font-bold border-slate-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm uppercase tracking-tighter cursor-pointer">
            <option value="ALL">All Status</option>
            <option value="NEW">NEW</option>
            <option value="ON HOLD">ON HOLD</option>
            <option value="ON PROGRESS">ON PROGRESS</option>
            <option value="ON REVIEW">ON REVIEW</option>
            <option value="DONE">DONE</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Requester Dept</span>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="text-[10px] font-bold border-slate-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm uppercase tracking-tighter cursor-pointer">
            <option value="ALL">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-100 border-b border-slate-200 font-bold text-[10px] uppercase text-slate-500 tracking-wider">
            <tr>
              <th className="px-6 py-4">Task Name & Status</th>
              <th className="px-6 py-4">Department & Requester</th>
              <th className="px-6 py-4">Deadline</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTasks.map(task => (
              <tr key={task.id} onClick={() => setSelectedTask(task)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="font-bold text-slate-900 uppercase">{task.task_name}</div>
                    <div className="flex">
                      <span className={`px-2 py-0.5 rounded-full border text-[8px] font-black uppercase ${getStatusColor(task.status)}`}>{task.status}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-[11px] font-bold text-slate-800 uppercase leading-tight">{getDeptName(task.department_id)}</div>
                  <div className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">By: {task.requester_name}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs font-bold text-slate-700">{task.deadline}</span>
                </td>
                <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                  <select 
                    value={task.status} 
                    onChange={(e) => updateStatus(task.id, e.target.value as InternalStatus)}
                    className="text-[9px] font-black border-slate-200 rounded-lg p-1.5 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 uppercase cursor-pointer"
                  >
                    <option value="NEW">Set NEW</option>
                    <option value="ON PROGRESS">Set PROGRESS</option>
                    <option value="ON REVIEW">Set REVIEW</option>
                    <option value="ON HOLD">Set HOLD</option>
                    <option value="DONE">Set DONE</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-slate-900/40" onClick={() => setSelectedTask(null)}>
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase ${getStatusColor(selectedTask.status)}`}>{selectedTask.status}</span>
                <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">{selectedTask.task_name}</h2>
              </div>
              <button onClick={() => setSelectedTask(null)} className="p-1 text-slate-400 hover:text-slate-900"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-[10px] font-bold text-slate-400 uppercase">Dept</span><p className="font-bold text-slate-800 text-xs">{getDeptName(selectedTask.department_id)}</p></div>
                <div><span className="text-[10px] font-bold text-slate-400 uppercase">Deadline</span><p className="font-bold text-red-600 text-xs">{selectedTask.deadline}</p></div>
                <div><span className="text-[10px] font-bold text-slate-400 uppercase">Requester</span><p className="font-bold text-slate-800 text-xs">{selectedTask.requester_name}</p></div>
                <div><span className="text-[10px] font-bold text-slate-400 uppercase">ID Task</span><p className="font-bold text-slate-400 text-[10px] font-mono">{selectedTask.id}</p></div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Brief Description</span>
                <div className="p-4 bg-slate-50 rounded-xl text-sm italic text-slate-700 whitespace-pre-wrap border border-slate-100 min-h-[100px]">
                  {selectedTask.brief || 'No brief provided.'}
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedTask(null)} className="w-full mt-8 py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs">Close Details</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalDesignMaster;
