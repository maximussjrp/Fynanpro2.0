# Sprint B Comercial — Trial → Pago (gateway único: Asaas)

> **Status:** entregue. **Decisão arquitetural:** UTOP adota **Asaas** como gateway único de pagamento. Stripe permanece no código como rotas dormentes (`/subscription/stripe/*`) mas o frontend não as consome mais.

---

## 1. O que foi feito

- Criado serviço `BillingSummaryService` com models reais (`Subscription`, `PaymentRecord`, `Tenant`).
- Novo endpoint `GET /subscription/billing-summary` consolidando plano, trial, subscription e último pagamento, com dicas de UI (`severity` + `headline` + `cta`).
- Adicionado método `EmailService.sendTrialEndingEmail` (template D-7 e D-1).
- Criado job `trial-expiry-notification.job.ts` com idempotência via tabela `Notification`.
- Frontend: nova página `/dashboard/settings/billing`, nova tab "Plano e Cobrança" em Configurações.
- Frontend: `/dashboard/plans` reapontada para Asaas (`/subscription/checkout`, billingType=PIX). Stripe removido do fluxo.
- Wireup do job no `main.ts` (cron diário 09:00 BRT).
- 14 novos testes (9 billing-summary + 5 trial-expiry). **576 testes passando**, zero regressões.

---

## 2. Gateway escolhido e justificativa

**Asaas** — escolhido por:

| Critério | Asaas | Stripe |
|---|---|---|
| Maturidade do código | 95% (handlers, processor, reconciler, guard, dedup) | 60% (rotas básicas, sem testes) |
| Testes existentes | C5.2 integration + 4 suites unitárias | nenhum teste integrado |
| Adequação ao público (família/PME BR) | nativo (PIX/boleto/cartão BR) | precisa anti-fricção extra |
| Cross-provider safety | `billing-source.guard` enforça `Tenant.billingSource` | sem guard |
| Esforço para vender hoje | ligar 4 flags + chave API | reescrever webhook + testar |

**Stripe não é desligado**, mas perde o status de fluxo principal. As rotas `/subscription/stripe/*` continuam para futuros mercados internacionais; o frontend não chama mais.

---

## 3. Fluxo trial → pago (ponta a ponta)

```
[signup]
  └─ Tenant criado com subscriptionPlan='trial', trialEndsAt = now+30d
     subscriptionStatus='active', billingSource=null (zona neutra)

[durante trial]
  └─ TrialBanner exibe countdown
     /dashboard/settings/billing mostra severity baseada em dias restantes
     Job trial-expiry envia email D-7 e D-1 (idempotente)

[upgrade]
  ├─ User abre /dashboard/plans (ou clica CTA na billing page)
  ├─ Escolhe plano → POST /subscription/checkout {planId, billingCycle, billingType:'PIX'}
  ├─ Backend (paymentService.createCheckout) cria customer + subscription Asaas
  ├─ Asaas retorna invoiceUrl/pixCopiaECola → frontend redireciona
  └─ Após pagamento, Asaas envia webhook → /webhooks/asaas
     ├─ webhook-receiver persiste evento (dedup por asaasEventId)
     ├─ asaas-consumer.job (cron 1min) processa batch
     ├─ handlers atualizam Subscription.status + Tenant.subscriptionStatus
     ├─ billing-source.guard fixa Tenant.billingSource='asaas'
     └─ tenant-billing-cache invalidado pós-commit

[trial expirado sem pagamento]
  └─ middleware/subscription retorna HTTP 402 → frontend redireciona /blocked
     /blocked CTA → /dashboard/plans (mesmo fluxo)
```

---

## 4. Billing page

**Rota:** `/dashboard/settings/billing` ([page.tsx](frontend/src/app/dashboard/settings/billing/page.tsx))

Renderiza um card principal com gradiente/cor de severity, e dois cards de detalhes:

- **Card status:** plano, dias restantes (trial) ou próximo vencimento (pago), provedor (asaas/stripe/em teste). CTA dinâmico:
  - `severity=green` + `cta=manage` → "Ver outros planos"
  - `severity=amber|orange` + `cta=upgrade` → "Escolher plano e ativar" (gradient azul→verde UTOP)
  - `severity=red` + `cta=retry` → "Regularizar pagamento" (vermelho)
