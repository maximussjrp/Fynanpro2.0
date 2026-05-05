# UTOP Partners — Roadmap Oficial

> **Status:** plano ativo, baseado em decisões fechadas no questionário de definição (2026-04-25).
> **Substitui:** versão anterior deste arquivo (visão de UX) + `docs/SISTEMA-AFILIADOS.md` + `docs/EMPLEMETAÇÃO-MLM.md` (legados, manter só como referência histórica).
> **Convenção de rollout:** cada fase entra atrás de feature flag (`FF_PARTNERS_*`), default OFF, com janela shadow → canary → full igual ao reconciler/Asaas.

---

## 0. Decisões fechadas (fonte de verdade)

### 0.1 Modelo de negócio
- Entidade única: **Consultor Parceiro UTOP** (revendedor é só vocabulário comercial).
- Cliente final = **PF** (fase 1).
- Oferta principal = **assinatura UTOP**.
- Curso = **gating de elegibilidade** do consultor, não produto para cliente final.
- Funil obrigatório: **comprar curso → concluir formação → ativar assinatura própria → captar clientes**.
- Consultor vende: sistema UTOP (PF) e indica curso para novos consultores.

### 0.2 Rede
- **Profundidade fixa: 3 níveis (N1, N2, N3).** Cap absoluto.
- Patrocínio **imutável** (apenas admin altera, com motivo).
- **Sem compression**: se upline ficar inativo, comissão do nível dele é simplesmente não-paga.
- **Auto-indicação proibida** (mesmo CPF/email/telefone do consultor não pode ser cliente dele).
- Atribuição = **primeira atribuição válida** dentro da janela de referral.
- Consultor sem patrocinador → upline = **raiz institucional UTOP**. Comissões N1/N2/N3 originadas dessa raiz vão para o **cofre da empresa** (não distribuídas, não realocadas para nenhum "consultor casa").
- **Reativação de cliente:** se cliente cancela e volta em **até 12 meses**, mantém atribuição ao consultor original; após 12 meses, fica disponível para nova atribuição.

### 0.3 Matriz de comissão

| Evento | N1 | N2 | N3 |
|---|---|---|---|
| Venda do curso (R$ 700, único) | 50% | 10% | 5% |
| Primeira mensalidade do sistema | 40% | 10% | 5% |
| Mensalidade recorrente do sistema | 40% | 10% | 5% |
| Upgrade de plano | 20% | 5% | 2% |

- Recorrência = **vitalícia** enquanto cliente pagante.
- Mudança de plano (up/down): **prospectiva** (próximo ciclo, sem retroatividade — downgrade reduz comissão no próximo ciclo).
- Hold anti-fraude: **30 dias** após confirmação do pagamento.
- Pagamento: **PIX, lote mensal**, valor mínimo de saque **R$ 100**.
- **SLA fixo:** todo **dia 10 do mês** paga-se tudo que foi aprovado até o **último dia do mês anterior**. Aprovação ocorre em até 7 dias úteis após fim do hold.
- Estorno:
  - em hold → estorno integral, não paga;
  - já paga → vira **saldo negativo** do consultor; **saques ficam travados até o saldo zerar** (UTOP não absorve).

### 0.4 Bloqueios de comissão (qualquer um trava o pagamento)
- consultor inadimplente na própria assinatura;
- consultor não certificado;
- KYC ou dados bancários pendentes;
- suspeita de fraude (admin);
- cliente em disputa / chargeback / reembolso.

### 0.5 Máquinas de estado

**Consultor**
```
pendente_aprovacao → em_formacao → certificado → ativo
ativo ⇄ inadimplente
ativo → suspenso → ativo (admin)
ativo → inativo (voluntário)
* → banido (admin only, motivo obrigatório, log imutável)
```

**Banimento — motivos padronizados (lista fechada):**
- `fraude_comprovada`
- `chargeback_malicioso`
- `falsidade_cadastral`
- `violacao_conduta_grave`
- `manipulacao_rede_ou_comissao`

(Sem gatilho automático: banimento é sempre ato administrativo registrado.)

**Cliente**
```
lead → em_onboarding → ativo
ativo ⇄ em_atraso
ativo → cancelado → churn (após N dias)
```

**Comissão** (sem `prevista` — `prevista` é view calculada, não estado)
```
em_hold → aprovada → paga
em_hold → bloqueada
paga → estornada (somente via chargeback/reembolso)
```

**Formação**
```
nao_iniciada → em_andamento → concluida → certificada
```

### 0.6 Elegibilidade do consultor (todos verdadeiros = `ativo`)
- cadastro aprovado pelo admin;
- formação `certificada`;
- assinatura própria do sistema com pagamento em dia;
- não suspenso, não banido;
- KYC + dados bancários (PIX) preenchidos.

