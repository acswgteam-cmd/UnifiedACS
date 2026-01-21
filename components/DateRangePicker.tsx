
import React, { useState, useRef, useEffect, useMemo } from 'react';

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface Props {
  onChange: (start: string, end: string) => void;
  onReset: () => void;
}

const DateRangePicker: React.FC<Props> = ({ onChange, onReset }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [viewDate, setViewDate] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  const formatDate = (date: Date) => date.toISOString().split('T')[0];
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
    if (!range.start || (range.start && range.end)) {
      setRange({ start: day, end: null });
    } else if (range.start && !range.end) {
      if (day < range.start) {
        setRange({ start: day, end: range.start });
        onChange(formatDate(day), formatDate(range.start));
      } else {
        setRange({ ...range, end: day });
        onChange(formatDate(range.start), formatDate(day));
      }
      setIsOpen(false);
    }
  };

  const applyPreset = (preset: string) => {
    const now = new Date();
    // Clone dates to avoid mutation issues
    let start = new Date(now);
    let end = new Date(now);

    switch (preset) {
      case 'today':
        // Start and End are already 'now'
        break;
      case 'yesterday':
        start.setDate(now.getDate() - 1);
        end.setDate(now.getDate() - 1);
        break;
      case 'this-week':
        const day = now.getDay(); // 0 (Sun) to 6 (Sat)
        // Adjust to make Monday (1) the first day
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
        // end remains today
        break;
      case 'last-month':
        start.setMonth(now.getMonth() - 1);
        // end remains today
        break;
      case 'last-quarter':
        start.setMonth(now.getMonth() - 3);
        break;
    }
    
    setRange({ start, end });
    onChange(formatDate(start), formatDate(end));
    setIsOpen(false);
    // Update view to start date
    setViewDate(new Date(start));
  };

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Monday start
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
    <div className="relative" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border border-blue-200 px-3 py-1.5 rounded-lg shadow-sm hover:border-blue-400 transition-all min-w-[200px]"
      >
        <span className="text-xs font-black text-slate-700">
          {range.start ? `${displayDate(range.start)} – ${displayDate(range.end)}` : 'Select Date Range'}
        </span>
        <svg className={`w-3.5 h-3.5 ml-auto text-blue-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 z-50 flex gap-6 min-w-[480px] animate-in fade-in zoom-in-95 duration-200">
          {/* Presets Sidebar */}
          <div className="w-28 flex flex-col gap-1.5 border-r border-slate-100 pr-4">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Current</span>
            {['today', 'this-week', 'this-month', 'this-year'].map((p) => (
              <button 
                key={p} 
                onClick={() => applyPreset(p)}
                className="text-left text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors capitalize py-1 px-2 rounded hover:bg-slate-50"
              >
                {p.replace('-', ' ')}
              </button>
            ))}
            <div className="h-px bg-slate-100 my-1"></div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">History</span>
             {['yesterday', 'last-week', 'last-month', 'last-quarter'].map((p) => (
              <button 
                key={p} 
                onClick={() => applyPreset(p)}
                className="text-left text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors capitalize py-1 px-2 rounded hover:bg-slate-50"
              >
                {p.replace('-', ' ')}
              </button>
            ))}

            <button 
              onClick={() => { setRange({ start: null, end: null }); onReset(); setIsOpen(false); }}
              className="mt-auto text-left text-xs font-black text-blue-500 hover:text-blue-700 transition-colors pt-2"
            >
              Reset Filter
            </button>
          </div>

          {/* Calendar */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-sm font-black text-slate-800">
                {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h4>
              <div className="flex gap-3">
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="text-slate-400 hover:text-slate-900">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="text-slate-400 hover:text-slate-900">
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
                    {/* Range Background */}
                    {rangeActive && (
                      <div className="absolute inset-y-0.5 inset-x-0 bg-blue-50"></div>
                    )}
                    {isStartActive && range.end && (
                      <div className="absolute inset-y-0.5 right-0 left-1/2 bg-blue-50"></div>
                    )}
                    {isEndActive && (
                      <div className="absolute inset-y-0.5 left-0 right-1/2 bg-blue-50"></div>
                    )}

                    <button 
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
