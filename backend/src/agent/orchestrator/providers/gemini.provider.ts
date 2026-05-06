/**
 * Gemini provider — implementação mínima e tolerante (Sprint 3 + 3.1).
 *
 * Estratégia:
 *   - endpoint HTTP REST `generativelanguage.googleapis.com` (sem SDK;
 *     usa `fetch` global — Node 18+).
 *   - modelo default: `gemini-1.5-flash-latest` (configurável por env).
 *   - JSON estruturado via `responseMimeType: 'application/json'` (o parsing
 *     final continua defensivo em `decision-schema.ts`).
 *   - `isAvailable()` sem rede: só confere API key + fetch disponível.
 *
 * Sprint 3.1 — resiliência leve:
 *   - retry curto em erros transitórios (timeout/network/HTTP 429/5xx)
 *   - backoff exponencial com jitter pequeno
 *   - máximo 2 retries (3 tentativas totais) — default
 *   - erros não-transitórios (4xx ≠ 429) não são repetidos
 *   - todo retry é logado
 *   - em produção, ainda atrás da flag `LLM_ORCHESTRATOR_ENABLED=true`.
 */

import { log } from '../../../utils/logger';
import type {
  LLMProvider,
  LLMProviderRequest,
  LLMProviderResponse,
} from './types';

const DEFAULT_MODEL = 'gemini-1.5-flash-latest';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BACKOFF_BASE_MS = 200;
const DEFAULT_BACKOFF_CAP_MS = 1500;

export interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  /** Permite injetar um fetch customizado (testes, retries). */
  fetchImpl?: typeof fetch;
  /** Número máximo de retries após a primeira tentativa. Default 2. */
  maxRetries?: number;
  /** Delay base do backoff em ms. Default 200. */
  backoffBaseMs?: number;
  /** Teto do backoff em ms. Default 1500. */
  backoffCapMs?: number;
  /** Injeta sleep (testes) para não esperar de verdade. */
  sleepImpl?: (ms: number) => Promise<void>;
}

/** Erros que merecem retry. Tudo que não estiver aqui: desiste na hora. */
export type TransientErrorKind =
  | 'TIMEOUT'
  | 'NETWORK'
  | 'HTTP_429'
  | 'HTTP_5XX';

class TransientError extends Error {
  constructor(public kind: TransientErrorKind, public status?: number) {
    super(`Gemini transient: ${kind}${status ? ` (HTTP ${status})` : ''}`);
  }
}

class FatalError extends Error {
  constructor(public status: number, public body: string) {
    super(`Gemini fatal: HTTP ${status}`);
  }
}

export class GeminiLLMProvider implements LLMProvider {
  readonly name = 'gemini';
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;
  private readonly backoffCapMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(opts: GeminiProviderOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
    this.model = opts.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetchImpl ?? ((globalThis as any).fetch as typeof fetch);
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.backoffBaseMs = opts.backoffBaseMs ?? DEFAULT_BACKOFF_BASE_MS;
    this.backoffCapMs = opts.backoffCapMs ?? DEFAULT_BACKOFF_CAP_MS;
    this.sleep =
      opts.sleepImpl ?? ((ms: number) => new Promise(r => setTimeout(r, ms)));
  }

  isAvailable(): boolean {
    if (!this.apiKey || this.apiKey.trim().length === 0) return false;
    if (typeof this.fetchImpl !== 'function') return false;
    return true;
  }

