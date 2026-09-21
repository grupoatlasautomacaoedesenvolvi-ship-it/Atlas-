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
    <div
      ref={containerRef}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      className={`relative inline-flex items-center ${className}`}
    >
      
      {/* Trigger Button or Custom Wrapper */}
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="inline-flex items-center text-[var(--atlas-text-muted)] hover:text-[var(--atlas-navy)] focus:outline-hidden focus:text-[var(--atlas-navy)] transition p-0.5 rounded-md cursor-pointer group"
        aria-label={`Informação Didática: ${title}`}
      >
        {children ? (
          children
        ) : (
          <IconComponent className="w-4 h-4 text-[var(--atlas-text-muted)] group-hover:text-[var(--atlas-navy)] transition" />
        )}
      </button>

      {/* Popover Tooltip Panel */}
      {isOpen && (
        <div
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          className={`absolute z-50 w-80 sm:w-96 p-5 text-white rounded-2xl shadow-2xl border border-white/10 text-xs space-y-4 animate-in fade-in zoom-in-95 duration-150 ${sideClasses[side]}`}
          style={{ backgroundColor: 'var(--atlas-navy-dark)', opacity: 1, pointerEvents: 'none' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="p-2 bg-white/10 rounded-lg text-[var(--atlas-accent)]">
                <Scale className="w-4 h-4 shrink-0" />
              </div>
              <h4 className="font-bold text-white leading-tight whitespace-normal break-words tracking-tight text-sm" style={{ fontFamily: 'var(--font-display)' }}>{title}</h4>
            </div>
            {badge && (
              <span className="atlas-pill atlas-pill-accent py-0.5 px-2 text-[9px] font-black shrink-0">
                {badge}
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-blue-100/70 leading-relaxed text-xs whitespace-normal break-words font-medium">
            {description}
          </p>

          {/* Examples if present */}
          {examples && examples.length > 0 && (
            <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-2">
              <span className="text-[10px] font-black text-blue-100/40 uppercase tracking-widest block">Exemplo Prático:</span>
              <ul className="space-y-1.5 text-xs text-blue-100/80">
                {examples.map((ex, idx) => (
                  <li key={idx} className="leading-tight flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-[var(--atlas-accent)] mt-1.5 shrink-0" />
                    <span>{ex}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Legal Reference */}
          {lawRef && (
            <div className="flex items-center space-x-2 text-[10px] text-[var(--atlas-accent)] font-bold uppercase tracking-widest pt-3 border-t border-white/10">
              <BookOpen className="w-3 h-3 shrink-0" />
              <span className="whitespace-normal break-words">Embasa: {lawRef}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