- **Card subscription:** id, status, ciclo, valor, início/fim do período (só aparece se houver Subscription).
- **Card último pagamento:** status (Pendente/Pago/Falhou), valor, método, vencimento, paidAt, failedAt.

Tab adicionada na sidebar de `/dashboard/settings` entre "Empresa" e "Notificações".

---

## 5. Webhook e estados de assinatura

**Endpoint Asaas:** `POST /webhooks/asaas` (gated por `FF_ASAAS_WEBHOOK_ENABLED`).

**Modelo de status — fonte de verdade:**

| Camada | Campo | Valores |
|---|---|---|
| `Tenant` | `subscriptionStatus` | `active` / `suspended` / `cancelled` / `past_due` |
| `Tenant` | `billingSource` | `null` / `asaas` / `stripe` / `manual` |
| `Subscription` | `status` (enum) | `pending` / `active` / `past_due` / `suspended` / `cancelled` |
| `PaymentRecord` | `status` | `pending` / `paid` / `failed` / `refunded` |
| Cache (in-mem) | `tenant-billing-cache` | TTL 60s, invalidado pós-commit do handler |

**Mapeamento Asaas → UTOP** (em `services/asaas/handlers.ts`):

| Asaas event | Subscription.status | Tenant.subscriptionStatus | Cache action |
|---|---|---|---|
| `SUBSCRIPTION_CREATED` | `pending` ou `active` | mantém | invalidate |
| `SUBSCRIPTION_UPDATED` (ACTIVE) | `active` | `active` | invalidate |
| `SUBSCRIPTION_UPDATED` (INACTIVE) | `suspended` | `suspended` | invalidate |
| `PAYMENT_RECEIVED/CONFIRMED` | mantém | `active` | invalidate |
| `PAYMENT_OVERDUE` | `past_due` | `past_due` | invalidate |
| `SUBSCRIPTION_DELETED` | `cancelled` | `cancelled` | invalidate |

**Idempotência:** Asaas event id é único na tabela `AsaasWebhookEvent`. Reprocessamento é seguro.

**Cross-provider guard:** `billing-source.guard.ts` impede que um webhook Asaas escreva em tenant cujo `billingSource='stripe'` (e vice-versa). Tenants em trial têm `billingSource=null` e o primeiro pagamento define a posse.

---

## 6. Comunicação fim de trial

### Email D-7 e D-1

- Método: `EmailService.sendTrialEndingEmail({ to, userName, daysRemaining, upgradeLink })`
- Template HTML pronto, com badge "Aviso" (D-7, laranja) ou "Último aviso" (D-1, vermelho).
- Sem `RESEND_API_KEY`: cai automaticamente em **modo simulação** (loga conteúdo no console). O job ainda registra a Notification para auditoria.

### Job — `trial-expiry-notification.job.ts`

- **Cron:** diariamente 09:00 BRT (`0 9 * * *`).
- **Buckets:**
  - D-7: tenants com `trialEndsAt` em janela de ±12h ao redor de `now+7d`
  - D-1: tenants com `trialEndsAt` em janela de ±12h ao redor de `now+1d`
- **Filtro:** `subscriptionPlan='trial'` AND `subscriptionStatus='active'` AND `deletedAt=null`.
- **Idempotência:** antes de enviar, checa `Notification` por `tenantId+type` (`trial_warning_d7` ou `trial_warning_d1`). Se já existe, skipa.
- **Auditoria:** sempre cria `Notification` mesmo se o email falhar — `priority=high` para D-1, `actionUrl='/dashboard/settings/billing'`.
- **Retorno:** stats `{ scanned, d7Sent, d1Sent, d7Skipped, d1Skipped, failures }` logados.

---

## 7. Arquivos alterados

### Backend
| Arquivo | Tipo |
|---|---|
| `backend/src/services/billing/billing-summary.service.ts` | **novo** |
| `backend/src/jobs/trial-expiry-notification.job.ts` | **novo** |
| `backend/src/__tests__/services/billing/billing-summary.service.test.ts` | **novo** |
| `backend/src/__tests__/jobs/trial-expiry-notification.job.test.ts` | **novo** |
| `backend/src/services/email.service.ts` | adicionado `sendTrialEndingEmail` + `getUpgradeLink` |
| `backend/src/routes/subscription.ts` | rota `GET /subscription/billing-summary` |
| `backend/src/main.ts` | wireup `startTrialExpiryNotificationJob` |

