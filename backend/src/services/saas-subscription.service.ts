/**
 * saas-subscription.service — Fase A2A (C3)
 *
 * Orquestra a criação de uma assinatura SaaS:
 *
 *   1. valida invariante "no máx. 1 Subscription ativa por tenant"
 *   2. garante BillingCustomer (via AsaasCustomerService)
 *   3. cria row local Subscription com status=pending (sem asaasSubscriptionId)
 *   4. cria Subscription no Asaas usando externalReference = Subscription.id local
 *   5. atualiza row local com asaasSubscriptionId retornado
 *   6. em caso de falha no passo 4, marca a row local como cancelled
 *      (rollback soft — evita row pendente órfã "presa" no invariante).
 *
 * REGRAS DE DESIGN (C3):
 *   - Injeção explícita de TODAS as dependências. Nenhum fallback implícito
 *     para `prisma` real — o call-site decide o que passar. Isso mantém
 *     testes 100% isolados e impede side-effects acidentais em DB real.
 *   - Feature flags NÃO são lidas aqui. O gating é responsabilidade
 *     da rota/call-site (ver routes/billing.ts).
 *   - Não toca em Stripe. Não toca em Tenant.subscriptionPlan / Tenant.subscriptionStatus
 *     (estado legado preservado até a fase de switchover).
 *   - Não cancela subscription no Asaas em rollback (C3 apenas marca local).
 *     A reconciliação fica para uma fase futura com handler/consumer de webhook.
 */

import type { PrismaClient } from '@prisma/client';
import { log } from '../utils/logger';
import type { AsaasCustomerService } from './asaas/asaas-customer.service';
import type { AsaasSubscriptionService } from './asaas/asaas-subscription.service';
import type { AsaasBillingType, AsaasCustomerCreate } from './asaas/asaas-types';

/** Tipo mínimo que consumimos do Prisma. Assim os testes podem passar um mock
 *  sem precisar implementar a superfície inteira do PrismaClient. */
export type SaasSubscriptionDb = Pick<PrismaClient, 'subscription' | 'tenant'>;

export type SaasSupportedCycle = 'MONTHLY';

export interface CreateSaasSubscriptionInput {
  tenantId: string;
  /** Label livre; A2A usa "monthly". */
  plan: string;
  /** Em centavos; convertido internamente pelo AsaasSubscriptionService. */
  amountCents: number;
  /** A2A só aceita 'MONTHLY'. */
  cycle: SaasSupportedCycle;
  /** Dados do Customer (nome/email/cpfCnpj) — só usados se ainda não houver BillingCustomer. */
  customerData: AsaasCustomerCreate;
  /** 'YYYY-MM-DD'. Se omitido, usa hoje+1 dia (fuso UTC). */
  nextDueDate?: string;
  /** Default: PIX. */
  billingType?: AsaasBillingType;
  description?: string;
  currency?: string;
}

export interface CreateSaasSubscriptionResult {
  subscription: {
    id: string;
    tenantId: string;
    status: string;
    asaasSubscriptionId: string | null;
    amountCents: number;
    plan: string;
  };
  /** true quando uma nova Subscription foi criada. false quando já havia uma ativa. */
  created: boolean;
}

export class SaasSubscriptionServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'SaasSubscriptionServiceError';
  }
}

export interface SaasSubscriptionService {
  createForTenant(
    input: CreateSaasSubscriptionInput,
  ): Promise<CreateSaasSubscriptionResult>;
}

export interface SaasSubscriptionServiceDeps {
  db: SaasSubscriptionDb;
  asaasCustomerService: AsaasCustomerService;
  asaasSubscriptionService: AsaasSubscriptionService;
}

/** Statuses que contam como "assinatura viva" para o invariante por tenant. */
const LIVE_STATUSES = ['pending', 'active', 'past_due'] as const;

function assertInput(input: CreateSaasSubscriptionInput): void {
  if (!input.tenantId || input.tenantId.trim() === '') {
    throw new SaasSubscriptionServiceError(
      'tenantId é obrigatório',
      'INVALID_INPUT',
    );
  }
  if (!input.plan || input.plan.trim() === '') {
    throw new SaasSubscriptionServiceError(
      'plan é obrigatório',
      'INVALID_INPUT',
    );
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new SaasSubscriptionServiceError(
      'amountCents deve ser inteiro > 0',
      'INVALID_INPUT',
    );
  }
  if (input.cycle !== 'MONTHLY') {
    throw new SaasSubscriptionServiceError(
      `cycle '${input.cycle}' não é suportado na Fase A2A (use 'MONTHLY')`,
      'INVALID_INPUT',
    );
  }
  if (!input.customerData || !input.customerData.name || input.customerData.name.trim() === '') {
    throw new SaasSubscriptionServiceError(
      'customerData.name é obrigatório',
      'INVALID_INPUT',
    );
  }
  if (input.nextDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.nextDueDate)) {
    throw new SaasSubscriptionServiceError(
      'nextDueDate deve estar no formato YYYY-MM-DD',
      'INVALID_INPUT',
    );
  }
}