  async complete(req: LLMProviderRequest): Promise<LLMProviderResponse> {
    if (!this.isAvailable()) {
      throw new Error('GeminiLLMProvider: provider indisponível (sem API key ou sem fetch)');
    }

    const body = this.buildBody(req);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model,
    )}:generateContent?key=${encodeURIComponent(this.apiKey as string)}`;

    let attempt = 0;
    let lastErr: any;
    // attempts totais = 1 + maxRetries
    while (attempt <= this.maxRetries) {
      attempt += 1;
      const startedAt = Date.now();
      try {
        const { raw, httpStatus } = await this.singleAttempt(url, body, req);
        const latencyMs = Date.now() - startedAt;
        if (attempt > 1) {
          log.info('gemini.complete.retry_succeeded', {
            attempt,
            runId: req.runId ?? null,
            latencyMs,
          });
        }
        return {
          raw,
          provider: this.name,
          latencyMs,
          attempts: attempt,
          httpStatus,
        };
      } catch (err: any) {
        lastErr = err;
        if (err instanceof TransientError && attempt <= this.maxRetries) {
          const delay = this.backoffDelay(attempt);
          log.warn('gemini.complete.retry_scheduled', {
            attempt,
            kind: err.kind,
            status: err.status ?? null,
            delayMs: delay,
            runId: req.runId ?? null,
          });
          await this.sleep(delay);
          continue;
        }
        // não-transitório ou retries esgotados: relança
        if (err instanceof TransientError) {
          log.warn('gemini.complete.retries_exhausted', {
            attempts: attempt,
            kind: err.kind,
            status: err.status ?? null,
            runId: req.runId ?? null,
          });
          throw new Error(
            `Gemini: transient falhou após ${attempt} tentativas (${err.kind})`,
          );
        }
        if (err instanceof FatalError) {
          log.warn('gemini.complete.fatal', {
            status: err.status,
            body: err.body.slice(0, 300),
            runId: req.runId ?? null,
          });
          throw new Error(`Gemini HTTP ${err.status}`);
        }
        throw err;
      }
    }
    /* istanbul ignore next */
    throw lastErr ?? new Error('Gemini: falha desconhecida');
  }

  private backoffDelay(attempt: number): number {
    // exp: base * 2^(attempt-1), com teto e jitter ±20%.
    const raw = this.backoffBaseMs * Math.pow(2, attempt - 1);
    const capped = Math.min(raw, this.backoffCapMs);
    const jitter = capped * 0.2 * (Math.random() - 0.5) * 2;
    return Math.max(0, Math.floor(capped + jitter));
  }

  private buildBody(req: LLMProviderRequest): unknown {
    const historyContents = (req.history ?? [])
      .filter(h => h.role === 'user' || h.role === 'assistant')
      .map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      }));

    return {
      systemInstruction: {
        role: 'system',
        parts: [{ text: req.system }],
      },
      contents: [
        ...historyContents,
        { role: 'user', parts: [{ text: req.user }] },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    };
  }

  /**
   * Uma tentativa HTTP. Classifica o erro:
   *   - AbortError do controller → TransientError('TIMEOUT')
   *   - erros de rede (TypeError do fetch) → TransientError('NETWORK')
   *   - HTTP 429 → TransientError('HTTP_429')
   *   - HTTP 5xx → TransientError('HTTP_5XX')
   *   - HTTP 4xx (exceto 429) → FatalError
   *   - HTTP 2xx → sucesso
   */
  private async singleAttempt(
    url: string,
    body: unknown,
    req: LLMProviderRequest,
  ): Promise<{ raw: string; httpStatus: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err: any) {
        const name = err?.name || '';
        const msg = err?.message || '';
        if (name === 'AbortError' || /abort/i.test(msg)) {
          throw new TransientError('TIMEOUT');
        }
        if (err instanceof TransientError) throw err;
        throw new TransientError('NETWORK');
      }

      if (res.ok) {
        const json: any = await res.json().catch(() => ({}));
        const raw = extractText(json);
        return { raw, httpStatus: res.status };
      }

      const text = await safeReadText(res);
      if (res.status === 429) {
        log.warn('gemini.complete.http_error', {
          status: res.status,
          runId: req.runId ?? null,
          body: text.slice(0, 200),
        });
        throw new TransientError('HTTP_429', 429);
      }
      if (res.status >= 500 && res.status < 600) {
        log.warn('gemini.complete.http_error', {
          status: res.status,
          runId: req.runId ?? null,
          body: text.slice(0, 200),
        });
        throw new TransientError('HTTP_5XX', res.status);
      }
      throw new FatalError(res.status, text);
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function extractText(json: any): string {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim();
}
