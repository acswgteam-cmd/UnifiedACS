import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { InternalDesign, Department, InternalStatus, StatusHistoryEntry, ChangelogEntry, ChangelogChangeType, Designer } from '../types';
import { Dropdown } from '../components/Dropdown';
import { supabase } from '../lib/supabase';
import { INTERNAL_FORM_SECRET } from '../data/mockData';
import {
  Check,
  Square,
  Spark,
  Refresh,
  Calendar,
  Building,
  EditPencil,
  ChatBubble,
  Minus,
  Pin,
  WarningTriangle,
  Clock,
  Eye,
  Pause,
  InfoCircle,
  Xmark,
  Attachment,
  Link,
  Plus,
  EmptyPage,
  NavArrowLeft,
  NavArrowRight,
  NavArrowDown,
  Edit,
  Trash,
  TaskList,
  Dashboard,
  Reports
} from 'iconoir-react';

interface Props {
  internalDesigns: InternalDesign[];
  departments: Department[];
  designers: Designer[];
  onUpdate: () => void;
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ─── Legacy brief-based status history ───────────────────────────────────────
const parseStatusHistory = (brief: string): StatusHistoryEntry[] => {
  const match = brief.match(/<!-- STATUS_HISTORY_START\n([\s\S]*?)\nSTATUS_HISTORY_END -->/);
  if (match) { try { return JSON.parse(match[1]); } catch (e) { console.error(e); } }
  return [];
};
const serializeStatusHistory = (brief: string, history: StatusHistoryEntry[]): string => {
  const cleanBrief = brief.replace(/<!-- STATUS_HISTORY_START[\s\S]*?STATUS_HISTORY_END -->/, '').trim();
  return `${cleanBrief}\n\n<!-- STATUS_HISTORY_START\n${JSON.stringify(history, null, 2)}\nSTATUS_HISTORY_END -->`;
};
const getBriefText = (brief: string): string => {
  if (brief.includes('<!-- STATUS_HISTORY_START')) {
    return brief.replace(/<!-- STATUS_HISTORY_START[\s\S]*?STATUS_HISTORY_END -->/, '').trim();
  }
  return brief;
};

// ─── Time helpers ─────────────────────────────────────────────────────────────
const formatRelativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
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
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 1920, maxH = 1080; let { width, height } = img;
      if (width > maxW) { height = Math.round(height * maxW / width); width = maxW; }
      if (height > maxH) { width = Math.round(width * maxH / height); height = maxH; }
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
      canvas.toBlob(b => { URL.revokeObjectURL(url); b ? resolve(b) : reject(new Error('toBlob failed')); }, 'image/webp', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });

const getImages = (imageUrl: string | null | undefined): string[] => {
  if (!imageUrl) return [];
  if (imageUrl.startsWith('[') && imageUrl.endsWith(']')) {
    try {
      return JSON.parse(imageUrl);
    } catch (e) {
      // fallback
    }
  }
  if (imageUrl.includes(',')) {
    return imageUrl.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [imageUrl];
};


// ─── Changelog icon / label helpers ──────────────────────────────────────────
const getChangelogIcon = (entry: ChangelogEntry) => {
  const type = entry.change_type;
  if (type === 'NOTE' && (entry.note_title || entry.note_deadline)) {
    // Task-type note: checklist style
    return entry.note_status === 'DONE'
      ? { icon: <Check className="w-4 h-4 text-[#003c33]" />, bg: 'bg-[#edfce9]', text: 'text-[#003c33]', border: 'border-[#edfce9]' }
      : { icon: <Square className="w-4 h-4 text-[var(--primary)]" />, bg: 'bg-[var(--s2)]', text: 'text-[var(--primary)]', border: 'border-[var(--hl)]' };
  }
  switch (type) {
    case 'TASK_CREATED':    return { icon: <Spark className="w-4 h-4 text-[var(--primary)]" />, bg: 'bg-[var(--s2)]',  text: 'text-[var(--primary)]',  border: 'border-[var(--hl)]' };
    case 'STATUS_CHANGE':   return { icon: <Refresh className="w-4 h-4 text-[#1863dc]" />, bg: 'bg-[#f1f5ff]',    text: 'text-[#1863dc]',    border: 'border-[#edfce9]' };
    case 'DEADLINE_CHANGE': return { icon: <Calendar className="w-4 h-4 text-[#ff7759]" />, bg: 'bg-[#eeece7]',   text: 'text-[#ff7759]',   border: 'border-[#d9d9dd]' };
    case 'DEPT_CHANGE':     return { icon: <Building className="w-4 h-4 text-cyan-600" />, bg: 'bg-cyan-100',    text: 'text-cyan-600',    border: 'border-cyan-200' };
    case 'BRIEF_CHANGE':    return { icon: <EditPencil className="w-4 h-4 text-zinc-650" />, bg: 'bg-zinc-100',    text: 'text-zinc-650',    border: 'border-zinc-200' };
    case 'NOTE':            return { icon: <ChatBubble className="w-4 h-4 text-[#003c33]" />, bg: 'bg-[#edfce9]', text: 'text-[#003c33]', border: 'border-[#edfce9]' };
    default:                return { icon: <Minus className="w-4 h-4 text-zinc-500" />,  bg: 'bg-zinc-100',    text: 'text-zinc-500',    border: 'border-[#d9d9dd]' };
  }
};

const getChangelogLabel = (entry: ChangelogEntry, getDeptName: (id: string) => string): React.ReactNode => {
  switch (entry.change_type) {
    case 'TASK_CREATED':
      return <span className="text-xs font-semibold text-zinc-700">Task dibuat</span>;
    case 'STATUS_CHANGE':
      return (
        <span className="text-xs font-semibold text-zinc-700">
          Status berubah: <span className="font-bold text-zinc-400 line-through">{entry.old_value}</span>
          {' → '}<span className="font-bold text-blue-700">{entry.new_value}</span>
        </span>
      );
    case 'DEADLINE_CHANGE':
      return (
        <span className="text-xs font-semibold text-zinc-700">
          Deadline berubah: <span className="font-bold text-zinc-400 line-through">{entry.old_value}</span>
          {' → '}<span className="font-bold text-amber-700">{entry.new_value}</span>
        </span>
      );
    case 'DEPT_CHANGE':
      return (
        <span className="text-xs font-semibold text-zinc-700">
          Departemen berubah: <span className="font-bold text-zinc-400 line-through">{entry.old_value}</span>
          {' → '}<span className="font-bold text-cyan-700">{entry.new_value}</span>
        </span>
      );
    case 'BRIEF_CHANGE':
      return <span className="text-xs font-semibold text-zinc-700">Brief/deskripsi diperbarui</span>;
    case 'NOTE':
      return <span className="text-xs font-bold text-emerald-700">{entry.note_title || 'Catatan Progress'}</span>;
    default:
      return <span className="text-xs text-zinc-600">Perubahan</span>;
  }
};

// ─── Note deadline helpers ────────────────────────────────────────────────────
const getNoteDeadlineStatus = (entry: ChangelogEntry): 'overdue' | 'due-soon' | 'upcoming' | 'done' | 'none' => {
  if (entry.note_status === 'DONE') return 'done';
  if (!entry.note_deadline) return 'none';
  const todayStr = new Date().toISOString().split('T')[0];
  if (entry.note_deadline < todayStr) return 'overdue';
  const diff = Math.ceil((new Date(entry.note_deadline).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
  return diff <= 7 ? 'due-soon' : 'upcoming';
};

const NoteDeadlineBadge: React.FC<{ entry: ChangelogEntry }> = ({ entry }) => {
  const ds = getNoteDeadlineStatus(entry);
  if (ds === 'none') return null;
  if (ds === 'done') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#edfce9] text-[#003c33] border border-[#edfce9]"><Check className="w-3 h-3 text-[#003c33]" /> Selesai</span>
  );
  const today = new Date(); today.setHours(0,0,0,0);
  const diffDays = Math.ceil((new Date(entry.note_deadline!).getTime() - today.getTime()) / 86400000);
  const dateLabel = new Date(entry.note_deadline!).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  if (ds === 'overdue') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-55 border border-red-200 animate-pulse text-red-700">
      <WarningTriangle className="w-3 h-3 text-red-700 shrink-0" /> {Math.abs(diffDays)} hari telat · {dateLabel}
    </span>
  );
  if (ds === 'due-soon') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
      <Clock className="w-3 h-3 text-amber-700 shrink-0" /> {diffDays === 0 ? 'Hari ini' : `${diffDays} hari lagi`} · {dateLabel}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-50 text-zinc-500 border border-zinc-200">
      <Calendar className="w-3 h-3 text-zinc-500 shrink-0" /> {dateLabel}
    </span>
  );
};

