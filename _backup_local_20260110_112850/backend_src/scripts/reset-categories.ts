import { PrismaClient } from '@prisma/client';
import { createDefaultCategories } from '../utils/default-categories';
import { log } from '../utils/logger';

const prisma = new PrismaClient();

async function resetCategories() {
  try {
    log.info('Deletando categorias antigas');
    
    // Deletar todas as categorias
    const deleted = await prisma.category.deleteMany({});
    log.info('Categorias deletadas', { count: deleted.count });

    // Buscar todos os tenants
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true }
    });

    log.info('Recriando categorias para tenants', { count: tenants.length });

    // Recriar categorias para cada tenant
    for (const tenant of tenants) {
      log.info('Criando categorias para tenant', { tenantName: tenant.name });
      await createDefaultCategories(tenant.id);
    }

    log.info('Categorias recriadas com sucesso');
  } catch (error) {
    log.error('Erro ao resetar categorias', { error });
  } finally {
    await prisma.$disconnect();
  }
}

resetCategories();
