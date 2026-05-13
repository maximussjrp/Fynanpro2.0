'use client';

import { HTMLAttributes, forwardRef } from 'react';

function cn(...classes: unknown[]): string {
  return classes.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}

export type BadgeVariant = 'default' | 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[rgba(31,79,216,0.12)] text-[#1F4FD8] border-[rgba(31,79,216,0.18)]',
  neutral: 'bg-[var(--utop-surface-2)] text-[var(--utop-text-secondary)] border-[var(--utop-border)]',
  success: 'bg-[rgba(46,204,154,0.14)] text-[#0F8A66] border-[rgba(46,204,154,0.24)]',
  warning: 'bg-[rgba(245,158,11,0.16)] text-[#B45309] border-[rgba(245,158,11,0.28)]',
  danger: 'bg-[rgba(239,68,68,0.14)] text-[#B91C1C] border-[rgba(239,68,68,0.24)]',
  info: 'bg-[rgba(59,130,246,0.14)] text-[#2563EB] border-[rgba(59,130,246,0.24)]',
  outline: 'bg-transparent text-[var(--utop-text-secondary)] border-[var(--utop-border)]',
};

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant = 'default', ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none',
      variantClasses[variant],
      className
    )}
    {...props}
  />
));

Badge.displayName = 'Badge';

export default Badge;