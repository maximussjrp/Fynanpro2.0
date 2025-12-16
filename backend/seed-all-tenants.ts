import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Categorias padrão com hierarquia
const defaultCategories = {
  expense: [
    {
      name: 'Moradia',
      icon: '🏠',
      children: [
        { name: 'Aluguel/Financiamento', icon: '🏠' },
        { name: 'Contas de Casa', icon: '💡', children: [
          { name: 'Energia', icon: '⚡' },
          { name: 'Água', icon: '💧' },
          { name: 'Internet', icon: '📡' },
          { name: 'TV/Streaming', icon: '📺' },
        ]},
        { name: 'Manutenção', icon: '🔧' },
        { name: 'IPTU/Condomínio', icon: '🏡' },
      ]
    },
    {
      name: 'Alimentação',
      icon: '🍔',
      children: [
        { name: 'Supermercado', icon: '🛒' },
        { name: 'Restaurantes', icon: '🍕' },
        { name: 'Cafés/Lanches', icon: '☕' },
        { name: 'Bebidas', icon: '🍺' },
      ]
    },
    {
      name: 'Transporte',
      icon: '🚗',
      children: [
        { name: 'Combustível', icon: '⛽' },
        { name: 'Estacionamento', icon: '🅿️' },
        { name: 'Transporte Público', icon: '🚌' },
        { name: 'Uber/Taxi', icon: '🚕' },
        { name: 'Manutenção Veículo', icon: '🔧' },
      ]
    },
    {
      name: 'Saúde',
      icon: '🏥',
      children: [
        { name: 'Medicamentos', icon: '💊' },
        { name: 'Consultas Médicas', icon: '🏥' },
        { name: 'Plano de Saúde', icon: '😷' },
        { name: 'Odontologia', icon: '🦷' },
      ]
    },
    {
      name: 'Educação',
      icon: '📚',
      children: [
        { name: 'Mensalidade Escola/Faculdade', icon: '🎓' },
        { name: 'Cursos/Treinamentos', icon: '📖' },
        { name: 'Livros/Material', icon: '📚' },
        { name: 'Material Escolar', icon: '🖊️' },
      ]
    },
    {
      name: 'Lazer & Entretenimento',
      icon: '🎮',
      children: [
        { name: 'Cinema/Teatro', icon: '🎬' },
        { name: 'Games/Hobbies', icon: '🎮' },
        { name: 'Viagens', icon: '✈️' },
        { name: 'Festas/Eventos', icon: '🎉' },
      ]
    },
    {
      name: 'Contas & Serviços',
      icon: '💳',
      children: [
        { name: 'Celular', icon: '📱' },
        { name: 'Taxas Bancárias', icon: '🏦' },
        { name: 'Anuidade Cartão', icon: '💳' },
        { name: 'Seguros', icon: '🔒' },
      ]
    },
    {
      name: 'Vestuário & Beleza',
      icon: '👕',
      children: [
        { name: 'Roupas', icon: '👔' },
        { name: 'Calçados', icon: '👟' },
        { name: 'Cosméticos', icon: '💄' },
        { name: 'Salão/Barbearia', icon: '✂️' },
      ]
    },
    {
      name: 'Bem-Estar',
      icon: '🏋️',
      children: [
        { name: 'Academia', icon: '🏋️' },
        { name: 'Yoga/Pilates', icon: '🧘' },
        { name: 'Massagens/SPA', icon: '💆' },
      ]
    },
    {
      name: 'Pets',
      icon: '🐕',
      children: [
        { name: 'Ração', icon: '🍖' },
        { name: 'Veterinário', icon: '💉' },
        { name: 'Banho/Tosa', icon: '🛁' },
      ]
    },
    {
      name: 'Família',
      icon: '👨‍👩‍👧',
      children: [
        { name: 'Creche/Babá', icon: '👶' },
        { name: 'Presentes', icon: '🎁' },
        { name: 'Mesada', icon: '🏫' },
      ]
    },
    {
      name: 'Investimentos & Poupança',
      icon: '💰',
      children: [
        { name: 'Ações/Fundos', icon: '📈' },
        { name: 'Renda Fixa', icon: '💎' },
        { name: 'Poupança', icon: '🏦' },
      ]
    },
    {
      name: 'Outros',
      icon: '🔧',
      children: [
        { name: 'Documentos', icon: '📄' },
        { name: 'Jurídico', icon: '⚖️' },
        { name: 'Diversos', icon: '🎯' },
      ]
    },
  ],
  income: [
    {
      name: 'Salário & Rendimentos',
      icon: '💼',
      children: [
        { name: 'Salário CLT', icon: '💵' },
        { name: 'Pró-Labore', icon: '💼' },
        { name: '13º Salário', icon: '🎁' },
        { name: 'Bônus/Comissões', icon: '💰' },
        { name: 'Férias', icon: '🏖️' },
      ]
    },
    {
      name: 'Investimentos',
      icon: '💰',
      children: [
        { name: 'Dividendos', icon: '📈' },
        { name: 'Rendimentos RF', icon: '💹' },
        { name: 'Criptomoedas', icon: '🪙' },
        { name: 'Aluguel de Imóvel', icon: '🏠' },
      ]
    },
    {
      name: 'Renda Extra',
      icon: '💵',
      children: [
        { name: 'Freelance', icon: '🎨' },
        { name: 'Vendas', icon: '🛍️' },
        { name: 'Consultoria', icon: '📚' },
        { name: 'Aulas Particulares', icon: '🎓' },
      ]
    },
    {
      name: 'Outros Recebimentos',
      icon: '🎁',
      children: [
        { name: 'Presentes', icon: '🎁' },
        { name: 'Reembolsos', icon: '💸' },
        { name: 'Prêmios', icon: '🏆' },
        { name: 'Devolução/Estorno', icon: '🔄' },
      ]
    },
  ]
};

interface CategoryDef {
  name: string;
  icon: string;
  children?: CategoryDef[];
}

async function createCategoryTree(
  tenantId: string, 
  type: 'income' | 'expense',
  categories: CategoryDef[],
  parentId: string | null = null,
  level: number = 1
) {
  for (const cat of categories) {
    const created = await prisma.category.create({
      data: {
        name: cat.name,
        icon: cat.icon,
        type,
        level,
        tenantId,
        parentId,
      }
    });
    
    if (cat.children && cat.children.length > 0) {
      await createCategoryTree(tenantId, type, cat.children, created.id, level + 1);
    }
  }
}

async function seedCategoriesForTenant(tenantId: string) {
  console.log(`📝 Criando categorias para tenant ${tenantId.substring(0, 8)}...`);
  
  // Verificar se já tem categorias
  const existing = await prisma.category.count({
    where: { tenantId, deletedAt: null }
  });
  
  if (existing > 0) {
    console.log(`   ⚠️ Tenant já tem ${existing} categorias, pulando...`);
    return;
  }
  
  // Criar categorias de despesa
  await createCategoryTree(tenantId, 'expense', defaultCategories.expense);
  
  // Criar categorias de receita
  await createCategoryTree(tenantId, 'income', defaultCategories.income);
  
  const total = await prisma.category.count({
    where: { tenantId, deletedAt: null }
  });
  
  console.log(`   ✅ ${total} categorias criadas!`);
}

async function main() {
  console.log('🚀 Populando categorias para todos os tenants sem categorias...\n');
  
  // Buscar todos os tenants
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true }
  });
  
  for (const tenant of tenants) {
    await seedCategoriesForTenant(tenant.id);
  }
  
  console.log('\n✅ Concluído!');
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
