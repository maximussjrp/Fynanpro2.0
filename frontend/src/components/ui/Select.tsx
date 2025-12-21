'use client';

import { forwardRef, SelectHTMLAttributes } from 'react';

// Helper function to merge classNames - accepts any falsy values
function cn(...classes: unknown[]): string {
  return classes.filter((c): c is string => typeof c === 'string' && c.length > 0).join(' ');
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Additional classes to merge with base styles */
  className?: string;
  /** Show error state */
  error?: boolean;
  /** Left icon/element */
  leftIcon?: React.ReactNode;
}

/**
 * Select component with standardized styling for UTOP
 * - Accessible (min 44px touch target)
 * - Mobile-friendly (explicit text color, visible options)
 * - Consistent focus ring
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, leftIcon, disabled, children, ...props }, ref) => {
    const baseClasses = cn(
      // Base styles
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
      // Appearance - show native dropdown arrow
      'appearance-none cursor-pointer',
      // Custom arrow via background
      'bg-no-repeat bg-right',
      'pr-10',
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

    // Custom dropdown arrow SVG
    const arrowStyle = {
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
      backgroundPosition: 'right 12px center',
      backgroundSize: '20px',
    };

    if (leftIcon) {
      return (
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {leftIcon}
          </div>
          <select
            ref={ref}
            disabled={disabled}
            className={baseClasses}
            style={arrowStyle}
            {...props}
          >
            {children}
          </select>
        </div>
      );
    }

    return (
      <select
        ref={ref}
        disabled={disabled}
        className={baseClasses}
        style={arrowStyle}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';

export default Select;
