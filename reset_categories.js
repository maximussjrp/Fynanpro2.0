const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ESTRUTURA EXATA do default-categories.ts
const defaultCategories = [
  // ==================== RECEITAS ====================
  {
    name: '💵 Receitas',
    type: 'income',
    icon: '💵',
    color: '#22C55E',
    children: [
      { name: 'Salário' },
      { name: 'Freelance' },
      { name: 'Investimentos' },
      { name: 'Vendas' },
      { name: 'Outros' }
    ]
  },

  // ==================== DESPESAS ====================
  // PRIORIDADE 1 — ESSENCIAIS
  {
    name: '🏠 Moradia',
    type: 'expense',
    icon: '🏠',
    color: '#F59E0B',
    children: [
      { name: 'Aluguel' },
      { name: 'Condomínio' },
      { name: 'Luz' },
      { name: 'Água' },
      { name: 'Gás' },
      { name: 'Internet' },
      { name: 'IPTU' },
      { name: 'Seguro Residencial' },
      { name: 'Manutenção', children: ['Reparos', 'Reforma'] }
    ]
  },
  {
    name: '🍔 Alimentação',
    type: 'expense',
    icon: '🍔',
    color: '#EF4444',
    children: [
      { name: 'Mercado' },
      { name: 'Açougue / Hortifruti' },
      { name: 'Padaria' },
      { name: 'Restaurante' },
      { name: 'Delivery', children: ['iFood', 'Outros Apps'] },
      { name: 'Bebidas Não Alcoólicas' }
    ]
  },
  {
    name: '🏥 Saúde',
    type: 'expense',
    icon: '🏥',
    color: '#EC4899',
    children: [
      { name: 'Plano de Saúde' },
      { name: 'Consultas' },
      { name: 'Exames' },
      { name: 'Farmácia' },
      { name: 'Terapia / Psicólogo' },
      { name: 'Dentista' },
      { name: 'Emergências' }
    ]
  },

  // PRIORIDADE 2 — COMPROMISSOS FINANCEIROS
  {
    name: '💰 Dívidas',
    type: 'expense',
    icon: '💰',
    color: '#DC2626',
    children: [
      { name: 'Cartões de Crédito', children: ['Fatura Nubank', 'Fatura Inter', 'Outros Cartões'] },
      { name: 'Empréstimos' },
      { name: 'Cheque Especial' },
      { name: 'Acordos' },
      { name: 'Refinanciamento' }
    ]
  },
  {
    name: '🏛️ Impostos',
    type: 'expense',
    icon: '🏛️',
    color: '#6B7280',
    children: [
      { name: 'IPVA' },
      { name: 'Taxas Bancárias' },
      { name: 'Multas' },
      { name: 'Tarifas de Serviços' }
    ]
  },

  // PRIORIDADE 3 — FUNCIONAMENTO DA VIDA
  {
    name: '🚗 Transporte',
    type: 'expense',
    icon: '🚗',
    color: '#3B82F6',
    children: [
      { name: 'Carro', children: ['Combustível', 'Manutenção', 'Documentação', 'IPVA', 'Seguro', 'Parcelas do Carro'] },
      { name: 'Moto', children: ['Combustível', 'Manutenção', 'Documentação', 'IPVA', 'Seguro', 'Parcelas da Moto'] },
      { name: 'Transporte Público' },
      { name: 'Uber / Táxi' },
      { name: 'Estacionamento' },
      { name: 'Pedágio' }
    ]
  },
  {
    name: '💼 Trabalho',
    type: 'expense',
    icon: '💼',
    color: '#8B5CF6',
    children: [
      { name: 'Ferramentas' },
      { name: 'Uniformes' },
      { name: 'Cursos Profissionais' },
      { name: 'Gastos com Clientes' },
      { name: 'Documentação Profissional' }
    ]
  },
  {
    name: '🎓 Educação',
    type: 'expense',
    icon: '🎓',
    color: '#10B981',
    children: [
      { name: 'Escola / Faculdade' },
      { name: 'Cursos' },
      { name: 'Livros / Materiais' },
      { name: 'Pós / Especialização' }
    ]
  },

  // PRIORIDADE 4 — QUALIDADE DE VIDA
  {
    name: '👨‍👩‍👧 Família',
    type: 'expense',
    icon: '👨‍👩‍👧',
    color: '#F97316',
    children: [
      { name: 'Filhos', children: ['Escola', 'Roupas', 'Presentes', 'Outros'] },
      { name: 'Animais de Estimação', children: ['Ração', 'Veterinário', 'Banho & Tosa'] },
      { name: 'Pais / Avós' }
    ]
  },
  {
    name: '💅 Beleza e Saúde',
    type: 'expense',
    icon: '💅',
    color: '#DB2777',
    children: [
      { name: 'Cosméticos' },
      { name: 'Maquiagem' },
      { name: 'Perfumaria' },
      { name: 'Cabeleireiro / Salão' },
      { name: 'Manicure / Pedicure' },
      { name: 'Tratamentos Estéticos' },
      { name: 'Spa / Massagem' },
      { name: 'Academia' }
    ]
  },
  {
    name: '👕 Vestuário',
    type: 'expense',
    icon: '👕',
    color: '#6366F1',
    children: [
      { name: 'Roupas' },
      { name: 'Calçados' },
      { name: 'Acessórios' },
      { name: 'Lavanderia' }
    ]
  },

  // PRIORIDADE 5 — SUPÉRFLUOS
  {
    name: '🎮 Lazer',
    type: 'expense',
    icon: '🎮',
    color: '#14B8A6',
    children: [
      { name: 'Cinema' },
      { name: 'Viagens' },
      { name: 'Bares / Restaurantes' },
      { name: 'Streaming / Assinaturas' },
      { name: 'Presentes' },
      { name: 'Hobbies', children: ['Games', 'Música', 'Esportes'] }
    ]
  },

  // PRIORIDADE 6 — GASTOS DE RISCO (VÍCIOS)
  {
    name: '🚬 Vícios',
    type: 'expense',
    icon: '🚬',
    color: '#991B1B',
    children: [
      { name: 'Cigarro' },
      { name: 'Bebida' },
      { name: 'Jogos / Apostas' },
      { name: 'Doces / Chocolates (Excesso)' },
      { name: 'Delivery Excessivo', children: ['iFood'] }
    ]
  },
  {
    name: '💸 Impulso Financeiro',
    type: 'expense',
    icon: '💸',
    color: '#FBBF24',
    children: [
      { name: 'Compras Sem Planejamento' },
      { name: 'Gastos Repentinos' },
      { name: 'Compras Emocionais' }
    ]
  },

  // PRIORIDADE 7 — METAS E FUTURO
  {
    name: '📈 Investimentos',
    type: 'expense',
    icon: '📈',
    color: '#059669',
    children: [
      { name: 'Reserva de Emergência' },
      { name: 'Renda Fixa' },
      { name: 'Ações' },
      { name: 'Fundos' },
      { name: 'Cripto' },
      { name: 'Previdência' }
    ]
  },
  {
    name: '🎯 Metas Financeiras',
    type: 'expense',
    icon: '🎯',
    color: '#7C3AED',
    children: [
      { name: 'Comprar Carro' },
      { name: 'Comprar Casa' },
      { name: 'Quitar Dívidas' },
      { name: 'Viagem' },
      { name: 'Casamento' },
      { name: 'Estudos' },
      { name: 'Reserva Financeira' }
    ]
  }
];

