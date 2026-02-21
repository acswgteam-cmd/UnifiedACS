
import React, { useState, useMemo, useRef } from 'react';
import { Lead } from '../types';
import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabase';
import { PUBLIC_FORM_SECRET } from '../data/mockData';

interface Props {
  leads: Lead[];
  onUpdate: () => void;
}

const LeadMaster: React.FC<Props> = ({ leads, onUpdate }) => {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [copySuccess, setCopySuccess] = useState(false);
  const lastScrollTime = useRef(0);
  
  // States for Filtering
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterGrade, setFilterGrade] = useState('ALL');
  const [filterRequester, setFilterRequester] = useState('ALL');

  const [formData, setFormData] = useState<Partial<Lead>>({
    lead_name: '',
    requester: '',
    order_date: new Date().toISOString().split('T')[0],
    deadline: '',
    lead_grade: 'B',
    brief: '',
    drive_link: '',
    status: 'ON PROGRESS'
  });

  const uniqueRequesters = useMemo(() => {
    const names = leads.map(l => l.requester).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [leads]);

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      total: leads.length,
      progress: leads.filter(l => l.status === 'ON PROGRESS').length,
      done: leads.filter(l => l.status === 'DONE').length,
      cancel: leads.filter(l => l.status === 'CANCEL').length,
      gradeA: leads.filter(l => l.lead_grade === 'A').length,
      gradeB: leads.filter(l => l.lead_grade === 'B').length,
      gradeC: leads.filter(l => l.lead_grade === 'C').length,
      deadlinesToday: leads.filter(l => l.deadline === todayStr && l.status !== 'DONE').length,
      overdue: leads.filter(l => l.deadline < todayStr && l.status !== 'DONE').length
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchStatus = filterStatus === 'ALL' || l.status === filterStatus;
      const matchGrade = filterGrade === 'ALL' || l.lead_grade === filterGrade;
      const matchRequester = filterRequester === 'ALL' || l.requester === filterRequester;
      return matchStatus && matchGrade && matchRequester;
    });
  }, [leads, filterStatus, filterGrade, filterRequester]);

  // CALENDAR LANE LOGIC
  const calendarLanes = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
    const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];

    const visibleLeads = filteredLeads.filter(l => l.order_date <= endOfMonth && l.deadline >= startOfMonth);
    
    const sorted = [...visibleLeads].sort((a, b) => {
      if (a.order_date !== b.order_date) return a.order_date.localeCompare(b.order_date);
      return b.deadline.localeCompare(a.deadline);
    });

    const lanes: Lead[][] = [];
    sorted.forEach(lead => {
      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        const lastInLane = lanes[i][lanes[i].length - 1];
        if (lead.order_date > lastInLane.deadline) {
          lanes[i].push(lead);
          placed = true;
          break;
        }
      }
      if (!placed) lanes.push([lead]);
    });
    return lanes;
  }, [filteredLeads, currentDate]);

  const handleCopyLink = () => {
    const publicUrl = `${window.location.origin}${window.location.pathname}#/portal/v1/inquiry/${PUBLIC_FORM_SECRET}`;
    navigator.clipboard.writeText(publicUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const resetForm = () => {
    setFormData({
      lead_name: '',
      requester: '',
      order_date: new Date().toISOString().split('T')[0],
      deadline: '',
      lead_grade: 'B',
      brief: '',
      drive_link: '',
      status: 'ON PROGRESS'
    });
    setEditingId(null);
    setIsAdding(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lead_name || !formData.requester || !supabase) return;

    const { id, ...payload } = formData;

    if (editingId) {
      const { error } = await supabase.from('leads').update(payload).eq('id', editingId);
      if (error) alert(`Gagal Update: ${error.message}`);
      else {
        onUpdate();
        resetForm();
      }
    } else {
      const { error } = await supabase.from('leads').insert([payload]);
      if (error) alert(`Gagal Simpan: ${error.message}`);
      else {
        onUpdate();
        resetForm();
      }
    }
  };

  const handleEdit = (e: React.MouseEvent, l: Lead) => {
    e.stopPropagation();
    setFormData(l);
    setEditingId(l.id);
    setIsAdding(true);
    setView('list');
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!supabase || !confirm('Hapus lead ini?')) return;
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) alert(error.message);
    else onUpdate();
  };

  const downloadPDF = (e: React.MouseEvent | null, lead: Lead) => {
    if (e) e.stopPropagation();
    const doc = new jsPDF() as any;
    const primaryColor = [15, 23, 42]; // Slate 900
    const accentColor = [79, 70, 229]; // Indigo 600

    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('LEAD PRODUCTION SPECIFICATION', 20, 15);
    doc.setFontSize(22);
    doc.text(lead.lead_name.toUpperCase(), 20, 28);

    doc.setTextColor(100, 116, 139); 
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('REQUESTER / PIC', 20, 55);
    doc.text('LEAD GRADE', 20, 70);
    doc.text('DEADLINE', 110, 55);
    doc.text('CURRENT STATUS', 110, 70);

    doc.setTextColor(15, 23, 42); 
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(lead.requester, 20, 62);
    doc.text(`Grade ${lead.lead_grade}`, 20, 77);
    doc.text(lead.deadline, 110, 62);
    doc.text(lead.status, 110, 77);

    doc.setDrawColor(226, 232, 240); 
    doc.line(20, 85, 190, 85);
    doc.setTextColor(100, 116, 139); 
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('SCOPE OF WORK / BRIEF', 20, 95);
    doc.setTextColor(51, 65, 85); 
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const splitBrief = doc.splitTextToSize(lead.brief || 'No detailed brief provided for this request.', 170);
    doc.text(splitBrief, 20, 105);

    if (lead.drive_link) {
      const briefBottom = 105 + (splitBrief.length * 5) + 10;
      doc.setDrawColor(226, 232, 240);
      doc.line(20, briefBottom, 190, briefBottom);
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('REFERENCE ARTWORKS (GDRIVE/CLOUD)', 20, briefBottom + 10);
      doc.setTextColor(...accentColor);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.textWithLink(lead.drive_link, 20, briefBottom + 18, { url: lead.drive_link });
    }
    doc.setTextColor(148, 163, 184); 
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Generated on ${new Date().toLocaleString()} - ACS Unified Studio Portal`, 20, 285);
    doc.save(`Lead_Spec_${lead.lead_name.replace(/\s+/g, '_')}.pdf`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DONE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'CANCEL': return 'bg-[#F8F9FA] text-zinc-600 border-[#EAEAEA]';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getColorTheme = (lead: Lead) => {
    if (lead.status === 'DONE') {
      return { bg: 'bg-[#F8F9FA]', border: 'border-zinc-300', text: 'text-zinc-400', accent: 'text-emerald-600' };
    }
    const themes = [
      { bg: 'bg-blue-50', border: 'border-blue-600', text: 'text-blue-900', accent: 'text-blue-700' },
      { bg: 'bg-amber-50', border: 'border-amber-600', text: 'text-amber-900', accent: 'text-amber-700' },
      { bg: 'bg-emerald-50', border: 'border-emerald-600', text: 'text-emerald-900', accent: 'text-emerald-700' },
      { bg: 'bg-rose-50', border: 'border-rose-600', text: 'text-rose-900', accent: 'text-rose-700' },
    ];
    let hash = 0;
    for (let i = 0; i < lead.id.length; i++) hash = lead.id.charCodeAt(i) + ((hash << 5) - hash);
    return themes[Math.abs(hash) % themes.length];
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const navigateMonth = (direction: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastScrollTime.current < 400) return; // Throttle 400ms

    if (Math.abs(e.deltaY) > 20) {
      if (e.deltaY > 0) {
        navigateMonth(1);
      } else {
        navigateMonth(-1);
      }
      lastScrollTime.current = now;
    }
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const todayStr = new Date().toISOString().split('T')[0];
    const days = [];

    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-[160px] bg-[#F8F9FA]/50 border-r border-b border-[#EAEAEA]"></div>);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      
      days.push(
        <div key={d} className={`min-h-[160px] h-full border-r border-b border-[#EAEAEA] p-0 flex flex-col relative ${isToday ? 'bg-zinc-100/30' : 'bg-white'}`}>
          <div className="p-2 flex-shrink-0">
            <span className={`text-[10px] font-bold inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-700'}`}>
              {String(d).padStart(2, '0')}
            </span>
          </div>
          <div className="flex flex-col space-y-1 pb-2 flex-1">
            {calendarLanes.map((lane, laneIdx) => {
              const lead = lane.find(l => dateStr >= l.order_date && dateStr <= l.deadline);
              if (!lead) return <div key={`lane-spacer-${laneIdx}`} className="min-h-[64px] py-1.5 w-full"></div>;

              const theme = getColorTheme(lead);
              const isStart = dateStr === lead.order_date;
              const isEnd = dateStr === lead.deadline;

              return (
                <div 
                  key={lead.id} 
                  onClick={() => setSelectedLead(lead)}
                  className={`cursor-pointer min-h-[64px] py-1.5 flex flex-col justify-center px-2 overflow-hidden transition-all hover:brightness-95 ${theme.bg} ${theme.text} ${isStart ? `rounded-l-md ml-1 border-l-4 ${theme.border}` : ''} ${isEnd ? 'rounded-r-md mr-1' : ''}`}
                >
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="text-[10px] font-bold truncate uppercase tracking-tight">{lead.lead_name}</span>
                    <span className="text-[8px] font-bold opacity-80 mt-0.5 truncate uppercase tracking-tight">
                      PIC: {lead.requester}
                    </span>
                    <div className="flex items-center justify-between gap-1 mt-1">
                      <span className={`text-[7px] font-bold px-1 rounded border border-zinc-300 bg-white/50 uppercase ${lead.status === 'DONE' ? 'text-emerald-600' : ''}`}>
                        {lead.status}
                      </span>
                      <span className="text-[7px] font-bold px-1 rounded bg-zinc-900 text-white uppercase">
                        GR: {lead.lead_grade}
                      </span>
                    </div>
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

  const labelClass = "text-[11px] font-bold text-zinc-900 uppercase mb-1.5 block tracking-wide";
  const inputClass = "w-full rounded-lg border-zinc-300 text-zinc-900 text-sm p-3 border bg-white focus:ring-2 focus:ring-indigo-600 outline-none shadow-sm font-medium transition-all";
  const filterSelectClass = "text-[10px] font-bold border-[#EAEAEA] rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm uppercase tracking-tight cursor-pointer";

  return (
    <div className="space-y-6 flex flex-col h-full relative">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight uppercase">Lead Registry</h1>
          <p className="text-zinc-600 text-sm mt-1 font-semibold">Monitor and manage all design inquiries.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleCopyLink} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 border ${copySuccess ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-zinc-300 text-zinc-700 hover:border-zinc-900'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
            {copySuccess ? 'Copied Link!' : 'Copy Secured Link'}
          </button>
          <div className="flex bg-[#FAFAFA]200 p-1 rounded-lg">
            <button onClick={() => setView('list')} className={`px-4 py-1 rounded-md text-xs font-bold ${view === 'list' ? 'bg-white shadow-sm text-zinc-800' : 'text-zinc-600'}`}>List</button>
            <button onClick={() => setView('calendar')} className={`px-4 py-1 rounded-md text-xs font-bold ${view === 'calendar' ? 'bg-white shadow-sm text-zinc-800' : 'text-zinc-600'}`}>Calendar</button>
          </div>
          <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-bold shadow-sm border border-[#EAEAEA] hover:bg-black transition-all flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
            New Lead
          </button>
        </div>
      </header>

      {/* LEAD MINI DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[20px] border border-[#EAEAEA] shadow-sm flex flex-col">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-4">Status Summary</span>
          <div className="grid grid-cols-3 gap-2">
            <StatusItem label="Progress" value={stats.progress} color="text-blue-600" />
            <StatusItem label="Done" value={stats.done} color="text-emerald-600" />
            <StatusItem label="Cancel" value={stats.cancel} color="text-zinc-400" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-[20px] border border-[#EAEAEA] shadow-sm flex flex-col">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-4">Grade Summary</span>
          <div className="grid grid-cols-3 gap-2">
            <StatusItem label="Grade A" value={stats.gradeA} color="text-orange-600" />
            <StatusItem label="Grade B" value={stats.gradeB} color="text-zinc-900" />
            <StatusItem label="Grade C" value={stats.gradeC} color="text-zinc-500" />
          </div>
        </div>

        <div className={`p-6 rounded-[20px] border flex flex-col justify-center transition-colors duration-300 ${stats.deadlinesToday > 0 ? 'bg-zinc-900 border-indigo-700 text-white shadow-sm border border-[#EAEAEA]' : 'bg-white border-[#EAEAEA] text-zinc-900'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${stats.deadlinesToday > 0 ? 'text-indigo-100' : 'text-zinc-400'}`}>Deadlines Today</span>
          <div className="text-3xl font-bold">{stats.deadlinesToday}</div>
          <p className={`text-[9px] font-bold mt-2 uppercase ${stats.deadlinesToday > 0 ? 'text-indigo-100' : 'text-zinc-400'}`}>
            {stats.deadlinesToday > 0 ? 'Inquiry due today' : 'No deadlines today'}
          </p>
        </div>

        <div className={`p-6 rounded-[20px] border flex flex-col justify-center transition-colors duration-300 ${stats.overdue > 0 ? 'bg-red-50 border-red-300 text-red-600 shadow-sm' : 'bg-white border-[#EAEAEA] text-zinc-900'}`}>
          <span className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Overdue Leads</span>
          <div className="text-3xl font-bold">{stats.overdue}</div>
          <p className="text-[9px] font-bold mt-2 uppercase opacity-60">
            {stats.overdue > 0 ? 'Past deadline items' : 'No overdue leads'}
          </p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-[#F8F9FA] p-4 rounded-[20px] flex flex-wrap items-center gap-4 border border-[#EAEAEA] shadow-inner">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider px-1">Status</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={filterSelectClass}>
            <option value="ALL">All Statuses</option>
            <option value="ON PROGRESS">ON PROGRESS</option>
            <option value="DONE">DONE</option>
            <option value="CANCEL">CANCEL</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider px-1">Grade</span>
          <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className={filterSelectClass}>
            <option value="ALL">All Grades</option>
            <option value="A">Grade A</option>
            <option value="B">Grade B</option>
            <option value="C">Grade C</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider px-1">Requester</span>
          <select value={filterRequester} onChange={e => setFilterRequester(e.target.value)} className={filterSelectClass}>
            <option value="ALL">All Requesters</option>
            {uniqueRequesters.map(req => <option key={req} value={req}>{req}</option>)}
          </select>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleSave} className="bg-white p-8 rounded-[20px] border border-[#EAEAEA] shadow-sm border border-[#EAEAEA] animate-in zoom-in duration-200 flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="md:col-span-2">
              <label className={labelClass}>Lead Name</label>
              <input type="text" required value={formData.lead_name} onChange={e => setFormData({...formData, lead_name: e.target.value})} className={inputClass} placeholder="Project title..." />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className={inputClass}>
                <option value="ON PROGRESS">ON PROGRESS</option>
                <option value="DONE">DONE</option>
                <option value="CANCEL">CANCEL</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Requester</label>
              <input type="text" required value={formData.requester} onChange={e => setFormData({...formData, requester: e.target.value})} className={inputClass} placeholder="Name/Dept" />
            </div>
            <div>
              <label className={labelClass}>Grade</label>
              <select value={formData.lead_grade} onChange={e => setFormData({...formData, lead_grade: e.target.value})} className={inputClass}>
                <option value="A">Grade A (High)</option>
                <option value="B">Grade B (Standard)</option>
                <option value="C">Grade C (Low)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Deadline</label>
              <input type="date" required value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} className={inputClass} />
            </div>
            <div className="md:col-span-3">
              <label className={labelClass}>Brief</label>
              <textarea value={formData.brief} onChange={e => setFormData({...formData, brief: e.target.value})} className={inputClass} rows={3} placeholder="Production scope..." />
            </div>
          </div>
          <div className="flex justify-end gap-4">
            <button type="button" onClick={resetForm} className="px-6 py-2.5 text-sm font-bold text-zinc-500 uppercase">Cancel</button>
            <button type="submit" className="px-8 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-bold shadow-md hover:bg-black transition-all uppercase tracking-wider">
              {editingId ? 'Update Lead' : 'Commit Lead'}
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-auto">
        {view === 'list' ? (
          <div className="space-y-4">
            {filteredLeads.length === 0 ? (
              <div className="p-20 text-center bg-white rounded-[20px] border-2 border-dashed border-[#EAEAEA] text-zinc-400 font-bold italic">No leads found.</div>
            ) : filteredLeads.map(l => (
              <div key={l.id} onClick={() => setSelectedLead(l)} className="bg-white p-6 rounded-[20px] border border-[#EAEAEA] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group cursor-pointer hover:shadow-md transition-all">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full border text-[8px] font-bold uppercase ${getStatusBadge(l.status)}`}>{l.status}</span>
                    <h3 className="text-lg font-bold text-zinc-900 truncate uppercase tracking-tight">{l.lead_name}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${l.lead_grade === 'A' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-zinc-800'}`}>Grade {l.lead_grade}</span>
                  </div>
                  <p className="text-xs font-bold text-zinc-500 uppercase">Req: <span className="text-zinc-900">{l.requester}</span> &bull; Deadline: <span className={`${l.deadline < new Date().toISOString().split('T')[0] && l.status !== 'DONE' ? 'text-red-600' : 'text-zinc-900'} font-bold`}>{l.deadline}</span></p>
                </div>
                <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => downloadPDF(e, l)} className="p-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors" title="PDF"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></button>
                  <button onClick={(e) => handleEdit(e, l)} className="p-2 bg-zinc-100 text-zinc-800 rounded-lg hover:bg-indigo-100 transition-colors" title="Edit"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
                  <button onClick={(e) => handleDelete(e, l.id)} className="p-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors" title="Delete"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div 
            onWheel={handleWheel}
            className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm overflow-hidden h-full flex flex-col animate-in fade-in duration-300"
          >
            <div className="p-4 border-b border-[#EAEAEA] bg-[#FCFCFC] flex items-center justify-between flex-shrink-0">
               <h3 className="font-bold text-zinc-900 text-sm uppercase tracking-wider">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
               <div className="flex gap-2">
                 <button onClick={() => navigateMonth(-1)} className="p-1.5 hover:bg-[#FAFAFA]300 rounded-lg transition-colors"><svg className="w-5 h-5 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg></button>
                 <button onClick={() => navigateMonth(1)} className="p-1.5 hover:bg-[#FAFAFA]300 rounded-lg transition-colors"><svg className="w-5 h-5 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg></button>
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
      </div>

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-[#1A1C20]/40" onClick={() => setSelectedLead(null)}>
          <div className="bg-white w-full max-w-lg rounded-[20px] shadow-2xl p-8 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase ${getStatusBadge(selectedLead.status)}`}>{selectedLead.status}</span>
                <h2 className="text-xl font-bold text-zinc-900 uppercase tracking-tight">{selectedLead.lead_name}</h2>
              </div>
              <button onClick={() => setSelectedLead(null)} className="p-1 text-zinc-400 hover:text-zinc-900"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-[10px] font-bold text-zinc-400 uppercase">Requester</span><p className="font-bold text-zinc-800 uppercase text-xs">{selectedLead.requester}</p></div>
                <div><span className="text-[10px] font-bold text-zinc-400 uppercase">Deadline</span><p className="font-bold text-red-600">{selectedLead.deadline}</p></div>
                <div><span className="text-[10px] font-bold text-zinc-400 uppercase">Grade</span><p className="font-bold text-zinc-900 uppercase text-xs">Grade {selectedLead.lead_grade}</p></div>
                <div><span className="text-[10px] font-bold text-zinc-400 uppercase">Ordered On</span><p className="font-bold text-zinc-800">{selectedLead.order_date}</p></div>
              </div>
              <div><span className="text-[10px] font-bold text-zinc-400 uppercase">Brief</span><div className="p-4 bg-[#FCFCFC] rounded-xl text-sm italic text-zinc-700 whitespace-pre-wrap border border-zinc-100">{selectedLead.brief || 'No brief provided.'}</div></div>
              {selectedLead.drive_link && (
                <div><span className="text-[10px] font-bold text-zinc-400 uppercase">Reference Artworks</span><a href={selectedLead.drive_link} target="_blank" rel="noreferrer" className="block p-3 bg-zinc-100 text-zinc-800 rounded-xl text-xs font-bold truncate hover:bg-indigo-100 transition-colors">{selectedLead.drive_link}</a></div>
              )}
            </div>
            <button onClick={() => setSelectedLead(null)} className="w-full mt-8 py-3 bg-[#1A1C20] text-white rounded-xl font-bold uppercase tracking-wider text-xs">Close Details</button>
          </div>
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

export default LeadMaster;
