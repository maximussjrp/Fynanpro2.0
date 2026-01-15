import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TemplateData {
  name: string;
  categoryName: string;
  type: 'income' | 'expense';
  amount: number;
  dueDay: number;
  frequency: 'monthly' | 'weekly' | 'yearly';
  isFixed: boolean;
  notes?: string;
}

// Templates de contas recorrentes comuns no Brasil
const TEMPLATES: TemplateData[] = [
  // ========== MORADIA ==========
  {
    name: '🏠 Aluguel',
    categoryName: 'Aluguel/Financiamento',
    type: 'expense',
    amount: 1500,
    dueDay: 10,
    frequency: 'monthly',
    isFixed: true,
    notes: 'Valor de aluguel residencial médio',
  },
  {
    name: '🏢 Condomínio',
    categoryName: 'IPTU/Condomínio',
    type: 'expense',
    amount: 350,
    dueDay: 15,
    frequency: 'monthly',
    isFixed: true,
    notes: 'Taxa condominial',
  },
  {
    name: '🏛️ IPTU',
    categoryName: 'IPTU/Condomínio',
    type: 'expense',
    amount: 150,
    dueDay: 20,
    frequency: 'monthly',
    isFixed: true,
    notes: 'Imposto Predial e Territorial Urbano',
  },
  {
    name: '⚡ Energia Elétrica',
    categoryName: 'Energia',
    type: 'expense',
    amount: 200,
    dueDay: 5,
    frequency: 'monthly',
    isFixed: false,
    notes: 'Conta de luz - valor variável',
  },
  {
    name: '💧 Água',
    categoryName: 'Água',
    type: 'expense',
    amount: 80,
    dueDay: 8,
    frequency: 'monthly',
    isFixed: false,
    notes: 'Conta de água - valor variável',
  },
  {
    name: '🌐 Internet',
    categoryName: 'Internet',
    type: 'expense',
    amount: 100,
    dueDay: 10,
    frequency: 'monthly',
    isFixed: true,
    notes: 'Internet banda larga',
  },
  {
    name: '🔥 Gás',
    categoryName: 'Contas de Casa',
    type: 'expense',
    amount: 120,
    dueDay: 15,
    frequency: 'monthly',
    isFixed: false,
    notes: 'Gás encanado ou botijão',
  },

  // ========== CONTAS & SERVIÇOS ==========
  {
    name: '📱 Celular',
    categoryName: 'Celular',
    type: 'expense',
    amount: 80,
    dueDay: 5,
    frequency: 'monthly',
    isFixed: true,
    notes: 'Plano de telefone móvel',
  },
  {
    name: '🎬 Streaming (Netflix/Prime)',
    categoryName: 'TV/Streaming',
    type: 'expense',
    amount: 50,
    dueDay: 1,
    frequency: 'monthly',
    isFixed: true,
    notes: 'Plano padrão streaming',
  },
  {
    name: '🎵 Spotify',
    categoryName: 'TV/Streaming',
    type: 'expense',
    amount: 22,
    dueDay: 1,
    frequency: 'monthly',
    isFixed: true,
    notes: 'Spotify Premium individual',
  },

  // ========== BEM-ESTAR ==========
  {
    name: '💪 Academia',
    categoryName: 'Academia',
    type: 'expense',
    amount: 100,
    dueDay: 1,
    frequency: 'monthly',
    isFixed: true,
    notes: 'Mensalidade de academia',
  },

  // ========== SAÚDE ==========
  {
    name: '🏥 Plano de Saúde',
    categoryName: 'Plano de Saúde',
    type: 'expense',
    amount: 400,
    dueDay: 10,
    frequency: 'monthly',
    isFixed: true,
    notes: 'Plano de saúde individual',
  },

  // ========== TRANSPORTE ==========
  {
    name: '⛽ Combustível',
    categoryName: 'Combustível',
    type: 'expense',
    amount: 400,
    dueDay: 1,
    frequency: 'monthly',
    isFixed: false,
    notes: 'Gasolina/Etanol - estimativa mensal',
  },
  {
    name: '🅿️ Estacionamento',
    categoryName: 'Estacionamento',
    type: 'expense',
    amount: 200,
    dueDay: 1,
    frequency: 'monthly',
    isFixed: true,
    notes: 'Estacionamento mensal',
  },
  {
    name: '🚌 Transporte Público',
    categoryName: 'Transporte Público',
    type: 'expense',
    amount: 200,
    dueDay: 1,
    frequency: 'monthly',
    isFixed: true,
    notes: 'Vale transporte ou passe mensal',
  },

  // ========== ALIMENTAÇÃO ==========
  {
    name: '🛒 Mercado Mensal',
    categoryName: 'Supermercado',
    type: 'expense',
    amount: 800,
    dueDay: 5,
    frequency: 'monthly',
    isFixed: false,
    notes: 'Compras de supermercado',
  },

  // ========== EDUCAÇÃO ==========
  {
    name: '🎓 Escola Filho(a)',
    categoryName: 'Mensalidade Escola/Faculdade',
    type: 'expense',
    amount: 1000,
    dueDay: 5,
    frequency: 'monthly',
    isFixed: true,
    notes: 'Mensalidade escolar',
  },
  {
    name: '📚 Curso Extra',
    categoryName: 'Cursos/Treinamentos',
    type: 'expense',
    amount: 200,
    dueDay: 10,
    frequency: 'monthly',
    isFixed: true,
    notes: 'Curso complementar (inglês, música, etc)',
  },

  // ========== FAMÍLIA ==========
  {
    name: '💰 Mesada',
    categoryName: 'Mesada',
    type: 'expense',
    amount: 100,
    dueDay: 1,
    frequency: 'monthly',
    isFixed: true,
    notes: 'Mesada mensal',
  },

  // ========== RECEITAS ==========
  {
    name: '💵 Salário',
    categoryName: 'Salário CLT',
    type: 'income',
    amount: 5000,
    dueDay: 5,
    frequency: 'monthly',
    isFixed: true,
    notes: 'Salário líquido mensal',
  },
  {
    name: '💼 Freelance',
    categoryName: 'Freelance',
    type: 'income',
    amount: 1500,
    dueDay: 15,
    frequency: 'monthly',
    isFixed: false,
    notes: 'Trabalho autônomo - valor variável',
  },
  {
    name: '🏠 Renda de Aluguel',
    categoryName: 'Aluguel de Imóvel',
    type: 'income',
    amount: 1200,
    dueDay: 10,
    frequency: 'monthly',
    isFixed: true,
    notes: 'Recebimento de aluguel de imóvel',
  },
];

