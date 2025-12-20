/**
 * Job de Geração de Transações Recorrentes
 * Executa diariamente às 00:00 para gerar transações de recorrências e parcelas
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { generateAllTransactions } from '../services/transaction-generator.service';
import { log } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Job que roda diariamente às 00:00
 * Gera transações para todos os tenants ativos
 */
export function startTransactionGeneratorJob() {
  // Executar todos os dias às 00:00 (meia-noite)
  cron.schedule('0 0 * * *', async () => {
    log.info('[JOB] Iniciando geração de transações recorrentes');
    const startTime = Date.now();

    try {
      // Buscar todos os tenants ativos
      const tenants = await prisma.tenant.findMany({
        where: {
          subscriptionStatus: 'active',
          deletedAt: null,
        },
        include: {
          owner: true,
        },
      });

      log.info('[JOB] Tenants ativos encontrados', { count: tenants.length });

      let totalRecurring = 0;
      let totalInstallments = 0;
      let totalOverdue = 0;
      let errors = 0;

      for (const tenant of tenants) {
        try {
          const result = await generateAllTransactions(tenant.id, tenant.ownerId);

          totalRecurring += result.generatedRecurring;
          totalInstallments += result.generatedInstallments;
          totalOverdue += result.updatedOverdue;

          if (result.errors.length > 0) {
            log.warn('[JOB] Tenant com erros', { 
              tenantName: tenant.name, 
              errorCount: result.errors.length 
            });
            errors += result.errors.length;
          }

          log.info('[JOB] Tenant processado', { 
            tenantName: tenant.name, 
            recurring: result.generatedRecurring, 
            installments: result.generatedInstallments 
          });
        } catch (error) {
          log.error('[JOB] Erro ao processar tenant', { 
            tenantName: tenant.name, 
            error 
          });
          errors++;
        }
      }

      const duration = Date.now() - startTime;

      log.info('[JOB] Geração de transações concluída', {
        totalRecurring,
        totalInstallments,
        totalOverdue,
        errors,
        duration: `${duration}ms`
      });
    } catch (error) {
      log.error('[JOB] Erro crítico ao executar job', { error });
    }
  });

  log.info('Job de geração de transações agendado para 00:00 diariamente');
}

/**
 * Função para executar manualmente (útil para testes)
 */
export async function runTransactionGeneratorNow() {
  log.info('[JOB] Executando geração manual de transações');

  const tenants = await prisma.tenant.findMany({
    where: {
      subscriptionStatus: 'active',
      deletedAt: null,
    },
  });

  for (const tenant of tenants) {
    const result = await generateAllTransactions(tenant.id, tenant.ownerId);
    const totalGenerated = result.generatedRecurring + result.generatedInstallments;
    log.info('[JOB] Tenant processado manualmente', { 
      tenantId: tenant.id, 
      totalGenerated 
    });
  }
}
