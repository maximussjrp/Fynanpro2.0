import { PrismaClient } from '@prisma/client';
import { createDefaultCategories } from './src/utils/default-categories';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Buscando tenants sem categorias...\n');

  // Buscar todos os tenants
  const tenants = await prisma.tenant.findMany({
    include: {
      _count: {
        select: { categories: true }
      }
    }
  });

  console.log(`📊 Total de tenants: ${tenants.length}\n`);

  for (const tenant of tenants) {
    const categoryCount = tenant._count.categories;
    
    if (categoryCount === 0) {
      console.log(`🏢 Tenant "${tenant.name}" (${tenant.id}) - SEM categorias, criando...`);
      
      try {
        await createDefaultCategories(tenant.id);
        console.log(`   ✅ Categorias criadas com sucesso!\n`);
      } catch (error) {
        console.error(`   ❌ Erro ao criar categorias:`, error);
      }
    } else {
      console.log(`🏢 Tenant "${tenant.name}" (${tenant.id}) - ${categoryCount} categorias já existem`);
    }
  }

  console.log('\n✨ Processo concluído!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
