import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('🔍 Verificando usuários no banco...\n');
    
    const users = await prisma.user.findMany({
      include: {
        ownedTenants: true,
        tenantUsers: {
          include: {
            tenant: true,
          },
        },
      },
    });

    console.log(`📊 Total de usuários: ${users.length}\n`);

    if (users.length === 0) {
      console.log('❌ Nenhum usuário encontrado no banco!');
      console.log('💡 Você precisa criar um usuário primeiro.');
      console.log('   Use: npm run seed ou registre-se pela API\n');
    } else {
      users.forEach((user, index) => {
        console.log(`👤 Usuário ${index + 1}:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Nome: ${user.fullName}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Ativo: ${user.isActive}`);
        console.log(`   Tenants próprios: ${user.ownedTenants.length}`);
        console.log(`   Tenants vinculados: ${user.tenantUsers.length}`);
        
        if (user.ownedTenants.length > 0) {
          console.log(`   Tenant: ${user.ownedTenants[0].name} (${user.ownedTenants[0].slug})`);
        } else if (user.tenantUsers.length > 0) {
          console.log(`   Tenant: ${user.tenantUsers[0].tenant.name} (${user.tenantUsers[0].tenant.slug})`);
        }
        console.log('');
      });
    }

    // Testar login com o primeiro usuário
    if (users.length > 0) {
      const firstUser = users[0];
      console.log(`\n🔑 Para testar login com ${firstUser.email}:`);
      console.log(`   POST http://localhost:3000/api/v1/auth/login`);
      console.log(`   Body: { "email": "${firstUser.email}", "password": "sua_senha_aqui" }`);
    }

  } catch (error) {
    console.error('❌ Erro ao verificar usuários:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
