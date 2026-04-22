/**
 * Event Bus unit tests — Fase A1
 */

import { mockPrisma } from '../setup';
import { publishDomainEvent } from '../../services/event-bus';

describe('publishDomainEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persiste evento com status=pending, attempts=0, nextAttemptAt agora', async () => {
    (mockPrisma.domainEvent.create as jest.Mock).mockResolvedValue({ id: 'evt_1' });
    const res = await publishDomainEvent({
      eventType: 'billing.customer.created',
      aggregateType: 'BillingCustomer',
      aggregateId: 'bc_1',
      payload: { x: 1 },
    });
    expect(res).toEqual({ id: 'evt_1' });

    const call = (mockPrisma.domainEvent.create as jest.Mock).mock.calls[0][0];
    expect(call.data.eventType).toBe('billing.customer.created');
    expect(call.data.status).toBe('pending');
    expect(call.data.attempts).toBe(0);
    expect(call.data.nextAttemptAt).toBeInstanceOf(Date);
    expect(call.data.payload).toEqual({ x: 1 });
  });

  it('erro: relança por padrão', async () => {
    (mockPrisma.domainEvent.create as jest.Mock).mockRejectedValue(new Error('db down'));
    await expect(
      publishDomainEvent({ eventType: 'x', payload: {} }),
    ).rejects.toThrow('db down');
  });

  it('erro: swallow=true → retorna null, não relança', async () => {
    (mockPrisma.domainEvent.create as jest.Mock).mockRejectedValue(new Error('db down'));
    const res = await publishDomainEvent(
      { eventType: 'x', payload: {} },
      { swallow: true },
    );
    expect(res).toBeNull();
  });

  it('aggregateType e aggregateId são opcionais', async () => {
    (mockPrisma.domainEvent.create as jest.Mock).mockResolvedValue({ id: 'evt_2' });
    await publishDomainEvent({ eventType: 'x', payload: {} });
    const call = (mockPrisma.domainEvent.create as jest.Mock).mock.calls[0][0];
    expect(call.data.aggregateType).toBeUndefined();
    expect(call.data.aggregateId).toBeUndefined();
  });
});
