import { useState, useRef, useEffect } from 'react';

interface Props {
  tooltip: { definition: string; why: string };
}

export function InfoTooltip({ tooltip }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<'bottom' | 'top'>('bottom');
  const iconRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    // If there's not enough room below (popup ~160px), show above
    setPosition(window.innerHeight - rect.bottom < 180 ? 'top' : 'bottom');
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        iconRef.current?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <span className="relative inline-flex" ref={iconRef}>
      <button
        type="button"
        className="text-brand/40 hover:text-brand/70 transition-colors cursor-help ml-0.5"
        aria-label="Metric definition"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div
          ref={popoverRef}
          className={`absolute z-50 w-64 bg-white border border-brand/15 rounded-lg shadow-lg p-3 text-left ${
            position === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
          } left-1/2 -translate-x-1/2`}
        >
          <p className="text-xs font-semibold text-brand mb-1">How it's calculated</p>
          <p className="text-xs text-brand/70 leading-relaxed">{tooltip.definition}</p>
          <p className="text-xs font-semibold text-brand mt-2 mb-1">Why it matters</p>
          <p className="text-xs text-brand/70 leading-relaxed">{tooltip.why}</p>
        </div>
      )}
    </span>
  );
}
