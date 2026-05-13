import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import { mockPrisma } from '../setup';
import { cacheService } from '../../services/cache.service';
import bankAccountRoutes from '../../routes/bank-accounts';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/bank-accounts', bankAccountRoutes);
  return app;
}

function generateToken(userId = 'user-123', tenantId = 'tenant-123'): string {
  return jwt.sign(
    { userId, tenantId, email: 'test@example.com' },
    process.env.JWT_SECRET || 'test-secret-key-with-32-characters-minimum',
    { expiresIn: '15m' }
  );
}

describe('Bank accounts adjustment routes', () => {
  let app: Express;
  let authToken: string;

  beforeAll(() => {
    app = createApp();
    authToken = generateToken();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.bankAccount.findFirst.mockResolvedValue({
      id: 'acc-123',
      name: 'Conta Corrente',
      tenantId: 'tenant-123',
      deletedAt: null,
      currentBalance: 1000,
    } as any);
  });

  it('cria ajuste positivo e incrementa saldo da conta', async () => {
    const txCreateMock = jest.fn().mockResolvedValue({
      id: 'adj-123',
      type: 'adjustment',
      amount: 150,
      status: 'completed',
    });
    const txBankUpdateMock = jest.fn().mockResolvedValue({
      id: 'acc-123',
      currentBalance: 1150,
    });

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        transaction: { create: txCreateMock },
        bankAccount: { update: txBankUpdateMock },
      };
      return fn(tx);
    });

    const response = await request(app)
      .post('/bank-accounts/adjustment')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ bankAccountId: 'acc-123', amount: 150, description: 'Ajuste positivo' });

    expect(response.status).toBe(201);
    expect(txBankUpdateMock).toHaveBeenCalledWith({
      where: { id: 'acc-123' },
      data: { currentBalance: { increment: 150 } },
    });
    expect(cacheService.invalidateMultiple).toHaveBeenCalled();
  });

  it('cria ajuste negativo e decrementa saldo da conta', async () => {
    const txCreateMock = jest.fn().mockResolvedValue({
      id: 'adj-456',
      type: 'adjustment',
      amount: -80,
      status: 'completed',
    });
    const txBankUpdateMock = jest.fn().mockResolvedValue({
      id: 'acc-123',
      currentBalance: 920,
    });

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        transaction: { create: txCreateMock },
        bankAccount: { update: txBankUpdateMock },
      };
      return fn(tx);
    });

    const response = await request(app)
      .post('/bank-accounts/adjustment')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ bankAccountId: 'acc-123', amount: -80, description: 'Ajuste negativo' });

    expect(response.status).toBe(201);
    expect(txBankUpdateMock).toHaveBeenCalledWith({
      where: { id: 'acc-123' },
      data: { currentBalance: { decrement: 80 } },
    });
    expect(cacheService.invalidateMultiple).toHaveBeenCalled();
  });

  it('bloqueia ajuste duplicado recente sem reaplicar saldo', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({
      id: 'adj-recent',
      type: 'adjustment',
      amount: 150,
      status: 'completed',
    } as any);

    const response = await request(app)
      .post('/bank-accounts/adjustment')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ bankAccountId: 'acc-123', amount: 150, description: 'Ajuste positivo' });

    expect(response.status).toBe(409);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});