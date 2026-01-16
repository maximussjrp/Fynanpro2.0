/**
 * Utility function to merge CSS class names.
 * Simple implementation without external dependencies.
 * 
 * @example
 * cn('bg-red-500', 'bg-blue-500') // returns 'bg-red-500 bg-blue-500'
 * cn('p-4', isActive && 'bg-blue-500') // conditionally applies bg-blue-500
 */
export function cn(...inputs: (string | boolean | undefined | null)[]): string {
  return inputs
    .filter((value): value is string => Boolean(value) && typeof value === 'string')
    .join(' ')
    .trim();
}
