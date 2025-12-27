/**
 * ══════════════════════════════════════════════════════════════════════════════
 * SCRIPT DE AUDITORIA DE CATEGORIAS - FASE 1 FUNDAÇÃO SEMÂNTICA
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Este script:
 * 1. Lista TODAS as categorias existentes
 * 2. Verifica quais têm semântica definida
 * 3. Identifica problemas (50/50 silencioso, soma incorreta, etc.)
 * 4. Gera relatório de auditoria
 * 
 * Executar: npx ts-node audit-category-semantics.ts
 * Ou: node -r ts-node/register audit-category-semantics.ts
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

interface AuditIssue {
  tenantId: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  issue: string;
  severity: 'critical' | 'warning' | 'info';
  currentState?: any;
}

async function auditCategorySemantics() {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('  🔍 AUDITORIA DE SEMÂNTICA DE CATEGORIAS - UTOP');
  console.log('══════════════════════════════════════════════════════════════════\n');

  const issues: AuditIssue[] = [];
  
  // 1. Buscar todos os tenants ativos
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true }
  });
  
  console.log(`📊 Tenants encontrados: ${tenants.length}\n`);

  for (const tenant of tenants) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🏢 Tenant: ${tenant.name} (${tenant.id})`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Buscar categorias de despesa deste tenant
    const categories = await prisma.category.findMany({
      where: {
        tenantId: tenant.id,
        type: 'expense',
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        icon: true,
        level: true
      }
    });

    console.log(`\n📂 Categorias de despesa: ${categories.length}`);

    // Verificar se tabela CategorySemantics existe
    let semanticsExist = true;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "CategorySemantics" LIMIT 1`;
    } catch (e) {
      semanticsExist = false;
      console.log(`\n⚠️  Tabela CategorySemantics NÃO EXISTE!`);
      console.log(`   Execute: npx prisma db push para criá-la.\n`);
      continue;
    }

    // Buscar semânticas existentes
    const semantics = await prisma.$queryRaw<Array<{
      categoryId: string;
      survivalWeight: any;
      choiceWeight: any;
      futureWeight: any;
      lossWeight: any;
      validationStatus: string;
      userOverride: boolean;
    }>>`
      SELECT 
        "categoryId",
        "survivalWeight",
        "choiceWeight",
        "futureWeight",
        "lossWeight",
        "validationStatus",
        "userOverride"
      FROM "CategorySemantics"
      WHERE "tenantId" = ${tenant.id}
    `;

    const semanticsMap = new Map(semantics.map(s => [s.categoryId, {
      survival: Number(s.survivalWeight),
      choice: Number(s.choiceWeight),
      future: Number(s.futureWeight),
      loss: Number(s.lossWeight),
      validationStatus: s.validationStatus,
      userOverride: s.userOverride
    }]));

    let withSemantics = 0;
    let validated = 0;
    let inferred = 0;
    let notValidated = 0;
    let defaulted = 0;

    for (const cat of categories) {
      const sem = semanticsMap.get(cat.id);

      if (!sem) {
        issues.push({
          tenantId: tenant.id,
          categoryId: cat.id,
          categoryName: cat.name,
          categoryIcon: cat.icon,
          issue: 'SEM SEMÂNTICA DEFINIDA',
          severity: 'critical'
        });
        continue;
      }

      withSemantics++;
      
      // Contar por status
      if (sem.validationStatus === 'validated') validated++;
      else if (sem.validationStatus === 'inferred') inferred++;
      else if (sem.validationStatus === 'not_validated') notValidated++;
      else if (sem.validationStatus === 'default') defaulted++;

      // Verificar soma dos pesos
      const total = sem.survival + sem.choice + sem.future + sem.loss;
      if (Math.abs(total - 1.0) > 0.01) {
        issues.push({
          tenantId: tenant.id,
          categoryId: cat.id,
          categoryName: cat.name,
          categoryIcon: cat.icon,
          issue: `SOMA INCORRETA: ${(total * 100).toFixed(1)}% (deveria ser 100%)`,
          severity: 'critical',
          currentState: { survival: sem.survival, choice: sem.choice, future: sem.future, loss: sem.loss }
        });
      }

      // Verificar 50/50 silencioso (default proibido pelo contrato)
      if (sem.survival === 0.5 && sem.choice === 0.5 && sem.future === 0 && sem.loss === 0) {
        if (sem.validationStatus !== 'validated') {
          issues.push({
            tenantId: tenant.id,
            categoryId: cat.id,
            categoryName: cat.name,
            categoryIcon: cat.icon,
            issue: 'DEFAULT 50/50 sem validação (PROIBIDO pelo contrato)',
            severity: 'warning',
            currentState: { validationStatus: sem.validationStatus }
          });
        }
      }

      // Verificar status não validado
      if (sem.validationStatus === 'not_validated' || sem.validationStatus === 'default') {
        if (!issues.find(i => i.categoryId === cat.id)) {
          issues.push({
            tenantId: tenant.id,
            categoryId: cat.id,
            categoryName: cat.name,
            categoryIcon: cat.icon,
            issue: `Status: ${sem.validationStatus}`,
            severity: 'info'
          });
        }
      }
    }

    // Resumo do tenant
    console.log(`\n📊 Resumo:`);
    console.log(`   ✅ Com semântica: ${withSemantics}/${categories.length}`);
    console.log(`   🟢 Validadas: ${validated}`);
    console.log(`   🔵 Inferidas: ${inferred}`);
    console.log(`   🟡 Não validadas: ${notValidated}`);
    console.log(`   🔴 Default: ${defaulted}`);
    console.log(`   ⚠️  Sem semântica: ${categories.length - withSemantics}`);
  }

  // Relatório final
  console.log('\n\n══════════════════════════════════════════════════════════════════');
  console.log('  📋 RELATÓRIO DE PROBLEMAS ENCONTRADOS');
  console.log('══════════════════════════════════════════════════════════════════\n');

  const critical = issues.filter(i => i.severity === 'critical');
  const warning = issues.filter(i => i.severity === 'warning');
  const info = issues.filter(i => i.severity === 'info');

  console.log(`🔴 CRÍTICOS: ${critical.length}`);
  for (const issue of critical) {
    console.log(`   ${issue.categoryIcon || '📂'} ${issue.categoryName}: ${issue.issue}`);
  }

  console.log(`\n🟡 AVISOS: ${warning.length}`);
  for (const issue of warning) {
    console.log(`   ${issue.categoryIcon || '📂'} ${issue.categoryName}: ${issue.issue}`);
  }

  console.log(`\n🔵 INFORMATIVO: ${info.length}`);
  for (const issue of info.slice(0, 10)) {
    console.log(`   ${issue.categoryIcon || '📂'} ${issue.categoryName}: ${issue.issue}`);
  }
  if (info.length > 10) {
    console.log(`   ... e mais ${info.length - 10} itens`);
  }

  // Resumo final
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('  🎯 AÇÕES NECESSÁRIAS');
  console.log('══════════════════════════════════════════════════════════════════\n');

  if (critical.length > 0) {
    console.log(`⚠️  Existem ${critical.length} problemas CRÍTICOS que precisam ser resolvidos:`);
    console.log(`   - Categorias sem semântica precisam ser classificadas`);
    console.log(`   - Somas incorretas precisam ser corrigidas`);
    console.log(`\n   Acesse: /dashboard/energy-governance para corrigir\n`);
  }

  if (warning.length > 0) {
    console.log(`⚠️  Existem ${warning.length} AVISOS sobre defaults 50/50:`);
    console.log(`   - O contrato proíbe defaults 50/50 silenciosos`);
    console.log(`   - Cada categoria híbrida precisa de justificativa\n`);
  }

  if (critical.length === 0 && warning.length === 0) {
    console.log(`✅ Nenhum problema crítico ou de aviso encontrado!`);
    console.log(`   O sistema está pronto para a Fase 2.\n`);
  }

  console.log('══════════════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
  
  return { issues, critical: critical.length, warning: warning.length, info: info.length };
}

auditCategorySemantics()
  .then(result => {
    process.exit(result.critical > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error('Erro na auditoria:', err);
    process.exit(1);
  });
