/**
 * Stripe Service - Integração com Stripe Checkout
 * Sistema de cobrança recorrente para assinaturas SaaS
 */

import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { log } from '../utils/logger';
import { MONTHLY_PLAN_PRICE_REAIS, QUARTERLY_PLAN_PRICE_REAIS, QUARTERLY_PLAN_PRICE_PER_MONTH_REAIS, QUARTERLY_PLAN_SAVINGS_REAIS, SEMIANNUAL_PLAN_PRICE_REAIS, SEMIANNUAL_PLAN_PRICE_PER_MONTH_REAIS, SEMIANNUAL_PLAN_SAVINGS_REAIS, YEARLY_PLAN_PRICE_REAIS, YEARLY_PLAN_PRICE_PER_MONTH_REAIS, YEARLY_PLAN_SAVINGS_REAIS } from '../config/pricing';

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
  founder: process.env.STRIPE_PRICE_FOUNDER || 'price_1SqMKZK3zpTQHcWwQTZWCLoI',
};

// Limite de fundadores
export const FOUNDER_LIMIT = parseInt(process.env.FOUNDER_LIMIT || '26', 10);

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
  founder: {
    id: 'founder',
    name: 'Fundador Vitalício',
    price: 197.00,
    period: 'lifetime',
    periodLabel: 'pagamento único',
    stripePriceId: STRIPE_PRICE_IDS.founder,
    popular: true,
    limited: true,
    maxUsers: FOUNDER_LIMIT,
    features: [
      '🏆 Membro Fundador',
      '♾️ Acesso VITALÍCIO',
      'Nunca mais pague mensalidade',
      'Contas bancárias ilimitadas',
      'Transações ilimitadas',
      'Relatórios avançados',
      'Suporte prioritário VIP',
      'Todas as futuras atualizações',
    ],
    limits: {
      users: 10,
      bankAccounts: -1,
      hasAdvancedReports: true,
      hasBudget: true,
      hasImport: true,
      importLimit: -1,
      hasTriggerControl: true,
      hasAI: true,
    }
  },
  monthly: {
    id: 'monthly',
    name: 'Mensal',
    // Fonte única de verdade: backend/src/config/pricing.ts (R$ 79,90).
    price: MONTHLY_PLAN_PRICE_REAIS,
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
    price: QUARTERLY_PLAN_PRICE_REAIS,
    pricePerMonth: QUARTERLY_PLAN_PRICE_PER_MONTH_REAIS,
    period: '3months',
    periodLabel: 'a cada 3 meses',
    savings: `Economize R$ ${QUARTERLY_PLAN_SAVINGS_REAIS.toFixed(2).replace('.', ',')}`,
    stripePriceId: STRIPE_PRICE_IDS.quarterly,
    features: [
      `Economize R$ ${QUARTERLY_PLAN_SAVINGS_REAIS.toFixed(2).replace('.', ',')} no trimestre`,
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
    price: SEMIANNUAL_PLAN_PRICE_REAIS,
    pricePerMonth: SEMIANNUAL_PLAN_PRICE_PER_MONTH_REAIS,
    period: '6months',
    periodLabel: 'a cada 6 meses',
    savings: `Economize R$ ${SEMIANNUAL_PLAN_SAVINGS_REAIS.toFixed(2).replace('.', ',')}`,
    stripePriceId: STRIPE_PRICE_IDS.semiannual,
    features: [
      `Economize R$ ${SEMIANNUAL_PLAN_SAVINGS_REAIS.toFixed(2).replace('.', ',')} em 6 meses`,
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
    price: YEARLY_PLAN_PRICE_REAIS,
    pricePerMonth: YEARLY_PLAN_PRICE_PER_MONTH_REAIS,
    period: 'year',
    periodLabel: 'por ano',
    savings: `Economize R$ ${YEARLY_PLAN_SAVINGS_REAIS.toFixed(2).replace('.', ',')}`,
    stripePriceId: STRIPE_PRICE_IDS.yearly,
    features: [
      `Economize R$ ${YEARLY_PLAN_SAVINGS_REAIS.toFixed(2).replace('.', ',')} no ano`,
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
   * Contar quantos fundadores já existem
   */
  async countFounders(): Promise<number> {
    const count = await prisma.tenant.count({
      where: {
        subscriptionPlan: 'founder',
        subscriptionStatus: 'active',
      }
    });
    return count;
  }

  /**
   * Verificar se ainda há vagas de fundador
   */
  async hasFounderSlots(): Promise<{ available: boolean; remaining: number; total: number }> {
    const count = await this.countFounders();
    const remaining = FOUNDER_LIMIT - count;
    return {
      available: remaining > 0,
      remaining: Math.max(0, remaining),
      total: FOUNDER_LIMIT,
    };
  }

  /**
   * Criar ou recuperar cliente Stripe
   */
  async getOrCreateCustomer(tenantId: string, email: string, name: string): Promise<string> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (tenant?.stripeCustomerId) {
      return tenant.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        tenantId,
      },
    });

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

    const plan = PLANS[planId as keyof typeof PLANS];
    if (!plan || planId === 'trial') {
      throw new Error('Plano inválido');
    }

    // Verificar limite de fundadores
    if (planId === 'founder') {
      const slots = await this.hasFounderSlots();
      if (!slots.available) {
        throw new Error('Desculpe! Todas as vagas de Fundador foram preenchidas. O plano Fundador Vitalício está esgotado.');
      }
    }

    const priceId = (plan as any).stripePriceId;
    if (!priceId) {
      throw new Error('Price ID não configurado para este plano');
    }

    const customerId = await this.getOrCreateCustomer(tenantId, email, name);

    // Para plano fundador (lifetime), usar mode 'payment' ao invés de 'subscription'
    const isLifetime = planId === 'founder';

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: isLifetime ? 'payment' : 'subscription',
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
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
    };

    // Adicionar metadata na subscription apenas se não for lifetime
    if (!isLifetime) {
      sessionConfig.subscription_data = {
        metadata: {
          tenantId,
          userId,
          planId,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    log.info(`Checkout session criada: ${session.id} para tenant ${tenantId}, plano ${planId}`);

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

    // Para plano Fundador (lifetime/payment), tratar diferente
    if (planId === 'founder') {
      // Verificar novamente se há vagas (proteção contra race condition)
      const slots = await this.hasFounderSlots();
      if (!slots.available) {
        log.error(`Tentativa de ativar founder sem vagas disponíveis para tenant ${tenantId}`);
        // TODO: Processar reembolso automático
        return;
      }

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionPlan: 'founder',
          subscriptionStatus: 'active',
          stripeCurrentPeriodEnd: null, // Lifetime não tem data de expiração
        },
      });

      log.info(`🏆 Fundador Vitalício ativado para tenant ${tenantId}! Vagas restantes: ${slots.remaining - 1}`);
      return;
    }

    // Para assinaturas normais
    const subscriptionId = session.subscription as string;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price?.id;

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

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const tenantId = subscription.metadata?.tenantId;

    if (!tenantId) {
      log.error('TenantId não encontrado na subscription');
      return;
    }

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

    // Não rebaixar Fundadores - eles são vitalícios
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant?.subscriptionPlan === 'founder') {
      log.info(`Ignorando cancelamento de subscription para Fundador ${tenantId}`);
      return;
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: 'cancelled',
        subscriptionPlan: 'trial',
        stripeSubscriptionId: null,
        stripePriceId: null,
        stripeCurrentPeriodEnd: null,
      },
    });

    log.info(`Assinatura cancelada para tenant ${tenantId}`);
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
    isFounder?: boolean;
    isLifetime?: boolean;
  }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      throw new Error('Tenant não encontrado');
    }

    const plan = tenant.subscriptionPlan || 'trial';
    const status = tenant.subscriptionStatus || 'active';
    const isFounder = plan === 'founder';

    let trialEndsAt: Date | null = null;
    let daysRemaining: number | undefined = undefined;

    if (plan === 'trial') {
      const trialDays = 14;
      trialEndsAt = new Date(tenant.createdAt);
      trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

      const now = new Date();
      const diffTime = trialEndsAt.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysRemaining < 0) daysRemaining = 0;
    }

    return {
      plan,
      status,
      endDate: isFounder ? null : tenant.stripeCurrentPeriodEnd,
      canUpgrade: plan === 'trial',
      trialEndsAt,
      daysRemaining,
      isActive: status === 'active' && (plan !== 'trial' || (daysRemaining !== undefined && daysRemaining > 0)),
      isFounder,
      isLifetime: isFounder,
    };
  }

  /**
   * Cancelar assinatura
   */
  async cancelSubscription(tenantId: string): Promise<void> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    // Fundadores não podem cancelar - é vitalício!
    if (tenant?.subscriptionPlan === 'founder') {
      throw new Error('Plano Fundador Vitalício não pode ser cancelado. Você tem acesso para sempre!');
    }

    if (!tenant?.stripeSubscriptionId) {
      throw new Error('Tenant não possui assinatura ativa');
    }

    await stripe.subscriptions.cancel(tenant.stripeSubscriptionId);

    log.info(`Assinatura cancelada para tenant ${tenantId}`);
  }

  /**
   * Listar planos disponíveis
   */
  async getPlans() {
    const founderSlots = await this.hasFounderSlots();
    
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
      // Infos específicas do plano fundador
      ...(plan.id === 'founder' ? {
        limited: true,
        maxUsers: FOUNDER_LIMIT,
        remainingSlots: founderSlots.remaining,
        soldOut: !founderSlots.available,
      } : {}),
    }));
  }
}

export const stripeService = new StripeService();
