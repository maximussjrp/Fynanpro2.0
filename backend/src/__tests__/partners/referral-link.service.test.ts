/**
 * ReferralLinkService unit tests — Fase 0.2 Partners
 */

import {
  buildReferralLinkService,
  type ReferralLinkServiceDeps,
} from '../../services/partners/referral-link.service';
import {
  ConsultantBannedError,
  ConsultantNotEligibleError,
  PartnersFeatureDisabledError,
  ReferralSlugCollisionError,
} from '../../services/partners/types';

interface MockTx {
  referralLink: {
    create: jest.Mock;
    updateMany: jest.Mock;
    findUnique: jest.Mock;
  };
  partnerAuditLog: {
    create: jest.Mock;
  };
}

function makeTx(): MockTx {
  return {
    referralLink: {
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    partnerAuditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit_1' }),
    },
  };
}

interface MakeDbOpts {
  consultant?: { id: string; deletedAt: Date | null } | null;
  ban?: { id: string } | null;
  activeLink?: any | null;
  slugTakenOn?: number | null; // 1-based attempt count where slug is taken; null = never taken
  txRef?: { current: MockTx | null };
}

function makeDb(opts: MakeDbOpts = {}) {
  const tx = makeTx();
  if (opts.txRef) opts.txRef.current = tx;

  let outerSlugAttempts = 0;
  let txSlugAttempts = 0;

  // Outer findUnique used by ensure() before opening tx
  const outerFindUnique = jest.fn().mockImplementation(async () => {
    outerSlugAttempts++;
    if (opts.slugTakenOn === 'always' as any) return { id: 'taken' };
    return null;
  });

  // tx.referralLink.findUnique is the slug check inside regenerate
  tx.referralLink.findUnique.mockImplementation(async () => {
    txSlugAttempts++;
    if (opts.slugTakenOn === 'always' as any) return { id: 'taken' };
    return null;
  });

  return {
    db: {
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
      referralLink: {
        findUnique: outerFindUnique,
        findFirst: jest.fn().mockResolvedValue(opts.activeLink ?? null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'link_new',
          ...data,
          regeneratedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    } as any,
    tx,
  };
}

function buildSvc(
  opts: MakeDbOpts & { enabled?: boolean; alwaysTaken?: boolean } = {},
) {
  const txRef: { current: MockTx | null } = { current: null };
  const merged: any = { ...opts, txRef };
  if (opts.alwaysTaken) merged.slugTakenOn = 'always';
  const { db, tx } = makeDb(merged);
  const deps: ReferralLinkServiceDeps = {
    db,
    isEnabled: () => opts.enabled !== false,
  };
  return { svc: buildReferralLinkService(deps), db, tx };
}

// ---------------------------------------------------------------------------

describe('referral-link.service / DI guards', () => {
  it('falha sem db', () => {
    expect(() =>
      buildReferralLinkService({ db: undefined as any, isEnabled: () => true }),
    ).toThrow(/db/);
  });
  it('falha sem isEnabled', () => {
    expect(() =>
      buildReferralLinkService({ db: {} as any, isEnabled: undefined as any }),
    ).toThrow(/isEnabled/);
  });
});

describe('referral-link.service / feature gate', () => {
  it('todos os métodos lançam quando OFF', async () => {
    const { svc } = buildSvc({ enabled: false });
    await expect(svc.ensure({ consultantId: 'c1' })).rejects.toBeInstanceOf(
      PartnersFeatureDisabledError,
    );
    await expect(
      svc.regenerate({ consultantId: 'c1', actorUserId: 'a1' }),
    ).rejects.toBeInstanceOf(PartnersFeatureDisabledError);
    await expect(svc.findActiveBySlug('s')).rejects.toBeInstanceOf(
      PartnersFeatureDisabledError,
    );
    await expect(svc.findByConsultant('c1')).rejects.toBeInstanceOf(
      PartnersFeatureDisabledError,
    );
  });
});

// ---------------------------------------------------------------------------
// ensure
// ---------------------------------------------------------------------------

describe('referral-link.service / ensure', () => {
  it('rejeita consultor inexistente', async () => {
    const { svc } = buildSvc({ consultant: null });
    await expect(svc.ensure({ consultantId: 'cX' })).rejects.toBeInstanceOf(
      ConsultantNotEligibleError,
    );
  });

  it('rejeita consultor banido', async () => {
    const { svc } = buildSvc({ ban: { id: 'b1' } });
    await expect(svc.ensure({ consultantId: 'c1' })).rejects.toBeInstanceOf(
      ConsultantBannedError,
    );
  });

  it('rejeita consultor soft-deleted', async () => {
    const { svc } = buildSvc({
      consultant: { id: 'c1', deletedAt: new Date() },
    });
    await expect(svc.ensure({ consultantId: 'c1' })).rejects.toBeInstanceOf(
      ConsultantNotEligibleError,
    );
  });

  it('idempotente: retorna {created:false} quando já existe link ativo', async () => {
    const existing = {
      id: 'link_old',
      consultantId: 'c1',
      slug: 'abcd1234',
      active: true,
      regeneratedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { svc, db } = buildSvc({ activeLink: existing });
    const out = await svc.ensure({ consultantId: 'c1' });
    expect(out).toEqual({ link: existing, created: false });
    expect(db.referralLink.create).not.toHaveBeenCalled();
  });

  it('cria link novo quando não há ativo: {created:true}', async () => {
    const { svc, db } = buildSvc({ activeLink: null });
    const out = await svc.ensure({ consultantId: 'c1' });
    expect(out.created).toBe(true);
    expect(out.link.consultantId).toBe('c1');
    expect(out.link.active).toBe(true);
    expect(typeof out.link.slug).toBe('string');
    expect(out.link.slug.length).toBe(8);
    expect(db.referralLink.create).toHaveBeenCalledTimes(1);
  });

  it('lança ReferralSlugCollisionError quando slug bate todas as tentativas', async () => {
    const { svc } = buildSvc({ activeLink: null, alwaysTaken: true });
    await expect(svc.ensure({ consultantId: 'c1' })).rejects.toBeInstanceOf(
      ReferralSlugCollisionError,
    );
  });
});

// ---------------------------------------------------------------------------
// regenerate
// ---------------------------------------------------------------------------

describe('referral-link.service / regenerate', () => {
  it('rejeita actorUserId vazio', async () => {
    const { svc } = buildSvc();
    await expect(
      svc.regenerate({ consultantId: 'c1', actorUserId: '' }),
    ).rejects.toBeInstanceOf(ConsultantNotEligibleError);
  });

  it('rejeita consultor banido', async () => {
    const { svc } = buildSvc({ ban: { id: 'b1' } });
    await expect(
      svc.regenerate({ consultantId: 'c1', actorUserId: 'a1' }),
    ).rejects.toBeInstanceOf(ConsultantBannedError);
  });

  it('atomic: desativa ativos + cria novo + audita referral_link_regenerated', async () => {
    const { svc, db, tx } = buildSvc();
    tx.referralLink.create.mockResolvedValue({
      id: 'link_new',
      consultantId: 'c1',
      slug: 'newslug1',
      active: true,
      regeneratedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const out = await svc.regenerate({
      consultantId: 'c1',
      actorUserId: 'admin_1',
      ip: '10.0.0.1',
      userAgent: 'jest',
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);

    // updateMany WHERE active=true SET active=false (defensivo: 1 invariant)
    expect(tx.referralLink.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { consultantId: 'c1', active: true },
        data: expect.objectContaining({ active: false }),
      }),
    );

    expect(tx.referralLink.create).toHaveBeenCalledTimes(1);
    expect(tx.referralLink.create.mock.calls[0][0].data.active).toBe(true);

    expect(tx.partnerAuditLog.create).toHaveBeenCalledTimes(1);
    const audit = tx.partnerAuditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      action: 'referral_link_regenerated',
      actorUserId: 'admin_1',
      subjectType: 'ReferralLink',
      subjectId: 'link_new',
      ip: '10.0.0.1',
      userAgent: 'jest',
    });

    expect(out.id).toBe('link_new');
  });

  it('lança colisão quando slug bate todas as tentativas dentro da tx', async () => {
    const { svc } = buildSvc({ alwaysTaken: true });
    await expect(
      svc.regenerate({ consultantId: 'c1', actorUserId: 'a1' }),
    ).rejects.toBeInstanceOf(ReferralSlugCollisionError);
  });
});

// ---------------------------------------------------------------------------
// findActiveBySlug
// ---------------------------------------------------------------------------

describe('referral-link.service / findActiveBySlug', () => {
  it('retorna null para slug vazio', async () => {
    const { svc } = buildSvc();
    expect(await svc.findActiveBySlug('')).toBeNull();
    expect(await svc.findActiveBySlug('   ')).toBeNull();
  });

  it('retorna null se link existe mas está inativo', async () => {
    const { svc, db } = buildSvc();
    db.referralLink.findUnique.mockResolvedValueOnce({
      id: 'link_x',
      slug: 'abcd1234',
      active: false,
      consultantId: 'c1',
    });
    expect(await svc.findActiveBySlug('abcd1234')).toBeNull();
  });

  it('retorna link quando ativo', async () => {
    const { svc, db } = buildSvc();
    const row = {
      id: 'link_x',
      slug: 'abcd1234',
      active: true,
      consultantId: 'c1',
      regeneratedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.referralLink.findUnique.mockResolvedValueOnce(row);
    expect(await svc.findActiveBySlug('abcd1234')).toEqual(row);
  });
});

describe('referral-link.service / findByConsultant', () => {
  it('repassa orderBy createdAt desc', async () => {
    const { svc, db } = buildSvc();
    await svc.findByConsultant('c1');
    expect(db.referralLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { consultantId: 'c1' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });
});
