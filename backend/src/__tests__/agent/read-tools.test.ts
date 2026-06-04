/**
 * Read tools — list_categories, list_accounts, get_account_balance.
 * Garante:
 *   - multi-tenant (where.tenantId é o do ctx)
 *   - normalização de saldo (Decimal → number)
 *   - NOT_FOUND preservado
 */

import { mockPrisma } from '../setup';
import { ToolRegistry } from '../../agent/tools/registry';
import { listCategoriesTool } from '../../agent/tools/list-categories.tool';
import { listAccountsTool } from '../../agent/tools/list-accounts.tool';
import { getAccountBalanceTool } from '../../agent/tools/get-account-balance.tool';
import type { ToolContext } from '../../agent/tools/types';

const mp = mockPrisma as any;
if (!mp.bankAccount.findMany) mp.bankAccount.findMany = jest.fn();

const ctx: ToolContext = {
  tenantId: 'tenant-A',
  userId: 'user-1',
  source: 'test',
};

describe('read tools', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new ToolRegistry();
    registry.register(listCategoriesTool);
    registry.register(listAccountsTool);
    registry.register(getAccountBalanceTool);
  });

  describe('list_categories', () => {
    it('filtra pelo tenantId do ctx e por type', async () => {
      (mp.category.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 'c1', name: 'Mercado', type: 'expense', parentId: null, icon: null, color: null },
        { id: 'c2', name: 'Lazer',   type: 'expense', parentId: null, icon: null, color: null },
      ]);

      const r = await registry.invoke('list_categories', { type: 'expense' }, ctx);

      expect(r.ok).toBe(true);
      const call = (mp.category.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.tenantId).toBe('tenant-A');
      expect(call.where.type).toBe('expense');
      expect(call.where.deletedAt).toBeNull();
      if (r.ok) {
        expect((r.data as any).count).toBe(2);
        expect((r.data as any).categories[0].id).toBe('c1');
      }
    });

    it('default type=all não filtra por type', async () => {
      (mp.category.findMany as jest.Mock).mockResolvedValueOnce([]);
      await registry.invoke('list_categories', {}, ctx);
      const call = (mp.category.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.type).toBeUndefined();
    });

    it('includeSubcategories=false exige parentId null', async () => {
      (mp.category.findMany as jest.Mock).mockResolvedValueOnce([]);
      await registry.invoke('list_categories', { includeSubcategories: false }, ctx);
      const call = (mp.category.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.parentId).toBeNull();
    });

    it('retorna path completo e filtra por busca em categorias netas', async () => {
      (mp.category.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 'c1', name: 'Moradia', type: 'expense', parentId: null, level: 1, icon: null, color: null },
        { id: 'c2', name: 'Manutencao', type: 'expense', parentId: 'c1', level: 2, icon: null, color: null },
        { id: 'c3', name: 'Pintura', type: 'expense', parentId: 'c2', level: 3, icon: null, color: null },
      ]);

      const r = await registry.invoke('list_categories', { type: 'expense', search: 'pintura' }, ctx);

      expect(r.ok).toBe(true);
      if (r.ok) {
        const d = r.data as any;
        expect(d.count).toBe(1);
        expect(d.categories[0].path).toBe('Moradia > Manutencao > Pintura');
        expect(d.categories[0].level).toBe(3);
      }
    });
  });

  describe('list_accounts', () => {
    it('lista contas do tenant com saldo numérico', async () => {
      (mp.bankAccount.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'acc-1',
          name: 'Itaú',
          type: 'checking',
          institution: 'Itaú',
          currentBalance: { toString: () => '123.45' } as any,
          initialBalance: { toString: () => '0' } as any,
          isActive: true,
        },
      ]);

      const r = await registry.invoke('list_accounts', {}, ctx);
      expect(r.ok).toBe(true);
      const call = (mp.bankAccount.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.tenantId).toBe('tenant-A');
      expect(call.where.isActive).toBe(true);
      expect(call.where.deletedAt).toBeNull();
      if (r.ok) {
        const d = r.data as any;
        expect(d.count).toBe(1);
        expect(d.accounts[0].currentBalance).toBeCloseTo(123.45);
      }
    });

    it('includeInactive=true remove o filtro isActive', async () => {
      (mp.bankAccount.findMany as jest.Mock).mockResolvedValueOnce([]);
      await registry.invoke('list_accounts', { includeInactive: true }, ctx);
      const call = (mp.bankAccount.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.isActive).toBeUndefined();
    });
  });

  describe('get_account_balance', () => {
    it('retorna saldo numérico com filtro tenantId', async () => {
      (mp.bankAccount.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'acc-1',
        name: 'Itaú',
        currentBalance: { toString: () => '42.10' } as any,
        initialBalance: { toString: () => '10' } as any,
        isActive: true,
      });
      const r = await registry.invoke(
        'get_account_balance',
        { bankAccountId: '11111111-1111-4111-8111-111111111111' },
        ctx,
      );
      expect(r.ok).toBe(true);
      const call = (mp.bankAccount.findFirst as jest.Mock).mock.calls[0][0];
      expect(call.where.tenantId).toBe('tenant-A');
      expect(call.where.deletedAt).toBeNull();
      if (r.ok) {
        expect((r.data as any).currentBalance).toBeCloseTo(42.1);
        expect((r.data as any).bankAccountId).toBe('acc-1');
      }
    });

    it('conta inexistente → NOT_FOUND / ACCOUNT_NOT_FOUND', async () => {
      (mp.bankAccount.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const r = await registry.invoke(
        'get_account_balance',
        { bankAccountId: '11111111-1111-4111-8111-111111111111' },
        ctx,
      );
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.kind).toBe('NOT_FOUND');
        expect(r.code).toBe('ACCOUNT_NOT_FOUND');
      }
    });

    it('valida uuid no input', async () => {
      const r = await registry.invoke('get_account_balance', { bankAccountId: 'nope' }, ctx);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.kind).toBe('VALIDATION_ERROR');
    });
  });
});
