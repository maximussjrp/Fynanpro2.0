/**
 * Orchestrator — providers (Sprint 3)
 *
 * Cobre a abstração de provider LLM:
 *   - NullLLMProvider sempre indisponível, complete lança
 *   - GeminiLLMProvider detecta falta de API key
 *   - GeminiLLMProvider detecta falta de fetch
 *   - selectProvider respeita feature flag e fallback silencioso
 */

import '../setup';
import {
  NullLLMProvider,
  GeminiLLMProvider,
  selectProvider,
} from '../../agent/orchestrator';

describe('NullLLMProvider', () => {
  it('sempre indisponível', () => {
    const p = new NullLLMProvider();
    expect(p.isAvailable()).toBe(false);
  });

  it('complete lança (guardião de bug)', async () => {
    const p = new NullLLMProvider();
    await expect(
      p.complete({ system: '', user: '', tools: [] }),
    ).rejects.toThrow(/short-circuited/);
  });
});

describe('GeminiLLMProvider.isAvailable', () => {
  it('false sem API key', () => {
    const p = new GeminiLLMProvider({ apiKey: undefined });
    expect(p.isAvailable()).toBe(false);
  });

  it('false com API key vazia', () => {
    const p = new GeminiLLMProvider({ apiKey: '   ' });
    expect(p.isAvailable()).toBe(false);
  });

  it('true com apiKey + fetch', () => {
    const p = new GeminiLLMProvider({
      apiKey: 'k',
      fetchImpl: (async () => new Response('', { status: 200 })) as any,
    });
    expect(p.isAvailable()).toBe(true);
  });
});

describe('GeminiLLMProvider.complete — fetch mock', () => {
  it('envia payload e retorna texto do candidate', async () => {
    const fetchMock = jest.fn(async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: '{"intent":"x","confidence":0.9,"action":"respond","message":"oi"}' }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    const p = new GeminiLLMProvider({
      apiKey: 'k',
      fetchImpl: fetchMock as any,
    });
    const out = await p.complete({ system: 's', user: 'u', tools: [] });
    expect(out.provider).toBe('gemini');
    expect(out.raw).toContain('"action":"respond"');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lança em HTTP 500', async () => {
    const fetchMock = jest.fn(
      async () => new Response('boom', { status: 500 }),
    );
    const p = new GeminiLLMProvider({
      apiKey: 'k',
      fetchImpl: fetchMock as any,
      maxRetries: 0, // sem retry: direto ao erro final
      sleepImpl: async () => undefined,
    });
    await expect(
      p.complete({ system: 's', user: 'u', tools: [] }),
    ).rejects.toThrow(/transient falhou/);
  });
});

describe('selectProvider — feature flag', () => {
  it('flag off → Null', () => {
    const sel = selectProvider({ LLM_ORCHESTRATOR_ENABLED: 'false' });
    expect(sel.provider.name).toBe('null');
    expect(sel.reason).toBe('FLAG_OFF');
  });

  it('flag ausente → Null', () => {
    const sel = selectProvider({});
    expect(sel.provider.name).toBe('null');
  });

  it('flag on + provider gemini sem key → Null', () => {
    const sel = selectProvider({
      LLM_ORCHESTRATOR_ENABLED: 'true',
      LLM_PROVIDER: 'gemini',
    });
    expect(sel.provider.name).toBe('null');
    expect(sel.reason).toBe('GEMINI_KEY_MISSING');
  });

  it('flag on + provider gemini + key → Gemini', () => {
    const sel = selectProvider({
      LLM_ORCHESTRATOR_ENABLED: 'true',
      LLM_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'k',
    });
    expect(sel.provider.name).toBe('gemini');
    expect(sel.reason).toBeUndefined();
  });

  it('provider desconhecido → Null', () => {
    const sel = selectProvider({
      LLM_ORCHESTRATOR_ENABLED: 'true',
      LLM_PROVIDER: 'acme',
    });
    expect(sel.provider.name).toBe('null');
    expect(sel.reason).toBe('UNKNOWN_PROVIDER_NAME');
  });
});
