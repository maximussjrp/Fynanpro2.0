/**
 * Agent Tool Layer — types
 *
 * Sprint 2: primeira camada de tools reutilizáveis do UTOP. A tool layer é
 * propositalmente enxuta:
 *   - um contrato único (`ToolDefinition`) com schema Zod para input/output
 *   - um contexto de execução isolado (`ToolContext`) que transporta tenantId,
 *     userId e (opcionalmente) os identificadores de atribuição do assistente
 *   - um resultado tipado (`ToolResult`) que discrimina sucesso, erros de
 *     validação, erros de negócio e internos
 *
 * A camada **não** roda regras de negócio por conta própria: ela valida,
 * empacota contexto, delega para services existentes e padroniza o retorno.
 */

import type { z } from 'zod';

/**
 * Contexto de execução de uma tool. Preenchido pelo chamador autenticado
 * (rota HTTP, chatbot, orquestrador futuro). **Nunca** deve vir do input
 * do usuário.
 */
export interface ToolContext {
  tenantId: string;
  userId: string;

  /**
   * Origem lógica da invocação. Para chamadas do chatbot use 'chatbot';
   * para invocações HTTP diretas use 'api'; para chamadas de teste, 'test'.
   * Persistido como metadado de auditoria.
   */
  source: 'chatbot' | 'api' | 'test' | 'system';

  /**
   * Identificadores opcionais para correlação com a conversa que originou
   * a invocação. Quando `source === 'chatbot'` deve-se preencher.
   */
  sessionId?: string | null;
  messageId?: string | null;
  runId?: string | null;

  /**
   * Modo de execução. Quando `dryRun=true`, tools de escrita devem validar
   * e retornar um preview sem persistir.
   */
  dryRun?: boolean;
}

/**
 * Código padronizado de erros retornados pelas tools.
 *
 * - VALIDATION_ERROR: input não passou no schema Zod
 * - NOT_FOUND:        recurso referenciado não existe no tenant
 * - BUSINESS_RULE:    violação de regra de domínio (ex.: categoria de tipo errado)
 * - UNAUTHORIZED:     contexto sem tenantId/userId
 * - CONFIRMATION_REQUIRED: tool precisa de confirmação explícita antes de executar
 * - INTERNAL_ERROR:   falha não prevista (exceção capturada pelo registry)
 */
export type ToolErrorKind =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'BUSINESS_RULE'
  | 'UNAUTHORIZED'
  | 'CONFIRMATION_REQUIRED'
  | 'INTERNAL_ERROR';

export interface ToolSuccess<TOutput> {
  ok: true;
  data: TOutput;
  dryRun?: boolean;
}

export interface ToolFailure {
  ok: false;
  kind: ToolErrorKind;
  code: string;
  message: string;
  details?: unknown;
}

export type ToolResult<TOutput> = ToolSuccess<TOutput> | ToolFailure;

/**
 * Política de confirmação. Tools que alteram estado devem declarar
 * explicitamente se exigem confirmação do usuário antes de executar.
 *
 * - 'none':      executa diretamente
 * - 'soft':      executa, mas retorna preview quando `ctx.dryRun=true`
 * - 'required':  só executa se input trouxer `confirm: true`; caso contrário,
 *                retorna CONFIRMATION_REQUIRED. (Reservado para tools futuras
 *                de alto risco; no Sprint 2 nenhuma tool usa 'required'.)
 */
export type ConfirmationPolicy = 'none' | 'soft' | 'required';

export interface ToolDefinition<
  TInputSchema extends z.ZodTypeAny,
  TOutput,
> {
  /** Identificador único (snake_case). Usado pelo registry e, no futuro, pelo provider LLM. */
  name: string;
  /** Descrição concisa para humanos e (futuramente) para o LLM. */
  description: string;
  /** Natureza da tool: read-only ou write (afeta logging e política). */
  kind: 'read' | 'write';
  /** Schema Zod do input. */
  input: TInputSchema;
  /** Política de confirmação, conforme `ConfirmationPolicy`. */
  confirmation: ConfirmationPolicy;
  /**
   * Executor. Recebe o input já validado e o contexto. Deve retornar um
   * `ToolResult`. Erros inesperados podem ser lançados — o registry captura
   * e converte em `INTERNAL_ERROR`.
   */
  execute: (
    input: z.infer<TInputSchema>,
    ctx: ToolContext,
  ) => Promise<ToolResult<TOutput>>;
}