### Frontend
| Arquivo | Tipo |
|---|---|
| `frontend/src/app/dashboard/settings/billing/page.tsx` | **novo** |
| `frontend/src/app/dashboard/settings/page.tsx` | tab "Plano e Cobrança" |
| `frontend/src/app/dashboard/plans/page.tsx` | rotas Stripe → Asaas |

### Docs
| Arquivo | Tipo |
|---|---|
| `docs/SPRINT-B-BILLING.md` | **este documento** |

---

## 8. Testes e validações

- `backend npx tsc --noEmit` → **clean**.
- `backend npx jest` → **46 suites passing / 4 skipped / 576 tests passing** (eram 562, +14 novos).
- `frontend npx tsc --noEmit` → **sem novos erros** nos arquivos editados (erros pré-existentes em `.next/types` e `__tests__/ErrorBoundary.test.tsx` não relacionados).
- Smoke manual sugerido em prod (após deploy):
  1. Login com tenant em trial → `/dashboard/settings/billing` deve retornar amber/orange/red coerente com `trialEndsAt`.
  2. Forçar `trialEndsAt = now+1d` em DB de stage → rodar manualmente o job (`require + runOnce()`) → ver email simulado no log e `Notification` criada.
  3. Ligar `FF_ASAAS_*` em stage → criar checkout → confirmar webhook chega → status do tenant vira `active` → billing page reflete.

---

## 9. Riscos restantes

| Risco | Mitigação atual | Próximo passo (futuro) |
|---|---|---|
| **Asaas FF off em prod** — sem pagamento real ainda | UI mostra mensagem clara "Pagamento online ainda não está liberado" | Antes do lançamento: setar `FF_ASAAS_ENABLED`, `FF_ASAAS_SUBSCRIPTION_ENABLED`, `FF_ASAAS_WEBHOOK_ENABLED`, `FF_ASAAS_CONSUMER_ENABLED=true` + `ASAAS_API_KEY` real |
| **`paymentService.createCheckout` ainda tem `@ts-nocheck`** | Funciona, mas sem cobertura de tipo | Sprint C: refatorar para DI explícita como saas-subscription.service |
| **Plan limits não enforçados** (1 user, 3 contas, hasBudget…) | Documentado, fora de escopo Sprint B | Sprint D: middleware `enforce-plan-limits` |
| **Sem retry de email** | Resend é assíncrono e idempotência via Notification protege | Sprint D: fila de retries em caso de bounce |
| **Cache em memória** (não distribuído) | OK para single-process; TTL curto (60s) | Sprint D: migrar para Redis quando escalar para múltiplos pods |
| **Email D-3 não existe** | Audit pediu D-7 + D-1 apenas | Pode-se adicionar bucket D-3 sem refactor — basta novo `processBucket('trial_warning_d3', 3, ...)` |

---

## 10. Decisão final

UTOP está **vendável para a oferta "curso + 30 dias grátis"**:

- ✅ Trial de 30 dias com bloqueio automático ao expirar (HTTP 402 → /blocked).
- ✅ Página de billing dedicada mostra plano, status, dias restantes, próxima fatura, último pagamento, com CTA contextual.
- ✅ Caminho de upgrade real via Asaas (PIX/boleto/cartão BR), trocando trial por subscription ativa.
- ✅ Webhook idempotente atualiza status ponta a ponta com guard cross-provider.
- ✅ Avisos de D-7 e D-1 prontos no pipeline (modo simulação até `RESEND_API_KEY` ser configurado), com auditoria via `Notification`.
- ✅ 576 testes verdes, zero regressões.

**Para ir ao ar:**
1. Configurar em prod: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`.
2. Ligar flags: `FF_ASAAS_ENABLED=true`, `FF_ASAAS_WEBHOOK_ENABLED=true`, `FF_ASAAS_SUBSCRIPTION_ENABLED=true`, `FF_ASAAS_CONSUMER_ENABLED=true`.
3. Cadastrar URL `https://utopsistema.com.br/api/v1/webhooks/asaas` no painel Asaas.
4. Smoke teste com 1 tenant trial real.

UTOP agora sustenta o ciclo **trial 30d → aviso D-7 → aviso D-1 → upgrade Asaas → assinatura ativa → reflete em todas as telas**.
