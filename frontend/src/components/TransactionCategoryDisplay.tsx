type SplitCategory = {
  id?: string;
  name?: string;
  icon?: string;
  color?: string;
};

type TransactionSplit = {
  categoryId: string;
  amount: string | number;
  category?: SplitCategory;
};

type MainCategory = {
  id?: string;
  name?: string;
  icon?: string;
  color?: string;
};

interface TransactionCategoryDisplayProps {
  category?: MainCategory | null;
  categorySplits?: TransactionSplit[];
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Math.abs(value));
}

export default function TransactionCategoryDisplay({
  category,
  categorySplits = [],
}: TransactionCategoryDisplayProps) {
  if (!Array.isArray(categorySplits) || categorySplits.length === 0) {
    if (!category) {
      return <span className="text-gray-400 italic">Sem categoria</span>;
    }

    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
        <span>{category.icon}</span>
        <span>{category.name}</span>
      </div>
    );
  }

  const splitCount = categorySplits.length;
  const visibleSplits = categorySplits.slice(0, 2);
  const remainingCount = Math.max(0, splitCount - visibleSplits.length);
  const splitSummary = visibleSplits
    .map(split => `${split.category?.name || 'Sem categoria'} ${formatCurrency(toNumber(split.amount))}`)
    .join(' · ');
  const fullSummary = categorySplits
    .map(split => `${split.category?.name || 'Sem categoria'}: ${formatCurrency(toNumber(split.amount))}`)
    .join(' · ');

  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-blue-700">Dividido · {splitCount} {splitCount === 1 ? 'categoria' : 'categorias'}</p>
      <p className="text-xs text-gray-600 truncate" title={fullSummary}>
        {splitSummary}
        {remainingCount > 0 ? ` · mais ${remainingCount}` : ''}
      </p>
    </div>
  );
}