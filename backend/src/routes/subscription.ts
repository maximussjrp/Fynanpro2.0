/**
 * Rotas de Pagamento e Assinatura
 * Gerenciamento de planos, checkout e webhooks
 */

import { Router, Request, Response } from 'express';
import { paymentService, PLANS } from '../services/payment.service';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { log } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * /subscription/plans:
 *   get:
 *     summary: Listar planos disponíveis
 *     tags: [Subscription]
 *     responses:
 *       200:
 *         description: Lista de planos
 */
router.get('/plans', (req: Request, res: Response) => {
  try {
    const plans = paymentService.getPlans();
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    log.error('Erro ao listar planos', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro ao listar planos' }
    });
  }
});

/**
 * @swagger
 * /subscription/current:
 *   get:
 *     summary: Obter assinatura atual
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 */
router.get('/current', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const data = await paymentService.getSubscription(tenantId);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    log.error('Erro ao obter assinatura', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro ao obter assinatura' }
    });
  }
});

/**
 * @swagger
 * /subscription/checkout:
 *   post:
 *     summary: Criar checkout para assinatura
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *               - billingCycle
 *             properties:
 *               planId:
 *                 type: string
 *                 enum: [basic, plus, premium, business]
 *               billingCycle:
 *                 type: string
 *                 enum: [monthly, yearly]
 *               billingType:
 *                 type: string
 *                 enum: [CREDIT_CARD, BOLETO, PIX]
 */
router.post('/checkout', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { planId, billingCycle, billingType = 'PIX' } = req.body;

    if (!planId || !billingCycle) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'planId e billingCycle são obrigatórios' }
      });
    }

    if (!PLANS[planId as keyof typeof PLANS]) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PLAN', message: 'Plano inválido' }
      });
    }

    const checkout = await paymentService.createCheckout(
      tenantId,
      userId,
      planId,
      billingCycle,
      billingType
    );

    res.json({
      success: true,
      data: checkout
    });
  } catch (error: any) {
    log.error('Erro ao criar checkout', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { code: 'CHECKOUT_ERROR', message: error.message || 'Erro ao criar checkout' }
    });
  }
});

/**
 * @swagger
 * /subscription/checkout/credit-card:
 *   post:
 *     summary: Checkout com cartão de crédito
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 */
router.post('/checkout/credit-card', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { planId, billingCycle, creditCard, creditCardHolderInfo } = req.body;

    if (!planId || !billingCycle || !creditCard || !creditCardHolderInfo) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dados incompletos' }
      });
    }

    const result = await paymentService.createCreditCardCheckout(
      tenantId,
      userId,
      planId,
      billingCycle,
      creditCard,
      creditCardHolderInfo
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    log.error('Erro no checkout com cartão', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { code: 'PAYMENT_ERROR', message: error.message || 'Erro no pagamento' }
    });
  }
});

/**
 * @swagger
 * /subscription/cancel:
 *   post:
 *     summary: Cancelar assinatura
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 */
router.post('/cancel', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { reason } = req.body;

    const result = await paymentService.cancelSubscription(tenantId, reason);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    log.error('Erro ao cancelar assinatura', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { code: 'CANCEL_ERROR', message: error.message || 'Erro ao cancelar' }
    });
  }
});

/**
 * @swagger
 * /subscription/webhook:
 *   post:
 *     summary: Webhook do Asaas
 *     tags: [Subscription]
 *     description: Endpoint para receber notificações do Asaas
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { event, payment } = req.body;

    // Validar token do webhook (opcional, mas recomendado)
    const webhookToken = req.headers['asaas-access-token'];
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
    
    if (expectedToken && webhookToken !== expectedToken) {
      log.warn('Webhook com token inválido', { event });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    log.info('Webhook recebido', { event, paymentId: payment?.id });

    if (payment) {
      await paymentService.handleWebhook(event, payment);
    }

    // Asaas espera 200 OK
    res.status(200).json({ received: true });
  } catch (error) {
    log.error('Erro ao processar webhook', { error });
    // Retornar 200 mesmo com erro para não reprocessar
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

/**
 * @swagger
 * /subscription/check-trial:
 *   get:
 *     summary: Verificar se trial expirou
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 */
router.get('/check-trial', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const expired = await paymentService.checkTrialExpiration(tenantId);
    
    res.json({
      success: true,
      data: { trialExpired: expired }
    });
  } catch (error) {
    log.error('Erro ao verificar trial', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro ao verificar trial' }
    });
  }
});

// =============================================================================
// STRIPE ROUTES - Integração alternativa com Stripe
// =============================================================================

import { stripeService, PLANS as STRIPE_PLANS } from '../services/stripe.service';

/**
 * @swagger
 * /subscription/stripe/plans:
 *   get:
 *     summary: Listar planos Stripe disponíveis
 *     tags: [Subscription - Stripe]
 */
