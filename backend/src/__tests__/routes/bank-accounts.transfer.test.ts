import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import { mockPrisma } from '../setup';
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

describe('bank-accounts.transfer', () => {
  let app: Express;
  let authToken: string;

  beforeAll(() => {
    app = createApp();
    authToken = generateToken();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.bankAccount.findFirst
      .mockResolvedValueOnce({
        id: 'acc-from',
        name: 'Origem',
        tenantId: 'tenant-123',
        deletedAt: null,
        currentBalance: 1000,
      } as any)
      .mockResolvedValueOnce({
        id: 'acc-to',
        name: 'Destino',
        tenantId: 'tenant-123',
        deletedAt: null,
        currentBalance: 500,
      } as any);
  });

  it('bloqueia transferencia duplicada recente sem debitar novamente', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-out-recent',
      linkedTransactionId: 'tx-in-recent',
    } as any);

    const response = await request(app)
      .post('/bank-accounts/transfer/execute')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        fromAccountId: 'acc-from',
        toAccountId: 'acc-to',
        amount: 200,
        description: 'Transferência teste',
        transactionDate: '2026-05-13',
      });

    expect(response.status).toBe(409);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
