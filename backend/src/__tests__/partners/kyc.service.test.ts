/**
 * KycService unit tests — Fase 0.2 Partners
 *
 * Cobre invariantes documentadas no plano:
 *   - feature gate
 *   - elegibilidade do consultor (existência, ban, soft-delete)
 *   - validação de documents
 *   - re-submissão (pendente / em_analise / rejeitado / aprovado)
 *   - dedup por checksum
 *   - approve/reject + audit
 *   - transições inválidas
 */

import {
  buildKycService,
  type KycServiceDeps,
} from '../../services/partners/kyc.service';
import {
  ConsultantBannedError,
  ConsultantNotEligibleError,
  KycAlreadyApprovedError,
  KycInvalidTransitionError,
  KycValidationError,
  PartnersFeatureDisabledError,
} from '../../services/partners/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validDoc = {
  type: 'rg' as const,
  storageKey: 's3://bucket/rg.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 12345,
  checksumSha256: 'a'.repeat(64),
};

const otherDoc = {
  type: 'cpf' as const,
  storageKey: 's3://bucket/cpf.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 5000,
  checksumSha256: 'b'.repeat(64),
};

interface MockTx {
  partnerKyc: {
    create: jest.Mock;
    update: jest.Mock;
    findUnique: jest.Mock;
  };
  partnerKycDocument: {
    findMany: jest.Mock;
    createMany: jest.Mock;
  };
  partnerAuditLog: {
    create: jest.Mock;
  };
}

function makeTx(): MockTx {
  return {
    partnerKyc: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    partnerKycDocument: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    partnerAuditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit_1' }),
    },
  };
}

interface MakeDbOpts {
  consultant?: { id: string; deletedAt: Date | null } | null;
  ban?: { id: string } | null;
  existingKyc?: { id: string; status: string } | null;
  txRef?: { current: MockTx | null };
}

function makeDb(opts: MakeDbOpts = {}) {
  const txMock = makeTx();
  if (opts.txRef) opts.txRef.current = txMock;

  return {
    consultantProfile: {
      findUnique: jest.fn().mockResolvedValue(
        opts.consultant === undefined
          ? { id: 'c1', deletedAt: null }
          : opts.consultant,
      ),
    },
    consultantBan: {
      findUnique: jest.fn().mockResolvedValue(opts.ban ?? null),
    },
    partnerKyc: {
      findUnique: jest.fn().mockResolvedValue(opts.existingKyc ?? null),
    },
    partnerKycDocument: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(async (cb: any) => cb(txMock)),
  } as any;
}

function buildSvc(opts: MakeDbOpts & { enabled?: boolean } = {}): {
  svc: ReturnType<typeof buildKycService>;
  db: any;
  tx: MockTx;
} {
  const txRef: { current: MockTx | null } = { current: null };
  const db = makeDb({ ...opts, txRef });
  const deps: KycServiceDeps = {
    db,
    isEnabled: () => opts.enabled !== false,
  };
  return { svc: buildKycService(deps), db, tx: txRef.current! };
}

// ---------------------------------------------------------------------------
// DI guards
// ---------------------------------------------------------------------------

describe('kyc.service / DI guards', () => {
  it('falha sem db', () => {
    expect(() =>
      buildKycService({ db: undefined as any, isEnabled: () => true }),
    ).toThrow(/db/);
  });
  it('falha sem isEnabled', () => {
    expect(() =>
      buildKycService({ db: {} as any, isEnabled: undefined as any }),
    ).toThrow(/isEnabled/);
  });
});

// ---------------------------------------------------------------------------
// Feature gate
// ---------------------------------------------------------------------------

describe('kyc.service / feature gate', () => {
  it('todos os métodos lançam quando flag OFF', async () => {
    const { svc } = buildSvc({ enabled: false });
    await expect(
      svc.submit({ consultantId: 'c1', documents: [validDoc] }),
    ).rejects.toBeInstanceOf(PartnersFeatureDisabledError);
    await expect(
      svc.approve({ consultantId: 'c1', adminUserId: 'a1' }),
    ).rejects.toBeInstanceOf(PartnersFeatureDisabledError);
    await expect(
      svc.reject({ consultantId: 'c1', adminUserId: 'a1', reason: 'x' }),
    ).rejects.toBeInstanceOf(PartnersFeatureDisabledError);
    await expect(svc.getStatus('c1')).rejects.toBeInstanceOf(
      PartnersFeatureDisabledError,
    );
    await expect(svc.listDocuments('c1')).rejects.toBeInstanceOf(
      PartnersFeatureDisabledError,
    );
  });
});

