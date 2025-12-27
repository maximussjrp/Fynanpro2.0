// Script para adicionar CategorySemantics ao banco de dados
// Este script:
// 1. Adiciona o modelo ao schema.prisma
// 2. Roda a migration
// 3. Popula dados iniciais com pattern matching

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

// Padrões semânticos para classificação automática
const SEMANTIC_PATTERNS = {
  // Sobrevivência (gastos essenciais fixos)
  survival: {
    patterns: [
      'aluguel', 'condomínio', 'condominio', 'luz', 'energia', 'água', 'agua',
      'gás', 'gas', 'internet', 'telefone', 'plano de saúde', 'plano de saude',
      'seguro', 'iptu', 'ipva', 'escola', 'faculdade', 'mensalidade',
      'financiamento', 'prestação', 'prestacao', 'moradia', 'habitação'
    ],
    weights: { generated: 0, survival: 1.0, choice: 0, future: 0, loss: 0 },
    isFixed: true,
    isEssential: true
  },
  
  // Híbridos Sobrevivência/Escolha
  survivalChoice: {
    patterns: [
      'alimentação', 'alimentacao', 'supermercado', 'mercado', 'farmácia', 'farmacia',
      'combustível', 'combustivel', 'gasolina', 'transporte', 'ônibus', 'onibus',
      'metrô', 'metro', 'celular', 'saúde', 'saude', 'médico', 'medico'
    ],
    weights: { generated: 0, survival: 0.6, choice: 0.4, future: 0, loss: 0 },
    isFixed: false,
    isEssential: true
  },
  
  // Escolha (lifestyle)
  choice: {
    patterns: [
      'lazer', 'restaurante', 'ifood', 'uber', 'uber eats', '99', 'streaming',
      'netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'roupa', 'vestuário',
      'vestuario', 'viagem', 'hotel', 'festa', 'bar', 'balada', 'cinema',
      'teatro', 'show', 'evento', 'presente', 'hobby', 'esporte', 'academia',
      'assinatura', 'delivery', 'lanche', 'café', 'cafe', 'pet', 'animal',
      'beleza', 'salão', 'salao', 'estética', 'estetica', 'cosméticos', 'cosmeticos'
    ],
    weights: { generated: 0, survival: 0, choice: 1.0, future: 0, loss: 0 },
    isFixed: false,
    isEssential: false
  },
  
  // Futuro (investimentos)
  future: {
    patterns: [
      'investimento', 'poupança', 'poupanca', 'previdência', 'previdencia',
      'tesouro', 'ação', 'acao', 'fundo', 'criptomoeda', 'cripto', 'bitcoin',
      'reserva', 'aplicação', 'aplicacao', 'cdb', 'lci', 'lca', 'debenture',
      'fii', 'etf', 'renda fixa', 'renda variável', 'renda variavel'
    ],
    weights: { generated: 0, survival: 0, choice: 0, future: 1.0, loss: 0 },
    isFixed: false,
    isEssential: false,
    isInvestment: true
  },
  
  // Perdas
  loss: {
    patterns: [
      'juros', 'multa', 'taxa', 'tarifa bancária', 'tarifa bancaria', 'iof',
      'cancelamento', 'perda', 'roubo', 'furto', 'anuidade', 'encargo',
      'mora', 'atraso', 'cheque especial', 'rotativo'
    ],
    weights: { generated: 0, survival: 0, choice: 0, future: 0, loss: 1.0 },
    isFixed: false,
    isEssential: false
  }
};

async function classifyCategory(category) {
  const name = category.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Se for receita, é 100% energia gerada
  if (category.type === 'income') {
    return {
      weights: { generated: 1.0, survival: 0, choice: 0, future: 0, loss: 0 },
      isFixed: false,
      isEssential: false,
      isInvestment: false
    };
  }
  
  // Testar padrões para despesas
  for (const [type, config] of Object.entries(SEMANTIC_PATTERNS)) {
    for (const pattern of config.patterns) {
      const normalizedPattern = pattern.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (name.includes(normalizedPattern)) {
        return {
          weights: config.weights,
          isFixed: config.isFixed || false,
          isEssential: config.isEssential || false,
          isInvestment: config.isInvestment || false
        };
      }
    }
  }
  
  // Default: 50% sobrevivência, 50% escolha (quando não identificado)
  return {
    weights: { generated: 0, survival: 0.5, choice: 0.5, future: 0, loss: 0 },
    isFixed: false,
    isEssential: false,
    isInvestment: false
  };
}

