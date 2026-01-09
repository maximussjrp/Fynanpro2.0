/**
 * Payment Service - Integração com Asaas
 * Sistema de cobrança recorrente para assinaturas SaaS
 */

import { PrismaClient } from '@prisma/client';
import { log } from '../utils/logger';
import { clearSubscriptionCache } from '../middleware/subscription';

const prisma = new PrismaClient();

// Configuração Asaas
const ASAAS_API_URL = process.env.ASAAS_SANDBOX === 'true' 
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';

// Planos disponíveis
export const PLANS = {
  trial: {
    id: 'trial',
    name: 'Trial',
    price: 0,
    priceYearly: 0,
    features: [
      '14 dias grátis',
      'Todas funcionalidades do Básico',
      'Sem cartão de crédito',
    ],
    limits: {
      users: 1,
      bankAccounts: 3,
      hasAdvancedReports: false,
      hasBudget: false,
      hasImport: false,
    }
  },
  basic: {
    id: 'basic',
    name: 'Básico',
    price: 9.90,
    priceYearly: 99.00,
    features: [
      '1 usuário',
      'Até 3 contas bancárias',
      'Transações ilimitadas',
      'Categorias hierárquicas',
      'Contas fixas recorrentes',
      'Dashboard básico',
    ],
    limits: {
      users: 1,
      bankAccounts: 3,
      hasAdvancedReports: false,
      hasBudget: false,
      hasImport: false,
    }
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    price: 19.90,
    priceYearly: 199.00,
    features: [
      'Até 2 usuários',
      'Contas bancárias ilimitadas',
      'Orçamento mensal',
      'Projeção de fluxo de caixa',
      'Relatórios avançados',
      'Importação de extrato',
    ],
    limits: {
      users: 2,
      bankAccounts: -1, // ilimitado
      hasAdvancedReports: true,
      hasBudget: true,
      hasImport: true,
      importLimit: 100,
    }
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 34.90,
    priceYearly: 349.00,
    features: [
      'Até 5 usuários',
      'Tudo do Plus',
      'Controle de gastos gatilho',
      'Projeção anual',
      'IA para categorização',
      'Suporte prioritário',
    ],
    limits: {
      users: 5,
      bankAccounts: -1,
      hasAdvancedReports: true,
      hasBudget: true,
      hasImport: true,
      importLimit: -1, // ilimitado
      hasTriggerControl: true,
      hasAI: true,
    }
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 99.00,
    priceYearly: 990.00,
    features: [
      'Usuários ilimitados',
      'Multi-tenant',
      'White-label',
      'API de integração',
      'Suporte dedicado',
      'SLA 99.9%',
    ],
    limits: {
      users: -1, // ilimitado
      bankAccounts: -1,
      hasAdvancedReports: true,
      hasBudget: true,
      hasImport: true,
      importLimit: -1,
      hasTriggerControl: true,
      hasAI: true,
      hasAPI: true,
      hasWhiteLabel: true,
    }
  }
};

interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
}

interface AsaasSubscription {
  id: string;
  customer: string;
  value: number;
  billingType: 'CREDIT_CARD' | 'BOLETO' | 'PIX';
  cycle: 'MONTHLY' | 'YEARLY';
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'OVERDUE';
}

interface AsaasPayment {
  id: string;
  customer: string;
  subscription?: string;
  value: number;
  billingType: string;
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'CANCELLED';
  dueDate: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCodeUrl?: string;
  pixCopiaECola?: string;
}

