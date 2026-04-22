/**
 * AsaasClient unit tests — Fase A1
 * Usa fetch injetado para evitar rede real.
 */

import {
  AsaasClient,
  AsaasApiError,
  AsaasNetworkError,
  maskToken,
  buildAsaasClientFromEnv,
} from '../../services/asaas/asaas-client';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('maskToken', () => {
  it('mascara token preservando os 6 primeiros chars', () => {
    expect(maskToken('$aact_hmlg_000abcdef1234567890')).toBe('$aact_***');
  });

  it('trata vazio/null/undefined como (empty)', () => {
    expect(maskToken(undefined)).toBe('(empty)');
    expect(maskToken(null)).toBe('(empty)');
    expect(maskToken('')).toBe('(empty)');
  });

  it('mascara totalmente tokens curtos (<=6)', () => {
    expect(maskToken('abc')).toBe('***');
    expect(maskToken('abcdef')).toBe('***');
  });
});

describe('AsaasClient — construction', () => {
  it('lança erro se apiKey estiver vazio', () => {
    expect(() => new AsaasClient({ apiKey: '', sandbox: true })).toThrow(/apiKey/);
  });

  it('sandbox=true usa URL sandbox', () => {
    const c = new AsaasClient({ apiKey: 'k', sandbox: true, fetchImpl: jest.fn() });
    expect(c.baseUrl).toBe('https://sandbox.asaas.com/api/v3');
  });

  it('sandbox=false usa URL de produção', () => {
    const c = new AsaasClient({ apiKey: 'k', sandbox: false, fetchImpl: jest.fn() });
    expect(c.baseUrl).toBe('https://api.asaas.com/v3');
  });
});

describe('AsaasClient.request', () => {
  it('200 → retorna corpo parseado', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { id: 'cus_1' }));
    const c = new AsaasClient({ apiKey: 'k', sandbox: true, fetchImpl: fetchMock as any, maxAttempts: 1 });
    const res = await c.request<{ id: string }>('GET', '/customers/1');
    expect(res.id).toBe('cus_1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('envia header access_token', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, {}));
    const c = new AsaasClient({ apiKey: 'mykey', sandbox: true, fetchImpl: fetchMock as any });
    await c.request('GET', '/x');
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.access_token).toBe('mykey');
  });

  it('4xx → lança AsaasApiError sem retry', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(404, { error: 'not found' }));
    const c = new AsaasClient({
      apiKey: 'k',
      sandbox: true,
      fetchImpl: fetchMock as any,
      maxAttempts: 3,
      backoffMs: 1,
    });
    await expect(c.request('GET', '/x')).rejects.toThrow(AsaasApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('5xx → retenta e propaga AsaasApiError no final', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(503, { error: 'boom' }));
    const c = new AsaasClient({
      apiKey: 'k',
      sandbox: true,
      fetchImpl: fetchMock as any,
      maxAttempts: 3,
      backoffMs: 1,
    });
    await expect(c.request('GET', '/x')).rejects.toThrow(AsaasApiError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('5xx então 200 → sucesso na 2ª tentativa', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const c = new AsaasClient({
      apiKey: 'k',
      sandbox: true,
      fetchImpl: fetchMock as any,
      maxAttempts: 3,
      backoffMs: 1,
    });
    const res = await c.request<{ ok: boolean }>('GET', '/x');
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('erro de rede persistente → AsaasNetworkError', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const c = new AsaasClient({
      apiKey: 'k',
      sandbox: true,
      fetchImpl: fetchMock as any,
      maxAttempts: 2,
      backoffMs: 1,
    });
    await expect(c.request('GET', '/x')).rejects.toThrow(AsaasNetworkError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('POST envia body como JSON', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, {}));
    const c = new AsaasClient({ apiKey: 'k', sandbox: true, fetchImpl: fetchMock as any });
    await c.request('POST', '/customers', { name: 'X' });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ name: 'X' }));
  });
});

describe('buildAsaasClientFromEnv', () => {
  const originalKey = process.env.ASAAS_API_KEY;
  const originalSandbox = process.env.ASAAS_SANDBOX;

  afterEach(() => {
    process.env.ASAAS_API_KEY = originalKey;
    process.env.ASAAS_SANDBOX = originalSandbox;
  });

  it('retorna null se ASAAS_API_KEY ausente', () => {
    delete process.env.ASAAS_API_KEY;
    expect(buildAsaasClientFromEnv()).toBeNull();
  });

  it('ASAAS_SANDBOX=false → baseUrl de produção', () => {
    process.env.ASAAS_API_KEY = 'k';
    process.env.ASAAS_SANDBOX = 'false';
    const c = buildAsaasClientFromEnv();
    expect(c?.baseUrl).toBe('https://api.asaas.com/v3');
  });

  it('ASAAS_SANDBOX ausente → default sandbox', () => {
    process.env.ASAAS_API_KEY = 'k';
    delete process.env.ASAAS_SANDBOX;
    const c = buildAsaasClientFromEnv();
    expect(c?.baseUrl).toBe('https://sandbox.asaas.com/api/v3');
  });
});
