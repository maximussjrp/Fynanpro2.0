/**
 * Script para criar um cliente DEMO para divulgação/apresentação.
 *
 * Cria:
 *   - Usuário: demo@utopsistema.com.br / Demo@Utop2026
 *   - Tenant: "Família Silva" (plano monthly ativo)
 *   - 2 contas bancárias (Nubank + Bradesco)
 *   - Categorias realistas
 *   - 6 meses de transações (salário, despesas, lazer, etc.)
 *   - 8 contas recorrentes (aluguel, streaming, academia, etc.)
 *
 * Uso:
 *   node scripts/create-demo-client.js
 *
 * Para recriar do zero (apaga e refaz):
 *   RESET=true node scripts/create-demo-client.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@utopsistema.com.br';
const DEMO_PASSWORD = 'Demo@Utop2026';
const DEMO_SLUG = 'familia-silva-demo';

// Gera data no passado: mesesAtras=0 é este mês, dia=1..28
function d(mesesAtras, dia) {
  const now = new Date();
  const dt = new Date(now.getFullYear(), now.getMonth() - mesesAtras, dia, 10, 0, 0);
  return dt;
}

async function main() {
  console.log('🎭 Criando cliente DEMO para divulgação...\n');

  // ── RESET opcional ────────────────────────────────────────────────────────
  if (process.env.RESET === 'true') {
    console.log('🗑️  Removendo demo existente...');
    const existing = await prisma.tenant.findUnique({ where: { slug: DEMO_SLUG } });
    if (existing) {
      // Cascade cuida das tabelas filhas
      await prisma.tenant.delete({ where: { id: existing.id } });
    }
    await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
    console.log('✅ Demo removido\n');
  }

  // ── USUÁRIO ───────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash, isActive: true },
    create: {
      email: DEMO_EMAIL,
      passwordHash,
      fullName: 'Carlos Silva',
      role: 'owner',
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log('✅ Usuário criado:', user.email);

  // ── TENANT ────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEMO_SLUG },
    update: { ownerId: user.id },
    create: {
      ownerId: user.id,
      name: 'Família Silva',
      slug: DEMO_SLUG,
      subscriptionPlan: 'monthly',
      subscriptionStatus: 'active',
      trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  console.log('✅ Tenant criado:', tenant.name, '| id:', tenant.id);

  // Vincular usuário
  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: {},
    create: { tenantId: tenant.id, userId: user.id, role: 'owner' },
  });

  const T = tenant.id;
  const U = user.id;

  // ── CATEGORIAS ────────────────────────────────────────────────────────────
  console.log('\n📂 Criando categorias...');
  const catDefs = [
    { name: '💼 Salário',        type: 'income',  icon: '💼', color: '#2ECC9A' },
    { name: '💰 Investimentos',  type: 'income',  icon: '💰', color: '#22C55E' },
    { name: '🎁 Extras',         type: 'income',  icon: '🎁', color: '#9AF0C6' },
    { name: '💵 Freelance',      type: 'income',  icon: '💵', color: '#66BB6A' },
    { name: '🏠 Moradia',        type: 'expense', icon: '🏠', color: '#EF4444' },
    { name: '🍔 Alimentação',    type: 'expense', icon: '🍔', color: '#FF6B6B' },
    { name: '🚗 Transporte',     type: 'expense', icon: '🚗', color: '#FF9800' },
    { name: '🏥 Saúde',          type: 'expense', icon: '🏥', color: '#E91E63' },
    { name: '📚 Educação',       type: 'expense', icon: '📚', color: '#9C27B0' },
    { name: '🎮 Lazer',          type: 'expense', icon: '🎮', color: '#673AB7' },
    { name: '💳 Contas',         type: 'expense', icon: '💳', color: '#F44336' },
    { name: '👕 Vestuário',      type: 'expense', icon: '👕', color: '#FF5722' },
    { name: '🏋️ Academia',       type: 'expense', icon: '🏋️', color: '#8BC34A' },
    { name: '🐕 Pets',           type: 'expense', icon: '🐕', color: '#795548' },
    { name: '🎵 Streaming',      type: 'expense', icon: '🎵', color: '#1DB954' },
  ];

  const catMap = {};
  for (const c of catDefs) {
    const existing = await prisma.category.findFirst({
      where: { tenantId: T, name: c.name },
    });
    const cat = existing ?? await prisma.category.create({
      data: { tenantId: T, name: c.name, type: c.type, icon: c.icon, color: c.color, isActive: true },
    });
    catMap[c.name] = cat.id;
  }
  console.log(`✅ ${catDefs.length} categorias prontas`);

  const C = (name) => catMap[name];

  // ── CONTAS BANCÁRIAS ──────────────────────────────────────────────────────
  console.log('\n🏦 Criando contas bancárias...');
  const nubank = await prisma.bankAccount.create({
    data: {
      tenantId: T,
      name: 'Nubank',
      type: 'checking',
      institution: 'Nubank',
      currentBalance: 3450.00,
      initialBalance: 3450.00,
      color: '#820AD1',
      icon: '💜',
      order: 1,
    },
  });
  const bradesco = await prisma.bankAccount.create({
    data: {
      tenantId: T,
      name: 'Bradesco',
      type: 'savings',
      institution: 'Bradesco',
      currentBalance: 12800.00,
      initialBalance: 12800.00,
      color: '#CC0000',
      icon: '❤️',
      order: 2,
    },
  });
  console.log('✅ Nubank e Bradesco criados');

  // ── TRANSAÇÕES (6 MESES) ──────────────────────────────────────────────────
  console.log('\n💳 Criando transações dos últimos 6 meses...');

  const txBatch = [];

  for (let mes = 5; mes >= 0; mes--) {
    const salario = 7800 + (Math.random() * 200 - 100); // ~R$ 7.800

    // Receitas
    txBatch.push({
      tenantId: T, userId: U,
      type: 'income', categoryId: C('💼 Salário'),
      bankAccountId: nubank.id,
      amount: +salario.toFixed(2),
      description: 'Salário mensal - Empresa ABC Ltda',
      transactionDate: d(mes, 5),
      status: mes > 0 ? 'completed' : 'pending',
    });

    if (mes % 2 === 0) {
      txBatch.push({
        tenantId: T, userId: U,
        type: 'income', categoryId: C('💵 Freelance'),
        bankAccountId: nubank.id,
        amount: 1200.00,
        description: 'Projeto de design - cliente externo',
        transactionDate: d(mes, 18),
        status: 'completed',
      });
    }

    if (mes === 3) {
      txBatch.push({
        tenantId: T, userId: U,
        type: 'income', categoryId: C('🎁 Extras'),
        bankAccountId: bradesco.id,
        amount: 500.00,
        description: '13° salário parcial',
        transactionDate: d(mes, 20),
        status: 'completed',
      });
    }

    // Despesas fixas
    txBatch.push({
      tenantId: T, userId: U,
      type: 'expense', categoryId: C('🏠 Moradia'),
      bankAccountId: bradesco.id,
      amount: 1500.00,
      description: 'Aluguel apartamento',
      transactionDate: d(mes, 10),
      status: 'completed',
    });

    txBatch.push({
      tenantId: T, userId: U,
      type: 'expense', categoryId: C('💳 Contas'),
      bankAccountId: nubank.id,
      amount: 189.90,
      description: 'Conta de luz - CPFL',
      transactionDate: d(mes, 7),
      status: 'completed',
    });

    txBatch.push({
      tenantId: T, userId: U,
      type: 'expense', categoryId: C('💳 Contas'),
      bankAccountId: nubank.id,
      amount: 99.90,
      description: 'Internet Vivo Fibra',
      transactionDate: d(mes, 8),
      status: 'completed',
    });

    txBatch.push({
      tenantId: T, userId: U,
      type: 'expense', categoryId: C('💳 Contas'),
      bankAccountId: nubank.id,
      amount: 79.90,
      description: 'Plano de celular Tim',
      transactionDate: d(mes, 9),
      status: 'completed',
    });

    // Alimentação (4 por mês)
    const alimentacao = [380, 420, 310, 290];
    const descAlim = ['Supermercado Extra', 'iFood - pedidos', 'Feira livre', 'Padaria e hortifruti'];
    alimentacao.forEach((val, i) => {
      txBatch.push({
        tenantId: T, userId: U,
        type: 'expense', categoryId: C('🍔 Alimentação'),
        bankAccountId: nubank.id,
        amount: val,
        description: descAlim[i],
        transactionDate: d(mes, [3, 12, 18, 25][i]),
        status: 'completed',
      });
    });

    // Transporte
    txBatch.push({
      tenantId: T, userId: U,
      type: 'expense', categoryId: C('🚗 Transporte'),
      bankAccountId: nubank.id,
      amount: 320.00,
      description: 'Combustível / Uber',
      transactionDate: d(mes, 15),
      status: 'completed',
    });

    // Saúde
    if (mes % 3 === 0) {
      txBatch.push({
        tenantId: T, userId: U,
        type: 'expense', categoryId: C('🏥 Saúde'),
        bankAccountId: nubank.id,
        amount: 250.00,
        description: 'Consulta médica + exames',
        transactionDate: d(mes, 14),
        status: 'completed',
      });
    }
    txBatch.push({
      tenantId: T, userId: U,
      type: 'expense', categoryId: C('🏥 Saúde'),
      bankAccountId: nubank.id,
      amount: 380.00,
      description: 'Plano de saúde Amil',
      transactionDate: d(mes, 6),
      status: 'completed',
    });

    // Lazer
    txBatch.push({
      tenantId: T, userId: U,
      type: 'expense', categoryId: C('🎮 Lazer'),
      bankAccountId: nubank.id,
      amount: 180 + Math.round(Math.random() * 80),
      description: 'Cinema, bar e passeios',
      transactionDate: d(mes, 22),
      status: 'completed',
    });

    // Streaming
    txBatch.push({
      tenantId: T, userId: U,
      type: 'expense', categoryId: C('🎵 Streaming'),
      bankAccountId: nubank.id,
      amount: 55.90,
      description: 'Netflix + Spotify',
      transactionDate: d(mes, 11),
      status: 'completed',
    });

    // Academia
    txBatch.push({
      tenantId: T, userId: U,
      type: 'expense', categoryId: C('🏋️ Academia'),
      bankAccountId: nubank.id,
      amount: 120.00,
      description: 'Smart Fit',
      transactionDate: d(mes, 5),
      status: 'completed',
    });

    // Educação
    if (mes <= 3) {
      txBatch.push({
        tenantId: T, userId: U,
        type: 'expense', categoryId: C('📚 Educação'),
        bankAccountId: bradesco.id,
        amount: 450.00,
        description: 'Curso de inglês',
        transactionDate: d(mes, 16),
        status: 'completed',
      });
    }
  }

  // Transações futuras (contas a pagar este mês)
  txBatch.push({
    tenantId: T, userId: U,
    type: 'expense', categoryId: C('🏠 Moradia'),
    bankAccountId: bradesco.id,
    amount: 1500.00,
    description: 'Aluguel apartamento',
    transactionDate: d(0, 10),
    dueDate: d(0, 10),
    status: 'pending',
  });
  txBatch.push({
    tenantId: T, userId: U,
    type: 'expense', categoryId: C('🏥 Saúde'),
    bankAccountId: nubank.id,
    amount: 380.00,
    description: 'Plano de saúde Amil',
    transactionDate: d(0, 6),
    dueDate: d(0, 6),
    status: 'pending',
  });
  txBatch.push({
    tenantId: T, userId: U,
    type: 'expense', categoryId: C('💳 Contas'),
    bankAccountId: nubank.id,
    amount: 189.90,
    description: 'Conta de luz - CPFL',
    transactionDate: d(0, 7),
    dueDate: d(0, 7),
    status: 'overdue',
  });

  await prisma.transaction.createMany({ data: txBatch });
  console.log(`✅ ${txBatch.length} transações criadas`);

  // ── CONTAS RECORRENTES ────────────────────────────────────────────────────
  console.log('\n🔄 Criando contas recorrentes...');
  const recorrentes = [
    { name: 'Aluguel',           amount: 1500.00, dueDay: 10, type: 'expense', catName: '🏠 Moradia',     bankAccount: bradesco },
    { name: 'Plano de saúde',    amount: 380.00,  dueDay: 6,  type: 'expense', catName: '🏥 Saúde',       bankAccount: nubank   },
    { name: 'Internet Vivo',     amount: 99.90,   dueDay: 8,  type: 'expense', catName: '💳 Contas',      bankAccount: nubank   },
    { name: 'Celular Tim',       amount: 79.90,   dueDay: 9,  type: 'expense', catName: '💳 Contas',      bankAccount: nubank   },
    { name: 'Smart Fit',         amount: 120.00,  dueDay: 5,  type: 'expense', catName: '🏋️ Academia',    bankAccount: nubank   },
    { name: 'Netflix + Spotify', amount: 55.90,   dueDay: 11, type: 'expense', catName: '🎵 Streaming',   bankAccount: nubank   },
    { name: 'Curso de inglês',   amount: 450.00,  dueDay: 16, type: 'expense', catName: '📚 Educação',    bankAccount: bradesco },
    { name: 'Salário Carlos',    amount: 7800.00, dueDay: 5,  type: 'income',  catName: '💼 Salário',     bankAccount: nubank   },
  ];

  for (const r of recorrentes) {
    await prisma.recurringBill.create({
      data: {
        tenantId: T,
        categoryId: C(r.catName),
        bankAccountId: r.bankAccount.id,
        name: r.name,
        amount: r.amount,
        frequency: 'monthly',
        dueDay: r.dueDay,
        type: r.type,
        isFixed: true,
        status: 'active',
        autoGenerate: true,
        alertDaysBefore: 3,
        alertOnDueDay: true,
        alertIfOverdue: true,
      },
    });
  }
  console.log(`✅ ${recorrentes.length} contas recorrentes criadas`);

  // ── RESUMO ────────────────────────────────────────────────────────────────
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║           CLIENTE DEMO CRIADO              ║');
  console.log('╠════════════════════════════════════════════╣');
  console.log(`║  Email:  ${DEMO_EMAIL.padEnd(34)}║`);
  console.log(`║  Senha:  ${DEMO_PASSWORD.padEnd(34)}║`);
  console.log(`║  Nome:   Carlos Silva (Família Silva)      ║`);
  console.log(`║  Plano:  Monthly (ativo)                   ║`);
  console.log(`║  Contas: Nubank + Bradesco                 ║`);
  console.log(`║  Txns:   ${String(txBatch.length).padEnd(4)} (6 meses de histórico)        ║`);
  console.log(`║  Recorr: ${recorrentes.length} contas recorrentes              ║`);
  console.log('╚════════════════════════════════════════════╝\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
