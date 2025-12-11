import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { log, httpLogger } from './utils/logger';

// Routes
import bankAccountRoutes from './routes/bank-accounts';
import categoryRoutes from './routes/categories';
import paymentMethodRoutes from './routes/payment-methods';
import transactionRoutes from './routes/transactions';
import recurringBillRoutes from './routes/recurring-bills';
import installmentRoutes from './routes/installments';
import budgetRoutes from './routes/budgets';
import calendarRoutes from './routes/calendar';
import reportRoutes from './routes/reports';
import notificationRoutes from './routes/notifications';

dotenv.config();

export const prisma = new PrismaClient();

const app: Express = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Welcome route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 FYNANPRO 2.0 API está rodando!',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: '/api/v1',
      docs: '/api/v1/docs'
    }
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API v1 Routes
const apiRouter = express.Router();

apiRouter.use('/bank-accounts', bankAccountRoutes);
apiRouter.use('/categories', categoryRoutes);
apiRouter.use('/payment-methods', paymentMethodRoutes);
apiRouter.use('/transactions', transactionRoutes);
apiRouter.use('/recurring-bills', recurringBillRoutes);
apiRouter.use('/installments', installmentRoutes);
apiRouter.use('/budgets', budgetRoutes);
apiRouter.use('/calendar', calendarRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/notifications', notificationRoutes);

app.use('/api/v1', apiRouter);

// HTTP Logger
app.use(httpLogger);

// Error handling
app.use((err: Error, req: any, res: any, next: any) => {
  log.error('Erro não tratado', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message
    }
  });
});

// Start server
app.listen(port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 FYNANPRO 2.0 - Backend API Completo                 ║
║                                                           ║
║   Status: ✅ Rodando                                     ║
║   Porta: ${port}                                        ║
║   URL: http://localhost:${port}                         ║
║   Ambiente: ${process.env.NODE_ENV}                     ║
║   Database: PostgreSQL + Docker                          ║
║                                                           ║
║   📊 Endpoints disponíveis:                              ║
║   - Auth & Users                                         ║
║   - Bank Accounts                                        ║
║   - Categories (Hierárquicas 3 níveis)                   ║
║   - Payment Methods                                      ║
║   - Transactions (Receitas, Despesas, Transferências)    ║
║   - Recurring Bills (Contas Fixas)                       ║
║   - Installments (Parceladas)                            ║
║   - Budgets (Orçamentos)                                 ║
║   - Calendar (Calendário)                                ║
║   - Cash Flow (Projeções 30/60/90 dias)                  ║
║   - Reports (Relatórios + Exportação CSV)                ║
║   - Super Master (Acesso total)                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  log.info('Fechando servidor (SIGINT)');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log.info('Fechando servidor (SIGTERM)');
  await prisma.$disconnect();
  process.exit(0);
});
