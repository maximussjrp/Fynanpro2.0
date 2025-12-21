'use client';

import { forwardRef, InputHTMLAttributes } from 'react';

// Helper function to merge classNames - accepts any falsy values
function cn(...classes: unknown[]): string {
  return classes.filter((c): c is string => typeof c === 'string' && c.length > 0).join(' ');
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Additional classes to merge with base styles */
  className?: string;
  /** Show error state */
  error?: boolean;
  /** Left icon/element */
  leftIcon?: React.ReactNode;
  /** Right icon/element */
  rightIcon?: React.ReactNode;
}

/**
 * Input component with standardized styling for UTOP
 * - Accessible (min 44px touch target)
 * - Mobile-friendly (explicit text color, visible placeholder)
 * - Consistent focus ring
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, leftIcon, rightIcon, disabled, ...props }, ref) => {
    const baseClasses = cn(
      // Base styles
      'w-full px-4 py-3',
      'bg-white text-gray-900',
      'placeholder:text-gray-400',
      'border rounded-xl',
      'transition-all duration-200',
      // Focus state
      'focus:outline-none focus:ring-2 focus:ring-[#1F4FD8] focus:ring-offset-1 focus:border-[#1F4FD8]',
      // Touch target
      'min-h-[44px]',
      // Font
      'text-sm font-normal',
      // Conditional: error state
      error
        ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
        : 'border-gray-300',
      // Conditional: disabled state
      disabled && 'bg-gray-100 text-gray-500 cursor-not-allowed opacity-75',
      // Conditional: with icons
      leftIcon && 'pl-12',
      rightIcon && 'pr-12',
      // Extra classes
      className
    );

    if (leftIcon || rightIcon) {
      return (
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            disabled={disabled}
            className={baseClasses}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        disabled={disabled}
        className={baseClasses}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export default Input;
