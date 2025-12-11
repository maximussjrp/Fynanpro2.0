import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRecurringBills() {
  try {
    // Busca todas as recorrências
    const recurringBills = await prisma.recurringBill.findMany({
      include: {
        category: true,
        bankAccount: true,
        paymentMethod: true,
        occurrences: {
          orderBy: {
            dueDate: 'asc'
          }
        }
      }
    });

    console.log('\n===== RECURRING BILLS =====\n');
    console.log(`Total: ${recurringBills.length}\n`);

    recurringBills.forEach((bill, index) => {
      console.log(`\n[${index + 1}] ${bill.name}`);
      console.log(`   ID: ${bill.id}`);
      console.log(`   Tipo: ${bill.type} | Valor: R$ ${bill.amount?.toString() || 'Variável'}`);
      console.log(`   Categoria: ${bill.category?.name || 'N/A'}`);
      console.log(`   Conta: ${bill.bankAccount?.name || 'N/A'}`);
      console.log(`   Método Pagamento: ${bill.paymentMethod?.name || 'N/A'}`);
      console.log(`   Dia de vencimento: ${bill.dueDay}`);
      console.log(`   Status: ${bill.status}`);
      console.log(`   isFixed: ${bill.isFixed ? 'Fixa' : 'Variável'}`);
      console.log(`   autoGenerate: ${bill.autoGenerate}`);
      console.log(`   monthsAhead: ${bill.monthsAhead}`);
      console.log(`   Criada em: ${bill.createdAt}`);
      console.log(`\n   Ocorrências geradas: ${bill.occurrences.length}`);
      
      if (bill.occurrences.length > 0) {
        bill.occurrences.forEach((occ, i) => {
          console.log(`      ${i + 1}. ${occ.dueDate.toISOString().split('T')[0]} - Status: ${occ.status} - R$ ${occ.amount.toString()}`);
        });
      } else {
        console.log(`      ⚠️  NENHUMA OCORRÊNCIA GERADA AUTOMATICAMENTE!`);
      }
    });

    console.log('\n\n===== ANÁLISE =====\n');
    console.log('Segundo o PRIORIDADES-DESENVOLVIMENTO.md:');
    console.log('✅ Schema tem campos: isFixed, autoGenerate, monthsAhead');
    console.log('✅ Schema tem RecurringBillOccurrence para ocorrências');
    console.log('\n📋 O QUE DEVE ACONTECER:');
    console.log('1. Ao criar recorrência → DEVE gerar 3 ocorrências automaticamente');
    console.log('2. Ocorrências devem ter status "pending" (A Pagar)');
    console.log('3. Devem aparecer no calendário e dashboard');
    console.log('4. Ao pagar uma ocorrência → Gera próxima automaticamente');
    
    if (recurringBills.length > 0 && recurringBills.every(b => b.occurrences.length === 0)) {
      console.log('\n⚠️  PROBLEMA CONFIRMADO: Sistema NÃO está gerando ocorrências automaticamente!');
      console.log('\n🔧 SOLUÇÃO: Implementar endpoint POST /recurring-bills/:id/generate-occurrences');
      console.log('    E fazer auto-geração no CREATE da recorrência');
    }

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecurringBills();
