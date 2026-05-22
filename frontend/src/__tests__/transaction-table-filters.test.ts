import { applyTransactionTableFiltersAndSort } from '@/lib/transaction-table-filters';

describe('transaction-table-filters', () => {
  const baseTransactions = [
    {
      id: 't-simple-food',
      amount: '80',
      description: 'Mercado simples',
      type: 'expense' as const,
      status: 'pending',
      transactionDate: '2026-05-10',
      category: { id: 'cat-food', name: 'Alimentacao' },
      categorySplits: [],
      bankAccount: { id: 'acc-1', name: 'Conta PF' },
      paymentMethod: { id: 'pm-1', name: 'Debito' },
    },
    {
      id: 't-split-6040',
      amount: '100',
      description: 'Supermercado split',
      type: 'expense' as const,
      status: 'pending',
      transactionDate: '2026-05-11',
      category: { id: 'cat-main', name: 'Mercado' },
      categorySplits: [
        { categoryId: 'cat-food', category: { name: 'Alimentacao' } },
        { categoryId: 'cat-hygiene', category: { name: 'Higiene' } },
      ],
      bankAccount: { id: 'acc-2', name: 'Conta PJ' },
      paymentMethod: { id: 'pm-2', name: 'Credito' },
    },
    {
      id: 't-income',
      amount: '1200',
      description: 'Receita',
      type: 'income' as const,
      status: 'completed',
      transactionDate: '2026-05-09',
      category: { id: 'cat-income', name: 'Salario' },
      categorySplits: [],
      bankAccount: { id: 'acc-1', name: 'Conta PF' },
      paymentMethod: { id: 'pm-3', name: 'PIX' },
    },
  ];

  const emptyColumnFilters = {
    categories: [],
    accounts: [],
    paymentMethods: [],
    statuses: [],
  };

  it('filtra categoria simples corretamente', () => {
    const result = applyTransactionTableFiltersAndSort(
      baseTransactions,
      { ...emptyColumnFilters, categories: ['cat-food'] },
      null,
      null,
    );

    expect(result.map(t => t.id)).toEqual(expect.arrayContaining(['t-simple-food', 't-split-6040']));
  });

  it('filtra categoria split corretamente', () => {
    const result = applyTransactionTableFiltersAndSort(
      baseTransactions,
      { ...emptyColumnFilters, categories: ['cat-hygiene'] },
      null,
      null,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t-split-6040');
  });

  it('mantem transacao split ao filtrar categoria principal', () => {
    const result = applyTransactionTableFiltersAndSort(
      baseTransactions,
      { ...emptyColumnFilters, categories: ['cat-main'] },
      null,
      null,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t-split-6040');
  });

  it('combina filtros por coluna em modo AND', () => {
    const result = applyTransactionTableFiltersAndSort(
      baseTransactions,
      {
        categories: ['cat-food'],
        accounts: ['acc-2'],
        paymentMethods: ['pm-2'],
        statuses: ['overdue'],
      },
      null,
      null,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t-split-6040');
  });

  it('ordena por data real (dueDate quando existir)', () => {
    const withDueDate = [
      {
        ...baseTransactions[0],
        id: 't-due-late',
        transactionDate: '2026-05-05',
        dueDate: '2026-05-20',
      },
      {
        ...baseTransactions[1],
        id: 't-due-early',
        transactionDate: '2026-05-30',
        dueDate: '2026-05-12',
      },
    ];

    const result = applyTransactionTableFiltersAndSort(
      withDueDate,
      emptyColumnFilters,
      null,
      { key: 'date', direction: 'asc' },
    );

    expect(result.map(t => t.id)).toEqual(['t-due-early', 't-due-late']);
  });

  it('ordena valor por numero e nao por string', () => {
    const result = applyTransactionTableFiltersAndSort(
      baseTransactions,
      emptyColumnFilters,
      null,
      { key: 'amount', direction: 'asc' },
    );

    expect(result.map(t => t.id)).toEqual(['t-simple-food', 't-split-6040', 't-income']);
  });

  it('filtra status overdue pela data de referencia', () => {
    const result = applyTransactionTableFiltersAndSort(
      [
        { ...baseTransactions[0], id: 't-overdue', transactionDate: '2024-01-01', status: 'pending' },
        { ...baseTransactions[1], id: 't-pending-future', transactionDate: '2099-01-01', status: 'pending' },
      ],
      { ...emptyColumnFilters, statuses: ['overdue'] },
      null,
      null,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t-overdue');
  });

  it('filtra descricao por palavra exata, trecho e case-insensitive', () => {
    const exact = applyTransactionTableFiltersAndSort(
      baseTransactions,
      emptyColumnFilters,
      null,
      null,
      { descriptionQuery: 'Supermercado', amountQuery: '' },
    );
    expect(exact).toHaveLength(1);
    expect(exact[0].id).toBe('t-split-6040');

    const partialCaseInsensitive = applyTransactionTableFiltersAndSort(
      baseTransactions,
      emptyColumnFilters,
      null,
      null,
      { descriptionQuery: 'SPLIT', amountQuery: '' },
    );
    expect(partialCaseInsensitive).toHaveLength(1);
    expect(partialCaseInsensitive[0].id).toBe('t-split-6040');

    const accentInsensitive = applyTransactionTableFiltersAndSort(
      [
        ...baseTransactions,
        {
          id: 't-salary',
          amount: '2500',
          description: 'Salário mensal',
          type: 'income' as const,
          status: 'completed',
          transactionDate: '2026-05-15',
          category: { id: 'cat-income', name: 'Salario' },
          categorySplits: [],
          bankAccount: { id: 'acc-1', name: 'Conta PF' },
          paymentMethod: { id: 'pm-3', name: 'PIX' },
        },
      ],
      emptyColumnFilters,
      null,
      null,
      { descriptionQuery: 'salario', amountQuery: '' },
    );

    expect(accentInsensitive.map(t => t.id)).toContain('t-salary');
  });

  it('filtra valor por formatos comuns sem confundir 50 com 500', () => {
    const dataset = [
      ...baseTransactions,
      {
        id: 't-expense-50',
        amount: '50',
        description: 'Despesa 50',
        type: 'expense' as const,
        status: 'pending',
        transactionDate: '2026-05-18',
        category: { id: 'cat-food', name: 'Alimentacao' },
        categorySplits: [],
        bankAccount: { id: 'acc-1', name: 'Conta PF' },
        paymentMethod: { id: 'pm-1', name: 'Debito' },
      },
      {
        id: 't-expense-500',
        amount: '500',
        description: 'Despesa 500',
        type: 'expense' as const,
        status: 'pending',
        transactionDate: '2026-05-20',
        category: { id: 'cat-food', name: 'Alimentacao' },
        categorySplits: [],
        bankAccount: { id: 'acc-1', name: 'Conta PF' },
        paymentMethod: { id: 'pm-1', name: 'Debito' },
      },
      {
        id: 't-income-1000',
        amount: '1000',
        description: 'Receita 1000',
        type: 'income' as const,
        status: 'completed',
        transactionDate: '2026-05-21',
        category: { id: 'cat-income', name: 'Salario' },
        categorySplits: [],
        bankAccount: { id: 'acc-1', name: 'Conta PF' },
        paymentMethod: { id: 'pm-3', name: 'PIX' },
      },
    ];

    const by50 = applyTransactionTableFiltersAndSort(
      dataset,
      emptyColumnFilters,
      null,
      null,
      { descriptionQuery: '', amountQuery: '50' },
    );
    expect(by50.map(t => t.id)).toEqual(['t-expense-50']);

    const byMinus50 = applyTransactionTableFiltersAndSort(
      dataset,
      emptyColumnFilters,
      null,
      null,
      { descriptionQuery: '', amountQuery: '-50' },
    );
    expect(byMinus50.map(t => t.id)).toEqual(['t-expense-50']);

    const byCurrency50 = applyTransactionTableFiltersAndSort(
      dataset,
      emptyColumnFilters,
      null,
      null,
      { descriptionQuery: '', amountQuery: 'R$ 50,00' },
    );
    expect(byCurrency50.map(t => t.id)).toEqual(['t-expense-50']);

    const by1000 = applyTransactionTableFiltersAndSort(
      dataset,
      emptyColumnFilters,
      null,
      null,
      { descriptionQuery: '', amountQuery: '1000' },
    );
    expect(by1000.map(t => t.id)).toEqual(['t-income-1000']);

    const byPlus1000 = applyTransactionTableFiltersAndSort(
      dataset,
      emptyColumnFilters,
      null,
      null,
      { descriptionQuery: '', amountQuery: '+1000' },
    );
    expect(byPlus1000.map(t => t.id)).toEqual(['t-income-1000']);

    const byThousandPtBr = applyTransactionTableFiltersAndSort(
      dataset,
      emptyColumnFilters,
      null,
      null,
      { descriptionQuery: '', amountQuery: '1.000,00' },
    );
    expect(byThousandPtBr.map(t => t.id)).toEqual(['t-income-1000']);
  });

  it('combina descricao + valor + categoria split em AND', () => {
    const result = applyTransactionTableFiltersAndSort(
      baseTransactions,
      {
        ...emptyColumnFilters,
        categories: ['cat-hygiene'],
      },
      null,
      null,
      { descriptionQuery: 'split', amountQuery: '100' },
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t-split-6040');
  });

  it('mantem ordenacao numerica por valor com filtro ativo', () => {
    const dataset = [
      {
        ...baseTransactions[0],
        id: 't-expense-150',
        amount: '150',
        description: 'Conta energia',
      },
      {
        ...baseTransactions[1],
        id: 't-expense-90',
        amount: '90',
        description: 'Conta energia extra',
      },
      {
        ...baseTransactions[2],
        id: 't-income-80',
        amount: '80',
        description: 'Conta energia bonus',
        type: 'income' as const,
      },
    ];

    const result = applyTransactionTableFiltersAndSort(
      dataset,
      emptyColumnFilters,
      null,
      { key: 'amount', direction: 'asc' },
      { descriptionQuery: 'energia', amountQuery: '' },
    );

    expect(result.map(t => t.id)).toEqual(['t-income-80', 't-expense-90', 't-expense-150']);
  });

  it('mantem ordenacao alfabetica por descricao com filtro de valor ativo', () => {
    const dataset = [
      {
        ...baseTransactions[0],
        id: 't-zeta',
        amount: '50',
        description: 'Zeta conta',
      },
      {
        ...baseTransactions[1],
        id: 't-alpha',
        amount: '50',
        description: 'Alpha conta',
      },
    ];

    const result = applyTransactionTableFiltersAndSort(
      dataset,
      emptyColumnFilters,
      null,
      { key: 'description', direction: 'asc' },
      { descriptionQuery: '', amountQuery: '50' },
    );

    expect(result.map(t => t.id)).toEqual(['t-alpha', 't-zeta']);
  });
});