**Fluxo de ativação obrigatório:** `cadastro → docs/KYC → curso → certificação → ativo`. Consultor pode entrar antes da certificação, mas **não recebe comissão** até KYC + certificação completos (a comissão fica `em_hold` até desbloqueio).

### 0.7 Carteira e visibilidade (LGPD)
- Consultor vê **somente clientes próprios** (fase 1; sub-rede só fase 2+).
- Carteira inclui leads, ativos, em atraso, cancelados.
- Consultor **não opera** financeiramente a conta do cliente — apenas acompanha status comercial.
- Campos visíveis ao consultor sobre o cliente: nome, status, progresso de onboarding, métricas operacionais. **Sem CPF, sem dados bancários, sem dados sensíveis.**

### 0.8 Governança
- Aprovação de cadastro de consultor: admin/super master (sem auto-aprovação).
- Aprovação de comissão: **semi-automática** (hold automático + liberação em lote).
- Papéis internos: `super_master`, `admin`, `financeiro`, `suporte`, `comercial_operacao`.
- Ações que **exigem log imutável** (DomainEvent + AuditLog):
  - aprovar/suspender/banir consultor;
  - aprovar/bloquear/estornar comissão;
  - alterar patrocinador;
  - alterar dados bancários;
  - regenerar link público;
  - exportar lista de clientes.

### 0.9 Posicionamento público
- Linguagem comercial: "**Programa de Consultores Parceiros UTOP**" + "indicação com comissionamento multinível limitado a 3 níveis".
- **Não usar publicamente** o termo "MLM"/"marketing multinível" como bandeira.

---

## 1. Domínio canônico

### 1.1 Entidades

| Entidade | Existe hoje? | Decisão |
|---|---|---|
| `ConsultantProfile` | sim (Phase 1A schema) | **manter** — alinhar enums (status/tier desligado na fase 1) |
| `ClientProfile` | sim (Phase 1A schema) | **manter** — alinhar status com 0.5 |
| `ReferralLink` | não | **criar** (slug único, regenerable, audit) |
| `ReferralAttribution` | não | **criar** (cliente ↔ consultor com timestamp + IP/UA, primeira atribuição vence) |
| `SponsorshipEdge` | não | **criar** (consultor → patrocinador, imutável, alterável só por admin) |
| `Course` / `Enrollment` / `Certificate` | não | **criar** (fase 1, mínimo viável: 1 curso, 1 trilha, 1 certificado) |
| `Commission` | não | **criar** (1 linha por evento elegível × beneficiário N1/N2/N3) |
| `CommissionBatch` / `Payout` | não | **criar** (lote mensal PIX) |
| `PartnerAuditLog` | não | **criar** (reuso de `DomainEvent` se possível) |

### 1.2 Origem da comissão
Cada `Commission` referencia exatamente um `PaymentRecord` (já existente em A2A) + um beneficiário + nível N1/N2/N3 + percentual aplicado + valor calculado. Idempotência por `@unique(paymentRecordId, beneficiaryUserId, level)`.

### 1.3 Cálculo "comissão prevista" (view)
- View materializada ou query com `WHERE status IN ('em_hold', 'aprovada')` + projeção de recorrência dos próximos N ciclos com base em `Subscription.currentPeriodEnd`. **Nunca persistir como linha.**

### 1.4 Refinamentos de modelagem (cravados)

1. **`ReferralAttribution.attributionType`** = `client_signup | consultant_signup | manual_admin`. Mesma tabela serve aos dois funis (cliente PF e novo consultor); alvo polimórfico via `targetType` + `targetUserId`. Constraint `@unique(targetType, targetUserId)`.
2. **`SponsorshipEdge` sem `level` persistido.** Verdade primária = `consultantId` + `sponsorConsultantId`. `level` (N1/N2/N3) é derivado em runtime pelo `commission-engine` (recursão limitada a 3 saltos). Se um dia precisar de cache, vira view materializada — nunca fonte de verdade.
3. **`Commission.status` jamais inclui `prevista`.** Comissão prevista = view calculada (§1.3). Engine tem assertion explícita.
4. **`Payout` = 1 consultor × 1 batch** (não por comissão individual). Vínculo obrigatório com `ConsultantWalletEntry` via FK + `reason='payout'`. Ligação comissão↔batch via `CommissionBatchItem`. Reconciliação: `sum(Commission paga em batch X) == Payout.amountCents == abs(WalletEntry payout)`.
5. **Curso mínimo na fase 1:** 1 `Course`, sem módulos/aulas/quizzes persistidos. `Enrollment` com `progressPct` (0–100) + status. `Certificate` emitido em 100%. Expansão para LMS (módulos, lições, quizzes) fica aditiva em fase futura.

