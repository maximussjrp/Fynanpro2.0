import { prisma } from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';

interface CreateCouponDTO {
  code: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses?: number;
  maxUsesPerUser?: number;
  validFrom?: Date;
  validUntil?: Date;
  applicablePlans?: string[];
  minAmount?: number;
  firstPurchaseOnly?: boolean;
  createdBy: string;
}

interface ValidateCouponResult {
  valid: boolean;
  coupon?: any;
  error?: string;
  discountAmount?: number;
  finalAmount?: number;
}

export const couponService = {
  /**
   * Criar novo cupom
   */
  async create(data: CreateCouponDTO) {
    // Verificar se código já existe
    const existing = await prisma.coupon.findUnique({
      where: { code: data.code.toUpperCase() }
    });

    if (existing) {
      throw new Error('Código de cupom já existe');
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description,
        discountType: data.discountType,
        discountValue: new Decimal(data.discountValue),
        maxUses: data.maxUses,
        maxUsesPerUser: data.maxUsesPerUser || 1,
        validFrom: data.validFrom || new Date(),
        validUntil: data.validUntil,
        applicablePlans: data.applicablePlans ? JSON.stringify(data.applicablePlans) : null,
        minAmount: data.minAmount ? new Decimal(data.minAmount) : null,
        firstPurchaseOnly: data.firstPurchaseOnly || false,
        createdBy: data.createdBy,
      }
    });

    return coupon;
  },

  /**
   * Listar todos os cupons
   */
  async list(options?: { 
    includeInactive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { includeInactive = false, page = 1, limit = 50 } = options || {};

    const where = includeInactive ? {} : { isActive: true };

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: { usages: true }
          }
        }
      }),
      prisma.coupon.count({ where })
    ]);

    return {
      coupons: coupons.map(c => ({
        ...c,
        applicablePlans: c.applicablePlans ? JSON.parse(c.applicablePlans) : null,
        usageCount: c._count.usages
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Buscar cupom por ID
   */
  async findById(id: string) {
    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: {
        usages: {
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        _count: {
          select: { usages: true }
        }
      }
    });

    if (!coupon) return null;

    return {
      ...coupon,
      applicablePlans: coupon.applicablePlans ? JSON.parse(coupon.applicablePlans) : null,
      usageCount: coupon._count.usages
    };
  },

  /**
   * Buscar cupom por código
   */
  async findByCode(code: string) {
    return prisma.coupon.findUnique({
      where: { code: code.toUpperCase() }
    });
  },

  /**
   * Validar cupom para uso
   */
  async validate(
    code: string, 
    userId: string, 
    tenantId: string, 
    planId: string, 
    planAmount: number
  ): Promise<ValidateCouponResult> {
    const coupon = await this.findByCode(code);

    if (!coupon) {
      return { valid: false, error: 'Cupom não encontrado' };
    }

    if (!coupon.isActive) {
      return { valid: false, error: 'Cupom inativo' };
    }

    // Verificar validade
    const now = new Date();
    if (coupon.validFrom > now) {
      return { valid: false, error: 'Cupom ainda não é válido' };
    }

    if (coupon.validUntil && coupon.validUntil < now) {
      return { valid: false, error: 'Cupom expirado' };
    }

    // Verificar limite de uso total
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return { valid: false, error: 'Cupom esgotado' };
    }

    // Verificar limite de uso por usuário
    const userUsages = await prisma.couponUsage.count({
      where: {
        couponId: coupon.id,
        userId
      }
    });

    if (userUsages >= coupon.maxUsesPerUser) {
      return { valid: false, error: 'Você já utilizou este cupom' };
    }

    // Verificar planos aplicáveis
    if (coupon.applicablePlans) {
      const plans = JSON.parse(coupon.applicablePlans) as string[];
      if (!plans.includes(planId)) {
        return { valid: false, error: 'Cupom não é válido para este plano' };
      }
    }

    // Verificar valor mínimo
    if (coupon.minAmount && planAmount < Number(coupon.minAmount)) {
      return { valid: false, error: `Valor mínimo para este cupom: R$ ${coupon.minAmount}` };
    }

    // Verificar primeira compra
    if (coupon.firstPurchaseOnly) {
      const hasSubscription = await prisma.subscription.findFirst({
        where: { 
          tenantId,
          status: { in: ['active', 'cancelled'] }
        }
      });

      if (hasSubscription) {
        return { valid: false, error: 'Cupom válido apenas para primeira assinatura' };
      }
    }

    // Calcular desconto
    let discountAmount: number;
    if (coupon.discountType === 'percentage') {
      discountAmount = (planAmount * Number(coupon.discountValue)) / 100;
    } else {
      discountAmount = Number(coupon.discountValue);
    }

    // Não pode ser maior que o valor do plano
    discountAmount = Math.min(discountAmount, planAmount);
    const finalAmount = Math.max(0, planAmount - discountAmount);

    return {
      valid: true,
      coupon,
      discountAmount,
      finalAmount
    };
  },

  /**
   * Aplicar cupom (registrar uso)
   */
  async apply(
    couponId: string,
    tenantId: string,
    userId: string,
    subscriptionId: string | null,
    originalAmount: number,
    discountApplied: number
  ) {
    const finalAmount = originalAmount - discountApplied;

    // Registrar uso
    const usage = await prisma.couponUsage.create({
      data: {
        couponId,
        tenantId,
        userId,
        subscriptionId,
        originalAmount: new Decimal(originalAmount),
        discountApplied: new Decimal(discountApplied),
        finalAmount: new Decimal(finalAmount)
      }
    });

    // Incrementar contador
    await prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } }
    });

    return usage;
  },

  /**
   * Atualizar cupom
   */
  async update(id: string, data: Partial<CreateCouponDTO>) {
    const updateData: any = {};

    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.discountType) updateData.discountType = data.discountType;
    if (data.discountValue !== undefined) updateData.discountValue = new Decimal(data.discountValue);
    if (data.maxUses !== undefined) updateData.maxUses = data.maxUses;
    if (data.maxUsesPerUser !== undefined) updateData.maxUsesPerUser = data.maxUsesPerUser;
    if (data.validFrom) updateData.validFrom = data.validFrom;
    if (data.validUntil !== undefined) updateData.validUntil = data.validUntil;
    if (data.applicablePlans !== undefined) {
      updateData.applicablePlans = data.applicablePlans ? JSON.stringify(data.applicablePlans) : null;
    }
    if (data.minAmount !== undefined) {
      updateData.minAmount = data.minAmount ? new Decimal(data.minAmount) : null;
    }
    if (data.firstPurchaseOnly !== undefined) updateData.firstPurchaseOnly = data.firstPurchaseOnly;

    return prisma.coupon.update({
      where: { id },
      data: updateData
    });
  },

  /**
   * Ativar/Desativar cupom
   */
  async toggleActive(id: string, isActive: boolean) {
    return prisma.coupon.update({
      where: { id },
      data: { isActive }
    });
  },

  /**
   * Deletar cupom (soft delete via isActive)
   */
  async delete(id: string) {
    // Verificar se tem usos
    const usages = await prisma.couponUsage.count({
      where: { couponId: id }
    });

    if (usages > 0) {
      // Apenas desativar se já foi usado
      return this.toggleActive(id, false);
    }

    // Pode deletar se nunca foi usado
    return prisma.coupon.delete({
      where: { id }
    });
  },

  /**
   * Estatísticas de cupons
   */
  async getStats() {
    const [
      totalCoupons,
      activeCoupons,
      totalUsages,
      totalDiscountGiven
    ] = await Promise.all([
      prisma.coupon.count(),
      prisma.coupon.count({ where: { isActive: true } }),
      prisma.couponUsage.count(),
      prisma.couponUsage.aggregate({
        _sum: { discountApplied: true }
      })
    ]);

    // Top cupons
    const topCoupons = await prisma.coupon.findMany({
      orderBy: { usedCount: 'desc' },
      take: 5,
      select: {
        id: true,
        code: true,
        name: true,
        usedCount: true,
        discountType: true,
        discountValue: true
      }
    });

    return {
      totalCoupons,
      activeCoupons,
      totalUsages,
      totalDiscountGiven: Number(totalDiscountGiven._sum.discountApplied || 0),
      topCoupons
    };
  }
};
