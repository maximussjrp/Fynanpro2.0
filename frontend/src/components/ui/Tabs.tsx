'use client';

import { ReactNode } from 'react';

function cn(...classes: unknown[]): string {
  return classes.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}

export interface TabItem {
  /** Unique identifier for the tab */
  id: string;
  /** Label shown in the tab button */
  label: string;
  /** Optional icon rendered before the label */
  icon?: ReactNode;
  /** Disables the tab when true */
  disabled?: boolean;
}

export interface TabsProps {
  /** Array of tab definitions */
  tabs: TabItem[];
  /** Currently active tab id (controlled) */
  activeTab: string;
  /** Called when the user selects a tab */
  onChange: (id: string) => void;
  /**
   * Visual variant:
   * - default    — filled pill for active tab, contained in a surface bar
   * - segmented  — segmented control (iOS-style), all tabs same width
   * - underline  — flat list with underline indicator (classic)
   */
  variant?: 'default' | 'segmented' | 'underline';
  /** Size variant */
  size?: 'sm' | 'md';
  className?: string;
}

export default function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = 'default',
  size = 'md',
  className,
}: TabsProps) {
  const isSm = size === 'sm';

  /* ── default / segmented ── */
  if (variant === 'default' || variant === 'segmented') {
    const isSegmented = variant === 'segmented';
    return (
      <div
        role="tablist"
        aria-label="Tabs"
        className={cn(
          'flex p-1 rounded-xl gap-1',
          'bg-[var(--utop-surface-2,theme(colors.gray.100))]',
          isSegmented && 'grid grid-cols-[repeat(var(--tab-count),1fr)]',
          className
        )}
        style={isSegmented ? ({ '--tab-count': tabs.length } as React.CSSProperties) : undefined}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-disabled={tab.disabled}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && onChange(tab.id)}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--utop-primary,#1F4FD8)] focus-visible:ring-offset-1',
                isSm ? 'px-3 py-1.5 text-sm min-h-[34px]' : 'px-4 py-2 text-sm min-h-[38px]',
                isActive
                  ? [
                      'bg-[var(--utop-primary,#1F4FD8)] text-white shadow-sm',
                    ]
                  : [
                      'text-[var(--utop-text-secondary,theme(colors.gray.600))]',
                      'hover:text-[var(--utop-text-primary,theme(colors.gray.900))]',
                      'hover:bg-[var(--utop-surface,theme(colors.white))]/60',
                    ],
                tab.disabled && 'opacity-40 cursor-not-allowed',
                isSegmented && 'flex-1'
              )}
            >
              {tab.icon && (
                <span aria-hidden="true" className="shrink-0">
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  /* ── underline ── */
  return (
    <div
      role="tablist"
      aria-label="Tabs"
      className={cn('flex gap-0 border-b border-[var(--utop-border,theme(colors.gray.200))]', className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-disabled={tab.disabled}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 border-b-2 font-medium transition-colors whitespace-nowrap',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--utop-primary,#1F4FD8)]',
              isSm ? 'px-3 py-2.5 text-sm min-h-[40px]' : 'px-4 py-3.5 text-sm min-h-[44px]',
              isActive
                ? 'border-[var(--utop-primary,#1F4FD8)] text-[var(--utop-primary,#1F4FD8)]'
                : [
                    'border-transparent',
                    'text-[var(--utop-text-secondary,theme(colors.gray.500))]',
                    'hover:text-[var(--utop-text-primary,theme(colors.gray.900))]',
                    'hover:border-[var(--utop-border,theme(colors.gray.300))]',
                  ],
              tab.disabled && 'opacity-40 cursor-not-allowed'
            )}
          >
            {tab.icon && (
              <span aria-hidden="true" className="shrink-0">
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
