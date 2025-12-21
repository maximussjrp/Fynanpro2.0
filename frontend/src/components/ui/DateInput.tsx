'use client';

import { forwardRef, InputHTMLAttributes } from 'react';

// Helper function to merge classNames - accepts any falsy values
function cn(...classes: unknown[]): string {
  return classes.filter((c): c is string => typeof c === 'string' && c.length > 0).join(' ');
}

export interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Additional classes to merge with base styles */
  className?: string;
  /** Show error state */
  error?: boolean;
  /** Left icon/element */
  leftIcon?: React.ReactNode;
}

/**
 * DateInput component with standardized styling for UTOP
 * - Accessible (min 44px touch target)
 * - iOS Safari compatible (explicit colors, appearance-none)
 * - Mobile-friendly date picker
 * - Consistent focus ring
 */
const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, error, leftIcon, disabled, ...props }, ref) => {
    const baseClasses = cn(
      // Base styles - CRITICAL for iOS visibility
      'w-full px-4 py-3',
      'bg-white text-gray-900',
      'border rounded-xl',
      'transition-all duration-200',
      // Focus state
      'focus:outline-none focus:ring-2 focus:ring-[#1F4FD8] focus:ring-offset-1 focus:border-[#1F4FD8]',
      // Touch target
      'min-h-[44px]',
      // Font
      'text-sm font-normal',
      // iOS Safari fixes
      'appearance-none',
      '[color-scheme:light]',
      // Conditional: error state
      error
        ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
        : 'border-gray-300',
      // Conditional: disabled state
      disabled && 'bg-gray-100 text-gray-500 cursor-not-allowed opacity-75',
      // Conditional: with icon
      leftIcon && 'pl-12',
      // Extra classes
      className
    );

    // Additional inline styles for cross-browser date input compatibility
    const dateStyles: React.CSSProperties = {
      colorScheme: 'light',
      WebkitAppearance: 'none',
      MozAppearance: 'none',
    };

    if (leftIcon) {
      return (
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {leftIcon}
          </div>
          <input
            ref={ref}
            type="date"
            disabled={disabled}
            className={baseClasses}
            style={dateStyles}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        ref={ref}
        type="date"
        disabled={disabled}
        className={baseClasses}
        style={dateStyles}
        {...props}
      />
    );
  }
);

DateInput.displayName = 'DateInput';

export default DateInput;