---

## 2. Escopo do portal — MVP confirmado

### 2.1 Áreas do MVP (fase 1 do portal)
1. **Dashboard** (orientado por papel, mobile-first)
2. **Onboarding do consultor** (cadastro → docs/KYC → curso → certificado → ativo)
3. **Clientes** (carteira própria + leads + drawer com status)
4. **Comissões** (resumo + extrato; sem exportação avançada na fase 1)
5. **Formação** (player + progresso + certificado)
6. **Suporte** (FAQ + WhatsApp/canal — sem ticket próprio na fase 1)
7. **Rede simples** (tabela com totais N1/N2/N3 + lista de indicados diretos; **sem árvore**)

### 2.2 Fora do MVP
- Materiais como aba dedicada (cabe dentro de Formação na fase 1).
- Ranking, metas, gamificação.
- Múltiplos links/UTM por consultor (na fase 1: **um link único** `utopsistema.com.br/c/{slug}`).
- Visão de sub-rede para "líder".
- Operação financeira da conta do cliente pelo consultor.
- "Agent do consultor".

### 2.3 Top-3 do dashboard (acima da dobra, ordem fixa)
1. **Comissão (em hold + aprovada)** com link para extrato.
2. **Lista priorizada de ações** (leads sem contato, clientes em onboarding parado, formação pendente).
3. **Status de ativação** (formação % + assinatura própria + KYC).

### 2.4 Princípios de UI (mantidos da versão anterior)
- 1 tela = 1 decisão.
- Filtros refletidos na URL.
- Mobile-first.
- Acessibilidade AA.
- Reusar `AppShell`/`Sidebar` existente em `frontend/src/components/` com slot de navegação por role — **não criar shell paralelo**.

### 2.5 Stack
- Mantém `Next.js + TS + Tailwind + shadcn/ui + TanStack Query + RHF + Zod`.
- **Sem zustand** no MVP (URL state + TanStack cobre).
- Estrutura: `app/(partners)/{dashboard,onboarding,clientes,comissoes,formacao,rede,suporte}`.

---

## 3. Roadmap por fases

### 3.0 Gate operacional (regra dura)

| Etapa | Pode iniciar quando |
|---|---|
| Fase 0 (schema + services puros) | **agora** |
| Fase 1 backend (rotas, jobs, engine sem webhook) | **agora** |
| Engine consumindo webhook A2A em **shadow** | A2A C4 live em prod (`FF_ASAAS_*=true`) |
| Portal exibindo comissão real ao consultor | shadow validado por **7 dias** sem incidente |

### Fase 0 — Fundação (pré-requisito; sem UX visível)
**Flag:** `FF_PARTNERS_ENABLED=false`
- Migration aditiva com novas tabelas (atrás da flag).
- RBAC com escopo (`partner_id` em todos os queries do consultor; admin/financeiro/suporte com escopo total).
- `PartnerAuditLog` baseado em `DomainEvent`.
- KYC mínimo (RG/CPF + comprovante de residência + dados bancários PIX).
- Rate-limit dos endpoints públicos `/c/{slug}` (herdar padrão `authLimiter`).
- Smoke test e tsc limpo.
- **Critério de saída:** todas as tabelas criadas, flags OFF em prod, 0 rotas expostas, suite verde.

### Fase 1 — MVP do portal (gera receita real)
**Flag:** `FF_PARTNERS_ENABLED=true`, `FF_PARTNERS_COMMISSION_ENGINE=shadow`
**Bloqueios externos:** **A2A C4 precisa estar live em prod com `FF_ASAAS_*=true`** (sem isso não há `PaymentRecord` real para alimentar comissões).

Inclui:
1. Onboarding completo do consultor (cadastro → docs → curso → cert → ativo).
2. Compra do curso (R$ 700) via Asaas com webhook → `Commission` do curso (50/10/5).
3. Engine de comissão em **modo shadow** primeiro: calcula e grava `Commission` mas não exibe no portal e não paga em lote — só auditoria interna.
4. Dashboard + Clientes + Comissões (read-only) + Formação + Suporte simples + Rede tabela.
5. Link único `/c/{slug}` + `ReferralAttribution` (primeira-atribuição-vence).
6. Lote de pagamento mensal **manual** (admin gera, exporta CSV PIX, marca como `paga`).

