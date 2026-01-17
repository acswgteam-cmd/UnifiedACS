
import React, { useState, useMemo, useRef } from 'react';
import { InternalDesign, Department, InternalStatus } from '../types';
import { supabase } from '../lib/supabase';
import { INTERNAL_FORM_SECRET } from '../App';

interface Props {
  internalDesigns: InternalDesign[];
  departments: Department[];
  onUpdate: () => void;
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const InternalDesignMaster: React.FC<Props> = ({ internalDesigns, departments, onUpdate }) => {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDept, setFilterDept] = useState<string>('ALL');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [copySuccess, setCopySuccess] = useState(false);
  const [selectedTask, setSelectedTask] = useState<InternalDesign | null>(null);
  const lastScrollTime = useRef(0);

  const getDeptName = (id: string) => departments.find(d => d.id === id)?.department_name || 'N/A';

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      total: internalDesigns.length,
      new: internalDesigns.filter(t => t.status === 'NEW').length,
      progress: internalDesigns.filter(t => t.status === 'ON PROGRESS').length,
      review: internalDesigns.filter(t => t.status === 'ON REVIEW').length,
      done: internalDesigns.filter(t => t.status === 'DONE').length,
      deadlinesToday: internalDesigns.filter(t => t.deadline === todayStr && t.status !== 'DONE').length
    };
  }, [internalDesigns]);

  const filteredTasks = useMemo(() => {
    return internalDesigns.filter(t => {
      const matchStatus = filterStatus === 'ALL' || t.status === filterStatus;
      const matchDept = filterDept === 'ALL' || t.department_id === filterDept;
      return matchStatus && matchDept;
    });
  }, [internalDesigns, filterStatus, filterDept]);

  // Calendar Lane Logic (Simplified for internal tasks)
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
      case 'ON HOLD': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-slate-50 text-slate-500';
    }
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startDay = new Date(year, month, 1).getDay();
    const todayStr = new Date().toISOString().split('T')[0];
    const days = [];
    
    for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} className="min-h-[140px] bg-slate-50/50 border-r border-b border-slate-200"></div>);
    
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      
      days.push(
        <div key={d} className={`min-h-[140px] h-full border-r border-b border-slate-200 p-0 flex flex-col relative ${isToday ? 'bg-purple-50/30' : 'bg-white'}`}>
          <div className="p-2 flex-shrink-0">
            <span className={`text-[10px] font-black inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-purple-600 text-white' : 'text-slate-700'}`}>{d}</span>
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
                  <span className="text-[9px] font-bold truncate uppercase text-slate-900 leading-tight">{task.task_name}</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${task.status === 'DONE' ? 'bg-emerald-500' : 'bg-purple-500'}`}></span>
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">{getDeptName(task.department_id)}</span>
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">Internal Design Tasks</h1>
          <p className="text-slate-600 text-sm mt-1 font-semibold">Manage inter-department creative requests.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-200 p-1 rounded-xl">
            <button onClick={() => setView('list')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'list' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600'}`}>List</button>
            <button onClick={() => setView('calendar')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'calendar' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600'}`}>Calendar</button>
          </div>
          <button onClick={handleCopyLink} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 border ${copySuccess ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-300 text-slate-700 hover:border-purple-500'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
            {copySuccess ? 'Link Copied!' : 'Copy Form Link'}
          </button>
        </div>
      </header>

      {/* Mini Dashboard Metrik */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard label="Total Requests" value={stats.total} color="bg-slate-50 text-slate-900" />
        <MetricCard label="New" value={stats.new} color="bg-blue-50 text-blue-600" />
        <MetricCard label="In Progress" value={stats.progress} color="bg-amber-50 text-amber-600" />
        <MetricCard label="In Review" value={stats.review} color="bg-purple-50 text-purple-600" />
        <MetricCard label="Done" value={stats.done} color="bg-emerald-50 text-emerald-600" />
        <MetricCard label="Deadlines Today" value={stats.deadlinesToday} color={`${stats.deadlinesToday > 0 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-50 text-slate-400 opacity-50'}`} />
      </div>

      <div className="bg-slate-100 p-4 rounded-2xl flex flex-wrap items-center gap-4 border border-slate-200 shadow-inner">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Status Filter</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-[10px] font-bold border-slate-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-purple-500 shadow-sm uppercase tracking-tighter cursor-pointer">
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
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="text-[10px] font-bold border-slate-200 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-purple-500 shadow-sm uppercase tracking-tighter cursor-pointer">
            <option value="ALL">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
          </select>
        </div>
      </div>

      {view === 'list' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
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
                <tr key={task.id} onClick={() => setSelectedTask(task)} className="hover:bg-slate-50 transition-colors cursor-pointer group font-bold">
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
                      className="text-[9px] font-black border-slate-200 rounded-lg p-1.5 bg-slate-50 outline-none focus:ring-2 focus:ring-purple-500 uppercase cursor-pointer"
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
          {filteredTasks.length === 0 && (
            <div className="p-20 text-center text-slate-400 font-bold italic">No requests matching filters.</div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col animate-in fade-in duration-300 min-h-[600px]">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-sm uppercase">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
            <div className="flex gap-2">
              <button onClick={() => navigateMonth(-1)} className="p-1.5 hover:bg-slate-300 rounded-lg transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg></button>
              <button onClick={() => navigateMonth(1)} className="p-1.5 hover:bg-slate-300 rounded-lg transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg></button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            <div className="grid grid-cols-7 border-l border-slate-200">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="py-2 text-center text-[9px] font-black uppercase text-slate-400 bg-slate-50 border-b border-r border-slate-200">{d}</div>
              ))}
              {renderCalendar()}
            </div>
          </div>
        </div>
      )}

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

const MetricCard = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className={`p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center ${color}`}>
    <span className="text-[8px] font-black uppercase tracking-widest opacity-70 mb-1">{label}</span>
    <span className="text-xl font-black leading-none">{value}</span>
  </div>
);

export default InternalDesignMaster;
