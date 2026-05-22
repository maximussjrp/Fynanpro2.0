export interface TransactionTableItem {
  id: string;
  amount: string;
  description: string;
  status: string;
  type: 'income' | 'expense' | 'transfer';
  transactionDate: string;
  dueDate?: string;
  category?: { id: string; name: string };
  categorySplits?: Array<{ categoryId: string; category?: { name?: string } }>;
  bankAccount?: { id: string; name: string };
  paymentMethod?: { id: string; name: string };
}

export interface ColumnFiltersState {
  categories: string[];
  accounts: string[];
  paymentMethods: string[];
  statuses: string[];
}

export interface DateColumnFilterState {
  startDate: string;
  endDate: string;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface TextColumnFilters {
  descriptionQuery: string;
  amountQuery: string;
}

function parseLocalDateStart(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function parseLocalDateEnd(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

export function getReferenceDate(item: Pick<TransactionTableItem, 'dueDate' | 'transactionDate'>): Date {
  return new Date(item.dueDate || item.transactionDate);
}

export function getEffectiveStatus(item: Pick<TransactionTableItem, 'status' | 'dueDate' | 'transactionDate'>, now: Date = new Date()): 'completed' | 'pending' | 'overdue' {
  if (item.status === 'completed') {
    return 'completed';
  }

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  return getReferenceDate(item) < todayStart ? 'overdue' : 'pending';
}

function getCategorySortValue(item: TransactionTableItem): string {
  if (item.categorySplits && item.categorySplits.length > 0) {
    return item.categorySplits
      .map(split => split.category?.name || '')
      .join(' ')
      .toLowerCase();
  }

  return item.category?.name?.toLowerCase() || '';
}

function compareValues(aValue: string | number, bValue: string | number, direction: 'asc' | 'desc'): number {
  if (aValue < bValue) return direction === 'asc' ? -1 : 1;
  if (aValue > bValue) return direction === 'asc' ? 1 : -1;
  return 0;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

interface ParsedAmountQuery {
  cents: number;
  hasExplicitSign: boolean;
}

function parseAmountQueryToCents(input: string): ParsedAmountQuery | null {
  const raw = input.trim();
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, '');
  const hasExplicitSign = /^[+-]/.test(compact);
  const sign = compact.startsWith('-') ? -1 : 1;

  const withoutSign = compact.replace(/^[+-]/, '');
  const withoutCurrency = withoutSign.replace(/^R\$/i, '').replace(/R\$/gi, '');
  const numericToken = withoutCurrency.replace(/[^\d.,]/g, '');

  if (!numericToken || !/\d/.test(numericToken)) {
    return null;
  }

  const lastComma = numericToken.lastIndexOf(',');
  const lastDot = numericToken.lastIndexOf('.');
  let normalizedNumber = numericToken;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandSeparator = decimalSeparator === ',' ? '.' : ',';
    normalizedNumber = numericToken.split(thousandSeparator).join('');
    if (decimalSeparator === ',') {
      normalizedNumber = normalizedNumber.replace(',', '.');
    }
  } else if (lastComma >= 0) {
    if (/,[0-9]{1,2}$/.test(numericToken)) {
      normalizedNumber = numericToken.replace(',', '.');
    } else {
      normalizedNumber = numericToken.split(',').join('');
    }
  } else if (lastDot >= 0) {
    if (/\.[0-9]{1,2}$/.test(numericToken)) {
      normalizedNumber = numericToken;
    } else {
      normalizedNumber = numericToken.split('.').join('');
    }
  }

  const parsed = Number.parseFloat(normalizedNumber);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return {
    cents: Math.round(parsed * 100) * sign,
    hasExplicitSign,
  };
}

function getDisplayedAmountInCents(item: Pick<TransactionTableItem, 'amount' | 'type'>): number {
  const absoluteCents = Math.round(Math.abs(Number(item.amount)) * 100);
  if (item.type === 'expense') {
    return -absoluteCents;
  }
  return absoluteCents;
}

export function applyTransactionTableFiltersAndSort<T extends TransactionTableItem>(
  transactions: T[],
  columnFilters: ColumnFiltersState,
  dateColumnFilter: DateColumnFilterState | null,
  sortConfig: SortConfig | null,
  textFilters: TextColumnFilters = { descriptionQuery: '', amountQuery: '' },
): T[] {
  let result = [...transactions];

  if (dateColumnFilter) {
    const startDate = parseLocalDateStart(dateColumnFilter.startDate);
    const endDate = parseLocalDateEnd(dateColumnFilter.endDate);

    result = result.filter(item => {
      const referenceDate = getReferenceDate(item);
      return referenceDate >= startDate && referenceDate <= endDate;
    });
  }

  if (columnFilters.categories.length > 0) {
    result = result.filter(item => {
      const mainCategoryMatch = item.category?.id ? columnFilters.categories.includes(item.category.id) : false;
      const splitMatch = (item.categorySplits || []).some(split => columnFilters.categories.includes(split.categoryId));
      return mainCategoryMatch || splitMatch;
    });
  }

  if (columnFilters.accounts.length > 0) {
    result = result.filter(item => columnFilters.accounts.includes(item.bankAccount?.id || ''));
  }

  if (columnFilters.paymentMethods.length > 0) {
    result = result.filter(item => columnFilters.paymentMethods.includes(item.paymentMethod?.id || ''));
  }

  if (columnFilters.statuses.length > 0) {
    result = result.filter(item => columnFilters.statuses.includes(getEffectiveStatus(item)));
  }

  const descriptionQuery = normalizeSearchText(textFilters.descriptionQuery || '');
  if (descriptionQuery) {
    result = result.filter(item => normalizeSearchText(item.description || '').includes(descriptionQuery));
  }

  const parsedAmountQuery = parseAmountQueryToCents(textFilters.amountQuery || '');
  if ((textFilters.amountQuery || '').trim()) {
    if (!parsedAmountQuery) {
      result = [];
    } else {
      result = result.filter(item => {
        const displayedAmountInCents = getDisplayedAmountInCents(item);
        if (parsedAmountQuery.hasExplicitSign) {
          return displayedAmountInCents === parsedAmountQuery.cents;
        }

        return Math.abs(displayedAmountInCents) === Math.abs(parsedAmountQuery.cents);
      });
    }
  }

  if (!sortConfig) {
    return result;
  }

  const statusRank: Record<'completed' | 'pending' | 'overdue', number> = {
    overdue: 0,
    pending: 1,
    completed: 2,
  };

  result.sort((a, b) => {
    switch (sortConfig.key) {
      case 'date': {
        const aValue = getReferenceDate(a).getTime();
        const bValue = getReferenceDate(b).getTime();
        return compareValues(aValue, bValue, sortConfig.direction);
      }
      case 'description':
        return compareValues(a.description.toLowerCase(), b.description.toLowerCase(), sortConfig.direction);
      case 'category':
        return compareValues(getCategorySortValue(a), getCategorySortValue(b), sortConfig.direction);
      case 'account':
        return compareValues(a.bankAccount?.name?.toLowerCase() || '', b.bankAccount?.name?.toLowerCase() || '', sortConfig.direction);
      case 'paymentMethod':
        return compareValues(a.paymentMethod?.name?.toLowerCase() || '', b.paymentMethod?.name?.toLowerCase() || '', sortConfig.direction);
      case 'amount':
        return compareValues(Number(a.amount), Number(b.amount), sortConfig.direction);
      case 'status': {
        const aValue = statusRank[getEffectiveStatus(a)];
        const bValue = statusRank[getEffectiveStatus(b)];
        return compareValues(aValue, bValue, sortConfig.direction);
      }
      default:
        return 0;
    }
  });

  return result;
}
