import React, { useState, useMemo, useRef } from 'react';
import { InternalDesign, Department, InternalStatus } from '../types';
import { supabase } from '../lib/supabase';
import { INTERNAL_FORM_SECRET } from '../data/mockData';

interface Props {
  internalDesigns: InternalDesign[];
  departments: Department[];
  onUpdate: () => void;
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const InternalDesignMaster: React.FC<Props> = ({ internalDesigns, departments, onUpdate }) => {
  const [view, setView] = useState<'list' | 'calendar' | 'board'>('list');
  const [boardGroup, setBoardGroup] = useState<'status' | 'dept' | 'overdue'>('status');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDept, setFilterDept] = useState<string>('ALL');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [copySuccess, setCopySuccess] = useState(false);

  // CRUD States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<InternalDesign | null>(null);
  const [selectedTask, setSelectedTask] = useState<InternalDesign | null>(null);
  const [formData, setFormData] = useState<Partial<InternalDesign>>({
    task_name: '',
    department_id: '',
    requester_name: '',
    deadline: '',
    brief: '',
    status: 'NEW'
  });

  const getDeptName = (id: string) => departments.find(d => d.id === id)?.department_name || 'N/A';

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      total: internalDesigns.length,
      new: internalDesigns.filter(t => t.status === 'NEW').length,
      progress: internalDesigns.filter(t => t.status === 'ON PROGRESS').length,
      review: internalDesigns.filter(t => t.status === 'ON REVIEW').length,
      done: internalDesigns.filter(t => t.status === 'DONE').length,
      hold: internalDesigns.filter(t => t.status === 'ON HOLD').length,
      deadlinesToday: internalDesigns.filter(t => t.deadline === todayStr && t.status !== 'DONE').length,
      overdue: internalDesigns.filter(t => t.deadline < todayStr && t.status !== 'DONE').length
    };
  }, [internalDesigns]);

  const filteredTasks = useMemo(() => {
    return internalDesigns.filter(t => {
      const matchStatus = filterStatus === 'ALL' || t.status === filterStatus;
      const matchDept = filterDept === 'ALL' || t.department_id === filterDept;
      return matchStatus && matchDept;
    });
  }, [internalDesigns, filterStatus, filterDept]);

  const internalBoardGroups = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const groups: Record<string, InternalDesign[]> = {};
    filteredTasks.forEach(t => {
      let key = 'UNASSIGNED';
      if (boardGroup === 'status') key = t.status || 'UNASSIGNED';
      else if (boardGroup === 'dept') key = getDeptName(t.department_id) || 'UNASSIGNED';
      else if (boardGroup === 'overdue') {
        if (t.status === 'DONE') key = 'DONE';
        else if (t.deadline < todayStr) key = 'OVERDUE';
        else if (t.deadline === todayStr) key = 'TODAY';
        else key = 'UPCOMING';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }, [filteredTasks, boardGroup, departments]);

  const calendarLanes = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
    const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];

    const visibleTasks = filteredTasks.filter(t => t.deadline >= startOfMonth && t.deadline <= endOfMonth);
    const sorted = [...visibleTasks].sort((a, b) => a.deadline.localeCompare(b.deadline));

    const lanes: InternalDesign[][] = [];
    sorted.forEach(task => {
      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        const lastInLane = lanes[i][lanes[i].length - 1];
        if (task.deadline > lastInLane.deadline) {
          lanes[i].push(task);
          placed = true;
          break;
        }
      }
      if (!placed) lanes.push([task]);
    });
    return lanes;
  }, [filteredTasks, currentDate]);

  const handleCopyLink = () => {
    const publicUrl = `${window.location.origin}${window.location.pathname}#/portal/v1/internal/${INTERNAL_FORM_SECRET}`;
    navigator.clipboard.writeText(publicUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleOpenAdd = () => {
    setEditingTask(null);
    setFormData({
      task_name: '',
      department_id: departments[0]?.id || '',
      requester_name: '',
      deadline: new Date().toISOString().split('T')[0],
      brief: '',
      status: 'NEW'
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (task: InternalDesign) => {
    setEditingTask(task);
    setFormData(task);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!supabase || !confirm("Hapus tugas internal ini?")) return;
    const { error } = await supabase.from('internal_designs').delete().eq('id', id);
    if (error) alert(error.message);
    else onUpdate();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    if (editingTask) {
      const { error } = await supabase.from('internal_designs').update(formData).eq('id', editingTask.id);
      if (error) alert(error.message);
      else { onUpdate(); setIsFormOpen(false); }
    } else {
      const { error } = await supabase.from('internal_designs').insert([formData]);
      if (error) alert(error.message);
      else { onUpdate(); setIsFormOpen(false); }
    }
  };

  const updateStatus = async (id: string, newStatus: InternalStatus) => {
    if (!supabase) return;
    const { error } = await supabase.from('internal_designs').update({ status: newStatus }).eq('id', id);
    if (error) alert(error.message);
    else onUpdate();
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ON PROGRESS': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'ON REVIEW': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'DONE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'ON HOLD': return 'bg-[#F8F9FA] text-zinc-600 border-[#EAEAEA]';
      default: return 'bg-[#FCFCFC] text-zinc-500';
    }
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startDay = new Date(year, month, 1).getDay();
    const todayStr = new Date().toISOString().split('T')[0];
    const days = [];

    for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} className="min-h-[140px] bg-[#FCFCFC]/50 border-r border-b border-[#EAEAEA]"></div>);

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;

      days.push(
        <div key={d} className={`min-h-[140px] h-full border-r border-b border-[#EAEAEA] p-0 flex flex-col relative ${isToday ? 'bg-purple-50/30' : 'bg-white'}`}>
          <div className="p-2 flex-shrink-0">
            <span className={`text-[10px] font-bold inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-purple-600 text-white' : 'text-zinc-700'}`}>{d}</span>
          </div>
          <div className="flex flex-col space-y-1 pb-2 flex-1">
            {calendarLanes.map((lane, laneIdx) => {
              const task = lane.find(t => dateStr === t.deadline);
              if (!task) return <div key={`spacer-${laneIdx}`} className="min-h-[40px] py-1"></div>;

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={`mx-1 cursor-pointer min-h-[40px] p-1.5 rounded-lg flex flex-col justify-center border transition-all hover:brightness-95 bg-white border-purple-200 shadow-sm`}
                >
                  <span className="text-[9px] font-bold truncate uppercase text-zinc-900 leading-tight">{task.task_name}</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${task.status === 'DONE' ? 'bg-emerald-500' : 'bg-purple-500'}`}></span>
                    <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-tight">{getDeptName(task.department_id)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight uppercase">Internal Design Tasks</h1>
          <p className="text-zinc-600 text-sm mt-1 font-semibold">Manage inter-department creative requests.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto mt-4 md:mt-0">
          <div className="flex bg-[#FAFAFA] p-1 rounded-xl">
            <button onClick={() => setView('list')} className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-white text-purple-700 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`} title="List View"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg></button>
            <button onClick={() => setView('board')} className={`p-2 rounded-lg transition-all ${view === 'board' ? 'bg-white text-purple-700 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`} title="Board View"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" /><path d="M9 3v18M15 3v18" strokeWidth="2" /></svg></button>
            <button onClick={() => setView('calendar')} className={`p-2 rounded-lg transition-all ${view === 'calendar' ? 'bg-white text-purple-700 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`} title="Calendar View"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" /><path d="M16 2v4M8 2v4M3 10h18" strokeWidth="2" /></svg></button>
          </div>
          <button onClick={handleOpenAdd} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold uppercase shadow-sm border border-[#EAEAEA] flex items-center gap-2 hover:bg-purple-700 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            Add Task
          </button>
          <button onClick={handleCopyLink} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 border ${copySuccess ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-zinc-300 text-zinc-700 hover:border-purple-500'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
            {copySuccess ? 'Copied Link!' : 'Form Link'}
          </button>
        </div>
      </header>

      {/* Simplified Status Summary & Deadline Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[20px] border border-[#EAEAEA] shadow-sm flex flex-col md:col-span-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-4">Task Status Summary</span>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-y-4 gap-x-2">
            <StatusItem label="New" value={stats.new} color="text-blue-600" />
            <StatusItem label="Progress" value={stats.progress} color="text-amber-600" />
            <StatusItem label="Review" value={stats.review} color="text-purple-600" />
            <StatusItem label="Hold" value={stats.hold} color="text-zinc-400" />
            <StatusItem label="Done" value={stats.done} color="text-emerald-600" />
            <StatusItem label="Total" value={stats.total} color="text-zinc-900 font-bold underline decoration-purple-500 underline-offset-4" />
          </div>
        </div>

        <div className={`p-6 rounded-[20px] border flex flex-col justify-center transition-colors duration-300 ${stats.deadlinesToday > 0 ? 'bg-red-600 border-red-700 text-white shadow-sm border border-[#EAEAEA] shadow-red-100' : 'bg-white border-[#EAEAEA] text-zinc-900'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${stats.deadlinesToday > 0 ? 'text-red-100' : 'text-zinc-400'}`}>Deadlines Today</span>
          <div className="text-3xl font-bold">{stats.deadlinesToday}</div>
          <p className={`text-[9px] font-bold mt-2 uppercase ${stats.deadlinesToday > 0 ? 'text-red-100' : 'text-zinc-400'}`}>
            {stats.deadlinesToday > 0 ? 'Urgent attention!' : 'Clear for today.'}
          </p>
        </div>

        <div className={`p-6 rounded-[20px] border flex flex-col justify-center transition-colors duration-300 ${stats.overdue > 0 ? 'bg-red-50 border-red-300 text-red-600 shadow-sm' : 'bg-white border-[#EAEAEA] text-zinc-900'}`}>
          <span className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Overdue Tasks</span>
          <div className="text-3xl font-bold">{stats.overdue}</div>
          <p className="text-[9px] font-bold mt-2 uppercase opacity-60">
            {stats.overdue > 0 ? 'Tasks missed deadline' : 'None overdue'}
          </p>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-[#F8F9FA] p-4 rounded-[20px] flex flex-wrap items-center gap-4 border border-[#EAEAEA] shadow-inner">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider px-1">Status Filter</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-[10px] font-bold border-[#EAEAEA] rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-purple-500 shadow-sm uppercase tracking-tight cursor-pointer">
            <option value="ALL">All Status</option>
            <option value="NEW">NEW</option>
            <option value="ON HOLD">ON HOLD</option>
            <option value="ON PROGRESS">ON PROGRESS</option>
            <option value="ON REVIEW">ON REVIEW</option>
            <option value="DONE">DONE</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider px-1">Requester Dept</span>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="text-[10px] font-bold border-[#EAEAEA] rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-purple-500 shadow-sm uppercase tracking-tight cursor-pointer">
            <option value="ALL">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
          </select>
        </div>
      </div>

      {view === 'list' ? (
        <div className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm overflow-hidden overflow-x-auto animate-in fade-in duration-300">
          <table className="w-full text-left text-xs md:text-sm border-collapse min-w-[600px] md:min-w-0">
            <thead className="bg-[#F8F9FA] border-b border-[#EAEAEA] font-bold text-[10px] uppercase text-zinc-500 tracking-wider">
              <tr>
                <th className="px-6 py-4">Task Name & Status</th>
                <th className="px-6 py-4">Department & Requester</th>
                <th className="px-6 py-4">Deadline</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.map(task => {
                const todayStr = new Date().toISOString().split('T')[0];
                const isOverdue = task.deadline < todayStr && task.status !== 'DONE';
                const isToday = task.deadline === todayStr && task.status !== 'DONE';
                return (
                  <tr key={task.id} onClick={() => setSelectedTask(task)} className="hover:bg-[#FCFCFC] transition-colors cursor-pointer group font-bold text-zinc-800 uppercase">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="font-bold text-zinc-900">{task.task_name}</div>
                        <div className="flex">
                          <span className={`px-2 py-0.5 rounded-full border text-[8px] font-bold uppercase ${getStatusColor(task.status)}`}>{task.status}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[11px] font-bold text-zinc-800 leading-tight">{getDeptName(task.department_id)}</div>
                      <div className="text-[10px] text-zinc-400 font-medium mt-0.5 tracking-tight">By: {task.requester_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold leading-tight ${isOverdue ? 'text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-200' : isToday ? 'text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200' : 'text-zinc-700'}`}>
                        {task.deadline}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenEdit(task)} className="text-purple-600 text-[10px] font-bold uppercase">Edit</button>
                        <button onClick={() => handleDelete(task.id)} className="text-red-500 text-[10px] font-bold uppercase">Del</button>
                        <select
                          value={task.status}
                          onChange={(e) => updateStatus(task.id, e.target.value as InternalStatus)}
                          className="text-[9px] font-bold border-[#EAEAEA] rounded-lg p-1.5 bg-[#FCFCFC] outline-none focus:ring-2 focus:ring-purple-500 uppercase cursor-pointer"
                        >
                          <option value="NEW">NEW</option>
                          <option value="ON PROGRESS">PROGRESS</option>
                          <option value="ON REVIEW">REVIEW</option>
                          <option value="ON HOLD">HOLD</option>
                          <option value="DONE">DONE</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredTasks.length === 0 && (
            <div className="p-20 text-center text-zinc-400 font-bold italic">No requests matching filters.</div>
          )}
        </div>
      ) : view === 'board' ? (
        <div className="h-[600px] flex flex-col border border-[#EAEAEA] bg-white rounded-[20px] shadow-sm p-4 overflow-hidden">
          <div className="flex items-center gap-3 mb-4 shrink-0 flex-wrap">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Group By:</span>
            <div className="flex bg-[#FAFAFA]200 p-1 rounded-xl">
              {[
                { id: 'status', label: 'Status' },
                { id: 'dept', label: 'Department' },
                { id: 'overdue', label: 'Deadline Alert' }
              ].map(opt => (
                <button key={opt.id} onClick={() => setBoardGroup(opt.id as any)} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${boardGroup === opt.id ? 'bg-white text-purple-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>{opt.label}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-x-auto flex gap-6 pb-2 items-start custom-scrollbar h-full">
            {Object.keys(internalBoardGroups).sort().map((groupKey, idx) => {
              const headerColors = [
                'border-t-blue-500 bg-blue-50 text-blue-900',
                'border-t-emerald-500 bg-emerald-50 text-emerald-900',
                'border-t-purple-500 bg-purple-50 text-purple-900',
                'border-t-amber-500 bg-amber-50 text-amber-900',
                'border-t-rose-500 bg-rose-50 text-rose-900',
                'border-t-cyan-500 bg-cyan-50 text-cyan-900',
                'border-t-indigo-500 bg-indigo-50 text-indigo-900'
              ];
              const theme = headerColors[idx % headerColors.length];
              return (
                <div key={groupKey} className="w-80 flex-shrink-0 bg-zinc-50/50 rounded-2xl flex flex-col max-h-full border border-zinc-100 shadow-sm h-full">
                  <div className={`p-4 border-b border-zinc-100 border-t-4 uppercase tracking-tight font-bold text-sm flex justify-between items-center rounded-t-2xl shrink-0 ${theme}`}>
                    <span className="truncate pr-2">{groupKey}</span>
                    <span className="bg-white/60 text-current text-[10px] px-2 py-0.5 rounded-full">{internalBoardGroups[groupKey].length}</span>
                  </div>
                  <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar min-h-0">
                    {internalBoardGroups[groupKey].map(task => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const isOverdue = task.deadline < todayStr && task.status !== 'DONE';
                      const isToday = task.deadline === todayStr && task.status !== 'DONE';
                      return (
                        <div key={task.id} onClick={() => setSelectedTask(task)} className="bg-white p-4 rounded-xl shadow-sm border border-[#EAEAEA] cursor-pointer hover:shadow-md transition-shadow group">
                          <div className="flex justify-between items-start mb-2">
                            <span className={`px-2 py-0.5 rounded-md border text-[8px] font-bold uppercase ${getStatusColor(task.status)}`}>{task.status}</span>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(task); }} className="text-zinc-400 hover:text-purple-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" /></svg></button>
                            </div>
                          </div>
                          <h4 className="font-bold text-zinc-900 text-sm uppercase leading-tight mb-2 tracking-tight line-clamp-2" title={task.task_name}>{task.task_name}</h4>
                          <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-zinc-50">
                            <div className="flex justify-between text-[10px] items-center">
                              <span className="text-zinc-400 font-bold uppercase">Dept / Req</span>
                              <span className="text-zinc-800 font-bold truncate max-w-[120px]" title={getDeptName(task.department_id)}>{getDeptName(task.department_id)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] items-center">
                              <span className="text-zinc-400 font-bold uppercase">Deadline</span>
                              <span className={`font-bold tracking-tight ${isOverdue ? 'text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-200' : isToday ? 'text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200' : 'text-zinc-800'}`}>{task.deadline}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm overflow-hidden h-full flex flex-col animate-in fade-in duration-300 min-h-[600px]">
          <div className="p-4 border-b border-[#EAEAEA] bg-[#FCFCFC] flex items-center justify-between">
            <h3 className="font-bold text-zinc-900 text-sm uppercase">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
            <div className="flex gap-2">
              <button onClick={() => navigateMonth(-1)} className="p-1.5 hover:bg-[#FAFAFA]300 rounded-lg transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg></button>
              <button onClick={() => navigateMonth(1)} className="p-1.5 hover:bg-[#FAFAFA]300 rounded-lg transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg></button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            <div className="grid grid-cols-7 border-l border-[#EAEAEA]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="py-2 text-center text-[9px] font-bold uppercase text-zinc-400 bg-[#FCFCFC] border-b border-r border-[#EAEAEA]">{d}</div>
              ))}
              {renderCalendar()}
            </div>
          </div>
        </div>
      )}

      {/* Modal & Detail components remain unchanged */}
      {selectedTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 backdrop-blur-sm bg-[#1A1C20]/40 animate-in fade-in duration-200" onClick={() => setSelectedTask(null)}>
          <div className="bg-white w-full max-w-lg rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 md:p-8 border-b border-[#EAEAEA] bg-[#FCFCFC] flex justify-between items-start">
              <div>
                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase mb-2 inline-block ${getStatusColor(selectedTask.status)}`}>{selectedTask.status}</span>
                <h2 className="text-xl md:text-2xl font-bold text-zinc-900 uppercase tracking-tight">{selectedTask.task_name}</h2>
              </div>
              <button onClick={() => setSelectedTask(null)} className="p-2 bg-white border border-zinc-200 rounded-full hover:bg-zinc-100 transition-all text-zinc-500 hover:text-zinc-900 shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100"><span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Dept</span><p className="font-bold text-zinc-800 text-xs truncate" title={getDeptName(selectedTask.department_id)}>{getDeptName(selectedTask.department_id)}</p></div>
                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100"><span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Deadline</span><p className="font-bold text-red-600 text-xs uppercase">{selectedTask.deadline}</p></div>
                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100"><span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Requester</span><p className="font-bold text-zinc-800 text-xs uppercase truncate" title={selectedTask.requester_name}>{selectedTask.requester_name}</p></div>
                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100 flex flex-col justify-center items-center opacity-70"><span className="text-[9px] font-bold text-zinc-400 uppercase">ID Task</span><p className="font-bold text-zinc-500 text-[10px] font-mono leading-none mt-1">{selectedTask.id.split('-')[0]}</p></div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1.5 ml-1">Brief Description</span>
                <div className="p-4 bg-[#FCFCFC] rounded-xl text-sm italic text-zinc-700 whitespace-pre-wrap border border-zinc-200/60 leading-relaxed max-h-[150px] overflow-y-auto custom-scrollbar">
                  {selectedTask.brief || 'No brief provided for this task.'}
                </div>
              </div>
            </div>
            <div className="p-6 bg-[#F8F9FA] border-t border-[#EAEAEA] flex gap-4">
              <button onClick={() => { setSelectedTask(null); handleOpenEdit(selectedTask); }} className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-md border border-zinc-800 hover:bg-black transition-all">Edit Task</button>
            </div>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-[#1A1C20]/40 animate-in fade-in duration-200">
          <form onSubmit={handleSave} className="bg-white w-full max-w-lg rounded-[20px] shadow-2xl p-8 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-zinc-900 uppercase mb-6">{editingTask ? 'Edit Internal Task' : 'New Internal Task'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Task Name</label>
                <input type="text" required value={formData.task_name} onChange={e => setFormData({ ...formData, task_name: e.target.value })} className="w-full p-3 rounded-xl border border-[#EAEAEA] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600 uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Requester Name</label>
                  <input type="text" required value={formData.requester_name} onChange={e => setFormData({ ...formData, requester_name: e.target.value })} className="w-full p-3 rounded-xl border border-[#EAEAEA] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600 uppercase" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Deadline</label>
                  <input type="date" required value={formData.deadline} onChange={e => setFormData({ ...formData, deadline: e.target.value })} className="w-full p-3 rounded-xl border border-[#EAEAEA] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Department</label>
                <select required value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })} className="w-full p-3 rounded-xl border border-[#EAEAEA] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600 uppercase">
                  {departments.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Brief</label>
                <textarea value={formData.brief} onChange={e => setFormData({ ...formData, brief: e.target.value })} className="w-full p-3 rounded-xl border border-[#EAEAEA] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600" rows={4} />
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button type="submit" className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold uppercase tracking-wider text-xs">Save Task</button>
              <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-3 bg-[#F8F9FA] text-zinc-600 rounded-xl font-bold uppercase tracking-wider text-xs">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const StatusItem = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="flex flex-col">
    <span className="text-[8px] font-bold uppercase text-zinc-400 tracking-tight mb-0.5">{label}</span>
    <span className={`text-sm font-bold ${color}`}>{value}</span>
  </div>
);

export default InternalDesignMaster;