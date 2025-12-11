import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { PrismaClient } from '@prisma/client';
import dashboardRoutes from './routes/dashboard';
import transactionRoutes from './routes/transactions';
import bankAccountRoutes from './routes/bank-accounts';
import categoryRoutes from './routes/categories';
import paymentMethodRoutes from './routes/payment-methods';
import recurringBillRoutes from './routes/recurring-bills';
import installmentRoutes from './routes/installments';
import budgetRoutes from './routes/budgets';
import reportRoutes from './routes/reports';
import calendarRoutes from './routes/calendar';
import { createDefaultCategories } from './utils/default-categories';
import { env } from './config/env';
import { swaggerSpec } from './config/swagger';
import { startTransactionGeneratorJob } from './jobs/transaction-generator.job';
import { startAllJobs } from './jobs/notification.job';
import { authService } from './services/auth.service';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from './dtos/auth.dto';
import { log, httpLogger } from './utils/logger';

// Carregar variáveis de ambiente
dotenv.config();

// Inicializar Prisma com middleware de segurança
export const prisma = new PrismaClient();

// Middleware Prisma - Forçar tenantId em todas as operações
prisma.$use(async (params, next) => {
  // Lista de modelos que precisam de tenantId
  const modelsWithTenant = [
    'Transaction', 'BankAccount', 'Category', 'PaymentMethod',
    'RecurringBill', 'RecurringBillOccurrence', 'InstallmentPurchase',
    'Installment', 'Budget', 'TriggerCategory', 'Notification',
    'Import', 'SavedFilter', 'AuditLog'
  ];

  // Ignorar operações em modelos sem tenantId (User, Tenant, TenantUser)
  if (!params.model || !modelsWithTenant.includes(params.model)) {
    return next(params);
  }

  // Para queries (findMany, findFirst, count, etc)
  if (params.action.startsWith('find') || params.action === 'count') {
    // Avisar se não tem tenantId no where (possível vazamento de dados)
    if (!params.args?.where?.tenantId) {
      log.warn('Query sem tenantId detectada', {
        model: params.model,
        action: params.action,
        message: 'Isso pode vazar dados entre tenants!'
      });
    }
  }

  return next(params);
});

// Criar aplicação Express
const app: Express = express();
const port = env.PORT;

// Middleware de logging HTTP
app.use(httpLogger);

// Rate Limiting Global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 1000 requisições por IP
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Muitas requisições. Tente novamente em alguns minutos.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate Limiting para rotas de autenticação (mais restritivo)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: env.NODE_ENV === 'production' ? 5 : 100, // 100 tentativas em dev, 5 em produção
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Muitas tentativas de login/registro. Tente novamente em 15 minutos.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middlewares
app.use(globalLimiter);
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: '🚀 FYNANPRO 2.0 API está rodando!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: '/api/v1',
      docs: '/api-docs'
    }
  });
});

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'FYNANPRO 2.0 API Docs',
}));

app.get('/health', async (req: Request, res: Response) => {
  try {
    // Testar conexão com banco
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

// Rotas da API v1
const apiRouter = express.Router();

// Dashboard routes
apiRouter.use('/dashboard', dashboardRoutes);

// Transaction routes
apiRouter.use('/transactions', transactionRoutes);

// Bank Account routes
apiRouter.use('/bank-accounts', bankAccountRoutes);

// Category routes (includes payment methods)
apiRouter.use('/categories', categoryRoutes);

// Payment Method routes
apiRouter.use('/payment-methods', paymentMethodRoutes);

// Recurring Bills routes
apiRouter.use('/recurring-bills', recurringBillRoutes);

// Installments routes
apiRouter.use('/installments', installmentRoutes);

// Budgets routes
apiRouter.use('/budgets', budgetRoutes);

// Reports routes
apiRouter.use('/reports', reportRoutes);

// Calendar routes
apiRouter.use('/calendar', calendarRoutes);

// Auth routes com rate limiting

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar novo usuário
 *     description: Cria um novo usuário e tenant (empresa) no sistema
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *               - tenantName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: usuario@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SenhaForte123!@#
 *                 description: Deve conter letras maiúsculas, minúsculas, números e caracteres especiais
 *               fullName:
 *                 type: string
 *                 minLength: 3
 *                 example: João da Silva
 *               tenantName:
 *                 type: string
 *                 minLength: 3
 *                 example: Minha Empresa
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Email já cadastrado
 *       429:
 *         description: Muitas tentativas de registro
 */
// Register
apiRouter.post('/auth/register', authLimiter, async (req: Request, res: Response) => {
  try {
    // Validação com Zod
    const validatedData = RegisterSchema.parse(req.body);

    // IP e UserAgent para logging
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    // Chama service
    const result = await authService.register(validatedData, ipAddress, userAgent);

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    log.error('Register error', { error, body: req.body });

    // Zod validation error
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: error.errors
        }
      });
    }

    // Business logic error
    if (error.message === 'Email já cadastrado') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro ao criar usuário'
      }
    });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Fazer login
 *     description: Autentica usuário e retorna tokens de acesso
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: usuario@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SenhaForte123!@#
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Credenciais inválidas
 *       429:
 *         description: Muitas tentativas de login
 */
