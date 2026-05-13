'use client';

import { HTMLAttributes, ReactNode } from 'react';

function cn(...classes: unknown[]): string {
  return classes.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}

export interface FormFieldProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
}

export default function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
  ...props
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-sm font-semibold text-[var(--utop-text-primary)]">
          <span>{label}</span>
          {required ? <span className="ml-1 text-[#EF4444]">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-sm text-[#EF4444]">{error}</p>
      ) : hint ? (
        <p className="text-sm text-[var(--utop-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}