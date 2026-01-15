import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateAndCleanup() {
  try {
    console.log('🔄 Iniciando migração e limpeza de categorias...\n');

    // Pegar todos os tenants
    const tenants = await prisma.tenant.findMany();
    console.log(`📊 Encontrados ${tenants.length} tenant(s)\n`);

    for (const tenant of tenants) {
      console.log(`\n🏢 Processando tenant: ${tenant.name} (${tenant.id})`);

      // Buscar todas as categorias (incluindo as antigas)
      const allCategories = await prisma.category.findMany({
        where: {
          tenantId: tenant.id,
          deletedAt: null,
        },
        include: {
          _count: {
            select: { transactions: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      console.log(`   Total de categorias: ${allCategories.length}`);

      // Separar categorias antigas (level 0 ou null) e novas (level 1, 2, 3)
      const oldCategories = allCategories.filter(c => !c.level || c.level === 0);
      const newCategories = allCategories.filter(c => c.level && c.level > 0);

      console.log(`   Categorias antigas (a migrar): ${oldCategories.length}`);
      console.log(`   Categorias novas (hierárquicas): ${newCategories.length}`);

      if (oldCategories.length === 0) {
        console.log('   ✅ Nenhuma categoria antiga para migrar');
        continue;
      }

      // Criar mapeamento de categorias antigas para novas
      const migrations: Array<{old: any, new: any, reason: string}> = [];

      for (const oldCat of oldCategories) {
        // Tentar encontrar categoria nova correspondente
        const newCat = newCategories.find(nc => 
          nc.name.toLowerCase().includes(oldCat.name.toLowerCase()) ||
          oldCat.name.toLowerCase().includes(nc.name.toLowerCase())
        );

        if (newCat) {
          migrations.push({
            old: oldCat,
            new: newCat,
            reason: 'Match por nome'
          });
        } else {
          // Se não encontrou match, usar categoria genérica do mesmo tipo
          const genericNew = newCategories.find(nc => 
            nc.type === oldCat.type && 
            (nc.name === 'Outros' || nc.name === 'Outras')
          );

          if (genericNew) {
            migrations.push({
              old: oldCat,
              new: genericNew,
              reason: 'Categoria genérica (Outros)'
            });
          } else {
            // Usar a primeira categoria do mesmo tipo
            const firstOfType = newCategories.find(nc => nc.type === oldCat.type);
            if (firstOfType) {
              migrations.push({
                old: oldCat,
                new: firstOfType,
                reason: 'Primeira categoria do mesmo tipo'
              });
            }
          }
        }
      }

      console.log(`\n   📋 Plano de migração:`);
      for (const mig of migrations) {
        console.log(`      ${mig.old.icon} ${mig.old.name} (${mig.old._count.transactions} transações)`);
        console.log(`         → ${mig.new.icon} ${mig.new.name} [${mig.reason}]`);
      }

      // Executar migrações
      let totalMigrated = 0;
      let totalDeleted = 0;

      for (const mig of migrations) {
        const transactionCount = mig.old._count.transactions;

        if (transactionCount > 0) {
          // Migrar transações
          await prisma.transaction.updateMany({
            where: {
              categoryId: mig.old.id,
              tenantId: tenant.id,
              deletedAt: null
            },
            data: {
              categoryId: mig.new.id
            }
          });

          console.log(`      ✅ Migradas ${transactionCount} transações: ${mig.old.name} → ${mig.new.name}`);
          totalMigrated += transactionCount;
        }

        // Soft delete da categoria antiga
        await prisma.category.update({
          where: { id: mig.old.id },
          data: {
            deletedAt: new Date(),
            isActive: false
          }
        });

        console.log(`      🗑️  Categoria antiga excluída: ${mig.old.name}`);
        totalDeleted++;
      }

      console.log(`\n   ✨ Resumo do tenant:`);
      console.log(`      - Transações migradas: ${totalMigrated}`);
      console.log(`      - Categorias antigas removidas: ${totalDeleted}`);
    }

    console.log('\n\n✅ Migração e limpeza concluída com sucesso!');

    // Estatísticas finais
    const stats = await prisma.category.groupBy({
      by: ['level', 'type', 'isActive'],
      _count: true,
      where: {
        deletedAt: null
      }
    });

    console.log('\n📊 Estatísticas finais:');
    console.log(stats);

  } catch (error) {
    console.error('❌ Erro na migração:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateAndCleanup();
