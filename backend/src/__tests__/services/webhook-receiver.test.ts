/**
 * Webhook Receiver unit tests — Fase A1
 */

import { mockPrisma } from '../setup';
import {
  asaasWebhookReceiver,
  InvalidWebhookPayloadError,
  InvalidWebhookTokenError,
} from '../../services/asaas/webhook-receiver.service';

describe('asaasWebhookReceiver.receive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validPayload = {
    id: 'evt_abc123',
    event: 'PAYMENT_CONFIRMED',
    payment: { id: 'pay_1', customer: 'cus_1' },
  };

  it('token vazio esperado → InvalidWebhookTokenError', async () => {
    await expect(
      asaasWebhookReceiver.receive({
        expectedToken: '',
        providedToken: 'anything',
        payload: validPayload,
      }),
    ).rejects.toThrow(InvalidWebhookTokenError);
    expect(mockPrisma.asaasWebhookEvent.create).not.toHaveBeenCalled();
  });

  it('token ausente no request → InvalidWebhookTokenError', async () => {
    await expect(
      asaasWebhookReceiver.receive({
        expectedToken: 'abc',
        providedToken: undefined,
        payload: validPayload,
      }),
    ).rejects.toThrow(InvalidWebhookTokenError);
  });

  it('token diferente → InvalidWebhookTokenError', async () => {
    await expect(
      asaasWebhookReceiver.receive({
        expectedToken: 'abc',
        providedToken: 'xyz',
        payload: validPayload,
      }),
    ).rejects.toThrow(InvalidWebhookTokenError);
  });

  it('payload null → InvalidWebhookPayloadError', async () => {
    await expect(
      asaasWebhookReceiver.receive({
        expectedToken: 'abc',
        providedToken: 'abc',
        payload: null,
      }),
    ).rejects.toThrow(InvalidWebhookPayloadError);
  });

  it('payload sem event → InvalidWebhookPayloadError', async () => {
    await expect(
      asaasWebhookReceiver.receive({
        expectedToken: 'abc',
        providedToken: 'abc',
        payload: { id: 'x' },
      }),
    ).rejects.toThrow(InvalidWebhookPayloadError);
  });

  it('novo evento → persiste e retorna duplicated=false', async () => {
    (mockPrisma.asaasWebhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.asaasWebhookEvent.create as jest.Mock).mockResolvedValue({
      id: 'whe_1',
      eventType: 'PAYMENT_CONFIRMED',
    });
    const res = await asaasWebhookReceiver.receive({
      expectedToken: 'tok',
      providedToken: 'tok',
      payload: validPayload,
    });
    expect(res).toEqual({
      id: 'whe_1',
      duplicated: false,
      eventType: 'PAYMENT_CONFIRMED',
    });
    const createCall = (mockPrisma.asaasWebhookEvent.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.asaasEventId).toBe('evt_abc123');
    expect(createCall.data.status).toBe('received');
    expect(createCall.data.signatureValid).toBe(true);
  });

  it('evento duplicado → idempotent (duplicated=true, não cria novo)', async () => {
    (mockPrisma.asaasWebhookEvent.findUnique as jest.Mock).mockResolvedValue({
      id: 'whe_1',
      eventType: 'PAYMENT_CONFIRMED',
    });
    const res = await asaasWebhookReceiver.receive({
      expectedToken: 'tok',
      providedToken: 'tok',
      payload: validPayload,
    });
    expect(res.duplicated).toBe(true);
    expect(res.id).toBe('whe_1');
    expect(mockPrisma.asaasWebhookEvent.create).not.toHaveBeenCalled();
  });

  it('payload sem id → persiste mesmo assim (asaasEventId=null, sem dedup)', async () => {
    (mockPrisma.asaasWebhookEvent.create as jest.Mock).mockResolvedValue({
      id: 'whe_2',
      eventType: 'PAYMENT_CREATED',
    });
    const res = await asaasWebhookReceiver.receive({
      expectedToken: 'tok',
      providedToken: 'tok',
      payload: { event: 'PAYMENT_CREATED' },
    });
    expect(res.duplicated).toBe(false);
    expect(mockPrisma.asaasWebhookEvent.findUnique).not.toHaveBeenCalled();
    const call = (mockPrisma.asaasWebhookEvent.create as jest.Mock).mock.calls[0][0];
    expect(call.data.asaasEventId).toBeNull();
  });

  it('evento desconhecido → ainda é persistido como received', async () => {
    (mockPrisma.asaasWebhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.asaasWebhookEvent.create as jest.Mock).mockResolvedValue({
      id: 'whe_3',
      eventType: 'CUSTOM_FUTURE_EVENT',
    });
    const res = await asaasWebhookReceiver.receive({
      expectedToken: 'tok',
      providedToken: 'tok',
      payload: { id: 'e1', event: 'CUSTOM_FUTURE_EVENT' },
    });
    expect(res.eventType).toBe('CUSTOM_FUTURE_EVENT');
  });
});