// ---------------------------------------------------------------------------
// submit
// ---------------------------------------------------------------------------

describe('kyc.service / submit', () => {
  it('rejeita consultantId vazio', async () => {
    const { svc } = buildSvc();
    await expect(
      svc.submit({ consultantId: '', documents: [validDoc] }),
    ).rejects.toBeInstanceOf(KycValidationError);
  });

  it('rejeita consultor inexistente', async () => {
    const { svc } = buildSvc({ consultant: null });
    await expect(
      svc.submit({ consultantId: 'cX', documents: [validDoc] }),
    ).rejects.toBeInstanceOf(ConsultantNotEligibleError);
  });

  it('rejeita consultor banido', async () => {
    const { svc } = buildSvc({ ban: { id: 'b1' } });
    await expect(
      svc.submit({ consultantId: 'c1', documents: [validDoc] }),
    ).rejects.toBeInstanceOf(ConsultantBannedError);
  });

  it('rejeita consultor soft-deleted', async () => {
    const { svc } = buildSvc({
      consultant: { id: 'c1', deletedAt: new Date() },
    });
    await expect(
      svc.submit({ consultantId: 'c1', documents: [validDoc] }),
    ).rejects.toBeInstanceOf(ConsultantNotEligibleError);
  });

  it('rejeita lista de documentos vazia', async () => {
    const { svc } = buildSvc();
    await expect(
      svc.submit({ consultantId: 'c1', documents: [] }),
    ).rejects.toBeInstanceOf(KycValidationError);
  });

  it('rejeita documento com tipo desconhecido', async () => {
    const { svc } = buildSvc();
    await expect(
      svc.submit({
        consultantId: 'c1',
        documents: [{ ...validDoc, type: 'passport' as any }],
      }),
    ).rejects.toBeInstanceOf(KycValidationError);
  });

  it('rejeita documento com sizeBytes <= 0', async () => {
    const { svc } = buildSvc();
    await expect(
      svc.submit({
        consultantId: 'c1',
        documents: [{ ...validDoc, sizeBytes: 0 }],
      }),
    ).rejects.toBeInstanceOf(KycValidationError);
  });

  it('rejeita checksumSha256 inválido', async () => {
    const { svc } = buildSvc();
    await expect(
      svc.submit({
        consultantId: 'c1',
        documents: [{ ...validDoc, checksumSha256: 'abc' }],
      }),
    ).rejects.toBeInstanceOf(KycValidationError);
  });

  it('cria PartnerKyc novo + insere docs em uma única transação', async () => {
    const { svc, db, tx } = buildSvc({ existingKyc: null });
    tx.partnerKyc.create.mockResolvedValue({ id: 'k1', status: 'em_analise' });

    const out = await svc.submit({
      consultantId: 'c1',
      documents: [validDoc, otherDoc],
    });

    expect(out).toEqual({
      id: 'k1',
      status: 'em_analise',
      consultantId: 'c1',
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.partnerKyc.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { consultantId: 'c1', status: 'em_analise' },
      }),
    );
    expect(tx.partnerKycDocument.createMany).toHaveBeenCalledTimes(1);
    expect(tx.partnerKycDocument.createMany.mock.calls[0][0].data).toHaveLength(
      2,
    );
    // Sem audit em submit (Opção C).
    expect(tx.partnerAuditLog.create).not.toHaveBeenCalled();
  });

  it('re-submissão em em_analise: NÃO troca status, dedupa por checksum', async () => {
    const { svc, tx } = buildSvc({
      existingKyc: { id: 'k1', status: 'em_analise' },
    });
    tx.partnerKyc.update.mockResolvedValue({ id: 'k1', status: 'em_analise' });
    tx.partnerKycDocument.findMany.mockResolvedValue([
      { type: 'rg', checksumSha256: 'a'.repeat(64) },
    ]);

    await svc.submit({
      consultantId: 'c1',
      documents: [validDoc, otherDoc], // validDoc duplicado, otherDoc novo
    });

    // update foi chamado para limpar reviewedAt etc., mas mantém em_analise
    expect(tx.partnerKyc.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'em_analise' }),
      }),
    );
    // só o otherDoc deve ser inserido
    expect(tx.partnerKycDocument.createMany).toHaveBeenCalledTimes(1);
    expect(tx.partnerKycDocument.createMany.mock.calls[0][0].data).toHaveLength(
      1,
    );
    expect(
      tx.partnerKycDocument.createMany.mock.calls[0][0].data[0].type,
    ).toBe('cpf');
  });

  it('re-submissão em rejeitado: REABRE para em_analise + limpa rejectReason', async () => {
    const { svc, tx } = buildSvc({
      existingKyc: { id: 'k1', status: 'rejeitado' },
    });
    tx.partnerKyc.update.mockResolvedValue({ id: 'k1', status: 'em_analise' });

    const out = await svc.submit({
      consultantId: 'c1',
      documents: [validDoc],
    });

    expect(out.status).toBe('em_analise');
    const updateCall = tx.partnerKyc.update.mock.calls[0][0];
    expect(updateCall.data).toMatchObject({
      status: 'em_analise',
      rejectReason: null,
      reviewedAt: null,
      reviewedByAdminUserId: null,
    });
  });

  it('re-submissão em pendente: vai para em_analise', async () => {
    const { svc, tx } = buildSvc({
      existingKyc: { id: 'k1', status: 'pendente' },
    });
    tx.partnerKyc.update.mockResolvedValue({ id: 'k1', status: 'em_analise' });

    const out = await svc.submit({
      consultantId: 'c1',
      documents: [validDoc],
    });
    expect(out.status).toBe('em_analise');
  });

  it('re-submissão em aprovado: BLOQUEADA', async () => {
    const { svc } = buildSvc({
      existingKyc: { id: 'k1', status: 'aprovado' },
    });
    await expect(
      svc.submit({ consultantId: 'c1', documents: [validDoc] }),
    ).rejects.toBeInstanceOf(KycAlreadyApprovedError);
  });

  it('docs sem checksum sempre são inseridos (sem dedup)', async () => {
    const { svc, tx } = buildSvc({
      existingKyc: { id: 'k1', status: 'em_analise' },
    });
    tx.partnerKyc.update.mockResolvedValue({ id: 'k1', status: 'em_analise' });
    tx.partnerKycDocument.findMany.mockResolvedValue([
      { type: 'rg', checksumSha256: 'a'.repeat(64) },
    ]);

    const noChecksumDoc = { ...validDoc, checksumSha256: null };
    await svc.submit({
      consultantId: 'c1',
      documents: [noChecksumDoc],
    });

    expect(tx.partnerKycDocument.createMany).toHaveBeenCalledTimes(1);
    expect(tx.partnerKycDocument.createMany.mock.calls[0][0].data).toHaveLength(
      1,
    );
  });
});

