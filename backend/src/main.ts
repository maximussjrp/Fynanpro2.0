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
import notificationRoutes from './routes/notifications';
import importRoutes from './routes/import';
import chatbotRoutes from './routes/chatbot';
import adminRoutes from './routes/admin';
import planningRoutes from './routes/planning';
import subscriptionRoutes from './routes/subscription';
import energyGovernanceRoutes from './routes/energy-governance';
import userProfileRoutes from './routes/user-profiles';
import lgpdRoutes from './routes/lgpd.routes';
import { createDefaultCategories } from './utils/default-categories';
import { env } from './config/env';
import { swaggerSpec } from './config/swagger';
import { startTransactionGeneratorJob } from './jobs/transaction-generator.job';
import { startAllJobs } from './jobs/notification.job';
import { authService } from './services/auth.service';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from './dtos/auth.dto';
import { log, httpLogger } from './utils/logger';
import { subscriptionMiddlewareWithExemptions } from './middleware/subscription';
import { authMiddleware } from './middleware/auth';

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

// Confiar em proxy reverso (nginx) para obter IP real
app.set('trust proxy', 1);

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

// CORS - permitir múltiplas origens
const allowedOrigins = [
  env.FRONTEND_URL,
  'https://utop.app.br',
  'https://www.utop.app.br',
  'https://utopsistema.com.br',
  'https://www.utopsistema.com.br',
  'https://api.utopsistema.com.br',
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sem origin (como mobile apps ou curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS bloqueado para origem: ${origin}`);
      callback(null, true); // Temporariamente permitir todas para debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400
}));

// Stripe webhook precisa do body raw (antes do express.json())
// Configurar express.json() para NÃO parsear a rota do webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/api/v1/subscription/stripe/webhook') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// Rotas
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: '🚀 UTOP API está rodando!',
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
  customSiteTitle: 'UTOP API Docs',
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

// Middleware de verificação de assinatura (com exceções para rotas de pagamento)
// Aplica verificação apenas em rotas que requerem autenticação
apiRouter.use((req, res, next) => {
  // Rotas públicas que não precisam de verificação de assinatura
  const publicRoutes = ['/auth', '/subscription/plans', '/subscription/webhook', '/lgpd/policy'];
  const isPublic = publicRoutes.some(route => req.path.startsWith(route));
  
  if (isPublic) {
    return next();
  }
  
  // Se não é rota pública, aplicar middleware de assinatura
  return subscriptionMiddlewareWithExemptions(req as any, res, next);
});

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

// Energy Governance routes (classificação semântica de categorias)
apiRouter.use('/energy-governance', energyGovernanceRoutes);

// Calendar routes
apiRouter.use('/calendar', calendarRoutes);

// Notifications routes
apiRouter.use('/notifications', notificationRoutes);

// Imports routes (CSV, OFX, etc)
apiRouter.use('/import', importRoutes);

// Chatbot routes (Isis)
apiRouter.use('/chatbot', chatbotRoutes);

// Admin routes (super_master only)
apiRouter.use('/admin', adminRoutes);

// Planning routes (planejamento anual)
apiRouter.use('/planning', planningRoutes);

// Subscription routes (planos e pagamentos)
apiRouter.use('/subscription', subscriptionRoutes);

// User Profile routes (perfis de usuário - CPF/CNPJ)
apiRouter.use('/profiles', userProfileRoutes);

// LGPD routes (política pública + rotas privadas com auth próprio)
apiRouter.use('/lgpd', lgpdRoutes);

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

// Verificar email
apiRouter.get('/auth/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Token não fornecido' }
      });
    }

    const result = await authService.verifyEmail(token);

    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: { message: result.message } });
    }
  } catch (error) {
    log.error('Verify email error', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro ao verificar email' }
    });
  }
});

// Reenviar email de verificação
apiRouter.post('/auth/resend-verification', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Email não fornecido' }
      });
    }

    const result = await authService.resendVerificationEmail(email);

    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: { message: result.message } });
    }
  } catch (error) {
    log.error('Resend verification error', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro ao reenviar email' }
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
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    // Validação com Zod
    const validatedData = LoginSchema.parse(req.body);

    // Verifica se usuário está bloqueado por muitas tentativas
    const blockStatus = await authService.isLoginBlocked(validatedData.email);
    if (blockStatus.blocked) {
      const minutes = blockStatus.remainingTime ? Math.ceil(blockStatus.remainingTime / 60) : 15;
      return res.status(429).json({
        success: false,
        error: {
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
          message: `Muitas tentativas de login/registro. Tente novamente em ${minutes} minutos.`
        }
      });
    }

    // IP e UserAgent para logging
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    // Chama service
    const result = await authService.login(validatedData, ipAddress, userAgent);
    
    // Limpa tentativas após login bem-sucedido
    await authService.clearFailedLogins(validatedData.email);

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
      // Registra tentativa falha para rate limiting
      await authService.recordFailedLogin(req.body.email);
      
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

// Esqueci minha senha - envia email com link de reset
apiRouter.post('/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email é obrigatório'
        }
      });
    }

    await authService.forgotPassword(email);

    // Sempre retorna sucesso (por segurança, não revela se email existe)
    res.json({
      success: true,
      message: 'Se o email estiver cadastrado, você receberá um link para redefinir sua senha.'
    });
  } catch (error: any) {
    log.error('Forgot password error', { error, email: req.body.email });
    
    // Sempre retorna sucesso (por segurança)
    res.json({
      success: true,
      message: 'Se o email estiver cadastrado, você receberá um link para redefinir sua senha.'
    });
  }
});

// Reset de senha com token
apiRouter.post('/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Token e nova senha são obrigatórios'
        }
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A senha deve ter pelo menos 6 caracteres'
        }
      });
    }

    await authService.resetPassword(token, newPassword);

    res.json({
      success: true,
      message: 'Senha alterada com sucesso! Você já pode fazer login.'
    });
  } catch (error: any) {
    log.error('Reset password error', { error });

    if (error.message === 'Token inválido ou expirado') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Link inválido ou expirado. Solicite um novo link de recuperação.'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro ao redefinir senha'
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
  
  log.info('Servidor UTOP iniciado', {
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
║   🚀 UTOP - Backend API                                   ║
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
