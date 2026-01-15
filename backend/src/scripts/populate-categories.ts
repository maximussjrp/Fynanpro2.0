import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categoriesData = {
  expense: [
    {
      name: 'Moradia',
      icon: '🏠',
      color: '#E74C3C',
      children: [
        { name: 'Aluguel/Financiamento', icon: '🏠', color: '#E74C3C' },
        { 
          name: 'Contas de Casa', 
          icon: '💡', 
          color: '#E74C3C',
          children: [
            { name: 'Energia', icon: '⚡', color: '#E74C3C' },
            { name: 'Água', icon: '💧', color: '#E74C3C' },
            { name: 'Internet', icon: '📡', color: '#E74C3C' },
            { name: 'TV/Streaming', icon: '📺', color: '#E74C3C' }
          ]
        },
        { name: 'Manutenção', icon: '🔧', color: '#E74C3C' },
        { name: 'IPTU/Condomínio', icon: '🏡', color: '#E74C3C' }
      ]
    },
    {
      name: 'Alimentação',
      icon: '🍔',
      color: '#FF6B6B',
      children: [
        { name: 'Supermercado', icon: '🛒', color: '#FF6B6B' },
        { name: 'Restaurantes', icon: '🍕', color: '#FF6B6B' },
        { name: 'Cafés/Lanches', icon: '☕', color: '#FF6B6B' },
        { name: 'Bebidas', icon: '🍺', color: '#FF6B6B' }
      ]
    },
    {
      name: 'Transporte',
      icon: '🚗',
      color: '#FF9800',
      children: [
        { name: 'Combustível', icon: '⛽', color: '#FF9800' },
        { name: 'Estacionamento', icon: '🅿️', color: '#FF9800' },
        { name: 'Transporte Público', icon: '🚌', color: '#FF9800' },
        { name: 'Uber/Taxi', icon: '🚕', color: '#FF9800' },
        { name: 'Manutenção Veículo', icon: '🔧', color: '#FF9800' }
      ]
    },
    {
      name: 'Saúde',
      icon: '🏥',
      color: '#E91E63',
      children: [
        { name: 'Medicamentos', icon: '💊', color: '#E91E63' },
        { name: 'Consultas Médicas', icon: '🏥', color: '#E91E63' },
        { name: 'Plano de Saúde', icon: '😷', color: '#E91E63' },
        { name: 'Odontologia', icon: '🦷', color: '#E91E63' }
      ]
    },
    {
      name: 'Educação',
      icon: '📚',
      color: '#9C27B0',
      children: [
        { name: 'Mensalidade Escola/Faculdade', icon: '🎓', color: '#9C27B0' },
        { name: 'Cursos/Treinamentos', icon: '📖', color: '#9C27B0' },
        { name: 'Livros/Material', icon: '📚', color: '#9C27B0' },
        { name: 'Material Escolar', icon: '🖊️', color: '#9C27B0' }
      ]
    },
    {
      name: 'Lazer & Entretenimento',
      icon: '🎮',
      color: '#673AB7',
      children: [
        { name: 'Cinema/Teatro', icon: '🎬', color: '#673AB7' },
        { name: 'Games/Hobbies', icon: '🎮', color: '#673AB7' },
        { name: 'Viagens', icon: '✈️', color: '#673AB7' },
        { name: 'Festas/Eventos', icon: '🎉', color: '#673AB7' }
      ]
    },
    {
      name: 'Contas & Serviços',
      icon: '💳',
      color: '#F44336',
      children: [
        { name: 'Celular', icon: '📱', color: '#F44336' },
        { name: 'Taxas Bancárias', icon: '🏦', color: '#F44336' },
        { name: 'Anuidade Cartão', icon: '💳', color: '#F44336' },
        { name: 'Seguros', icon: '🔒', color: '#F44336' }
      ]
    },
    {
      name: 'Vestuário & Beleza',
      icon: '👕',
      color: '#FF5722',
      children: [
        { name: 'Roupas', icon: '👔', color: '#FF5722' },
        { name: 'Calçados', icon: '👟', color: '#FF5722' },
        { name: 'Cosméticos', icon: '💄', color: '#FF5722' },
        { name: 'Salão/Barbearia', icon: '✂️', color: '#FF5722' }
      ]
    },
    {
      name: 'Bem-Estar',
      icon: '🏋️',
      color: '#8BC34A',
      children: [
        { name: 'Academia', icon: '🏋️', color: '#8BC34A' },
        { name: 'Yoga/Pilates', icon: '🧘', color: '#8BC34A' },
        { name: 'Massagens/SPA', icon: '💆', color: '#8BC34A' }
      ]
    },
    {
      name: 'Pets',
      icon: '🐕',
      color: '#795548',
      children: [
        { name: 'Ração', icon: '🍖', color: '#795548' },
        { name: 'Veterinário', icon: '💉', color: '#795548' },
        { name: 'Banho/Tosa', icon: '🛁', color: '#795548' }
      ]
    },
    {
      name: 'Família',
      icon: '👨‍👩‍👧',
      color: '#607D8B',
      children: [
        { name: 'Creche/Babá', icon: '👶', color: '#607D8B' },
        { name: 'Presentes', icon: '🎁', color: '#607D8B' },
        { name: 'Mesada', icon: '🏫', color: '#607D8B' }
      ]
    },
    {
      name: 'Investimentos & Poupança',
      icon: '💰',
      color: '#00BCD4',
      children: [
        { name: 'Ações/Fundos', icon: '📈', color: '#00BCD4' },
        { name: 'Renda Fixa', icon: '💎', color: '#00BCD4' },
        { name: 'Poupança', icon: '🏦', color: '#00BCD4' }
      ]
    },
    {
      name: 'Outros',
      icon: '🔧',
      color: '#9E9E9E',
      children: [
        { name: 'Documentos', icon: '📄', color: '#9E9E9E' },
        { name: 'Jurídico', icon: '⚖️', color: '#9E9E9E' },
        { name: 'Diversos', icon: '🎯', color: '#9E9E9E' }
      ]
    }
  ],
  income: [
    {
      name: 'Salário & Rendimentos',
      icon: '💼',
      color: '#22C39A',
      children: [
        { name: 'Salário CLT', icon: '💵', color: '#22C39A' },
        { name: 'Pró-Labore', icon: '💼', color: '#22C39A' },
        { name: '13º Salário', icon: '🎁', color: '#22C39A' },
        { name: 'Bônus/Comissões', icon: '💰', color: '#22C39A' },
        { name: 'Férias', icon: '🏖️', color: '#22C39A' }
      ]
    },
    {
      name: 'Investimentos',
      icon: '💰',
      color: '#4CAF50',
      children: [
        { name: 'Dividendos', icon: '📈', color: '#4CAF50' },
        { name: 'Rendimentos RF', icon: '💹', color: '#4CAF50' },
        { name: 'Criptomoedas', icon: '🪙', color: '#4CAF50' },
        { name: 'Aluguel de Imóvel', icon: '🏠', color: '#4CAF50' }
      ]
    },
    {
      name: 'Renda Extra',
      icon: '💵',
      color: '#8BC34A',
      children: [
        { name: 'Freelance', icon: '🎨', color: '#8BC34A' },
        { name: 'Vendas', icon: '🛍️', color: '#8BC34A' },
        { name: 'Consultoria', icon: '📚', color: '#8BC34A' },
        { name: 'Aulas Particulares', icon: '🎓', color: '#8BC34A' }
      ]
    },
    {
      name: 'Outros Recebimentos',
      icon: '🎁',
      color: '#66BB6A',
      children: [
        { name: 'Presentes', icon: '🎁', color: '#66BB6A' },
        { name: 'Reembolsos', icon: '💸', color: '#66BB6A' },
        { name: 'Prêmios', icon: '🏆', color: '#66BB6A' },
        { name: 'Devolução/Estorno', icon: '🔄', color: '#66BB6A' }
      ]
    }
  ]
};

