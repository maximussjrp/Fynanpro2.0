/**
 * Cache Service - Redis Caching Layer
 * Implementa caching com TTL configurável e invalidação por padrões
 */

import Redis from 'ioredis';
import { log } from '../utils/logger';

export class CacheService {
  private redis: Redis | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Inicializa conexão com Redis
   */
  private initialize() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            log.warn('Redis: Máximo de tentativas atingido');
            return null;
          }
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        log.info('Redis conectado com sucesso');
        this.isEnabled = true;
      });

      this.redis.on('error', (error) => {
        log.warn('Redis error (cache desabilitado)', { error: error.message });
        this.isEnabled = false;
      });

      this.redis.on('close', () => {
        log.warn('Redis conexão fechada');
        this.isEnabled = false;
      });

      // Tentar conectar (não bloqueia se falhar)
      this.redis.connect().catch((error) => {
        log.warn('Redis indisponível, continuando sem cache', { error: error.message });
        this.isEnabled = false;
      });
    } catch (error) {
      log.warn('Erro ao inicializar Redis, cache desabilitado', { error });
      this.isEnabled = false;
    }
  }

  /**
   * Gera chave única para cache
   */
  private generateKey(namespace: string, key: string): string {
    return `fynanpro:${namespace}:${key}`;
  }

  /**
   * Buscar valor do cache
   */
  async get<T>(namespace: string, key: string): Promise<T | null> {
    if (!this.isEnabled || !this.redis) {
      return null;
    }

    try {
      const cacheKey = this.generateKey(namespace, key);
      const data = await this.redis.get(cacheKey);
      
      if (!data) {
        return null;
      }

      return JSON.parse(data) as T;
    } catch (error) {
      log.error('Cache get error', { namespace, key, error });
      return null;
    }
  }

  /**
   * Armazenar valor no cache com TTL
   * @param ttl - Tempo de vida em segundos (default: 300s = 5min)
   */
  async set(namespace: string, key: string, value: any, ttl: number = 300): Promise<boolean> {
    if (!this.isEnabled || !this.redis) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(namespace, key);
      const data = JSON.stringify(value);
      
      await this.redis.setex(cacheKey, ttl, data);
      return true;
    } catch (error) {
      log.error('Cache set error', { namespace, key, error });
      return false;
    }
  }

  /**
   * Deletar chave específica do cache
   */
  async delete(namespace: string, key: string): Promise<boolean> {
    if (!this.isEnabled || !this.redis) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(namespace, key);
      await this.redis.del(cacheKey);
      return true;
    } catch (error) {
      log.error('Cache delete error', { namespace, key, error });
      return false;
    }
  }

  /**
   * Invalidar todas as chaves de um namespace
   */
  async invalidateNamespace(namespace: string): Promise<boolean> {
    if (!this.isEnabled || !this.redis) {
      return false;
    }

    try {
      const pattern = `fynanpro:${namespace}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        log.info('Cache namespace invalidado', { namespace, keysDeleted: keys.length });
      }
      
      return true;
    } catch (error) {
      log.error('Cache invalidate namespace error', { namespace, error });
      return false;
    }
  }

  /**
   * Invalidar múltiplos namespaces (útil após operações de escrita)
   */
  async invalidateMultiple(namespaces: string[]): Promise<void> {
    if (!this.isEnabled || !this.redis) {
      return;
    }

    await Promise.all(
      namespaces.map(ns => this.invalidateNamespace(ns))
    );
  }

  /**
   * Limpar todo o cache (usar com cuidado)
   */
  async flush(): Promise<boolean> {
    if (!this.isEnabled || !this.redis) {
      return false;
    }

    try {
      await this.redis.flushdb();
      log.warn('Cache completamente limpo');
      return true;
    } catch (error) {
      log.error('Cache flush error', { error });
      return false;
    }
  }

  /**
   * Verificar se Redis está disponível
   */
  isAvailable(): boolean {
    return this.isEnabled && this.redis !== null;
  }

  /**
   * Desconectar do Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.isEnabled = false;
      log.info('Redis desconectado');
    }
  }

  /**
   * Helper: Cache com fallback automático
   * Se cache não existir, executa função e armazena resultado
   */
  async getOrSet<T>(
    namespace: string,
    key: string,
    fn: () => Promise<T>,
    ttl: number = 300
  ): Promise<T> {
    // Tentar buscar do cache
    const cached = await this.get<T>(namespace, key);
    if (cached !== null) {
      return cached;
    }

    // Se não existe, executar função e cachear
    const result = await fn();
    await this.set(namespace, key, result, ttl);
    return result;
  }
}

// Singleton instance
export const cacheService = new CacheService();

// TTL padrões (em segundos)
export const CacheTTL = {
  DASHBOARD: 300,      // 5 minutos
  CATEGORIES: 3600,    // 1 hora
  BUDGETS: 900,        // 15 minutos
  REPORTS: 600,        // 10 minutos
  TRANSACTIONS: 180,   // 3 minutos
  ACCOUNTS: 600,       // 10 minutos
} as const;

// Namespaces para organização
export const CacheNamespace = {
  DASHBOARD: 'dashboard',
  CATEGORIES: 'categories',
  BUDGETS: 'budgets',
  REPORTS: 'reports',
  TRANSACTIONS: 'transactions',
  ACCOUNTS: 'accounts',
} as const;
