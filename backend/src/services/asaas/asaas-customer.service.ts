/**
 * asaas-customer.service — Fase A2A (C2)
 *
 * Responsável por garantir a existência de um `BillingCustomer` (provider='asaas')
 * para um `tenantId`. Idempotente:
 *   - se já houver um BillingCustomer ativo → reutiliza (não chama Asaas).
 *   - caso contrário → cria no Asaas, persiste localmente e retorna.
 *
 * NÃO faz side-effects de domínio além de BillingCustomer.
 * NÃO lê feature flags — quem orquestra (saas-subscription.service em C3)
 * decide quando invocar.
 */

import { prisma } from '../../utils/prisma-client';
import { log } from '../../utils/logger';
import type { AsaasClient } from './asaas-client';
import type { AsaasCustomerCreate } from './asaas-types';

export interface EnsureCustomerInput {
  tenantId: string;
  /** Dados que viram o Customer no Asaas (nome, email, cpfCnpj...). */
  customerData: AsaasCustomerCreate;
}

export interface EnsureCustomerResult {
  billingCustomerId: string;
  asaasCustomerId: string;
  created: boolean;
}

export class AsaasCustomerServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AsaasCustomerServiceError';
  }
}

export interface AsaasCustomerService {
  ensureCustomer(input: EnsureCustomerInput): Promise<EnsureCustomerResult>;
}

/** Factory: injeta o AsaasClient e (opcionalmente) um prisma custom para testes. */
export function buildAsaasCustomerService(deps: {
  client: AsaasClient;
  db?: typeof prisma;
}): AsaasCustomerService {
  const db = deps.db ?? prisma;
  const client = deps.client;

  return {
    async ensureCustomer(input: EnsureCustomerInput): Promise<EnsureCustomerResult> {
      if (!input.tenantId || input.tenantId.trim() === '') {
        throw new AsaasCustomerServiceError('tenantId é obrigatório');
      }
      if (!input.customerData?.name || input.customerData.name.trim() === '') {
        throw new AsaasCustomerServiceError('customerData.name é obrigatório');
      }

      // 1) Se já existe BillingCustomer ativo Asaas, reutiliza.
      const existing = await db.billingCustomer.findFirst({
        where: {
          tenantId: input.tenantId,
          provider: 'asaas',
          isActive: true,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, asaasCustomerId: true },
      });

      if (existing) {
        log.info('BillingCustomer reutilizado', {
          tenantId: input.tenantId,
          billingCustomerId: existing.id,
        });
        return {
          billingCustomerId: existing.id,
          asaasCustomerId: existing.asaasCustomerId,
          created: false,
        };
      }

      // 2) Cria no Asaas.
      let asaasResp;
      try {
        asaasResp = await client.createCustomer({
          ...input.customerData,
          externalReference: input.customerData.externalReference ?? input.tenantId,
        });
      } catch (err) {
        log.error('Falha ao criar Customer no Asaas', {
          tenantId: input.tenantId,
          err: (err as Error).message,
        });
        throw new AsaasCustomerServiceError(
          'Falha ao criar Customer no Asaas',
          err,
        );
      }

      if (!asaasResp?.id) {
        throw new AsaasCustomerServiceError(
          'Resposta do Asaas sem id de customer',
        );
      }

      // 3) Persiste localmente.
      const created = await db.billingCustomer.create({
        data: {
          tenantId: input.tenantId,
          provider: 'asaas',
          asaasCustomerId: asaasResp.id,
          isActive: true,
          metadata: {
            name: asaasResp.name,
            email: asaasResp.email ?? null,
            cpfCnpj: asaasResp.cpfCnpj ?? null,
            dateCreated: asaasResp.dateCreated ?? null,
          } as any,
        },
        select: { id: true, asaasCustomerId: true },
      });

      log.info('BillingCustomer criado', {
        tenantId: input.tenantId,
        billingCustomerId: created.id,
        asaasCustomerId: created.asaasCustomerId,
      });

      return {
        billingCustomerId: created.id,
        asaasCustomerId: created.asaasCustomerId,
        created: true,
      };
    },
  };
}
