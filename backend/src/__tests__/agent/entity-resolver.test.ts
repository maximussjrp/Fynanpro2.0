/**
 * Sprint 4 — resolvers de categoria e conta + façade create_transaction.
 */

import '../setup';
import { resolveCategory } from '../../agent/entity-resolver/category-resolver';
import { resolveBankAccount } from '../../agent/entity-resolver/bank-account-resolver';
import {
  resolveCreateTransactionRefs,
  isUuid,
} from '../../agent/entity-resolver/resolver.service';
import type {
  CategoryLoader,
  BankAccountLoader,
} from '../../agent/entity-resolver';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

function catLoader(rows: Array<{ id: string; name: string; type: string }>): CategoryLoader {
  return { load: async () => rows };
}

function accLoader(
  rows: Array<{ id: string; name: string; institution: string | null }>,
): BankAccountLoader {
  return {
    load: async () =>
      rows.map(r => ({ ...r, aliases: r.institution ? [r.institution] : [] })),
  };
}

// ---------------------------------------------------------------------------
// isUuid
// ---------------------------------------------------------------------------

describe('isUuid', () => {
  it('aceita UUID v4 válido', () => {
    expect(isUuid(VALID_UUID)).toBe(true);
  });
  it('rejeita nomes humanos', () => {
    expect(isUuid('aluguel')).toBe(false);
    expect(isUuid('nubank')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(123)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// category resolver
// ---------------------------------------------------------------------------

describe('resolveCategory', () => {
  it('unique match por nome exato', async () => {
    const r = await resolveCategory('aluguel', { tenantId: 't1' }, {
      loader: catLoader([
        { id: 'c1', name: 'Aluguel', type: 'expense' },
        { id: 'c2', name: 'Salário', type: 'income' },
      ]),
    });
    expect(r.status).toBe('unique');
    if (r.status === 'unique') expect(r.entity.id).toBe('c1');
  });

  it('respeita tenantId via loader', async () => {
    // loader recebe ctx com tenantId; simulamos retornando só quando bate.
    const loader: CategoryLoader = {
      load: async ctx => {
        expect(ctx.tenantId).toBe('t-xyz');
        return [{ id: 'c1', name: 'Aluguel', type: 'expense' }];
      },
    };
    const r = await resolveCategory('aluguel', { tenantId: 't-xyz' }, { loader });
    expect(r.status).toBe('unique');
  });

  it('respeita categoryType (expense/income)', async () => {
    const loader: CategoryLoader = {
      load: async ctx => {
        expect(ctx.categoryType).toBe('expense');
        return [{ id: 'c1', name: 'Aluguel', type: 'expense' }];
      },
    };
    await resolveCategory(
      'aluguel',
      { tenantId: 't1', categoryType: 'expense' },
      { loader },
    );
  });

  it('ambiguous quando dois candidatos próximos', async () => {
    const r = await resolveCategory('mercado', { tenantId: 't1' }, {
      loader: catLoader([
        { id: 'c1', name: 'Mercado Central', type: 'expense' },
        { id: 'c2', name: 'Mercado Municipal', type: 'expense' },
      ]),
    });
    expect(r.status).toBe('ambiguous');
  });

  it('none quando nada bate', async () => {
    const r = await resolveCategory('xyz123', { tenantId: 't1' }, {
      loader: catLoader([{ id: 'c1', name: 'Aluguel', type: 'expense' }]),
    });
    expect(r.status).toBe('none');
  });

  it('erro de banco vira status=none', async () => {
    const loader: CategoryLoader = {
      load: async () => {
        throw new Error('db down');
      },
    };
    const r = await resolveCategory('x', { tenantId: 't1' }, { loader });
    expect(r.status).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// bank account resolver
// ---------------------------------------------------------------------------

describe('resolveBankAccount', () => {
  it('resolve por nome exato', async () => {
    const r = await resolveBankAccount('nubank', { tenantId: 't1' }, {
      loader: accLoader([
        { id: 'a1', name: 'Nubank', institution: 'Nubank' },
        { id: 'a2', name: 'Itaú CC', institution: 'Itaú' },
      ]),
    });
    expect(r.status).toBe('unique');
    if (r.status === 'unique') expect(r.entity.id).toBe('a1');
  });

  it('resolve por institution mesmo com nome diferente', async () => {
    const r = await resolveBankAccount('nubank', { tenantId: 't1' }, {
      loader: accLoader([
        { id: 'a1', name: 'Conta Principal', institution: 'Nubank' },
      ]),
    });
    expect(r.status).toBe('unique');
    if (r.status === 'unique') expect(r.entity.id).toBe('a1');
  });

  it('ambiguidade entre itaú cc e cofrinho itaú', async () => {
    const r = await resolveBankAccount('itau', { tenantId: 't1' }, {
      loader: accLoader([
        { id: 'a1', name: 'Itaú Conta Corrente', institution: 'Itaú' },
        { id: 'a2', name: 'Cofrinho Itaú', institution: 'Itaú' },
      ]),
    });
    expect(r.status).toBe('ambiguous');
    expect(r.candidates.length).toBe(2);
  });

  it('none quando nenhum bate', async () => {
    const r = await resolveBankAccount('bradesco', { tenantId: 't1' }, {
      loader: accLoader([{ id: 'a1', name: 'Nubank', institution: 'Nubank' }]),
    });
    expect(r.status).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// façade create_transaction
// ---------------------------------------------------------------------------

describe('resolveCreateTransactionRefs', () => {
  const cats = catLoader([
    { id: 'cat-1', name: 'Aluguel', type: 'expense' },
    { id: 'cat-2', name: 'Mercado Central', type: 'expense' },
    { id: 'cat-3', name: 'Mercado Municipal', type: 'expense' },
    { id: 'cat-4', name: 'Salário', type: 'income' },
  ]);
  const accs = accLoader([
    { id: 'acc-1', name: 'Itaú Conta Corrente', institution: 'Itaú' },
    { id: 'acc-2', name: 'Nubank', institution: 'Nubank' },
  ]);

  it('resolve categoryName + bankAccountName (caso feliz)', async () => {
    const r = await resolveCreateTransactionRefs(
      {
        type: 'expense',
        categoryName: 'aluguel',
        bankAccountName: 'itau',
      },
      { tenantId: 't1' },
      { categoryLoader: cats, bankAccountLoader: accs },
    );
    expect(r.needsClarification).toBe(false);
    if (r.needsClarification === false) {
      expect(r.categoryId).toBe('cat-1');
      expect(r.bankAccountId).toBe('acc-1');
      expect(r.resolvedFrom.categoryFromName?.query).toBe('aluguel');
      expect(r.resolvedFrom.bankAccountFromName?.query).toBe('itau');
    }
  });

  it('passa IDs UUID direto sem re-resolver', async () => {
    const r = await resolveCreateTransactionRefs(
      {
        categoryId: VALID_UUID,
        bankAccountId: VALID_UUID,
      },
      { tenantId: 't1' },
      { categoryLoader: cats, bankAccountLoader: accs },
    );
    expect(r.needsClarification).toBe(false);
    if (r.needsClarification === false) {
      expect(r.categoryId).toBe(VALID_UUID);
      expect(r.bankAccountId).toBe(VALID_UUID);
      expect(r.resolvedFrom.categoryFromName).toBeUndefined();
      expect(r.resolvedFrom.bankAccountFromName).toBeUndefined();
    }
  });

  it('trata texto humano em categoryId como nome', async () => {
    const r = await resolveCreateTransactionRefs(
      {
        type: 'expense',
        categoryId: 'aluguel', // não é UUID
        bankAccountName: 'nubank',
      },
      { tenantId: 't1' },
      { categoryLoader: cats, bankAccountLoader: accs },
    );
    expect(r.needsClarification).toBe(false);
    if (r.needsClarification === false) {
      expect(r.categoryId).toBe('cat-1');
    }
  });

  it('ambiguidade em categoria → clarification', async () => {
    const r = await resolveCreateTransactionRefs(
      {
        type: 'expense',
        categoryName: 'mercado',
        bankAccountName: 'nubank',
      },
      { tenantId: 't1' },
      { categoryLoader: cats, bankAccountLoader: accs },
    );
    expect(r.needsClarification).toBe(true);
    if (r.needsClarification === true) {
      expect(r.clarificationType).toBe('category_ambiguous');
      expect(r.query).toBe('mercado');
      expect(r.candidates.length).toBeGreaterThanOrEqual(2);
      expect(r.clarificationMessage).toMatch(/mercado/i);
    }
  });

  it('conta não encontrada → clarification', async () => {
    const r = await resolveCreateTransactionRefs(
      {
        type: 'expense',
        categoryName: 'aluguel',
        bankAccountName: 'bradesco', // não existe
      },
      { tenantId: 't1' },
      { categoryLoader: cats, bankAccountLoader: accs },
    );
    expect(r.needsClarification).toBe(true);
    if (r.needsClarification === true) {
      expect(r.clarificationType).toBe('account_not_found');
    }
  });

  it('prioriza clarificação de categoria antes de conta', async () => {
    // Categoria ambígua + conta também ausente — deve clarificar categoria primeiro.
    const r = await resolveCreateTransactionRefs(
      {
        type: 'expense',
        categoryName: 'mercado',
        bankAccountName: 'bradesco',
      },
      { tenantId: 't1' },
      { categoryLoader: cats, bankAccountLoader: accs },
    );
    expect(r.needsClarification).toBe(true);
    if (r.needsClarification === true) {
      expect(r.clarificationType).toBe('category_ambiguous');
    }
  });

  it('sem categoryName/Id não dispara resolução de categoria', async () => {
    const r = await resolveCreateTransactionRefs(
      { bankAccountName: 'nubank' },
      { tenantId: 't1' },
      { categoryLoader: cats, bankAccountLoader: accs },
    );
    expect(r.needsClarification).toBe(false);
    if (r.needsClarification === false) {
      expect(r.categoryId).toBeUndefined();
      expect(r.bankAccountId).toBe('acc-2');
    }
  });
});
