const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const defaultCategories = [
  { name: 'Alimentacao', type: 'expense', icon: '🍽️', color: '#EF4444' },
  { name: 'Moradia', type: 'expense', icon: '🏠', color: '#8B5CF6' },
  { name: 'Transporte', type: 'expense', icon: '🚗', color: '#3B82F6' },
  { name: 'Saude', type: 'expense', icon: '🏥', color: '#10B981' },
  { name: 'Educacao', type: 'expense', icon: '🎓', color: '#F59E0B' },
  { name: 'Lazer', type: 'expense', icon: '🎮', color: '#EC4899' },
  { name: 'Vestuario', type: 'expense', icon: '👕', color: '#6366F1' },
  { name: 'Servicos', type: 'expense', icon: '🔧', color: '#0EA5E9' },
  { name: 'Outros', type: 'expense', icon: '📦', color: '#78716C' },
  { name: 'Salario', type: 'income', icon: '💰', color: '#22C55E' },
  { name: 'Freelance', type: 'income', icon: '💼', color: '#14B8A6' },
  { name: 'Investimentos', type: 'income', icon: '📈', color: '#0EA5E9' },
  { name: 'Outros', type: 'income', icon: '💵', color: '#84CC16' },
];

async function main() {
  const tenants = await prisma.tenant.findMany();
  console.log('Tenants encontrados:', tenants.length);
  
  for (const tenant of tenants) {
    console.log('Processando tenant:', tenant.name);
    
    const existingCats = await prisma.category.count({ where: { tenantId: tenant.id } });
    if (existingCats > 0) {
      console.log('  Ja tem categorias:', existingCats);
      continue;
    }
    
    for (const cat of defaultCategories) {
      await prisma.category.create({
        data: {
          tenantId: tenant.id,
          name: cat.name,
          type: cat.type,
          icon: cat.icon,
          color: cat.color,
          level: 1,
          isActive: true,
        }
      });
    }
    console.log('  Categorias criadas: 13');
  }
  
  const total = await prisma.category.count();
  console.log('Total de categorias:', total);
}

main().catch(console.error).finally(() => process.exit());
