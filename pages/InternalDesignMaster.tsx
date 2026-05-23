import React, { useState, useMemo, useRef } from 'react';
import { InternalDesign, Department, InternalStatus, StatusHistoryEntry } from '../types';
import { supabase } from '../lib/supabase';
import { INTERNAL_FORM_SECRET } from '../data/mockData';

interface Props {
  internalDesigns: InternalDesign[];
  departments: Department[];
  onUpdate: () => void;
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const parseStatusHistory = (brief: string): StatusHistoryEntry[] => {
  const match = brief.match(/<!-- STATUS_HISTORY_START\n([\s\S]*?)\nSTATUS_HISTORY_END -->/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.error("Failed to parse status history", e);
    }
  }
  return [];
};

const serializeStatusHistory = (brief: string, history: StatusHistoryEntry[]): string => {
  const cleanBrief = brief.replace(/<!-- STATUS_HISTORY_START[\s\S]*?STATUS_HISTORY_END -->/, '').trim();
  return `${cleanBrief}\n\n<!-- STATUS_HISTORY_START\n${JSON.stringify(history, null, 2)}\nSTATUS_HISTORY_END -->`;
};

const InternalDesignMaster: React.FC<Props> = ({ internalDesigns, departments, onUpdate }) => {
  const [view, setView] = useState<'list' | 'calendar' | 'board' | 'timeline'>('list');
  const [boardGroup, setBoardGroup] = useState<'status' | 'dept' | 'overdue'>('status');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDept, setFilterDept] = useState<string>('ALL');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [copySuccess, setCopySuccess] = useState(false);
  const [weeksToShow, setWeeksToShow] = useState(10);
  const [zoomMode, setZoomMode] = useState<'day' | 'week' | 'month'>('day');
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});

  // Sync scroll refs
  const timelineHeaderRef = useRef<HTMLDivElement>(null);
  const timelineBodyRef = useRef<HTMLDivElement>(null);

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

    const dataToSave = { ...formData };

    if (editingTask) {
      if (editingTask.status !== dataToSave.status) {
        const currentHistory = parseStatusHistory(dataToSave.brief || '');
        let history = [...currentHistory];
        if (history.length === 0) {
          const createdDate = editingTask.created_at ? new Date(editingTask.created_at) : new Date();
          history.push({ status: editingTask.status, timestamp: createdDate.toISOString() });
        }
        history.push({ status: dataToSave.status as InternalStatus, timestamp: new Date().toISOString() });
        dataToSave.brief = serializeStatusHistory(dataToSave.brief || '', history);
      }
      const { error } = await supabase.from('internal_designs').update(dataToSave).eq('id', editingTask.id);
      if (error) alert(error.message);
      else { onUpdate(); setIsFormOpen(false); }
    } else {
      const history = [{ status: (dataToSave.status || 'NEW') as InternalStatus, timestamp: new Date().toISOString() }];
      dataToSave.brief = serializeStatusHistory(dataToSave.brief || '', history);
      const { error } = await supabase.from('internal_designs').insert([dataToSave]);
      if (error) alert(error.message);
      else { onUpdate(); setIsFormOpen(false); }
    }
  };

  const updateStatus = async (id: string, newStatus: InternalStatus) => {
    if (!supabase) return;
    const task = internalDesigns.find(t => t.id === id);
    if (!task) return;

    const currentHistory = parseStatusHistory(task.brief || '');
    let history = [...currentHistory];
    if (history.length === 0) {
      const createdDate = task.created_at ? new Date(task.created_at) : new Date();
      history.push({ status: task.status, timestamp: createdDate.toISOString() });
    }
    history.push({ status: newStatus, timestamp: new Date().toISOString() });
    const updatedBrief = serializeStatusHistory(task.brief || '', history);

    const { error } = await supabase.from('internal_designs').update({ 
      status: newStatus,
      brief: updatedBrief
    }).eq('id', id);

    if (error) alert(error.message);
    else onUpdate();
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-blue-500/10 text-blue-500';
      case 'ON PROGRESS': return 'bg-amber-500/10 text-amber-500';
      case 'ON REVIEW': return 'bg-purple-500/10 text-purple-500';
      case 'DONE': return 'bg-emerald-500/10 text-emerald-500';
      case 'ON HOLD': return 'bg-zinc-500/10 text-zinc-500';
      default: return 'bg-zinc-100 text-zinc-500';
    }
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startDay = new Date(year, month, 1).getDay();
    const todayStr = new Date().toISOString().split('T')[0];
    const days = [];

    for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} className="min-h-[140px] bg-[var(--s2)]/40 border-r border-b border-zinc-100"></div>);

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;

      days.push(
        <div key={d} className={`min-h-[140px] h-full border-r border-b border-zinc-100 p-0 flex flex-col relative ${isToday ? 'bg-[var(--primary-dim)]/10 text-[var(--primary)]' : 'bg-[var(--s1)] text-[var(--ink)]'}`}>
          <div className="p-2 flex-shrink-0">
            <span className={`text-[10px] font-bold inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-purple-600 text-white' : 'text-[var(--ink-2)]'}`}>{d}</span>
          </div>
          <div className="flex flex-col space-y-1 pb-2 flex-1">
            {calendarLanes.map((lane, laneIdx) => {
              const task = lane.find(t => dateStr === t.deadline);
              if (!task) return <div key={`spacer-${laneIdx}`} className="min-h-[40px] py-1"></div>;

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={`mx-1 cursor-pointer min-h-[40px] p-1.5 rounded-lg flex flex-col justify-center transition-all hover:brightness-95 bg-purple-50 shadow-sm`}
                >
                  <span className="text-[9px] font-bold truncate uppercase text-purple-900 leading-tight">{task.task_name}</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${task.status === 'DONE' ? 'bg-emerald-500' : 'bg-purple-500'}`}></span>
                    <span className="text-[7px] font-bold text-purple-400 uppercase tracking-tight">{getDeptName(task.department_id)}</span>
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

  const handleScrollBody = () => {
    if (timelineBodyRef.current && timelineHeaderRef.current) {
      timelineHeaderRef.current.scrollLeft = timelineBodyRef.current.scrollLeft;
    }
  };

  const handleScrollHeader = () => {
    if (timelineBodyRef.current && timelineHeaderRef.current) {
      timelineBodyRef.current.scrollLeft = timelineHeaderRef.current.scrollLeft;
    }
  };

  const getStatusHexColor = (status: string) => {
    switch (status) {
      case 'NEW': return '#3B82F6';
      case 'ON PROGRESS': return '#F59E0B';
      case 'ON REVIEW': return '#A855F7';
      case 'DONE': return '#10B981';
      case 'ON HOLD': return '#71717A';
      default: return '#D4D4D8';
    }
  };

  const renderTimeline = () => {
    // Determine columns and width based on zoomMode
    const cols: Date[] = [];
    let columnWidth = 112;

    if (zoomMode === 'day') {
      columnWidth = 48; // A bit wider to accommodate dates and hover styling nicely
      const startOfCurrentDay = new Date(currentDate);
      startOfCurrentDay.setHours(0, 0, 0, 0);
      const startDate = new Date(startOfCurrentDay);
      startDate.setDate(startDate.getDate() - 7);
      for (let i = 0; i < 30; i++) {
        const colDate = new Date(startDate);
        colDate.setDate(startDate.getDate() + i);
        colDate.setHours(0, 0, 0, 0);
        cols.push(colDate);
      }
    } else if (zoomMode === 'week') {
      columnWidth = 112;
      const startOfCurrentDay = new Date(currentDate);
      startOfCurrentDay.setHours(0, 0, 0, 0);
      const dVal = new Date(startOfCurrentDay);
      dVal.setDate(dVal.getDate() - 21);
      const getSunday = (dateVal: Date) => {
        const date = new Date(dateVal);
        const day = date.getDay();
        const diff = date.getDate() - day;
        const res = new Date(date.setDate(diff));
        res.setHours(0, 0, 0, 0);
        return res;
      };
      const startSunday = getSunday(dVal);
      for (let i = 0; i < 12; i++) {
        const wDate = new Date(startSunday);
        wDate.setDate(startSunday.getDate() + i * 7);
        wDate.setHours(0, 0, 0, 0);
        cols.push(wDate);
      }
    } else {
      columnWidth = 160;
      const startMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1, 0, 0, 0, 0);
      for (let i = 0; i < 8; i++) {
        const mDate = new Date(startMonthDate.getFullYear(), startMonthDate.getMonth() + i, 1, 0, 0, 0, 0);
        cols.push(mDate);
      }
    }

    const gridWidth = cols.length * columnWidth;
    const timelineStartMs = cols[0].getTime();
    let timelineEndMs = 0;
    if (zoomMode === 'day') {
      timelineEndMs = cols[cols.length - 1].getTime() + 24 * 60 * 60 * 1000;
    } else if (zoomMode === 'week') {
      timelineEndMs = cols[cols.length - 1].getTime() + 7 * 24 * 60 * 60 * 1000;
    } else {
      const lastMonth = cols[cols.length - 1];
      timelineEndMs = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
    }
    const timelineRangeMs = timelineEndMs - timelineStartMs;

    const isTodayCol = (w: Date) => {
      const today = new Date();
      if (zoomMode === 'day') {
        return w.toDateString() === today.toDateString();
      } else if (zoomMode === 'week') {
        const start = w.getTime();
        const end = start + 7 * 24 * 60 * 60 * 1000;
        return today.getTime() >= start && today.getTime() < end;
      } else {
        return today.getFullYear() === w.getFullYear() && today.getMonth() === w.getMonth();
      }
    };

    // Bottom row headers grouping
    const bottomHeaders: { label: string; count: number }[] = [];
    cols.forEach(w => {
      const key = zoomMode === 'month' 
        ? w.getFullYear().toString()
        : `${monthNames[w.getMonth()]} ${w.getFullYear()}`;
      if (bottomHeaders.length > 0 && bottomHeaders[bottomHeaders.length - 1].label === key) {
        bottomHeaders[bottomHeaders.length - 1].count++;
      } else {
        bottomHeaders.push({ label: key, count: 1 });
      }
    });

    const getBarLayout = (taskStart: Date, taskEnd: Date) => {
      const startMs = taskStart.getTime();
      const endMs = taskEnd.getTime();
      
      if (endMs < timelineStartMs || startMs > timelineEndMs) {
        return null;
      }
      
      const visibleStart = Math.max(startMs, timelineStartMs);
      const visibleEnd = Math.min(endMs, timelineEndMs);
      
      const left = ((visibleStart - timelineStartMs) / timelineRangeMs) * 100;
      const width = ((visibleEnd - visibleStart) / timelineRangeMs) * 100;
      
      return { left, width };
    };

    const getTaskSegments = (task: InternalDesign, S: Date, E: Date) => {
      const history = parseStatusHistory(task.brief || '');
      const startMs = S.getTime();
      const endMs = E.getTime();
      const totalDuration = endMs - startMs;
      
      if (history.length === 0) {
        return [{
          status: task.status,
          percentage: 100,
          start: S,
          end: E
        }];
      }

      const sortedHistory = [...history].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const segments = [];
      const timelineEvents: { status: InternalStatus; timeMs: number }[] = [];
      
      timelineEvents.push({ status: sortedHistory[0].status, timeMs: startMs });
      
      sortedHistory.forEach(h => {
        const tMs = new Date(h.timestamp).getTime();
        if (tMs > startMs && tMs < endMs) {
          timelineEvents.push({ status: h.status, timeMs: tMs });
        }
      });
      
      timelineEvents.push({ status: task.status, timeMs: endMs });
      
      for (let i = 0; i < timelineEvents.length - 1; i++) {
        const curEvent = timelineEvents[i];
        const nextEvent = timelineEvents[i + 1];
        
        const duration = nextEvent.timeMs - curEvent.timeMs;
        if (duration > 0) {
          segments.push({
            status: curEvent.status,
            percentage: (duration / totalDuration) * 100,
            start: new Date(curEvent.timeMs),
            end: new Date(nextEvent.timeMs)
          });
        }
      }
      
      if (segments.length === 0) {
        segments.push({
          status: task.status,
          percentage: 100,
          start: S,
          end: E
        });
      }
      
      return segments;
    };

    const getStatusGradient = (status: string) => {
      switch (status) {
        case 'NEW': return 'linear-gradient(90deg, #3b82f6, #60a5fa)';
        case 'ON PROGRESS': return 'linear-gradient(90deg, #f59e0b, #fbbf24)';
        case 'ON REVIEW': return 'linear-gradient(90deg, #a855f7, #c084fc)';
        case 'DONE': return 'linear-gradient(90deg, #10b981, #34d399)';
        case 'ON HOLD': return 'linear-gradient(90deg, #71717a, #a1a1aa)';
        default: return 'linear-gradient(90deg, #d4d4d8, #e4e4e7)';
      }
    };

    const activeDepts = departments.filter(d => d.active);

    return (
      <div className="flex flex-col border border-zinc-100 bg-[var(--s1)] rounded-[24px] shadow-card overflow-hidden h-[calc(100vh-280px)] min-h-[600px] text-[var(--ink)] animate-in fade-in duration-300">
        {/* Timeline Control bar (Fixed at Top) */}
        <div className="p-4 border-b border-zinc-100 bg-[var(--s2)] flex items-center justify-between shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 bg-[var(--s1)] border border-zinc-100 rounded-lg text-[10px] font-bold uppercase hover:bg-[var(--s2)] transition-colors shadow-sm text-[var(--ink)]"
            >
              Today
            </button>
            
            {/* Segmented Zoom Controls */}
            <div className="flex bg-[var(--s2)] p-0.5 rounded-lg border border-zinc-100 shadow-inner">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button 
                  key={mode}
                  onClick={() => setZoomMode(mode)}
                  className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
                    zoomMode === mode 
                      ? 'bg-white text-purple-700 shadow-sm border border-zinc-100' 
                      : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                  }`}
                  title={`Zoom ${mode}`}
                >
                  {mode === 'day' ? 'Day' : mode === 'week' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
            
            <span className="text-[10px] text-[var(--ink-3)] font-bold uppercase ml-2">
              Zoom: {zoomMode === 'day' ? '30 Days' : zoomMode === 'week' ? '12 Weeks' : '8 Months'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setCurrentDate(prev => {
                  const d = new Date(prev);
                  if (zoomMode === 'day') d.setDate(d.getDate() - 7);
                  else if (zoomMode === 'week') d.setDate(d.getDate() - 28);
                  else d.setMonth(d.getMonth() - 2);
                  return d;
                });
              }}
              className="p-1.5 hover:bg-[var(--s2)] rounded-lg transition-colors border border-zinc-100 bg-[var(--s1)] shadow-sm text-[var(--ink)]"
              title="Scroll Left"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button 
              onClick={() => {
                setCurrentDate(prev => {
                  const d = new Date(prev);
                  if (zoomMode === 'day') d.setDate(d.getDate() + 7);
                  else if (zoomMode === 'week') d.setDate(d.getDate() + 28);
                  else d.setMonth(d.getMonth() + 2);
                  return d;
                });
              }}
              className="p-1.5 hover:bg-[var(--s2)] rounded-lg transition-colors border border-zinc-100 bg-[var(--s1)] shadow-sm text-[var(--ink)]"
              title="Scroll Right"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        {/* Calendar Header Row (Fixed at Top) */}
        <div className="flex shrink-0 border-b border-zinc-100">
          {/* Left Spacer for Header (Exact height: 72px) */}
          <div className="w-[260px] shrink-0 border-r border-zinc-100 px-4 flex items-center bg-[var(--s1)] h-[72px] select-none">
            <span className="text-[10px] font-bold text-[var(--ink-3)] uppercase tracking-wider">Stage / Milestone</span>
          </div>
          
          {/* Right Header: Horizontally Scrollable Calendar Columns */}
          <div 
            ref={timelineHeaderRef}
            className="flex-1 overflow-x-auto scrollbar-none select-none bg-[var(--s1)]"
            onScroll={handleScrollHeader}
          >
            <div style={{ width: gridWidth, minWidth: gridWidth }} className="flex flex-col h-[72px]">
              {/* Dates Header Row (Top Row - Height: 36px) */}
              <div className="flex border-b border-zinc-100 h-[36px]">
                {cols.map((w, idx) => {
                  const active = isTodayCol(w);
                  return (
                    <div 
                      key={idx}
                      className={`flex-1 text-center border-r border-zinc-100 last:border-r-0 shrink-0 flex flex-col items-center justify-center font-bold text-[11px] transition-colors relative ${
                        active ? 'bg-[var(--primary-dim)]/15 text-[var(--primary)]' : 'text-[var(--ink-2)]'
                      }`}
                    >
                      <span className={zoomMode === 'month' ? 'text-[10px] uppercase font-extrabold tracking-wider' : ''}>
                        {zoomMode === 'month' ? monthNames[w.getMonth()].substring(0, 3) : w.getDate()}
                      </span>
                      {active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] mt-0.5 animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Months Header Row (Bottom Row - Height: 36px) */}
              <div className="flex h-[36px]">
                {bottomHeaders.map((bh, idx) => (
                  <div 
                    key={idx}
                    style={{ width: `${(bh.count / cols.length) * 100}%` }}
                    className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)] border-r border-zinc-100 last:border-r-0 shrink-0 bg-[var(--s2)] flex items-center justify-center h-full"
                  >
                    {bh.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content Container (Vertically Scrollable as ONE Single Block) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex">
          {/* Left: Department and Tasks (Follows parent scroll naturally) */}
          <div className="w-[260px] shrink-0 border-r border-zinc-100 bg-[var(--s2)] select-none">
            <div className="divide-y divide-zinc-100">
              {activeDepts.map(dept => {
                const deptTasks = filteredTasks.filter(t => t.department_id === dept.id && t.status !== 'DONE');
                const isCollapsed = collapsedDepts[dept.id] || false;
                
                return (
                  <div key={dept.id} className="flex flex-col">
                    {/* Department Row (Exact height: 44px) */}
                    <div 
                      onClick={() => setCollapsedDepts(prev => ({ ...prev, [dept.id]: !isCollapsed }))}
                      className="h-[44px] px-3 flex items-center justify-between cursor-pointer hover:bg-[var(--hl)] bg-[var(--s2)] transition-colors border-b border-zinc-100"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 rounded-full h-2 bg-[var(--primary)] shrink-0" />
                        <span className="text-[10px] font-bold uppercase text-[var(--ink)] truncate tracking-tight">{dept.department_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[var(--ink-3)] shrink-0">
                        <span className="text-[8px] font-bold bg-[var(--s3)] text-[var(--ink-2)] px-1.5 py-0.5 rounded-full">{deptTasks.length}</span>
                        <svg className={`w-3.5 h-3.5 transform transition-transform ${isCollapsed ? '-rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>

                    {/* Department Tasks Sub-Rows */}
                    {!isCollapsed && (
                      <div className="divide-y divide-zinc-100 bg-[var(--s1)]">
                        {deptTasks.length === 0 ? (
                          <div className="px-6 h-[52px] flex items-center text-[9px] font-medium text-[var(--ink-4)] italic border-b border-zinc-100">No tasks assigned</div>
                        ) : (
                          deptTasks.map(task => (
                            <div 
                              key={task.id}
                              onClick={() => setSelectedTask(task)}
                              className="px-6 h-[52px] cursor-pointer hover:bg-[var(--hl)]/50 transition-colors flex flex-col justify-center border-b border-zinc-100"
                            >
                              <span className="text-[9px] font-bold text-[var(--ink)] uppercase truncate leading-tight hover:text-[var(--primary)] transition-colors" title={task.task_name}>{task.task_name}</span>
                              <span className="text-[7.5px] font-bold text-[var(--ink-3)] uppercase tracking-tight mt-0.5">By: {task.requester_name}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Timeline Grid (Stretches vertically, horizontal side-scrolling only) */}
          <div 
            ref={timelineBodyRef}
            className="flex-1 overflow-x-auto h-fit min-h-full"
            onScroll={handleScrollBody}
          >
            <div style={{ width: gridWidth, minWidth: gridWidth }} className="relative divide-y divide-zinc-100 bg-[var(--s1)] min-h-full">
              {activeDepts.map(dept => {
                const deptTasks = filteredTasks.filter(t => t.department_id === dept.id && t.status !== 'DONE');
                const isCollapsed = collapsedDepts[dept.id] || false;
                
                return (
                  <div key={dept.id} className="flex flex-col">
                    {/* Dept Divider row (Exact height: 44px) */}
                    <div className="h-[44px] w-full relative bg-[var(--s2)]/10 border-b border-zinc-100 flex items-center">
                      <div className="absolute inset-0 flex pointer-events-none">
                        {cols.map((w, idx) => (
                          <div 
                            key={idx} 
                            className={`flex-1 border-r h-full last:border-r-0 ${
                              isTodayCol(w) ? 'bg-[var(--primary-dim)]/10' : ''
                            }`}
                            style={{ borderColor: 'rgba(115, 115, 115, 0.07)' }}
                          ></div>
                        ))}
                      </div>
                    </div>

                    {/* Task Grid Lanes */}
                    {!isCollapsed && (
                      <div className="flex flex-col divide-y divide-zinc-100 bg-[var(--s1)]">
                        {deptTasks.length === 0 ? (
                          <div className="h-[52px] w-full relative flex items-center border-b border-zinc-100">
                            <div className="absolute inset-0 flex pointer-events-none">
                              {cols.map((w, idx) => (
                                <div 
                                  key={idx} 
                                  className={`flex-1 border-r h-full last:border-r-0 ${
                                    isTodayCol(w) ? 'bg-[var(--primary-dim)]/3' : ''
                                  }`}
                                  style={{ borderColor: 'rgba(115, 115, 115, 0.07)' }}
                                ></div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          deptTasks.map(task => {
                            // Parse task creation date in local time, fallback to 10 days before deadline
                            const createdDate = task.created_at 
                              ? new Date(task.created_at) 
                              : (() => {
                                  const parts = task.deadline.split('-');
                                  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0);
                                  d.setDate(d.getDate() - 10);
                                  return d;
                                })();
                            createdDate.setHours(0, 0, 0, 0);

                            // Parse deadline date in local time, extending to the end of the day boundary
                            const parts = task.deadline.split('-');
                            const deadlineDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999);
                            
                            // Check timeline positioning
                            const layout = getBarLayout(createdDate, deadlineDate);

                            return (
                              <div key={task.id} className="h-[52px] w-full relative flex items-center px-4 border-b border-zinc-100">
                                {/* Grid columns */}
                                <div className="absolute inset-0 flex pointer-events-none">
                                  {cols.map((w, idx) => (
                                    <div 
                                      key={idx} 
                                      className={`flex-1 border-r h-full last:border-r-0 ${
                                        isTodayCol(w) ? 'bg-[var(--primary-dim)]/5' : ''
                                      }`}
                                      style={{ borderColor: 'rgba(115, 115, 115, 0.07)' }}
                                    ></div>
                                  ))}
                                </div>

                                {/* Absolute Task Timeline Bar */}
                                {layout && (
                                  <div 
                                    style={{ 
                                      left: `${layout.left}%`, 
                                      width: `${layout.width}%`,
                                      minWidth: '24px',
                                      background: getStatusGradient(task.status),
                                    }}
                                    className="absolute h-7 rounded-lg overflow-hidden flex shadow-sm border border-zinc-100/10 group/bar cursor-pointer transition-all hover:brightness-105 hover:shadow-md"
                                    onClick={() => setSelectedTask(task)}
                                  >
                                    {/* Detailed history tooltip on hover */}
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover/bar:block z-[99] bg-zinc-900 text-white text-[10px] p-2.5 rounded-lg shadow-xl pointer-events-none whitespace-nowrap leading-tight">
                                      <div className="font-extrabold text-center uppercase tracking-wider mb-1">{task.status}</div>
                                      <div className="text-[8.5px] text-zinc-400 font-semibold mb-1 text-center">
                                        Total Range: {createdDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - {deadlineDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
                                      </div>
                                      <div className="text-[8px] text-purple-400 font-bold uppercase tracking-tight text-center">
                                        Requester: {task.requester_name}
                                      </div>
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-zinc-900"></div>
                                    </div>

                                    {/* Absolute Left-Aligned Task Name Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-start pointer-events-none px-3">
                                      <span className="text-[8.5px] font-extrabold text-white uppercase truncate drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.85)] tracking-wide select-none leading-none">
                                        {task.task_name}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 text-[var(--ink)]">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight uppercase text-[var(--ink)]">Internal Design Tasks</h1>
          <p className="text-[var(--ink-2)] text-sm mt-1 font-semibold">Manage inter-department creative requests.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto mt-4 md:mt-0">
          <div className="flex bg-[var(--s2)] border border-zinc-100 p-0.5 rounded-xl shadow-inner">
            <button onClick={() => setView('list')} className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-white text-purple-700 shadow-sm border border-zinc-100' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'}`} title="List View"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg></button>
            <button onClick={() => setView('board')} className={`p-2 rounded-lg transition-all ${view === 'board' ? 'bg-white text-purple-700 shadow-sm border border-zinc-100' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'}`} title="Board View"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" /><path d="M9 3v18M15 3v18" strokeWidth="2" /></svg></button>
            <button onClick={() => setView('calendar')} className={`p-2 rounded-lg transition-all ${view === 'calendar' ? 'bg-white text-purple-700 shadow-sm border border-zinc-100' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'}`} title="Calendar View"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" /><path d="M16 2v4M8 2v4M3 10h18" strokeWidth="2" /></svg></button>
            <button onClick={() => setView('timeline')} className={`p-2 rounded-lg transition-all ${view === 'timeline' ? 'bg-white text-purple-700 shadow-sm border border-zinc-100' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'}`} title="Timeline View">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" />
                <path d="M9 3v18M15 3v18M3 9h18M3 15h18" strokeWidth="2" />
              </svg>
            </button>
          </div>
          <button onClick={handleOpenAdd} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold uppercase shadow-sm border border-purple-500/20 flex items-center gap-2 hover:bg-purple-700 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            Add Task
          </button>
          <button onClick={handleCopyLink} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 border ${copySuccess ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-[var(--s1)] border-zinc-100 text-[var(--ink-2)] hover:border-purple-500'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
            {copySuccess ? 'Copied Link!' : 'Form Link'}
          </button>
        </div>
      </header>

      {/* Simplified Status Summary & Deadline Card */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <div className="bg-[var(--s1)] p-3 md:p-6 rounded-[24px] border border-zinc-100 shadow-sm flex flex-col md:col-span-2">
          <span className="text-[10px] font-bold text-[var(--ink-3)] uppercase tracking-wider mb-4">Task Status Summary</span>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-y-4 gap-x-2">
            <StatusItem label="New" value={stats.new} color="text-blue-600" />
            <StatusItem label="Progress" value={stats.progress} color="text-amber-600" />
            <StatusItem label="Review" value={stats.review} color="text-purple-600" />
            <StatusItem label="Hold" value={stats.hold} color="text-[var(--ink-4)]" />
            <StatusItem label="Done" value={stats.done} color="text-emerald-600" />
            <StatusItem label="Total" value={stats.total} color="text-[var(--ink)] font-bold underline decoration-purple-500 underline-offset-4" />
          </div>
        </div>

        <div className={`p-3 md:p-6 rounded-[24px] border flex flex-col justify-center transition-colors duration-300 ${stats.deadlinesToday > 0 ? 'bg-red-600 border-red-700 text-white shadow-sm shadow-red-100' : 'bg-[var(--s1)] border-zinc-100 text-[var(--ink)]'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${stats.deadlinesToday > 0 ? 'text-red-100' : 'text-[var(--ink-3)]'}`}>Deadlines Today</span>
          <div className="text-xl md:text-3xl font-bold">{stats.deadlinesToday}</div>
          <p className={`text-[9px] font-bold mt-2 uppercase ${stats.deadlinesToday > 0 ? 'text-red-100' : 'text-[var(--ink-3)]'}`}>
            {stats.deadlinesToday > 0 ? 'Urgent attention!' : 'Clear for today.'}
          </p>
        </div>

        <div className={`p-3 md:p-6 rounded-[24px] border flex flex-col justify-center transition-colors duration-300 ${stats.overdue > 0 ? 'bg-red-50/80 border-red-200 text-red-700 shadow-sm' : 'bg-[var(--s1)] border-zinc-100 text-[var(--ink)]'}`}>
          <span className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70 text-[var(--ink-3)]">Overdue Tasks</span>
          <div className="text-xl md:text-3xl font-bold">{stats.overdue}</div>
          <p className="text-[9px] font-bold mt-2 uppercase opacity-60">
            {stats.overdue > 0 ? 'Tasks missed deadline' : 'None overdue'}
          </p>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-[var(--s2)] p-4 rounded-[24px] flex flex-wrap items-center gap-4 border border-zinc-100 shadow-inner">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-[var(--ink-3)] uppercase tracking-wider px-1">Status Filter</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-[10px] font-bold border-zinc-100 rounded-lg p-2 bg-[var(--s1)] text-[var(--ink)] outline-none focus:ring-2 focus:ring-purple-500 shadow-sm uppercase tracking-tight cursor-pointer">
            <option value="ALL">All Status</option>
            <option value="NEW">NEW</option>
            <option value="ON HOLD">ON HOLD</option>
            <option value="ON PROGRESS">ON PROGRESS</option>
            <option value="ON REVIEW">ON REVIEW</option>
            <option value="DONE">DONE</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-[var(--ink-3)] uppercase tracking-wider px-1">Requester Dept</span>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="text-[10px] font-bold border-zinc-100 rounded-lg p-2 bg-[var(--s1)] text-[var(--ink)] outline-none focus:ring-2 focus:ring-purple-500 shadow-sm uppercase tracking-tight cursor-pointer">
            <option value="ALL">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
          </select>
        </div>
      </div>

      {view === 'list' ? (
        <div className="bg-[var(--s1)] rounded-[24px] border border-zinc-100 shadow-sm overflow-hidden overflow-x-auto animate-in fade-in duration-300">
          <table className="w-full text-left text-[10px] md:text-sm border-collapse min-w-[400px] md:min-w-0">
            <thead className="bg-[var(--s2)] border-b border-zinc-100 font-bold text-[9px] md:text-[10px] uppercase text-[var(--ink-3)] tracking-wider">
              <tr>
                <th className="px-2 md:px-6 py-2.5 md:py-4">Task & Status</th>
                <th className="px-2 md:px-6 py-2.5 md:py-4">Dept & Req</th>
                <th className="px-2 md:px-6 py-2.5 md:py-4">Due</th>
                <th className="px-2 md:px-6 py-2.5 md:py-4 text-right">Act</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredTasks.map(task => {
                const todayStr = new Date().toISOString().split('T')[0];
                const isOverdue = task.deadline < todayStr && task.status !== 'DONE';
                const isToday = task.deadline === todayStr && task.status !== 'DONE';
                return (
                  <tr key={task.id} onClick={() => setSelectedTask(task)} className="hover:bg-[#FCFCFC] transition-colors cursor-pointer group font-bold text-zinc-800 uppercase">
                    <td className="px-2 md:px-6 py-2 md:py-4">
                      <div className="flex flex-col gap-1">
                        <div className="font-bold text-zinc-900 text-[10px] md:text-sm leading-tight">{task.task_name}</div>
                        <div className="flex">
                          <span className={`px-1.5 md:px-2 py-0.5 rounded-full text-[7px] md:text-[8px] font-bold uppercase ${getStatusColor(task.status)}`}>{task.status}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 md:px-6 py-2 md:py-4">
                      <div className="text-[9px] md:text-[11px] font-bold text-zinc-800 leading-tight">{getDeptName(task.department_id)}</div>
                      <div className="text-[8px] md:text-[10px] text-zinc-400 font-medium mt-0.5 tracking-tight">By: {task.requester_name}</div>
                    </td>
                    <td className="px-2 md:px-6 py-2 md:py-4">
                      <span className={`text-[9px] md:text-xs font-bold leading-tight ${isOverdue ? 'text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded' : isToday ? 'text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded' : 'text-[var(--ink-2)]'}`}>
                        {task.deadline}
                      </span>
                    </td>
                    <td className="px-2 md:px-6 py-2 md:py-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5 md:gap-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenEdit(task)} className="text-purple-600 p-1 rounded hover:bg-purple-50" title="Edit">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(task.id)} className="text-red-500 p-1 rounded hover:bg-red-50" title="Delete">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                        <select
                          value={task.status}
                          onChange={(e) => updateStatus(task.id, e.target.value as InternalStatus)}
                          className="text-[8px] md:text-[9px] font-bold border-zinc-100 rounded-lg p-1 md:p-1.5 bg-[var(--s1)] text-[var(--ink)] outline-none focus:ring-2 focus:ring-purple-500 uppercase cursor-pointer"
                        >
                          <option value="NEW">NEW</option>
                          <option value="ON PROGRESS">PROG</option>
                          <option value="ON REVIEW">REV</option>
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
        <div className="h-[600px] flex flex-col border border-zinc-100 bg-[var(--s1)] text-[var(--ink)] rounded-[24px] shadow-sm p-4 overflow-hidden">
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
                <div key={groupKey} className="w-64 md:w-80 flex-shrink-0 bg-[var(--s2)] rounded-2xl flex flex-col max-h-full border border-zinc-100 shadow-sm h-full">
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
                        <div key={task.id} onClick={() => setSelectedTask(task)} className="bg-[var(--s1)] text-[var(--ink)] p-4 rounded-xl shadow-sm border border-zinc-100 cursor-pointer hover:shadow-md transition-shadow group hover:border-[var(--primary)]/60">
                          <div className="flex justify-between items-start mb-2">
                            <span className={`px-2 py-0.5 rounded-md border text-[8px] font-bold uppercase ${getStatusColor(task.status)}`}>{task.status}</span>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(task); }} className="text-zinc-400 hover:text-purple-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" /></svg></button>
                            </div>
                          </div>
                          <h4 className="font-bold text-[var(--ink)] text-sm uppercase leading-tight mb-2 tracking-tight line-clamp-2" title={task.task_name}>{task.task_name}</h4>
                          <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-zinc-100">
                            <div className="flex justify-between text-[10px] items-center">
                              <span className="text-zinc-400 font-bold uppercase">Dept / Req</span>
                              <span className="text-[var(--ink-2)] font-bold truncate max-w-[120px]" title={getDeptName(task.department_id)}>{getDeptName(task.department_id)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] items-center">
                              <span className="text-zinc-400 font-bold uppercase">Deadline</span>
                              <span className={`font-bold tracking-tight ${isOverdue ? 'text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-200' : isToday ? 'text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200' : 'text-[var(--ink-2)]'}`}>{task.deadline}</span>
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
      ) : view === 'timeline' ? (
        renderTimeline()
      ) : (
        <div className="bg-[var(--s1)] text-[var(--ink)] rounded-[24px] border border-zinc-100 shadow-sm overflow-hidden h-full flex flex-col animate-in fade-in duration-300 min-h-[600px]">
          <div className="p-4 border-b border-zinc-100 bg-[var(--s2)] flex items-center justify-between">
            <h3 className="font-bold text-[var(--ink)] text-sm uppercase">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
            <div className="flex gap-2">
              <button onClick={() => navigateMonth(-1)} className="p-1.5 hover:bg-[var(--s2)] rounded-lg transition-colors text-[var(--ink)]"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg></button>
              <button onClick={() => navigateMonth(1)} className="p-1.5 hover:bg-[var(--s2)] rounded-lg transition-colors text-[var(--ink)]"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg></button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 animate-in fade-in duration-200">
            <div className="grid grid-cols-7 border-l border-zinc-100">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="py-2 text-center text-[9px] font-bold uppercase text-[var(--ink-3)] bg-[var(--s2)] border-b border-r border-zinc-100">{d}</div>
              ))}
              {renderCalendar()}
            </div>
          </div>
        </div>
      )}

      {/* Modal & Detail components remain unchanged */}
      {selectedTask && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-6 backdrop-blur-sm bg-[#1A1C20]/40 animate-in fade-in duration-200" onClick={() => setSelectedTask(null)}>
          <div className="bg-[var(--s1)] text-[var(--ink)] w-full max-w-lg rounded-t-[24px] md:rounded-[24px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in duration-200 max-h-[90vh] md:max-h-none overflow-y-auto border border-zinc-100 animate-in fade-in duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-6 md:p-8 border-b border-zinc-100 bg-[var(--s2)] flex justify-between items-start">
              <div>
                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase mb-2 inline-block ${getStatusColor(selectedTask.status)}`}>{selectedTask.status}</span>
                <h2 className="text-xl md:text-2xl font-bold text-[var(--ink)] uppercase tracking-tight">{selectedTask.task_name}</h2>
              </div>
              <button onClick={() => setSelectedTask(null)} className="p-2 bg-[var(--s1)] border border-zinc-100 rounded-full hover:bg-[var(--s2)] transition-all text-[var(--ink-3)] hover:text-[var(--ink)] shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div className="bg-[var(--s2)] p-3 rounded-xl border border-zinc-100 text-[var(--ink)]"><span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Dept</span><p className="font-bold text-[var(--ink)] text-xs truncate" title={getDeptName(selectedTask.department_id)}>{getDeptName(selectedTask.department_id)}</p></div>
                <div className="bg-[var(--s2)] p-3 rounded-xl border border-zinc-100 text-[var(--ink)]"><span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Deadline</span><p className="font-bold text-red-600 text-xs uppercase">{selectedTask.deadline}</p></div>
                <div className="bg-[var(--s2)] p-3 rounded-xl border border-zinc-100 text-[var(--ink)]"><span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Requester</span><p className="font-bold text-[var(--ink)] text-xs uppercase truncate" title={selectedTask.requester_name}>{selectedTask.requester_name}</p></div>
                <div className="bg-[var(--s2)] p-3 rounded-xl border border-zinc-100 flex flex-col justify-center items-center opacity-70"><span className="text-[9px] font-bold text-zinc-400 uppercase">ID Task</span><p className="font-bold text-zinc-500 text-[10px] font-mono leading-none mt-1">{selectedTask.id.split('-')[0]}</p></div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1.5 ml-1">Brief Description</span>
                <div className="p-4 bg-[var(--s2)]/50 text-[var(--ink-2)] rounded-xl text-sm italic whitespace-pre-wrap border border-zinc-100 leading-relaxed max-h-[150px] overflow-y-auto custom-scrollbar">
                  {selectedTask.brief || 'No brief provided for this task.'}
                </div>
              </div>
            </div>
            <div className="p-6 bg-[var(--s2)] border-t border-zinc-100 flex gap-4">
              <button onClick={() => { setSelectedTask(null); handleOpenEdit(selectedTask); }} className="flex-1 py-3 bg-zinc-900 text-white dark:bg-purple-600 dark:border-purple-600 rounded-xl font-bold uppercase tracking-wider text-xs shadow-md border border-zinc-800 hover:bg-black transition-all">Edit Task</button>
            </div>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6 backdrop-blur-sm bg-[#1A1C20]/40 animate-in fade-in duration-200">
          <form onSubmit={handleSave} className="bg-[var(--s1)] text-[var(--ink)] w-full max-w-lg rounded-t-[20px] md:rounded-[20px] shadow-2xl p-5 md:p-8 animate-in slide-in-from-bottom md:zoom-in duration-200 max-h-[90vh] md:max-h-none overflow-y-auto border border-zinc-100" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-[var(--ink)] uppercase mb-6">{editingTask ? 'Edit Internal Task' : 'New Internal Task'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Task Name</label>
                <input type="text" required value={formData.task_name} onChange={e => setFormData({ ...formData, task_name: e.target.value })} className="w-full p-3 rounded-xl border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600 uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Requester Name</label>
                  <input type="text" required value={formData.requester_name} onChange={e => setFormData({ ...formData, requester_name: e.target.value })} className="w-full p-3 rounded-xl border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600 uppercase" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Deadline</label>
                  <input type="date" required value={formData.deadline} onChange={e => setFormData({ ...formData, deadline: e.target.value })} className="w-full p-3 rounded-xl border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Department</label>
                <select required value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })} className="w-full p-3 rounded-xl border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600 uppercase">
                  {departments.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Brief</label>
                <textarea value={formData.brief} onChange={e => setFormData({ ...formData, brief: e.target.value })} className="w-full p-3 rounded-xl border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600" rows={4} />
              </div>
            </div>
            <div className="flex gap-3 md:gap-4 mt-6 md:mt-8">
              <button type="submit" className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-purple-700 transition-all">Save Task</button>
              <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-3 bg-[var(--s2)] text-[var(--ink-2)] border border-zinc-100 rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-[var(--s3)] transition-all">Cancel</button>
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