// ---------------------------------------------------------------------------
// approve
// ---------------------------------------------------------------------------

describe('kyc.service / approve', () => {
  it('rejeita adminUserId vazio', async () => {
    const { svc } = buildSvc();
    await expect(
      svc.approve({ consultantId: 'c1', adminUserId: '' }),
    ).rejects.toBeInstanceOf(KycValidationError);
  });

  it('rejeita quando KYC inexistente', async () => {
    const { svc } = buildSvc({ existingKyc: null });
    await expect(
      svc.approve({ consultantId: 'c1', adminUserId: 'a1' }),
    ).rejects.toBeInstanceOf(KycInvalidTransitionError);
  });

  it('rejeita transição a partir de pendente', async () => {
    const { svc } = buildSvc({
      existingKyc: { id: 'k1', status: 'pendente' },
    });
    await expect(
      svc.approve({ consultantId: 'c1', adminUserId: 'a1' }),
    ).rejects.toBeInstanceOf(KycInvalidTransitionError);
  });

  it('rejeita transição a partir de aprovado', async () => {
    const { svc } = buildSvc({
      existingKyc: { id: 'k1', status: 'aprovado' },
    });
    await expect(
      svc.approve({ consultantId: 'c1', adminUserId: 'a1' }),
    ).rejects.toBeInstanceOf(KycInvalidTransitionError);
  });

  it('aprova em_analise + audita kyc_approved', async () => {
    const { svc, tx } = buildSvc({
      existingKyc: { id: 'k1', status: 'em_analise' },
    });
    tx.partnerKyc.update.mockResolvedValue({ id: 'k1', status: 'aprovado' });

    const out = await svc.approve({
      consultantId: 'c1',
      adminUserId: 'admin_1',
      ip: '10.0.0.1',
      userAgent: 'jest',
    });

    expect(out).toEqual({ id: 'k1', status: 'aprovado' });
    expect(tx.partnerKyc.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'k1' },
        data: expect.objectContaining({
          status: 'aprovado',
          reviewedByAdminUserId: 'admin_1',
        }),
      }),
    );
    expect(tx.partnerAuditLog.create).toHaveBeenCalledTimes(1);
    const audit = tx.partnerAuditLog.create.mock.calls[0][0];
    expect(audit.data).toMatchObject({
      action: 'kyc_approved',
      actorUserId: 'admin_1',
      subjectType: 'PartnerKyc',
      subjectId: 'k1',
      ip: '10.0.0.1',
      userAgent: 'jest',
    });
  });
});