router.get('/stripe/plans', (req: Request, res: Response) => {
  try {
    const plans = stripeService.getPlans();
    res.json({
      success: true,
      data: { plans }
    });
  } catch (error) {
    log.error('Erro ao listar planos Stripe', { error });
    res.status(500).json({
      success: false,
      error: { code: 'STRIPE_ERROR', message: 'Erro ao listar planos' }
    });
  }
});

/**
 * @swagger
 * /subscription/stripe/checkout:
 *   post:
 *     summary: Criar sessão de checkout Stripe
 *     tags: [Subscription - Stripe]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *               - billingPeriod
 *             properties:
 *               planId:
 *                 type: string
 *                 enum: [trial, basic, plus, premium]
 *               billingPeriod:
 *                 type: string
 *                 enum: [monthly, yearly]
 */
router.post('/stripe/checkout', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { planId } = req.body;
    const userId = req.userId!;
    const tenantId = req.tenantId!;

    if (!planId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'planId é obrigatório' }
      });
    }

    // Buscar dados do usuário
    const { prisma } = await import('../main');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Usuário não encontrado' }
      });
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://utopsistema.com.br';

    const session = await stripeService.createCheckoutSession({
      tenantId,
      userId,
      email: user.email,
      name: user.fullName || user.email,
      planId,
      successUrl: `${baseUrl}/dashboard/plans?success=true`,
      cancelUrl: `${baseUrl}/dashboard/plans?canceled=true`,
    });

    res.json({
      success: true,
      data: session
    });
  } catch (error: any) {
    log.error('Erro ao criar checkout Stripe', { error: error.message, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { code: 'CHECKOUT_ERROR', message: error.message || 'Erro ao criar sessão de checkout' }
    });
  }
});

/**
 * @swagger
 * /subscription/stripe/portal:
 *   post:
 *     summary: Criar sessão do portal de clientes Stripe
 *     tags: [Subscription - Stripe]
 *     security:
 *       - bearerAuth: []
 */
router.post('/stripe/portal', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const baseUrl = process.env.FRONTEND_URL || 'https://utopsistema.com.br';

    const portalUrl = await stripeService.createPortalSession(
      tenantId,
      `${baseUrl}/dashboard/plans`
    );

    res.json({
      success: true,
      data: { url: portalUrl }
    });
  } catch (error: any) {
    log.error('Erro ao criar portal Stripe', { error: error.message, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { code: 'PORTAL_ERROR', message: error.message || 'Erro ao criar sessão do portal' }
    });
  }
});

/**
 * @swagger
 * /subscription/stripe/status:
 *   get:
 *     summary: Obter status da assinatura Stripe
 *     tags: [Subscription - Stripe]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stripe/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const status = await stripeService.getSubscriptionStatus(tenantId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    log.error('Erro ao obter status Stripe', { error: error.message, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { code: 'STATUS_ERROR', message: 'Erro ao obter status da assinatura' }
    });
  }
});

/**
 * @swagger
 * /subscription/stripe/cancel:
 *   post:
 *     summary: Cancelar assinatura Stripe
 *     tags: [Subscription - Stripe]
 *     security:
 *       - bearerAuth: []
 */
router.post('/stripe/cancel', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    await stripeService.cancelSubscription(tenantId);
    
    res.json({
      success: true,
      data: { message: 'Assinatura cancelada com sucesso' }
    });
  } catch (error: any) {
    log.error('Erro ao cancelar assinatura Stripe', { error: error.message, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { code: 'CANCEL_ERROR', message: error.message || 'Erro ao cancelar assinatura' }
    });
  }
});

/**
 * @swagger
 * /subscription/stripe/webhook:
 *   post:
 *     summary: Webhook do Stripe
 *     tags: [Subscription - Stripe]
 *     description: Endpoint para receber notificações do Stripe (requer raw body)
 */
// NOTA: Este webhook precisa de express.raw() configurado. Veja stripe-webhook.ts para uma versão separada.
router.post('/stripe/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      log.warn('Webhook Stripe recebido sem assinatura');
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_SIGNATURE', message: 'Stripe signature missing' }
      });
    }

    // Para funcionar corretamente, o body precisa ser raw buffer
    // Se não for, o webhook não vai validar
    let rawBody = req.body;
    if (typeof rawBody === 'object' && !Buffer.isBuffer(rawBody)) {
      rawBody = Buffer.from(JSON.stringify(rawBody));
    }

    await stripeService.handleWebhook(rawBody, signature);

    res.json({ received: true });
  } catch (error: any) {
    log.error('Erro ao processar webhook Stripe', { error: error.message });
    res.status(400).json({
      success: false,
      error: { code: 'WEBHOOK_ERROR', message: error.message }
    });
  }
});

export default router;
