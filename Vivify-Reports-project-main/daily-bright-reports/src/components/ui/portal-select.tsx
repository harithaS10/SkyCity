import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PortalSelectOption {
  value: string;
  label: string;
}

interface PortalSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: PortalSelectOption[];
  placeholder?: string;
  className?: string;
  id?: string;
}

export function PortalSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className,
  id,
}: PortalSelectProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Track if user is actively selecting an option — prevents scroll-close from firing
  const selectingRef = useRef(false);

  const selectedLabel = options.find(o => o.value === value)?.label ?? placeholder;

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const PADDING = 12;
    let left = rect.left;
    if (left + rect.width > viewportWidth - PADDING) {
      left = viewportWidth - PADDING - rect.width;
    }
    if (left < PADDING) left = PADDING;

    setDropdownStyle({
      position: 'fixed',
      left,
      top: rect.bottom + 4,
      width: rect.width,
      zIndex: 99999,
    });
  }, []);

  const handleOpen = () => {
    updatePosition();
    setOpen(prev => !prev);
  };

  // Close on outside click (but not when clicking inside dropdown)
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on scroll — but only if not actively selecting
  useEffect(() => {
    if (!open) return;
    const handleScroll = (e: Event) => {
      // Don't close if the scroll is inside the dropdown itself
      if (dropdownRef.current?.contains(e.target as Node)) return;
      if (selectingRef.current) return;
      setOpen(false);
    };
    const handleResize = () => setOpen(false);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open]);

  const handleOptionSelect = (optValue: string) => {
    selectingRef.current = true;
    onChange(optValue);
    setOpen(false);
    // Reset after a tick
    setTimeout(() => { selectingRef.current = false; }, 100);
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={handleOpen}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background transition-all duration-150',
          'hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          open && 'border-primary ring-2 ring-primary/20 ring-offset-0',
          className
        )}
      >
        <span className={cn('flex-1 truncate text-left', !value && 'text-muted-foreground')}>
          {selectedLabel}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180 text-primary'
          )}
        />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="overflow-hidden rounded-lg border border-border bg-white shadow-2xl animate-in fade-in-0 slide-in-from-top-1 duration-150"
        >
          <div className="max-h-[240px] overflow-y-auto">
            {options.map(opt => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  // Use onMouseDown so selection fires before any scroll/blur events
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent focus loss / scroll trigger
                    handleOptionSelect(opt.value);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors text-left',
                    'hover:bg-primary/10 hover:text-primary cursor-pointer',
                    isSelected
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-slate-700'
                  )}
                >
                  <span className="flex-1 truncate">{opt.label}</span>
                  {isSelected && (
                    <Check className="ml-2 h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
