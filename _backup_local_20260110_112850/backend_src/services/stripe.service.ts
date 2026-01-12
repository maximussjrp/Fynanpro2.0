/**
 * Stripe Service - Integração com Stripe Checkout
 * Sistema de cobrança recorrente para assinaturas SaaS
 */

import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { log } from '../utils/logger';

const prisma = new PrismaClient();

// Inicializar Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Mapeamento de planos para Price IDs do Stripe
export const STRIPE_PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_1SgSpkK3zpTQHcWwQOA8Mp9V',
  quarterly: process.env.STRIPE_PRICE_QUARTERLY || 'price_1SgSqVK3zpTQHcWwLnVsgLAN',
  semiannual: process.env.STRIPE_PRICE_SEMIANNUAL || 'price_1SgSrQK3zpTQHcWw5iHI65zs',
  yearly: process.env.STRIPE_PRICE_YEARLY || 'price_1SgSsXK3zpTQHcWwZifoNlOD',
};

// Planos disponíveis
export const PLANS = {
  trial: {
    id: 'trial',
    name: 'Trial',
    price: 0,
    period: 'trial',
    periodLabel: '14 dias grátis',
    stripePriceId: null,
    features: [
      '14 dias grátis',
      'Todas as funcionalidades',
      'Sem cartão de crédito',
    ],
    limits: {
      users: 1,
      bankAccounts: 3,
      hasAdvancedReports: true,
      hasBudget: true,
      hasImport: true,
    }
  },
  monthly: {
    id: 'monthly',
    name: 'Mensal',
    price: 39.90,
    period: 'month',
    periodLabel: 'por mês',
    stripePriceId: STRIPE_PRICE_IDS.monthly,
    features: [
      'Flexível, sem compromisso',
      'Acesso completo ao sistema',
      'Contas bancárias ilimitadas',
      'Transações ilimitadas',
      'Relatórios avançados',
      'Suporte por email',
    ],
    limits: {
      users: 5,
      bankAccounts: -1,
      hasAdvancedReports: true,
      hasBudget: true,
      hasImport: true,
    }
  },
  quarterly: {
    id: 'quarterly',
    name: 'Trimestral',
    price: 107.70,
    pricePerMonth: 35.90,
    period: '3months',
    periodLabel: 'a cada 3 meses',
    savings: 'Economize R$ 12',
    stripePriceId: STRIPE_PRICE_IDS.quarterly,
    features: [
      'Economize R$ 12 no trimestre',
      'Acesso completo ao sistema',
      'Contas bancárias ilimitadas',
      'Transações ilimitadas',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
    limits: {
      users: 5,
      bankAccounts: -1,
      hasAdvancedReports: true,
      hasBudget: true,
      hasImport: true,
    }
  },
  semiannual: {
    id: 'semiannual',
    name: 'Semestral',
    price: 191.40,
    pricePerMonth: 31.90,
    period: '6months',
    periodLabel: 'a cada 6 meses',
    savings: 'Economize R$ 48',
    stripePriceId: STRIPE_PRICE_IDS.semiannual,
    features: [
      'Economize R$ 48 em 6 meses',
      'Acesso completo ao sistema',
      'Contas bancárias ilimitadas',
      'Transações ilimitadas',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
    limits: {
      users: 5,
      bankAccounts: -1,
      hasAdvancedReports: true,
      hasBudget: true,
      hasImport: true,
    }
  },
  yearly: {
    id: 'yearly',
    name: 'Anual',
    price: 335.00,
    pricePerMonth: 27.92,
    period: 'year',
    periodLabel: 'por ano',
    savings: 'Economize R$ 144',
    popular: true,
    stripePriceId: STRIPE_PRICE_IDS.yearly,
    features: [
      '🔥 Melhor custo-benefício',
      'Economize R$ 144 no ano',
      'Acesso completo ao sistema',
      'Contas bancárias ilimitadas',
      'Transações ilimitadas',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
    limits: {
      users: 5,
      bankAccounts: -1,
      hasAdvancedReports: true,
      hasBudget: true,
      hasImport: true,
      importLimit: -1,
      hasTriggerControl: true,
      hasAI: true,
    }
  },
};

export class StripeService {
  /**
   * Criar ou recuperar cliente Stripe
   */
  async getOrCreateCustomer(tenantId: string, email: string, name: string): Promise<string> {
    // Buscar tenant para verificar se já tem customerId
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (tenant?.stripeCustomerId) {
      return tenant.stripeCustomerId;
    }

    // Criar novo cliente no Stripe
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        tenantId,
      },
    });

    // Salvar customerId no tenant
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { stripeCustomerId: customer.id },
    });

    log.info(`Stripe customer criado: ${customer.id} para tenant ${tenantId}`);
    return customer.id;
  }

  /**
   * Criar sessão de Checkout para assinatura
   */
  async createCheckoutSession(params: {
    tenantId: string;
    userId: string;
    email: string;
    name: string;
    planId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; url: string }> {
    const { tenantId, userId, email, name, planId, successUrl, cancelUrl } = params;

    // Validar plano
    const plan = PLANS[planId as keyof typeof PLANS];
    if (!plan || planId === 'trial') {
      throw new Error('Plano inválido');
    }

    // Obter price ID do Stripe (cada plano já tem seu próprio priceId)
    const priceId = (plan as any).stripePriceId;

    if (!priceId) {
      throw new Error('Price ID não configurado para este plano');
    }

    // Obter ou criar cliente
    const customerId = await this.getOrCreateCustomer(tenantId, email, name);

    // Criar sessão de checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        tenantId,
        userId,
        planId,
      },
      subscription_data: {
        metadata: {
          tenantId,
          userId,
          planId,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
    });

    log.info(`Checkout session criada: ${session.id} para tenant ${tenantId}`);

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  /**
   * Criar sessão do Portal de Clientes
   */
  async createPortalSession(tenantId: string, returnUrl: string): Promise<string> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant?.stripeCustomerId) {
      throw new Error('Tenant não possui customer ID do Stripe');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: returnUrl,
    });

    return session.url;
  }

  /**
   * Processar webhook do Stripe
   */
  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET não configurado');
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      log.error(`Erro ao verificar webhook: ${err.message}`);
      throw new Error(`Webhook Error: ${err.message}`);
    }

    log.info(`Webhook recebido: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        log.info(`Evento não tratado: ${event.type}`);
    }
  }

  /**
   * Handler: Checkout completado
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const { tenantId, planId } = session.metadata || {};

    if (!tenantId || !planId) {
      log.error('Metadata incompleta no checkout session');
      return;
    }

    const subscriptionId = session.subscription as string;

    // Buscar subscription para obter price ID
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price?.id;

    // Atualizar tenant com informações da assinatura
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionPlan: planId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
        subscriptionStatus: 'active',
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    log.info(`Assinatura ativada para tenant ${tenantId}: plano ${planId}`);
  }

  /**
   * Handler: Invoice paga
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = invoice.subscription as string;

    if (!subscriptionId) return;

    // Buscar subscription para obter metadata
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const tenantId = subscription.metadata?.tenantId;

    if (!tenantId) {
      log.error('TenantId não encontrado na subscription');
      return;
    }

    // Atualizar data de vencimento
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: 'active',
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    log.info(`Pagamento recebido para tenant ${tenantId}`);
  }

  /**
   * Handler: Falha no pagamento
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = invoice.subscription as string;

    if (!subscriptionId) return;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const tenantId = subscription.metadata?.tenantId;

    if (!tenantId) return;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: 'past_due',
      },
    });

    log.warn(`Pagamento falhou para tenant ${tenantId}`);
    // TODO: Enviar email de notificação
  }

  /**
   * Handler: Subscription atualizada
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata?.tenantId;

    if (!tenantId) return;

    const status = subscription.status === 'active' ? 'active' 
                  : subscription.status === 'past_due' ? 'past_due'
                  : subscription.status === 'canceled' ? 'canceled'
                  : subscription.status;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: status,
      },
    });

    log.info(`Subscription atualizada para tenant ${tenantId}: ${status}`);
  }

  /**
   * Handler: Subscription cancelada
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata?.tenantId;

    if (!tenantId) return;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: 'cancelled',
        subscriptionPlan: 'trial', // Voltar para trial
        stripeSubscriptionId: null,
        stripePriceId: null,
        stripeCurrentPeriodEnd: null,
      },
    });

    log.info(`Assinatura cancelada para tenant ${tenantId}`);
  }

  /**
   * Calcular data de término da assinatura
   */
  private calculateEndDate(billingPeriod: string): Date {
    const now = new Date();
    if (billingPeriod === 'yearly') {
      now.setFullYear(now.getFullYear() + 1);
    } else {
      now.setMonth(now.getMonth() + 1);
    }
    return now;
  }

  /**
   * Obter status da assinatura
   */
  async getSubscriptionStatus(tenantId: string): Promise<{
    plan: string;
    status: string;
    endDate: Date | null;
    canUpgrade: boolean;
    trialEndsAt?: Date | null;
    daysRemaining?: number;
    isActive: boolean;
  }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      throw new Error('Tenant não encontrado');
    }

    const plan = tenant.subscriptionPlan || 'trial';
    const status = tenant.subscriptionStatus || 'active';
    
    // Calculate trial days remaining
    let trialEndsAt: Date | null = null;
    let daysRemaining: number | undefined = undefined;
    
    if (plan === 'trial') {
      // Trial period is 14 days from account creation
      const trialDays = 14;
      trialEndsAt = new Date(tenant.createdAt);
      trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
      
      const now = new Date();
      const diffTime = trialEndsAt.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Ensure at least 0 days
      if (daysRemaining < 0) daysRemaining = 0;
    }

    return {
      plan,
      status,
      endDate: tenant.stripeCurrentPeriodEnd,
      canUpgrade: plan === 'trial' || plan !== 'yearly',
      trialEndsAt,
      daysRemaining,
      isActive: status === 'active' && (plan !== 'trial' || (daysRemaining !== undefined && daysRemaining > 0)),
    };
  }

  /**
   * Cancelar assinatura
   */
  async cancelSubscription(tenantId: string): Promise<void> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant?.stripeSubscriptionId) {
      throw new Error('Tenant não possui assinatura ativa');
    }

    await stripe.subscriptions.cancel(tenant.stripeSubscriptionId);

    log.info(`Assinatura cancelada para tenant ${tenantId}`);
  }

  /**
   * Listar planos disponíveis
   */
  getPlans() {
    return Object.values(PLANS).map(plan => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      pricePerMonth: (plan as any).pricePerMonth,
      period: (plan as any).period,
      periodLabel: (plan as any).periodLabel,
      savings: (plan as any).savings,
      popular: (plan as any).popular,
      features: plan.features,
      limits: plan.limits,
    }));
  }
}

export const stripeService = new StripeService();
