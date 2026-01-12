/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  SCRIPT: Criação de Usuário Demo para Divulgação - UTOP Sistema           ║
 * ║  Família: Ricardo & Camila Silva + Lucas (8 anos)                          ║
 * ║  Renda: ~R$ 10.700/mês | Classe média brasileira                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * ⚠️  ESTE SCRIPT APENAS INSERE DADOS NOVOS - NÃO MODIFICA NADA EXISTENTE ⚠️
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DA FAMÍLIA DEMO
// ═══════════════════════════════════════════════════════════════════════════

const DEMO_CONFIG = {
  user: {
    email: 'demo@utopsistema.com.br',
    password: 'Demo@2026',
    fullName: 'Ricardo Silva',
  },
  tenant: {
    name: 'Família Silva (Demo)',
    slug: 'familia-silva-demo',
    subscriptionPlan: 'premium', // Para mostrar todas as features
  },
  // Perfil da família
  family: {
    pai: { nome: 'Ricardo', idade: 38, profissao: 'Analista de TI' },
    mae: { nome: 'Camila', idade: 35, profissao: 'Professora' },
    filho: { nome: 'Lucas', idade: 8, escola: '3º ano' },
    pet: { nome: 'Thor', tipo: 'Golden Retriever' },
  },
  // Renda mensal
  income: {
    salarioRicardo: 6500,
    salarioCamila: 4200,
    total: 10700,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTAS BANCÁRIAS
// ═══════════════════════════════════════════════════════════════════════════

const BANK_ACCOUNTS = [
  {
    name: 'Nubank Ricardo',
    type: 'bank',
    institution: 'Nubank',
    initialBalance: 3250.00,
    color: '#8B5CF6',
    icon: '💜',
  },
  {
    name: 'Itaú Conta Corrente',
    type: 'bank', 
    institution: 'Itaú',
    initialBalance: 4580.00,
    color: '#FF6B00',
    icon: '🏦',
  },
  {
    name: 'Nubank Camila',
    type: 'bank',
    institution: 'Nubank',
    initialBalance: 1890.00,
    color: '#8B5CF6',
    icon: '💜',
  },
  {
    name: 'Caixinha Emergência',
    type: 'wallet',
    institution: 'Nubank',
    initialBalance: 15000.00,
    color: '#22C55E',
    icon: '🏦',
  },
  {
    name: 'Investimentos XP',
    type: 'investment',
    institution: 'XP Investimentos',
    initialBalance: 45000.00,
    color: '#000000',
    icon: '📈',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// MÉTODOS DE PAGAMENTO (CARTÕES)
// ═══════════════════════════════════════════════════════════════════════════

const PAYMENT_METHODS = [
  {
    name: 'Nubank Ricardo',
    type: 'credit_card',
    lastFourDigits: '4523',
    cardNetwork: 'mastercard',
    bankAccountRef: 'Nubank Ricardo',
  },
  {
    name: 'Itaú Platinum',
    type: 'credit_card',
    lastFourDigits: '8891',
    cardNetwork: 'visa',
    bankAccountRef: 'Itaú Conta Corrente',
  },
  {
    name: 'Nubank Camila',
    type: 'credit_card',
    lastFourDigits: '7762',
    cardNetwork: 'mastercard',
    bankAccountRef: 'Nubank Camila',
  },
  {
    name: 'PIX',
    type: 'pix',
    bankAccountRef: 'Nubank Ricardo',
  },
  {
    name: 'Débito Automático',
    type: 'automatic_debit',
    bankAccountRef: 'Itaú Conta Corrente',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// CONTAS RECORRENTES (FIXAS)
// ═══════════════════════════════════════════════════════════════════════════

const RECURRING_BILLS = [
  // MORADIA
  { name: 'Aluguel Apartamento', amount: 2200, dueDay: 5, category: 'Aluguel', type: 'expense' },
  { name: 'Condomínio', amount: 450, dueDay: 10, category: 'Condomínio', type: 'expense' },
  { name: 'IPTU (parcela)', amount: 180, dueDay: 15, category: 'IPTU', type: 'expense' },
  { name: 'Energia Elétrica', amount: 280, dueDay: 20, category: 'Luz', type: 'expense', isVariable: true },
  { name: 'Água SABESP', amount: 95, dueDay: 18, category: 'Água', type: 'expense', isVariable: true },
  { name: 'Gás Encanado', amount: 85, dueDay: 22, category: 'Gás', type: 'expense', isVariable: true },
  { name: 'Vivo Fibra 300MB', amount: 139.90, dueDay: 20, category: 'Internet', type: 'expense' },
  
  // EDUCAÇÃO
  { name: 'Escola Maple - Lucas', amount: 850, dueDay: 8, category: 'Escola / Faculdade', type: 'expense' },
  
  // SAÚDE
  { name: 'Plano Unimed Família', amount: 890, dueDay: 15, category: 'Plano de Saúde', type: 'expense' },
  
  // TRANSPORTE
  { name: 'Seguro Carro Porto', amount: 220, dueDay: 25, category: 'Seguro', type: 'expense' },
  { name: 'IPVA (parcela)', amount: 145, dueDay: 12, category: 'IPVA', type: 'expense' },
  
  // LAZER / STREAMING
  { name: 'Netflix Premium', amount: 55.90, dueDay: 12, category: 'Streaming / Assinaturas', type: 'expense' },
  { name: 'Spotify Família', amount: 34.90, dueDay: 15, category: 'Streaming / Assinaturas', type: 'expense' },
  { name: 'Disney+', amount: 33.90, dueDay: 18, category: 'Streaming / Assinaturas', type: 'expense' },
  { name: 'Amazon Prime', amount: 19.90, dueDay: 5, category: 'Streaming / Assinaturas', type: 'expense' },
  
  // BELEZA/SAÚDE
  { name: 'SmartFit Ricardo', amount: 119.90, dueDay: 5, category: 'Academia', type: 'expense' },
  
  // RECEITAS
  { name: 'Salário Ricardo - TechCorp', amount: 6500, dueDay: 5, category: 'Salário', type: 'income' },
  { name: 'Salário Camila - Escola Estadual', amount: 4200, dueDay: 30, category: 'Salário', type: 'income' },
];

// ═══════════════════════════════════════════════════════════════════════════
// TRANSAÇÕES VARIÁVEIS (TEMPLATES PARA GERAR HISTÓRICO)
// ═══════════════════════════════════════════════════════════════════════════

interface TransactionTemplate {
  description: string;
  category: string;
  type: 'expense' | 'income';
  minAmount: number;
  maxAmount: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'occasional';
  probability: number; // 0-1, chance de ocorrer
  paymentMethod?: string;
}

const VARIABLE_TRANSACTIONS: TransactionTemplate[] = [
  // ALIMENTAÇÃO - SUPERMERCADO (semanal)
  { description: 'Carrefour', category: 'Mercado', type: 'expense', minAmount: 250, maxAmount: 450, frequency: 'weekly', probability: 0.9 },
  { description: 'Pão de Açúcar', category: 'Mercado', type: 'expense', minAmount: 80, maxAmount: 180, frequency: 'weekly', probability: 0.4 },
  { description: 'Feira Livre', category: 'Açougue / Hortifruti', type: 'expense', minAmount: 60, maxAmount: 120, frequency: 'weekly', probability: 0.7 },
  { description: 'Padaria Bella Massa', category: 'Padaria', type: 'expense', minAmount: 15, maxAmount: 45, frequency: 'daily', probability: 0.4 },
  
  // ALIMENTAÇÃO - DELIVERY/RESTAURANTE
  { description: 'iFood', category: 'Delivery', type: 'expense', minAmount: 45, maxAmount: 120, frequency: 'weekly', probability: 0.6, paymentMethod: 'Nubank Ricardo' },
  { description: 'Outback', category: 'Restaurante', type: 'expense', minAmount: 180, maxAmount: 350, frequency: 'monthly', probability: 0.5 },
  { description: "McDonald's", category: 'Delivery', type: 'expense', minAmount: 50, maxAmount: 90, frequency: 'biweekly', probability: 0.4 },
  { description: 'Pizzaria Bella Napoli', category: 'Restaurante', type: 'expense', minAmount: 80, maxAmount: 140, frequency: 'biweekly', probability: 0.5 },
  
  // TRANSPORTE
  { description: 'Shell Combustível', category: 'Combustível', type: 'expense', minAmount: 180, maxAmount: 320, frequency: 'weekly', probability: 0.8 },
  { description: 'Ipiranga Combustível', category: 'Combustível', type: 'expense', minAmount: 150, maxAmount: 280, frequency: 'weekly', probability: 0.3 },
  { description: 'Uber', category: 'Uber / Táxi', type: 'expense', minAmount: 18, maxAmount: 55, frequency: 'weekly', probability: 0.5 },
  { description: '99', category: 'Uber / Táxi', type: 'expense', minAmount: 15, maxAmount: 45, frequency: 'weekly', probability: 0.3 },
  { description: 'Estacionamento Shopping', category: 'Estacionamento', type: 'expense', minAmount: 12, maxAmount: 25, frequency: 'weekly', probability: 0.4 },
  { description: 'Pedágio AutoBAn', category: 'Pedágio', type: 'expense', minAmount: 8, maxAmount: 35, frequency: 'monthly', probability: 0.3 },
  
  // SAÚDE
  { description: 'Drogasil', category: 'Farmácia', type: 'expense', minAmount: 35, maxAmount: 180, frequency: 'monthly', probability: 0.7 },
  { description: 'Droga Raia', category: 'Farmácia', type: 'expense', minAmount: 25, maxAmount: 120, frequency: 'monthly', probability: 0.4 },
  
  // LAZER
  { description: 'Cinemark', category: 'Cinema', type: 'expense', minAmount: 80, maxAmount: 150, frequency: 'monthly', probability: 0.5 },
  { description: 'Parque Ibirapuera', category: 'Hobbies', type: 'expense', minAmount: 30, maxAmount: 80, frequency: 'monthly', probability: 0.3 },
  { description: 'Livraria Cultura', category: 'Livros / Materiais', type: 'expense', minAmount: 50, maxAmount: 150, frequency: 'monthly', probability: 0.3 },
  
  // BELEZA
  { description: 'Salão Espaço Hair', category: 'Cabeleireiro / Salão', type: 'expense', minAmount: 80, maxAmount: 180, frequency: 'monthly', probability: 0.6 },
  { description: 'Barbearia Vintage', category: 'Cabeleireiro / Salão', type: 'expense', minAmount: 45, maxAmount: 70, frequency: 'monthly', probability: 0.7 },
  
  // VESTUÁRIO
  { description: 'Renner', category: 'Roupas', type: 'expense', minAmount: 80, maxAmount: 350, frequency: 'monthly', probability: 0.4, paymentMethod: 'Nubank Camila' },
  { description: 'C&A', category: 'Roupas', type: 'expense', minAmount: 60, maxAmount: 200, frequency: 'monthly', probability: 0.3 },
  { description: 'Centauro', category: 'Calçados', type: 'expense', minAmount: 150, maxAmount: 400, frequency: 'occasional', probability: 0.2 },
  
  // FAMÍLIA / FILHO
  { description: 'Material Escolar Kalunga', category: 'Livros / Materiais', type: 'expense', minAmount: 50, maxAmount: 200, frequency: 'occasional', probability: 0.2 },
  { description: 'Presente Lucas', category: 'Presentes', type: 'expense', minAmount: 50, maxAmount: 300, frequency: 'occasional', probability: 0.15 },
  { description: 'Lanche Escola Lucas', category: 'Padaria', type: 'expense', minAmount: 150, maxAmount: 200, frequency: 'monthly', probability: 0.9 },
  
  // PET
  { description: 'PetLove - Ração Thor', category: 'Ração', type: 'expense', minAmount: 180, maxAmount: 250, frequency: 'monthly', probability: 0.9 },
  { description: 'Pet Shop Banho Thor', category: 'Banho & Tosa', type: 'expense', minAmount: 80, maxAmount: 120, frequency: 'biweekly', probability: 0.7 },
  { description: 'Veterinário Thor', category: 'Veterinário', type: 'expense', minAmount: 150, maxAmount: 400, frequency: 'occasional', probability: 0.2 },
  
  // CASA
  { description: 'Leroy Merlin', category: 'Manutenção', type: 'expense', minAmount: 50, maxAmount: 300, frequency: 'occasional', probability: 0.2 },
  { description: 'Magazine Luiza', category: 'Manutenção', type: 'expense', minAmount: 100, maxAmount: 500, frequency: 'occasional', probability: 0.15 },
  
  // RECEITAS EXTRAS
  { description: 'Freelance Design', category: 'Freelance', type: 'income', minAmount: 500, maxAmount: 2000, frequency: 'occasional', probability: 0.15 },
  { description: 'Venda Mercado Livre', category: 'Vendas', type: 'income', minAmount: 50, maxAmount: 300, frequency: 'occasional', probability: 0.1 },
  { description: 'Rendimento CDB', category: 'Investimentos', type: 'income', minAmount: 80, maxAmount: 200, frequency: 'monthly', probability: 0.8 },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPRAS PARCELADAS (para demonstrar o recurso)
// ═══════════════════════════════════════════════════════════════════════════

const INSTALLMENT_PURCHASES = [
  {
    name: 'Smart TV 55" Samsung',
    totalAmount: 2800,
    numberOfInstallments: 10,
    firstDueDate: new Date('2025-09-15'),
    category: 'Manutenção',
    paymentMethod: 'Nubank Ricardo',
  },
  {
    name: 'iPhone 15 Camila',
    totalAmount: 5400,
    numberOfInstallments: 12,
    firstDueDate: new Date('2025-08-10'),
    category: 'Manutenção',
    paymentMethod: 'Itaú Platinum',
  },
  {
    name: 'Ar Condicionado LG',
    totalAmount: 3200,
    numberOfInstallments: 10,
    firstDueDate: new Date('2025-11-05'),
    category: 'Manutenção',
    paymentMethod: 'Nubank Ricardo',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getMonthDates(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIAS PADRÃO PARA O DEMO
// ═══════════════════════════════════════════════════════════════════════════

interface CategoryDef {
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  children?: Array<{ name: string; children?: string[] }>;
}

const DEMO_CATEGORIES: CategoryDef[] = [
  // RECEITAS
  {
    name: '💵 Receitas',
    type: 'income',
    icon: '💵',
    color: '#22C55E',
    children: [
      { name: 'Salário', children: [] },
      { name: 'Freelance', children: [] },
      { name: 'Investimentos', children: [] },
      { name: 'Vendas', children: [] },
      { name: 'Outros', children: [] }
    ]
  },
  // DESPESAS
  {
    name: '🏠 Moradia',
    type: 'expense',
    icon: '🏠',
    color: '#F59E0B',
    children: [
      { name: 'Aluguel', children: [] },
      { name: 'Condomínio', children: [] },
      { name: 'Luz', children: [] },
      { name: 'Água', children: [] },
      { name: 'Gás', children: [] },
      { name: 'Internet', children: [] },
      { name: 'IPTU', children: [] },
      { name: 'Seguro Residencial', children: [] },
      { name: 'Manutenção', children: ['Reparos', 'Reforma'] }
    ]
  },
  {
    name: '🍔 Alimentação',
    type: 'expense',
    icon: '🍔',
    color: '#EF4444',
    children: [
      { name: 'Mercado', children: [] },
      { name: 'Açougue / Hortifruti', children: [] },
      { name: 'Padaria', children: [] },
      { name: 'Restaurante', children: [] },
      { name: 'Delivery', children: ['iFood', 'Outros Apps'] },
      { name: 'Bebidas Não Alcoólicas', children: [] }
    ]
  },
  {
    name: '🏥 Saúde',
    type: 'expense',
    icon: '🏥',
    color: '#EC4899',
    children: [
      { name: 'Plano de Saúde', children: [] },
      { name: 'Consultas', children: [] },
      { name: 'Exames', children: [] },
      { name: 'Farmácia', children: [] },
      { name: 'Terapia / Psicólogo', children: [] },
      { name: 'Dentista', children: [] },
      { name: 'Emergências', children: [] }
    ]
  },
  {
    name: '🚗 Transporte',
    type: 'expense',
    icon: '🚗',
    color: '#3B82F6',
    children: [
      { name: 'Combustível', children: [] },
      { name: 'Manutenção', children: [] },
      { name: 'IPVA', children: [] },
      { name: 'Seguro', children: [] },
      { name: 'Estacionamento', children: [] },
      { name: 'Pedágio', children: [] },
      { name: 'Uber / Táxi', children: [] },
      { name: 'Transporte Público', children: [] }
    ]
  },
  {
    name: '🎓 Educação',
    type: 'expense',
    icon: '🎓',
    color: '#8B5CF6',
    children: [
      { name: 'Escola / Faculdade', children: [] },
      { name: 'Cursos', children: [] },
      { name: 'Livros / Materiais', children: [] }
    ]
  },
  {
    name: '👨‍👩‍👧 Família',
    type: 'expense',
    icon: '👨‍👩‍👧',
    color: '#06B6D4',
    children: [
      { name: 'Filhos', children: ['Escola', 'Roupas', 'Presentes', 'Outros'] },
      { name: 'Animais de Estimação', children: ['Ração', 'Veterinário', 'Banho & Tosa'] }
    ]
  },
  {
    name: '💅 Beleza e Saúde',
    type: 'expense',
    icon: '💅',
    color: '#F472B6',
    children: [
      { name: 'Cabeleireiro / Salão', children: [] },
      { name: 'Academia', children: [] },
      { name: 'Cosméticos', children: [] }
    ]
  },
  {
    name: '👕 Vestuário',
    type: 'expense',
    icon: '👕',
    color: '#A855F7',
    children: [
      { name: 'Roupas', children: [] },
      { name: 'Calçados', children: [] },
      { name: 'Acessórios', children: [] }
    ]
  },
  {
    name: '🎮 Lazer',
    type: 'expense',
    icon: '🎮',
    color: '#10B981',
    children: [
      { name: 'Cinema', children: [] },
      { name: 'Viagens', children: [] },
      { name: 'Bares / Restaurantes', children: [] },
      { name: 'Streaming / Assinaturas', children: [] },
      { name: 'Presentes', children: [] },
      { name: 'Hobbies', children: ['Games', 'Música', 'Esportes'] }
    ]
  },
  {
    name: '📈 Investimentos',
    type: 'expense',
    icon: '📈',
    color: '#14B8A6',
    children: [
      { name: 'Reserva de Emergência', children: [] },
      { name: 'Renda Fixa', children: [] },
      { name: 'Ações', children: [] },
      { name: 'Previdência', children: [] }
    ]
  },
];

async function createDemoCategories(tenantId: string): Promise<void> {
  for (const category of DEMO_CATEGORIES) {
    // Criar categoria pai (nível 1)
    const parent = await prisma.category.create({
      data: {
        tenantId,
        name: category.name,
        type: category.type,
        icon: category.icon,
        color: category.color,
        level: 1,
        isActive: true,
      },
    });

    // Criar filhos (nível 2)
    if (category.children) {
      for (const child of category.children) {
        const childCat = await prisma.category.create({
          data: {
            tenantId,
            name: child.name,
            type: category.type,
            icon: '📝',
            color: '#6B7280',
            level: 2,
            parentId: parent.id,
            isActive: true,
          },
        });

        // Criar netos (nível 3)
        if (child.children && child.children.length > 0) {
          for (const grandchild of child.children) {
            await prisma.category.create({
              data: {
                tenantId,
                name: grandchild,
                type: category.type,
                icon: '📝',
                color: '#9CA3AF',
                level: 3,
                parentId: childCat.id,
                isActive: true,
              },
            });
          }
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

async function createDemoUser() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     🏠 UTOP Sistema - Criação de Usuário Demo                  ║');
  console.log('║     Família Silva: Ricardo, Camila e Lucas                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // 1. VERIFICAR SE USUÁRIO JÁ EXISTE
    // ═══════════════════════════════════════════════════════════════════════
    
    const existingUser = await prisma.user.findUnique({
      where: { email: DEMO_CONFIG.user.email },
    });

    if (existingUser) {
      console.log('⚠️  Usuário demo já existe! Pulando criação...');
      console.log(`   Email: ${DEMO_CONFIG.user.email}`);
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. CRIAR USUÁRIO
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log('👤 Criando usuário demo...');
    const passwordHash = await bcrypt.hash(DEMO_CONFIG.user.password, 12);
    
    const user = await prisma.user.create({
      data: {
        email: DEMO_CONFIG.user.email,
        passwordHash,
        fullName: DEMO_CONFIG.user.fullName,
        role: 'owner',
        isActive: true,
        isEmailVerified: true,
      },
    });
    console.log(`   ✅ Usuário criado: ${user.email}`);

    // ═══════════════════════════════════════════════════════════════════════
    // 3. CRIAR TENANT
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log('\n🏢 Criando tenant...');
    const tenant = await prisma.tenant.create({
      data: {
        ownerId: user.id,
        name: DEMO_CONFIG.tenant.name,
        slug: DEMO_CONFIG.tenant.slug,
        subscriptionPlan: DEMO_CONFIG.tenant.subscriptionPlan,
        subscriptionStatus: 'active',
        trialEndsAt: null, // Premium, sem trial
      },
    });
    console.log(`   ✅ Tenant criado: ${tenant.name}`);

    // Vincular usuário ao tenant
    await prisma.tenantUser.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: 'owner',
        acceptedAt: new Date(),
      },
    });
    console.log('   ✅ Usuário vinculado ao tenant');

    // ═══════════════════════════════════════════════════════════════════════
    // 4. CRIAR CATEGORIAS PADRÃO
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log('\n📂 Criando categorias...');
    
    // Criar categorias diretamente (simplificado para evitar imports complexos)
    await createDemoCategories(tenant.id);
    
    const categoryCount = await prisma.category.count({ where: { tenantId: tenant.id } });
    console.log(`   ✅ ${categoryCount} categorias criadas`);

    // Buscar todas as categorias para referência
    const allCategories = await prisma.category.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
    });
    
    const categoryMap = new Map<string, string>();
    allCategories.forEach(cat => {
      categoryMap.set(cat.name, cat.id);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 5. CRIAR CONTAS BANCÁRIAS
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log('\n🏦 Criando contas bancárias...');
    const bankAccountMap = new Map<string, string>();
    
    for (let i = 0; i < BANK_ACCOUNTS.length; i++) {
      const account = BANK_ACCOUNTS[i];
      const created = await prisma.bankAccount.create({
        data: {
          tenantId: tenant.id,
          name: account.name,
          type: account.type,
          institution: account.institution,
          initialBalance: account.initialBalance,
          currentBalance: account.initialBalance,
          color: account.color,
          icon: account.icon,
          isActive: true,
          order: i,
        },
      });
      bankAccountMap.set(account.name, created.id);
      console.log(`   ✅ ${account.icon} ${account.name}: R$ ${account.initialBalance.toLocaleString('pt-BR')}`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 6. CRIAR MÉTODOS DE PAGAMENTO
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log('\n💳 Criando métodos de pagamento...');
    const paymentMethodMap = new Map<string, string>();
    
    for (let i = 0; i < PAYMENT_METHODS.length; i++) {
      const pm = PAYMENT_METHODS[i];
      const bankAccountId = bankAccountMap.get(pm.bankAccountRef);
      
      const created = await prisma.paymentMethod.create({
        data: {
          tenantId: tenant.id,
          bankAccountId,
          name: pm.name,
          type: pm.type,
          lastFourDigits: pm.lastFourDigits,
          cardNetwork: pm.cardNetwork,
          isActive: true,
          order: i,
        },
      });
      paymentMethodMap.set(pm.name, created.id);
      console.log(`   ✅ ${pm.type === 'credit_card' ? '💳' : '📲'} ${pm.name}`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 7. CRIAR CONTAS RECORRENTES
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log('\n🔄 Criando contas recorrentes...');
    const recurringBillMap = new Map<string, string>();
    
    for (const bill of RECURRING_BILLS) {
      // Encontrar categoria
      let categoryId: string | null = null;
      for (const [name, id] of categoryMap) {
        if (name.includes(bill.category) || bill.category.includes(name)) {
          categoryId = id;
          break;
        }
      }
      
      const created = await prisma.recurringBill.create({
        data: {
          tenantId: tenant.id,
          categoryId,
          name: bill.name,
          type: bill.type,
          amount: bill.amount,
          isVariableAmount: bill.isVariable || false,
          frequency: 'monthly',
          dueDay: bill.dueDay,
          alertDaysBefore: 3,
          autoGenerate: true,
          status: 'active',
          isFixed: true,
        },
      });
      recurringBillMap.set(bill.name, created.id);
      console.log(`   ✅ ${bill.type === 'income' ? '📥' : '📤'} ${bill.name}: R$ ${bill.amount.toLocaleString('pt-BR')}`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 8. GERAR TRANSAÇÕES DE 6 MESES
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log('\n📊 Gerando histórico de transações (6 meses)...');
    
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);
    
    let totalTransactions = 0;
    let totalIncome = 0;
    let totalExpense = 0;

    // Iterar por cada mês
    for (let monthOffset = -6; monthOffset <= 0; monthOffset++) {
      const currentMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
      const { start: monthStart, end: monthEnd } = getMonthDates(
        currentMonth.getFullYear(),
        currentMonth.getMonth()
      );
      
      const monthName = currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      console.log(`\n   📅 ${monthName}:`);
      
      let monthTransactions = 0;
      let monthIncome = 0;
      let monthExpense = 0;

      // 8.1 TRANSAÇÕES RECORRENTES (FIXAS)
      for (const bill of RECURRING_BILLS) {
        const categoryId = findCategoryId(categoryMap, bill.category);
        const dueDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), bill.dueDay);
        
        // Pular se a data estiver no futuro
        if (dueDate > today) continue;
        
        // Variação de ±10% para contas variáveis
        let amount = bill.amount;
        if (bill.isVariable) {
          amount = bill.amount * (0.9 + Math.random() * 0.2);
        }
        
        // Status: paga se já passou, pendente se próximos 3 dias
        const isPast = dueDate < today;
        const status = isPast ? 'completed' : 'pending';
        const paidDate = isPast ? addDays(dueDate, Math.floor(Math.random() * 3)) : null;
        
        await prisma.transaction.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            type: bill.type,
            transactionType: 'recurring',
            categoryId,
            bankAccountId: bankAccountMap.get('Itaú Conta Corrente'),
            amount: new Prisma.Decimal(amount),
            description: bill.name,
            transactionDate: dueDate,
            dueDate,
            paidDate,
            status,
            isRecurring: true,
            isFixed: true,
            recurringBillId: recurringBillMap.get(bill.name),
          },
        });
        
        monthTransactions++;
        if (bill.type === 'income') {
          monthIncome += amount;
        } else {
          monthExpense += amount;
        }
      }

      // 8.2 TRANSAÇÕES VARIÁVEIS
      for (const template of VARIABLE_TRANSACTIONS) {
        // Determinar quantas vezes essa transação ocorre no mês
        let occurrences = 0;
        
        switch (template.frequency) {
          case 'daily':
            occurrences = Math.floor(30 * template.probability);
            break;
          case 'weekly':
            occurrences = Math.floor(4 * template.probability);
            break;
          case 'biweekly':
            occurrences = Math.floor(2 * template.probability);
            break;
          case 'monthly':
            occurrences = Math.random() < template.probability ? 1 : 0;
            break;
          case 'occasional':
            occurrences = Math.random() < template.probability ? 1 : 0;
            break;
        }

        for (let i = 0; i < occurrences; i++) {
          const categoryId = findCategoryId(categoryMap, template.category);
          const transactionDate = randomDate(monthStart, monthEnd);
          
          // Pular datas futuras
          if (transactionDate > today) continue;
          
          const amount = randomBetween(template.minAmount, template.maxAmount);
          const paymentMethodId = template.paymentMethod 
            ? paymentMethodMap.get(template.paymentMethod) 
            : paymentMethodMap.get('PIX');
          
          await prisma.transaction.create({
            data: {
              tenantId: tenant.id,
              userId: user.id,
              type: template.type,
              transactionType: 'single',
              categoryId,
              bankAccountId: bankAccountMap.get('Nubank Ricardo'),
              paymentMethodId,
              amount: new Prisma.Decimal(amount),
              description: template.description,
              transactionDate,
              status: 'completed',
              isRecurring: false,
              isFixed: false,
            },
          });
          
          monthTransactions++;
          if (template.type === 'income') {
            monthIncome += amount;
          } else {
            monthExpense += amount;
          }
        }
      }

      console.log(`      📥 Receitas: R$ ${monthIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      console.log(`      📤 Despesas: R$ ${monthExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      console.log(`      📊 Transações: ${monthTransactions}`);
      
      totalTransactions += monthTransactions;
      totalIncome += monthIncome;
      totalExpense += monthExpense;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 9. CRIAR COMPRAS PARCELADAS
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log('\n🛒 Criando compras parceladas...');
    
    for (const purchase of INSTALLMENT_PURCHASES) {
      const categoryId = findCategoryId(categoryMap, purchase.category);
      const installmentAmount = purchase.totalAmount / purchase.numberOfInstallments;
      
      const installmentPurchase = await prisma.installmentPurchase.create({
        data: {
          tenantId: tenant.id,
          categoryId,
          name: purchase.name,
          totalAmount: purchase.totalAmount,
          numberOfInstallments: purchase.numberOfInstallments,
          installmentAmount,
          firstDueDate: purchase.firstDueDate,
          remainingBalance: purchase.totalAmount,
          paidInstallments: 0,
          status: 'active',
          isFixed: false,
        },
      });
      
      // Criar as parcelas
      for (let i = 0; i < purchase.numberOfInstallments; i++) {
        const dueDate = new Date(purchase.firstDueDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        
        const isPaid = dueDate < today;
        
        await prisma.installment.create({
          data: {
            tenantId: tenant.id,
            installmentPurchaseId: installmentPurchase.id,
            bankAccountId: bankAccountMap.get('Nubank Ricardo'),
            paymentMethodId: paymentMethodMap.get(purchase.paymentMethod),
            installmentNumber: i + 1,
            dueDate,
            amount: installmentAmount,
            paidDate: isPaid ? dueDate : null,
            paidAmount: isPaid ? installmentAmount : null,
            status: isPaid ? 'paid' : 'pending',
          },
        });
      }
      
      console.log(`   ✅ ${purchase.name}: ${purchase.numberOfInstallments}x R$ ${installmentAmount.toLocaleString('pt-BR')}`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 10. CRIAR ORÇAMENTOS
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log('\n🎯 Criando orçamentos...');
    
    const budgets = [
      { categoryName: 'Mercado', amount: 1500, name: 'Orçamento Supermercado' },
      { categoryName: 'Restaurante', amount: 500, name: 'Orçamento Restaurantes' },
      { categoryName: 'Delivery', amount: 300, name: 'Orçamento Delivery' },
      { categoryName: 'Combustível', amount: 600, name: 'Orçamento Combustível' },
      { categoryName: 'Roupas', amount: 400, name: 'Orçamento Vestuário' },
      { categoryName: 'Streaming / Assinaturas', amount: 200, name: 'Orçamento Streaming' },
    ];

    const budgetStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const budgetEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    for (const budget of budgets) {
      const categoryId = findCategoryId(categoryMap, budget.categoryName);
      if (categoryId) {
        await prisma.budget.create({
          data: {
            tenantId: tenant.id,
            categoryId,
            name: budget.name,
            amount: budget.amount,
            period: 'monthly',
            startDate: budgetStart,
            endDate: budgetEnd,
            alertAt80: true,
            alertAt90: true,
            alertAt100: true,
            isActive: true,
          },
        });
        console.log(`   ✅ ${budget.name}: R$ ${budget.amount.toLocaleString('pt-BR')}/mês`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RESUMO FINAL
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ USUÁRIO DEMO CRIADO!                     ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║  📧 Email: ${DEMO_CONFIG.user.email.padEnd(42)}║`);
    console.log(`║  🔑 Senha: ${DEMO_CONFIG.user.password.padEnd(42)}║`);
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║  📊 Total de transações: ${totalTransactions.toString().padEnd(28)}║`);
    console.log(`║  📥 Total receitas: R$ ${totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padEnd(27)}║`);
    console.log(`║  📤 Total despesas: R$ ${totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padEnd(27)}║`);
    console.log(`║  💰 Saldo: R$ ${(totalIncome - totalExpense).toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padEnd(35)}║`);
    console.log('╚═══════════════════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('\n❌ Erro ao criar usuário demo:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Função auxiliar para encontrar categoria
function findCategoryId(categoryMap: Map<string, string>, searchName: string): string | null {
  // Busca exata primeiro
  if (categoryMap.has(searchName)) {
    return categoryMap.get(searchName)!;
  }
  
  // Busca parcial
  for (const [name, id] of categoryMap) {
    if (name.toLowerCase().includes(searchName.toLowerCase()) || 
        searchName.toLowerCase().includes(name.toLowerCase())) {
      return id;
    }
  }
  
  return null;
}

// Executar
createDemoUser()
  .then(() => {
    console.log('\n🎉 Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script falhou:', error);
    process.exit(1);
  });
