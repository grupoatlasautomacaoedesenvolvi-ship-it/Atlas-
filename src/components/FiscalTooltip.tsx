import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info, BookOpen, ExternalLink, X, Scale } from 'lucide-react';

export interface FiscalTooltipProps {
  title: string;
  description: string;
  lawRef?: string;
  examples?: string[];
  badge?: string;
  iconType?: 'help' | 'info' | 'book';
  children?: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function FiscalTooltip({
  title,
  description,
  lawRef,
  examples,
  badge,
  iconType = 'help',
  children,
  side = 'top',
  className = ''
}: FiscalTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const IconComponent = iconType === 'book' ? BookOpen : iconType === 'info' ? Info : HelpCircle;

  // Positioning classes
  const sideClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2'
  };

  return (
    <div ref={containerRef} className={`relative inline-flex items-center ${className}`}>
      
      {/* Trigger Button or Custom Wrapper */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        className="inline-flex items-center text-slate-400 hover:text-[#1e3a5f] focus:outline-hidden focus:text-[#1e3a5f] transition p-0.5 rounded-md cursor-pointer group"
        aria-label={`Informação Didática: ${title}`}
      >
        {children ? (
          children
        ) : (
          <IconComponent className="w-4 h-4 text-slate-400 group-hover:text-[#1e3a5f] transition" />
        )}
      </button>

      {/* Popover Tooltip Panel */}
      {isOpen && (
        <div
          onMouseLeave={() => setIsOpen(false)}
          className={`absolute z-50 w-72 sm:w-80 p-4 bg-slate-900 text-white rounded-lg shadow-sm border border-slate-700 text-xs space-y-2.5 animate-in fade-in zoom-in-95 duration-150 ${sideClasses[side]}`}
          style={{ pointerEvents: 'auto' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <Scale className="w-4 h-4 text-sky-400 shrink-0" />
              <h4 className="font-bold text-white leading-tight">{title}</h4>
            </div>
            {badge && (
              <span className="bg-[#1e3a5f]/40 text-sky-200 border border-[#1e3a5f] text-[10px] font-mono px-2 py-0.5 rounded-md shrink-0">
                {badge}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="text-slate-400 hover:text-white transition p-0.5 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Description */}
          <p className="text-slate-300 leading-relaxed text-[11px]">
            {description}
          </p>

          {/* Examples if present */}
          {examples && examples.length > 0 && (
            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Exemplo Prático:</span>
              <ul className="list-disc list-inside space-y-0.5 text-[10px] text-slate-300">
                {examples.map((ex, idx) => (
                  <li key={idx} className="leading-tight">{ex}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Legal Reference */}
          {lawRef && (
            <div className="flex items-center space-x-1.5 text-[10px] text-sky-300 font-mono pt-1 border-t border-slate-800">
              <BookOpen className="w-3 h-3 text-sky-400 shrink-0" />
              <span className="truncate">Embasa: {lawRef}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
