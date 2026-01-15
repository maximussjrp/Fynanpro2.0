import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDuplicateCategories() {
  try {
    console.log('🧹 Iniciando limpeza de categorias duplicadas...\n');

    const tenants = await prisma.tenant.findMany();

    for (const tenant of tenants) {
      console.log(`\n🏢 Processando tenant: ${tenant.name}`);

      // Buscar TODAS as categorias (incluindo inativas)
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

      console.log(`   Total de categorias encontradas: ${allCategories.length}`);

      // Agrupar por nome + type + level
      const grouped = new Map<string, typeof allCategories>();
      
      for (const cat of allCategories) {
        const key = `${cat.name}-${cat.type}-${cat.level || 0}`;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(cat);
      }

      // Identificar duplicatas
      const duplicates: Array<{
        key: string,
        categories: typeof allCategories,
        toKeep: any,
        toDelete: typeof allCategories
      }> = [];

      for (const [key, cats] of grouped.entries()) {
        if (cats.length > 1) {
          // Manter a que tem mais transações, ou a mais recente se empatarem
          const sorted = [...cats].sort((a, b) => {
            if (a._count.transactions !== b._count.transactions) {
              return b._count.transactions - a._count.transactions;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });

          duplicates.push({
            key,
            categories: cats,
            toKeep: sorted[0],
            toDelete: sorted.slice(1)
          });
        }
      }

      console.log(`   Grupos de duplicatas encontrados: ${duplicates.length}\n`);

      if (duplicates.length === 0) {
        console.log('   ✅ Nenhuma duplicata encontrada');
        continue;
      }

      // Processar cada grupo de duplicatas
      let totalMigrated = 0;
      let totalDeleted = 0;

      for (const dup of duplicates) {
        console.log(`   📦 ${dup.key}:`);
        console.log(`      Manter: ${dup.toKeep.name} (ID: ${dup.toKeep.id.substring(0, 8)}..., ${dup.toKeep._count.transactions} transações)`);

        for (const catToDelete of dup.toDelete) {
          const transCount = catToDelete._count.transactions;

          if (transCount > 0) {
            // Migrar transações para a categoria que será mantida
            await prisma.transaction.updateMany({
              where: {
                categoryId: catToDelete.id,
                tenantId: tenant.id,
                deletedAt: null
              },
              data: {
                categoryId: dup.toKeep.id
              }
            });

            console.log(`      ✅ Migradas ${transCount} transações de ${catToDelete.id.substring(0, 8)}... → ${dup.toKeep.id.substring(0, 8)}...`);
            totalMigrated += transCount;
          }

          // Excluir duplicata
          await prisma.category.update({
            where: { id: catToDelete.id },
            data: {
              deletedAt: new Date(),
              isActive: false
            }
          });

          console.log(`      🗑️  Excluída: ${catToDelete.id.substring(0, 8)}... (${transCount} transações)`);
          totalDeleted++;
        }
      }

      console.log(`\n   ✨ Resumo do tenant:`);
      console.log(`      - Transações migradas: ${totalMigrated}`);
      console.log(`      - Categorias duplicadas removidas: ${totalDeleted}`);
      console.log(`      - Categorias únicas mantidas: ${allCategories.length - totalDeleted}`);
    }

    // Estatísticas finais
    console.log('\n\n📊 Estatísticas finais:');
    
    const finalStats = await prisma.category.findMany({
      where: {
        deletedAt: null,
        isActive: true
      },
      select: {
        name: true,
        type: true,
        level: true,
        tenantId: true
      }
    });

    const byTenant = new Map<string, any>();
    for (const cat of finalStats) {
      if (!byTenant.has(cat.tenantId)) {
        byTenant.set(cat.tenantId, {
          total: 0,
          byType: { income: 0, expense: 0 },
          byLevel: {} as any
        });
      }
      const stats = byTenant.get(cat.tenantId)!;
      stats.total++;
      stats.byType[cat.type as 'income' | 'expense']++;
      stats.byLevel[`level${cat.level}`] = (stats.byLevel[`level${cat.level}`] || 0) + 1;
    }

    for (const [tenantId, stats] of byTenant.entries()) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      console.log(`\n   ${tenant?.name}:`);
      console.log(`      Total: ${stats.total} categorias`);
      console.log(`      Receitas: ${stats.byType.income}`);
      console.log(`      Despesas: ${stats.byType.expense}`);
      console.log(`      Por nível:`, stats.byLevel);
    }

    console.log('\n✅ Limpeza concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro na limpeza:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicateCategories();
