/**
 * partner-audit.logger unit tests — Fase 0.2 Partners
 */

import {
  logPartnerAudit,
  PartnerAuditError,
} from '../../services/partners/partner-audit.logger';

function makeTx() {
  return {
    partnerAuditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit_1' }),
    },
  };
}

const validEntry = {
  action: 'kyc_approved' as const,
  actorUserId: 'user_admin_1',
  subjectType: 'PartnerKyc' as const,
  subjectId: 'kyc_1',
  payload: { previousStatus: 'em_analise', newStatus: 'aprovado' },
};

describe('partners/partner-audit.logger', () => {
  it('escreve via tx.partnerAuditLog.create', async () => {
    const tx = makeTx();
    await logPartnerAudit(tx as any, validEntry);
    expect(tx.partnerAuditLog.create).toHaveBeenCalledTimes(1);
    const call = tx.partnerAuditLog.create.mock.calls[0][0];
    expect(call.data).toMatchObject({
      action: 'kyc_approved',
      actorUserId: 'user_admin_1',
      subjectType: 'PartnerKyc',
      subjectId: 'kyc_1',
    });
    expect(call.data.payload).toEqual(validEntry.payload);
    expect(call.data.ip).toBeNull();
    expect(call.data.userAgent).toBeNull();
  });

  it('rejeita subjectType fora da whitelist', async () => {
    const tx = makeTx();
    await expect(
      logPartnerAudit(tx as any, {
        ...validEntry,
        subjectType: 'Random' as any,
      }),
    ).rejects.toBeInstanceOf(PartnerAuditError);
    expect(tx.partnerAuditLog.create).not.toHaveBeenCalled();
  });

  it('rejeita actorUserId vazio', async () => {
    const tx = makeTx();
    await expect(
      logPartnerAudit(tx as any, { ...validEntry, actorUserId: '' }),
    ).rejects.toBeInstanceOf(PartnerAuditError);
  });

  it('rejeita subjectId vazio', async () => {
    const tx = makeTx();
    await expect(
      logPartnerAudit(tx as any, { ...validEntry, subjectId: '' }),
    ).rejects.toBeInstanceOf(PartnerAuditError);
  });

  it('rejeita payload não-objeto', async () => {
    const tx = makeTx();
    await expect(
      logPartnerAudit(tx as any, { ...validEntry, payload: null as any }),
    ).rejects.toBeInstanceOf(PartnerAuditError);
    await expect(
      logPartnerAudit(tx as any, { ...validEntry, payload: 'x' as any }),
    ).rejects.toBeInstanceOf(PartnerAuditError);
  });

  it('repassa ip e userAgent quando providos', async () => {
    const tx = makeTx();
    await logPartnerAudit(tx as any, {
      ...validEntry,
      ip: '10.0.0.1',
      userAgent: 'jest',
    });
    const call = tx.partnerAuditLog.create.mock.calls[0][0];
    expect(call.data.ip).toBe('10.0.0.1');
    expect(call.data.userAgent).toBe('jest');
  });
});
