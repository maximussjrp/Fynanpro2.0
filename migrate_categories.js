const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Estrutura das categorias padrão (baseada em default-categories.ts)
const defaultCategories = [
  // RECEITAS
  {
    name: '💵 Receitas',
    type: 'income',
    children: [
      { name: 'Salário', children: [] },
      { name: 'Freelance', children: [] },
      { name: 'Investimentos', children: [] },
      { name: 'Vendas', children: [] },
      { name: 'Outros', children: [] }
    ]
  },
  // DESPESAS
  {
    name: '🏠 Moradia',
    type: 'expense',
    children: [
      { name: 'Aluguel', children: [] },
      { name: 'Condomínio', children: [] },
      { name: 'Luz', children: [] },
      { name: 'Água', children: [] },
      { name: 'Gás', children: [] },
      { name: 'Internet', children: [] },
      { name: 'IPTU', children: [] },
      { name: 'Seguro Residencial', children: [] },
      { name: 'Manutenção', children: ['Reparos', 'Reforma'] }
    ]
  },
  {
    name: '🍔 Alimentação',
    type: 'expense',
    children: [
      { name: 'Mercado', children: [] },
      { name: 'Açougue / Hortifruti', children: [] },
      { name: 'Padaria', children: [] },
      { name: 'Restaurante', children: [] },
      { name: 'Delivery', children: ['iFood', 'Outros Apps'] },
      { name: 'Bebidas Não Alcoólicas', children: [] }
    ]
  },
  {
    name: '🏥 Saúde',
    type: 'expense',
    children: [
      { name: 'Plano de Saúde', children: [] },
      { name: 'Consultas', children: [] },
      { name: 'Exames', children: [] },
      { name: 'Farmácia', children: [] },
      { name: 'Terapia / Psicólogo', children: [] },
      { name: 'Dentista', children: [] },
      { name: 'Emergências', children: [] }
    ]
  },
  {
    name: '💰 Dívidas',
    type: 'expense',
    children: [
      { name: 'Cartões de Crédito', children: ['Fatura Nubank', 'Fatura Inter', 'Outros Cartões'] },
      { name: 'Empréstimos', children: [] },
      { name: 'Cheque Especial', children: [] },
      { name: 'Acordos', children: [] },
      { name: 'Refinanciamento', children: [] }
    ]
  },
  {
    name: '🏛️ Impostos',
    type: 'expense',
    children: [
      { name: 'IPVA', children: [] },
      { name: 'Taxas Bancárias', children: [] },
      { name: 'Multas', children: [] },
      { name: 'Tarifas de Serviços', children: [] }
    ]
  },
  {
    name: '🚗 Transporte',
    type: 'expense',
    children: [
      { name: 'Carro', children: ['Combustível', 'Manutenção', 'Documentação', 'IPVA', 'Seguro', 'Parcelas do Carro'] },
      { name: 'Moto', children: ['Combustível', 'Manutenção', 'Documentação', 'IPVA', 'Seguro', 'Parcelas da Moto'] },
      { name: 'Transporte Público', children: [] },
      { name: 'Uber / Táxi', children: [] },
      { name: 'Estacionamento', children: [] },
      { name: 'Pedágio', children: [] }
    ]
  },
  {
    name: '💼 Trabalho',
    type: 'expense',
    children: [
      { name: 'Ferramentas', children: [] },
      { name: 'Uniformes', children: [] },
      { name: 'Cursos Profissionais', children: [] },
      { name: 'Gastos com Clientes', children: [] },
      { name: 'Documentação Profissional', children: [] }
    ]
  },
  {
    name: '🎓 Educação',
    type: 'expense',
    children: [
      { name: 'Escola / Faculdade', children: [] },
      { name: 'Cursos', children: [] },
      { name: 'Livros / Materiais', children: [] },
      { name: 'Pós / Especialização', children: [] }
    ]
  },
  {
    name: '👨‍👩‍👧 Família',
    type: 'expense',
    children: [
      { name: 'Filhos', children: ['Escola', 'Roupas', 'Presentes', 'Outros'] },
      { name: 'Animais de Estimação', children: ['Ração', 'Veterinário', 'Banho & Tosa'] },
      { name: 'Pais / Avós', children: [] }
    ]
  },
  {
    name: '💅 Beleza e Saúde',
    type: 'expense',
    children: [
      { name: 'Cosméticos', children: [] },
      { name: 'Maquiagem', children: [] },
      { name: 'Perfumaria', children: [] },
      { name: 'Cabeleireiro / Salão', children: [] },
      { name: 'Manicure / Pedicure', children: [] },
      { name: 'Tratamentos Estéticos', children: [] },
      { name: 'Spa / Massagem', children: [] },
      { name: 'Academia', children: [] }
    ]
  },
  {
    name: '👕 Vestuário',
    type: 'expense',
    children: [
      { name: 'Roupas', children: [] },
      { name: 'Calçados', children: [] },
      { name: 'Acessórios', children: [] },
      { name: 'Lavanderia', children: [] }
    ]
  },
  {
    name: '🎮 Lazer',
    type: 'expense',
    children: [
      { name: 'Cinema', children: [] },
      { name: 'Viagens', children: [] },
      { name: 'Bares / Restaurantes', children: [] },
      { name: 'Streaming / Assinaturas', children: [] },
      { name: 'Presentes', children: [] },
      { name: 'Hobbies', children: ['Games', 'Música', 'Esportes'] }
    ]
  },
  {
    name: '🚬 Vícios',
    type: 'expense',
    children: [
      { name: 'Cigarro', children: [] },
      { name: 'Bebida', children: [] },
      { name: 'Jogos / Apostas', children: [] },
      { name: 'Doces / Chocolates (Excesso)', children: [] },
      { name: 'Delivery Excessivo', children: ['iFood'] }
    ]
  },
  {
    name: '💸 Impulso Financeiro',
    type: 'expense',
    children: [
      { name: 'Compras Sem Planejamento', children: [] },
      { name: 'Gastos Repentinos', children: [] },
      { name: 'Compras Emocionais', children: [] }
    ]
  },
  {
    name: '📈 Investimentos',
    type: 'expense',
    children: [
      { name: 'Reserva de Emergência', children: [] },
      { name: 'Renda Fixa', children: [] },
      { name: 'Ações', children: [] },
      { name: 'Fundos', children: [] },
      { name: 'Cripto', children: [] },
      { name: 'Previdência', children: [] }
    ]
  },
  {
    name: '🎯 Metas Financeiras',
    type: 'expense',
    children: [
      { name: 'Comprar Carro', children: [] },
      { name: 'Comprar Casa', children: [] },
      { name: 'Quitar Dívidas', children: [] },
      { name: 'Viagem', children: [] },
      { name: 'Casamento', children: [] },
      { name: 'Estudos', children: [] },
      { name: 'Reserva Financeira', children: [] }
    ]
  }
];