async function main() {
  console.log('🧠 Iniciando setup de CategorySemantics...\n');
  
  // Verificar se tabela já existe
  const tableExists = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'CategorySemantics'
    );
  `;
  
  if (!tableExists[0].exists) {
    console.log('📊 Criando tabela CategorySemantics...');
    
    // Criar tabela diretamente com SQL
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "CategorySemantics" (
        "id" TEXT NOT NULL,
        "categoryId" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "generatedWeight" DECIMAL(5,4) NOT NULL DEFAULT 0,
        "survivalWeight" DECIMAL(5,4) NOT NULL DEFAULT 0,
        "choiceWeight" DECIMAL(5,4) NOT NULL DEFAULT 0,
        "futureWeight" DECIMAL(5,4) NOT NULL DEFAULT 0,
        "lossWeight" DECIMAL(5,4) NOT NULL DEFAULT 0,
        "isFixed" BOOLEAN NOT NULL DEFAULT false,
        "isEssential" BOOLEAN NOT NULL DEFAULT false,
        "isInvestment" BOOLEAN NOT NULL DEFAULT false,
        "autoClassified" BOOLEAN NOT NULL DEFAULT true,
        "userOverride" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "CategorySemantics_pkey" PRIMARY KEY ("id")
      );
    `;
    
    // Criar índices
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "CategorySemantics_categoryId_tenantId_key" 
      ON "CategorySemantics"("categoryId", "tenantId");
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "CategorySemantics_tenantId_idx" 
      ON "CategorySemantics"("tenantId");
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "CategorySemantics_categoryId_idx" 
      ON "CategorySemantics"("categoryId");
    `;
    
    // Foreign keys
    await prisma.$executeRaw`
      ALTER TABLE "CategorySemantics" 
      ADD CONSTRAINT "CategorySemantics_categoryId_fkey" 
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `;
    
    await prisma.$executeRaw`
      ALTER TABLE "CategorySemantics" 
      ADD CONSTRAINT "CategorySemantics_tenantId_fkey" 
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `;
    
    console.log('✅ Tabela CategorySemantics criada!\n');
  } else {
    console.log('ℹ️  Tabela CategorySemantics já existe.\n');
  }
  
  // Buscar todas as categorias
  console.log('📂 Buscando categorias para classificar...');
  const categories = await prisma.category.findMany({
    where: { deletedAt: null }
  });
  
  console.log(`   Encontradas ${categories.length} categorias.\n`);
  
  // Classificar cada categoria
  let created = 0;
  let updated = 0;
  let skipped = 0;
  
  for (const category of categories) {
    const classification = await classifyCategory(category);
    
    // Verificar se já existe
    const existing = await prisma.$queryRaw`
      SELECT id FROM "CategorySemantics" 
      WHERE "categoryId" = ${category.id} AND "tenantId" = ${category.tenantId}
    `;
    
    if (existing.length > 0) {
      // Se existe e foi classificado pelo usuário, não alterar
      const current = await prisma.$queryRaw`
        SELECT "userOverride" FROM "CategorySemantics" 
        WHERE id = ${existing[0].id}
      `;
      
      if (current[0]?.userOverride) {
        skipped++;
        continue;
      }
      
      // Atualizar
      await prisma.$executeRaw`
        UPDATE "CategorySemantics" SET
          "generatedWeight" = ${classification.weights.generated},
          "survivalWeight" = ${classification.weights.survival},
          "choiceWeight" = ${classification.weights.choice},
          "futureWeight" = ${classification.weights.future},
          "lossWeight" = ${classification.weights.loss},
          "isFixed" = ${classification.isFixed},
          "isEssential" = ${classification.isEssential},
          "isInvestment" = ${classification.isInvestment},
          "updatedAt" = NOW()
        WHERE id = ${existing[0].id}
      `;
      updated++;
    } else {
      // Criar novo
      const id = require('crypto').randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "CategorySemantics" (
          "id", "categoryId", "tenantId",
          "generatedWeight", "survivalWeight", "choiceWeight", "futureWeight", "lossWeight",
          "isFixed", "isEssential", "isInvestment",
          "autoClassified", "userOverride",
          "createdAt", "updatedAt"
        ) VALUES (
          ${id}, ${category.id}, ${category.tenantId},
          ${classification.weights.generated}, ${classification.weights.survival}, 
          ${classification.weights.choice}, ${classification.weights.future}, ${classification.weights.loss},
          ${classification.isFixed}, ${classification.isEssential}, ${classification.isInvestment},
          true, false,
          NOW(), NOW()
        )
      `;
      created++;
    }
  }
  
  console.log('📊 Resultado da classificação:');
  console.log(`   ✅ Criados: ${created}`);
  console.log(`   🔄 Atualizados: ${updated}`);
  console.log(`   ⏭️  Pulados (override): ${skipped}`);
  
  // Mostrar resumo
  const summary = await prisma.$queryRaw`
    SELECT 
      CASE 
        WHEN "generatedWeight" = 1 THEN 'Gerada'
        WHEN "survivalWeight" >= 0.5 THEN 'Sobrevivência'
        WHEN "choiceWeight" >= 0.5 THEN 'Escolha'
        WHEN "futureWeight" >= 0.5 THEN 'Futuro'
        WHEN "lossWeight" >= 0.5 THEN 'Dissipada'
        ELSE 'Híbrido'
      END as energia,
      COUNT(*) as total
    FROM "CategorySemantics"
    GROUP BY 1
    ORDER BY total DESC
  `;
  
  console.log('\n📈 Distribuição por tipo de energia:');
  for (const row of summary) {
    console.log(`   ${row.energia}: ${row.total}`);
  }
  
  console.log('\n✨ Setup completo!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
