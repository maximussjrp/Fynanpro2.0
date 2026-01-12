import cron from 'node-cron';
import { NotificationService } from '../services/notification.service';
import { log } from '../utils/logger';

/**
 * Job de verificação de notificações
 * Roda diariamente às 8h da manhã
 */
export function startNotificationJob() {
  // Executar todos os dias às 8:00
  cron.schedule('0 8 * * *', async () => {
    try {
      log.info('🔔 Iniciando job de notificações diário...');
      
      const results = await NotificationService.runAllChecks();
      
      log.info('✅ Job de notificações concluído com sucesso:', results);
    } catch (error: any) {
      log.error('❌ Erro no job de notificações:', error);
    }
  }, {
    timezone: 'America/Sao_Paulo'
  });

  // Também executar a cada 6 horas para verificações mais frequentes
  cron.schedule('0 */6 * * *', async () => {
    try {
      log.info('🔔 Executando verificação de notificações (6h)...');
      
      await Promise.all([
        NotificationService.checkUpcomingBills(),
        NotificationService.checkOverdueBills(),
      ]);
      
      log.info('✅ Verificação de 6h concluída');
    } catch (error: any) {
      log.error('❌ Erro na verificação de 6h:', error);
    }
  }, {
    timezone: 'America/Sao_Paulo'
  });

  log.info('✅ Jobs de notificação configurados:');
  log.info('   - Verificação completa: Diariamente às 8:00');
  log.info('   - Verificação de vencimentos: A cada 6 horas');
}

/**
 * Job de geração automática de ocorrências
 * Roda diariamente à meia-noite
 */
export function startRecurringBillsJob() {
  cron.schedule('0 0 * * *', async () => {
    try {
      log.info('🔄 Iniciando job de geração de ocorrências...');
      
      const { prisma } = await import('../main');
      
      // Buscar todas as recorrências ativas com auto-geração
      const activeRecurringBills = await prisma.recurringBill.findMany({
        where: {
          status: 'active',
          autoGenerate: true,
          deletedAt: null,
        },
      });

      log.info(`Encontradas ${activeRecurringBills.length} recorrências ativas para processar`);

      let generatedCount = 0;

      for (const bill of activeRecurringBills) {
        try {
          // Buscar última ocorrência gerada
          const lastOccurrence = await prisma.recurringBillOccurrence.findFirst({
            where: {
              recurringBillId: bill.id,
            },
            orderBy: {
              dueDate: 'desc',
            },
          });

          if (!lastOccurrence) {
            log.warn(`Recorrência ${bill.id} não tem ocorrências. Pulando...`);
            continue;
          }

          // Verificar se precisa gerar mais meses
          const lastDueDate = new Date(lastOccurrence.dueDate);
          const threeMonthsFromNow = new Date();
          threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

          if (lastDueDate < threeMonthsFromNow) {
            // Calcular próximo mês
            const nextMonth = new Date(lastDueDate);
            nextMonth.setMonth(nextMonth.getMonth() + 1);

            // Criar nova ocorrência
            if (bill.amount) {
              await prisma.recurringBillOccurrence.create({
                data: {
                  tenantId: bill.tenantId,
                  recurringBillId: bill.id,
                  dueDate: nextMonth,
                  amount: bill.amount,
                  status: 'pending',
                },
              });
            }

            generatedCount++;
            log.info(`Ocorrência gerada para ${bill.name} em ${nextMonth.toISOString()}`);
          }
        } catch (error: any) {
          log.error(`Erro ao processar recorrência ${bill.id}:`, error);
        }
      }

      log.info(`✅ Job de geração concluído: ${generatedCount} ocorrências geradas`);
    } catch (error: any) {
      log.error('❌ Erro no job de geração de ocorrências:', error);
    }
  }, {
    timezone: 'America/Sao_Paulo'
  });

  log.info('✅ Job de geração de ocorrências configurado: Diariamente à meia-noite');
}

/**
 * Inicializa todos os jobs
 */
export function startAllJobs() {
  startNotificationJob();
  startRecurringBillsJob();
  
  log.info('🚀 Todos os jobs agendados foram iniciados');
}
