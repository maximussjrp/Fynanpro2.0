import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    console.log('🚀 Criando usuário de teste...\n');

    const email = 'xxmaxx05@gmail.com';
    const password = 'Senha123!';
    const fullName = 'Max Silva';

    // Verifica se já existe
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      console.log('⚠️  Usuário já existe!');
      console.log(`   Email: ${email}`);
      console.log(`   Use a senha cadastrada ou delete o usuário primeiro.\n`);
      return;
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 12);

    // Gera slug único
    const baseSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let slug = baseSlug;
    let counter = 1;

    while (await prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}${counter}`;
      counter++;
    }

    // Cria usuário + tenant em transação
    const result = await prisma.$transaction(async (tx) => {
      // Cria usuário
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          role: 'owner',
          isActive: true,
          lastLoginAt: new Date(),
        },
      });

      // Cria tenant
      const tenant = await tx.tenant.create({
        data: {
          ownerId: user.id,
          name: `Workspace de ${fullName}`,
          slug,
          subscriptionPlan: 'trial',
          subscriptionStatus: 'active',
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
        },
      });

      // Vincula usuário ao tenant
      await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: 'owner',
        },
      });

      // Categorias padrão (simplificado)
      const categories = [
        // RECEITAS
        { name: '💼 Salário', type: 'income', icon: '💼', color: '#22C39A' },
        { name: '💰 Investimentos', type: 'income', icon: '💰', color: '#4CAF50' },
        { name: '🎁 Extras', type: 'income', icon: '🎁', color: '#8BC34A' },
        
        // DESPESAS
        { name: '🏠 Moradia', type: 'expense', icon: '🏠', color: '#E74C3C' },
        { name: '🍔 Alimentação', type: 'expense', icon: '🍔', color: '#FF6B6B' },
        { name: '🚗 Transporte', type: 'expense', icon: '🚗', color: '#FF9800' },
        { name: '🏥 Saúde', type: 'expense', icon: '🏥', color: '#E91E63' },
        { name: '📚 Educação', type: 'expense', icon: '📚', color: '#9C27B0' },
        { name: '🎮 Lazer', type: 'expense', icon: '🎮', color: '#673AB7' },
        { name: '💳 Contas', type: 'expense', icon: '💳', color: '#F44336' },
      ];

      await tx.category.createMany({
        data: categories.map((cat) => ({
          tenantId: tenant.id,
          name: cat.name,
          type: cat.type,
          icon: cat.icon,
          color: cat.color,
        })),
      });

      return { user, tenant };
    });

    console.log('✅ Usuário criado com sucesso!\n');
    console.log('📧 Email:', email);
    console.log('🔑 Senha:', password);
    console.log('👤 Nome:', fullName);
    console.log('🏢 Tenant:', result.tenant.name);
    console.log('🔗 Slug:', result.tenant.slug);
    console.log('\n🎯 Use essas credenciais para fazer login!\n');

  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
