import { render, screen } from '@testing-library/react';
import TransactionCategoryDisplay from '@/components/TransactionCategoryDisplay';

describe('TransactionCategoryDisplay', () => {
  it('renders normal category when transaction has no splits', () => {
    render(
      <TransactionCategoryDisplay
        category={{ id: 'cat-1', name: 'Alimentacao', icon: 'A', color: '#10b981' }}
      />
    );

    expect(screen.getByText('Alimentacao')).toBeInTheDocument();
    expect(screen.queryByText(/Dividido/)).not.toBeInTheDocument();
  });

  it('renders split indicator and split summary when transaction has splits', () => {
    render(
      <TransactionCategoryDisplay
        category={{ id: 'cat-main', name: 'Ignorado', icon: 'I', color: '#111827' }}
        categorySplits={[
          {
            categoryId: 'cat-food',
            amount: '30',
            category: { id: 'cat-food', name: 'Alimentacao', icon: 'A', color: '#10b981' },
          },
          {
            categoryId: 'cat-delivery',
            amount: '20',
            category: { id: 'cat-delivery', name: 'Delivery', icon: 'D', color: '#2563eb' },
          },
        ]}
      />
    );

    expect(screen.getByText('Dividido · 2 categorias')).toBeInTheDocument();
    expect(screen.getByText(/Alimentacao/)).toBeInTheDocument();
    expect(screen.getByText(/Delivery/)).toBeInTheDocument();
  });
});
