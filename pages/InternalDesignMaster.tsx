import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { InternalDesign, Department, InternalStatus, StatusHistoryEntry, ChangelogEntry, ChangelogChangeType } from '../types';
import { supabase } from '../lib/supabase';
import { INTERNAL_FORM_SECRET } from '../data/mockData';

interface Props {
  internalDesigns: InternalDesign[];
  departments: Department[];
  onUpdate: () => void;
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ─── Legacy brief-based status history (kept for backward compat) ─────────────
const parseStatusHistory = (brief: string): StatusHistoryEntry[] => {
  const match = brief.match(/<!-- STATUS_HISTORY_START\n([\s\S]*?)\nSTATUS_HISTORY_END -->/);
  if (match) {
    try { return JSON.parse(match[1]); } catch (e) { console.error('Failed to parse status history', e); }
  }
  return [];
};
const serializeStatusHistory = (brief: string, history: StatusHistoryEntry[]): string => {
  const cleanBrief = brief.replace(/<!-- STATUS_HISTORY_START[\s\S]*?STATUS_HISTORY_END -->/, '').trim();
  return `${cleanBrief}\n\n<!-- STATUS_HISTORY_START\n${JSON.stringify(history, null, 2)}\nSTATUS_HISTORY_END -->`;
};
const getBriefText = (brief: string): string =>
  brief.replace(/<!-- STATUS_HISTORY_START[\s\S]*?STATUS_HISTORY_END -->/, '').trim();

// ─── Changelog helpers ────────────────────────────────────────────────────────
const formatRelativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 2) return 'Baru saja';
  if (m < 60) return `${m} menit lalu`;
  if (h < 24) return `${h} jam lalu`;
  if (d < 7) return `${d} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatAbsoluteTime = (iso: string): string =>
  new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const convertToWebP = (file: File): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Resize jika terlalu besar
      const maxW = 1920, maxH = 1080;
      let { width, height } = img;
      if (width > maxW) { height = Math.round(height * maxW / width); width = maxW; }
      if (height > maxH) { width = Math.round(width * maxH / height); height = maxH; }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url);
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/webp', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });

const getChangelogIcon = (type: ChangelogChangeType) => {
  switch (type) {
    case 'TASK_CREATED':   return { icon: '✦', bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' };
    case 'STATUS_CHANGE':  return { icon: '⟳', bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' };
    case 'DEADLINE_CHANGE':return { icon: '📅', bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' };
    case 'DEPT_CHANGE':    return { icon: '🏢', bg: 'bg-cyan-100', text: 'text-cyan-600', border: 'border-cyan-200' };
    case 'BRIEF_CHANGE':   return { icon: '📝', bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200' };
    case 'NOTE':           return { icon: '💬', bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' };
    default:               return { icon: '•', bg: 'bg-zinc-100', text: 'text-zinc-500', border: 'border-zinc-200' };
  }
};

const getChangelogLabel = (entry: ChangelogEntry, getDeptName: (id: string) => string): React.ReactNode => {
  switch (entry.change_type) {
    case 'TASK_CREATED':
      return <span className="text-zinc-700 text-xs font-semibold">Task dibuat</span>;
    case 'STATUS_CHANGE':
      return (
        <span className="text-xs font-semibold text-zinc-700">
          Status berubah:&nbsp;
          <span className="font-bold text-zinc-500 line-through">{entry.old_value}</span>
          &nbsp;→&nbsp;
          <span className="font-bold text-blue-700">{entry.new_value}</span>
        </span>
      );
    case 'DEADLINE_CHANGE':
      return (
        <span className="text-xs font-semibold text-zinc-700">
          Deadline berubah:&nbsp;
          <span className="font-bold text-zinc-500 line-through">{entry.old_value}</span>
          &nbsp;→&nbsp;
          <span className="font-bold text-amber-700">{entry.new_value}</span>
        </span>
      );
    case 'DEPT_CHANGE':
      return (
        <span className="text-xs font-semibold text-zinc-700">
          Departemen berubah:&nbsp;
          <span className="font-bold text-zinc-500 line-through">{entry.old_value}</span>
          &nbsp;→&nbsp;
          <span className="font-bold text-cyan-700">{entry.new_value}</span>
        </span>
      );
    case 'BRIEF_CHANGE':
      return <span className="text-xs font-semibold text-zinc-700">Brief/deskripsi diperbarui</span>;
    case 'NOTE':
      return <span className="text-xs font-bold text-emerald-700">Catatan Progress</span>;
    default:
      return <span className="text-xs text-zinc-600">Perubahan</span>;
  }
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

// ─── Main Component ───────────────────────────────────────────────────────────
const InternalDesignMaster: React.FC<Props> = ({ internalDesigns, departments, onUpdate }) => {
  const [view, setView] = useState<'list' | 'calendar' | 'board' | 'timeline'>('list');
  const [boardGroup, setBoardGroup] = useState<'status' | 'dept' | 'overdue'>('status');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDept, setFilterDept] = useState<string>('ALL');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [copySuccess, setCopySuccess] = useState(false);
  const [zoomMode, setZoomMode] = useState<'day' | 'week' | 'month'>('day');
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});

  // ── Tasks with changelog state & helpers ───────────────────────────────────
  const [tasksWithChangelog, setTasksWithChangelog] = useState<Map<string, number>>(new Map());

  const loadChangelogPresence = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('internal_design_changelog')
      .select('internal_design_id')
      .eq('change_type', 'NOTE');
    if (!error && data) {
      const counts = new Map<string, number>();
      data.forEach(item => {
        const id = item.internal_design_id;
        counts.set(id, (counts.get(id) || 0) + 1);
      });
      setTasksWithChangelog(counts);
    }
  }, []);

  useEffect(() => {
    loadChangelogPresence();
  }, [internalDesigns, loadChangelogPresence]);

  const getTaskCode = useCallback((task: InternalDesign) => {
    const shortId = task.id.split('-')[0].substring(0, 4).toUpperCase();
    const dept = getDeptName(task.department_id).substring(0, 4).toUpperCase();
    const year = task.created_at ? new Date(task.created_at).getFullYear() : 2026;
    return `${dept}-DES-${year}-${shortId}`;
  }, [departments]);

  const getTimelineTaskStatus = useCallback((task: InternalDesign) => {
    if (task.status === 'DONE') return 'DONE';
    const todayStr = new Date().toISOString().split('T')[0];
    if (task.deadline < todayStr) return 'OVERDUE';
    
    // Due soon if deadline is within 7 days
    const deadlineDate = new Date(task.deadline);
    const todayDate = new Date();
    todayDate.setHours(0,0,0,0);
    const diffTime = deadlineDate.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 7) return 'DUE SOON';
    
    if (task.status === 'ON PROGRESS') return 'IN PROGRESS';
    if (task.status === 'ON REVIEW') return 'ON REVIEW';
    if (task.status === 'ON HOLD') return 'ON HOLD';
    return 'NOT STARTED';
  }, []);

  const calculateProgress = useCallback((task: InternalDesign) => {
    if (task.status === 'DONE') return 100;
    if (task.status === 'NEW' || task.status === 'ON HOLD') return 0;
    if (task.status === 'ON REVIEW') return 90;
    
    // Calculate progress based on time elapsed
    const created = task.created_at ? new Date(task.created_at).getTime() : new Date(task.deadline).getTime() - 10 * 24 * 60 * 60 * 1000;
    const deadline = new Date(task.deadline).getTime();
    const now = new Date().getTime();
    if (now >= deadline) return 95;
    if (now <= created) return 10;
    const percent = Math.round(((now - created) / (deadline - created)) * 100);
    return Math.min(Math.max(percent, 20), 85);
  }, []);

  const getBarColor = useCallback((statusCat: string) => {
    switch (statusCat) {
      case 'OVERDUE': return '#ef4444';
      case 'DUE SOON': return '#f59e0b';
      case 'IN PROGRESS': return '#3B82F6';
      case 'ON REVIEW': return '#A855F7';
      case 'DONE': return '#10B981';
      case 'ON HOLD': return '#71717A';
      default: return '#9ca3af';
    }
  }, []);

  const timelineHeaderRef = useRef<HTMLDivElement>(null);
  const timelineBodyRef = useRef<HTMLDivElement>(null);

  // CRUD States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<InternalDesign | null>(null);
  const [selectedTask, setSelectedTask] = useState<InternalDesign | null>(null);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [formData, setFormData] = useState<Partial<InternalDesign>>({
    task_name: '', department_id: '', requester_name: '',
    deadline: '', brief: '', status: 'NEW'
  });

  // ── Changelog States ──────────────────────────────────────────────────────
  const [taskChangelog, setTaskChangelog] = useState<ChangelogEntry[]>([]);
  const [isLoadingChangelog, setIsLoadingChangelog] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'changelog'>('info');

  // Note form states
  const [noteText, setNoteText] = useState('');
  const [noteLink, setNoteLink] = useState('');
  const [noteImageFile, setNoteImageFile] = useState<File | null>(null);
  const [noteImagePreview, setNoteImagePreview] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const noteImageInputRef = useRef<HTMLInputElement>(null);

  const getDeptName = (id: string) => departments.find(d => d.id === id)?.department_name || 'N/A';

  // ── Load changelog for selected task ─────────────────────────────────────
  const loadChangelog = useCallback(async (taskId: string) => {
    if (!supabase) return;
    setIsLoadingChangelog(true);
    const { data, error } = await supabase
      .from('internal_design_changelog')
      .select('*')
      .eq('internal_design_id', taskId)
      .order('created_at', { ascending: false });
    if (!error && data) setTaskChangelog(data as ChangelogEntry[]);
    setIsLoadingChangelog(false);
  }, []);

  const handleSelectTask = useCallback((task: InternalDesign) => {
    setSelectedTask(task);
    setActiveDetailTab('info');
    setIsEditingInline(false);
    setNoteText('');
    setNoteLink('');
    setNoteImageFile(null);
    setNoteImagePreview(null);
    loadChangelog(task.id);
  }, [loadChangelog]);

  // ── Insert changelog entry helper ─────────────────────────────────────────
  const insertChangelog = async (
    taskId: string,
    changeType: ChangelogChangeType,
    extra: Partial<Omit<ChangelogEntry, 'id' | 'internal_design_id' | 'change_type' | 'created_at'>> = {}
  ) => {
    if (!supabase) return;
    await supabase.from('internal_design_changelog').insert([{
      internal_design_id: taskId,
      change_type: changeType,
      changed_by: 'Admin',
      ...extra
    }]);
  };

  // ── Upload image to Supabase Storage ─────────────────────────────────────
  const uploadChangelogImage = async (file: File): Promise<string | null> => {
    if (!supabase) return null;
    setUploadingImage(true);
    try {
      const webpBlob = await convertToWebP(file);
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
      const { data, error } = await supabase.storage
        .from('changelog-images')
        .upload(fileName, webpBlob, { contentType: 'image/webp', upsert: false });
      if (error) { console.error('Upload error:', error); return null; }
      const { data: urlData } = supabase.storage.from('changelog-images').getPublicUrl(data.path);
      return urlData?.publicUrl || null;
    } catch (e) {
      console.error('Image convert/upload failed:', e);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  // ── Handle image file pick ────────────────────────────────────────────────
  const handleNoteImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNoteImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setNoteImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Save manual note ──────────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!selectedTask || (!noteText.trim() && !noteLink.trim() && !noteImageFile)) return;
    setIsSavingNote(true);
    let imageUrl: string | null = null;
    if (noteImageFile) {
      imageUrl = await uploadChangelogImage(noteImageFile);
    }
    await insertChangelog(selectedTask.id, 'NOTE', {
      note: noteText.trim() || null,
      reference_link: noteLink.trim() || null,
      image_url: imageUrl,
    });
    setNoteText('');
    setNoteLink('');
    setNoteImageFile(null);
    setNoteImagePreview(null);
    if (noteImageInputRef.current) noteImageInputRef.current.value = '';
    await loadChangelog(selectedTask.id);
    setIsSavingNote(false);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
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

  const filteredTasks = useMemo(() =>
    internalDesigns.filter(t => {
      const matchStatus = filterStatus === 'ALL' || t.status === filterStatus;
      const matchDept = filterDept === 'ALL' || t.department_id === filterDept;
      return matchStatus && matchDept;
    }), [internalDesigns, filterStatus, filterDept]);

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
        if (task.deadline > lastInLane.deadline) { lanes[i].push(task); placed = true; break; }
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
      task_name: '', department_id: departments[0]?.id || '',
      requester_name: '', deadline: new Date().toISOString().split('T')[0],
      brief: '', status: 'NEW'
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (task: InternalDesign) => {
    setSelectedTask(task);
    setEditingTask(task);
    setFormData(task);
    setIsEditingInline(true);
    loadChangelog(task.id);
  };

  const handleDelete = async (id: string) => {
    if (!supabase || !confirm('Hapus tugas internal ini?')) return;
    const { error } = await supabase.from('internal_designs').delete().eq('id', id);
    if (error) alert(error.message);
    else { if (selectedTask?.id === id) setSelectedTask(null); onUpdate(); }
  };

  // ── Save / Create task (with auto changelog) ──────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const dataToSave = { ...formData };

    if (editingTask) {
      // Detect changes and batch changelog entries
      const changes: Array<{ type: ChangelogChangeType; old_value?: string; new_value?: string }> = [];

      if (editingTask.status !== dataToSave.status) {
        // Keep legacy brief-based status history for timeline view
        const currentHistory = parseStatusHistory(dataToSave.brief || '');
        let history = [...currentHistory];
        if (history.length === 0) {
          history.push({ status: editingTask.status, timestamp: editingTask.created_at ? new Date(editingTask.created_at).toISOString() : new Date().toISOString() });
        }
        history.push({ status: dataToSave.status as InternalStatus, timestamp: new Date().toISOString() });
        dataToSave.brief = serializeStatusHistory(dataToSave.brief || '', history);
        changes.push({ type: 'STATUS_CHANGE', old_value: editingTask.status, new_value: dataToSave.status as string });
      }
      if (editingTask.deadline !== dataToSave.deadline) {
        changes.push({ type: 'DEADLINE_CHANGE', old_value: editingTask.deadline, new_value: dataToSave.deadline as string });
      }
      if (editingTask.department_id !== dataToSave.department_id) {
        changes.push({
          type: 'DEPT_CHANGE',
          old_value: getDeptName(editingTask.department_id),
          new_value: getDeptName(dataToSave.department_id as string)
        });
      }
      const oldBriefText = getBriefText(editingTask.brief || '');
      const newBriefText = getBriefText(dataToSave.brief || '');
      if (oldBriefText !== newBriefText) {
        changes.push({ type: 'BRIEF_CHANGE' });
      }

      const { error } = await supabase.from('internal_designs').update(dataToSave).eq('id', editingTask.id);
      if (error) { alert(error.message); return; }

      // Insert all changelog entries
      for (const c of changes) {
        await insertChangelog(editingTask.id, c.type, { old_value: c.old_value, new_value: c.new_value });
      }

      onUpdate();
      setIsFormOpen(false);
      setIsEditingInline(false);
      setEditingTask(null);
      // Refresh changelog if this task is currently selected
      if (selectedTask?.id === editingTask.id) {
        loadChangelog(editingTask.id);
        // Update selectedTask data too
        setSelectedTask({ ...editingTask, ...dataToSave } as InternalDesign);
      }
    } else {
      // New task — insert with legacy history
      const history = [{ status: (dataToSave.status || 'NEW') as InternalStatus, timestamp: new Date().toISOString() }];
      dataToSave.brief = serializeStatusHistory(dataToSave.brief || '', history);
      const { data: inserted, error } = await supabase.from('internal_designs').insert([dataToSave]).select().single();
      if (error) { alert(error.message); return; }
      // Log creation
      if (inserted) await insertChangelog(inserted.id, 'TASK_CREATED');
      onUpdate();
      setIsFormOpen(false);
    }
  };

  // ── Quick status change ───────────────────────────────────────────────────
  const updateStatus = async (id: string, newStatus: InternalStatus) => {
    if (!supabase) return;
    const task = internalDesigns.find(t => t.id === id);
    if (!task) return;
    const oldStatus = task.status;

    const currentHistory = parseStatusHistory(task.brief || '');
    let history = [...currentHistory];
    if (history.length === 0) {
      history.push({ status: task.status, timestamp: task.created_at ? new Date(task.created_at).toISOString() : new Date().toISOString() });
    }
    history.push({ status: newStatus, timestamp: new Date().toISOString() });
    const updatedBrief = serializeStatusHistory(task.brief || '', history);

    const { error } = await supabase.from('internal_designs').update({ status: newStatus, brief: updatedBrief }).eq('id', id);
    if (error) { alert(error.message); return; }
    await insertChangelog(id, 'STATUS_CHANGE', { old_value: oldStatus, new_value: newStatus });
    onUpdate();
    if (selectedTask?.id === id) {
      setSelectedTask({ ...selectedTask, status: newStatus, brief: updatedBrief });
      loadChangelog(id);
    }
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  // ─── Calendar render ──────────────────────────────────────────────────────
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
                <div key={task.id} onClick={() => handleSelectTask(task)}
                  className="mx-1 cursor-pointer min-h-[40px] p-1.5 rounded-lg flex flex-col justify-center transition-all hover:brightness-95 bg-purple-50 shadow-sm">
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
    if (timelineBodyRef.current && timelineHeaderRef.current) timelineHeaderRef.current.scrollLeft = timelineBodyRef.current.scrollLeft;
  };
  const handleScrollHeader = () => {
    if (timelineBodyRef.current && timelineHeaderRef.current) timelineBodyRef.current.scrollLeft = timelineHeaderRef.current.scrollLeft;
  };

  const getStatusHexColor = (status: string) => {
    switch (status) {
      case 'NEW': return '#3B82F6'; case 'ON PROGRESS': return '#F59E0B';
      case 'ON REVIEW': return '#A855F7'; case 'DONE': return '#10B981';
      case 'ON HOLD': return '#71717A'; default: return '#D4D4D8';
    }
  };

  // ─── Timeline render (unchanged from original) ────────────────────────────
  const renderTimeline = () => {
    const cols: Date[] = [];
    let columnWidth = 112;
    if (zoomMode === 'day') {
      columnWidth = 48;
      const startOfCurrentDay = new Date(currentDate); startOfCurrentDay.setHours(0, 0, 0, 0);
      const startDate = new Date(startOfCurrentDay); startDate.setDate(startDate.getDate() - 7);
      for (let i = 0; i < 30; i++) { const c = new Date(startDate); c.setDate(startDate.getDate() + i); c.setHours(0,0,0,0); cols.push(c); }
    } else if (zoomMode === 'week') {
      columnWidth = 112;
      const startOfCurrentDay = new Date(currentDate); startOfCurrentDay.setHours(0, 0, 0, 0);
      const dVal = new Date(startOfCurrentDay); dVal.setDate(dVal.getDate() - 21);
      const getSunday = (dateVal: Date) => { const date = new Date(dateVal); const day = date.getDay(); const diff = date.getDate() - day; const res = new Date(date.setDate(diff)); res.setHours(0,0,0,0); return res; };
      const startSunday = getSunday(dVal);
      for (let i = 0; i < 12; i++) { const wDate = new Date(startSunday); wDate.setDate(startSunday.getDate() + i * 7); wDate.setHours(0,0,0,0); cols.push(wDate); }
    } else {
      columnWidth = 160;
      const startMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1, 0, 0, 0, 0);
      for (let i = 0; i < 8; i++) { const mDate = new Date(startMonthDate.getFullYear(), startMonthDate.getMonth() + i, 1, 0, 0, 0, 0); cols.push(mDate); }
    }
    const gridWidth = cols.length * columnWidth;
    const timelineStartMs = cols[0].getTime();
    let timelineEndMs = 0;
    if (zoomMode === 'day') timelineEndMs = cols[cols.length - 1].getTime() + 24*60*60*1000;
    else if (zoomMode === 'week') timelineEndMs = cols[cols.length - 1].getTime() + 7*24*60*60*1000;
    else { const lm = cols[cols.length - 1]; timelineEndMs = new Date(lm.getFullYear(), lm.getMonth() + 1, 1, 0, 0, 0, 0).getTime(); }
    const timelineRangeMs = timelineEndMs - timelineStartMs;
    const isTodayCol = (w: Date) => {
      const today = new Date();
      if (zoomMode === 'day') return w.toDateString() === today.toDateString();
      if (zoomMode === 'week') { const s = w.getTime(); const e = s + 7*24*60*60*1000; return today.getTime() >= s && today.getTime() < e; }
      return today.getFullYear() === w.getFullYear() && today.getMonth() === w.getMonth();
    };
    const bottomHeaders: { label: string; count: number }[] = [];
    cols.forEach(w => {
      const key = zoomMode === 'month' ? w.getFullYear().toString() : `${monthNames[w.getMonth()]} ${w.getFullYear()}`;
      if (bottomHeaders.length > 0 && bottomHeaders[bottomHeaders.length - 1].label === key) bottomHeaders[bottomHeaders.length - 1].count++;
      else bottomHeaders.push({ label: key, count: 1 });
    });
    const getBarLayout = (taskStart: Date, taskEnd: Date) => {
      const startMs = taskStart.getTime(); const endMs = taskEnd.getTime();
      if (endMs < timelineStartMs || startMs > timelineEndMs) return null;
      const visibleStart = Math.max(startMs, timelineStartMs); const visibleEnd = Math.min(endMs, timelineEndMs);
      return { left: ((visibleStart - timelineStartMs) / timelineRangeMs) * 100, width: ((visibleEnd - visibleStart) / timelineRangeMs) * 100 };
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
        <div className="p-4 border-b border-zinc-100 bg-[var(--s2)] flex items-center justify-between shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 bg-[var(--s1)] border border-zinc-100 rounded-lg text-[10px] font-bold uppercase hover:bg-[var(--s2)] transition-colors shadow-sm text-[var(--ink)]">Today</button>
            <div className="flex bg-[var(--s2)] p-0.5 rounded-lg border border-zinc-100 shadow-inner">
              {(['day', 'week', 'month'] as const).map(mode => (
                <button key={mode} onClick={() => setZoomMode(mode)} className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${zoomMode === mode ? 'bg-white text-purple-700 shadow-sm border border-zinc-100' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'}`}>{mode === 'day' ? 'Day' : mode === 'week' ? 'Week' : 'Month'}</button>
              ))}
            </div>
            <span className="text-[10px] text-[var(--ink-3)] font-bold uppercase ml-2">Zoom: {zoomMode === 'day' ? '30 Days' : zoomMode === 'week' ? '12 Weeks' : '8 Months'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentDate(prev => { const d = new Date(prev); if (zoomMode === 'day') d.setDate(d.getDate() - 7); else if (zoomMode === 'week') d.setDate(d.getDate() - 28); else d.setMonth(d.getMonth() - 2); return d; })} className="p-1.5 hover:bg-[var(--s2)] rounded-lg transition-colors border border-zinc-100 bg-[var(--s1)] shadow-sm text-[var(--ink)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => setCurrentDate(prev => { const d = new Date(prev); if (zoomMode === 'day') d.setDate(d.getDate() + 7); else if (zoomMode === 'week') d.setDate(d.getDate() + 28); else d.setMonth(d.getMonth() + 2); return d; })} className="p-1.5 hover:bg-[var(--s2)] rounded-lg transition-colors border border-zinc-100 bg-[var(--s1)] shadow-sm text-[var(--ink)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
        <div className="flex shrink-0 border-b border-zinc-100">
          <div className="w-[260px] shrink-0 border-r border-zinc-100 px-4 flex items-center bg-[var(--s1)] h-[72px] select-none">
            <span className="text-[10px] font-bold text-[var(--ink-3)] uppercase tracking-wider">Stage / Milestone</span>
          </div>
          <div ref={timelineHeaderRef} className="flex-1 overflow-x-auto scrollbar-none select-none bg-[var(--s1)]" onScroll={handleScrollHeader}>
            <div style={{ width: gridWidth, minWidth: gridWidth }} className="flex flex-col h-[72px]">
              <div className="flex border-b border-zinc-100 h-[36px]">
                {cols.map((w, idx) => {
                  const active = isTodayCol(w);
                  return (
                    <div key={idx} className={`flex-1 text-center border-r border-zinc-100 last:border-r-0 shrink-0 flex flex-col items-center justify-center transition-colors relative ${active ? 'bg-indigo-600 text-white' : 'text-[var(--ink-2)]'}`}>
                      <span className={zoomMode === 'month' ? 'text-[10px] uppercase font-extrabold tracking-wider' : 'font-extrabold text-[15px]'}>{zoomMode === 'month' ? monthNames[w.getMonth()].substring(0, 3) : w.getDate()}</span>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-white mt-0.5" />}
                    </div>
                  );
                })}
              </div>
              <div className="flex h-[36px]">
                {bottomHeaders.map((bh, idx) => (
                  <div key={idx} style={{ width: `${(bh.count / cols.length) * 100}%` }} className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)] border-r border-zinc-100 last:border-r-0 shrink-0 bg-[var(--s2)] flex items-center justify-center h-full">{bh.label}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar flex">
          <div className="w-[260px] shrink-0 border-r border-zinc-100 bg-[var(--s2)] select-none">
            <div className="divide-y divide-zinc-100">
              {activeDepts.map(dept => {
                const deptTasks = filteredTasks.filter(t => t.department_id === dept.id && t.status !== 'DONE');
                const isCollapsed = collapsedDepts[dept.id] || false;
                return (
                  <div key={dept.id} className="flex flex-col">
                    <div onClick={() => setCollapsedDepts(prev => ({ ...prev, [dept.id]: !isCollapsed }))} className="h-[44px] px-3 flex items-center justify-between cursor-pointer hover:bg-[var(--hl)] bg-[var(--s2)] transition-colors border-b border-zinc-100">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 rounded-full h-2 bg-[var(--primary)] shrink-0" />
                        <span className="text-[10px] font-bold uppercase text-[var(--ink)] truncate tracking-tight">{dept.department_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[var(--ink-3)] shrink-0">
                        <span className="text-[8px] font-bold bg-[var(--s3)] text-[var(--ink-2)] px-1.5 py-0.5 rounded-full">{deptTasks.length}</span>
                        <svg className={`w-3.5 h-3.5 transform transition-transform ${isCollapsed ? '-rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                    {!isCollapsed && (
                      <div className="divide-y divide-zinc-100 bg-[var(--s1)]">
                        {deptTasks.length === 0 ? (
                          <div className="px-6 h-[68px] flex items-center text-[9px] font-medium text-[var(--ink-4)] italic border-b border-zinc-100">No tasks assigned</div>
                        ) : (
                          deptTasks.map(task => {
                            const statusCat = getTimelineTaskStatus(task);
                            const taskCode = getTaskCode(task);
                            const noteCount = tasksWithChangelog.get(task.id) || 0;
                            
                            // Dot styles based on status
                            let dotStyle = "";
                            let dotIcon = "";
                            if (statusCat === 'OVERDUE') {
                              dotStyle = "bg-red-500 text-white shadow-sm";
                              dotIcon = "!";
                            } else if (statusCat === 'DUE SOON') {
                              dotStyle = "bg-amber-500 text-white shadow-sm";
                              dotIcon = "!";
                            } else if (statusCat === 'IN PROGRESS') {
                              dotStyle = "bg-blue-500 text-white shadow-sm animate-pulse";
                              dotIcon = "⋯";
                            } else if (statusCat === 'ON REVIEW') {
                              dotStyle = "bg-purple-500 text-white shadow-sm";
                              dotIcon = "👁";
                            } else if (statusCat === 'DONE') {
                              dotStyle = "bg-emerald-500 text-white shadow-sm";
                              dotIcon = "✓";
                            } else if (statusCat === 'ON HOLD') {
                              dotStyle = "bg-zinc-400 text-white shadow-sm";
                              dotIcon = "⏸";
                            } else {
                              dotStyle = "bg-zinc-200 text-zinc-500 border border-zinc-300";
                              dotIcon = "•";
                            }

                            return (
                              <div key={task.id} onClick={() => handleSelectTask(task)} className="px-4 h-[68px] cursor-pointer hover:bg-[var(--hl)]/50 transition-colors flex items-center gap-3 border-b border-zinc-100">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${dotStyle}`}>
                                  {dotIcon}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                  <span className="text-[9px] font-bold text-[var(--ink)] uppercase truncate leading-tight hover:text-[var(--primary)] transition-colors" title={task.task_name}>{task.task_name}</span>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-[7.5px] font-bold text-[var(--ink-3)] font-mono uppercase tracking-tight">{taskCode}</span>
                                    {noteCount > 0 && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-purple-50 border border-purple-100 text-[7px] font-bold text-purple-600 tracking-tight" title={`${noteCount} catatan progress`}>
                                        📝 {noteCount}
                                      </span>
                                    )}
                                  </div>
                                </div>
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
          <div ref={timelineBodyRef} className="flex-1 overflow-x-auto h-fit min-h-full" onScroll={handleScrollBody}>
            <div style={{ width: gridWidth, minWidth: gridWidth }} className="relative divide-y divide-zinc-100 bg-[var(--s1)] min-h-full">
              {activeDepts.map(dept => {
                const deptTasks = filteredTasks.filter(t => t.department_id === dept.id && t.status !== 'DONE');
                const isCollapsed = collapsedDepts[dept.id] || false;
                return (
                  <div key={dept.id} className="flex flex-col">
                    <div className="h-[44px] w-full relative bg-[var(--s2)]/10 border-b border-zinc-100 flex items-center">
                      <div className="absolute inset-0 flex pointer-events-none">
                        {cols.map((w, idx) => <div key={idx} className={`flex-1 border-r h-full last:border-r-0 ${isTodayCol(w) ? 'bg-[var(--primary-dim)]/10' : ''}`} style={{ borderColor: 'rgba(115,115,115,0.07)' }}></div>)}
                      </div>
                    </div>
                    {!isCollapsed && (
                      <div className="flex flex-col divide-y divide-zinc-100 bg-[var(--s1)]">
                        {deptTasks.length === 0 ? (
                          <div className="h-[68px] w-full relative flex items-center border-b border-zinc-100">
                            <div className="absolute inset-0 flex pointer-events-none">
                              {cols.map((w, idx) => <div key={idx} className={`flex-1 border-r h-full last:border-r-0 ${isTodayCol(w) ? 'bg-[var(--primary-dim)]/3' : ''}`} style={{ borderColor: 'rgba(115,115,115,0.07)' }}></div>)}
                            </div>
                          </div>
                        ) : (
                          deptTasks.map(task => {
                            const createdDate = task.created_at ? new Date(task.created_at) : (() => { const parts = task.deadline.split('-'); const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0); d.setDate(d.getDate() - 10); return d; })();
                            createdDate.setHours(0, 0, 0, 0);
                            const parts = task.deadline.split('-');
                            const deadlineDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999);
                            const layout = getBarLayout(createdDate, deadlineDate);

                            const statusCat = getTimelineTaskStatus(task);
                            const progressPercent = calculateProgress(task);
                            const formattedDeadline = new Date(task.deadline).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            });

                            let barStyle: React.CSSProperties = {};
                            let innerBarWidth = 0;
                            let showIcon: React.ReactNode = null;
                            let statusLabel = "";
                            let statusColorClass = "";

                            if (statusCat === 'OVERDUE') {
                              statusLabel = 'OVERDUE';
                              statusColorClass = 'text-red-500 font-extrabold';
                              barStyle = {
                                background: 'rgba(239, 68, 68, 0.06)',
                                borderColor: 'rgba(239, 68, 68, 0.25)',
                              };
                              innerBarWidth = 100;
                              showIcon = (
                                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 w-5.5 h-5.5 rounded-full bg-red-500 border border-white flex items-center justify-center text-white shadow-md z-10">
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M12 8v4m0 4h.01" />
                                  </svg>
                                </div>
                              );
                            } else if (statusCat === 'DUE SOON') {
                              statusLabel = 'DUE SOON';
                              statusColorClass = 'text-amber-500 font-extrabold';
                              barStyle = {
                                background: 'rgba(245, 158, 11, 0.06)',
                                borderColor: 'rgba(245, 158, 11, 0.25)',
                              };
                              innerBarWidth = 100;
                              showIcon = (
                                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 w-5.5 h-5.5 rounded-full bg-amber-500 border border-white flex items-center justify-center text-white shadow-md z-10">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                              );
                            } else if (statusCat === 'IN PROGRESS') {
                              statusLabel = 'IN PROGRESS';
                              statusColorClass = 'text-blue-500 font-extrabold';
                              barStyle = {
                                background: 'rgba(59, 130, 246, 0.06)',
                                borderColor: 'rgba(59, 130, 246, 0.2)',
                              };
                              innerBarWidth = progressPercent;
                              showIcon = (
                                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[8px] font-extrabold text-blue-600 bg-blue-50 px-1 py-0.2 rounded border border-blue-100/50">
                                  {progressPercent}%
                                </div>
                              );
                            } else if (statusCat === 'ON REVIEW') {
                              statusLabel = 'ON REVIEW';
                              statusColorClass = 'text-purple-500 font-extrabold';
                              barStyle = {
                                background: 'rgba(168, 85, 247, 0.06)',
                                borderColor: 'rgba(168, 85, 247, 0.2)',
                              };
                              innerBarWidth = 90;
                              showIcon = (
                                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[8px] font-extrabold text-purple-600 bg-purple-50 px-1 py-0.2 rounded border border-purple-100/50">
                                  90%
                                </div>
                              );
                            } else if (statusCat === 'DONE') {
                              statusLabel = 'DONE';
                              statusColorClass = 'text-emerald-500 font-extrabold';
                              barStyle = {
                                background: 'rgba(16, 185, 129, 0.06)',
                                borderColor: 'rgba(16, 185, 129, 0.2)',
                              };
                              innerBarWidth = 100;
                              showIcon = (
                                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 w-5.5 h-5.5 rounded-full bg-emerald-500 border border-white flex items-center justify-center text-white shadow-md z-10">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              );
                            } else if (statusCat === 'ON HOLD') {
                              statusLabel = 'ON HOLD';
                              statusColorClass = 'text-zinc-500 font-extrabold';
                              barStyle = {
                                background: 'rgba(113, 113, 122, 0.05)',
                                borderColor: 'rgba(113, 113, 122, 0.15)',
                              };
                              innerBarWidth = 0;
                            } else {
                              statusLabel = 'NOT STARTED';
                              statusColorClass = 'text-zinc-400 font-semibold';
                              barStyle = {
                                background: 'rgba(228, 228, 231, 0.15)',
                                borderColor: 'rgba(228, 228, 231, 0.25)',
                              };
                              innerBarWidth = 0;
                            }

                            const renderBarLabel = (onLeft: boolean) => (
                              <div className={onLeft 
                                ? "absolute right-full top-1/2 transform -translate-y-1/2 mr-3 text-right whitespace-nowrap pointer-events-none select-none"
                                : "absolute bottom-full left-0 mb-0.5 text-left whitespace-nowrap pointer-events-none select-none"
                              }>
                                <div className={`text-[7px] font-extrabold uppercase tracking-wider ${statusColorClass}`}>{statusLabel}</div>
                                <div className="text-[6.5px] text-zinc-400 font-bold">Deadline: {formattedDeadline}</div>
                              </div>
                            );

                            return (
                              <div key={task.id} className="h-[68px] w-full relative flex items-center px-4 border-b border-zinc-100">
                                <div className="absolute inset-0 flex pointer-events-none">
                                  {cols.map((w, idx) => <div key={idx} className={`flex-1 border-r h-full last:border-r-0 ${isTodayCol(w) ? 'bg-[var(--primary-dim)]/5' : ''}`} style={{ borderColor: 'rgba(115,115,115,0.07)' }}></div>)}
                                </div>
                                {layout && (
                                  <div style={{ left: `${layout.left}%`, width: `${layout.width}%`, minWidth: '40px' }}
                                    className="absolute h-8 flex items-center group/bar cursor-pointer">
                                    
                                    {renderBarLabel(layout.left > 18)}

                                    <div style={barStyle}
                                      className="w-full relative h-7 rounded-full overflow-visible flex items-center border shadow-sm transition-all hover:brightness-105 hover:shadow-md px-1.5"
                                      onClick={() => handleSelectTask(task)}>
                                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${innerBarWidth}%`, background: getBarColor(statusCat) }} />
                                      
                                      {showIcon}

                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover/bar:block z-[99] bg-zinc-900 text-white text-[10px] p-2.5 rounded-lg shadow-xl pointer-events-none whitespace-nowrap leading-tight">
                                        <div className="font-extrabold text-center uppercase tracking-wider mb-1">{task.status}</div>
                                        <div className="text-[8.5px] text-zinc-400 font-semibold mb-1 text-center">
                                          {createdDate.toLocaleDateString('en-US', {month:'short',day:'numeric'})} - {deadlineDate.toLocaleDateString('en-US', {month:'short',day:'numeric'})}
                                        </div>
                                        <div className="text-[8px] text-purple-400 font-bold uppercase tracking-tight text-center">By: {task.requester_name}</div>
                                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-zinc-900"></div>
                                      </div>
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

  // ─── Main Return ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 text-[var(--ink)]">
      {selectedTask ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Breadcrumb Navigation */}
          <div className="flex flex-wrap items-center gap-2 text-[10px] md:text-xs font-bold text-[var(--ink-3)] uppercase tracking-wider">
            <button onClick={() => setSelectedTask(null)} className="hover:text-purple-600 transition-colors">
              Internal Design Tasks
            </button>
            <span>/</span>
            <span className="text-[var(--ink)] truncate max-w-[200px] md:max-w-xs">{selectedTask.task_name}</span>
          </div>

          {/* Title Area */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase ${getStatusColor(selectedTask.status)}`}>
                  {selectedTask.status}
                </span>
                {selectedTask.created_at && (
                  <span className="text-[10px] text-[var(--ink-3)] font-semibold">
                    Dibuat: {formatAbsoluteTime(selectedTask.created_at)}
                  </span>
                )}
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase text-[var(--ink)] leading-tight">
                {selectedTask.task_name}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {!isEditingInline && (
                <>
                  <button onClick={() => handleOpenEdit(selectedTask)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold uppercase transition-all shadow-sm">
                    Edit Task
                  </button>
                  <button onClick={() => handleDelete(selectedTask.id)} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg text-xs font-bold uppercase transition-all">
                    Hapus
                  </button>
                </>
              )}
              <button onClick={() => { setSelectedTask(null); setIsEditingInline(false); setEditingTask(null); }} className="px-4 py-2 bg-[var(--s2)] hover:bg-[var(--s3)] text-[var(--ink-2)] rounded-lg text-xs font-bold uppercase transition-all border border-zinc-100">
                Kembali
              </button>
            </div>
          </div>

          {/* Side-by-Side Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Info Task (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[var(--s1)] border border-zinc-100 rounded-[24px] p-5 shadow-sm space-y-5">
                <h3 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider border-b border-zinc-100 pb-3">
                  {isEditingInline ? '📝 Edit Informasi Task' : 'ℹ Detail Informasi'}
                </h3>
                {isEditingInline ? (
                  <form onSubmit={handleSave} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Task Name</label>
                      <input type="text" required value={formData.task_name || ''} onChange={e => setFormData({ ...formData, task_name: e.target.value })} className="w-full p-3 rounded-xl border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600 uppercase" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Requester Name</label>
                        <input type="text" required value={formData.requester_name || ''} onChange={e => setFormData({ ...formData, requester_name: e.target.value })} className="w-full p-3 rounded-xl border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600 uppercase" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Deadline</label>
                        <input type="date" required value={formData.deadline || ''} onChange={e => setFormData({ ...formData, deadline: e.target.value })} className="w-full p-3 rounded-xl border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Department</label>
                      <select required value={formData.department_id || ''} onChange={e => setFormData({ ...formData, department_id: e.target.value })} className="w-full p-3 rounded-xl border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600 uppercase">
                        {departments.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Status</label>
                      <select required value={formData.status || ''} onChange={e => setFormData({ ...formData, status: e.target.value as InternalStatus })} className="w-full p-3 rounded-xl border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600 uppercase">
                        <option value="NEW">NEW</option>
                        <option value="ON PROGRESS">ON PROGRESS</option>
                        <option value="ON REVIEW">ON REVIEW</option>
                        <option value="ON HOLD">ON HOLD</option>
                        <option value="DONE">DONE</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Brief Description</label>
                      <textarea value={getBriefText(formData.brief || '')} onChange={e => setFormData({ ...formData, brief: e.target.value })} className="w-full p-3 rounded-xl border border-zinc-100 bg-[var(--s2)]/50 text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600" rows={6} />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="submit" className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-purple-700 transition-all shadow-md">
                        Simpan
                      </button>
                      <button type="button" onClick={() => { setIsEditingInline(false); setEditingTask(null); }} className="flex-1 py-3 bg-[var(--s2)] text-[var(--ink-2)] border border-zinc-100 rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-[var(--s3)] transition-all">
                        Batal
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[var(--s2)] p-3 rounded-xl border border-zinc-100">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Departemen</span>
                        <p className="font-bold text-[var(--ink)] text-xs truncate">{getDeptName(selectedTask.department_id)}</p>
                      </div>
                      <div className="bg-[var(--s2)] p-3 rounded-xl border border-zinc-100">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Deadline</span>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-[var(--ink)] text-xs uppercase">{selectedTask.deadline}</p>
                          {(() => {
                            if (selectedTask.status === 'DONE') return null;
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const deadline = new Date(selectedTask.deadline);
                            deadline.setHours(0, 0, 0, 0);
                            const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            
                            if (diffDays < 0) {
                              return <span className="bg-red-100 text-red-600 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">{Math.abs(diffDays)} Hari Telat</span>;
                            } else if (diffDays === 0) {
                              return <span className="bg-orange-100 text-orange-600 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Hari Ini</span>;
                            } else if (diffDays > 0 && diffDays <= 7) {
                              return <span className="bg-orange-100 text-orange-600 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">{diffDays} Hari Lagi</span>;
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                      <div className="bg-[var(--s2)] p-3 rounded-xl border border-zinc-100">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Requester</span>
                        <p className="font-bold text-[var(--ink)] text-xs uppercase truncate">{selectedTask.requester_name}</p>
                      </div>
                      <div className="bg-[var(--s2)] p-3 rounded-xl border border-zinc-100 flex flex-col justify-center items-center">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase">ID Task</span>
                        <p className="font-bold text-zinc-500 text-[10px] font-mono mt-1">{selectedTask.id.split('-')[0]}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1.5 ml-1">Brief Description</span>
                      <div className="p-4 bg-[var(--s2)]/50 text-[var(--ink-2)] rounded-xl text-sm italic whitespace-pre-wrap border border-zinc-100 leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar">
                        {getBriefText(selectedTask.brief) || 'No brief provided for this task.'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right Column: Changelog & Progress (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-[var(--s1)] border border-zinc-100 rounded-[24px] p-5 shadow-sm space-y-5">
                <h3 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider border-b border-zinc-100 pb-3 flex items-center justify-between">
                  <span>🕓 Changelog & Progress</span>
                  {taskChangelog.length > 0 && (
                    <span className="bg-purple-100 text-purple-700 text-[9px] font-bold px-2 py-0.5 rounded-full">
                      {taskChangelog.length} Entries
                    </span>
                  )}
                </h3>

                {/* Add Note Form */}
                <div className="p-4 rounded-2xl bg-[var(--s2)]/40 border border-zinc-100 space-y-3">
                  <p className="text-[10px] font-bold text-[var(--ink-3)] uppercase tracking-wider">Tambah Catatan Progress</p>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Tulis catatan progress, kendala, atau update..."
                    rows={3}
                    className="w-full p-3 rounded-xl border border-zinc-200 bg-[var(--s1)] text-[var(--ink)] text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500 resize-none placeholder:text-zinc-400 leading-relaxed"
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={noteLink}
                      onChange={e => setNoteLink(e.target.value)}
                      placeholder="Link referensi (Google Drive, URL, dll)"
                      className="flex-1 p-2.5 rounded-xl border border-zinc-200 bg-[var(--s1)] text-[var(--ink)] text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-zinc-400"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => noteImageInputRef.current?.click()}
                        type="button"
                        title="Upload Screenshot (otomatis jadi WebP)"
                        className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${noteImageFile ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-[var(--s1)] border-zinc-200 text-zinc-500 hover:border-purple-500 hover:text-purple-600'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {noteImageFile ? '✓ Gambar' : 'Foto'}
                      </button>
                      <input ref={noteImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleNoteImageChange} />
                    </div>
                  </div>
                  {/* Image preview */}
                  {noteImagePreview && (
                    <div className="mt-2 relative inline-block">
                      <img src={noteImagePreview} alt="Preview" className="max-h-24 rounded-lg border border-zinc-200 object-cover" />
                      <button onClick={() => { setNoteImageFile(null); setNoteImagePreview(null); if (noteImageInputRef.current) noteImageInputRef.current.value = ''; }}
                        type="button"
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center font-bold hover:bg-red-600">✕</button>
                      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">→ WebP</span>
                    </div>
                  )}
                  <button
                    onClick={handleSaveNote}
                    disabled={isSavingNote || uploadingImage || (!noteText.trim() && !noteLink.trim() && !noteImageFile)}
                    className="w-full py-2.5 bg-purple-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-purple-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {(isSavingNote || uploadingImage) ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span> {uploadingImage ? 'Mengupload gambar...' : 'Menyimpan...'}</>
                    ) : '+ Simpan Catatan'}
                  </button>
                </div>

                {/* Changelog Timeline */}
                <div className="mt-4">
                  {isLoadingChangelog ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-400">
                      <span className="w-8 h-8 border-3 border-zinc-200 border-t-purple-500 rounded-full animate-spin"></span>
                      <span className="text-xs font-bold">Memuat changelog...</span>
                    </div>
                  ) : taskChangelog.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-400">
                      <span className="text-4xl">📋</span>
                      <p className="text-xs font-bold">Belum ada history untuk task ini.</p>
                      <p className="text-[10px]">Perubahan status, deadline, dan catatan akan muncul di sini.</p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Vertical line */}
                      <div className="absolute left-4 top-0 bottom-0 w-px bg-zinc-200"></div>
                      <div className="space-y-4">
                        {taskChangelog.map((entry, idx) => {
                          const ic = getChangelogIcon(entry.change_type);
                          return (
                            <div key={entry.id} className="relative flex gap-4 group/entry animate-in fade-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${idx * 40}ms` }}>
                              {/* Icon */}
                              <div className={`w-8 h-8 rounded-full ${ic.bg} ${ic.border} border flex items-center justify-center text-sm shrink-0 z-10 shadow-sm transition-transform group-hover/entry:scale-110`}>
                                {ic.icon}
                              </div>
                              {/* Content */}
                              <div className="flex-1 min-w-0 bg-[var(--s2)] rounded-2xl p-3.5 border border-zinc-100 shadow-sm hover:border-zinc-200 transition-colors">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="flex-1">{getChangelogLabel(entry, getDeptName)}</div>
                                  <div className="text-right shrink-0">
                                    <span className="text-[9px] font-bold text-zinc-400" title={formatAbsoluteTime(entry.created_at)}>
                                      {formatRelativeTime(entry.created_at)}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-[9px] text-zinc-400 font-semibold mb-2">
                                  {formatAbsoluteTime(entry.created_at)} · oleh {entry.changed_by || 'Admin'}
                                </p>
                                {entry.note && (
                                  <div className="mt-2 p-3 bg-white rounded-xl border border-zinc-100 text-xs text-zinc-700 font-medium leading-relaxed whitespace-pre-wrap">
                                    {entry.note}
                                  </div>
                                )}
                                {entry.reference_link && (
                                  <a href={entry.reference_link} target="_blank" rel="noopener noreferrer"
                                    className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    <span className="truncate max-w-[220px]">{entry.reference_link}</span>
                                  </a>
                                )}
                                {entry.image_url && (
                                  <div className="mt-2">
                                    <a href={entry.image_url} target="_blank" rel="noopener noreferrer">
                                      <img src={entry.image_url} alt="Progress screenshot" className="max-h-48 w-full object-cover rounded-xl border border-zinc-200 hover:opacity-90 transition-opacity cursor-zoom-in" />
                                    </a>
                                    <p className="text-[8px] text-zinc-400 font-semibold mt-1">📎 Screenshot progress (WebP) — klik untuk buka</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
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
                <button onClick={() => setView('timeline')} className={`p-2 rounded-lg transition-all ${view === 'timeline' ? 'bg-white text-purple-700 shadow-sm border border-zinc-100' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'}`} title="Timeline View"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" strokeWidth="2" /></svg></button>
              </div>
              <button onClick={handleOpenAdd} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold uppercase shadow-sm border border-purple-500/20 flex items-center gap-2 hover:bg-purple-700 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>Add Task
              </button>
              <button onClick={handleCopyLink} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 border ${copySuccess ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-[var(--s1)] border-zinc-100 text-[var(--ink-2)] hover:border-purple-500'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                {copySuccess ? 'Copied Link!' : 'Form Link'}
              </button>
            </div>
          </header>

          {/* Stats */}
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
              <p className={`text-[9px] font-bold mt-2 uppercase ${stats.deadlinesToday > 0 ? 'text-red-100' : 'text-[var(--ink-3)]'}`}>{stats.deadlinesToday > 0 ? 'Urgent attention!' : 'Clear for today.'}</p>
            </div>
            <div className={`p-3 md:p-6 rounded-[24px] border flex flex-col justify-center transition-colors duration-300 ${stats.overdue > 0 ? 'bg-red-50/80 border-red-200 text-red-700 shadow-sm' : 'bg-[var(--s1)] border-zinc-100 text-[var(--ink)]'}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70 text-[var(--ink-3)]">Overdue Tasks</span>
              <div className="text-xl md:text-3xl font-bold">{stats.overdue}</div>
              <p className="text-[9px] font-bold mt-2 uppercase opacity-60">{stats.overdue > 0 ? 'Tasks missed deadline' : 'None overdue'}</p>
            </div>
          </div>

          {/* Filters */}
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

          {/* View: List */}
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
                      <tr key={task.id} onClick={() => handleSelectTask(task)} className="hover:bg-[#FCFCFC] transition-colors cursor-pointer group font-bold text-zinc-800 uppercase">
                        <td className="px-2 md:px-6 py-2 md:py-4">
                          <div className="flex flex-col gap-1">
                            <div className="font-bold text-zinc-900 text-[10px] md:text-sm leading-tight">{task.task_name}</div>
                            <div className="flex"><span className={`px-1.5 md:px-2 py-0.5 rounded-full text-[7px] md:text-[8px] font-bold uppercase ${getStatusColor(task.status)}`}>{task.status}</span></div>
                          </div>
                        </td>
                        <td className="px-2 md:px-6 py-2 md:py-4">
                          <div className="text-[9px] md:text-[11px] font-bold text-zinc-800 leading-tight">{getDeptName(task.department_id)}</div>
                          <div className="text-[8px] md:text-[10px] text-zinc-400 font-medium mt-0.5 tracking-tight">By: {task.requester_name}</div>
                        </td>
                        <td className="px-2 md:px-6 py-2 md:py-4">
                          <span className={`text-[9px] md:text-xs font-bold leading-tight ${isOverdue ? 'text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded' : isToday ? 'text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded' : 'text-[var(--ink-2)]'}`}>{task.deadline}</span>
                        </td>
                        <td className="px-2 md:px-6 py-2 md:py-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5 md:gap-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenEdit(task)} className="text-purple-600 p-1 rounded hover:bg-purple-50" title="Edit"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" /></svg></button>
                            <button onClick={() => handleDelete(task.id)} className="text-red-500 p-1 rounded hover:bg-red-50" title="Delete"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            <select value={task.status} onChange={e => updateStatus(task.id, e.target.value as InternalStatus)} className="text-[8px] md:text-[9px] font-bold border-zinc-100 rounded-lg p-1 md:p-1.5 bg-[var(--s1)] text-[var(--ink)] outline-none focus:ring-2 focus:ring-purple-500 uppercase cursor-pointer">
                              <option value="NEW">NEW</option>
                              <option value="ON PROGRESS">PROG</option>
                              <option value="ON REVIEW">REV</option>
                              <option value="ON HOLD">HOLD</option>
                              <option value="DONE">DONE</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredTasks.length === 0 && <div className="p-20 text-center text-zinc-400 font-bold italic">No requests matching filters.</div>}
            </div>

          ) : view === 'board' ? (
            <div className="h-[600px] flex flex-col border border-zinc-100 bg-[var(--s1)] text-[var(--ink)] rounded-[24px] shadow-sm p-4 overflow-hidden">
              <div className="flex items-center gap-3 mb-4 shrink-0 flex-wrap">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Group By:</span>
                <div className="flex bg-[#FAFAFA] p-1 rounded-xl">
                  {[{ id: 'status', label: 'Status' }, { id: 'dept', label: 'Department' }, { id: 'overdue', label: 'Deadline Alert' }].map(opt => (
                    <button key={opt.id} onClick={() => setBoardGroup(opt.id as any)} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${boardGroup === opt.id ? 'bg-white text-purple-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-x-auto flex gap-6 pb-2 items-start custom-scrollbar h-full">
                {Object.keys(internalBoardGroups).sort().map((groupKey, idx) => {
                  const headerColors = ['border-t-blue-500 bg-blue-50 text-blue-900', 'border-t-emerald-500 bg-emerald-50 text-emerald-900', 'border-t-purple-500 bg-purple-50 text-purple-900', 'border-t-amber-500 bg-amber-50 text-amber-900', 'border-t-rose-500 bg-rose-50 text-rose-900', 'border-t-cyan-500 bg-cyan-50 text-cyan-900', 'border-t-indigo-500 bg-indigo-50 text-indigo-900'];
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
                            <div key={task.id} onClick={() => handleSelectTask(task)} className="bg-[var(--s1)] text-[var(--ink)] p-4 rounded-xl shadow-sm border border-zinc-100 cursor-pointer hover:shadow-md transition-shadow group hover:border-[var(--primary)]/60">
                              <div className="flex justify-between items-start mb-2">
                                <span className={`px-2 py-0.5 rounded-md border text-[8px] font-bold uppercase ${getStatusColor(task.status)}`}>{task.status}</span>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={e => { e.stopPropagation(); handleOpenEdit(task); }} className="text-zinc-400 hover:text-purple-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" /></svg></button>
                                </div>
                              </div>
                              <h4 className="font-bold text-[var(--ink)] text-sm uppercase leading-tight mb-2 tracking-tight line-clamp-2">{task.task_name}</h4>
                              <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-zinc-100">
                                <div className="flex justify-between text-[10px] items-center">
                                  <span className="text-zinc-400 font-bold uppercase">Dept / Req</span>
                                  <span className="text-[var(--ink-2)] font-bold truncate max-w-[120px]">{getDeptName(task.department_id)}</span>
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
                  );
                })}
              </div>
            </div>

          ) : view === 'timeline' ? renderTimeline() : (
            // Calendar view
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
        </>
      )}

      {/* ─── Edit/Add Form Modal ──────────────────────────────────────────────── */}
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
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Status</label>
                <select required value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as InternalStatus })} className="w-full p-3 rounded-xl border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600 uppercase">
                  <option value="NEW">NEW</option>
                  <option value="ON PROGRESS">ON PROGRESS</option>
                  <option value="ON REVIEW">ON REVIEW</option>
                  <option value="ON HOLD">ON HOLD</option>
                  <option value="DONE">DONE</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Brief</label>
                <textarea value={getBriefText(formData.brief || '')} onChange={e => setFormData({ ...formData, brief: e.target.value })} className="w-full p-3 rounded-xl border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600" rows={4} />
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

const StatusItem = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="flex flex-col">
    <span className="text-[8px] font-bold uppercase text-zinc-400 tracking-tight mb-0.5">{label}</span>
    <span className={`text-sm font-bold ${color}`}>{value}</span>
  </div>
);

export default InternalDesignMaster;