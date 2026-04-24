/**
 * C5.4 — Reconciler configuration.
 *
 * Todas as variáveis têm defaults seguros e permanecem OFF em produção.
 * Nenhum valor liga bloqueio por si só — o bloqueio é responsabilidade
 * exclusiva da C5.3 e depende de FF_ASAAS_PASTDUE_BLOCK_*.
 */

export type ReconcilerMode = 'shadow' | 'dryrun' | 'autofix';

export interface ReconcilerConfig {
  /** Master switch — lido de FF_ASAAS_RECONCILER_ENABLED. */
  enabled: boolean;
  /** Autofix switch — lido de FF_ASAAS_RECONCILER_AUTOFIX. Reservado p/ C5.5+. */
  autofixAllowed: boolean;
  mode: ReconcilerMode;
  intervalMin: number;
  batchSize: number;
  /** CSV de tenantIds; vazio = todos os tenants Asaas. */
  tenantAllowlist: readonly string[];
  /** Taxa de amostragem de findings IN_SYNC (0..1). Default 0.01 = 1%. */
  inSyncSampling: number;
  /** Concorrência máxima de chamadas Asaas simultâneas. */
  concurrency: number;
  /** Delay mínimo entre chamadas por worker (ms). */
  minIntervalMs: number;
  /** Retries para 429 rate limit. */
  rateLimitMaxRetries: number;
  rateLimitBackoffBaseMs: number;
}

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === '') return fallback;
  return v === '1' || v.toLowerCase() === 'true';
}

function parseInt2(v: string | undefined, fallback: number, min: number, max: number): number {
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parseFloat2(v: string | undefined, fallback: number, min: number, max: number): number {
  if (!v) return fallback;
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parseMode(v: string | undefined): ReconcilerMode {
  const raw = (v ?? 'shadow').toLowerCase();
  if (raw === 'shadow' || raw === 'dryrun' || raw === 'autofix') return raw;
  return 'shadow';
}

function parseAllowlist(v: string | undefined): readonly string[] {
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Lê a configuração a partir de `process.env`. Pura — não lança erros. */
export function readReconcilerConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ReconcilerConfig {
  return {
    enabled: parseBool(env.FF_ASAAS_RECONCILER_ENABLED, false),
    autofixAllowed: parseBool(env.FF_ASAAS_RECONCILER_AUTOFIX, false),
    mode: parseMode(env.FF_ASAAS_RECONCILER_MODE),
    intervalMin: parseInt2(env.FF_ASAAS_RECONCILER_INTERVAL_MIN, 15, 1, 24 * 60),
    batchSize: parseInt2(env.FF_ASAAS_RECONCILER_BATCH_SIZE, 50, 1, 500),
    tenantAllowlist: parseAllowlist(env.FF_ASAAS_RECONCILER_TENANT_ALLOWLIST),
    inSyncSampling: parseFloat2(env.FF_ASAAS_RECONCILER_IN_SYNC_SAMPLING, 0.01, 0, 1),
    concurrency: parseInt2(env.FF_ASAAS_RECONCILER_CONCURRENCY, 5, 1, 50),
    minIntervalMs: parseInt2(env.FF_ASAAS_RECONCILER_MIN_INTERVAL_MS, 100, 0, 60_000),
    rateLimitMaxRetries: parseInt2(env.FF_ASAAS_RECONCILER_RATE_LIMIT_RETRIES, 3, 0, 10),
    rateLimitBackoffBaseMs: parseInt2(
      env.FF_ASAAS_RECONCILER_RATE_LIMIT_BACKOFF_MS,
      1000,
      50,
      60_000,
    ),
  };
}

/**
 * Startup guard da C5.4 (exigência 2 do escopo).
 *
 * Rejeita inicialização quando `mode='autofix'` sem a flag
 * `FF_ASAAS_RECONCILER_AUTOFIX=true` explicitamente ligada.
 * Proteção contra tenants sendo corrigidos silenciosamente por hora errada
 * de flag. A fase C5.4 entrega apenas `shadow`/`dryrun`; autofix é stub.
 */
export class ReconcilerAutofixGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReconcilerAutofixGuardError';
  }
}

export function assertAutofixAllowed(cfg: ReconcilerConfig): void {
  if (cfg.mode === 'autofix' && !cfg.autofixAllowed) {
    throw new ReconcilerAutofixGuardError(
      'FF_ASAAS_RECONCILER_MODE=autofix requer FF_ASAAS_RECONCILER_AUTOFIX=true. ' +
        'Autofix é reservado para fase C5.5+; startup abortado por segurança.',
    );
  }
}
