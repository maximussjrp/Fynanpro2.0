// Script para criar subcategorias hierárquicas para todos os tenants
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mapeamento de subcategorias por categoria pai
const subcategoriasMap = {
  // DESPESAS
  'Moradia': [
    { name: 'Aluguel', icon: '🏠', color: '#EF4444' },
    { name: 'Condomínio', icon: '🏢', color: '#DC2626' },
    { name: 'IPTU', icon: '📋', color: '#B91C1C' },
    { name: 'Água', icon: '💧', color: '#3B82F6' },
    { name: 'Luz', icon: '💡', color: '#F59E0B' },
    { name: 'Gás', icon: '🔥', color: '#EF4444' },
    { name: 'Internet', icon: '🌐', color: '#8B5CF6' },
    { name: 'Manutenção', icon: '🔧', color: '#6B7280' },
  ],
  'Alimentação': [
    { name: 'Supermercado', icon: '🛒', color: '#22C55E' },
    { name: 'Restaurantes', icon: '🍽️', color: '#F97316' },
    { name: 'Delivery', icon: '🛵', color: '#EAB308' },
    { name: 'Lanches', icon: '🥪', color: '#84CC16' },
    { name: 'Padaria', icon: '🥖', color: '#A3E635' },
  ],
  'Transporte': [
    { name: 'Combustível', icon: '⛽', color: '#EF4444' },
    { name: 'Uber/99', icon: '🚕', color: '#000000' },
    { name: 'Transporte Público', icon: '🚌', color: '#3B82F6' },
    { name: 'Estacionamento', icon: '🅿️', color: '#6B7280' },
    { name: 'Manutenção Veículo', icon: '🔧', color: '#F59E0B' },
    { name: 'Seguro Veículo', icon: '🛡️', color: '#8B5CF6' },
    { name: 'IPVA', icon: '📋', color: '#DC2626' },
  ],
  'Saúde': [
    { name: 'Plano de Saúde', icon: '🏥', color: '#EF4444' },
    { name: 'Farmácia', icon: '💊', color: '#22C55E' },
    { name: 'Consultas', icon: '👨‍⚕️', color: '#3B82F6' },
    { name: 'Exames', icon: '🔬', color: '#8B5CF6' },
    { name: 'Dentista', icon: '🦷', color: '#F9FAFB' },
  ],
  'Educação': [
    { name: 'Mensalidade Escolar', icon: '🏫', color: '#3B82F6' },
    { name: 'Cursos', icon: '📖', color: '#8B5CF6' },
    { name: 'Livros', icon: '📚', color: '#22C55E' },
    { name: 'Material Escolar', icon: '✏️', color: '#F59E0B' },
  ],
  'Lazer': [
    { name: 'Cinema', icon: '🎬', color: '#EF4444' },
    { name: 'Shows/Eventos', icon: '🎵', color: '#8B5CF6' },
    { name: 'Viagens', icon: '✈️', color: '#3B82F6' },
    { name: 'Streaming', icon: '📺', color: '#EF4444' },
    { name: 'Games', icon: '🎮', color: '#22C55E' },
    { name: 'Hobbies', icon: '🎨', color: '#F59E0B' },
  ],
  'Vestuário': [
    { name: 'Roupas', icon: '👔', color: '#3B82F6' },
    { name: 'Calçados', icon: '👟', color: '#6B7280' },
    { name: 'Acessórios', icon: '👜', color: '#F59E0B' },
  ],
  'Serviços': [
    { name: 'Assinaturas', icon: '📱', color: '#8B5CF6' },
    { name: 'Mensalidades', icon: '📋', color: '#3B82F6' },
    { name: 'Serviços Domésticos', icon: '🏠', color: '#22C55E' },
  ],
  // RECEITAS
  'Salário': [
    { name: 'Salário Líquido', icon: '💵', color: '#22C55E' },
    { name: '13º Salário', icon: '🎁', color: '#10B981' },
    { name: 'Férias', icon: '🏖️', color: '#06B6D4' },
    { name: 'Bônus', icon: '🏆', color: '#F59E0B' },
  ],
  'Investimentos': [
    { name: 'Dividendos', icon: '📈', color: '#22C55E' },
    { name: 'Juros', icon: '💰', color: '#10B981' },
    { name: 'Aluguéis', icon: '🏠', color: '#F59E0B' },
    { name: 'Rendimentos', icon: '📊', color: '#3B82F6' },
  ],
};

// Nomes alternativos para match (normalizado)
const nomeAlternativo = {
  'alimentacao': 'Alimentação',
  'saude': 'Saúde',
  'educacao': 'Educação',
  'vestuario': 'Vestuário',
  'servicos': 'Serviços',
  'salario': 'Salário',
};

function normalizeName(name) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function main() {
  console.log('🔄 Criando subcategorias para todos os tenants...\n');

  // Buscar todos os tenants ativos
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true }
  });

  console.log(`📊 Encontrados ${tenants.length} tenants\n`);

  let totalCreated = 0;

  for (const tenant of tenants) {
    console.log(`\n🏢 Processando tenant: ${tenant.name}`);

    // Buscar categorias de nível 1 do tenant
    const categoriasNivel1 = await prisma.category.findMany({
      where: { 
        tenantId: tenant.id, 
        deletedAt: null,
        level: 1 
      }
    });

    for (const catPai of categoriasNivel1) {
      // Normalizar nome para buscar no mapa
      const nomeNorm = normalizeName(catPai.name);
      let subcategorias = null;
      
      // Tentar encontrar no mapa
      for (const [key, subs] of Object.entries(subcategoriasMap)) {
        if (normalizeName(key) === nomeNorm) {
          subcategorias = subs;
          break;
        }
      }

      if (!subcategorias) continue;

      // Verificar quantas subcategorias já existem
      const existingCount = await prisma.category.count({
        where: { 
          tenantId: tenant.id, 
          parentId: catPai.id,
          deletedAt: null 
        }
      });

      if (existingCount > 0) {
        console.log(`  ⏭️  ${catPai.name}: já tem ${existingCount} subcategorias`);
        continue;
      }

      // Criar subcategorias
      for (const sub of subcategorias) {
        await prisma.category.create({
          data: {
            tenantId: tenant.id,
            parentId: catPai.id,
            name: sub.name,
            type: catPai.type,
            icon: sub.icon,
            color: sub.color,
            level: 2,
            isActive: true,
          }
        });
        totalCreated++;
      }
      console.log(`  ✅ ${catPai.name}: ${subcategorias.length} subcategorias criadas`);
    }
  }

  console.log(`\n\n✨ Processo concluído! ${totalCreated} subcategorias criadas no total.`);
}

main()
  .catch(e => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
