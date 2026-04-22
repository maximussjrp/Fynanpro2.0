/**
 * Asaas HTTP Client — Fase A1
 *
 * Wrapper mínimo sobre `fetch` com:
 *   - base URL chaveada por ASAAS_SANDBOX
 *   - header `access_token` (API key)
 *   - timeout via AbortController
 *   - retry exponencial limitado para 5xx e erros de rede
 *   - logging com mascaramento do token
 *
 * NÃO faz nenhum side-effect de domínio (BillingCustomer, DomainEvent etc).
 * Camadas superiores (services) é que decidem persistir.
 */

import { log } from '../../utils/logger';
import {
  ASAAS_BASE_URL_SANDBOX,
  ASAAS_BASE_URL_PRODUCTION,
  AsaasCustomerCreate,
  AsaasCustomerResponse,
} from './asaas-types';

export interface AsaasClientOptions {
  apiKey: string;
  sandbox: boolean;
  /** ms; default 15s */
  timeoutMs?: number;
  /** número de tentativas totais (inclui a primeira); default 3 */
  maxAttempts?: number;
  /** ms, base do backoff; default 300 */
  backoffMs?: number;
  /** opcional: injetar fetch para testes */
  fetchImpl?: typeof fetch;
}

export class AsaasApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'AsaasApiError';
  }
}

export class AsaasNetworkError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AsaasNetworkError';
  }
}

/**
 * Mascara um token (mantém 6 primeiros chars + sufixo ***).
 * Exportado para reuso em logs.
 */
export function maskToken(token: string | undefined | null): string {
  if (!token) return '(empty)';
  if (token.length <= 6) return '***';
  return `${token.slice(0, 6)}***`;
}

export class AsaasClient {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly backoffMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: AsaasClientOptions) {
    if (!opts.apiKey || opts.apiKey.trim() === '') {
      throw new Error('AsaasClient: apiKey é obrigatório');
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.sandbox ? ASAAS_BASE_URL_SANDBOX : ASAAS_BASE_URL_PRODUCTION;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
    this.backoffMs = opts.backoffMs ?? 300;
    // Usa fetch injetado OU global. Não cai para undefined.
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as typeof fetch);
    if (!this.fetchImpl) {
      throw new Error('AsaasClient: fetch global indisponível (requer Node 18+)');
    }
  }

  /** Liveness check barato: GET /myAccount retorna dados da conta. */
  async ping(): Promise<{ ok: true; account: unknown }> {
    const account = await this.request<unknown>('GET', '/myAccount');
    return { ok: true, account };
  }

  async createCustomer(data: AsaasCustomerCreate): Promise<AsaasCustomerResponse> {
    return this.request<AsaasCustomerResponse>('POST', '/customers', data);
  }

  async getCustomer(id: string): Promise<AsaasCustomerResponse> {
    return this.request<AsaasCustomerResponse>('GET', `/customers/${encodeURIComponent(id)}`);
  }

  /** Baixo nível. Exposto para camadas que precisem de endpoints ainda não cobertos. */
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(url, {
          method,
          headers: {
            access_token: this.apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'UTOP-Backend/1.0',
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timer);

        const text = await res.text();
        const parsed = text ? safeJsonParse(text) : undefined;

        if (res.ok) {
          return (parsed ?? {}) as T;
        }

        // 4xx: erro definitivo, não retenta
        if (res.status >= 400 && res.status < 500) {
          log.warn('Asaas 4xx', {
            method,
            path,
            status: res.status,
            tokenMasked: maskToken(this.apiKey),
          });
          throw new AsaasApiError(
            `Asaas ${method} ${path} → ${res.status}`,
            res.status,
            parsed ?? text,
          );
        }

        // 5xx: retry com backoff
        lastErr = new AsaasApiError(
          `Asaas ${method} ${path} → ${res.status}`,
          res.status,
          parsed ?? text,
        );
      } catch (err: any) {
        clearTimeout(timer);
        if (err instanceof AsaasApiError && err.status >= 400 && err.status < 500) {
          throw err;
        }
        lastErr = err;
      }

      if (attempt < this.maxAttempts) {
        await sleep(this.backoffMs * 2 ** (attempt - 1));
      }
    }

    if (lastErr instanceof AsaasApiError) throw lastErr;
    throw new AsaasNetworkError(
      `Asaas ${method} ${path} falhou após ${this.maxAttempts} tentativas`,
      lastErr,
    );
  }
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Cria o client a partir das variáveis de ambiente. Não lança erro se faltar
 * API key — retorna `null`. Isso permite o servidor subir mesmo sem credencial,
 * com a flag asaas.enabled OFF.
 */
export function buildAsaasClientFromEnv(): AsaasClient | null {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return null;
  const sandbox = (process.env.ASAAS_SANDBOX ?? 'true').toLowerCase() !== 'false';
  return new AsaasClient({ apiKey, sandbox });
}