const TaskNotesTooltip: React.FC<{
  nc?: { total: number; done: number; urgent: number; notes: ChangelogEntry[] };
  children: React.ReactNode;
}> = ({ nc, children }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  if (!nc || nc.notes.length === 0) return <>{children}</>;

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Position below the trigger, aligned to the right edge of the trigger (since width is 256px)
    setCoords({
      top: rect.bottom + window.scrollY + 6,
      left: rect.right + window.scrollX - 256
    });
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="inline-block"
    >
      {children}
      {isHovered && createPortal(
        <div
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: '256px',
            zIndex: 99999
          }}
          className="bg-[var(--s1)] text-[var(--ink)] border border-zinc-200/80 rounded-xl shadow-xl p-3 pointer-events-none normal-case font-medium tracking-normal text-left animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-2 border-b border-zinc-100 pb-1 flex justify-between items-center">
            <span>Catatan Tugas</span>
            {nc.total > 0 ? (
              <span>{nc.done}/{nc.total} Selesai</span>
            ) : (
              <span>{nc.notes.length} Catatan</span>
            )}
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
            {nc.notes.map(n => {
              const isTask = n.note_status === 'OPEN' || n.note_status === 'DONE';
              const isNoteDone = n.note_status === 'DONE';
              return (
                <div key={n.id} className="flex items-start gap-1.5 text-[11px] leading-snug">
                  <span className="shrink-0 text-[10px] mt-0.5">
                    {isTask ? (
                      isNoteDone ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <Pin className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                    ) : (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-400 mx-1 mt-1.5 shrink-0" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold ${isNoteDone ? 'text-zinc-400 line-through' : 'text-zinc-800'} truncate`}>
                      {n.note_title || 'Catatan Progress'}
                    </div>
                    {n.note && (
                      <div className={`text-[10px] ${isNoteDone ? 'text-zinc-350' : 'text-zinc-500'} line-clamp-2`}>
                        {n.note}
                      </div>
                    )}
                    {n.note_deadline && (
                      <div className={`text-[9px] font-mono mt-0.5 ${isNoteDone ? 'text-zinc-350' : 'text-purple-600 font-bold'}`}>
                        Due: {n.note_deadline}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="absolute bottom-full right-4 border-4 border-transparent border-b-[var(--s1)] z-10" />
          <div className="absolute bottom-full right-4 border-[5px] -mr-[1px] -mb-[1px] border-transparent border-b-zinc-200/80" />
        </div>,
        document.body
      )}
    </div>
  );
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'NEW':         return 'bg-blue-500/10 text-blue-500';
    case 'ON PROGRESS': return 'bg-amber-500/10 text-amber-500';
    case 'ON REVIEW':   return 'bg-purple-500/10 text-purple-500';
    case 'DONE':        return 'bg-emerald-500/10 text-emerald-500';
    case 'ON HOLD':     return 'bg-zinc-500/10 text-zinc-500';
    default:            return 'bg-zinc-100 text-zinc-500';
  }
};

const getBoardHeaderColor = (group: string) => {
  const g = group.toUpperCase();
  if (g.includes('DONE')) {
    return 'border-t-emerald-500 bg-emerald-50 text-emerald-700 [data-theme="dark"]:bg-emerald-950/20 [data-theme="dark"]:text-emerald-400';
  }
  if (g.includes('PROGRESS')) {
    return 'border-t-amber-500 bg-amber-50 text-amber-700 [data-theme="dark"]:bg-amber-950/20 [data-theme="dark"]:text-amber-400';
  }
  if (g.includes('REVIEW')) {
    return 'border-t-purple-500 bg-purple-50 text-purple-700 [data-theme="dark"]:bg-purple-950/20 [data-theme="dark"]:text-purple-400';
  }
  if (g.includes('NEW')) {
    return 'border-t-[var(--primary)] bg-[var(--primary-dim)] text-[var(--primary)]';
  }
  if (g.includes('HOLD')) {
    return 'border-t-zinc-400 bg-[var(--s2)] text-zinc-600 [data-theme="dark"]:text-zinc-400';
  }
  return 'border-t-[var(--primary)] bg-[var(--s2)] text-[var(--ink)]';
};

// ─── Main Component ───────────────────────────────────────────────────────────
const InternalDesignMaster: React.FC<Props> = ({ internalDesigns, departments, designers, onUpdate }) => {
  const [view, setView] = useState<'list' | 'calendar' | 'board' | 'timeline'>('list');
  const [boardGroup, setBoardGroup] = useState<'status' | 'dept' | 'overdue'>('status');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDept, setFilterDept] = useState<string>('ALL');
  const [listSortOrder, setListSortOrder] = useState<string>('CREATED_DESC');
  const [latestUpdates, setLatestUpdates] = useState<Record<string, string>>({});
  const [currentDate, setCurrentDate] = useState(new Date());
  const [copySuccess, setCopySuccess] = useState(false);
  const [zoomMode, setZoomMode] = useState<'day' | 'week' | 'month'>('day');
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  // Note counts per task for badges: { total, done, urgent, notes: ChangelogEntry[] }
  const [noteCounts, setNoteCounts] = useState<Map<string, { total: number; done: number; urgent: number; notes: ChangelogEntry[] }>>(new Map());

  const loadNoteCounts = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('internal_design_changelog')
      .select('id, internal_design_id, note_status, note_deadline, note_title, note, created_at')
      .eq('change_type', 'NOTE')
      .order('created_at', { ascending: false });
    if (!error && data) {
      const todayStr = new Date().toISOString().split('T')[0];
      const map = new Map<string, { total: number; done: number; urgent: number; notes: ChangelogEntry[] }>();
      data.forEach((item: any) => {
        const id = item.internal_design_id;
        const cur = map.get(id) || { total: 0, done: 0, urgent: 0, notes: [] };
        if ((item.note_status === 'OPEN' || item.note_status === 'DONE') && (item.note_title || item.note_deadline)) {
          cur.total++;
          if (item.note_status === 'DONE') cur.done++;
          if (item.note_status !== 'DONE' && item.note_deadline && item.note_deadline <= todayStr) cur.urgent++;
        }
        cur.notes.push(item as ChangelogEntry);
        map.set(id, cur);
      });
      setNoteCounts(map);
    }
  }, []);

  const loadLatestUpdates = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('internal_design_changelog')
      .select('internal_design_id, created_at')
      .order('created_at', { ascending: false });
    if (!error && data) {
      const map: Record<string, string> = {};
      data.forEach((item: any) => {
        if (!map[item.internal_design_id]) {
          map[item.internal_design_id] = item.created_at;
        }
      });
      setLatestUpdates(map);
    }
  }, []);

  useEffect(() => { 
    loadNoteCounts(); 
    loadLatestUpdates();
  }, [internalDesigns, loadNoteCounts, loadLatestUpdates]);

  const getTaskCode = useCallback((task: InternalDesign) => {
    const shortId = task.id.split('-')[0].substring(0, 4).toUpperCase();
    const dept = getDeptName(task.department_id).substring(0, 4).toUpperCase();
    const year = task.created_at ? new Date(task.created_at).getFullYear() : 2026;
    return `${dept}-DES-${year}-${shortId}`;
  }, [departments]);

  const getTimelineTaskStatus = useCallback((task: InternalDesign) => {
    if (task.status === 'DONE') return 'DONE';
    if (!task.deadline) {
      if (task.status === 'ON PROGRESS') return 'IN PROGRESS';
      if (task.status === 'ON REVIEW')   return 'ON REVIEW';
      if (task.status === 'ON HOLD')     return 'ON HOLD';
      return 'NOT STARTED';
    }
    const todayStr = new Date().toISOString().split('T')[0];
    if (task.deadline < todayStr) return 'OVERDUE';
    const diffDays = Math.ceil((new Date(task.deadline).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
    if (diffDays <= 7) return 'DUE SOON';
    if (task.status === 'ON PROGRESS') return 'IN PROGRESS';
    if (task.status === 'ON REVIEW')   return 'ON REVIEW';
    if (task.status === 'ON HOLD')     return 'ON HOLD';
    return 'NOT STARTED';
  }, []);

  const calculateProgress = useCallback((task: InternalDesign) => {
    if (task.status === 'DONE')    return 100;
    if (task.status === 'ON HOLD') return 0;
    if (task.status === 'NEW')     return 0;
    if (task.status === 'ON REVIEW') return 90;
    if (!task.deadline) return 50;
    const created = task.created_at ? new Date(task.created_at).getTime() : new Date(task.deadline).getTime() - 10 * 86400000;
    const deadline = new Date(task.deadline).getTime();
    const now = Date.now();
    if (now >= deadline) return 95;
    if (now <= created) return 10;
    return Math.min(Math.max(Math.round(((now - created) / (deadline - created)) * 100), 20), 85);
  }, []);

  const getBarColor = useCallback((statusCat: string) => {
    switch (statusCat) {
      case 'OVERDUE':     return '#ef4444';
      case 'DUE SOON':    return '#f59e0b';
      case 'IN PROGRESS': return '#3B82F6';
      case 'ON REVIEW':   return '#A855F7';
      case 'DONE':        return '#10B981';
      case 'ON HOLD':     return '#71717A';
      default:            return '#9ca3af';
    }
  }, []);

  const timelineHeaderRef = useRef<HTMLDivElement>(null);
  const timelineBodyRef   = useRef<HTMLDivElement>(null);

  // ── CRUD & selection states ───────────────────────────────────────────────
  const [isFormOpen, setIsFormOpen]       = useState(false);
  const [previewImage, setPreviewImage]   = useState<string | null>(null);
  const [editingTask, setEditingTask]     = useState<InternalDesign | null>(null);
  const [selectedTask, setSelectedTask]   = useState<InternalDesign | null>(null);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [formData, setFormData] = useState<Partial<InternalDesign>>({
    task_name: '', department_id: '', requester_name: '',
    deadline: '', brief: '', status: 'NEW'
  });

  // ── Unified changelog states ──────────────────────────────────────────────
  const [taskChangelog, setTaskChangelog] = useState<ChangelogEntry[]>([]);
  const [isLoadingChangelog, setIsLoadingChangelog] = useState(false);

  // ── Unified note form (covers both "free log" and "task note with deadline") ─
  const [noteTitle, setNoteTitle]           = useState('');
  const [noteText, setNoteText]             = useState('');
  const [noteDeadline, setNoteDeadline]     = useState('');
  const [noteLink, setNoteLink]             = useState('');
  const [notePic, setNotePic]               = useState('');
  const [noteImageFiles, setNoteImageFiles] = useState<File[]>([]);
  const [noteImagePreviews, setNoteImagePreviews] = useState<string[]>([]);
  const [isSavingNote, setIsSavingNote]     = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDragging, setIsDragging]         = useState(false);
  const [togglingId, setTogglingId]         = useState<string | null>(null);
  const noteImageInputRef = useRef<HTMLInputElement>(null);

  const getDeptName = (id: string) => departments.find(d => d.id === id)?.department_name || 'N/A';
  const getDesignerName = (id: string | null | undefined) => {
    if (!id) return '';
    return designers.find(d => d.id === id)?.name || '';
  };

  // ── Load changelog ────────────────────────────────────────────────────────
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
    setIsEditingInline(false);
    setNoteTitle(''); setNoteText(''); setNoteDeadline(''); setNoteLink(''); setNotePic('');
    setNoteImageFiles([]); setNoteImagePreviews([]);
    loadChangelog(task.id);
  }, [loadChangelog]);

  const toggleExpandTask = useCallback((taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  }, []);

  // ── Insert changelog helper ───────────────────────────────────────────────
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

  // ── Upload image ──────────────────────────────────────────────────────────
  const uploadChangelogImage = async (file: File): Promise<string | null> => {
    if (!supabase) return null;
    setUploadingImage(true);
    try {
      const blob = await convertToWebP(file);
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
      const { data, error } = await supabase.storage
        .from('changelog-images').upload(fileName, blob, { contentType: 'image/webp', upsert: false });
      if (error) {
        console.error(error);
        alert(`Gagal mengunggah foto: ${error.message}`);
        return null;
      }
      return supabase.storage.from('changelog-images').getPublicUrl(data.path).data?.publicUrl || null;
    } catch (e: any) {
      console.error(e);
      alert(`Terjadi kesalahan saat memproses foto: ${e.message || e}`);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleNoteImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    setNoteImageFiles(prev => [...prev, ...files]);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        if (ev.target?.result) {
          setNoteImagePreviews(prev => [...prev, ev.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // ── Save unified note/log ─────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!selectedTask) return;
    if (!noteTitle.trim() && !noteText.trim() && !noteLink.trim() && noteImageFiles.length === 0) return;
    setIsSavingNote(true);
    
    const imageUrls: string[] = [];
    if (noteImageFiles.length > 0) {
      for (const file of noteImageFiles) {
        const url = await uploadChangelogImage(file);
        if (url) {
          imageUrls.push(url);
        } else {
          setIsSavingNote(false);
          return; // Stop saving if any upload fails
        }
      }
    }
    
    const imageUrl = imageUrls.length > 0 ? JSON.stringify(imageUrls) : null;
    
    await insertChangelog(selectedTask.id, 'NOTE', {
      note_title:    noteTitle.trim() || null,
      note:          noteText.trim() || null,
      note_deadline: noteDeadline || null,
      note_status:   (noteTitle.trim() || noteDeadline) ? 'OPEN' : null,
      reference_link: noteLink.trim() || null,
      image_url:     imageUrl,
      pic_designer_id: notePic || null,
    });
    setNoteTitle(''); setNoteText(''); setNoteDeadline(''); setNoteLink(''); setNotePic('');
    setNoteImageFiles([]); setNoteImagePreviews([]);
    if (noteImageInputRef.current) noteImageInputRef.current.value = '';
    await loadChangelog(selectedTask.id);
    await loadNoteCounts();
    await loadLatestUpdates();
    setIsSavingNote(false);
  };

  // ── Toggle note status (OPEN ↔ DONE) ─────────────────────────────────────
  const handleToggleNoteStatus = async (entry: ChangelogEntry) => {
    if (!supabase) return;
    const newStatus = entry.note_status === 'DONE' ? 'OPEN' : 'DONE';
    setTogglingId(entry.id);
    await supabase.from('internal_design_changelog').update({ note_status: newStatus }).eq('id', entry.id);
    setTaskChangelog(prev => prev.map(e => e.id === entry.id ? { ...e, note_status: newStatus } : e));
    await loadNoteCounts();
    await loadLatestUpdates();
    setTogglingId(null);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      total:          internalDesigns.length,
      new:            internalDesigns.filter(t => t.status === 'NEW').length,
      progress:       internalDesigns.filter(t => t.status === 'ON PROGRESS').length,
      review:         internalDesigns.filter(t => t.status === 'ON REVIEW').length,
      done:           internalDesigns.filter(t => t.status === 'DONE').length,
      hold:           internalDesigns.filter(t => t.status === 'ON HOLD').length,
      deadlinesToday: internalDesigns.filter(t => t.deadline === todayStr && t.status !== 'DONE').length,
      overdue:        internalDesigns.filter(t => t.deadline && t.deadline < todayStr && t.status !== 'DONE').length,
      noDeadline:     internalDesigns.filter(t => !t.deadline && t.status !== 'DONE').length,
    };
  }, [internalDesigns]);

  const filteredTasks = useMemo(() =>
    internalDesigns.filter(t => {
      const matchStatus = filterStatus === 'ALL' || t.status === filterStatus;
      const matchDept   = filterDept === 'ALL'   || t.department_id === filterDept;
      return matchStatus && matchDept;
    }), [internalDesigns, filterStatus, filterDept]);

  const sortedTasks = useMemo(() => {
    let sorted = [...filteredTasks];
    if (listSortOrder === 'UPDATE_DESC') {
      sorted.sort((a, b) => {
        const timeA = latestUpdates[a.id] ? new Date(latestUpdates[a.id]).getTime() : new Date(a.created_at || 0).getTime();
        const timeB = latestUpdates[b.id] ? new Date(latestUpdates[b.id]).getTime() : new Date(b.created_at || 0).getTime();
        return timeB - timeA;
      });
    } else {
      sorted.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    return sorted;
  }, [filteredTasks, listSortOrder, latestUpdates]);

  const internalBoardGroups = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const groups: Record<string, InternalDesign[]> = {};
    sortedTasks.forEach(t => {
      let key = 'UNASSIGNED';
      if (boardGroup === 'status') key = t.status || 'UNASSIGNED';
      else if (boardGroup === 'dept') key = getDeptName(t.department_id) || 'UNASSIGNED';
      else if (boardGroup === 'overdue') {
        if (t.status === 'DONE')                             key = 'DONE';
        else if (!t.deadline)                                key = 'NO DEADLINE';
        else if (t.deadline < todayStr)                      key = 'OVERDUE';
        else if (t.deadline === todayStr)                    key = 'TODAY';
        else                                                 key = 'UPCOMING';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }, [filteredTasks, boardGroup, departments]);

  const calendarLanes = useMemo(() => {
    const year = currentDate.getFullYear(), month = currentDate.getMonth();
    const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
    const endOfMonth   = new Date(year, month + 1, 0).toISOString().split('T')[0];
    const visibleTasks = filteredTasks.filter(t => t.deadline && t.deadline >= startOfMonth && t.deadline <= endOfMonth);
    const sorted = [...visibleTasks].sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
    const lanes: InternalDesign[][] = [];
    sorted.forEach(task => {
      let placed = false;
      for (const lane of lanes) {
        if ((task.deadline || '') > (lane[lane.length - 1].deadline || '')) { lane.push(task); placed = true; break; }
      }
      if (!placed) lanes.push([task]);
    });
    return lanes;
  }, [filteredTasks, currentDate]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#/portal/v1/internal/${INTERNAL_FORM_SECRET}`);
    setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleOpenAdd = () => {
    setEditingTask(null);
    setFormData({ task_name: '', department_id: departments[0]?.id || '', requester_name: '', deadline: '', brief: '', status: 'NEW' });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (task: InternalDesign) => {
    setSelectedTask(task); setEditingTask(task); setFormData(task);
    setIsEditingInline(true); loadChangelog(task.id);
  };

  const handleDelete = async (id: string) => {
    if (!supabase || !confirm('Hapus tugas internal ini?')) return;
    const { error } = await supabase.from('internal_designs').delete().eq('id', id);
    if (error) alert(error.message);
    else { if (selectedTask?.id === id) setSelectedTask(null); onUpdate(); }
  };

  // ── Save task ─────────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const dataToSave = { ...formData, deadline: formData.deadline?.trim() || null };

    if (editingTask) {
      const changes: Array<{ type: ChangelogChangeType; old_value?: string; new_value?: string }> = [];
      const history = [...parseStatusHistory(editingTask.brief || '')];

      if (editingTask.status !== dataToSave.status) {
        if (!history.length) {
          history.push({
            status: editingTask.status,
            timestamp: editingTask.created_at ? new Date(editingTask.created_at).toISOString() : new Date().toISOString()
          });
        }
        history.push({ status: dataToSave.status as InternalStatus, timestamp: new Date().toISOString() });
        changes.push({ type: 'STATUS_CHANGE', old_value: editingTask.status, new_value: dataToSave.status as string });
      }

      dataToSave.brief = serializeStatusHistory(dataToSave.brief || '', history);

      if ((editingTask.deadline || '') !== (dataToSave.deadline || ''))
        changes.push({ type: 'DEADLINE_CHANGE', old_value: editingTask.deadline || '(tidak ada)', new_value: dataToSave.deadline || '(tidak ada)' });
      if (editingTask.department_id !== dataToSave.department_id)
        changes.push({ type: 'DEPT_CHANGE', old_value: getDeptName(editingTask.department_id), new_value: getDeptName(dataToSave.department_id as string) });
      if (getBriefText(editingTask.brief || '') !== getBriefText(dataToSave.brief || ''))
        changes.push({ type: 'BRIEF_CHANGE' });

      const { error } = await supabase.from('internal_designs').update(dataToSave).eq('id', editingTask.id);
      if (error) { alert(error.message); return; }
      for (const c of changes) await insertChangelog(editingTask.id, c.type, { old_value: c.old_value, new_value: c.new_value });
      await loadLatestUpdates();
      onUpdate(); setIsFormOpen(false); setIsEditingInline(false); setEditingTask(null);
      if (selectedTask?.id === editingTask.id) {
        loadChangelog(editingTask.id);
        setSelectedTask({ ...editingTask, ...dataToSave } as InternalDesign);
      }
    } else {
      const history = [{ status: (dataToSave.status || 'NEW') as InternalStatus, timestamp: new Date().toISOString() }];
      dataToSave.brief = serializeStatusHistory(dataToSave.brief || '', history);
      const { data: inserted, error } = await supabase.from('internal_designs').insert([dataToSave]).select().single();
      if (error) { alert(error.message); return; }
      if (inserted) await insertChangelog(inserted.id, 'TASK_CREATED');
      await loadLatestUpdates();
      onUpdate(); setIsFormOpen(false);
    }
  };

  // ── Quick status change ───────────────────────────────────────────────────
  const updateStatus = async (id: string, newStatus: InternalStatus) => {
    if (!supabase) return;
    const task = internalDesigns.find(t => t.id === id); if (!task) return;
    const history = [...parseStatusHistory(task.brief || '')];
    if (!history.length) history.push({ status: task.status, timestamp: task.created_at ? new Date(task.created_at).toISOString() : new Date().toISOString() });
    history.push({ status: newStatus, timestamp: new Date().toISOString() });
    const updatedBrief = serializeStatusHistory(task.brief || '', history);
    const { error } = await supabase.from('internal_designs').update({ status: newStatus, brief: updatedBrief }).eq('id', id);
    if (error) { alert(error.message); return; }
    await insertChangelog(id, 'STATUS_CHANGE', { old_value: task.status, new_value: newStatus });
    await loadLatestUpdates();
    onUpdate();
    if (selectedTask?.id === id) { setSelectedTask({ ...selectedTask, status: newStatus, brief: updatedBrief }); loadChangelog(id); }
  };

  const navigateMonth = (dir: number) => setCurrentDate(p => new Date(p.getFullYear(), p.getMonth() + dir, 1));

  // ─── Calendar ─────────────────────────────────────────────────────────────
  const renderCalendar = () => {
    const year = currentDate.getFullYear(), month = currentDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startDay  = new Date(year, month, 1).getDay();
    const todayStr  = new Date().toISOString().split('T')[0];
    const days: React.ReactNode[] = [];
    for (let i = 0; i < startDay; i++) days.push(<div key={`e${i}`} className="min-h-[140px] bg-[var(--s2)]/40 border-r border-b border-zinc-100" />);
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday = dateStr === todayStr;
      days.push(
        <div key={d} className={`min-h-[140px] h-full border-r border-b border-zinc-100 p-0 flex flex-col relative ${isToday ? 'bg-[var(--primary-dim)]/10' : 'bg-[var(--s1)]'}`}>
          <div className="p-2 flex-shrink-0">
            <span className={`text-[10px] font-bold inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-[var(--primary)] text-white' : 'text-[var(--ink-2)]'}`}>{d}</span>
          </div>
          <div className="flex flex-col space-y-1 pb-2 flex-1">
            {calendarLanes.map((lane, li) => {
              const task = lane.find(t => dateStr === t.deadline);
              if (!task) return <div key={`s${li}`} className="min-h-[40px] py-1" />;
              const nc = noteCounts.get(task.id);
              return (
                <div key={task.id} onClick={() => handleSelectTask(task)}
                  className="mx-1 cursor-pointer min-h-[40px] p-1.5 rounded-lg flex flex-col justify-center hover:brightness-95 bg-purple-50 shadow-sm relative group/calcard">
                  <span className="text-[9px] font-bold truncate uppercase text-purple-900 leading-tight pr-4">{task.task_name}</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${task.status === 'DONE' ? 'bg-emerald-500' : 'bg-purple-500'}`} />
                    <span className="text-[7px] font-bold text-purple-400 uppercase">{getDeptName(task.department_id)}</span>
                  </div>
                  {nc && nc.notes.length > 0 && (
                    <TaskNotesTooltip nc={nc}>
                      <span className={`absolute right-1 top-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7.5px] font-black text-white shrink-0 shadow-sm ${nc.urgent > 0 ? 'bg-red-500 animate-pulse' : (nc.total > 0 && nc.done === nc.total) ? 'bg-emerald-500' : 'bg-purple-500'}`}>
                        {nc.notes.length}
                      </span>
                    </TaskNotesTooltip>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return days;
  };

  const handleScrollBody  = () => { if (timelineBodyRef.current && timelineHeaderRef.current) timelineHeaderRef.current.scrollLeft = timelineBodyRef.current.scrollLeft; };
  const handleScrollHeader= () => { if (timelineBodyRef.current && timelineHeaderRef.current) timelineBodyRef.current.scrollLeft = timelineHeaderRef.current.scrollLeft; };

  // ─── Timeline ─────────────────────────────────────────────────────────────
  const renderTimeline = () => {
    const cols: Date[] = [];
    let columnWidth = 112;
    if (zoomMode === 'day') {
      columnWidth = 48;
      const s = new Date(currentDate); s.setHours(0,0,0,0); s.setDate(s.getDate() - 7);
      for (let i = 0; i < 30; i++) { const c = new Date(s); c.setDate(s.getDate()+i); c.setHours(0,0,0,0); cols.push(c); }
    } else if (zoomMode === 'week') {
      columnWidth = 112;
      const d = new Date(currentDate); d.setHours(0,0,0,0); d.setDate(d.getDate() - 21);
      const getSun = (dt: Date) => { const r = new Date(dt); r.setDate(r.getDate() - r.getDay()); r.setHours(0,0,0,0); return r; };
      const sun = getSun(d);
      for (let i = 0; i < 12; i++) { const w = new Date(sun); w.setDate(sun.getDate()+i*7); cols.push(w); }
    } else {
      columnWidth = 160;
      const sm = new Date(currentDate.getFullYear(), currentDate.getMonth()-2, 1);
      for (let i = 0; i < 8; i++) cols.push(new Date(sm.getFullYear(), sm.getMonth()+i, 1));
    }
    const gridWidth      = cols.length * columnWidth;
    const timelineStart  = cols[0].getTime();
    let   timelineEnd    = 0;
    if (zoomMode === 'day')   timelineEnd = cols[cols.length-1].getTime() + 86400000;
    else if (zoomMode === 'week') timelineEnd = cols[cols.length-1].getTime() + 7*86400000;
    else { const lm = cols[cols.length-1]; timelineEnd = new Date(lm.getFullYear(), lm.getMonth()+1, 1).getTime(); }
    const range = timelineEnd - timelineStart;

    const isTodayCol = (w: Date) => {
      const today = new Date();
      if (zoomMode === 'day') return w.toDateString() === today.toDateString();
      if (zoomMode === 'week') { const s = w.getTime(); return today.getTime() >= s && today.getTime() < s + 7*86400000; }
      return today.getFullYear() === w.getFullYear() && today.getMonth() === w.getMonth();
    };

    const bottomHeaders: { label: string; count: number }[] = [];
    cols.forEach(w => {
      const key = zoomMode === 'month' ? w.getFullYear().toString() : `${monthNames[w.getMonth()]} ${w.getFullYear()}`;
      if (bottomHeaders.length && bottomHeaders[bottomHeaders.length-1].label === key) bottomHeaders[bottomHeaders.length-1].count++;
      else bottomHeaders.push({ label: key, count: 1 });
    });

    const getBarLayout = (start: Date, end: Date | null) => {
      const sMs = start.getTime();
      if (end) {
        const eMs = end.getTime();
        if (eMs < timelineStart || sMs > timelineEnd) return null;
        const vs = Math.max(sMs, timelineStart), ve = Math.min(eMs, timelineEnd);
        return { left: ((vs - timelineStart) / range) * 100, width: ((ve - vs) / range) * 100, noDeadline: false };
      }
      if (sMs > timelineEnd) return null;
      const vs = Math.max(sMs, timelineStart);
      return { left: ((vs - timelineStart) / range) * 100, width: ((timelineEnd - vs) / range) * 100, noDeadline: true };
    };

    const activeDepts = departments.filter(d => d.active);

    return (
      <div className="flex flex-col border border-zinc-100 bg-[var(--s1)] rounded-[24px] shadow-card overflow-hidden h-[calc(100vh-280px)] min-h-[600px] text-[var(--ink)] animate-in fade-in duration-300">
        {/* Controls */}
        <div className="p-4 border-b border-zinc-100 bg-[var(--s2)] flex items-center justify-between shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 bg-[var(--s1)] border border-zinc-100 rounded-full text-[10px] font-bold uppercase hover:bg-[var(--s2)] transition-colors shadow-sm text-[var(--ink)]">Today</button>
            <div className="flex bg-[var(--s2)] p-0.5 rounded-full border border-zinc-100 shadow-inner">
              {(['day','week','month'] as const).map(m => (
                <button key={m} onClick={() => setZoomMode(m)} className={`px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${zoomMode === m ? 'bg-white text-[var(--primary)] shadow-sm border border-zinc-100' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'}`}>{m === 'day' ? 'Day' : m === 'week' ? 'Week' : m === 'month' ? 'Month' : ''}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(['prev','next'] as const).map(dir => (
              <button key={dir} onClick={() => setCurrentDate(prev => { const d = new Date(prev); if (zoomMode==='day') d.setDate(d.getDate()+(dir==='next'?7:-7)); else if (zoomMode==='week') d.setDate(d.getDate()+(dir==='next'?28:-28)); else d.setMonth(d.getMonth()+(dir==='next'?2:-2)); return d; })} className="p-1.5 hover:bg-[var(--s2)] rounded-full transition-colors border border-zinc-100 bg-[var(--s1)] shadow-sm text-[var(--ink)]">
                {dir === 'next' ? <NavArrowRight className="w-4 h-4" /> : <NavArrowLeft className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
        {/* Header row */}
        <div className="flex shrink-0 border-b border-zinc-100">
          <div className="w-[260px] shrink-0 border-r border-zinc-100 px-4 flex items-center bg-[var(--s1)] h-[72px] select-none">
            <span className="text-[10px] font-bold text-[var(--ink-3)] uppercase tracking-wider">Stage / Milestone</span>
          </div>
          <div ref={timelineHeaderRef} className="flex-1 overflow-x-auto scrollbar-none select-none bg-[var(--s1)]" onScroll={handleScrollHeader}>
            <div style={{ width: gridWidth, minWidth: gridWidth }} className="flex flex-col h-[72px]">
              <div className="flex border-b border-zinc-100 h-[36px]">
                {cols.map((w, i) => {
                  const active = isTodayCol(w);
                  return (
                    <div key={i} className={`flex-1 text-center border-r border-zinc-100 last:border-r-0 shrink-0 flex flex-col items-center justify-center ${active ? 'bg-[var(--primary)] text-white' : 'text-[var(--ink-2)]'}`}>
                      <span className={zoomMode==='month' ? 'text-[10px] uppercase font-extrabold tracking-wider' : 'font-extrabold text-[15px]'}>{zoomMode==='month' ? monthNames[w.getMonth()].substring(0,3) : w.getDate()}</span>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-white mt-0.5" />}
                    </div>
                  );
                })}
              </div>
              <div className="flex h-[36px]">
                {bottomHeaders.map((bh, i) => (
                  <div key={i} style={{ width: `${(bh.count/cols.length)*100}%` }} className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)] border-r border-zinc-100 last:border-r-0 shrink-0 bg-[var(--s2)] flex items-center justify-center">{bh.label}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex">
          {/* Left labels */}
          <div className="w-[260px] shrink-0 border-r border-zinc-100 bg-[var(--s2)] select-none">
            <div className="divide-y divide-zinc-100">
              {activeDepts.map(dept => {
                const deptTasks = filteredTasks.filter(t => t.department_id === dept.id && t.status !== 'DONE');
                const isCollapsed = collapsedDepts[dept.id] || false;
                return (
                  <div key={dept.id}>
                    <div onClick={() => setCollapsedDepts(p => ({...p, [dept.id]: !isCollapsed}))} className="h-[44px] px-3 flex items-center justify-between cursor-pointer hover:bg-[var(--hl)] bg-[var(--s2)] transition-colors border-b border-zinc-100">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-[var(--primary)] shrink-0" />
                        <span className="text-[10px] font-bold uppercase text-[var(--ink)] truncate">{dept.department_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[8px] font-bold bg-[var(--s3)] text-[var(--ink-2)] px-1.5 py-0.5 rounded-full">{deptTasks.length}</span>
                        <NavArrowDown className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                      </div>
                    </div>
                    {!isCollapsed && (
                      <div className="divide-y divide-zinc-100 bg-[var(--s1)]">
                        {deptTasks.length === 0 ? (
                          <div className="px-6 h-[68px] flex items-center text-[9px] font-medium text-[var(--ink-4)] italic border-b border-zinc-100">No tasks assigned</div>
                        ) : deptTasks.map(task => {
                          const statusCat = getTimelineTaskStatus(task);
                          const nc = noteCounts.get(task.id);
                          let dotStyle = 'bg-zinc-200 text-zinc-500 border border-zinc-300', dotIcon: React.ReactNode = <Minus className="w-3 h-3" />;
                          if (statusCat === 'OVERDUE')     { dotStyle = 'bg-red-500 text-white shadow-sm'; dotIcon = <WarningTriangle className="w-3.5 h-3.5" />; }
                          else if (statusCat === 'DUE SOON')   { dotStyle = 'bg-amber-500 text-white shadow-sm'; dotIcon = <Clock className="w-3 h-3" />; }
                          else if (statusCat === 'IN PROGRESS') { dotStyle = 'bg-blue-500 text-white shadow-sm animate-pulse'; dotIcon = <Clock className="w-3 h-3 animate-spin" />; }
                          else if (statusCat === 'ON REVIEW')  { dotStyle = 'bg-purple-500 text-white shadow-sm'; dotIcon = <Eye className="w-3.5 h-3.5" />; }
                          else if (statusCat === 'DONE')       { dotStyle = 'bg-emerald-500 text-white shadow-sm'; dotIcon = <Check className="w-3.5 h-3.5" />; }
                          else if (statusCat === 'ON HOLD')    { dotStyle = 'bg-zinc-400 text-white shadow-sm'; dotIcon = <Pause className="w-3.5 h-3.5" />; }
                          return (
                            <div key={task.id} onClick={() => handleSelectTask(task)} className="px-4 h-[68px] cursor-pointer hover:bg-[var(--hl)]/50 flex items-center gap-3 border-b border-zinc-100 transition-colors">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${dotStyle}`}>{dotIcon}</div>
                              <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <span className="text-[9px] font-bold text-[var(--ink)] uppercase truncate leading-tight">{task.task_name}</span>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span className="text-[7.5px] font-bold text-[var(--ink-3)] font-mono uppercase">{getTaskCode(task)}</span>
                                  {!task.deadline && <span className="px-1.5 py-0.5 rounded text-[7px] font-bold bg-zinc-50 border border-zinc-200 text-zinc-400">∞</span>}
                                  {nc && nc.notes.length > 0 && (
                                    <TaskNotesTooltip nc={nc}>
                                      <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold border flex items-center gap-1 shrink-0 ${nc.urgent > 0 ? 'bg-red-50 border-red-100 text-red-600 animate-pulse' : (nc.total > 0 && nc.done === nc.total) ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-purple-50 border-purple-100 text-purple-600'}`}>
                                        <span>💬 {nc.notes.length}</span>
                                        {nc.total > 0 && <span className="opacity-60">({nc.done}/{nc.total})</span>}
                                      </span>
                                    </TaskNotesTooltip>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Right gantt */}
          <div ref={timelineBodyRef} className="flex-1 overflow-x-auto h-fit min-h-full" onScroll={handleScrollBody}>
            <div style={{ width: gridWidth, minWidth: gridWidth }} className="relative divide-y divide-zinc-100 bg-[var(--s1)] min-h-full">
              {activeDepts.map(dept => {
                const deptTasks = filteredTasks.filter(t => t.department_id === dept.id && t.status !== 'DONE');
                const isCollapsed = collapsedDepts[dept.id] || false;
                const gridLines = (
                  <div className="absolute inset-0 flex pointer-events-none">
                    {cols.map((w, i) => <div key={i} className={`flex-1 border-r h-full last:border-r-0 ${isTodayCol(w) ? 'bg-[var(--primary-dim)]/5' : ''}`} style={{ borderColor: 'rgba(115,115,115,0.07)' }} />)}
                  </div>
                );
                return (
                  <div key={dept.id}>
                    <div className="h-[44px] w-full relative bg-[var(--s2)]/10 border-b border-zinc-100">{gridLines}</div>
                    {!isCollapsed && (
                      <div className="flex flex-col divide-y divide-zinc-100 bg-[var(--s1)]">
                        {deptTasks.length === 0 ? (
                          <div className="h-[68px] w-full relative border-b border-zinc-100">{gridLines}</div>
                        ) : deptTasks.map(task => {
                          const createdDate = task.created_at ? new Date(task.created_at) : new Date();
                          createdDate.setHours(0,0,0,0);
                          const deadlineDate = task.deadline ? (() => { const p = task.deadline!.split('-'); return new Date(+p[0],+p[1]-1,+p[2],23,59,59,999); })() : null;
                          const layout = getBarLayout(createdDate, deadlineDate);
                          const statusCat = getTimelineTaskStatus(task);
                          const progressPercent = calculateProgress(task);
                          const formattedDeadline = task.deadline ? new Date(task.deadline).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'}) : 'No Deadline';

                          let barStyle: React.CSSProperties = {};
                          let innerBarWidth = 0;
                          let showIcon: React.ReactNode = null;
                          let statusLabel = '', statusColorClass = '';

                          if (!task.deadline) {
                            statusLabel = 'NO DEADLINE'; statusColorClass = 'text-zinc-400 font-semibold';
                            barStyle = { background: 'repeating-linear-gradient(90deg,rgba(161,161,170,.12) 0,rgba(161,161,170,.12) 8px,transparent 8px,transparent 16px)', borderColor: 'rgba(161,161,170,.35)', borderStyle: 'dashed' };
                          } else if (statusCat === 'OVERDUE') {
                            statusLabel = 'OVERDUE'; statusColorClass = 'text-red-500 font-extrabold';
                            barStyle = { background: 'rgba(239,68,68,.06)', borderColor: 'rgba(239,68,68,.25)' }; innerBarWidth = 100;
                            showIcon = <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-5 h-5 rounded-full bg-red-500 border border-white flex items-center justify-center text-white shadow-md z-10"><svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M12 8v4m0 4h.01"/></svg></div>;
                          } else if (statusCat === 'DUE SOON') {
                            statusLabel = 'DUE SOON'; statusColorClass = 'text-amber-500 font-extrabold';
                            barStyle = { background: 'rgba(245,158,11,.06)', borderColor: 'rgba(245,158,11,.25)' }; innerBarWidth = 100;
                            showIcon = <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-5 h-5 rounded-full bg-amber-500 border border-white flex items-center justify-center text-white shadow-md z-10"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>;
                          } else if (statusCat === 'IN PROGRESS') {
                            statusLabel = 'IN PROGRESS'; statusColorClass = 'text-blue-500 font-extrabold';
                            barStyle = { background: 'rgba(59,130,246,.06)', borderColor: 'rgba(59,130,246,.2)' }; innerBarWidth = progressPercent;
                            showIcon = <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-extrabold text-blue-600 bg-blue-50 px-1 rounded border border-blue-100/50">{progressPercent}%</div>;
                          } else if (statusCat === 'ON REVIEW') {
                            statusLabel = 'ON REVIEW'; statusColorClass = 'text-purple-500 font-extrabold';
                            barStyle = { background: 'rgba(168,85,247,.06)', borderColor: 'rgba(168,85,247,.2)' }; innerBarWidth = 90;
                            showIcon = <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-extrabold text-purple-600 bg-purple-50 px-1 rounded border border-purple-100/50">90%</div>;
                          } else if (statusCat === 'ON HOLD') {
                            statusLabel = 'ON HOLD'; statusColorClass = 'text-zinc-500 font-extrabold';
                            barStyle = { background: 'rgba(113,113,122,.05)', borderColor: 'rgba(113,113,122,.15)' };
                          } else {
                            statusLabel = 'NOT STARTED'; statusColorClass = 'text-zinc-400 font-semibold';
                            barStyle = { background: 'rgba(228,228,231,.15)', borderColor: 'rgba(228,228,231,.25)' };
                          }

                          return (
                            <div key={task.id} className="h-[68px] w-full relative flex items-center px-4 border-b border-zinc-100">
                              {gridLines}
                              {layout && (
                                <div style={{ left:`${layout.left}%`, width:`${layout.width}%`, minWidth:'40px' }} className="absolute h-8 flex items-center group/bar cursor-pointer">
                                  <div className={layout.left > 18 ? 'absolute right-full top-1/2 -translate-y-1/2 mr-3 text-right whitespace-nowrap pointer-events-none' : 'absolute bottom-full left-0 mb-0.5 whitespace-nowrap pointer-events-none'}>
                                    <div className={`text-[7px] font-extrabold uppercase tracking-wider ${statusColorClass}`}>{statusLabel}</div>
                                    <div className="text-[6.5px] text-zinc-400 font-bold">Deadline: {formattedDeadline}</div>
                                  </div>
                                  <div style={barStyle} className="w-full relative h-7 rounded-full overflow-visible flex items-center border shadow-sm hover:brightness-105 hover:shadow-md px-1.5 transition-all" onClick={() => handleSelectTask(task)}>
                                    {!task.deadline
                                      ? <div className="h-1.5 rounded-full w-full opacity-40" style={{ background: 'linear-gradient(90deg,#a1a1aa,#d4d4d8,#a1a1aa)' }} />
                                      : <div className="h-1.5 rounded-full transition-all" style={{ width:`${innerBarWidth}%`, background: getBarColor(statusCat) }} />
                                    }
                                    {showIcon}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/bar:block z-[99] bg-zinc-900 text-white text-[10px] p-2.5 rounded-lg shadow-xl pointer-events-none whitespace-nowrap leading-tight">
                                      <div className="font-extrabold text-center uppercase mb-1">{task.status}</div>
                                      <div className="text-[8.5px] text-zinc-400 text-center">{createdDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – {task.deadline ? deadlineDate!.toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '∞'}</div>
                                      <div className="text-[8px] text-purple-400 font-bold text-center">By: {task.requester_name}</div>
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
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
          {/* Breadcrumb */}
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-[var(--ink-3)] uppercase tracking-wider">
            <button onClick={() => setSelectedTask(null)} className="hover:text-[var(--primary)] transition-colors">Internal Design Tasks</button>
            <span>/</span>
            <span className="text-[var(--ink)] truncate max-w-xs">{selectedTask.task_name}</span>
          </div>

          {/* Title bar */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-zinc-100 pb-5">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <div className="w-44">
                  <Dropdown
                    value={selectedTask.status}
                    onChange={val => updateStatus(selectedTask.id, val as InternalStatus)}
                    options={[
                      { value: 'NEW', label: 'NEW' },
                      { value: 'ON PROGRESS', label: 'ON PROGRESS' },
                      { value: 'ON REVIEW', label: 'ON REVIEW' },
                      { value: 'ON HOLD', label: 'ON HOLD' },
                      { value: 'DONE', label: 'DONE' }
                    ]}
                  />
                </div>
                {!selectedTask.deadline && <span className="px-2.5 py-1 rounded-full border text-[9px] font-extrabold bg-zinc-50 text-zinc-400 border-zinc-200 shadow-sm">∞ No Deadline</span>}
                {selectedTask.created_at && <span className="text-[10px] text-[var(--ink-3)] font-semibold">Dibuat: {formatAbsoluteTime(selectedTask.created_at)}</span>}
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase text-[var(--ink)] leading-tight">{selectedTask.task_name}</h1>
              {/* Notes progress summary */}
              {(() => {
                const nc = noteCounts.get(selectedTask.id);
                if (!nc || nc.total === 0) return null;
                const pct = Math.round((nc.done / nc.total) * 100);
                return (
                  <div className="mt-4 inline-flex flex-col sm:flex-row sm:items-center gap-4 bg-[var(--s2)] border border-zinc-100/80 px-4 py-3 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--primary-dim)] text-[var(--primary)] font-extrabold text-xs border border-[var(--hl-3)] shrink-0">
                        {pct}%
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold text-[var(--ink-3)] uppercase tracking-wider">Progress Catatan</div>
                        <div className="text-xs font-bold text-[var(--ink-2)]">{nc.done} dari {nc.total} Catatan Selesai</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      <div className="h-2 flex-1 rounded-full bg-zinc-200/50 overflow-hidden" style={{ minWidth: '120px' }}>
                        <div className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      {nc.urgent > 0 && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-red-500/10 text-red-600 border border-red-500/20 animate-pulse">
                          ⚠ {nc.urgent} TELAT
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isEditingInline && (
                <>
                    <button onClick={() => handleOpenEdit(selectedTask)} className="px-4 py-2 bg-[var(--primary)] hover:brightness-110 text-white rounded-full text-xs font-bold uppercase transition-all shadow-sm flex items-center gap-1"><Edit className="w-3.5 h-3.5" /> Edit Task</button>
                    <button onClick={() => handleDelete(selectedTask.id)} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-full text-xs font-bold uppercase transition-all flex items-center gap-1"><Trash className="w-3.5 h-3.5" /> Hapus</button>
                  </>
                )}
                <button onClick={() => { setSelectedTask(null); setIsEditingInline(false); setEditingTask(null); }} className="px-4 py-2 bg-[var(--s2)] hover:bg-[var(--s3)] text-[var(--ink-2)] rounded-full text-xs font-bold uppercase transition-all border border-zinc-100">Kembali</button>
            </div>
          </div>

          {/* 2-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Task info */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[var(--s1)] border border-zinc-100 rounded-[24px] p-5 shadow-sm space-y-5">
                <h3 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider border-b border-zinc-100 pb-3">
                  {isEditingInline ? <><EditPencil className="w-4 h-4 text-zinc-500 mr-1.5 inline" /> Edit Informasi Task</> : <><InfoCircle className="w-4 h-4 text-zinc-500 mr-1.5 inline" /> Detail Informasi</>}
                </h3>
                {isEditingInline ? (
                  <form onSubmit={handleSave} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Task Name</label>
                      <input type="text" required value={formData.task_name||''} onChange={e => setFormData({...formData, task_name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--primary)] uppercase" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Requester</label>
                        <input type="text" required value={formData.requester_name||''} onChange={e => setFormData({...formData, requester_name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--primary)] uppercase" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Deadline <span className="text-zinc-300">(Opsional)</span></label>
                        <input type="date" value={formData.deadline||''} onChange={e => setFormData({...formData, deadline: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--primary)]" />
                        {formData.deadline && <button type="button" onClick={() => setFormData({...formData, deadline: ''})} className="mt-1 text-[9px] text-red-400 hover:text-red-650 font-bold flex items-center gap-0.5"><Xmark className="w-3 h-3" /> Hapus Deadline</button>}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Department</label>
                      <Dropdown
                        value={formData.department_id || ''}
                        onChange={val => setFormData({ ...formData, department_id: val })}
                        options={departments.map(d => ({ value: d.id, label: d.department_name }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Status</label>
                      <Dropdown
                        value={formData.status || ''}
                        onChange={val => setFormData({ ...formData, status: val as InternalStatus })}
                        options={[
                          { value: 'NEW', label: 'NEW' },
                          { value: 'ON PROGRESS', label: 'ON PROGRESS' },
                          { value: 'ON REVIEW', label: 'ON REVIEW' },
                          { value: 'ON HOLD', label: 'ON HOLD' },
                          { value: 'DONE', label: 'DONE' }
                        ]}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Brief Description</label>
                      <textarea value={getBriefText(formData.brief||'')} onChange={e => setFormData({...formData, brief: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-zinc-100 bg-[var(--s2)]/50 text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--primary)]" rows={6} />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="submit" className="flex-1 py-2 bg-[var(--primary)] text-white rounded-lg font-bold uppercase text-xs hover:brightness-110 transition-all shadow-sm">Simpan</button>
                      <button type="button" onClick={() => {setIsEditingInline(false); setEditingTask(null);}} className="flex-1 py-2 bg-[var(--s2)] text-[var(--ink-2)] border border-zinc-100 rounded-lg font-bold uppercase text-xs hover:bg-[var(--s3)] transition-all">Batal</button>
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
                        {selectedTask.deadline ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-[var(--ink)] text-xs">{selectedTask.deadline}</p>
                            {(() => {
                              if (selectedTask.status === 'DONE') return null;
                              const diff = Math.ceil((new Date(selectedTask.deadline!).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
                              if (diff < 0)  return <span className="bg-red-100 text-red-600 text-[9px] px-1.5 py-0.5 rounded font-bold">{Math.abs(diff)} Hari Telat</span>;
                              if (diff === 0) return <span className="bg-orange-100 text-orange-600 text-[9px] px-1.5 py-0.5 rounded font-bold">Hari Ini</span>;
                              if (diff <= 7)  return <span className="bg-orange-100 text-orange-600 text-[9px] px-1.5 py-0.5 rounded font-bold">{diff} Hari Lagi</span>;
                              return null;
                            })()}
                          </div>
                        ) : <p className="font-bold text-zinc-400 text-xs italic">Tidak ada deadline</p>}
                      </div>
                      <div className="bg-[var(--s2)] p-3 rounded-xl border border-zinc-100">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Requester</span>
                        <p className="font-bold text-[var(--ink)] text-xs uppercase truncate">{selectedTask.requester_name}</p>
                      </div>
                      <div className="bg-[var(--s2)] p-3 rounded-xl border border-zinc-100 flex flex-col items-center justify-center">
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

            {/* Right: Unified changelog feed */}
            <div className="lg:col-span-7">
              <div className="bg-[var(--s1)] border border-zinc-100 rounded-[24px] p-5 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <h3 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5"><Clock className="w-4 h-4 text-zinc-500" /> Aktivitas & Catatan</h3>
                  {taskChangelog.length > 0 && (
                    <span className="bg-blue-50 text-[#1863dc] border border-blue-100 text-[9px] font-bold px-2 py-0.5 rounded-full">{taskChangelog.length} Entri</span>
                  )}
                </div>

                {/* ── Unified add note form ─────────────────────────────── */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                    if (files.length > 0) {
                      setNoteImageFiles(prev => [...prev, ...files]);
                      files.forEach(file => {
                        const reader = new FileReader();
                        reader.onload = ev => {
                          if (ev.target?.result) {
                            setNoteImagePreviews(prev => [...prev, ev.target!.result as string]);
                          }
                        };
                        reader.readAsDataURL(file);
                      });
                    }
                  }}
                  className={`relative rounded-2xl bg-[var(--s2)]/50 border overflow-hidden transition-all duration-200 ${isDragging ? 'border-[var(--primary)] bg-[var(--primary-dim)]/15 scale-[1.005]' : 'border-zinc-100'}`}
                >
                  {isDragging && (
                    <div className="absolute inset-0 bg-[var(--canvas)]/90 backdrop-blur-xs flex flex-col items-center justify-center z-20 border-2 border-dashed border-[var(--primary)] rounded-2xl animate-fade-in pointer-events-none">
                      <Attachment className="w-8 h-8 text-[var(--primary)] animate-bounce mb-2" />
                      <span className="text-xs font-bold text-[var(--primary)]">Lepaskan gambar di sini untuk upload</span>
                    </div>
                  )}
                  <div className="p-4 space-y-3">
                    {/* Row 1: optional title */}
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={e => setNoteTitle(e.target.value)}
                      placeholder="Judul catatan (opsional) — misal: Cari gambar, Revisi layout..."
                      className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-[var(--s1)] text-[var(--ink)] text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--primary)] placeholder:text-zinc-300 placeholder:font-normal"
                    />
                    {/* Row 2: content */}
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Tulis catatan progress, kendala, atau update..."
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-[var(--s1)] text-[var(--ink)] text-xs font-semibold outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none placeholder:text-zinc-400 leading-relaxed"
                    />
                    {/* Row 3: deadline + link + foto */}
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
                        <label className="text-[9px] font-bold text-zinc-400 uppercase px-1">Deadline <span className="text-zinc-300">(Opsional)</span></label>
                        <input
                          type="date"
                          value={noteDeadline}
                          onChange={e => setNoteDeadline(e.target.value)}
                          className="w-full h-[38px] px-2.5 rounded-xl border border-zinc-200 bg-[var(--s1)] text-[var(--ink)] text-xs font-semibold outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        />
                      </div>
                      <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
                        <label className="text-[9px] font-bold text-zinc-400 uppercase px-1">PIC <span className="text-zinc-300">(Opsional)</span></label>
                        <Dropdown
                          value={notePic}
                          onChange={val => setNotePic(val)}
                          options={[
                            { value: '', label: 'Pilih PIC...' },
                            ...designers.map(d => ({ value: d.id, label: d.name }))
                          ]}
                          placeholder="Pilih PIC..."
                        />
                      </div>
                      <div className="flex flex-col gap-1 flex-[2] min-w-[140px]">
                        <label className="text-[9px] font-bold text-zinc-400 uppercase px-1">Link Referensi <span className="text-zinc-300">(Opsional)</span></label>
                        <input
                          type="url"
                          value={noteLink}
                          onChange={e => setNoteLink(e.target.value)}
                          placeholder="https://..."
                          className="w-full h-[38px] px-2.5 rounded-xl border border-zinc-200 bg-[var(--s1)] text-[var(--ink)] text-xs font-semibold outline-none focus:ring-2 focus:ring-[var(--primary)] placeholder:text-zinc-400"
                        />
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <label className="text-[9px] font-bold text-zinc-400 uppercase px-1">Foto <span className="text-zinc-300">(Opsional)</span></label>
                        <button
                          onClick={() => noteImageInputRef.current?.click()}
                          type="button"
                          className={`h-[38px] px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${noteImageFiles.length > 0 ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-[var(--s1)] border-zinc-200 text-zinc-500 hover:border-[var(--primary)] hover:text-[var(--primary)]'}`}
                        >
                          <Attachment className="w-4 h-4" />
                          {noteImageFiles.length > 0 ? <><Check className="w-3.5 h-3.5 text-emerald-700" /> {noteImageFiles.length} Foto</> : 'Pilih Foto'}
                        </button>
                        <input ref={noteImageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleNoteImageChange} />
                      </div>
                    </div>
                    {/* Image previews */}
                    {noteImagePreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2.5 mt-2">
                        {noteImagePreviews.map((preview, idx) => (
                          <div key={idx} className="relative inline-block">
                            <img src={preview} alt={`preview ${idx}`} className="max-h-20 rounded-lg border border-zinc-200 object-cover" />
                            <button
                              onClick={() => {
                                setNoteImageFiles(prev => prev.filter((_, i) => i !== idx));
                                setNoteImagePreviews(prev => prev.filter((_, i) => i !== idx));
                                if (noteImageInputRef.current) noteImageInputRef.current.value = '';
                              }}
                              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center font-bold hover:bg-red-600"
                            >
                              ✕
                            </button>
                            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">→ WebP</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Save button footer */}
                  <div className="flex justify-end p-3 bg-[var(--s2)]/40 border-t border-zinc-100/50 rounded-b-2xl">
                    <button
                      onClick={handleSaveNote}
                      disabled={isSavingNote || uploadingImage || (!noteTitle.trim() && !noteText.trim() && !noteLink.trim() && noteImageFiles.length === 0)}
                      className="px-6 py-2 bg-[var(--primary)] text-white text-xs font-bold uppercase tracking-wider hover:brightness-110 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                    >
                      {(isSavingNote || uploadingImage) ? (
                        <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> {uploadingImage ? 'Mengupload...' : 'Menyimpan...'}</>
                      ) : <><Plus className="w-4 h-4" /> Simpan</>}
                    </button>
                  </div>
                </div>

                {/* ── Unified feed ─────────────────────────────────────── */}
                <div>
                  {isLoadingChangelog ? (
                    <div className="flex flex-col items-center py-12 gap-3 text-zinc-400">
                      <span className="w-8 h-8 border-3 border-zinc-200 border-t-[var(--primary)] rounded-full animate-spin" />
                      <span className="text-xs font-bold">Memuat...</span>
                    </div>
                  ) : taskChangelog.length === 0 ? (
                    <div className="flex flex-col items-center py-12 gap-2 text-zinc-400">
                      <EmptyPage className="w-12 h-12 text-zinc-400 mb-2" />
                      <p className="text-xs font-bold">Belum ada aktivitas untuk task ini.</p>
                      <p className="text-[10px]">Catatan, perubahan status, dan log akan muncul di sini.</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-px bg-zinc-200" />
                      <div className="space-y-3">
                        {taskChangelog.map((entry, idx) => {
                          const ic = getChangelogIcon(entry);
                          const isNoteCard = entry.change_type === 'NOTE' && !!(entry.note_title || entry.note_deadline);
                          const isSystemEntry = entry.change_type !== 'NOTE';

                          return (
                            <div key={entry.id} className="relative flex gap-3 group/entry animate-in fade-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${idx * 30}ms` }}>
                              {/* Icon / Checkbox */}
                              {isNoteCard ? (
                                // Clickable checkbox for task-type notes
                                <button
                                  onClick={() => handleToggleNoteStatus(entry)}
                                  disabled={togglingId === entry.id}
                                  className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center shrink-0 z-10 shadow-sm transition-all group/chk ${
                                    entry.note_status === 'DONE'
                                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/10'
                                      : getNoteDeadlineStatus(entry) === 'overdue'
                                      ? 'border-red-300 hover:border-red-500 hover:bg-red-50 bg-red-50/20 text-red-500'
                                      : 'border-zinc-300 hover:border-[var(--primary)] hover:bg-[var(--s2)] bg-[var(--s1)] text-[var(--ink-2)]'
                                  }`}
                                  title={entry.note_status === 'DONE' ? 'Buka kembali' : 'Tandai selesai'}
                                >
                                  {togglingId === entry.id ? (
                                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  ) : entry.note_status === 'DONE' ? (
                                    <Check className="w-4 h-4" strokeWidth={3} />
                                  ) : (
                                    <>
                                      <span className="w-2 h-2 rounded bg-current group-hover/chk:hidden" />
                                      <Check className="w-4 h-4 hidden group-hover/chk:block" strokeWidth={3} />
                                    </>
                                  )}
                                </button>
                              ) : (
                                <div className={`w-8 h-8 rounded-full ${ic.bg} ${ic.border} border flex items-center justify-center text-sm shrink-0 z-10 shadow-sm transition-transform group-hover/entry:scale-110`}>
                                  {ic.icon}
                                </div>
                              )}

                              {/* Content card */}
                              <div className={`flex-1 min-w-0 rounded-2xl border shadow-sm transition-colors ${
                                isSystemEntry
                                  ? 'bg-[var(--s2)] border-zinc-100 hover:border-zinc-200 px-4 py-3'
                                  : isNoteCard && entry.note_status === 'DONE'
                                  ? 'bg-emerald-50/40 border-emerald-100 px-4 py-3'
                                  : isNoteCard && getNoteDeadlineStatus(entry) === 'overdue'
                                  ? 'bg-red-50/30 border-red-100 px-4 py-3'
                                  : isNoteCard && getNoteDeadlineStatus(entry) === 'due-soon'
                                  ? 'bg-amber-50/30 border-amber-100 px-4 py-3'
                                  : 'bg-[var(--s2)] border-zinc-100 hover:border-zinc-200 px-4 py-3'
                              }`}>

                                {/* Header row */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 flex flex-wrap items-center gap-2">
                                    {/* Label / title */}
                                    <div className={isNoteCard && entry.note_status === 'DONE' ? 'opacity-60 line-through' : ''}>
                                      {getChangelogLabel(entry, getDeptName)}
                                    </div>
                                    {/* Deadline badge (only for note cards) */}
                                    {isNoteCard && <NoteDeadlineBadge entry={entry} />}
                                    {/* PIC Designer */}
                                    {entry.pic_designer_id && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200 uppercase">
                                        PIC: {getDesignerName(entry.pic_designer_id)}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] font-bold text-zinc-400 shrink-0" title={formatAbsoluteTime(entry.created_at)}>
                                    {formatRelativeTime(entry.created_at)}
                                  </span>
                                </div>

                                {/* Sub-header: timestamp + author */}
                                <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">
                                  {formatAbsoluteTime(entry.created_at)} · {entry.changed_by || 'Admin'}
                                </p>

                                {/* Note content */}
                                {entry.note && (
                                  <div className={`mt-2 p-3 bg-white rounded-xl border border-zinc-100 text-xs text-zinc-700 font-medium leading-relaxed whitespace-pre-wrap ${isNoteCard && entry.note_status === 'DONE' ? 'opacity-60' : ''}`}>
                                    {entry.note}
                                  </div>
                                )}

                                {/* Link */}
                                {entry.reference_link && (
                                  <a href={entry.reference_link} target="_blank" rel="noopener noreferrer"
                                    className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                    <span className="truncate max-w-[220px]">{entry.reference_link}</span>
                                  </a>
                                )}

                                {/* Image */}
                                {entry.image_url && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {getImages(entry.image_url).map((url, i) => (
                                      <div key={i} className="flex flex-col">
                                        <button
                                          type="button"
                                          onClick={() => setPreviewImage(url)}
                                          className="block focus:outline-none"
                                        >
                                          <img src={url} alt={`Screenshot ${i + 1}`} className="max-h-20 max-w-[160px] object-cover rounded-lg border border-zinc-200 hover:border-[var(--primary)] hover:brightness-95 cursor-zoom-in transition-all" />
                                        </button>
                                      </div>
                                    ))}
                                    <p className="w-full text-[8px] text-zinc-400 font-semibold mt-1">📎 Klik untuk memperbesar</p>
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
        /* ── LIST/BOARD/CALENDAR/TIMELINE VIEW ────────────────────────────── */
        <>
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight uppercase text-[var(--ink)]">Internal Design Tasks</h1>
              <p className="text-[var(--ink-2)] text-sm mt-1 font-semibold">Manage inter-department creative requests.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto mt-4 md:mt-0">
            <div className="flex bg-[var(--s2)] border border-zinc-100 p-0.5 rounded-full shadow-inner">
              {([
                { v:'list', title:'List View' },
                { v:'board', title:'Board View' },
                { v:'calendar', title:'Calendar View' },
                { v:'timeline', title:'Timeline View' },
              ] as any[]).map(({ v, title }) => (
                <button key={v} onClick={() => setView(v)} className={`p-2 rounded-full transition-all ${view === v ? 'bg-white text-[var(--primary)] shadow-sm border border-zinc-100' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'}`} title={title}>
                  {v === 'list' && <TaskList className="w-4 h-4" />}
                  {v === 'board' && <Dashboard className="w-4 h-4" />}
                  {v === 'calendar' && <Calendar className="w-4 h-4" />}
                  {v === 'timeline' && <Reports className="w-4 h-4" />}
                </button>
              ))}
            </div>
            <button onClick={handleOpenAdd} className="px-4 py-2 bg-[var(--primary)] text-white rounded-full text-xs font-bold uppercase shadow-sm flex items-center gap-2 hover:brightness-110 transition-all">
              <Plus className="w-4 h-4" strokeWidth={3} />Add Task
            </button>
            <button onClick={handleCopyLink} className={`px-4 py-2 rounded-full text-xs font-bold uppercase flex items-center gap-2 border transition-all ${copySuccess ? 'bg-[#edfce9] border-[#003c33] text-[#003c33]' : 'bg-[var(--s1)] border-zinc-100 text-[var(--ink-2)] hover:border-[var(--primary)]'}`}>
              <Link className="w-4 h-4" />
              {copySuccess ? 'Copied!' : 'Form Link'}
            </button>
            </div>
          </header>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            <div className="bg-[var(--s1)] p-3 md:p-6 rounded-[24px] border border-zinc-100 shadow-sm flex flex-col col-span-2">
              <span className="text-[10px] font-bold text-[var(--ink-3)] uppercase tracking-wider mb-4">Task Status Summary</span>
              <div className="grid grid-cols-6 gap-y-4 gap-x-2">
                {[
                  { label:'New', value: stats.new, color:'text-blue-600' },
                  { label:'Progress', value: stats.progress, color:'text-amber-600' },
                  { label:'Review', value: stats.review, color:'text-purple-600' },
                  { label:'Hold', value: stats.hold, color:'text-[var(--ink-4)]' },
                  { label:'Done', value: stats.done, color:'text-emerald-600' },
                  { label:'Total', value: stats.total, color:'text-[var(--ink)] font-bold underline decoration-[var(--primary)] underline-offset-4' },
                ].map(s => (
                  <div key={s.label} className="flex flex-col items-center gap-1">
                    <span className={`text-xl md:text-2xl font-bold ${s.color}`}>{s.value}</span>
                    <span className="text-[8px] md:text-[9px] text-[var(--ink-3)] font-bold uppercase tracking-wider">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={`p-3 md:p-6 rounded-[24px] border flex flex-col justify-center transition-colors ${stats.deadlinesToday > 0 ? 'bg-red-600 border-red-700 text-white shadow-sm' : 'bg-[var(--s1)] border-zinc-100 text-[var(--ink)]'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${stats.deadlinesToday > 0 ? 'text-red-100' : 'text-[var(--ink-3)]'}`}>Deadlines Today</span>
              <div className="text-xl md:text-3xl font-bold">{stats.deadlinesToday}</div>
              <p className={`text-[9px] font-bold mt-2 uppercase ${stats.deadlinesToday > 0 ? 'text-red-100' : 'text-[var(--ink-3)]'}`}>{stats.deadlinesToday > 0 ? 'Urgent attention!' : 'Clear for today.'}</p>
            </div>
            <div className={`p-3 md:p-6 rounded-[24px] border flex flex-col justify-center transition-colors ${stats.overdue > 0 ? 'bg-red-50/80 border-red-200 text-red-700 shadow-sm' : 'bg-[var(--s1)] border-zinc-100 text-[var(--ink)]'}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70 text-[var(--ink-3)]">Overdue Tasks</span>
              <div className="text-xl md:text-3xl font-bold">{stats.overdue}</div>
              <p className="text-[9px] font-bold mt-2 uppercase opacity-60">{stats.overdue > 0 ? 'Tasks missed deadline' : 'None overdue'}</p>
              {stats.noDeadline > 0 && <p className="text-[8px] font-bold mt-1 text-zinc-400">+{stats.noDeadline} tanpa deadline</p>}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-[var(--s2)] p-4 rounded-[24px] flex flex-wrap items-center gap-4 border border-zinc-100 shadow-inner">
            {[
              { label:'Status Filter', value: filterStatus, onChange: setFilterStatus, widthClass: 'w-40',
                options: [['ALL','All Status'],['NEW','NEW'],['ON HOLD','ON HOLD'],['ON PROGRESS','ON PROGRESS'],['ON REVIEW','ON REVIEW'],['DONE','DONE']] },
              { label:'Requester Dept', value: filterDept, onChange: setFilterDept, widthClass: 'w-56',
                options: [['ALL','All Departments'], ...departments.map(d => [d.id, d.department_name])] },
              { label:'Urutkan', value: listSortOrder, onChange: setListSortOrder as any, widthClass: 'w-48',
                options: [['CREATED_DESC','Task Terbaru'],['UPDATE_DESC','Update / Catatan Terbaru']] },
            ].map(f => (
              <div key={f.label} className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-[var(--ink-3)] uppercase tracking-wider px-1">{f.label}</span>
                <div className={f.widthClass}>
                  <Dropdown
                    value={f.value}
                    onChange={val => f.onChange(val)}
                    options={f.options.map(([v, l]) => ({ value: v, label: l }))}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* ── List view (Accordion) ───────────────────────────────────────────────── */}
          {view === 'list' && (
            <div className="bg-[var(--s1)] rounded-[24px] border border-zinc-100 shadow-sm overflow-hidden animate-in fade-in duration-300">
              {/* Header row (Desktop only) */}
              <div className="hidden md:grid grid-cols-12 gap-4 bg-[var(--s2)] border-b border-zinc-100 text-[9px] md:text-[10px] font-bold uppercase text-[var(--ink-3)] tracking-wider px-6 py-3.5">
                <div className="col-span-1"></div> {/* Arrow column */}
                <div className="col-span-4">Task & Status</div>
                <div className="col-span-3">Dept & Req</div>
                <div className="col-span-2">Due</div>
                <div className="col-span-1">Subtasks</div>
                <div className="col-span-1 text-right">Aksi</div>
              </div>
              
              <div className="divide-y divide-zinc-100">
                {sortedTasks.map(task => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isOverdue = task.deadline && task.deadline < todayStr && task.status !== 'DONE';
                  const isToday   = task.deadline === todayStr && task.status !== 'DONE';
                  const nc = noteCounts.get(task.id);
                  const isExpanded = !!expandedTasks[task.id] && !!nc && nc.notes.length > 0;
                  
                  return (
                    <div key={task.id} className="group transition-colors duration-150">
                      {/* Accordion Header Row */}
                      <div 
                        onClick={() => handleSelectTask(task)} 
                        className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center px-4 md:px-6 py-4 hover:bg-[var(--hl)] cursor-pointer font-bold text-[var(--ink)] uppercase"
                      >
                        {/* Expand Chevron Icon Button */}
                        <div className="col-span-1 flex items-center" onClick={e => e.stopPropagation()}>
                          {nc && nc.notes.length > 0 ? (
                            <button 
                              onClick={(e) => toggleExpandTask(task.id, e)}
                              className="p-1 rounded-lg hover:bg-[var(--s2)] text-zinc-400 hover:text-[var(--ink)] transition-all flex items-center justify-center border border-transparent hover:border-zinc-200 shadow-sm hover:shadow"
                              title={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              <NavArrowDown className={`w-4 h-4 transition-transform duration-250 ${isExpanded ? 'transform rotate-180 text-[var(--primary)]' : ''}`} />
                            </button>
                          ) : (
                            <div className="w-6 h-6" />
                          )}
                        </div>

                        {/* Task & Status */}
                        <div className="col-span-1 md:col-span-4 flex flex-col gap-1">
                          <div className="font-bold text-zinc-900 text-sm leading-tight group-hover:text-[var(--primary)] transition-colors">{task.task_name}</div>
                          <div className="flex gap-1 flex-wrap items-center">
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${getStatusColor(task.status)}`}>{task.status}</span>
                            {!task.deadline && <span className="px-1.5 py-0.5 rounded-full text-[7px] font-bold bg-zinc-100 text-zinc-400">∞ No Deadline</span>}
                          </div>
                        </div>

                        {/* Dept & Req */}
                        <div className="col-span-1 md:col-span-3">
                          <div className="text-[11px] font-bold text-zinc-800">{getDeptName(task.department_id)}</div>
                          <div className="text-[10px] text-zinc-400 font-medium mt-0.5">By: {task.requester_name}</div>
                        </div>

                        {/* Due Date */}
                        <div className="col-span-1 md:col-span-2">
                          {task.deadline ? (
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isOverdue ? 'text-red-600 bg-red-500/10 border border-red-500/20' : isToday ? 'text-amber-600 bg-amber-500/10 border border-amber-500/20' : 'text-[var(--ink-2)] bg-[var(--s2)] border border-zinc-100'}`}>
                              {task.deadline}
                            </span>
                          ) : (
                            <span className="text-[9px] text-zinc-300 italic">—</span>
                          )}
                        </div>

                        {/* Subtasks progress quick badge */}
                        <div className="col-span-1 md:col-span-1">
                          {nc && nc.notes.length > 0 ? (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <TaskNotesTooltip nc={nc}>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-extrabold border ${nc.urgent > 0 ? 'bg-red-50 border-red-100 text-red-600 animate-pulse' : (nc.total > 0 && nc.done === nc.total) ? 'bg-[#edfce9] border-[#003c33]/20 text-[#003c33]' : 'bg-[#f1f5ff] border-[#1863dc]/20 text-[#1863dc]'}`}>
                                  <ChatBubble className="w-3.5 h-3.5 shrink-0" />
                                  <span>{nc.notes.length}</span>
                                  {nc.total > 0 && <span className="opacity-60">({nc.done}/{nc.total})</span>}
                                </span>
                              </TaskNotesTooltip>
                            </div>
                          ) : (
                            <span className="text-[9px] text-zinc-300">—</span>
                          )}
                        </div>

                        {/* Quick actions */}
                        <div className="col-span-1 md:col-span-1 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenEdit(task)} className="text-[var(--primary)] p-1 rounded-full hover:bg-[var(--s2)]" title="Edit"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(task.id)} className="text-red-500 p-1 rounded-full hover:bg-red-50" title="Delete"><Trash className="w-4 h-4" /></button>
                            <div className="w-28 text-left">
                              <Dropdown
                                value={task.status}
                                onChange={val => updateStatus(task.id, val as InternalStatus)}
                                options={[
                                  { value: 'NEW', label: 'NEW' },
                                  { value: 'ON PROGRESS', label: 'PROG' },
                                  { value: 'ON REVIEW', label: 'REV' },
                                  { value: 'ON HOLD', label: 'HOLD' },
                                  { value: 'DONE', label: 'DONE' }
                                ]}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Accordion expanded content panel */}
                      {isExpanded && (
                        <div className="px-6 pb-6 pt-3 bg-[var(--s2)]/40 border-t border-zinc-150/30 animate-in slide-in-from-top-2 duration-250 space-y-4">
                          {/* Progress summary (Progression) */}
                          {nc && nc.total > 0 ? (() => {
                            const pct = Math.round((nc.done / nc.total) * 100);
                            return (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-[var(--s1)] border border-zinc-100/80 px-4 py-3 rounded-2xl shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--primary-dim)] text-[var(--primary)] font-extrabold text-xs border border-[var(--hl-3)] shrink-0">
                                    {pct}%
                                  </div>
                                  <div>
                                    <div className="text-[10px] font-extrabold text-[var(--ink-3)] uppercase tracking-wider">Progress Catatan / Subtask</div>
                                    <div className="text-xs font-bold text-[var(--ink-2)]">{nc.done} dari {nc.total} Selesai</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                                  <div className="h-2 flex-1 rounded-full bg-zinc-200/50 overflow-hidden">
                                    <div className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                                  </div>
                                  {nc.urgent > 0 && (
                                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-red-500/10 text-red-600 border border-red-500/20 animate-pulse">
                                      ⚠ {nc.urgent} TELAT
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })() : (
                            <div className="text-xs font-bold text-zinc-400 italic bg-[var(--s1)] px-4 py-3 rounded-2xl border border-zinc-100/80">
                              Belum ada subtask checklist untuk task ini.
                            </div>
                          )}

                          {/* Checklist & Notes details */}
                          {nc && nc.notes.length > 0 ? (
                            <div className="space-y-2.5">
                              <h4 className="text-[10px] font-extrabold text-[var(--ink-3)] uppercase tracking-wider ml-1">Daftar Subtask & Catatan</h4>
                              <div className="grid grid-cols-1 gap-2.5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {nc.notes.map((entry) => {
                                  const isNoteCard = (entry.note_status === 'OPEN' || entry.note_status === 'DONE') && !!(entry.note_title || entry.note_deadline);
                                  return (
                                    <div 
                                      key={entry.id}
                                      onClick={(e) => e.stopPropagation()} 
                                      className={`flex gap-3 items-start p-3 rounded-xl border shadow-sm transition-colors bg-[var(--s1)] border-zinc-100/80 hover:border-zinc-200 ${
                                        isNoteCard && entry.note_status === 'DONE' ? 'opacity-65' : ''
                                      }`}
                                    >
                                      {/* Interactive Checkbox for Checklist item */}
                                      {isNoteCard ? (
                                        <button
                                          onClick={() => handleToggleNoteStatus(entry)}
                                          disabled={togglingId === entry.id}
                                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all group/chk ${
                                            entry.note_status === 'DONE'
                                              ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/10'
                                              : getNoteDeadlineStatus(entry) === 'overdue'
                                              ? 'border-red-300 hover:border-red-500 bg-red-50/20 text-red-500'
                                              : 'border-zinc-300 hover:border-[var(--primary)] text-[var(--ink-2)]'
                                          }`}
                                          title={entry.note_status === 'DONE' ? 'Buka kembali' : 'Tandai selesai'}
                                        >
                                          {togglingId === entry.id ? (
                                            <span className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                          ) : entry.note_status === 'DONE' ? (
                                            <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                          ) : (
                                            <>
                                              <span className="w-1.5 h-1.5 rounded bg-current group-hover/chk:hidden" />
                                              <Check className="w-3.5 h-3.5 hidden group-hover/chk:block" strokeWidth={3} />
                                            </>
                                          )}
                                        </button>
                                      ) : (
                                        <div className="w-6 h-6 rounded-lg bg-[var(--s2)] border border-zinc-100 flex items-center justify-center shrink-0 mt-0.5 text-zinc-400">
                                          <ChatBubble className="w-3 h-3" />
                                        </div>
                                      )}

                                      {/* Detail text & links */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="font-bold text-xs text-[var(--ink)]">
                                            {entry.note_title || (isNoteCard ? 'Subtask Tanpa Judul' : 'Catatan')}
                                          </div>
                                          {isNoteCard && <NoteDeadlineBadge entry={entry} />}
                                        </div>
                                        {entry.note && (
                                          <p className="text-xs text-[var(--ink-2)] font-medium mt-1 leading-relaxed whitespace-pre-wrap">
                                            {entry.note}
                                          </p>
                                        )}
                                        {entry.reference_link && (
                                          <a href={entry.reference_link} target="_blank" rel="noopener noreferrer"
                                            className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline">
                                            <Link className="w-3 h-3 shrink-0" />
                                            <span className="truncate max-w-[200px]">{entry.reference_link}</span>
                                          </a>
                                        )}
                                        {entry.image_url && (
                                          <div className="mt-2 flex flex-wrap gap-1.5">
                                            {getImages(entry.image_url).map((url, i) => (
                                              <button
                                                key={i}
                                                type="button"
                                                onClick={() => setPreviewImage(url)}
                                                className="block focus:outline-none"
                                              >
                                                <img src={url} alt={`Screenshot ${i + 1}`} className="max-h-16 max-w-[120px] object-cover rounded border border-zinc-200 hover:border-[var(--primary)] hover:brightness-95 cursor-zoom-in transition-all" />
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                        <div className="text-[9px] text-zinc-400 font-semibold mt-1">
                                          {formatAbsoluteTime(entry.created_at)} · By {entry.changed_by || 'Admin'}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {filteredTasks.length === 0 && (
                <div className="p-20 text-center text-zinc-400 font-bold italic">No requests matching filters.</div>
              )}
            </div>
          )}

          {/* ── Board view ──────────────────────────────────────────────── */}
          {view === 'board' && (
            <div className="h-[600px] flex flex-col border border-zinc-100 bg-[var(--s1)] text-[var(--ink)] rounded-[24px] shadow-sm p-4 overflow-hidden">
              <div className="flex items-center gap-3 mb-4 shrink-0 flex-wrap">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Group By:</span>
                <div className="flex bg-[var(--s2)] p-1 rounded-full border border-zinc-100/50 shadow-inner">
                  {[{id:'status',l:'Status'},{id:'dept',l:'Department'},{id:'overdue',l:'Deadline Alert'}].map(o => (
                    <button key={o.id} onClick={() => setBoardGroup(o.id as any)} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${boardGroup===o.id ? 'bg-white text-[var(--primary)] shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>{o.l}</button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-x-auto flex gap-6 pb-2 items-start custom-scrollbar">
                {Object.entries(internalBoardGroups).map(([group, tasks], idx) => {
                  const theme = getBoardHeaderColor(group);
                  return (
                    <div key={group} className="w-80 flex-shrink-0 bg-zinc-50/50 rounded-2xl flex flex-col max-h-full border border-zinc-100 shadow-sm h-full">
                      <div className={`p-4 border-b border-zinc-100 border-t-4 uppercase tracking-tight font-bold text-sm flex justify-between items-center rounded-t-2xl shrink-0 ${theme}`}>
                        <span className="truncate pr-2">{group}</span>
                        <span className="bg-white/60 text-current text-[10px] px-2 py-0.5 rounded-full">{tasks.length}</span>
                      </div>
                      <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar min-h-0">
                        {tasks.map(task => {
                          const todayStr = new Date().toISOString().split('T')[0];
                          const isOverdue = task.deadline && task.deadline < todayStr && task.status !== 'DONE';
                          const isToday = task.deadline === todayStr && task.status !== 'DONE';
                          const nc = noteCounts.get(task.id);
                          return (
                            <div key={task.id} onClick={() => handleSelectTask(task)} className="bg-white p-4 rounded-xl shadow-sm border border-[#EAEAEA] cursor-pointer hover:shadow-md transition-shadow group/card">
                              <div className="flex justify-between items-start mb-2">
                                <span className={`px-2 py-0.5 rounded-md border text-[8px] font-bold uppercase ${getStatusColor(task.status)}`}>{task.status}</span>
                                <div className="flex gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                  <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(task); }} className="text-zinc-400 hover:text-[var(--primary)]"><Edit className="w-3.5 h-3.5" /></button>
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
                                  <span className={`font-bold tracking-tight ${isOverdue ? 'text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-200' : isToday ? 'text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200' : 'text-zinc-800'}`}>{task.deadline || 'No deadline'}</span>
                                </div>
                                {nc && nc.notes.length > 0 && (
                                  <div className="flex justify-between text-[10px] items-center pt-2 border-t border-zinc-50/50 mt-1">
                                    <span className="text-zinc-400 font-bold uppercase">Catatan</span>
                                    <TaskNotesTooltip nc={nc}>
                                      <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${nc.urgent > 0 ? 'bg-red-500/10 border-red-500/20 text-red-600 animate-pulse' : (nc.total > 0 && nc.done === nc.total) ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-[var(--primary-dim)] border-[var(--primary)]/20 text-[var(--primary)]'}`}>
                                        <ChatBubble className="w-3 h-3 text-current shrink-0" />
                                        <span>{nc.notes.length}</span>
                                        {nc.total > 0 && <span className="opacity-60">({nc.done}/{nc.total})</span>}
                                      </span>
                                    </TaskNotesTooltip>
                                  </div>
                                )}
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
          )}

          {/* ── Calendar view ───────────────────────────────────────────── */}
          {view === 'calendar' && (
            <div className="bg-[var(--s1)] border border-zinc-100 rounded-[24px] shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-[var(--s2)]">
                <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-[var(--s3)] rounded-full border border-zinc-100 bg-[var(--s1)] shadow-sm">
                  <NavArrowLeft className="w-4 h-4 text-[var(--ink)]" />
                </button>
                <div className="text-center">
                  <h3 className="text-sm font-bold text-[var(--ink)] uppercase tracking-widest">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
                  <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">Hanya task yang punya deadline yang muncul di kalender</p>
                </div>
                <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-[var(--s3)] rounded-full border border-zinc-100 bg-[var(--s1)] shadow-sm">
                  <NavArrowRight className="w-4 h-4 text-[var(--ink)]" />
                </button>
              </div>
              <div className="grid grid-cols-7 border-b border-zinc-100">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} className="py-2 text-center text-[9px] font-bold text-zinc-400 uppercase tracking-wider">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 border-l border-t border-zinc-100">{renderCalendar()}</div>
            </div>
          )}

          {/* ── Timeline view ───────────────────────────────────────────── */}
          {view === 'timeline' && renderTimeline()}
        </>
      )}

      {/* ── Add Task Modal ─────────────────────────────────────────────────── */}
      {isFormOpen && !editingTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--s1)] rounded-[28px] shadow-2xl w-full max-w-lg border border-zinc-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-100 bg-[var(--s2)] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)] uppercase tracking-wide">Tambah Task Baru</h2>
                <p className="text-[10px] text-zinc-400 font-semibold mt-1">Deadline bisa dikosongkan jika belum ada.</p>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-[var(--s3)] rounded-full text-zinc-400 hover:text-zinc-700 transition-colors">
                <Xmark className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Task Name *</label>
                <input type="text" required value={formData.task_name||''} onChange={e => setFormData({...formData, task_name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--primary)] uppercase" placeholder="Nama tugas..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Requester *</label>
                  <input type="text" required value={formData.requester_name||''} onChange={e => setFormData({...formData, requester_name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--primary)] uppercase" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Deadline <span className="text-zinc-300">(Opsional)</span></label>
                  <input type="date" value={formData.deadline||''} onChange={e => setFormData({...formData, deadline: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-zinc-100 bg-[var(--s2)] text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--primary)]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Department *</label>
                  <Dropdown
                    value={formData.department_id || ''}
                    onChange={val => setFormData({ ...formData, department_id: val })}
                    options={departments.map(d => ({ value: d.id, label: d.department_name }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Status</label>
                  <Dropdown
                    value={formData.status || ''}
                    onChange={val => setFormData({ ...formData, status: val as InternalStatus })}
                    options={[
                      { value: 'NEW', label: 'NEW' },
                      { value: 'ON PROGRESS', label: 'ON PROGRESS' },
                      { value: 'ON REVIEW', label: 'ON REVIEW' },
                      { value: 'ON HOLD', label: 'ON HOLD' },
                      { value: 'DONE', label: 'DONE' }
                    ]}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Brief Description</label>
                <textarea value={getBriefText(formData.brief||'')} onChange={e => setFormData({...formData, brief: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-zinc-100 bg-[var(--s2)]/50 text-[var(--ink)] text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--primary)]" rows={4} placeholder="Deskripsi singkat..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-2 bg-[var(--primary)] text-white rounded-lg font-bold uppercase text-xs hover:brightness-110 transition-all shadow-sm">Simpan Task</button>
                <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-2 bg-[var(--s2)] text-[var(--ink-2)] border border-zinc-100 rounded-lg font-bold uppercase text-xs hover:bg-[var(--s3)] transition-all">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Image Preview Modal ── */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative bg-[var(--s1)] rounded-[20px] shadow-2xl max-w-3xl max-h-[85vh] border border-zinc-100 overflow-hidden p-2 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors z-10"
            >
              <Xmark className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Larger preview"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalDesignMaster;