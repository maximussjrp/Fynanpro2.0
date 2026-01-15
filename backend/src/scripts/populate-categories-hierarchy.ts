import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CategoryData {
  name: string;
  icon: string;
  color: string;
  children?: CategoryData[];
}

const EXPENSE_CATEGORIES: CategoryData[] = [
  {
    name: 'Moradia',
    icon: '🏠',
    color: '#E74C3C',
    children: [
      { name: 'Aluguel/Financiamento', icon: '🏠', color: '#C0392B' },
      {
        name: 'Contas de Casa',
        icon: '💡',
        color: '#E67E22',
        children: [
          { name: 'Energia', icon: '⚡', color: '#F39C12' },
          { name: 'Água', icon: '💧', color: '#3498DB' },
          { name: 'Internet', icon: '📡', color: '#9B59B6' },
          { name: 'TV/Streaming', icon: '📺', color: '#8E44AD' },
        ],
      },
      { name: 'Manutenção', icon: '🔧', color: '#95A5A6' },
      { name: 'IPTU/Condomínio', icon: '🏡', color: '#7F8C8D' },
    ],
  },
  {
    name: 'Alimentação',
    icon: '🍔',
    color: '#FF6B6B',
    children: [
      { name: 'Supermercado', icon: '🛒', color: '#FF5252' },
      { name: 'Restaurantes', icon: '🍕', color: '#FF4444' },
      { name: 'Cafés/Lanches', icon: '☕', color: '#6D4C41' },
      { name: 'Bebidas', icon: '🍺', color: '#FFA726' },
    ],
  },
  {
    name: 'Transporte',
    icon: '🚗',
    color: '#FF9800',
    children: [
      { name: 'Combustível', icon: '⛽', color: '#F57C00' },
      { name: 'Estacionamento', icon: '🅿️', color: '#E65100' },
      { name: 'Transporte Público', icon: '🚌', color: '#FF6F00' },
      { name: 'Uber/Taxi', icon: '🚕', color: '#FFB300' },
      { name: 'Manutenção Veículo', icon: '🔧', color: '#FB8C00' },
    ],
  },
  {
    name: 'Saúde',
    icon: '🏥',
    color: '#E91E63',
    children: [
      { name: 'Medicamentos', icon: '💊', color: '#C2185B' },
      { name: 'Consultas Médicas', icon: '🏥', color: '#AD1457' },
      { name: 'Plano de Saúde', icon: '😷', color: '#880E4F' },
      { name: 'Odontologia', icon: '🦷', color: '#F06292' },
    ],
  },
  {
    name: 'Educação',
    icon: '📚',
    color: '#9C27B0',
    children: [
      { name: 'Mensalidade Escola/Faculdade', icon: '🎓', color: '#7B1FA2' },
      { name: 'Cursos/Treinamentos', icon: '📖', color: '#6A1B9A' },
      { name: 'Livros/Material', icon: '📚', color: '#4A148C' },
      { name: 'Material Escolar', icon: '🖊️', color: '#AB47BC' },
    ],
  },
  {
    name: 'Lazer & Entretenimento',
    icon: '🎮',
    color: '#673AB7',
    children: [
      { name: 'Cinema/Teatro', icon: '🎬', color: '#5E35B1' },
      { name: 'Games/Hobbies', icon: '🎮', color: '#512DA8' },
      { name: 'Viagens', icon: '✈️', color: '#4527A0' },
      { name: 'Festas/Eventos', icon: '🎉', color: '#7E57C2' },
    ],
  },
  {
    name: 'Contas & Serviços',
    icon: '💳',
    color: '#F44336',
    children: [
      { name: 'Celular', icon: '📱', color: '#D32F2F' },
      { name: 'Taxas Bancárias', icon: '🏦', color: '#C62828' },
      { name: 'Anuidade Cartão', icon: '💳', color: '#B71C1C' },
      { name: 'Seguros', icon: '🔒', color: '#EF5350' },
    ],
  },
  {
    name: 'Vestuário & Beleza',
    icon: '👕',
    color: '#FF5722',
    children: [
      { name: 'Roupas', icon: '👔', color: '#F4511E' },
      { name: 'Calçados', icon: '👟', color: '#E64A19' },
      { name: 'Cosméticos', icon: '💄', color: '#D84315' },
      { name: 'Salão/Barbearia', icon: '✂️', color: '#FF7043' },
    ],
  },
  {
    name: 'Bem-Estar',
    icon: '🏋️',
    color: '#8BC34A',
    children: [
      { name: 'Academia', icon: '🏋️', color: '#7CB342' },
      { name: 'Yoga/Pilates', icon: '🧘', color: '#689F38' },
      { name: 'Massagens/SPA', icon: '💆', color: '#558B2F' },
    ],
  },
  {
    name: 'Pets',
    icon: '🐕',
    color: '#795548',
    children: [
      { name: 'Ração', icon: '🍖', color: '#6D4C41' },
      { name: 'Veterinário', icon: '💉', color: '#5D4037' },
      { name: 'Banho/Tosa', icon: '🛁', color: '#4E342E' },
    ],
  },
  {
    name: 'Família',
    icon: '👨‍👩‍👧',
    color: '#00BCD4',
    children: [
      { name: 'Creche/Babá', icon: '👶', color: '#00ACC1' },
      { name: 'Presentes', icon: '🎁', color: '#0097A7' },
      { name: 'Mesada', icon: '🏫', color: '#00838F' },
    ],
  },
  {
    name: 'Investimentos & Poupança',
    icon: '💰',
    color: '#4CAF50',
    children: [
      { name: 'Ações/Fundos', icon: '📈', color: '#43A047' },
      { name: 'Renda Fixa', icon: '💎', color: '#388E3C' },
      { name: 'Poupança', icon: '🏦', color: '#2E7D32' },
    ],
  },
  {
    name: 'Outros',
    icon: '🔧',
    color: '#607D8B',
    children: [
      { name: 'Documentos', icon: '📄', color: '#546E7A' },
      { name: 'Jurídico', icon: '⚖️', color: '#455A64' },
      { name: 'Diversos', icon: '🎯', color: '#37474F' },
    ],
  },
];

const INCOME_CATEGORIES: CategoryData[] = [
  {
    name: 'Salário & Rendimentos',
    icon: '💼',
    color: '#22C39A',
    children: [
      { name: 'Salário CLT', icon: '💵', color: '#1BA87E' },
      { name: 'Pró-Labore', icon: '💼', color: '#16A085' },
      { name: '13º Salário', icon: '🎁', color: '#138D75' },
      { name: 'Bônus/Comissões', icon: '💰', color: '#117A65' },
      { name: 'Férias', icon: '🏖️', color: '#0E6655' },
    ],
  },
  {
    name: 'Investimentos',
    icon: '💰',
    color: '#4CAF50',
    children: [
      { name: 'Dividendos', icon: '📈', color: '#43A047' },
      { name: 'Rendimentos RF', icon: '💹', color: '#388E3C' },
      { name: 'Criptomoedas', icon: '🪙', color: '#2E7D32' },
      { name: 'Aluguel de Imóvel', icon: '🏠', color: '#1B5E20' },
    ],
  },
  {
    name: 'Renda Extra',
    icon: '💵',
    color: '#66BB6A',
    children: [
      { name: 'Freelance', icon: '🎨', color: '#4CAF50' },
      { name: 'Vendas', icon: '🛍️', color: '#43A047' },
      { name: 'Consultoria', icon: '📚', color: '#388E3C' },
      { name: 'Aulas Particulares', icon: '🎓', color: '#2E7D32' },
    ],
  },
  {
    name: 'Outros Recebimentos',
    icon: '🎁',
    color: '#8BC34A',
    children: [
      { name: 'Presentes', icon: '🎁', color: '#7CB342' },
      { name: 'Reembolsos', icon: '💸', color: '#689F38' },
      { name: 'Prêmios', icon: '🏆', color: '#558B2F' },
      { name: 'Devolução/Estorno', icon: '🔄', color: '#33691E' },
    ],
  },
];

async function createCategoryHierarchy(
  tenantId: string,
  categories: CategoryData[],
  type: 'income' | 'expense',
  parentId: string | null = null,
  level: number = 1
): Promise<void> {
  for (const categoryData of categories) {
    // Verificar se categoria já existe
    const existing = await prisma.category.findFirst({
      where: {
        tenantId,
        name: categoryData.name,
        type,
        level,
        deletedAt: null,
      },
    });

    let category;
    if (existing) {
      console.log(`  ⏭️  Categoria já existe: ${categoryData.name} (${type})`);
      category = existing;
    } else {
      category = await prisma.category.create({
        data: {
          tenantId,
          parentId,
          name: categoryData.name,
          type,
          level,
          icon: categoryData.icon,
          color: categoryData.color,
          isActive: true,
        },
      });
      console.log(`  ✅ Criada: ${categoryData.name} (nível ${level})`);
    }

    // Criar filhas recursivamente
    if (categoryData.children && categoryData.children.length > 0) {
      await createCategoryHierarchy(
        tenantId,
        categoryData.children,
        type,
        category.id,
        level + 1
      );
    }
  }
}

async function main() {
  console.log('🌳 Populando categorias hierárquicas...\n');

  // Buscar tenant master
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'maxguarinieri' },
  });

  if (!tenant) {
    console.error('❌ Tenant master não encontrado. Execute o seed primeiro.');
    process.exit(1);
  }

  console.log(`🏢 Tenant: ${tenant.name}\n`);

  // Criar categorias de despesas
  console.log('📤 DESPESAS:');
  await createCategoryHierarchy(tenant.id, EXPENSE_CATEGORIES, 'expense');

  console.log('\n📥 RECEITAS:');
  await createCategoryHierarchy(tenant.id, INCOME_CATEGORIES, 'income');

  // Estatísticas finais
  const stats = await prisma.category.groupBy({
    by: ['type', 'level'],
    where: { tenantId: tenant.id, deletedAt: null },
    _count: true,
  });

  console.log('\n📊 Estatísticas:');
  stats.forEach((stat) => {
    console.log(`  ${stat.type === 'expense' ? '📤' : '📥'} ${stat.type.toUpperCase()} - Nível ${stat.level}: ${stat._count} categorias`);
  });

  console.log('\n✨ Concluído!');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