**Critério de saída (24h shadow + 7d canary):**
- 0 erros no engine de comissão;
- 100% das `Commission` em shadow batem com cálculo manual de auditoria em 5 amostras;
- 1º consultor real concluiu o ciclo cadastro → curso → certificado → ativo;
- 1ª comissão de curso calculada corretamente;
- todos os logs de ações sensíveis presentes em `PartnerAuditLog`.

### Fase 2 — Recorrência + operação financeira do payout
**Flag:** `FF_PARTNERS_RECURRING_COMMISSION=true`, `FF_PARTNERS_AUTOPAYOUT=shadow`
- Comissão recorrente sobre mensalidade (40/10/5) ligada a cada `PaymentRecord` confirmado.
- Job de geração automática de `CommissionBatch` mensal (gated, shadow primeiro).
- Saque com mínimo R$ 100, integração com PIX via Asaas Transfers ou export CSV (decisão a tomar antes do início da fase).
- Tela de extrato de comissão completa (filtros, exportação).
- Reconciliação mensal: cruzar `Commission` × `PaymentRecord` × `Payout`.
- Política de débito por estorno de comissão paga (regra cravada — ver §6 item 4).

### Fase 3 — Rede e operação avançada
**Flag:** `FF_PARTNERS_NETWORK_VIEW=true`
- Visão de sub-rede para `lider` (papel novo) + filtros por nível.
- Onboarding do cliente com checklist visível ao consultor.
- Score de saúde da carteira (healthScore + riskBand derivados, **não estado persistido**).
- Materiais como módulo dedicado.
- Suporte com ticket próprio (separado do suporte do cliente final).

### Fase 4 — Inteligência e gamificação
**Flag:** múltiplas
- Ranking, metas, campanhas, gamificação.
- Múltiplos links/UTM por consultor.
- Recomendações automáticas de próximo passo no dashboard.
- Trilhas avançadas opcionais e certificações premium.
- Reciclagem periódica (se aplicável a tier elite/master).

### Fase 5 — Operação financeira da conta do cliente
- Consultor com permissão explícita do cliente pode lançar transações/relatórios na conta dele.
- Requer LGPD/contrato específico, fora do escopo deste roadmap detalhado.

---

## 4. Riscos registrados

| # | Risco | Mitigação |
|---|---|---|
| R1 | 40% recorrente vitalício pode comprometer margem em escala | Modelar P&L antes de Fase 2 escalar; manter % flexível em config (não hardcoded) |
| R2 | Primeira comissão demora ~D+45 a D+60 (hold 30 + lote mensal) | Comunicação explícita no onboarding + extrato mostrando "data prevista de pagamento" |
| R3 | Curso R$ 700 com 50% pago + chargeback do curso | Hold de 30 dias cobre chargeback comum; política de débito (§6 item 4) cobre o resto |
| R4 | Posicionamento como MLM = risco regulatório/reputacional | Linguagem pública em 0.9; revisão jurídica antes do go-live |
| R5 | Sem compression = consultor pode perder N2/N3 sem entender | Extrato precisa mostrar **motivo** quando comissão = 0 ("upline inativo") |
| R6 | LGPD: consultor vendo dados de cliente | Backend filtra campos antes de serializar; cobertura por testes |
| R7 | Engine de comissão em produção sem A2A live | Fase 1 só após A2A com webhook funcionando em prod |

---

## 5. Métricas (KPIs por papel)

**Consultor:** clientes ativos, leads do mês, conversão lead→cliente, comissão em hold, comissão aprovada, comissão paga, % formação, dias até 1º cliente, dias até 1ª comissão.

**Líder (fase 3+):** ativos por nível, conversão da rede, receita gerada pela rede, parceiros em risco, formação média da rede, parceiros sem ativação.

**Admin:** ativação, retenção, ticket médio por consultor, tempo até certificação, taxa de comissão bloqueada (com motivo), volume mensal de payout, taxa de chargeback que vira débito.

---

## 6. Itens em aberto

| # | Item | Status | Fase |
|---|---|---|---|
| 1 | NF / PJ / MEI do consultor + teto de receita | **EM ABERTO** | Fase 2 (formalizar com contábil) |

Todos os demais itens originalmente em aberto foram fechados em 2026-04-25 e estão consolidados em §0.

---

## 7. Próximos passos imediatos

1. **Validar legalmente** o programa (linguagem pública + contrato do consultor + LGPD).
2. **Aguardar A2A C4 em produção** com `FF_ASAAS_*=true` (hoje OFF). Sem webhook real, a engine de comissão fica só em ambiente de validação.
3. **Schema delta da Fase 0** — produzir proposta detalhada de migration aditiva (tabelas novas atrás de `FF_PARTNERS_ENABLED`).
4. **Wireframe** do dashboard + onboarding do consultor antes de qualquer linha de UI.
