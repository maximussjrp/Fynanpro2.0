/**
 * Script para criar perfis padrão para tenants que ainda não têm perfil
 * Isso é necessário para usuários que se registraram antes da funcionalidade de perfis
 * 
 * IMPORTANTE: Este script APENAS CRIA novos perfis, NÃO modifica dados existentes
 * 
 * Uso: node scripts/create-missing-profiles.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createMissingProfiles() {
  console.log('🔍 Buscando tenants sem perfis...\n');

  // Buscar todos os tenants ativos
  const tenants = await prisma.tenant.findMany({
    where: {
      deletedAt: null,
    },
    include: {
      owner: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      userProfiles: {
        where: {
          deletedAt: null,
        },
      },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    // Se já tem pelo menos um perfil, pular
    if (tenant.userProfiles.length > 0) {
      console.log(`✓ Tenant "${tenant.name}" já tem ${tenant.userProfiles.length} perfil(s)`);
      skipped++;
      continue;
    }

    // Criar perfil padrão para o owner
    if (tenant.owner) {
      console.log(`➕ Criando perfil para tenant "${tenant.name}" (owner: ${tenant.owner.fullName})...`);
      
      await prisma.userProfile.create({
        data: {
          tenantId: tenant.id,
          name: tenant.owner.fullName,
          documentType: 'PF',
          isDefault: true,
          color: '#1F4FD8',
        },
      });
      
      created++;
      console.log(`   ✓ Perfil criado com sucesso!`);
    }
  }

  console.log('\n📊 Resumo:');
  console.log(`   - Perfis criados: ${created}`);
  console.log(`   - Tenants já com perfil: ${skipped}`);
  console.log(`   - Total de tenants: ${tenants.length}`);
}

createMissingProfiles()
  .then(() => {
    console.log('\n✅ Script concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
