// Script para atualizar plano do tenant após pagamento manual
const { PrismaClient } = require('@prisma/client');

async function updatePlan() {
  const prisma = new PrismaClient();
  
  try {
    // Buscar tenant pelo nome
    const tenant = await prisma.tenant.findFirst({
      where: {
        name: { contains: 'max victor' }
      }
    });
    
    if (!tenant) {
      console.log('Tenant não encontrado!');
      return;
    }
    
    console.log('Tenant encontrado:', tenant.name);
    console.log('Plano atual:', tenant.subscriptionPlan);
    console.log('Status atual:', tenant.subscriptionStatus);
    
    // Calcular data de vencimento (30 dias a partir de agora)
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);
    
    // Atualizar para plano pago
    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionPlan: 'basic', // ou o plano que foi comprado
        subscriptionStatus: 'active',
        stripeCurrentPeriodEnd: periodEnd,
        trialEndsAt: null // Remover data de trial
      }
    });
    
    console.log('\n=== ATUALIZADO ===');
    console.log('Novo plano:', updated.subscriptionPlan);
    console.log('Novo status:', updated.subscriptionStatus);
    console.log('Vencimento:', periodEnd.toLocaleDateString('pt-BR'));
    
  } finally {
    await prisma.$disconnect();
  }
}

updatePlan();
