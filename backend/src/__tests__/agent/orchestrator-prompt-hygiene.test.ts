/**
 * Sprint 3.1 — prompt-hygiene tests.
 */

import '../setup';
import { sanitizeForPrompt } from '../../agent/orchestrator/prompt-hygiene';

describe('sanitizeForPrompt — contagem', () => {
  it('dropa mensagens antigas quando excede maxMessages (FIFO)', () => {
    const h = Array.from({ length: 10 }, (_, i) => ({
      role: 'user' as const,
      content: `msg-${i}`,
    }));
    const r = sanitizeForPrompt('oi', h, { maxMessages: 3 });
    expect(r.history).toHaveLength(3);
    expect(r.history[0].content).toBe('msg-7');
    expect(r.history[2].content).toBe('msg-9');
    expect(r.report.droppedByCount).toBe(7);
  });

  it('ignora mensagens vazias/whitespace', () => {
    const r = sanitizeForPrompt('oi', [
      { role: 'user', content: '   ' },
      { role: 'user', content: 'primeira' },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'segunda' },
    ]);
    expect(r.history.map(h => h.content)).toEqual(['primeira', 'segunda']);
  });
});

describe('sanitizeForPrompt — tamanhos', () => {
  it('trunca mensagem longa com elipsis', () => {
    // conteúdo com espaços para evitar match do token-mask (LONG_TOKEN_RE).
    const big = Array.from({ length: 300 }, () => 'lorem').join(' ');
    const r = sanitizeForPrompt('ok', [{ role: 'user', content: big }], {
      maxCharsPerMessage: 100,
      maskSecrets: false,
    });
    expect(r.history[0].content.length).toBe(100);
    expect(r.history[0].content.endsWith('…')).toBe(true);
    expect(r.report.truncatedItems).toBe(1);
  });

  it('dropa FIFO por budget total', () => {
    const h = [
      { role: 'user' as const, content: Array.from({ length: 100 }, () => 'aa').join(' ') },
      { role: 'user' as const, content: Array.from({ length: 100 }, () => 'bb').join(' ') },
      { role: 'user' as const, content: Array.from({ length: 100 }, () => 'cc').join(' ') },
    ];
    const r = sanitizeForPrompt('q', h, {
      maxCharsPerMessage: 500,
      maxTotalChars: 600,
      maskSecrets: false,
    });
    // droppa a mais antiga até caber
    expect(r.history.length).toBeLessThanOrEqual(2);
    expect(r.report.droppedByBudget).toBeGreaterThanOrEqual(1);
  });

  it('trunca mensagem do usuário pelo cap próprio', () => {
    const big = Array.from({ length: 2000 }, () => 'palavra').join(' ');
    const r = sanitizeForPrompt(big, [], {
      maxUserChars: 200,
      maskSecrets: false,
    });
    expect(r.user.length).toBe(200);
    expect(r.report.userTruncated).toBe(true);
  });
});

describe('sanitizeForPrompt — normalização', () => {
  it('colapsa whitespace e remove controls', () => {
    const r = sanitizeForPrompt('oi    \u0000  como\n\nvai', []);
    expect(r.user).toBe('oi como vai');
  });
});

describe('sanitizeForPrompt — mascaramento', () => {
  it('mascara número de cartão longo (>=13 dígitos)', () => {
    const raw = 'meu cartao é 4111 1111 1111 1111 ok';
    const r = sanitizeForPrompt(raw, []);
    expect(r.user).toMatch(/\*\*\*\*1111/);
    expect(r.user).not.toMatch(/4111 1111 1111 1111/);
  });

  it('mascara token longo (>=32 alfanumérico)', () => {
    const token = 'ghp_' + 'A'.repeat(40);
    const r = sanitizeForPrompt(`minha chave é ${token}`, []);
    expect(r.user).toContain('[REDACTED]');
    expect(r.user).not.toContain(token);
  });

  it('não mascara texto normal', () => {
    const r = sanitizeForPrompt('comprei pão na padaria por 15 reais', []);
    expect(r.user).toBe('comprei pão na padaria por 15 reais');
    expect(r.report.maskedItems).toBe(0);
  });

  it('maskSecrets=false desabilita mascaramento', () => {
    const r = sanitizeForPrompt('cartao 4111111111111111', [], { maskSecrets: false });
    expect(r.user).toContain('4111111111111111');
  });
});