// ---------------------------------------------------------------------------
// reject
// ---------------------------------------------------------------------------

describe('kyc.service / reject', () => {
  it('rejeita reason vazio', async () => {
    const { svc } = buildSvc();
    await expect(
      svc.reject({ consultantId: 'c1', adminUserId: 'a1', reason: '' }),
    ).rejects.toBeInstanceOf(KycValidationError);
  });

  it('rejeita reason > 500 chars', async () => {
    const { svc } = buildSvc();
    await expect(
      svc.reject({
        consultantId: 'c1',
        adminUserId: 'a1',
        reason: 'x'.repeat(501),
      }),
    ).rejects.toBeInstanceOf(KycValidationError);
  });

  it('rejeita transição a partir de aprovado', async () => {
    const { svc } = buildSvc({
      existingKyc: { id: 'k1', status: 'aprovado' },
    });
    await expect(
      svc.reject({
        consultantId: 'c1',
        adminUserId: 'a1',
        reason: 'fraud',
      }),
    ).rejects.toBeInstanceOf(KycInvalidTransitionError);
  });

  it('rejeita em_analise + audita kyc_rejected (sem expor reason no payload)', async () => {
    const { svc, tx } = buildSvc({
      existingKyc: { id: 'k1', status: 'em_analise' },
    });
    tx.partnerKyc.update.mockResolvedValue({ id: 'k1', status: 'rejeitado' });

    const out = await svc.reject({
      consultantId: 'c1',
      adminUserId: 'admin_1',
      reason: 'docs ilegíveis',
    });

    expect(out).toEqual({ id: 'k1', status: 'rejeitado' });
    expect(tx.partnerKyc.update.mock.calls[0][0].data).toMatchObject({
      status: 'rejeitado',
      reviewedByAdminUserId: 'admin_1',
      rejectReason: 'docs ilegíveis',
    });
    const audit = tx.partnerAuditLog.create.mock.calls[0][0].data;
    expect(audit.action).toBe('kyc_rejected');
    // reason não pode vazar no audit payload
    expect(JSON.stringify(audit.payload)).not.toContain('docs ilegíveis');
    expect(audit.payload.reasonLength).toBe('docs ilegíveis'.length);
  });
});

// ---------------------------------------------------------------------------
// getStatus / listDocuments
// ---------------------------------------------------------------------------

describe('kyc.service / readers', () => {
  it('getStatus retorna null quando inexistente', async () => {
    const { svc } = buildSvc({ existingKyc: null });
    const out = await svc.getStatus('c1');
    expect(out).toBeNull();
  });

  it('listDocuments retorna [] quando KYC inexistente', async () => {
    const { svc } = buildSvc({ existingKyc: null });
    const out = await svc.listDocuments('c1');
    expect(out).toEqual([]);
  });
});
