type AllocationCategory = {
  id: string;
  name?: string | null;
  icon?: string | null;
  color?: string | null;
  type?: string | null;
  parentId?: string | null;
};

type TransactionLike = {
  id?: string;
  amount: unknown;
  type: string;
  status?: string | null;
  transactionDate?: Date | string | null;
  recurringBillId?: string | null;
  categoryId?: string | null;
  category?: AllocationCategory | null;
  categorySplits?: Array<{
    categoryId: string;
    amount: unknown;
    category?: AllocationCategory | null;
  }> | null;
};

export type CategoryAllocation = {
  transactionId?: string;
  categoryId: string | null;
  amount: number;
  type: string;
  status?: string | null;
  transactionDate?: Date | string | null;
  recurringBillId?: string | null;
  category?: AllocationCategory | null;
};

export const PATRIMONIAL_CATEGORY_TYPE = 'patrimonial';

export function isPatrimonialCategory(category?: AllocationCategory | null): boolean {
  return category?.type === PATRIMONIAL_CATEGORY_TYPE;
}

export function isResultAllocation(allocation: CategoryAllocation): boolean {
  return !isPatrimonialCategory(allocation.category);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof (value as { toString(): string }).toString === 'function') {
    return Number((value as { toString(): string }).toString());
  }
  return 0;
}

export function expandCategoryAllocations(transactions: TransactionLike[]): CategoryAllocation[] {
  return transactions.flatMap(transaction => {
    const splits = transaction.categorySplits || [];
    if (splits.length > 0) {
      return splits.map(split => ({
        transactionId: transaction.id,
        categoryId: split.categoryId,
        amount: toNumber(split.amount),
        type: transaction.type,
        status: transaction.status,
        transactionDate: transaction.transactionDate,
        recurringBillId: transaction.recurringBillId,
        category: split.category || null,
      }));
    }

    return [{
      transactionId: transaction.id,
      categoryId: transaction.categoryId || null,
      amount: toNumber(transaction.amount),
      type: transaction.type,
      status: transaction.status,
      transactionDate: transaction.transactionDate,
      recurringBillId: transaction.recurringBillId,
      category: transaction.category || null,
    }];
  });
}
