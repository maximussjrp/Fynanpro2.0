'use client';

import { forwardRef, TextareaHTMLAttributes } from 'react';

function cn(...classes: unknown[]): string {
  return classes.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
  error?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, disabled, ...props }, ref) => {
    const baseClasses = cn(
      'w-full px-4 py-3',
      'bg-white text-gray-900 placeholder:text-gray-400',
      'border rounded-xl resize-y',
      'transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-[#1F4FD8] focus:ring-offset-1 focus:border-[#1F4FD8]',
      'min-h-[96px] text-sm font-normal',
      error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300',
      disabled && 'bg-gray-100 text-gray-500 cursor-not-allowed opacity-75',
      className
    );

    return <textarea ref={ref} disabled={disabled} className={baseClasses} {...props} />;
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;