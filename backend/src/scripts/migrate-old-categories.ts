import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

interface CategoryMapping {
  oldId: string;
  oldName: string;
  newId: string;
  newName: string;
  transactionCount: number;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function migrateCategories() {
  console.log('🔄 Iniciando migração de categorias antigas para hierárquicas...\n');

  try {
    // Buscar tenant master
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'maxguarinieri' }
    });

    if (!tenant) {
      console.error('❌ Tenant master não encontrado!');
      return;
    }

    // Buscar todas as categorias
    const allCategories = await prisma.category.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      include: {
        _count: {
          select: { transactions: true }
        }
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }]
    });

    // Separar categorias antigas (sem parentId e level 1, mas sem children)
    const oldCategories = allCategories.filter(cat => {
      const hasTransactions = cat._count.transactions > 0;
      const isLevel1 = cat.level === 1;
      const hasNoParent = !cat.parentId;
      
      // Verifica se tem categorias filhas
      const hasChildren = allCategories.some(c => c.parentId === cat.id);
      
      // Categoria antiga: nível 1, sem parent, sem children, mas pode ter transações
      return isLevel1 && hasNoParent && !hasChildren;
    });

    // Categorias novas hierárquicas (tem children ou tem parent)
    const newCategories = allCategories.filter(cat => {
      const hasChildren = allCategories.some(c => c.parentId === cat.id);
      const hasParent = !!cat.parentId;
      return hasChildren || hasParent;
    });

    console.log('📊 Análise:');
    console.log(`   Categorias antigas (flat): ${oldCategories.length}`);
    console.log(`   Categorias novas (hierárquicas): ${newCategories.length}`);
    console.log(`   Total: ${allCategories.length}\n`);

    if (oldCategories.length === 0) {
      console.log('✅ Nenhuma categoria antiga para migrar!');
      return;
    }

    // Verificar quais categorias antigas têm transações
    const categoriesToMigrate = oldCategories.filter(cat => cat._count.transactions > 0);
    const categoriesToDelete = oldCategories.filter(cat => cat._count.transactions === 0);

    console.log(`📝 Categorias antigas COM transações (precisam migração): ${categoriesToMigrate.length}`);
    console.log(`🗑️  Categorias antigas SEM transações (podem ser deletadas): ${categoriesToDelete.length}\n`);

    // Criar mapeamentos automáticos baseados em nome similar
    const mappings: CategoryMapping[] = [];

    for (const oldCat of categoriesToMigrate) {
      console.log(`\n🔍 Categoria antiga: ${oldCat.icon} ${oldCat.name}`);
      console.log(`   ${oldCat._count.transactions} transações vinculadas`);
      console.log(`   Tipo: ${oldCat.type === 'expense' ? 'Despesa' : 'Receita'}\n`);

      // Buscar categorias novas do mesmo tipo
      const compatibleNewCategories = newCategories.filter(c => c.type === oldCat.type);

      // Tentar encontrar match por nome
      const suggestedMatch = compatibleNewCategories.find(c => 
        c.name.toLowerCase().includes(oldCat.name.toLowerCase()) ||
        oldCat.name.toLowerCase().includes(c.name.toLowerCase())
      );

      console.log('   Categorias disponíveis para migração:');
      compatibleNewCategories.slice(0, 15).forEach((newCat, idx) => {
        const isSuggested = suggestedMatch?.id === newCat.id;
        const prefix = isSuggested ? '👉 [SUGERIDO]' : '   ';
        const hierarchy = newCat.level === 1 ? '' : '  '.repeat(newCat.level - 1) + '└ ';
        console.log(`   ${prefix} ${idx + 1}. ${hierarchy}${newCat.icon} ${newCat.name} (Nível ${newCat.level})`);
      });

      if (compatibleNewCategories.length > 15) {
        console.log(`   ... e mais ${compatibleNewCategories.length - 15} categorias`);
      }

      const answer = await question('\n   Digite o número da categoria de destino (ou "s" para pular): ');

      if (answer.toLowerCase() === 's') {
        console.log('   ⏭️  Pulando...');
        continue;
      }

      const selectedIndex = parseInt(answer) - 1;
      if (selectedIndex >= 0 && selectedIndex < compatibleNewCategories.length) {
        const newCat = compatibleNewCategories[selectedIndex];
        mappings.push({
          oldId: oldCat.id,
          oldName: oldCat.name,
          newId: newCat.id,
          newName: newCat.name,
          transactionCount: oldCat._count.transactions
        });
        console.log(`   ✅ ${oldCat.name} → ${newCat.name}`);
      } else {
        console.log('   ❌ Índice inválido, pulando...');
      }
    }

    // Confirmar migração
    console.log('\n\n📋 RESUMO DA MIGRAÇÃO:');
    console.log('═══════════════════════════════════════════════════════\n');
    
    let totalTransactions = 0;
    mappings.forEach(map => {
      console.log(`   ${map.oldName} → ${map.newName}`);
      console.log(`   └ ${map.transactionCount} transações\n`);
      totalTransactions += map.transactionCount;
    });

    console.log(`   Total de transações a migrar: ${totalTransactions}`);
    console.log(`   Categorias antigas a deletar (sem transações): ${categoriesToDelete.length}\n`);

    const confirm = await question('Confirma a migração? (s/n): ');

    if (confirm.toLowerCase() !== 's') {
      console.log('\n❌ Migração cancelada.');
      rl.close();
      await prisma.$disconnect();
      return;
    }

    // Executar migração
    console.log('\n🚀 Executando migração...\n');

    for (const mapping of mappings) {
      console.log(`   Migrando ${mapping.oldName}...`);
      
      await prisma.transaction.updateMany({
        where: { categoryId: mapping.oldId },
        data: { categoryId: mapping.newId }
      });

      // Deletar categoria antiga
      await prisma.category.update({
        where: { id: mapping.oldId },
        data: { deletedAt: new Date() }
      });

      console.log(`   ✅ ${mapping.transactionCount} transações migradas`);
    }

    // Deletar categorias antigas sem transações
    if (categoriesToDelete.length > 0) {
      console.log(`\n🗑️  Deletando ${categoriesToDelete.length} categorias antigas sem transações...`);
      
      for (const cat of categoriesToDelete) {
        await prisma.category.update({
          where: { id: cat.id },
          data: { deletedAt: new Date() }
        });
        console.log(`   ✅ Deletada: ${cat.name}`);
      }
    }

    console.log('\n✨ Migração concluída com sucesso!');
    console.log(`📊 Resumo final:`);
    console.log(`   - ${totalTransactions} transações migradas`);
    console.log(`   - ${mappings.length} categorias antigas migradas`);
    console.log(`   - ${categoriesToDelete.length} categorias antigas deletadas`);

  } catch (error) {
    console.error('\n❌ Erro durante migração:', error);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

migrateCategories();