async function resetCategories() {
  console.log('🔄 RESETANDO TODAS AS CATEGORIAS...\n');
  
  // 1. Buscar todos os tenants
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null }
  });
  console.log(`📋 Encontrados ${tenants.length} tenants\n`);

  for (const tenant of tenants) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏢 Processando: ${tenant.name}`);
    console.log(`${'='.repeat(60)}`);
    
    // 2. Buscar transações com categoria
    const txsWithCat = await prisma.transaction.findMany({
      where: { tenantId: tenant.id, categoryId: { not: null } },
      include: { category: { select: { name: true } } }
    });
    
    // 3. Criar mapa de transação -> nome da categoria antiga
    const txCategoryMap = new Map();
    txsWithCat.forEach(tx => {
      if (tx.category) {
        txCategoryMap.set(tx.id, tx.category.name);
      }
    });
    console.log(`   💳 ${txsWithCat.length} transações com categoria`);
    
    // 4. Limpar categoryId das transações
    await prisma.transaction.updateMany({
      where: { tenantId: tenant.id, categoryId: { not: null } },
      data: { categoryId: null }
    });
    
    // 5. HARD DELETE de TODAS as categorias do tenant
    const deleted = await prisma.category.deleteMany({
      where: { tenantId: tenant.id }
    });
    console.log(`   🗑️  Deletadas: ${deleted.count} categorias antigas`);
    
    // 6. Criar novas categorias com estrutura CORRETA
    let totalCreated = 0;
    let l1Count = 0, l2Count = 0, l3Count = 0;
    const newCategoryMap = new Map(); // nome normalizado -> id
    
    for (const cat of defaultCategories) {
      // Criar L1
      const l1 = await prisma.category.create({
        data: {
          tenantId: tenant.id,
          name: cat.name,
          type: cat.type,
          icon: cat.icon,
          color: cat.color,
          level: 1,
          isActive: true
        }
      });
      newCategoryMap.set(cat.name.toLowerCase(), l1.id);
      l1Count++;
      totalCreated++;
      
      // Criar L2
      if (cat.children) {
        for (const child of cat.children) {
          const l2 = await prisma.category.create({
            data: {
              tenantId: tenant.id,
              name: child.name,
              type: cat.type,
              icon: '📝',
              color: '#6B7280',
              level: 2,
              parentId: l1.id,
              isActive: true
            }
          });
          newCategoryMap.set(child.name.toLowerCase(), l2.id);
          l2Count++;
          totalCreated++;
          
          // Criar L3
          if (child.children && child.children.length > 0) {
            for (const grandchild of child.children) {
              const l3 = await prisma.category.create({
                data: {
                  tenantId: tenant.id,
                  name: grandchild,
                  type: cat.type,
                  icon: '📝',
                  color: '#9CA3AF',
                  level: 3,
                  parentId: l2.id,
                  isActive: true
                }
              });
              newCategoryMap.set(grandchild.toLowerCase(), l3.id);
              l3Count++;
              totalCreated++;
            }
          }
        }
      }
    }
    
    console.log(`   ✅ Criadas: ${totalCreated} (L1: ${l1Count}, L2: ${l2Count}, L3: ${l3Count})`);
    
    // 7. Restaurar categoryId das transações
    let restored = 0;
    for (const [txId, oldCatName] of txCategoryMap) {
      // Tentar encontrar categoria pelo nome
      const normalizedName = oldCatName.toLowerCase();
      let newCatId = newCategoryMap.get(normalizedName);
      
      // Se não encontrar, tentar sem emoji
      if (!newCatId) {
        const nameWithoutEmoji = oldCatName.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim().toLowerCase();
        newCatId = newCategoryMap.get(nameWithoutEmoji);
      }
      
      if (newCatId) {
        await prisma.transaction.update({
          where: { id: txId },
          data: { categoryId: newCatId }
        });
        restored++;
      }
    }
    
    if (txCategoryMap.size > 0) {
      console.log(`   🔄 Transações restauradas: ${restored}/${txCategoryMap.size}`);
    }
  }
  
  // 8. Verificação final
  console.log('\n\n📊 VERIFICAÇÃO FINAL:');
  console.log('='.repeat(60));
  
  for (const tenant of tenants) {
    const cats = await prisma.category.findMany({
      where: { tenantId: tenant.id }
    });
    const l1 = cats.filter(c => c.level === 1);
    const l2 = cats.filter(c => c.level === 2);
    const l3 = cats.filter(c => c.level === 3);
    
    console.log(`\n${tenant.name}:`);
    console.log(`   L1: ${l1.length} | L2: ${l2.length} | L3: ${l3.length} | Total: ${cats.length}`);
    
    // Mostrar L1
    console.log(`   Categorias L1:`);
    l1.forEach(c => {
      const subs = l2.filter(s => s.parentId === c.id).length;
      const subsL3 = l3.filter(s => l2.filter(l => l.parentId === c.id).map(l => l.id).includes(s.parentId)).length;
      console.log(`      ${c.icon} ${c.name} - ${subs} L2, ${subsL3} L3`);
    });
  }
  
  console.log('\n\n✅ RESET COMPLETO!');
}

resetCategories()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
