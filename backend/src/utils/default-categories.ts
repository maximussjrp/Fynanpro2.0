import { PrismaClient } from '@prisma/client';
import { log } from './logger';

const prisma = new PrismaClient();

interface CategoryStructure {
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  level: number;
  children?: Array<{
    name: string;
    children?: string[];
  }>;
}

export const defaultCategories: CategoryStructure[] = [
  // ==================== RECEITAS ====================
  {
    name: '💵 Receitas',
    type: 'income',
    level: 1,
    children: [
      { name: 'Salário', children: [] },
      { name: 'Freelance', children: [] },
      { name: 'Investimentos', children: [] },
      { name: 'Vendas', children: [] },
      { name: 'Outros', children: [] }
    ]
  },

  // ==================== DESPESAS ====================
  
  // PRIORIDADE 1 — ESSENCIAIS
  {
    name: '🏠 Moradia',
    type: 'expense',
    level: 1,
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
    level: 1,
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
    level: 1,
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

  // PRIORIDADE 2 — COMPROMISSOS FINANCEIROS
  {
    name: '💰 Dívidas',
    type: 'expense',
    level: 1,
    children: [
      { 
        name: 'Cartões de Crédito', 
        children: ['Fatura Nubank', 'Fatura Inter', 'Outros Cartões'] 
      },
      { name: 'Empréstimos', children: [] },
      { name: 'Cheque Especial', children: [] },
      { name: 'Acordos', children: [] },
      { name: 'Refinanciamento', children: [] }
    ]
  },
  {
    name: '🏛️ Impostos',
    type: 'expense',
    level: 1,
    children: [
      { name: 'IPVA', children: [] },
      { name: 'Taxas Bancárias', children: [] },
      { name: 'Multas', children: [] },
      { name: 'Tarifas de Serviços', children: [] }
    ]
  },

  // PRIORIDADE 3 — FUNCIONAMENTO DA VIDA
  {
    name: '🚗 Transporte',
    type: 'expense',
    level: 1,
    children: [
      { 
        name: 'Carro', 
        children: ['Combustível', 'Manutenção', 'Documentação', 'IPVA', 'Seguro', 'Parcelas do Carro'] 
      },
      { 
        name: 'Moto', 
        children: ['Combustível', 'Manutenção', 'Documentação', 'IPVA', 'Seguro', 'Parcelas da Moto'] 
      },
      { name: 'Transporte Público', children: [] },
      { name: 'Uber / Táxi', children: [] },
      { name: 'Estacionamento', children: [] },
      { name: 'Pedágio', children: [] }
    ]
  },
  {
    name: '💼 Trabalho',
    type: 'expense',
    level: 1,
    children: [
      { name: 'Ferramentas', children: [] },
      { name: 'Uniformes', children: [] },
      { name: 'Cursos Profissionais', children: [] },
      { name: 'Gastos com Clientes', children: [] },
      { name: 'Documentação Profissional', children: [] }
    ]
  },
  {
    name: '🎓 Educação',
    type: 'expense',
    level: 1,
    children: [
      { name: 'Escola / Faculdade', children: [] },
      { name: 'Cursos', children: [] },
      { name: 'Livros / Materiais', children: [] },
      { name: 'Pós / Especialização', children: [] }
    ]
  },

  // PRIORIDADE 4 — QUALIDADE DE VIDA
  {
    name: '👨‍👩‍👧 Família',
    type: 'expense',
    level: 1,
    children: [
      { name: 'Filhos', children: ['Escola', 'Roupas', 'Presentes', 'Outros'] },
      { name: 'Animais de Estimação', children: ['Ração', 'Veterinário', 'Banho & Tosa'] },
      { name: 'Pais / Avós', children: [] }
    ]
  },
  {
    name: '💅 Beleza e Saúde',
    type: 'expense',
    level: 1,
    children: [
      { name: 'Cosméticos', children: [] },
      { name: 'Maquiagem', children: [] },
      { name: 'Perfumaria', children: [] },
      { name: 'Cabeleireiro / Salão', children: [] },
      { name: 'Manicure / Pedicure', children: [] },
      { name: 'Tratamentos Estéticos', children: [] },
      { name: 'Spa / Massagem', children: [] },
      { name: 'Academia', children: [] }
    ]
  },
  {
    name: '👕 Vestuário',
    type: 'expense',
    level: 1,
    children: [
      { name: 'Roupas', children: [] },
      { name: 'Calçados', children: [] },
      { name: 'Acessórios', children: [] },
      { name: 'Lavanderia', children: [] }
    ]
  },

  // PRIORIDADE 5 — SUPÉRFLUOS
  {
    name: '🎮 Lazer',
    type: 'expense',
    level: 1,
    children: [
      { name: 'Cinema', children: [] },
      { name: 'Viagens', children: [] },
      { name: 'Bares / Restaurantes', children: [] },
      { name: 'Streaming / Assinaturas', children: [] },
      { name: 'Presentes', children: [] },
      { name: 'Hobbies', children: ['Games', 'Música', 'Esportes'] }
    ]
  },

  // PRIORIDADE 6 — GASTOS DE RISCO (VÍCIOS)
  {
    name: '🚬 Vícios',
    type: 'expense',
    level: 1,
    children: [
      { name: 'Cigarro', children: [] },
      { name: 'Bebida', children: [] },
      { name: 'Jogos / Apostas', children: [] },
      { name: 'Doces / Chocolates (Excesso)', children: [] },
      { name: 'Delivery Excessivo', children: ['iFood'] }
    ]
  },
  {
    name: '💸 Impulso Financeiro',
    type: 'expense',
    level: 1,
    children: [
      { name: 'Compras Sem Planejamento', children: [] },
      { name: 'Gastos Repentinos', children: [] },
      { name: 'Compras Emocionais', children: [] }
    ]
  },

  // PRIORIDADE 7 — METAS E FUTURO
  {
    name: '📈 Investimentos',
    type: 'expense',
    level: 1,
    children: [
      { name: 'Reserva de Emergência', children: [] },
      { name: 'Renda Fixa', children: [] },
      { name: 'Ações', children: [] },
      { name: 'Fundos', children: [] },
      { name: 'Cripto', children: [] },
      { name: 'Previdência', children: [] }
    ]
  },
  {
    name: '🎯 Metas Financeiras',
    type: 'expense',
    level: 1,
    children: [
      { name: 'Comprar Carro', children: [] },
      { name: 'Comprar Casa', children: [] },
      { name: 'Quitar Dívidas', children: [] },
      { name: 'Viagem', children: [] },
      { name: 'Casamento', children: [] },
      { name: 'Estudos', children: [] },
      { name: 'Reserva Financeira', children: [] }
    ]
  }
];

/**
 * Cria as categorias padrão para um tenant
 */
export async function createDefaultCategories(tenantId: string): Promise<void> {
  log.info('Criando categorias padrão', { tenantId });
  
  let totalCreated = 0;

  for (const category of defaultCategories) {
    // Criar categoria pai (nível 1)
    const parentCategory = await prisma.category.create({
      data: {
        tenantId,
        name: category.name,
        type: category.type,
        level: 1,
        isActive: true,
      },
    });
    totalCreated++;

    // Criar categorias filhas (nível 2) e netas (nível 3)
    if (category.children) {
      for (const child of category.children) {
        const childCategory = await prisma.category.create({
          data: {
            tenantId,
            name: child.name,
            type: category.type,
            level: 2,
            parentId: parentCategory.id,
            isActive: true,
          },
        });
        totalCreated++;

        // Criar categorias netas (nível 3)
        if (child.children && child.children.length > 0) {
          for (const grandchild of child.children) {
            await prisma.category.create({
              data: {
                tenantId,
                name: grandchild,
                type: category.type,
                level: 3,
                parentId: childCategory.id,
                isActive: true,
              },
            });
            totalCreated++;
          }
        }
      }
    }
  }

  log.info('Categorias padrão criadas', { totalCreated });
}
