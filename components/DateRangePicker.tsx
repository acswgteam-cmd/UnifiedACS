
import React, { useState, useRef, useEffect, useMemo } from 'react';

interface Props {
  startDate?: string;
  endDate?: string;
  onChange: (start: string, end: string) => void;
  onReset?: () => void;
  className?: string;
  placeholder?: string;
  showPresets?: boolean;
}

const DateRangePicker: React.FC<Props> = ({ 
  startDate, 
  endDate, 
  onChange, 
  onReset, 
  className, 
  placeholder,
  showPresets = true 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Derived state from props
  const range = useMemo(() => ({
    start: startDate ? new Date(startDate) : null,
    end: endDate ? new Date(endDate) : null
  }), [startDate, endDate]);

  const formatDate = (date: Date) => {
    // Ensure we use local time for the date string to avoid timezone shifts
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };
  
  const displayDate = (date: Date | null) => 
    date ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '...';

  // Handle outside clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDayClick = (day: Date) => {
    // Normalize time to 00:00:00 to ensure strict date comparison
    const clicked = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    
    let newStart = range.start;
    let newEnd = range.end;

    // Case 1: Start fresh if we already have a range
    if (newStart && newEnd) {
      newStart = clicked;
      newEnd = null;
      onChange(formatDate(newStart), "");
      return;
    }

    // Case 2: No start date yet
    if (!newStart) {
      newStart = clicked;
      onChange(formatDate(newStart), "");
      return;
    }

    // Case 3: We have a start date, picking end date
    if (clicked < newStart) {
      // If clicked before start, make it the new start
      newStart = clicked;
      newEnd = null; // Clear end because user might want to pick a new range
      onChange(formatDate(newStart), "");
    } else {
      // Valid end date
      newEnd = clicked;
      onChange(formatDate(newStart), formatDate(newEnd));
      setIsOpen(false); // Close on selection complete
    }
  };

  const applyPreset = (preset: string) => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    switch (preset) {
      case 'today': break;
      case 'yesterday':
        start.setDate(now.getDate() - 1);
        end.setDate(now.getDate() - 1);
        break;
      case 'this-week':
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(now.setDate(diff));
        end = new Date(now.setDate(start.getDate() + 6));
        break;
      case 'this-month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last-month':
        start.setMonth(now.getMonth() - 1);
        start.setDate(1);
        end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        break;
    }
    
    onChange(formatDate(start), formatDate(end));
    setIsOpen(false);
    setViewDate(new Date(start));
  };

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const days = [];

    // Previous month days
    for (let i = startOffset; i > 0; i--) {
      days.push({ date: new Date(year, month - 1, prevMonthLastDay - i + 1), current: false });
    }
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), current: true });
    }
    // Next month days to fill grid (42 cells total usually covers all months)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), current: false });
    }
    return days;
  }, [viewDate]);

  // Helpers for styling
  const isSameDay = (d1: Date | null, d2: Date) => d1 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  const isStart = (d: Date) => isSameDay(range.start, d);
  const isEnd = (d: Date) => isSameDay(range.end, d);
  const isBetween = (d: Date) => range.start && range.end && d > range.start && d < range.end;

  return (
    <div className={`relative ${className || ''}`} ref={containerRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={className ? 
          `w-full h-full flex items-center justify-between px-3 text-left outline-none transition-all ${range.start ? 'text-slate-900 font-bold' : 'text-slate-400 font-semibold'}` : 
          "flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm hover:border-slate-400 transition-all min-w-[200px]"
        }
      >
        <span className={className ? "truncate" : "text-xs font-black text-slate-700"}>
          {range.start ? `${displayDate(range.start)} – ${displayDate(range.end)}` : (placeholder || 'Select Date Range')}
        </span>
        <svg className={`w-4 h-4 ml-1 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${className ? 'text-slate-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute top-full right-0 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 z-50 flex gap-6 animate-in fade-in zoom-in-95 duration-200 origin-top-right ${showPresets ? 'min-w-[480px]' : 'min-w-[320px]'}`}>
          
          {/* Sidebar Presets */}
          {showPresets && (
            <div className="w-28 flex flex-col gap-1.5 border-r border-slate-100 pr-4">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Presets</span>
              {['today', 'this-week', 'this-month', 'last-month'].map((p) => (
                <button 
                  key={p} 
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="text-left text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors capitalize py-1.5 px-2 rounded-lg hover:bg-slate-50"
                >
                  {p.replace('-', ' ')}
                </button>
              ))}
              {onReset && (
                <button 
                  type="button"
                  onClick={() => { onChange("", ""); onReset(); setIsOpen(false); }}
                  className="mt-auto text-left text-xs font-black text-slate-400 hover:text-slate-600 transition-colors pt-2 px-2"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {/* Calendar Area */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h4>
              <div className="flex gap-1">
                <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 mb-2">
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">{d}</div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-y-1">
              {calendarDays.map((d, idx) => {
                const start = isStart(d.date);
                const end = isEnd(d.date);
                const middle = isBetween(d.date);
                const valid = d.current; // only visually deemphasize non-current month, but still clickable

                return (
                  <div key={idx} className="relative h-9 w-full flex items-center justify-center">
                    {/* Range Background Connector */}
                    {(middle || (start && range.end) || (end && range.start)) && (
                      <div 
                        className={`absolute inset-y-0 bg-indigo-50 
                          ${start ? 'left-1/2 right-0 rounded-l-none' : ''} 
                          ${end ? 'left-0 right-1/2 rounded-r-none' : ''}
                          ${middle ? 'left-0 right-0' : ''}
                        `}
                      ></div>
                    )}

                    <button 
                      type="button"
                      onClick={() => handleDayClick(d.date)}
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                        ${start || end ? 'bg-slate-900 text-white shadow-md scale-105' : ''}
                        ${!start && !end && middle ? 'text-indigo-700 bg-indigo-50' : ''}
                        ${!start && !end && !middle ? 'hover:bg-slate-100 text-slate-700' : ''}
                        ${!valid && !start && !end && !middle ? 'opacity-30' : ''}
                      `}
                    >
                      {d.date.getDate()}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
