# 🗺️ ROADMAP - FYNANPRO 2.0

**Última Atualização:** 05 de Dezembro de 2025  
**Status Atual:** MVP em Desenvolvimento - 45% Completo

---

## 📋 ÍNDICE
- [Status Geral](#status-geral)
- [Sprint Atual](#sprint-atual)
- [Sprints Futuras](#sprints-futuras)
- [Backlog Priorizado](#backlog-priorizado)
- [Decisões de Design](#decisões-de-design)
- [Práticas e Governança](#práticas-e-governança)

---

## 📊 STATUS GERAL

### ✅ Módulos Completos (5/12)
- [x] Autenticação (Login/Register/Refresh Token)
- [x] Dashboard Principal (Métricas + Gráficos)
- [x] Transações (CRUD + Listagem)
- [x] Categorias (CRUD + Hierarquia 1 nível)
- [x] Contas Bancárias (CRUD)

### 🚧 Módulos Parciais (2/12)
- [ ] Meios de Pagamento (70% - falta últimos 4 dígitos)
- [ ] Relatórios (30% - só dashboard básico)

### ❌ Módulos Não Iniciados (5/12)
- [ ] Contas Recorrentes (0%)
- [ ] Compras Parceladas (0%)
- [ ] Orçamentos (0%)
- [ ] Calendário Financeiro (0%)
- [ ] Importação CSV (0%)

---

## 🎯 SPRINT ATUAL (Sprint 3 - Semana 05-12 Dez)

### Objetivo: **Completar Funcionalidades Core de Transações**

#### ✅ Concluído
- [x] Corrigir axios undefined em bank-accounts
- [x] Validação de datas em transações
- [x] Sincronização Prisma schema

#### 🔄 Em Progresso
- [ ] **Meios de Pagamento - Últimos 4 Dígitos**
  - [ ] Adicionar campo `lastFourDigits` no schema Prisma
  - [ ] Migrar banco de dados
  - [ ] Atualizar formulário frontend
  - [ ] Exibir "Nubank •••• 2482" na listagem

#### 📝 Pendente
- [ ] **Categorias Hierárquicas (3 níveis)**
  - [ ] Adicionar seletor de categoria pai no formulário
  - [ ] Exibir breadcrumb "Moradia > Aluguel > Condomínio"
  - [ ] Filtro por categoria pai no backend

---

## 🚀 SPRINTS FUTURAS

### Sprint 4 (12-19 Dez) - **Contas Recorrentes** 🔥 CRÍTICO
**Por quê:** Diferencial principal do sistema, usuário precisa gerenciar contas fixas.

#### Entregáveis:
- [ ] **Backend:**
  - [ ] Endpoint GET /recurring-bills (listar)
  - [ ] Endpoint POST /recurring-bills (criar)
  - [ ] Endpoint PUT /recurring-bills/:id (editar)
  - [ ] Endpoint DELETE /recurring-bills/:id (excluir)
  - [ ] Job de geração automática de transações no vencimento

- [ ] **Frontend:**
  - [ ] Página `/dashboard/recurring-bills`
  - [ ] Tabela de contas recorrentes com status
  - [ ] Modal de criação/edição
  - [ ] Campos: nome, valor, frequência, dia vencimento, categoria
  - [ ] Badge de status (ativa/pausada/cancelada)
  - [ ] Botão "Pagar Agora" (gera transação manual)

#### Critérios de Aceite:
- ✅ Usuário pode criar conta recorrente "Aluguel R$ 1.200 todo dia 10"
- ✅ Sistema gera transação automaticamente no dia 10
- ✅ Usuário pode pausar/reativar conta recorrente
- ✅ Dashboard mostra próximas contas a vencer (widget)

---

### Sprint 5 (19-26 Dez) - **Compras Parceladas** 🔥 CRÍTICO
**Por quê:** Controle de parcelamentos é essencial para cartão de crédito.

#### Entregáveis:
- [ ] **Backend:**
  - [ ] Endpoint GET /installments (listar com filtros)
  - [ ] Endpoint POST /installments (criar compra parcelada)
  - [ ] Endpoint PUT /installments/:id (editar)
  - [ ] Endpoint DELETE /installments/:id (excluir)
  - [ ] Endpoint PATCH /installments/:id/pay-installment (marcar parcela como paga)
  - [ ] Cálculo automático de valor total + juros

- [ ] **Frontend:**
  - [ ] Página `/dashboard/installments`
  - [ ] Card visual: "Geladeira 5/12 - R$ 150 (R$ 1.800 total)"
  - [ ] Cronograma visual com parcelas pagas/pendentes
  - [ ] Modal de criação: valor total, num parcelas, data primeira
  - [ ] Filtro: todas/ativas/quitadas
  - [ ] Botão "Pagar Parcela Antecipada"

#### Critérios de Aceite:
- ✅ Usuário cria "Geladeira 12x R$ 150"
- ✅ Sistema exibe cronograma 12 meses
- ✅ Ao pagar parcela 5, status muda para "5/12 pagas"
- ✅ Dashboard mostra total parcelado atual

---

### Sprint 6 (26 Dez - 02 Jan) - **Orçamentos por Categoria** 🔥 CRÍTICO
**Por quê:** Controle de gastos gatilho (iFood, vícios, etc).

#### Entregáveis:
- [ ] **Backend:**
  - [ ] Endpoint GET /budgets (listar por mês/ano)
  - [ ] Endpoint POST /budgets (criar orçamento)
  - [ ] Endpoint PUT /budgets/:id (editar)
  - [ ] Endpoint GET /budgets/usage (% gasto vs orçado)
  - [ ] Alertas quando atingir 80% e 100%

- [ ] **Frontend:**
  - [ ] Página `/dashboard/budgets`
  - [ ] Card por categoria com barra de progresso
  - [ ] "Alimentação: R$ 420/500 (84%) 🟢"
  - [ ] "Lazer: R$ 475/500 (95%) 🔴 Atenção!"
  - [ ] Modal: definir orçamento mensal
  - [ ] Widget no dashboard: categorias acima de 80%

#### Critérios de Aceite:
- ✅ Usuário define "iFood: R$ 300/mês"
- ✅ Ao gastar R$ 240, sistema alerta "80% atingido"
- ✅ Ao gastar R$ 300, sistema alerta "Orçamento estourado!"
- ✅ Dashboard exibe categorias em alerta

---

### Sprint 7 (02-09 Jan) - **Calendário Financeiro** 📅
**Por quê:** Visão temporal de vencimentos e parcelas.

#### Entregáveis:
- [ ] **Backend:**
  - [ ] Endpoint GET /calendar/events (transações + recorrentes + parcelas)
  - [ ] Filtro por mês/ano
  - [ ] Agrupamento por dia

- [ ] **Frontend:**
  - [ ] Página `/dashboard/calendar`
  - [ ] Calendário mensal visual (React Big Calendar ou similar)
  - [ ] Eventos coloridos: verde (receita), vermelho (despesa)
  - [ ] Tooltip ao hover: detalhes do evento
  - [ ] Clicar no evento: abre modal de edição
  - [ ] Badges: "3 contas a vencer hoje"

#### Critérios de Aceite:
- ✅ Calendário mostra todas transações do mês
- ✅ Destaca dias com múltiplos vencimentos
- ✅ Usuário pode criar transação clicando em data vazia
- ✅ Widget no dashboard: "Próximos 7 dias"

---

### Sprint 8 (09-16 Jan) - **Sistema de Notificações** 🔔
**Por quê:** Alertas de vencimento, orçamento, saldo baixo.

#### Entregáveis:
- [ ] **Backend:**
  - [ ] Modelo Notification no Prisma
  - [ ] Job diário: verificar vencimentos D-3, D-1, D+0
  - [ ] Job diário: verificar orçamentos em 80%
  - [ ] Job diário: verificar saldo baixo (<R$ 100)
  - [ ] Endpoint GET /notifications (listar)
  - [ ] Endpoint PATCH /notifications/:id/read (marcar lida)
  - [ ] Integração com SendGrid (e-mail)

- [ ] **Frontend:**
  - [ ] Badge no sino do header: "🔔(3)"
  - [ ] Dropdown com notificações
  - [ ] Página `/dashboard/notifications`
  - [ ] Configurações: ativar/desativar tipos
  - [ ] Toast ao receber notificação em tempo real

#### Critérios de Aceite:
- ✅ 3 dias antes do vencimento: notificação "Aluguel vence em 3 dias"
- ✅ Orçamento 80%: notificação "iFood atingiu 80% do orçamento"
- ✅ Saldo baixo: notificação "Nubank está com R$ 50"
- ✅ E-mail enviado em casos críticos

---

### Sprint 9 (16-23 Jan) - **Importação de Extratos CSV** 📥
**Por quê:** Facilitar migração de dados de outros apps.

#### Entregáveis:
- [ ] **Backend:**
  - [ ] Endpoint POST /imports/upload (aceita CSV)
  - [ ] Parser CSV com mapeamento de colunas
  - [ ] Validação de dados
  - [ ] Preview antes de importar
  - [ ] Endpoint POST /imports/confirm (confirmar importação)
  - [ ] Suporte formatos: Nubank, Inter, C6, Genérico

- [ ] **Frontend:**
  - [ ] Página `/dashboard/import`
  - [ ] Drag & drop de arquivo CSV
  - [ ] Mapeamento de colunas: "Data" → transactionDate
  - [ ] Preview dos dados (tabela)
  - [ ] Botão "Confirmar Importação"
  - [ ] Progresso: "124/200 transações importadas"

#### Critérios de Aceite:
- ✅ Usuário faz upload de CSV do Nubank
- ✅ Sistema mapeia automaticamente as colunas
- ✅ Usuário vê preview de 200 transações
- ✅ Ao confirmar, todas são criadas no banco

---

### Sprint 10 (23-30 Jan) - **Relatórios Avançados** 📊
**Por quê:** Análises profundas de finanças.

#### Entregáveis:
- [ ] **Backend:**
  - [ ] Endpoint GET /reports/expenses-by-category (gráfico pizza)
  - [ ] Endpoint GET /reports/monthly-evolution (linha temporal)
  - [ ] Endpoint GET /reports/top-expenses (maiores gastos)
  - [ ] Endpoint GET /reports/comparison (mês a mês)
  - [ ] Filtros: data início/fim, categorias

- [ ] **Frontend:**
  - [ ] Página `/dashboard/reports`
  - [ ] 4 gráficos principais:
    - [ ] Despesas por Categoria (pizza)
    - [ ] Evolução Mensal (linha)
    - [ ] Top 10 Gastos (barras)
    - [ ] Comparação Mês a Mês (colunas)
  - [ ] Filtros: período, categorias
  - [ ] Botão "Exportar PDF"

#### Critérios de Aceite:
- ✅ Gráfico de pizza mostra % por categoria
- ✅ Gráfico de linha mostra últimos 6 meses
- ✅ Filtros funcionam em tempo real
- ✅ PDF é gerado com todos os gráficos

---

### Sprint 11 (30 Jan - 06 Fev) - **Perfis e Permissões** 👥
**Por quê:** Uso compartilhado (família, cônjuge).

#### Entregáveis:
- [ ] **Backend:**
  - [ ] Modelo TenantUser no Prisma (já existe)
  - [ ] Endpoint POST /tenant-users/invite (enviar convite)
  - [ ] Endpoint GET /tenant-users (listar membros)
  - [ ] Endpoint PUT /tenant-users/:id/permissions (editar)
  - [ ] Endpoint DELETE /tenant-users/:id (remover)
  - [ ] Middleware de permissões por rota
  - [ ] E-mail de convite

- [ ] **Frontend:**
  - [ ] Página `/dashboard/team`
  - [ ] Tabela de membros: nome, e-mail, role, ações
  - [ ] Botão "Convidar Membro"
  - [ ] Modal: e-mail, role (viewer/editor/admin)
  - [ ] Checkboxes de permissões granulares
  - [ ] Badge: "Owner", "Editor", "Viewer"

#### Critérios de Aceite:
- ✅ Owner convida cônjuge como "Editor"
- ✅ Cônjuge recebe e-mail com link de aceite
- ✅ Cônjuge pode criar transações mas não deletar contas
- ✅ Owner pode remover acesso do cônjuge

---

### Sprint 12 (06-13 Fev) - **Dashboard Super Master** 👑
**Por quê:** Suporte e troubleshooting.

#### Entregáveis:
- [ ] **Backend:**
  - [ ] Endpoint GET /admin/tenants (listar todos)
  - [ ] Endpoint GET /admin/tenants/:id/impersonate (gerar token)
  - [ ] Endpoint GET /admin/metrics (KPIs globais)
  - [ ] Endpoint GET /admin/audit-logs (logs de ações)
  - [ ] Middleware: só role "super_master"

- [ ] **Frontend:**
  - [ ] Página `/admin/dashboard` (só para super master)
  - [ ] Cards: Total usuários, Total transações, MRR
  - [ ] Tabela de todos os tenants
  - [ ] Botão "Ver como Usuário" → abre app como aquele user
  - [ ] Logs de auditoria: quem fez o quê
  - [ ] Gráfico de crescimento de usuários

#### Critérios de Aceite:
- ✅ Super Master vê lista de todos os tenants
- ✅ Pode clicar e "ver como" qualquer usuário
- ✅ Todas as ações ficam registradas em audit_logs
- ✅ Dashboard mostra KPIs: 1.245 usuários, R$ 12.450 MRR

---

## 📚 BACKLOG PRIORIZADO

### Baixa Prioridade (Pós-MVP)
- [ ] Modo Dark/Light (tema)
- [ ] Exportação de dados completa (JSON, Excel)
- [ ] Integração com APIs bancárias (Open Banking)
- [ ] App mobile (React Native)
- [ ] Metas financeiras (economizar R$ 10k)
- [ ] Investimentos (ações, fundos, crypto)
- [ ] Multi-moeda (USD, EUR)
- [ ] Multi-idioma (EN, ES)
- [ ] Gamificação (achievements, streak)
- [ ] IA: Sugestões de economia

---

## 🎨 DECISÕES DE DESIGN (Para não esquecer)

### 1. **Meios de Pagamento SÃO Dinâmicos**
**Decisão:** Meio de pagamento **NÃO** está vinculado a conta bancária.  
**Motivo:** Usuário pode receber PIX no Itaú ou Bradesco sem duplicar "PIX".

**Implementação:**
- ✅ Campo `type` (pix, credit_card, debit, cash, etc)
- ✅ Campo `name` livre: "PIX Itaú", "PIX Bradesco"
- ❌ **Sem** campo `bankAccountId` obrigatório

**Exemplo de Uso:**
```
Meio: PIX Pessoal
Tipo: pix
Conta: Nubank (escolhida na transação)

Meio: PIX Empresarial
Tipo: pix
Conta: Inter (escolhida na transação)
```

---

### 2. **Cartões: Últimos 4 Dígitos Resolvem**
**Decisão:** Adicionar campo `lastFourDigits` no meio de pagamento.  
**Motivo:** Identificar cartão sem complexidade extra.

**Implementação:**
- ✅ Campo `lastFourDigits` (string, 4 chars)
- ✅ Exibição: "Nubank Mastercard •••• 2482"
- ❌ **Sem** campos: limite, fechamento, vencimento (fica na conta bancária se necessário)

**Exemplo:**
```
Meio: Nubank Mastercard 2482
Tipo: credit_card
Últimos 4: 2482
```

---

### 3. **Categorias: 3 Níveis Máximo**
**Decisão:** Hierarquia até 3 níveis (Pai > Filho > Neto).  
**Motivo:** Mais que isso fica confuso.

**Implementação:**
- ✅ Campo `parentId` (pode ser null)
- ✅ Campo `level` (1, 2 ou 3)
- ✅ Breadcrumb: "Moradia > Contas > Água"

---

### 4. **Transações Recorrentes: Auto-Geração**
**Decisão:** Job diário gera transações automaticamente.  
**Motivo:** Usuário não esquece de registrar contas fixas.

**Implementação:**
- ✅ Job roda 00:00 todo dia
- ✅ Verifica `recurring_bills` com `dueDay = hoje`
- ✅ Cria `transaction` com status "pending"
- ✅ Notifica usuário: "Aluguel de R$ 1.200 foi registrado"

---

### 5. **Orçamentos: Alertas em 80% e 100%**
**Decisão:** Sistema avisa proativamente sobre gastos.  
**Motivo:** Controle de gatilhos (iFood, vícios).

**Implementação:**
- ✅ Ao criar transação, verifica orçamento da categoria
- ✅ Se >= 80%: notificação "iFood atingiu 80%"
- ✅ Se >= 100%: notificação "iFood estourou orçamento!"
- ✅ Widget no dashboard: categorias em alerta

---

## 📏 PRÁTICAS E GOVERNANÇA

### 1. **Checklist ANTES de Começar Qualquer Feature**

```markdown
## Checklist Pré-Desenvolvimento

### 📖 Documentação
- [ ] Li a especificação em `02-FUNCIONALIDADES-MVP-POR-MODULOS.md`?
- [ ] Entendi a API em `04-API-REST-COMPLETA.md`?
- [ ] Vi o mockup em `05-PROPOSTA-DE-TELAS-E-UX.md`?
- [ ] Verifiquei decisões de design em `ROADMAP.md`?

### 🗺️ Planejamento
- [ ] Feature está no ROADMAP.md?
- [ ] Está na Sprint Atual ou é "nice to have"?
- [ ] Criei issue no GitHub com label adequado?
- [ ] Estimei tempo necessário (horas)?

### 🎯 Objetivo
- [ ] Defini critérios de aceite claros?
- [ ] Sei qual problema isso resolve para o usuário?
- [ ] Pensei em casos extremos (edge cases)?

### 🏗️ Arquitetura
- [ ] Banco: Precisa migração Prisma?
- [ ] Backend: Quais endpoints criar?
- [ ] Frontend: Quais páginas/componentes?
- [ ] Testes: Cobrir pelo menos 70%?

### 🚀 Execução
- [ ] Criar branch: `feature/nome-da-feature`
- [ ] Commits descritivos: "feat: adiciona campo lastFourDigits"
- [ ] PR com descrição completa + screenshots
- [ ] Code review antes de merge
```

---

### 2. **Fluxo de Desenvolvimento (Git Flow Simplificado)**

```bash
# 1. Puxar últimas mudanças
git checkout main
git pull origin main

# 2. Criar branch da feature
git checkout -b feature/recurring-bills-crud

# 3. Desenvolver em ciclos pequenos
# - Fazer backend primeiro (API + testes)
# - Depois frontend (UI + integração)
# - Commitar a cada funcionalidade completa

git add .
git commit -m "feat(backend): adiciona CRUD de recurring bills"

# 4. Enviar para remoto
git push origin feature/recurring-bills-crud

# 5. Abrir Pull Request no GitHub
# - Título: "Feature: CRUD de Contas Recorrentes"
# - Descrição: O que foi feito, por quê, prints
# - Atribuir a si mesmo
# - Label: "enhancement"

# 6. Após aprovação: Merge e deletar branch
git checkout main
git pull origin main
git branch -d feature/recurring-bills-crud
```

---

### 3. **Revisão Semanal (Toda Segunda-Feira 9h)**

**Ritual:**
1. Abrir `ROADMAP.md`
2. Atualizar % de conclusão da Sprint Atual
3. Marcar [x] nas tarefas concluídas
4. Identificar bloqueios
5. Ajustar prioridades se necessário

**Perguntas:**
- ✅ Concluímos o planejado da semana passada?
- 🚧 O que ficou pendente? Por quê?
- 🎯 Qual o foco desta semana?
- 🚨 Há riscos que podem atrasar o MVP?

---

### 4. **Definition of Done (DoD)**

Uma feature só está **COMPLETA** quando:

#### Backend:
- [x] Endpoint criado em `/src/routes/`
- [x] Service com lógica de negócio
- [x] DTO com validação Zod
- [x] Testes unitários (70%+ coverage)
- [x] Documentação Swagger atualizada
- [x] Logs de erro implementados
- [x] Tratamento de edge cases

#### Frontend:
- [x] Página/componente criado em `/src/app/dashboard/`
- [x] Integração com API via `api` client
- [x] Loading states (skeletons)
- [x] Tratamento de erros (toasts)
- [x] Responsivo (mobile + desktop)
- [x] Formulários com validação Zod
- [x] Acessibilidade básica (aria-labels)

#### Geral:
- [x] Testado manualmente em dev
- [x] Sem erros no console
- [x] Sem warnings TypeScript
- [x] PR aprovado e mergeado
- [x] ROADMAP.md atualizado

---

### 5. **Comunicação e Documentação**

#### Ao Implementar:
1. **Comentar código complexo:**
```typescript
// Calcula saldo projetado somando receitas futuras e subtraindo despesas
// Considera transações pendentes, parcelas a vencer e contas recorrentes ativas
const projectedBalance = currentBalance + futureIncome - futureExpenses;
```

2. **Atualizar README se necessário:**
- Novas variáveis de ambiente? → `backend/.env.example`
- Nova lib instalada? → `backend/package.json` + docs

3. **Registrar decisões importantes:**
- Adicionar em `ROADMAP.md > Decisões de Design`
- Exemplo: "Por que não vinculamos meio de pagamento à conta"

#### Ao Terminar Sprint:
1. Atualizar `ROADMAP.md`:
   - Marcar tarefas concluídas [x]
   - Ajustar % de conclusão
   - Mover bloqueios para próxima sprint

2. Criar tag de versão:
```bash
git tag -a v0.4.0 -m "Sprint 4: Contas Recorrentes"
git push origin v0.4.0
```

---

### 6. **Priorização de Bugs vs Features**

**Regra de Ouro:**
> "Bug em produção > Bug em dev > Feature planejada > Nice to have"

**Classificação de Bugs:**
- 🔴 **Crítico:** App quebrado, dados perdidos → PARAR TUDO
- 🟠 **Alto:** Funcionalidade principal não funciona → Resolver em 24h
- 🟡 **Médio:** UX ruim, mas tem workaround → Resolver na sprint
- 🟢 **Baixo:** Pequeno visual, typo → Backlog

**Exemplo:**
- 🔴 "Login não funciona" → CRÍTICO, resolver AGORA
- 🟠 "Transação não salva" → ALTO, resolver hoje
- 🟡 "Botão desalinhado" → MÉDIO, resolver na sprint
- 🟢 "Trocar cor do botão" → BAIXO, backlog

---

### 7. **Testes: Cobertura Mínima**

**Meta:** 70% de cobertura de testes

**O que testar:**
- ✅ Validações de DTO (Zod schemas)
- ✅ Lógica de negócio (services)
- ✅ Endpoints críticos (auth, transactions)
- ❌ Getters/setters simples
- ❌ Código gerado automaticamente

**Comando:**
```bash
# Backend
cd backend
npm test -- --coverage

# Frontend (quando implementar)
cd frontend
npm test -- --coverage
```

---

### 8. **Performance: Não Otimize Prematuramente**

**Regra:**
> "Faça funcionar primeiro, otimize depois se necessário."

**Quando otimizar:**
- Endpoint leva +3 segundos
- Query retorna +10.000 registros
- Dashboard travando no carregamento

**Como otimizar:**
1. Identificar gargalo (logs, profiler)
2. Adicionar índices no banco
3. Implementar paginação
4. Usar cache (Redis)
5. Lazy loading no frontend

---

## 🎯 RESUMO: Como Não Nos Perdermos Mais

### ✅ **O QUE FAZER:**
1. **Consultar ROADMAP.md SEMPRE** antes de começar algo
2. **Seguir a Sprint Atual**, não pular para features futuras
3. **Atualizar ROADMAP.md** ao completar tarefas
4. **Fazer PR com descrição completa** e esperar review
5. **Testar manualmente** antes de considerar pronto
6. **Documentar decisões de design** no próprio ROADMAP

### ❌ **O QUE NÃO FAZER:**
1. ❌ Começar feature sem ler especificação
2. ❌ Implementar "nice to have" antes do essencial
3. ❌ Fazer PR gigante (500+ linhas)
4. ❌ Deixar console.log ou código comentado
5. ❌ Ignorar erros TypeScript "depois eu arrumo"
6. ❌ Não testar edge cases (campo vazio, valor negativo)

---

## 📊 KPIs de Qualidade

**Meta para MVP (Sprint 12):**
- ✅ 12 módulos completos
- ✅ 80%+ cobertura de testes backend
- ✅ 60%+ cobertura de testes frontend
- ✅ 0 bugs críticos em produção
- ✅ 100% documentação (Swagger + README)
- ✅ Tempo de resposta: <500ms (p95)

**Acompanhar Semanalmente:**
```bash
# Total de testes passando
npm test

# Cobertura
npm test -- --coverage

# Lint (qualidade código)
npm run lint

# Build (verificar se compila)
npm run build
```

---

## 📞 CONTATO E SUPORTE

**Em caso de dúvidas:**
1. Consultar documentação: `01-VISAO-GERAL.md` a `07-ARQUITETURA.md`
2. Verificar decisões de design: `ROADMAP.md`
3. Buscar em issues do GitHub (pode já ter sido resolvido)
4. Criar issue com label "question"

---

**🚀 Vamos manter o foco e entregar o MVP até 13 de Fevereiro!**

---

_Última revisão: 05/12/2025 - Sprint 3_
