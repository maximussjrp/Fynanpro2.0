const { PrismaClient } = require('@prisma/client');

async function check() {
  const prisma = new PrismaClient();
  
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        name: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndsAt: true
      }
    });
    
    console.log('=== TENANTS ===');
    tenants.forEach(t => {
      const trialEnd = t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString('pt-BR') : 'N/A';
      console.log(`${t.name}: Plano=${t.subscriptionPlan}, Status=${t.subscriptionStatus}, TrialEnds=${trialEnd}`);
    });

    const subs = await prisma.subscription.findMany({
      select: {
        tenantId: true,
        plan: true,
        status: true,
        currentPeriodEnd: true
      }
    });
    
    console.log('\n=== SUBSCRIPTIONS ===');
    subs.forEach(s => {
      const periodEnd = s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString('pt-BR') : 'N/A';
      console.log(`TenantId=${s.tenantId.substring(0,8)}..., Plano=${s.plan}, Status=${s.status}, PeriodEnd=${periodEnd}`);
    });
    
  } finally {
    await prisma.$disconnect();
  }
}

check();