// Função para normalizar nome (remover acentos e lowercase)
function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function migrateCategories() {
  console.log('🚀 Iniciando migração de categorias...\n');
  
  // 1. Buscar todos os tenants
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null }
  });
  console.log(`📋 Encontrados ${tenants.length} tenants\n`);

  for (const tenant of tenants) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏢 Processando tenant: ${tenant.name} (${tenant.id})`);
    console.log(`${'='.repeat(60)}\n`);
    
    // 2. Buscar categorias existentes do tenant
    const existingCategories = await prisma.category.findMany({
      where: { tenantId: tenant.id, deletedAt: null }
    });
    console.log(`   📂 Categorias existentes: ${existingCategories.length}`);
    
    // 3. Buscar transações com categoria deste tenant
    const transactions = await prisma.transaction.findMany({
      where: { tenantId: tenant.id, categoryId: { not: null } },
      include: { category: true }
    });
    console.log(`   💳 Transações com categoria: ${transactions.length}`);
    
    // 4. Criar mapa de categorias antigas -> nome normalizado
    const oldCategoryMap = new Map(); // id -> { name, normalizedName }
    for (const cat of existingCategories) {
      oldCategoryMap.set(cat.id, {
        name: cat.name,
        normalized: normalize(cat.name),
        type: cat.type
      });
    }
    
    // 5. Soft delete de TODAS as categorias antigas
    const deleteResult = await prisma.category.updateMany({
      where: { tenantId: tenant.id, deletedAt: null },
      data: { deletedAt: new Date() }
    });
    console.log(`   🗑️  Soft deleted: ${deleteResult.count} categorias antigas`);
    
    // 6. Criar novas categorias e manter mapeamento
    const newCategoryMap = new Map(); // normalizedName -> newId
    let createdCount = 0;
    
    for (const category of defaultCategories) {
      // Criar L1
      const l1 = await prisma.category.create({
        data: {
          tenantId: tenant.id,
          name: category.name,
          type: category.type,
          level: 1,
          isActive: true
        }
      });
      newCategoryMap.set(normalize(category.name), l1.id);
      createdCount++;
      
      // Criar L2
      if (category.children) {
        for (const child of category.children) {
          const l2 = await prisma.category.create({
            data: {
              tenantId: tenant.id,
              name: child.name,
              type: category.type,
              level: 2,
              parentId: l1.id,
              isActive: true
            }
          });
          newCategoryMap.set(normalize(child.name), l2.id);
          createdCount++;
          
          // Criar L3
          if (child.children && child.children.length > 0) {
            for (const grandchild of child.children) {
              const l3 = await prisma.category.create({
                data: {
                  tenantId: tenant.id,
                  name: grandchild,
                  type: category.type,
                  level: 3,
                  parentId: l2.id,
                  isActive: true
                }
              });
              newCategoryMap.set(normalize(grandchild), l3.id);
              createdCount++;
            }
          }
        }
      }
    }
    console.log(`   ✅ Criadas: ${createdCount} novas categorias`);
    
    // 7. Atualizar transações para apontar para novas categorias
    let updatedTransactions = 0;
    let notFoundCategories = [];
    
    for (const tx of transactions) {
      const oldCat = oldCategoryMap.get(tx.categoryId);
      if (oldCat) {
        // Tentar encontrar a nova categoria pelo nome normalizado
        let newCatId = newCategoryMap.get(oldCat.normalized);
        
        // Se não encontrar, tentar algumas variações comuns
        if (!newCatId) {
          // Tentar sem emoji
          const nameWithoutEmoji = oldCat.name.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
          newCatId = newCategoryMap.get(normalize(nameWithoutEmoji));
        }
        
        if (newCatId) {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { categoryId: newCatId }
          });
          updatedTransactions++;
        } else {
          // Categoria não encontrada - criar mapeamento para "Outros" do tipo apropriado
          const othersKey = oldCat.type === 'income' ? 'outros' : 'outros';
          const othersCatId = newCategoryMap.get(othersKey);
          
          if (othersCatId) {
            await prisma.transaction.update({
              where: { id: tx.id },
              data: { categoryId: othersCatId }
            });
            updatedTransactions++;
            notFoundCategories.push(oldCat.name);
          }
        }
      }
    }
    
    console.log(`   🔄 Transações atualizadas: ${updatedTransactions}`);
    if (notFoundCategories.length > 0) {
      console.log(`   ⚠️  Categorias mapeadas para "Outros": ${[...new Set(notFoundCategories)].join(', ')}`);
    }
  }
  
  // 8. Verificação final
  console.log('\n\n📊 VERIFICAÇÃO FINAL:');
  console.log('='.repeat(60));
  
  for (const tenant of tenants) {
    const cats = await prisma.category.findMany({
      where: { tenantId: tenant.id, deletedAt: null }
    });
    const l1 = cats.filter(c => c.level === 1).length;
    const l2 = cats.filter(c => c.level === 2).length;
    const l3 = cats.filter(c => c.level === 3).length;
    console.log(`\n${tenant.name}:`);
    console.log(`   L1: ${l1} | L2: ${l2} | L3: ${l3} | Total: ${cats.length}`);
    
    // Verificar duplicatas
    const names = cats.map(c => c.name);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length > 0) {
      console.log(`   ⚠️  DUPLICATAS ENCONTRADAS: ${[...new Set(duplicates)].join(', ')}`);
    } else {
      console.log(`   ✅ Nenhuma duplicata`);
    }
  }
  
  console.log('\n\n✅ MIGRAÇÃO CONCLUÍDA!');
}

migrateCategories()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
