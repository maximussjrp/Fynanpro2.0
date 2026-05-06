/**
 * Sprint 3.1 — retry/backoff do GeminiLLMProvider.
 */

import '../setup';
import { GeminiLLMProvider } from '../../agent/orchestrator/providers/gemini.provider';

function makeResponse(status: number, body: any = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function okBody() {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: '{"ok":true}' }],
        },
      },
    ],
  };
}

describe('GeminiLLMProvider — retry/backoff', () => {
  const sleepImpl = jest.fn(async () => undefined);

  beforeEach(() => {
    sleepImpl.mockClear();
  });

  it('retry em 503 e sucesso na segunda tentativa', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(makeResponse(503))
      .mockResolvedValueOnce(makeResponse(200, okBody()));
    const p = new GeminiLLMProvider({
      apiKey: 'k',
      fetchImpl: fetchMock as any,
      sleepImpl,
      maxRetries: 2,
    });
    const r = await p.complete({ system: 's', user: 'u', tools: [] });
    expect(r.raw).toContain('"ok":true');
    expect(r.attempts).toBe(2);
    expect(r.httpStatus).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenCalledTimes(1);
  });

  it('retry em 429 e lança após exaurir', async () => {
    const fetchMock = jest.fn(async () => makeResponse(429));
    const p = new GeminiLLMProvider({
      apiKey: 'k',
      fetchImpl: fetchMock as any,
      sleepImpl,
      maxRetries: 2,
    });
    await expect(
      p.complete({ system: 's', user: 'u', tools: [] }),
    ).rejects.toThrow(/transient falhou.*HTTP_429/);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });

  it('400 é fatal e não faz retry', async () => {
    const fetchMock = jest.fn(async () => makeResponse(400, { error: 'bad' }));
    const p = new GeminiLLMProvider({
      apiKey: 'k',
      fetchImpl: fetchMock as any,
      sleepImpl,
      maxRetries: 3,
    });
    await expect(
      p.complete({ system: 's', user: 'u', tools: [] }),
    ).rejects.toThrow(/Gemini HTTP 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleepImpl).not.toHaveBeenCalled();
  });

  it('network error é transient (retry)', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(makeResponse(200, okBody()));
    const p = new GeminiLLMProvider({
      apiKey: 'k',
      fetchImpl: fetchMock as any,
      sleepImpl,
      maxRetries: 2,
    });
    const r = await p.complete({ system: 's', user: 'u', tools: [] });
    expect(r.attempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('AbortError vira TIMEOUT e faz retry', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(abortErr)
      .mockResolvedValueOnce(makeResponse(200, okBody()));
    const p = new GeminiLLMProvider({
      apiKey: 'k',
      fetchImpl: fetchMock as any,
      sleepImpl,
      maxRetries: 2,
      timeoutMs: 10,
    });
    const r = await p.complete({ system: 's', user: 'u', tools: [] });
    expect(r.attempts).toBe(2);
  });

  it('retorno inclui httpStatus e attempts mesmo sem retry', async () => {
    const fetchMock = jest.fn(async () => makeResponse(200, okBody()));
    const p = new GeminiLLMProvider({
      apiKey: 'k',
      fetchImpl: fetchMock as any,
      sleepImpl,
    });
    const r = await p.complete({ system: 's', user: 'u', tools: [] });
    expect(r.attempts).toBe(1);
    expect(r.httpStatus).toBe(200);
    expect(sleepImpl).not.toHaveBeenCalled();
  });
});
