'use client';

import { ReactNode } from 'react';

function cn(...classes: unknown[]): string {
  return classes.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}

export interface EmptyStateProps {
  /** Icon node — typically a Lucide icon or emoji string */
  icon?: ReactNode;
  /** Main heading */
  title: string;
  /** Supporting description */
  description?: string;
  /** Primary action button/node */
  action?: ReactNode;
  /** Secondary action button/node */
  secondaryAction?: ReactNode;
  /**
   * Layout variant:
   * - default  — centered, generous padding, large icon circle
   * - compact  — smaller padding, smaller icon, side-by-side optional
   * - bordered — surrounded by a dashed border card
   */
  variant?: 'default' | 'compact' | 'bordered';
  className?: string;
}

const variantWrapper: Record<NonNullable<EmptyStateProps['variant']>, string> = {
  default: 'flex flex-col items-center justify-center py-16 px-4 text-center',
  compact: 'flex flex-col items-center justify-center py-8 px-4 text-center',
  bordered:
    'flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-[var(--utop-border,theme(colors.gray.200))] rounded-2xl',
};

const variantIconWrap: Record<NonNullable<EmptyStateProps['variant']>, string> = {
  default: 'w-20 h-20 rounded-2xl flex items-center justify-center mb-5',
  compact: 'w-12 h-12 rounded-xl flex items-center justify-center mb-3',
  bordered: 'w-14 h-14 rounded-xl flex items-center justify-center mb-4',
};

export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const isCompact = variant === 'compact';

  return (
    <div className={cn(variantWrapper[variant], className)}>
      {icon && (
        <div
          className={cn(
            variantIconWrap[variant],
            'bg-[var(--utop-surface-2,theme(colors.gray.100))]',
            'text-[var(--utop-primary,#1F4FD8)]'
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}

      <h3
        className={cn(
          'font-bold text-[var(--utop-text-primary,theme(colors.gray.900))]',
          isCompact ? 'text-base mb-1' : 'text-xl mb-2'
        )}
      >
        {title}
      </h3>

      {description && (
        <p
          className={cn(
            'text-[var(--utop-text-secondary,theme(colors.gray.600))]',
            isCompact ? 'text-sm mb-4 max-w-xs' : 'text-base mb-6 max-w-md'
          )}
        >
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
