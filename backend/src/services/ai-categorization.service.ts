/**
 * AI Categorization Service
 * Utiliza Google Gemini para sugerir categorias automaticamente
 * 
 * Tier gratuito do Gemini:
 * - Gemini 2.5 Flash-Lite: Gratuito para uso standard
 * - Ideal para categorização de transações
 */

import { log } from '../utils/logger';
import { prisma } from '../utils/prisma-client';

interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  parentCategoryId?: string;
  parentCategoryName?: string;
  confidence: number;
  reasoning: string;
}

interface SuggestCategoryParams {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  tenantId: string;
}

// Cache simples em memória para categorias do tenant
const categoryCache = new Map<string, { categories: any[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export class AiCategorizationService {
  private apiKey: string | undefined;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  private model = 'gemini-2.5-flash-lite'; // Modelo gratuito

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      log.warn('GEMINI_API_KEY não configurada - categorização automática desabilitada');
    }
  }

  /**
   * Verifica se o serviço está disponível
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Busca categorias do tenant com cache
   */
  private async getTenantCategories(tenantId: string, type: 'income' | 'expense'): Promise<any[]> {
    const cacheKey = `${tenantId}:${type}`;
    const cached = categoryCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.categories;
    }

    const categories = await prisma.category.findMany({
      where: {
        tenantId,
        type,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        parentId: true,
        level: true,
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { level: 'asc' },
        { name: 'asc' },
      ],
    });

    categoryCache.set(cacheKey, { categories, timestamp: Date.now() });
    return categories;
  }

  /**
   * Formata categorias para o prompt
   */
  private formatCategoriesForPrompt(categories: any[]): string {
    const formatted: string[] = [];
    
    // Agrupar por parent
    const level1 = categories.filter(c => c.level === 1);
    
    for (const parent of level1) {
      const children = categories.filter(c => c.parentId === parent.id);
      if (children.length > 0) {
        formatted.push(`${parent.name}: ${children.map(c => c.name).join(', ')}`);
      } else {
        formatted.push(parent.name);
      }
    }
    
    return formatted.join('\n');
  }

  /**
   * Sugere categoria baseado na descrição da transação
   */
  async suggestCategory(params: SuggestCategoryParams): Promise<CategorySuggestion | null> {
    if (!this.isAvailable()) {
      log.warn('AI Categorization não disponível - GEMINI_API_KEY não configurada');
      return null;
    }

    try {
      const { description, amount, type, tenantId } = params;

      // Buscar categorias do tenant
      const categories = await this.getTenantCategories(tenantId, type);
      
      if (categories.length === 0) {
        log.warn('Nenhuma categoria encontrada para o tenant', { tenantId, type });
        return null;
      }

      // Preparar lista de categorias para o prompt
      const categoryList = this.formatCategoriesForPrompt(categories);
      
      // Montar prompt
      const prompt = `Você é um assistente financeiro especializado em categorização de transações.

TAREFA: Classifique a transação abaixo na categoria mais apropriada.

TRANSAÇÃO:
- Descrição: "${description}"
- Valor: R$ ${Math.abs(amount).toFixed(2)}
- Tipo: ${type === 'income' ? 'Receita' : 'Despesa'}

CATEGORIAS DISPONÍVEIS (${type === 'income' ? 'Receitas' : 'Despesas'}):
${categoryList}

INSTRUÇÕES:
1. Analise a descrição da transação
2. Identifique palavras-chave (nome de estabelecimento, tipo de serviço, etc.)
3. Escolha a categoria mais específica possível (subcategoria se houver)
4. Se não tiver certeza, escolha a categoria pai mais provável

RESPONDA EXATAMENTE NO FORMATO JSON:
{
  "categoryName": "Nome exato da categoria escolhida",
  "parentCategoryName": "Nome da categoria pai (se for subcategoria)" ou null,
  "confidence": 0.0 a 1.0,
  "reasoning": "Breve explicação da escolha"
}

Apenas o JSON, sem texto adicional.`;

      // Chamar API do Gemini
      const response = await fetch(
        `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt,
              }],
            }],
            generationConfig: {
              temperature: 0.2, // Baixa temperatura para respostas mais consistentes
              maxOutputTokens: 256,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        log.error('Erro na API Gemini', { status: response.status, error: errorText });
        return null;
      }

      const data = await response.json();
      
      // Extrair texto da resposta
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!responseText) {
        log.error('Resposta vazia do Gemini', { data });
        return null;
      }

      // Parse do JSON da resposta
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        log.error('Não foi possível extrair JSON da resposta', { responseText });
        return null;
      }

      const suggestion = JSON.parse(jsonMatch[0]);

      // Encontrar categoria correspondente
      let matchedCategory = categories.find(
        c => c.name.toLowerCase() === suggestion.categoryName?.toLowerCase()
      );

      // Se não encontrou diretamente, tentar busca parcial
      if (!matchedCategory && suggestion.categoryName) {
        matchedCategory = categories.find(
          c => c.name.toLowerCase().includes(suggestion.categoryName.toLowerCase()) ||
               suggestion.categoryName.toLowerCase().includes(c.name.toLowerCase())
        );
      }

      // Se ainda não encontrou, tentar pela categoria pai
      if (!matchedCategory && suggestion.parentCategoryName) {
        const parent = categories.find(
          c => c.name.toLowerCase() === suggestion.parentCategoryName?.toLowerCase() && c.level === 1
        );
        if (parent) {
          matchedCategory = parent;
        }
      }

      if (!matchedCategory) {
        log.warn('Categoria sugerida não encontrada', { suggestion, tenantId });
        // Retornar primeira categoria como fallback
        matchedCategory = categories.find(c => c.level === 1) || categories[0];
        suggestion.confidence = 0.3;
        suggestion.reasoning = 'Categoria padrão (sugestão não encontrada)';
      }

      return {
        categoryId: matchedCategory.id,
        categoryName: matchedCategory.name,
        parentCategoryId: matchedCategory.parent?.id,
        parentCategoryName: matchedCategory.parent?.name,
        confidence: Math.min(1, Math.max(0, suggestion.confidence || 0.5)),
        reasoning: suggestion.reasoning || 'Categorizado automaticamente',
      };

    } catch (error) {
      log.error('Erro ao sugerir categoria', { error, params });
      return null;
    }
  }

  /**
   * Sugere categorias para múltiplas transações (batch)
   */
  async suggestCategoriesBatch(
    transactions: Array<{ description: string; amount: number; type: 'income' | 'expense' }>,
    tenantId: string
  ): Promise<Map<number, CategorySuggestion | null>> {
    const results = new Map<number, CategorySuggestion | null>();

    // Processar em paralelo com limite de concorrência
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);
      const promises = batch.map((tx, index) =>
        this.suggestCategory({
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          tenantId,
        }).then(result => ({ index: i + index, result }))
      );

      const batchResults = await Promise.all(promises);
      
      for (const { index, result } of batchResults) {
        results.set(index, result);
      }

      // Pequeno delay entre batches para não sobrecarregar API
      if (i + BATCH_SIZE < transactions.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Limpa cache de categorias
   */
  clearCache(tenantId?: string): void {
    if (tenantId) {
      categoryCache.delete(`${tenantId}:income`);
      categoryCache.delete(`${tenantId}:expense`);
    } else {
      categoryCache.clear();
    }
  }
}

// Singleton
export const aiCategorizationService = new AiCategorizationService();
