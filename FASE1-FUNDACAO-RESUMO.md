# ═══════════════════════════════════════════════════════════════════════════════
# FASE 1: FUNDAÇÃO SEMÂNTICA - RESUMO DA IMPLEMENTAÇÃO
# ═══════════════════════════════════════════════════════════════════════════════
# Data: 27 de Dezembro de 2025
# Versão do Contrato: 1.0.0
# ═══════════════════════════════════════════════════════════════════════════════

## ✅ PASSO 1: CONTRATO OFICIAL CRIADO

### Arquivos criados:
- `backend/src/contracts/energy.contract.ts` - Código TypeScript definitivo
- `backend/src/contracts/ENERGY-CONTRACT.md` - Documentação humana

### O que define:
- **4 Tipos de Energia:** SURVIVAL, CHOICE, FUTURE, LOSS
- **6 Regras Imutáveis:** Só despesas, soma = 100%, sem defaults silenciosos, etc.
- **Health Score:** Sem futuro = máximo B (80), sem futuro + deficit = máximo C (70)

---

## ✅ PASSO 2: SCHEMA EVOLUÍDO

### Arquivo modificado:
- `backend/prisma/schema.prisma`

### Modelos adicionados:
```prisma
model CategorySemantics {
  id                String   @id @default(cuid())
  tenantId          String
  categoryId        String   @unique
  survivalWeight    Decimal  @default(0)
  choiceWeight      Decimal  @default(0)
  futureWeight      Decimal  @default(0)
  lossWeight        Decimal  @default(0)
  validationStatus  String   @default("not_validated")
  userOverride      Boolean  @default(false)
  justification     String?
  inferenceSource   String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  tenant   Tenant   @relation(fields: [tenantId], references: [id])
  category Category @relation(fields: [categoryId], references: [id])
}
```

### Campos adicionados em Transaction:
- `energySource` - Fonte da classificação
- `energySurvival`, `energyChoice`, `energyFuture`, `energyLoss` - Pesos
- `energyJustification` - Justificativa de override

---

## ✅ PASSO 3: UI DE GOVERNANÇA CRIADA

### Arquivo criado:
- `frontend/src/app/dashboard/energy-governance/page.tsx`

### Funcionalidades:
- Lista todas as categorias com suas energias
- Barras visuais mostrando distribuição
- Modal de edição com sliders
- Presets rápidos (100% Survival, 60/40, etc.)
- Campo de justificativa obrigatório
- Painel de auditoria com issues

### Menu adicionado:
- `frontend/src/components/Sidebar.tsx` - "⚡ Governança"

---

## ✅ PASSO 4: ROTA DE AUDITORIA CRIADA

### Arquivo criado:
- `backend/src/routes/energy-governance.ts`

### Endpoints:
- `GET /api/v1/energy-governance/categories` - Listar categorias
- `PUT /api/v1/energy-governance/categories/:id` - Atualizar semântica
- `GET /api/v1/energy-governance/audit` - Listar problemas
- `GET /api/v1/energy-governance/contract` - Referência do contrato

### Script de auditoria:
- `backend/audit-category-semantics.ts` - Para rodar via terminal

---

## ✅ PASSO 5: HEALTH SCORE AJUSTADO

### Arquivo modificado:
- `backend/src/services/energy-reports.service.ts`

### Regras implementadas:
```typescript
// Se tem receita mas não tem futuro
if (hasIncomeData && !hasFutureData) {
  // Se tem deficit, máximo C (70)
  if (hasDeficit) {
    scoreAdjusted = Math.min(scoreAdjusted, 70);
    adjustmentReason = 'Sem investimento em futuro e com deficit';
  } else {
    // Sem deficit, máximo B (80)
    scoreAdjusted = Math.min(scoreAdjusted, 80);
    adjustmentReason = 'Sem investimento em futuro';
  }
}
```

---

# ═══════════════════════════════════════════════════════════════════════════════
# COMANDOS DE DEPLOY
# ═══════════════════════════════════════════════════════════════════════════════

## 1. ENVIAR ARQUIVOS PARA O SERVIDOR

```bash
# Conectar ao servidor
ssh root@91.99.16.145

# No local, comprimir e enviar
# (Rodar na pasta FYNANPRO2.0)

# Opção A: Git (recomendado)
git add .
git commit -m "feat: FASE 1 Fundação Semântica - Contrato de Energia"
git push origin main

# No servidor:
cd /opt/utop
git pull origin main

# Opção B: SCP direto
scp -r backend/src/contracts root@91.99.16.145:/opt/utop/backend/src/
scp backend/prisma/schema.prisma root@91.99.16.145:/opt/utop/backend/prisma/
scp backend/src/routes/energy-governance.ts root@91.99.16.145:/opt/utop/backend/src/routes/
scp backend/src/main.ts root@91.99.16.145:/opt/utop/backend/src/
scp backend/src/services/energy-reports.service.ts root@91.99.16.145:/opt/utop/backend/src/services/
scp -r frontend/src/app/dashboard/energy-governance root@91.99.16.145:/opt/utop/frontend/src/app/dashboard/
scp frontend/src/components/Sidebar.tsx root@91.99.16.145:/opt/utop/frontend/src/components/
```

## 2. RODAR MIGRATION NO SERVIDOR

```bash
ssh root@91.99.16.145
cd /opt/utop

# Aplicar migration (cria tabela CategorySemantics)
docker exec -it utop-backend npx prisma db push --accept-data-loss

# Ou se preferir migration com nome:
docker exec -it utop-backend npx prisma migrate dev --name add_energy_semantics
```

## 3. REBUILD DOS CONTAINERS

```bash
cd /opt/utop

# Rebuild completo
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build

# Verificar logs
docker logs -f utop-backend --tail 50
docker logs -f utop-frontend --tail 50
```

## 4. RODAR AUDITORIA INICIAL

```bash
# Via container
docker exec -it utop-backend npx ts-node audit-category-semantics.ts

# Ou acessando a API
curl -X GET http://localhost:3000/api/v1/energy-governance/audit \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

# ═══════════════════════════════════════════════════════════════════════════════
# CHECKLIST PÓS-DEPLOY
# ═══════════════════════════════════════════════════════════════════════════════

- [ ] Migration executada sem erros
- [ ] Tabela CategorySemantics existe no banco
- [ ] Rota /api/v1/energy-governance funcionando
- [ ] Menu "⚡ Governança" aparece no sidebar
- [ ] Página de governança carrega corretamente
- [ ] Modal de edição funciona
- [ ] Health Score mostra adjustmentReason quando futureRatio = 0
- [ ] Auditoria inicial executada
- [ ] Issues críticos listados e identificados

---

# ═══════════════════════════════════════════════════════════════════════════════
# PRÓXIMOS PASSOS (SÓ DEPOIS DA AUDITORIA)
# ═══════════════════════════════════════════════════════════════════════════════

Conforme o contrato e o prompt do ChatGPT:
> "Nada segue sem isso"

Antes de adicionar QUALQUER feature nova:
1. Rodar auditoria inicial
2. Corrigir TODOS os issues críticos (categorias sem semântica)
3. Revisar e validar categorias com default 50/50
4. Garantir que 100% das categorias estão VALIDATED ou INFERRED

Só então seguir para FASE 2:
- Relatórios por tipo de energia
- Modo especialista (toggle no dashboard)
- Comparação mês a mês por energia
