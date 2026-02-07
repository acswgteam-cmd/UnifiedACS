
import React, { useState, useRef, useEffect, useMemo } from 'react';

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface Props {
  startDate?: string;
  endDate?: string;
  onChange: (start: string, end: string) => void;
  onReset?: () => void;
  className?: string;
  placeholder?: string;
}

const DateRangePicker: React.FC<Props> = ({ startDate, endDate, onChange, onReset, className, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Derived state from props if controlled
  const range = useMemo(() => ({
    start: startDate ? new Date(startDate) : null,
    end: endDate ? new Date(endDate) : null
  }), [startDate, endDate]);

  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  
  // Format for display: "01 Jan 24"
  const displayDate = (date: Date | null) => date ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '...';

  // Handle outside clicks to close
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
    let newStart = range.start;
    let newEnd = range.end;

    if (!newStart || (newStart && newEnd)) {
      // Start new selection
      newStart = day;
      newEnd = null;
      onChange(formatDate(newStart), ""); // Clear end
    } else if (newStart && !newEnd) {
      // Complete selection
      if (day < newStart) {
        newEnd = newStart;
        newStart = day;
      } else {
        newEnd = day;
      }
      onChange(formatDate(newStart), formatDate(newEnd));
      setIsOpen(false);
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
      case 'this-year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case 'last-week':
        start.setDate(now.getDate() - 7);
        break;
      case 'last-month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'last-quarter':
        start.setMonth(now.getMonth() - 3);
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

    for (let i = startOffset; i > 0; i--) {
      days.push({ date: new Date(year, month - 1, prevMonthLastDay - i + 1), current: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), current: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), current: false });
    }
    return days;
  }, [viewDate]);

  const isSelected = (d: Date) => range.start && d.getTime() === range.start.getTime();
  const isEnd = (d: Date) => range.end && d.getTime() === range.end.getTime();
  const isInRange = (d: Date) => range.start && range.end && d > range.start && d < range.end;

  return (
    <div className={`relative ${className || ''}`} ref={containerRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={className ? 
          `w-full h-full flex items-center justify-between px-3 text-left outline-none transition-all ${range.start ? 'text-slate-900 font-bold' : 'text-slate-400 font-semibold'}` : 
          "flex items-center gap-2 bg-white border border-blue-200 px-3 py-1.5 rounded-lg shadow-sm hover:border-blue-400 transition-all min-w-[200px]"
        }
      >
        <span className={className ? "truncate" : "text-xs font-black text-slate-700"}>
          {range.start ? `${displayDate(range.start)} – ${displayDate(range.end)}` : (placeholder || 'Select Date Range')}
        </span>
        <svg className={`w-3.5 h-3.5 ml-1 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${className ? 'text-slate-400' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 z-50 flex gap-6 min-w-[480px] animate-in fade-in zoom-in-95 duration-200">
          <div className="w-28 flex flex-col gap-1.5 border-r border-slate-100 pr-4">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Presets</span>
            {['today', 'this-week', 'this-month', 'last-month'].map((p) => (
              <button 
                key={p} 
                type="button"
                onClick={() => applyPreset(p)}
                className="text-left text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors capitalize py-1 px-2 rounded hover:bg-slate-50"
              >
                {p.replace('-', ' ')}
              </button>
            ))}
            {onReset && (
              <button 
                type="button"
                onClick={() => { onChange("", ""); onReset(); setIsOpen(false); }}
                className="mt-auto text-left text-xs font-black text-blue-500 hover:text-blue-700 transition-colors pt-2"
              >
                Reset
              </button>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-sm font-black text-slate-800">
                {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h4>
              <div className="flex gap-3">
                <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="text-slate-400 hover:text-slate-900">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="text-slate-400 hover:text-slate-900">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-y-0.5">
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-400 pb-2">{d}</div>
              ))}
              {calendarDays.map((d, idx) => {
                const isStartActive = isSelected(d.date);
                const isEndActive = isEnd(d.date);
                const rangeActive = isInRange(d.date);
                
                return (
                  <div key={idx} className="relative py-0.5 flex justify-center items-center">
                    {rangeActive && <div className="absolute inset-y-0.5 inset-x-0 bg-blue-50"></div>}
                    {isStartActive && range.end && <div className="absolute inset-y-0.5 right-0 left-1/2 bg-blue-50"></div>}
                    {isEndActive && <div className="absolute inset-y-0.5 left-0 right-1/2 bg-blue-50"></div>}

                    <button 
                      type="button"
                      onClick={() => handleDayClick(d.date)}
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all
                        ${d.current ? 'text-slate-700' : 'text-slate-300'}
                        ${(isStartActive || isEndActive) ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'hover:bg-slate-100'}
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
