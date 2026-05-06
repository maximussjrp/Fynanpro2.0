/**
 * Orchestrator — decision-schema (Sprint 3)
 *
 * Cobre parsing defensivo: JSON puro, JSON com fence markdown,
 * texto antes/depois, JSON inválido, campos faltando, tipos errados,
 * action fora do enum.
 */

import '../setup';
import {
  parseDecision,
  OrchestratorDecisionSchema,
  extractJsonBlock,
} from '../../agent/orchestrator/decision-schema';

describe('decision-schema — extractJsonBlock', () => {
  it('aceita JSON puro', () => {
    expect(extractJsonBlock('{"a":1}')).toBe('{"a":1}');
  });

  it('extrai de fence markdown com json', () => {
    const s = '```json\n{"a":1}\n```';
    expect(extractJsonBlock(s)).toBe('{"a":1}');
  });

  it('extrai de fence markdown sem rótulo', () => {
    const s = '```\n{"a":1}\n```';
    expect(extractJsonBlock(s)).toBe('{"a":1}');
  });

  it('ignora prosa antes/depois', () => {
    const s = 'Claro! Segue: {"a":1} — pronto.';
    expect(extractJsonBlock(s)).toBe('{"a":1}');
  });

  it('retorna null quando não há JSON', () => {
    expect(extractJsonBlock('isso não é JSON nenhum')).toBeNull();
    expect(extractJsonBlock('')).toBeNull();
  });
});

describe('decision-schema — parseDecision', () => {
  it('aceita respond válido', () => {
    const r = parseDecision(
      JSON.stringify({
        intent: 'saudacao',
        confidence: 0.9,
        action: 'respond',
        message: 'Olá!',
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('aceita invoke_tool válido (read)', () => {
    const r = parseDecision(
      JSON.stringify({
        intent: 'listar_contas',
        confidence: 0.95,
        action: 'invoke_tool',
        toolName: 'list_accounts',
        toolInput: {},
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('falha SCHEMA_VALIDATION quando action=invoke_tool sem toolName', () => {
    const r = parseDecision(
      JSON.stringify({
        intent: 'x',
        confidence: 0.9,
        action: 'invoke_tool',
        toolInput: {},
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('SCHEMA_VALIDATION');
  });

  it('falha quando respond sem message', () => {
    const r = parseDecision(
      JSON.stringify({
        intent: 'x',
        confidence: 0.9,
        action: 'respond',
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('SCHEMA_VALIDATION');
  });

  it('falha INVALID_JSON em texto puro', () => {
    const r = parseDecision('só um texto qualquer');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('INVALID_JSON');
  });

  it('falha INVALID_JSON em JSON quebrado', () => {
    const r = parseDecision('{"intent": "x",');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('INVALID_JSON');
  });

  it('rejeita confidence fora de [0,1]', () => {
    const r = parseDecision(
      JSON.stringify({
        intent: 'x',
        confidence: 1.5,
        action: 'respond',
        message: 'oi',
      }),
    );
    expect(r.ok).toBe(false);
  });

  it('rejeita action fora do enum', () => {
    const r = parseDecision(
      JSON.stringify({
        intent: 'x',
        confidence: 0.9,
        action: 'hack',
        message: 'oi',
      }),
    );
    expect(r.ok).toBe(false);
  });

  it('aceita fallback sem message (mínimo)', () => {
    const r = parseDecision(
      JSON.stringify({
        intent: 'x',
        confidence: 0.1,
        action: 'fallback',
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('extrai JSON envolto em markdown fence', () => {
    const raw = '```json\n{"intent":"x","confidence":0.9,"action":"respond","message":"oi"}\n```';
    const r = parseDecision(raw);
    expect(r.ok).toBe(true);
  });
});

describe('OrchestratorDecisionSchema — metadados', () => {
  it('descarta chaves extras (strip default)', () => {
    const parsed = OrchestratorDecisionSchema.parse({
      intent: 'x',
      confidence: 0.9,
      action: 'respond',
      message: 'oi',
      extraCampo: 'ignorado',
    });
    expect((parsed as any).extraCampo).toBeUndefined();
  });
});
