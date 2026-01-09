// Corrigir plano - configurar data futura correta
const { PrismaClient } = require('@prisma/client');

async function fixPlan() {
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
    
    console.log('Tenant:', tenant.name);
    console.log('Plano atual:', tenant.subscriptionPlan);
    console.log('stripeCurrentPeriodEnd:', tenant.stripeCurrentPeriodEnd);
    console.log('trialEndsAt:', tenant.trialEndsAt);
    
    // Configurar vencimento para 30 dias no futuro
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);
    
    // Atualizar plano para basic com data correta
    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionPlan: 'basic',
        subscriptionStatus: 'active',
        stripeCurrentPeriodEnd: periodEnd,
        trialEndsAt: null // Limpar trial
      }
    });
    
    console.log('\n=== CORRIGIDO ===');
    console.log('Plano:', updated.subscriptionPlan);
    console.log('Status:', updated.subscriptionStatus);
    console.log('Vencimento:', periodEnd.toISOString());
    console.log('Trial:', updated.trialEndsAt);
    
  } finally {
    await prisma.$disconnect();
  }
}

fixPlan();
