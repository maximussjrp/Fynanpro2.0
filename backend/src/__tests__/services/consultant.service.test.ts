/**
 * ConsultantService Tests — Fase 2A
 */

import '../setup';
import { prisma } from '../../utils/prisma-client';
import {
  ConsultantService,
  ConsultantNotFoundError,
  ConsultantAlreadyExistsError,
  ConsultantSlugTakenError,
  ConsultantNotActiveError,
} from '../../services/consultant.service';
import { Prisma } from '@prisma/client';

describe('ConsultantService', () => {
  let svc: ConsultantService;

  beforeEach(() => {
    svc = new ConsultantService();
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------------------
  // getMyProfile
  // ------------------------------------------------------------------------
  describe('getMyProfile()', () => {
    it('retorna o perfil quando existe e não está deletado', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue({
        id: 'cp-1',
        userId: 'u-1',
        status: 'ACTIVE',
      });
      const out = await svc.getMyProfile('u-1');
      expect(out.id).toBe('cp-1');
      expect(prisma.consultantProfile.findFirst).toHaveBeenCalledWith({
        where: { userId: 'u-1', deletedAt: null },
      });
    });

    it('lança ConsultantNotFoundError quando não existe', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(svc.getMyProfile('u-1')).rejects.toBeInstanceOf(ConsultantNotFoundError);
    });
  });

  // ------------------------------------------------------------------------
  // apply
  // ------------------------------------------------------------------------
  describe('apply()', () => {
    it('cria perfil PENDING quando não existe', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.consultantProfile.create as jest.Mock).mockResolvedValue({
        id: 'cp-1',
        userId: 'u-1',
        status: 'PENDING',
        tier: 'BRONZE',
        displayName: 'Max',
        bio: null,
        publicSlug: null,
      });
      const out = await svc.apply('u-1', { displayName: 'Max' });
      expect(out.id).toBe('cp-1');
      expect(prisma.consultantProfile.create).toHaveBeenCalledWith({
        data: {
          userId: 'u-1',
          displayName: 'Max',
          bio: null,
          publicSlug: null,
        },
      });
    });

    it('lança ConsultantAlreadyExistsError se já existir perfil ativo', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue({ id: 'cp-1' });
      await expect(svc.apply('u-1', {})).rejects.toBeInstanceOf(ConsultantAlreadyExistsError);
      expect(prisma.consultantProfile.create).not.toHaveBeenCalled();
    });

    it('traduz P2002 em publicSlug para ConsultantSlugTakenError', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue(null);
      const err = new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['publicSlug'] },
      });
      (prisma.consultantProfile.create as jest.Mock).mockRejectedValue(err);
      await expect(
        svc.apply('u-1', { publicSlug: 'max-consultor' }),
      ).rejects.toBeInstanceOf(ConsultantSlugTakenError);
    });

    it('traduz P2002 em userId para ConsultantAlreadyExistsError', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue(null);
      const err = new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['userId'] },
      });
      (prisma.consultantProfile.create as jest.Mock).mockRejectedValue(err);
      await expect(svc.apply('u-1', {})).rejects.toBeInstanceOf(ConsultantAlreadyExistsError);
    });
  });

  // ------------------------------------------------------------------------
  // updateMyProfile
  // ------------------------------------------------------------------------
  describe('updateMyProfile()', () => {
    it('atualiza somente campos enviados', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue({
        id: 'cp-1',
        userId: 'u-1',
      });
      (prisma.consultantProfile.update as jest.Mock).mockResolvedValue({
        id: 'cp-1',
        bio: 'nova bio',
      });
      const out = await svc.updateMyProfile('u-1', { bio: 'nova bio' });
      expect(out.bio).toBe('nova bio');
      expect(prisma.consultantProfile.update).toHaveBeenCalledWith({
        where: { id: 'cp-1' },
        data: { bio: 'nova bio' },
      });
    });

    it('lança NotFound quando perfil não existe', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        svc.updateMyProfile('u-1', { bio: 'x' }),
      ).rejects.toBeInstanceOf(ConsultantNotFoundError);
    });

    it('traduz P2002 em SlugTaken', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue({ id: 'cp-1' });
      const err = new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['publicSlug'] },
      });
      (prisma.consultantProfile.update as jest.Mock).mockRejectedValue(err);
      await expect(
        svc.updateMyProfile('u-1', { publicSlug: 'outro' }),
      ).rejects.toBeInstanceOf(ConsultantSlugTakenError);
    });
  });

  // ------------------------------------------------------------------------
  // listMyClients
  // ------------------------------------------------------------------------
  describe('listMyClients()', () => {
    it('lista clientes quando consultor está ACTIVE', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue({
        id: 'cp-1',
        userId: 'u-1',
        status: 'ACTIVE',
      });
      (prisma.clientProfile.findMany as jest.Mock).mockResolvedValue([
        { id: 'cli-1', clientUserId: 'u-9', status: 'ACTIVE' },
      ]);
      (prisma.clientProfile.count as jest.Mock).mockResolvedValue(1);

      const out = await svc.listMyClients('u-1', { limit: 50, offset: 0 });
      expect(out.total).toBe(1);
      expect(out.items).toHaveLength(1);
      // Filtro DEVE usar consultantUserId (fonte de verdade), não Tenant.managedByConsultantId
      expect((prisma.clientProfile.findMany as jest.Mock).mock.calls[0][0].where)
        .toMatchObject({ consultantUserId: 'u-1', deletedAt: null });
    });

    it('bloqueia quando consultor está PENDING', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue({
        id: 'cp-1',
        userId: 'u-1',
        status: 'PENDING',
      });
      await expect(
        svc.listMyClients('u-1', { limit: 50, offset: 0 }),
      ).rejects.toBeInstanceOf(ConsultantNotActiveError);
    });

    it('bloqueia quando consultor não existe', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        svc.listMyClients('u-1', { limit: 50, offset: 0 }),
      ).rejects.toBeInstanceOf(ConsultantNotFoundError);
    });

    it('aplica filtro de status quando informado', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue({
        id: 'cp-1',
        userId: 'u-1',
        status: 'ACTIVE',
      });
      (prisma.clientProfile.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.clientProfile.count as jest.Mock).mockResolvedValue(0);
      await svc.listMyClients('u-1', { status: 'PAUSED', limit: 50, offset: 0 });
      expect((prisma.clientProfile.findMany as jest.Mock).mock.calls[0][0].where.status).toBe('PAUSED');
    });
  });

  // ------------------------------------------------------------------------
  // Admin flows
  // ------------------------------------------------------------------------
  describe('admin flows', () => {
    it('adminApprove muda status para ACTIVE e seta approvedAt se null', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue({
        id: 'cp-1',
        approvedAt: null,
      });
      (prisma.consultantProfile.update as jest.Mock).mockImplementation(
        ({ data }: any) => Promise.resolve({ id: 'cp-1', ...data }),
      );
      const out = await svc.adminApprove('cp-1');
      expect(out.status).toBe('ACTIVE');
      expect(out.approvedAt).toBeInstanceOf(Date);
    });

    it('adminApprove preserva approvedAt se já existia', async () => {
      const existingDate = new Date('2025-01-01');
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue({
        id: 'cp-1',
        approvedAt: existingDate,
      });
      (prisma.consultantProfile.update as jest.Mock).mockImplementation(
        ({ data }: any) => Promise.resolve({ id: 'cp-1', ...data }),
      );
      const out = await svc.adminApprove('cp-1');
      expect(out.approvedAt).toBe(existingDate);
    });

    it('adminSuspend muda status para SUSPENDED', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue({ id: 'cp-1' });
      (prisma.consultantProfile.update as jest.Mock).mockImplementation(
        ({ data }: any) => Promise.resolve({ id: 'cp-1', ...data }),
      );
      const out = await svc.adminSuspend('cp-1');
      expect(out.status).toBe('SUSPENDED');
    });

    it('adminReject muda status para INACTIVE', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue({ id: 'cp-1' });
      (prisma.consultantProfile.update as jest.Mock).mockImplementation(
        ({ data }: any) => Promise.resolve({ id: 'cp-1', ...data }),
      );
      const out = await svc.adminReject('cp-1');
      expect(out.status).toBe('INACTIVE');
    });

    it('adminApprove lança NotFound para id inexistente', async () => {
      (prisma.consultantProfile.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(svc.adminApprove('x')).rejects.toBeInstanceOf(ConsultantNotFoundError);
    });
  });
});
