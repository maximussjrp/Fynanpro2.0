// fix-income-categories.js
// Corrige transações de income que estão sem categoria ou com categoria de tipo errado

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixIncomeCategories() {
  console.log('=== CORREÇÃO DE CATEGORIAS DE RECEITAS ===\n');

  // 1. Buscar todos os tenants
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true }
  });

  for (const tenant of tenants) {
    console.log(`\n--- Tenant: ${tenant.name} (${tenant.id}) ---`);

    // 2. Buscar ou criar categoria "Outros" do tipo income
    let incomeOutrosCategory = await prisma.category.findFirst({
      where: {
        tenantId: tenant.id,
        type: 'income',
        level: 1,
        name: { contains: 'Outros', mode: 'insensitive' }
      }
    });

    if (!incomeOutrosCategory) {
      // Tentar encontrar a categoria "Receitas" principal
      let receitasCategory = await prisma.category.findFirst({
        where: {
          tenantId: tenant.id,
          type: 'income',
          level: 1
        }
      });

      if (receitasCategory) {
        // Criar "Outros" como subcategoria de Receitas
        incomeOutrosCategory = await prisma.category.create({
          data: {
            tenantId: tenant.id,
            name: 'Outros (Receitas)',
            icon: '💵',
            type: 'income',
            level: 2,
            parentId: receitasCategory.id,
            isActive: true
          }
        });
        console.log(`✅ Criada categoria "Outros (Receitas)" como subcategoria`);
      } else {
        // Criar categoria principal de receitas
        incomeOutrosCategory = await prisma.category.create({
          data: {
            tenantId: tenant.id,
            name: '💵 Receitas Diversas',
            icon: '💵',
            type: 'income',
            level: 1,
            isActive: true
          }
        });
        console.log(`✅ Criada categoria "Receitas Diversas" nível 1`);
      }
    }

    console.log(`Categoria para receitas: ${incomeOutrosCategory.name} (${incomeOutrosCategory.id})`);

    // 3. Buscar transações de income SEM categoria
    const incomeWithoutCategory = await prisma.transaction.findMany({
      where: {
        tenantId: tenant.id,
        type: 'income',
        categoryId: null,
        deletedAt: null
      }
    });

    console.log(`Transações income sem categoria: ${incomeWithoutCategory.length}`);

    if (incomeWithoutCategory.length > 0) {
      const updated = await prisma.transaction.updateMany({
        where: {
          id: { in: incomeWithoutCategory.map(t => t.id) }
        },
        data: {
          categoryId: incomeOutrosCategory.id
        }
      });
      console.log(`✅ Atualizadas ${updated.count} transações income sem categoria`);
    }

    // 4. Buscar transações de income COM categoria de tipo expense
    const incomeWithWrongCategory = await prisma.transaction.findMany({
      where: {
        tenantId: tenant.id,
        type: 'income',
        deletedAt: null,
        category: {
          type: 'expense'
        }
      },
      include: {
        category: { select: { id: true, name: true, type: true } }
      }
    });

    console.log(`Transações income com categoria expense: ${incomeWithWrongCategory.length}`);

    if (incomeWithWrongCategory.length > 0) {
      const updated = await prisma.transaction.updateMany({
        where: {
          id: { in: incomeWithWrongCategory.map(t => t.id) }
        },
        data: {
          categoryId: incomeOutrosCategory.id
        }
      });
      console.log(`✅ Atualizadas ${updated.count} transações income com categoria errada`);
    }
  }

  // 5. Verificação final
  console.log('\n=== VERIFICAÇÃO FINAL ===');
  
  const incomeWithProperCategory = await prisma.transaction.count({
    where: {
      type: 'income',
      deletedAt: null,
      category: {
        type: 'income'
      }
    }
  });

  const incomeWithoutCategoryFinal = await prisma.transaction.count({
    where: {
      type: 'income',
      categoryId: null,
      deletedAt: null
    }
  });

  const incomeWithWrongCategoryFinal = await prisma.transaction.count({
    where: {
      type: 'income',
      deletedAt: null,
      category: {
        type: 'expense'
      }
    }
  });

  console.log(`Income com categoria income: ${incomeWithProperCategory}`);
  console.log(`Income sem categoria: ${incomeWithoutCategoryFinal}`);
  console.log(`Income com categoria expense: ${incomeWithWrongCategoryFinal}`);

  await prisma.$disconnect();
}

fixIncomeCategories().catch(console.error);