async function populateCategories() {
  console.log('🚀 Iniciando população de categorias hierárquicas...\n');

  try {
    // Buscar tenant master
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'maxguarinieri' }
    });

    if (!tenant) {
      console.error('❌ Tenant master não encontrado!');
      return;
    }

    console.log(`✅ Tenant encontrado: ${tenant.name}\n`);

    // Processar despesas
    console.log('📤 Criando categorias de DESPESAS...');
    for (const parent of categoriesData.expense) {
      const parentCategory = await prisma.category.create({
        data: {
          tenantId: tenant.id,
          name: parent.name,
          type: 'expense',
          icon: parent.icon,
          color: parent.color,
          level: 1,
          isActive: true
        }
      });

      console.log(`  ✅ ${parent.icon} ${parent.name}`);

      if (parent.children) {
        for (const child of parent.children) {
          const childCategory = await prisma.category.create({
            data: {
              tenantId: tenant.id,
              name: child.name,
              type: 'expense',
              icon: child.icon,
              color: child.color,
              level: 2,
              parentId: parentCategory.id,
              isActive: true
            }
          });

          console.log(`    └─ ${child.icon} ${child.name}`);

          if ('children' in child && child.children) {
            for (const grandchild of child.children) {
              await prisma.category.create({
                data: {
                  tenantId: tenant.id,
                  name: grandchild.name,
                  type: 'expense',
                  icon: grandchild.icon,
                  color: grandchild.color,
                  level: 3,
                  parentId: childCategory.id,
                  isActive: true
                }
              });
              console.log(`       └─ ${grandchild.icon} ${grandchild.name}`);
            }
          }
        }
      }
    }

    // Processar receitas
    console.log('\n💰 Criando categorias de RECEITAS...');
    for (const parent of categoriesData.income) {
      const parentCategory = await prisma.category.create({
        data: {
          tenantId: tenant.id,
          name: parent.name,
          type: 'income',
          icon: parent.icon,
          color: parent.color,
          level: 1,
          isActive: true
        }
      });

      console.log(`  ✅ ${parent.icon} ${parent.name}`);

      if (parent.children) {
        for (const child of parent.children) {
          await prisma.category.create({
            data: {
              tenantId: tenant.id,
              name: child.name,
              type: 'income',
              icon: child.icon,
              color: child.color,
              level: 2,
              parentId: parentCategory.id,
              isActive: true
            }
          });
          console.log(`    └─ ${child.icon} ${child.name}`);
        }
      }
    }

    console.log('\n✨ Categorias criadas com sucesso!');
    
    const count = await prisma.category.count({ where: { tenantId: tenant.id } });
    console.log(`📊 Total: ${count} categorias`);

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

populateCategories();
