Você é o engenheiro principal responsável por implementar a evolução do sistema UTOP em produção.

Você já possui um plano de arquitetura validado.

Sua missão agora é EXECUTAR TODAS AS FASES DE IMPLEMENTAÇÃO com as seguintes regras:

━━━━━━━━━━━━━━━━━━━━━━━
🎯 OBJETIVO
━━━━━━━━━━━━━━━━━━━━━━━

Implementar:

* Consultores (ConsultantProfile + gestão de clientes)
* Rede MLM (ReferralTree + CommissionEvent + Commission)
* Educação (Course + Enrollment + Certificate)

SEM QUEBRAR:

* sistema atual
* rotas existentes
* autenticação
* banco de dados em produção

━━━━━━━━━━━━━━━━━━━━━━━
⚠️ REGRAS CRÍTICAS
━━━━━━━━━━━━━━━━━━━━━━━

1. NUNCA implemente tudo de uma vez
2. Trabalhe obrigatoriamente por fases
3. Cada fase deve:

   * ser isolada
   * ser deployável
   * não quebrar produção
4. Sempre validar antes de avançar
5. Usar feature flags para tudo novo
6. NUNCA alterar comportamento existente
7. Sempre manter backward compatibility

━━━━━━━━━━━━━━━━━━━━━━━
📌 FLUXO DE EXECUÇÃO OBRIGATÓRIO
━━━━━━━━━━━━━━━━━━━━━━━

Para CADA fase, siga exatamente este ciclo:

1. PLANEJAMENTO DA FASE
2. ALTERAÇÕES NECESSÁRIAS
3. RISCOS
4. CHECKLIST DE VALIDAÇÃO
5. EXECUÇÃO (código)
6. TESTES
7. RESULTADO FINAL

NÃO avance para próxima fase sem concluir todas as etapas.

━━━━━━━━━━━━━━━━━━━━━━━
🧱 FASE 0 — PRÉ-REQUISITOS
━━━━━━━━━━━━━━━━━━━━━━━

Implementar:

* verificação de backup do banco
* validação de migrations
* checagem de ambiente (env)

ENTREGAR:

* diagnóstico do ambiente
* lista de riscos antes de iniciar

NÃO escrever código ainda — apenas validação.

━━━━━━━━━━━━━━━━━━━━━━━
🧱 FASE 1 — BASE (SCHEMA + AUTH)
━━━━━━━━━━━━━━━━━━━━━━━

Implementar:

* novos enums (UserRole, TenantType, CommissionType, etc)
* novos models:

  * ConsultantProfile
  * ClientProfile
* extensão de User e Tenant (campos opcionais apenas)
* JWT com activeTenantId (fallback obrigatório)
* endpoint: POST /auth/switch-tenant
* middleware RBAC (NÃO aplicado nas rotas antigas)

REGRAS:

* NÃO remover nada existente
* NÃO alterar lógica atual de login
* tudo deve ser opcional

VALIDAÇÃO:

* usuários atuais continuam funcionando
* login não quebra
* rotas antigas intactas

━━━━━━━━━━━━━━━━━━━━━━━
🧱 FASE 2 — CONSULTOR
━━━━━━━━━━━━━━━━━━━━━━━

Implementar:

* módulo /consultant
* módulo /consultant/clients
* criação de ConsultantProfile
* relação consultor ↔ cliente via ClientProfile (fonte única)
* acesso a múltiplos tenants (tenant switching seguro)

REGRAS IMPORTANTES:

* validar acesso ao tenant SEMPRE via TenantUser
* cliente NÃO pode ver nada do consultor
* usar feature flag: consultant.enabled

VALIDAÇÃO:

* cliente atual não percebe mudança
* consultor consegue acessar múltiplos clientes
* acesso indevido é bloqueado

━━━━━━━━━━━━━━━━━━━━━━━
🧱 FASE 3 — MLM (REDE + COMISSÕES)
━━━━━━━━━━━━━━━━━━━━━━━

Implementar:

* User.sponsorId (árvore base)
* ReferralTree (materializada)
* CommissionEvent (imutável)
* Commission (projeção)
* commission-engine (serviço)

REGRAS CRÍTICAS:

* idempotência obrigatória (externalRef único)
* proteção contra concorrência
* NÃO duplicar comissão
* NÃO deletar eventos (apenas cancelar)

REGRAS DE NEGÓCIO:

* consultor só ganha se:

  * isActive = true
  * mensalidade em dia
  * mínimo de clientes ativos (ex: 3)

STATUS:

* PENDING
* HOLD
* APPROVED
* PAID

VALIDAÇÃO:

* evento duplicado não gera duplicidade
* consultor inativo não recebe
* cálculo de níveis correto

feature flag: mlm.enabled

━━━━━━━━━━━━━━━━━━━━━━━
🧱 FASE 4 — EDUCAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━

Implementar:

* Course
* CourseModule
* Lesson
* Enrollment
* LessonProgress
* Certificate

REGRAS:

* vídeos NÃO armazenados no backend (usar URL externa)
* certificado gerado automaticamente
* código de validação único

VALIDAÇÃO:

* progresso funciona
* certificado gerado corretamente
* endpoint público de validação

feature flag: education.enabled

━━━━━━━━━━━━━━━━━━━━━━━
🧱 FASE 5 — INTEGRAÇÃO FINAL
━━━━━━━━━━━━━━━━━━━━━━━

Implementar:

* integração entre:

  * consultor
  * MLM
  * educação
* certificação libera consultor
* comissões ligadas ao sistema

VALIDAÇÃO:

* fluxo completo funciona:
  consultor → cliente → pagamento → comissão

━━━━━━━━━━━━━━━━━━━━━━━
🧱 FASE 6 — HARDENING
━━━━━━━━━━━━━━━━━━━━━━━

Implementar:

* validação de segurança
* logs críticos
* proteção contra acesso indevido
* verificação de performance

━━━━━━━━━━━━━━━━━━━━━━━
📊 FORMATO DE RESPOSTA (OBRIGATÓRIO)
━━━━━━━━━━━━━━━━━━━━━━━

Para cada fase, responder:

## FASE X — NOME

### 1. O que será feito

### 2. Alterações técnicas

### 3. Código implementado

### 4. Riscos

### 5. Testes realizados

### 6. Resultado

━━━━━━━━━━━━━━━━━━━━━━━
⚠️ REGRAS FINAIS
━━━━━━━━━━━━━━━━━━━━━━━

* NÃO pular fases
* NÃO assumir que algo está funcionando
* NÃO fazer refatoração desnecessária
* NÃO alterar código legado sem motivo crítico

Se encontrar problema estrutural:

* parar
* explicar
* propor solução antes de continuar

━━━━━━━━━━━━━━━━━━━━━━━
🎯 OBJETIVO FINAL
━━━━━━━━━━━━━━━━━━━━━━━

Transformar o sistema em:

PLATAFORMA COMPLETA DE CONSULTORES FINANCEIROS

com:

* clientes
* consultores
* rede MLM
* educação

sem reescrever o sistema do zero.

Execute agora iniciando pela FASE 0.
