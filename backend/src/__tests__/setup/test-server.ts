/**
 * Test Server Setup
 * Cria uma instância do Express app para testes de integração
 */

import express, { Express } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { registerAuthRoutes } from '../../main-routes';
import transactionRoutes from '../../routes/transactions';
import dashboardRoutes from '../../routes/dashboard';
import categoryRoutes from '../../routes/categories';

/**
 * Cria app Express configurado para testes
 */
export function createTestApp(): Express {
  const app = express();

  // Middlewares básicos
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Rate limiter mais permissivo para testes
  const testLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(testLimiter);

  // Registrar rotas
  registerAuthRoutes(app);
  app.use('/transactions', transactionRoutes);
  app.use('/dashboard', dashboardRoutes);
  app.use('/categories', categoryRoutes);

  return app;
}
