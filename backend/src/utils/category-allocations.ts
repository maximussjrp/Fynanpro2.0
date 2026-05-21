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
  category?: AllocationCategory | null;
};

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
        category: split.category || null,
      }));
    }

    return [{
      transactionId: transaction.id,
      categoryId: transaction.categoryId || null,
      amount: toNumber(transaction.amount),
      type: transaction.type,
      category: transaction.category || null,
    }];
  });
}
