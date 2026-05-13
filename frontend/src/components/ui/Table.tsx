'use client';

import { HTMLAttributes, TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes, forwardRef } from 'react';

function cn(...classes: unknown[]): string {
  return classes.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}

export interface TableContainerProps extends HTMLAttributes<HTMLDivElement> {}

export const TableContainer = forwardRef<HTMLDivElement, TableContainerProps>(({ className, ...props }, ref) => {
  return <div ref={ref} className={cn('relative w-full overflow-x-auto', className)} {...props} />;
});
TableContainer.displayName = 'TableContainer';

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {}

export const Table = forwardRef<HTMLTableElement, TableProps>(({ className, ...props }, ref) => {
  return <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />;
});
Table.displayName = 'Table';

export interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {}

export const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(({ className, ...props }, ref) => {
  return <thead ref={ref} className={cn('[&_tr]:border-b [&_tr]:border-[var(--utop-border,theme(colors.gray.200))]', className)} {...props} />;
});
TableHeader.displayName = 'TableHeader';

export interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {}

export const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(({ className, ...props }, ref) => {
  return <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
});
TableBody.displayName = 'TableBody';

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  hover?: boolean;
}

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(({ className, hover = false, ...props }, ref) => {
  return (
    <tr
      ref={ref}
      className={cn(
        'border-b border-[var(--utop-border,theme(colors.gray.200))] transition-colors',
        hover && 'hover:bg-[var(--utop-surface-2,theme(colors.gray.50))]',
        className
      )}
      {...props}
    />
  );
});
TableRow.displayName = 'TableRow';

export interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {}

export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(({ className, ...props }, ref) => {
  return (
    <th
      ref={ref}
      className={cn(
        'h-10 px-2 py-2 text-left align-middle font-medium uppercase tracking-wider text-xs',
        'text-[var(--utop-text-secondary,theme(colors.gray.500))]',
        className
      )}
      {...props}
    />
  );
});
TableHead.displayName = 'TableHead';

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {}

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(({ className, ...props }, ref) => {
  return <td ref={ref} className={cn('px-2 py-3 align-middle', className)} {...props} />;
});
TableCell.displayName = 'TableCell';

export interface TableCaptionProps extends HTMLAttributes<HTMLTableCaptionElement> {}

export const TableCaption = forwardRef<HTMLTableCaptionElement, TableCaptionProps>(({ className, ...props }, ref) => {
  return (
    <caption
      ref={ref}
      className={cn('mt-4 text-sm text-[var(--utop-text-muted,theme(colors.gray.500))]', className)}
      {...props}
    />
  );
});
TableCaption.displayName = 'TableCaption';

export interface TableEmptyProps extends HTMLAttributes<HTMLTableCellElement> {
  colSpan: number;
}

export const TableEmpty = forwardRef<HTMLTableCellElement, TableEmptyProps>(({ className, colSpan, ...props }, ref) => {
  return (
    <td
      ref={ref}
      colSpan={colSpan}
      className={cn('px-4 py-8 text-center text-[var(--utop-text-muted,theme(colors.gray.500))]', className)}
      {...props}
    />
  );
});
TableEmpty.displayName = 'TableEmpty';

export interface TableLoadingProps extends HTMLAttributes<HTMLTableCellElement> {
  colSpan: number;
  label?: string;
}

export const TableLoading = forwardRef<HTMLTableCellElement, TableLoadingProps>(
  ({ className, colSpan, label = 'Carregando...', ...props }, ref) => {
    return (
      <td ref={ref} colSpan={colSpan} className={cn('px-4 py-8 text-center', className)} {...props}>
        <div className="inline-flex items-center gap-2 text-[var(--utop-text-muted,theme(colors.gray.500))]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          <span>{label}</span>
        </div>
      </td>
    );
  }
);
TableLoading.displayName = 'TableLoading';
