import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  className?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  value,
  onChange,
  options,
  className = '',
  disabled = false,
  required = false,
  placeholder = 'Select...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        (!portalRef.current || !portalRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update coords when open
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;

    const updateCoords = () => {
      if (dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    };

    updateCoords();

    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);

    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = (val: string) => {
    if (disabled) return;
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div
      ref={dropdownRef}
      className={`relative inline-block w-full text-left ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
    >
      <button
        type="button"
        onClick={() => {
          if (!isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            setCoords({
              top: rect.bottom + window.scrollY,
              left: rect.left + window.scrollX,
              width: rect.width,
            });
          }
          setIsOpen(!isOpen);
        }}
        disabled={disabled}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs md:text-sm font-bold border rounded-lg bg-[var(--s1)] border-[var(--hl-2)] text-[var(--ink)] hover:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-focus)] transition-all cursor-pointer select-none"
        style={{ minHeight: '38px' }}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <svg
          className={`w-3.5 h-3.5 text-[var(--ink-3)] transition-transform duration-250 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && createPortal(
        <div
          ref={portalRef}
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 999999,
          }}
          className="rounded-lg border border-[var(--hl-2)] bg-[var(--s1)] shadow-dropdown overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-150 max-h-60 overflow-y-auto"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2.5 text-[10px] md:text-xs font-semibold text-[var(--ink-4)] italic select-none">
              No options available
            </div>
          ) : (
            options.map(opt => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left px-3 py-2 text-[10px] md:text-xs font-bold transition-all duration-75 flex items-center justify-between cursor-pointer select-none
                    ${isSelected 
                      ? 'bg-[var(--primary-dim)] text-[var(--primary)]' 
                      : 'text-[var(--ink)] hover:bg-[var(--primary-dim)] hover:text-[var(--primary)]'
                    }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 text-[var(--primary)] shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

