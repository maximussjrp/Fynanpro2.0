'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

function cn(...classes: unknown[]): string {
  return classes.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--utop-primary)] text-white border border-transparent hover:bg-[var(--utop-primary-hover)] focus:ring-[var(--utop-primary)] shadow-sm',
  secondary:
    'bg-[var(--utop-surface)] text-[var(--utop-text-primary)] border border-[var(--utop-border)] hover:bg-[var(--utop-surface-2)] focus:ring-[var(--utop-primary)]',
  ghost:
    'bg-transparent text-[var(--utop-text-secondary)] border border-transparent hover:bg-[var(--utop-surface-2)] focus:ring-[var(--utop-primary)]',
  danger:
    'bg-[#EF4444] text-white border border-transparent hover:bg-[#DC2626] focus:ring-[#EF4444]',
  warning:
    'bg-[#F59E0B] text-white border border-transparent hover:bg-[#D97706] focus:ring-[#F59E0B]',
  success:
    'bg-[var(--utop-success-accent)] text-white border border-transparent hover:opacity-95 focus:ring-[var(--utop-success-accent)]',
  icon:
    'bg-transparent text-[var(--utop-text-secondary)] border border-transparent hover:bg-[var(--utop-surface-2)] focus:ring-[var(--utop-primary)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-sm min-h-[36px]',
  md: 'px-4 py-2.5 text-sm min-h-[44px]',
  lg: 'px-5 py-3 text-base min-h-[48px]',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, leftIcon, rightIcon, disabled, children, type = 'button', ...props }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          variant === 'icon' && 'px-0',
          className
        )}
        {...props}
      >
        {loading ? (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        ) : leftIcon ? (
          <span aria-hidden="true" className="shrink-0">
            {leftIcon}
          </span>
        ) : null}
        <span className={variant === 'icon' ? 'sr-only' : undefined}>{children}</span>
        {!loading && rightIcon ? (
          <span aria-hidden="true" className="shrink-0">
            {rightIcon}
          </span>
        ) : null}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;