import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  // 1. Criar Master User (Max Guarinieri)
  console.log('👤 Criando usuário Master...');
  const masterPassword = await bcrypt.hash('MxG#2025$FynanPro!Dev', 12);
  
  const masterUser = await prisma.user.upsert({
    where: { email: 'max.guarinieri@gmail.com' },
    update: {
      passwordHash: masterPassword,
      isActive: true,
    },
    create: {
      email: 'max.guarinieri@gmail.com',
      passwordHash: masterPassword,
      fullName: 'Max Guarinieri',
      role: 'owner',
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log('✅ Usuário Master criado:', masterUser.email);

  // 2. Criar Tenant Master
  console.log('\n🏢 Criando tenant master...');
  const masterTenant = await prisma.tenant.upsert({
    where: { slug: 'maxguarinieri' },
    update: {
      ownerId: masterUser.id,
    },
    create: {
      ownerId: masterUser.id,
      name: 'UTOP Master',
      slug: 'maxguarinieri',
      subscriptionPlan: 'enterprise',
      subscriptionStatus: 'active',
      trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
    },
  });
  console.log('✅ Tenant Master criado:', masterTenant.name);

  // 3. Vincular usuário ao tenant
  await prisma.tenantUser.upsert({
    where: {
      tenantId_userId: {
        tenantId: masterTenant.id,
        userId: masterUser.id,
      },
    },
    update: {},
    create: {
      tenantId: masterTenant.id,
      userId: masterUser.id,
      role: 'owner',
    },
  });
  console.log('✅ Usuário vinculado ao tenant');

  // 4. Criar Categorias Padrão
  console.log('\n📂 Criando categorias padrão...');
  
  // Verifica se já existem categorias
  const existingCategories = await prisma.category.count({
    where: { tenantId: masterTenant.id },
  });

  if (existingCategories === 0) {
    const categories = [
      // RECEITAS
      { name: '💼 Salário', type: 'income', icon: '💼', color: '#2ECC9A' },
      { name: '💰 Investimentos', type: 'income', icon: '💰', color: '#22C55E' },
      { name: '🎁 Extras', type: 'income', icon: '🎁', color: '#9AF0C6' },
      { name: '💵 Freelance', type: 'income', icon: '💵', color: '#66BB6A' },
      
      // DESPESAS
      { name: '🏠 Moradia', type: 'expense', icon: '🏠', color: '#EF4444' },
      { name: '🍔 Alimentação', type: 'expense', icon: '🍔', color: '#FF6B6B' },
      { name: '🚗 Transporte', type: 'expense', icon: '🚗', color: '#FF9800' },
      { name: '🏥 Saúde', type: 'expense', icon: '🏥', color: '#E91E63' },
      { name: '📚 Educação', type: 'expense', icon: '📚', color: '#9C27B0' },
      { name: '🎮 Lazer', type: 'expense', icon: '🎮', color: '#673AB7' },
      { name: '💳 Contas', type: 'expense', icon: '💳', color: '#F44336' },
      { name: '👕 Vestuário', type: 'expense', icon: '👕', color: '#FF5722' },
      { name: '🏋️ Academia', type: 'expense', icon: '🏋️', color: '#8BC34A' },
      { name: '🐕 Pets', type: 'expense', icon: '🐕', color: '#795548' },
    ];

    await prisma.category.createMany({
      data: categories.map(cat => ({
        tenantId: masterTenant.id,
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        isActive: true,
      })),
    });
    console.log(`✅ ${categories.length} categorias criadas`);
  } else {
    console.log(`✅ Categorias já existem (${existingCategories} encontradas)`);
  }

  console.log('\n✨ Seed concluído com sucesso!');
  console.log('\n📧 Credenciais de acesso:');
  console.log('   Email: max.guarinieri@gmail.com');
  console.log('   Senha: MxG#2025$FynanPro!Dev');
  console.log('   Tenant: UTOP Master');
  console.log('   Plano: Enterprise (1 ano)\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