async function main() {
  console.log('🌱 Iniciando criação de templates de contas recorrentes...\n');

  try {
    // Buscar todos os tenants
    const tenants = await prisma.tenant.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    });

    if (tenants.length === 0) {
      console.log('⚠️ Nenhum tenant encontrado. Crie um tenant primeiro.');
      return;
    }

    console.log(`📊 Encontrados ${tenants.length} tenant(s)\n`);

    for (const tenant of tenants) {
      console.log(`\n🏢 Processando tenant: ${tenant.name}`);

      // Verificar se já existem templates
      const existingTemplates = await prisma.recurringBill.count({
        where: {
          tenantId: tenant.id,
          isTemplate: true,
          deletedAt: null,
        },
      });

      if (existingTemplates > 0) {
        console.log(`   ⏭️  Já existem ${existingTemplates} templates - pulando...`);
        continue;
      }

      let created = 0;
      let skipped = 0;

      for (const template of TEMPLATES) {
        try {
          // Buscar categoria pelo nome
          const category = await prisma.category.findFirst({
            where: {
              tenantId: tenant.id,
              name: template.categoryName,
              type: template.type,
              deletedAt: null,
            },
          });

          if (!category) {
            console.log(`   ⚠️  Categoria não encontrada: ${template.categoryName} - pulando...`);
            skipped++;
            continue;
          }

          // Criar template
          await prisma.recurringBill.create({
            data: {
              tenantId: tenant.id,
              categoryId: category.id,
              name: template.name,
              type: template.type,
              amount: template.amount,
              isVariableAmount: !template.isFixed,
              frequency: template.frequency,
              dueDay: template.dueDay,
              alertDaysBefore: 3,
              alertOnDueDay: true,
              alertIfOverdue: true,
              autoGenerate: false, // Templates não geram ocorrências automaticamente
              monthsAhead: 3,
              isFixed: template.isFixed,
              isTemplate: true, // 🎯 Flag de template
              status: 'active', // Templates ficam como active mas não geram ocorrências
              notes: template.notes,
            },
          });

          created++;
        } catch (error: any) {
          console.error(`   ❌ Erro ao criar template "${template.name}": ${error.message}`);
          skipped++;
        }
      }

      console.log(`   ✅ Templates criados: ${created}`);
      if (skipped > 0) {
        console.log(`   ⚠️  Templates pulados: ${skipped}`);
      }
    }

    console.log('\n\n📊 Resumo final:');
    const totalTemplates = await prisma.recurringBill.count({
      where: { isTemplate: true, deletedAt: null },
    });
    console.log(`   Total de templates no sistema: ${totalTemplates}`);

    const templatesByType = await prisma.recurringBill.groupBy({
      by: ['type'],
      where: { isTemplate: true, deletedAt: null },
      _count: true,
    });

    console.log('\n   Por tipo:');
    templatesByType.forEach((group) => {
      console.log(`      ${group.type}: ${group._count} templates`);
    });

    console.log('\n✅ Criação de templates concluída!\n');
  } catch (error: any) {
    console.error('\n❌ Erro:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