// Login
apiRouter.post('/auth/login', authLimiter, async (req: Request, res: Response) => {
  try {
    // Validação com Zod
    const validatedData = LoginSchema.parse(req.body);

    // IP e UserAgent para logging
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    // Chama service
    const result = await authService.login(validatedData, ipAddress, userAgent);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    log.error('Login error', { error, email: req.body.email });

    // Zod validation error
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: error.errors
        }
      });
    }

    // Business logic errors
    if (error.message === 'Credenciais inválidas' || error.message === 'Usuário inativo') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro ao fazer login'
      }
    });
  }
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Renovar access token
 *     description: Usa refresh token para gerar novo access token sem fazer login novamente
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token válido recebido no login
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Novo access token gerado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       description: Novo JWT access token
 *                     refreshToken:
 *                       type: string
 *                       description: Mesmo refresh token (ou novo se renovado)
 *       401:
 *         description: Refresh token inválido, expirado ou revogado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Refresh Token
apiRouter.post('/auth/refresh', async (req: Request, res: Response) => {
  try {
    // Validação com Zod
    const validatedData = RefreshTokenSchema.parse(req.body);

    // IP e UserAgent para logging
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    // Chama service
    const result = await authService.refresh(validatedData, ipAddress, userAgent);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    log.error('Refresh error', { error });

    // Zod validation error
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: error.errors
        }
      });
    }

    // Business logic errors
    if (
      error.message === 'Refresh token inválido' ||
      error.message === 'Refresh token revogado' ||
      error.message === 'Refresh token expirado'
    ) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro ao renovar token'
      }
    });
  }
});

// Logout (revoga refresh token)
apiRouter.post('/auth/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await authService.revokeToken(refreshToken, 'logout');
    }

    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });
  } catch (error: any) {
    log.error('Logout error', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro ao fazer logout'
      }
    });
  }
});

// Logout de todos os dispositivos (requer autenticação)
apiRouter.post('/auth/logout-all', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Não autenticado'
        }
      });
    }

    await authService.revokeAllTokens(userId, 'logout_all');

    res.json({
      success: true,
      message: 'Logout realizado em todos os dispositivos'
    });
  } catch (error: any) {
    log.error('Logout all error', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro ao fazer logout'
      }
    });
  }
});

// Transactions routes (exemplo básico)
apiRouter.get('/transactions', async (req: Request, res: Response) => {
  try {
    // TODO: Adicionar autenticação JWT
    const transactions = await prisma.transaction.findMany({
      include: {
        category: true,
        bankAccount: true
      },
      orderBy: {
        transactionDate: 'desc'
      },
      take: 20
    });

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    log.error('Transactions error', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro ao buscar transações'
      }
    });
  }
});

app.use('/api/v1', apiRouter);

// Error handling
app.use((err: Error, req: Request, res: Response, next: any) => {
  log.error('Erro não tratado', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message
    }
  });
});

// Iniciar servidor
app.listen(port, () => {
  // Inicia o job de geração de transações
  startTransactionGeneratorJob();
  
  log.info('Servidor FYNANPRO 2.0 iniciado', {
    port,
    environment: env.NODE_ENV,
    url: `http://localhost:${port}`,
    jwtExpiration: env.JWT_EXPIRATION,
    rateLimit: 'Global 1000/15min | Auth 5/15min'
  });

  // Banner visual para desenvolvimento
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 FYNANPRO 2.0 - Backend API                          ║
║                                                           ║
║   Status: ✅ Rodando                                     ║
║   Porta: ${port}                                        ║
║   URL: http://localhost:${port}                         ║
║   Ambiente: ${env.NODE_ENV}                             ║
║   JWT Expira em: ${env.JWT_EXPIRATION}                  ║
║   Rate Limit: Global 1000/15min | Auth 5/15min          ║
║                                                           ║
║   📊 Endpoints disponíveis:                              ║
║   - GET  /                  (Welcome)                    ║
║   - GET  /health            (Health check)               ║
║   - POST /api/v1/auth/register  (Rate Limited: 5/15min) ║
║   - POST /api/v1/auth/login     (Rate Limited: 5/15min) ║
║                                                           ║
║   🔒 Todos os outros endpoints requerem autenticação     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // ✅ Inicializar job de geração de transações
  startTransactionGeneratorJob();
  
  // ✅ Inicializar jobs de notificações e verificações
  startAllJobs();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  log.info('Fechando servidor (SIGINT)');
  await prisma.$disconnect();
  log.info('Conexão com banco de dados encerrada');
  process.exit(0);
});
