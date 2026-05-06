/**
 * Agent Orchestrator — prompt hygiene (Sprint 3.1).
 *
 * Mínimo e previsível. Política:
 *   - cap de quantidade de mensagens do histórico (`maxMessages`, default 6)
 *   - cap de tamanho por mensagem (`maxCharsPerMessage`, default 600)
 *   - cap total do histórico (`maxTotalChars`, default 3000) — drop FIFO do
 *     mais antigo até caber
 *   - cap de tamanho da mensagem principal do usuário (`maxUserChars`,
 *     default 2000)
 *   - normalização: colapsa whitespace e remove caracteres de controle
 *   - mascaramento heurístico de segredos óbvios:
 *       * dígitos longos (>= 13) que se pareçam com cartão → ****XXXX
 *       * sequências que pareçam tokens/API keys (>= 32 chars alfanuméricos
 *         contínuos) → [REDACTED]
 *     Regras propositalmente conservadoras para não comer texto útil.
 *
 * A saída retorna também um `report` com o que foi feito — usado em log
 * estruturado, não exposto ao usuário.
 */

export interface HistoryItem {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SanitizeOptions {
  maxMessages?: number;
  maxCharsPerMessage?: number;
  maxTotalChars?: number;
  maxUserChars?: number;
  /** Se true, aplica mascaramento de padrões sensíveis. Default true. */
  maskSecrets?: boolean;
}

export interface SanitizeReport {
  droppedByCount: number;
  droppedByBudget: number;
  truncatedItems: number;
  maskedItems: number;
  userTruncated: boolean;
  finalCount: number;
  finalTotalChars: number;
}

export interface SanitizeResult {
  history: HistoryItem[];
  user: string;
  report: SanitizeReport;
}

const DEFAULTS: Required<SanitizeOptions> = {
  maxMessages: 6,
  maxCharsPerMessage: 600,
  maxTotalChars: 3000,
  maxUserChars: 2000,
  maskSecrets: true,
};

// --- máscaras ---------------------------------------------------------------
// Conservador: procuramos runs de dígitos com possíveis separadores (-, espaço)
// com pelo menos 13 dígitos totais (tamanho de cartão ou token numérico grande).
const LONG_DIGITS_RE = /(?:\d[\s-]?){13,}\d/g;
// Tokens: sequências alfanuméricas com _/- de 32+ chars contínuos.
const LONG_TOKEN_RE = /\b[A-Za-z0-9_-]{32,}\b/g;
// Controls e zero-width
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\uFEFF]/g;

function maskSecrets(input: string): { out: string; masked: boolean } {
  let masked = false;
  const noDigits = input.replace(LONG_DIGITS_RE, match => {
    masked = true;
    const digits = match.replace(/\D/g, '');
    const last4 = digits.slice(-4);
    return `****${last4}`;
  });
  const out = noDigits.replace(LONG_TOKEN_RE, () => {
    masked = true;
    return '[REDACTED]';
  });
  return { out, masked };
}

function normalize(input: string): string {
  return input
    .replace(CONTROL_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(input: string, max: number): { out: string; truncated: boolean } {
  if (input.length <= max) return { out: input, truncated: false };
  // corta deixando elipsis simples para o LLM entender que foi cortado
  return { out: input.slice(0, max - 1) + '…', truncated: true };
}

/**
 * Sanitiza mensagem do usuário e histórico para envio ao provider LLM.
 *
 * Ordem de aplicação (determinística):
 *   1. filtra mensagens vazias/whitespace-only
 *   2. drop de mensagens mais antigas até `maxMessages` (FIFO)
 *   3. normaliza whitespace e remove controles
 *   4. aplica máscara de segredos (se habilitado)
 *   5. trunca cada mensagem em `maxCharsPerMessage`
 *   6. se soma total ainda exceder `maxTotalChars`, descarta FIFO até caber
 *   7. aplica mesmas normalizações + truncamento no `user` (cap próprio)
 */
export function sanitizeForPrompt(
  user: string,
  history: HistoryItem[] | undefined,
  opts: SanitizeOptions = {},
): SanitizeResult {
  const cfg = { ...DEFAULTS, ...opts };
  const report: SanitizeReport = {
    droppedByCount: 0,
    droppedByBudget: 0,
    truncatedItems: 0,
    maskedItems: 0,
    userTruncated: false,
    finalCount: 0,
    finalTotalChars: 0,
  };

  // 1) filtra vazios
  const filtered = (history ?? []).filter(
    h => typeof h?.content === 'string' && h.content.trim().length > 0,
  );

  // 2) drop por contagem (FIFO: mantém as últimas N)
  let kept = filtered;
  if (kept.length > cfg.maxMessages) {
    report.droppedByCount = kept.length - cfg.maxMessages;
    kept = kept.slice(-cfg.maxMessages);
  }

  // 3-5) normaliza/máscara/trunca por item
  const processed: HistoryItem[] = kept.map(h => {
    const normalized = normalize(h.content);
    const { out: maybeMasked, masked } = cfg.maskSecrets
      ? maskSecrets(normalized)
      : { out: normalized, masked: false };
    if (masked) report.maskedItems += 1;
    const { out, truncated } = truncate(maybeMasked, cfg.maxCharsPerMessage);
    if (truncated) report.truncatedItems += 1;
    return { role: h.role, content: out };
  });

  // 6) cap total — drop FIFO até caber
  let total = processed.reduce((s, h) => s + h.content.length, 0);
  const finalHistory: HistoryItem[] = [...processed];
  while (total > cfg.maxTotalChars && finalHistory.length > 0) {
    const dropped = finalHistory.shift()!;
    total -= dropped.content.length;
    report.droppedByBudget += 1;
  }

  // 7) user
  const userNorm = normalize(user ?? '');
  const { out: userMasked, masked: userMaskedFlag } = cfg.maskSecrets
    ? maskSecrets(userNorm)
    : { out: userNorm, masked: false };
  if (userMaskedFlag) report.maskedItems += 1;
  const { out: userOut, truncated: userTruncatedFlag } = truncate(userMasked, cfg.maxUserChars);
  report.userTruncated = userTruncatedFlag;

  report.finalCount = finalHistory.length;
  report.finalTotalChars = total;

  return { history: finalHistory, user: userOut, report };
}
