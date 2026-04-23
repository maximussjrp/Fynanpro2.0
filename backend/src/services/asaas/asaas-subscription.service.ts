/**
 * asaas-subscription.service — Fase A2A (C2)
 *
 * Wrapper fino sobre `AsaasClient.createSubscription`:
 *   - valida input
 *   - monta payload v3 do Asaas
 *   - traduz erros em exceções nomeadas
 *
 * NÃO toca no banco local. Quem persiste `Subscription` é o
 * saas-subscription.service (C3).
 *
 * Em A2A o ciclo é restrito a 'MONTHLY' (regra da fase).
 */

import { log } from '../../utils/logger';
import type { AsaasClient } from './asaas-client';
import type {
  AsaasBillingType,
  AsaasSubscriptionCreate,
  AsaasSubscriptionResponse,
} from './asaas-types';

export type AsaasSupportedCycle = 'MONTHLY';

export interface CreateSubscriptionInput {
  asaasCustomerId: string;
  /** Em centavos; convertido internamente para reais (Asaas usa decimal). */
  amountCents: number;
  /** 'YYYY-MM-DD'. */
  nextDueDate: string;
  /** Em A2A, só 'MONTHLY'. Outros ciclos ficam para A2B+. */
  cycle: AsaasSupportedCycle;
  billingType?: AsaasBillingType; // default: PIX
  description?: string;
  /** Referência opcional (Subscription.id local). */
  externalReference?: string;
}

export class AsaasSubscriptionServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AsaasSubscriptionServiceError';
  }
}

export interface AsaasSubscriptionService {
  create(input: CreateSubscriptionInput): Promise<AsaasSubscriptionResponse>;
}

function assertValidInput(input: CreateSubscriptionInput): void {
  if (!input.asaasCustomerId || input.asaasCustomerId.trim() === '') {
    throw new AsaasSubscriptionServiceError('asaasCustomerId é obrigatório');
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new AsaasSubscriptionServiceError(
      'amountCents deve ser inteiro > 0',
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.nextDueDate)) {
    throw new AsaasSubscriptionServiceError(
      'nextDueDate deve estar no formato YYYY-MM-DD',
    );
  }
  if (input.cycle !== 'MONTHLY') {
    throw new AsaasSubscriptionServiceError(
      `cycle '${input.cycle}' não é suportado na Fase A2A (use 'MONTHLY')`,
    );
  }
}

function centsToDecimal(cents: number): number {
  // Asaas aceita number com 2 casas decimais.
  return Math.round(cents) / 100;
}

export function buildAsaasSubscriptionService(deps: {
  client: AsaasClient;
}): AsaasSubscriptionService {
  const client = deps.client;

  return {
    async create(
      input: CreateSubscriptionInput,
    ): Promise<AsaasSubscriptionResponse> {
      assertValidInput(input);

      const payload: AsaasSubscriptionCreate = {
        customer: input.asaasCustomerId,
        billingType: input.billingType ?? 'PIX',
        value: centsToDecimal(input.amountCents),
        nextDueDate: input.nextDueDate,
        cycle: input.cycle,
        description: input.description,
        externalReference: input.externalReference,
      };

      try {
        const resp = await client.createSubscription(payload);
        if (!resp?.id) {
          throw new AsaasSubscriptionServiceError(
            'Resposta do Asaas sem id de subscription',
          );
        }
        log.info('Asaas subscription criada', {
          asaasSubscriptionId: resp.id,
          customer: resp.customer,
          cycle: resp.cycle,
        });
        return resp;
      } catch (err) {
        if (err instanceof AsaasSubscriptionServiceError) throw err;
        log.error('Falha ao criar Subscription no Asaas', {
          asaasCustomerId: input.asaasCustomerId,
          err: (err as Error).message,
        });
        throw new AsaasSubscriptionServiceError(
          'Falha ao criar Subscription no Asaas',
          err,
        );
      }
    },
  };
}