function defaultNextDueDate(now: Date = new Date()): string {
  // hoje + 1 dia, em UTC, formato YYYY-MM-DD
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildSaasSubscriptionService(
  deps: SaasSubscriptionServiceDeps,
): SaasSubscriptionService {
  if (!deps?.db) {
    throw new Error('buildSaasSubscriptionService: db é obrigatório (DI explícita)');
  }
  if (!deps.asaasCustomerService) {
    throw new Error('buildSaasSubscriptionService: asaasCustomerService é obrigatório');
  }
  if (!deps.asaasSubscriptionService) {
    throw new Error('buildSaasSubscriptionService: asaasSubscriptionService é obrigatório');
  }
  const { db, asaasCustomerService, asaasSubscriptionService } = deps;

  return {
    async createForTenant(input) {
      assertInput(input);

      // 1) Invariante: já existe Subscription "viva" pra esse tenant?
      const existing = await db.subscription.findFirst({
        where: {
          tenantId: input.tenantId,
          status: { in: LIVE_STATUSES as unknown as string[] } as any,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          tenantId: true,
          status: true,
          asaasSubscriptionId: true,
          amountCents: true,
          plan: true,
        },
      });

      if (existing) {
        log.info('SaasSubscription reutilizada (invariante tenant)', {
          tenantId: input.tenantId,
          subscriptionId: existing.id,
          status: existing.status,
        });
        return {
          subscription: {
            id: existing.id,
            tenantId: existing.tenantId,
            status: String(existing.status),
            asaasSubscriptionId: existing.asaasSubscriptionId,
            amountCents: existing.amountCents,
            plan: existing.plan,
          },
          created: false,
        };
      }

      // 2) Garante BillingCustomer (idempotente).
      const customer = await asaasCustomerService.ensureCustomer({
        tenantId: input.tenantId,
        customerData: input.customerData,
      });

      // 3) Cria row local pending, SEM asaasSubscriptionId ainda.
      const nextDueDate = input.nextDueDate ?? defaultNextDueDate();
      const local = await db.subscription.create({
        data: {
          tenantId: input.tenantId,
          provider: 'asaas',
          plan: input.plan,
          status: 'pending',
          cycle: input.cycle,
          amountCents: input.amountCents,
          currency: input.currency ?? 'BRL',
          metadata: {
            billingCustomerId: customer.billingCustomerId,
            asaasCustomerId: customer.asaasCustomerId,
            billingType: input.billingType ?? 'PIX',
            nextDueDate,
          } as any,
        },
        select: {
          id: true,
          tenantId: true,
          status: true,
          amountCents: true,
          plan: true,
          asaasSubscriptionId: true,
        },
      });

      // 4) Cria no Asaas. Em caso de falha, faz rollback soft da row local.
      let asaasSub;
      try {
        asaasSub = await asaasSubscriptionService.create({
          asaasCustomerId: customer.asaasCustomerId,
          amountCents: input.amountCents,
          nextDueDate,
          cycle: input.cycle,
          billingType: input.billingType ?? 'PIX',
          description: input.description,
          externalReference: local.id,
        });
      } catch (err) {
        log.error('Falha ao criar Subscription no Asaas — rollback local', {
          tenantId: input.tenantId,
          subscriptionId: local.id,
          err: (err as Error).message,
        });
        try {
          await db.subscription.update({
            where: { id: local.id },
            data: {
              status: 'cancelled',
              cancelledAt: new Date(),
              metadata: {
                billingCustomerId: customer.billingCustomerId,
                asaasCustomerId: customer.asaasCustomerId,
                billingType: input.billingType ?? 'PIX',
                nextDueDate,
                rollbackReason: 'asaas_create_failed',
                rollbackError: (err as Error).message,
              } as any,
            },
          });
        } catch (rollbackErr) {
          log.error('Falha no rollback local da Subscription', {
            subscriptionId: local.id,
            err: (rollbackErr as Error).message,
          });
        }
        throw new SaasSubscriptionServiceError(
          'Falha ao criar Subscription no Asaas',
          'ASAAS_CREATE_FAILED',
          err,
        );
      }

      // 5) Atualiza row local com asaasSubscriptionId.
      const updated = await db.subscription.update({
        where: { id: local.id },
        data: {
          asaasSubscriptionId: asaasSub.id,
        },
        select: {
          id: true,
          tenantId: true,
          status: true,
          asaasSubscriptionId: true,
          amountCents: true,
          plan: true,
        },
      });

      // 6) C5.0 — Promoção ATÔMICA de Tenant.billingSource para 'asaas'
      //    SÓ se estado atual é NULL ou 'trial'. updateMany com where condicional
      //    garante idempotência e impede sobrescrita de 'stripe' ou 'manual'.
      try {
        const promo = await db.tenant.updateMany({
          where: {
            id: input.tenantId,
            OR: [
              { billingSource: null },
              { billingSource: 'trial' },
            ],
          },
          data: { billingSource: 'asaas' },
        });
        if (promo.count > 0) {
          log.info('Tenant.billingSource promovido para asaas', {
            tenantId: input.tenantId,
            subscriptionId: updated.id,
          });
        }
      } catch (promoErr) {
        // Falha na promoção NÃO deve quebrar a criação da Subscription.
        // Handler do webhook subsequente pode fazer a promoção em run-time.
        log.warn('Falha ao promover Tenant.billingSource — prosseguindo', {
          tenantId: input.tenantId,
          err: (promoErr as Error).message,
        });
      }

      log.info('SaasSubscription criada', {
        tenantId: input.tenantId,
        subscriptionId: updated.id,
        asaasSubscriptionId: updated.asaasSubscriptionId,
        plan: updated.plan,
      });

      return {
        subscription: {
          id: updated.id,
          tenantId: updated.tenantId,
          status: String(updated.status),
          asaasSubscriptionId: updated.asaasSubscriptionId,
          amountCents: updated.amountCents,
          plan: updated.plan,
        },
        created: true,
      };
    },
  };
}