async function asaasRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
  const response = await fetch(`${ASAAS_API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json() as { errors?: Array<{ description?: string }> };
    log.error('Asaas API Error', { endpoint, error });
    throw new Error(error.errors?.[0]?.description || 'Erro na API Asaas');
  }

  return response.json();
}

export const paymentService = {
  /**
   * Buscar ou criar cliente no Asaas
   */
  async findOrCreateCustomer(tenantId: string, userId: string): Promise<AsaasCustomer> {
    // Buscar dados do usuário e tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { owner: true }
    });

    if (!tenant) throw new Error('Tenant não encontrado');

    // Verificar se já tem asaasCustomerId
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId }
    });

    if (subscription?.asaasCustomerId) {
      // Buscar cliente existente
      try {
        const customer = await asaasRequest(`/customers/${subscription.asaasCustomerId}`);
        return customer;
      } catch (e) {
        // Cliente não existe mais, criar novo
        log.warn('Cliente Asaas não encontrado, criando novo', { error: e });
      }
    }

    // Criar novo cliente no Asaas
    const customer = await asaasRequest('/customers', 'POST', {
      name: tenant.owner.fullName,
      email: tenant.owner.email,
      externalReference: tenantId,
    });

    return customer;
  },

  /**
   * Criar checkout para assinatura
   */
  async createCheckout(
    tenantId: string,
    userId: string,
    planId: string,
    billingCycle: 'monthly' | 'yearly',
    billingType: 'CREDIT_CARD' | 'BOLETO' | 'PIX' = 'CREDIT_CARD'
  ) {
    const plan = PLANS[planId as keyof typeof PLANS];
    if (!plan) throw new Error('Plano não encontrado');

    const customer = await this.findOrCreateCustomer(tenantId, userId);

    const value = billingCycle === 'yearly' ? plan.priceYearly : plan.price;
    const cycle = billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY';

    // Criar assinatura no Asaas
    const subscription = await asaasRequest('/subscriptions', 'POST', {
      customer: customer.id,
      billingType,
      cycle,
      value,
      description: `UTOP - Plano ${plan.name}`,
      externalReference: `${tenantId}:${planId}`,
    });

    // Salvar assinatura no banco
    await prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId,
        plan: planId,
        billingCycle,
        status: 'pending',
        asaasCustomerId: customer.id,
        asaasSubscriptionId: subscription.id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: this.calculatePeriodEnd(billingCycle),
      },
      update: {
        planId,
        plan: planId,
        billingCycle,
        status: 'pending',
        asaasCustomerId: customer.id,
        asaasSubscriptionId: subscription.id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: this.calculatePeriodEnd(billingCycle),
      }
    });

    // Buscar primeiro pagamento (gerado automaticamente pelo Asaas)
    const payments = await asaasRequest(`/subscriptions/${subscription.id}/payments`);
    const firstPayment = payments.data?.[0];

    return {
      subscriptionId: subscription.id,
      paymentId: firstPayment?.id,
      invoiceUrl: firstPayment?.invoiceUrl,
      bankSlipUrl: firstPayment?.bankSlipUrl,
      pixQrCodeUrl: firstPayment?.pixQrCodeUrl,
      pixCopiaECola: firstPayment?.pixCopiaECola,
      value,
      dueDate: firstPayment?.dueDate,
    };
  },

  /**
   * Criar checkout com cartão de crédito (tokenizado)
   */
  async createCreditCardCheckout(
    tenantId: string,
    userId: string,
    planId: string,
    billingCycle: 'monthly' | 'yearly',
    creditCard: {
      holderName: string;
      number: string;
      expiryMonth: string;
      expiryYear: string;
      ccv: string;
    },
    creditCardHolderInfo: {
      name: string;
      email: string;
      cpfCnpj: string;
      postalCode: string;
      addressNumber: string;
      phone: string;
    }
  ) {
    const plan = PLANS[planId as keyof typeof PLANS];
    if (!plan) throw new Error('Plano não encontrado');

    const customer = await this.findOrCreateCustomer(tenantId, userId);

    const value = billingCycle === 'yearly' ? plan.priceYearly : plan.price;
    const cycle = billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY';

    // Criar assinatura com cartão
    const subscription = await asaasRequest('/subscriptions', 'POST', {
      customer: customer.id,
      billingType: 'CREDIT_CARD',
      cycle,
      value,
      description: `UTOP - Plano ${plan.name}`,
      externalReference: `${tenantId}:${planId}`,
      creditCard: {
        holderName: creditCard.holderName,
        number: creditCard.number,
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv,
      },
      creditCardHolderInfo,
    });

    // Salvar assinatura no banco
    await prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId,
        plan: planId,
        billingCycle,
        status: subscription.status === 'ACTIVE' ? 'active' : 'pending',
        asaasCustomerId: customer.id,
        asaasSubscriptionId: subscription.id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: this.calculatePeriodEnd(billingCycle),
      },
      update: {
        planId,
        plan: planId,
        billingCycle,
        status: subscription.status === 'ACTIVE' ? 'active' : 'pending',
        asaasCustomerId: customer.id,
        asaasSubscriptionId: subscription.id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: this.calculatePeriodEnd(billingCycle),
      }
    });

    // Atualizar plano do tenant se aprovado
    if (subscription.status === 'ACTIVE') {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionPlan: planId,
          subscriptionStatus: 'active',
        }
      });
    }

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      success: subscription.status === 'ACTIVE',
    };
  },

  /**
   * Processar webhook do Asaas
   */
  async handleWebhook(event: string, payment: AsaasPayment) {
    log.info('Webhook Asaas recebido', { event, paymentId: payment.id });

    // Salvar pagamento no banco
    const existingPayment = await prisma.payment.findFirst({
      where: { asaasPaymentId: payment.id }
    });

    // Buscar subscription pelo customer
    const subscription = await prisma.subscription.findFirst({
      where: { asaasCustomerId: payment.customer }
    });

    if (!subscription) {
      log.warn('Subscription não encontrada para pagamento', { paymentId: payment.id });
      return;
    }

    // Mapear status do Asaas para nosso status
    const statusMap: Record<string, string> = {
      'PENDING': 'pending',
      'RECEIVED': 'paid',
      'CONFIRMED': 'paid',
      'OVERDUE': 'overdue',
      'REFUNDED': 'refunded',
      'CANCELLED': 'cancelled',
    };

    const status = statusMap[payment.status] || 'pending';

    // Upsert do pagamento
    await prisma.payment.upsert({
      where: { asaasPaymentId: payment.id },
      create: {
        subscriptionId: subscription.id,
        asaasPaymentId: payment.id,
        value: payment.value,
        status,
        billingType: payment.billingType,
        dueDate: new Date(payment.dueDate),
        paidAt: status === 'paid' ? new Date() : null,
        invoiceUrl: payment.invoiceUrl,
        bankSlipUrl: payment.bankSlipUrl,
        pixQrCode: payment.pixQrCodeUrl,
        pixCopiaECola: payment.pixCopiaECola,
      },
      update: {
        status,
        paidAt: status === 'paid' ? new Date() : null,
      }
    });

    // Atualizar subscription e tenant baseado no evento
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      // Pagamento confirmado - ativar assinatura
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: this.calculatePeriodEnd((subscription.billingCycle || 'monthly') as 'monthly' | 'yearly'),
        }
      });

      await prisma.tenant.update({
        where: { id: subscription.tenantId },
        data: {
          subscriptionPlan: subscription.plan,
          subscriptionStatus: 'active',
        }
      });

      // Limpar cache de assinatura para liberar acesso imediatamente
      clearSubscriptionCache(subscription.tenantId);

      log.info('Assinatura ativada', { tenantId: subscription.tenantId, plan: subscription.plan });
    }

    if (event === 'PAYMENT_OVERDUE') {
      // Pagamento atrasado
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'overdue' }
      });

      await prisma.tenant.update({
        where: { id: subscription.tenantId },
        data: { subscriptionStatus: 'suspended' }
      });

      log.warn('Assinatura suspensa por atraso', { tenantId: subscription.tenantId });
    }

    if (event === 'PAYMENT_DELETED' || event === 'PAYMENT_REFUNDED') {
      // Pagamento cancelado/estornado
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'cancelled' }
      });

      await prisma.tenant.update({
        where: { id: subscription.tenantId },
        data: {
          subscriptionPlan: 'basic',
          subscriptionStatus: 'active',
        }
      });

      log.info('Assinatura cancelada, downgrade para básico', { tenantId: subscription.tenantId });
    }
  },

  /**
   * Cancelar assinatura
   */
  async cancelSubscription(tenantId: string, reason?: string) {
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId, status: { in: ['active', 'pending', 'overdue'] } }
    });

    if (!subscription || !subscription.asaasSubscriptionId) {
      throw new Error('Assinatura não encontrada');
    }

    // Cancelar no Asaas
    await asaasRequest(`/subscriptions/${subscription.asaasSubscriptionId}`, 'DELETE');

    // Atualizar banco
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
      }
    });

    // Downgrade para básico no final do período
    // (mantém acesso até o final do período pago)
    log.info('Assinatura cancelada', { tenantId, reason });

    return { success: true, message: 'Assinatura cancelada com sucesso' };
  },

  /**
   * Obter assinatura atual do tenant
   */
  async getSubscription(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    // Calcular dias restantes
    let daysRemaining = 0;
    let trialEndsAt = tenant?.trialEndsAt;
    let periodEnd = tenant?.stripeCurrentPeriodEnd;
    
    if (tenant?.subscriptionPlan === 'trial' && tenant.trialEndsAt) {
      // Trial - calcular baseado em trialEndsAt
      const now = new Date();
      const trialEnd = new Date(tenant.trialEndsAt);
      const diffTime = trialEnd.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    } else if (tenant?.stripeCurrentPeriodEnd) {
      // Plano pago - calcular baseado em stripeCurrentPeriodEnd
      const now = new Date();
      const endDate = new Date(tenant.stripeCurrentPeriodEnd);
      const diffTime = endDate.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    return {
      subscription: periodEnd ? {
        currentPeriodEnd: periodEnd.toISOString()
      } : null,
      currentPlan: tenant?.subscriptionPlan || 'trial',
      status: tenant?.subscriptionStatus || 'active',
      trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
      periodEnd: periodEnd ? periodEnd.toISOString() : null,
      daysRemaining,
      isActive: tenant?.subscriptionStatus === 'active',
      plans: PLANS,
    };
  },

  /**
   * Calcular fim do período
   */
  calculatePeriodEnd(cycle: 'monthly' | 'yearly'): Date {
    const now = new Date();
    if (cycle === 'yearly') {
      return new Date(now.setFullYear(now.getFullYear() + 1));
    }
    return new Date(now.setMonth(now.getMonth() + 1));
  },

  /**
   * Verificar se o trial expirou
   */
  async checkTrialExpiration(tenantId: string): Promise<boolean> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant || tenant.subscriptionPlan !== 'trial') {
      return false;
    }

    if (tenant.trialEndsAt && new Date() > tenant.trialEndsAt) {
      // Trial expirou - fazer downgrade para básico com limitações
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionPlan: 'basic',
          subscriptionStatus: 'active',
        }
      });
      return true;
    }

    return false;
  },

  /**
   * Listar todos os planos
   */
  getPlans() {
    return Object.values(PLANS);
  }
};
