# 🎯 ROADMAP COMPLETO - FYNANPRO 2.0

**Última Atualização:** 05 de Dezembro de 2025  
**Status Atual:** Backend 7.5/10 | Frontend 8.0/10 ⬆️
**Objetivo:** Sistema Financeiro Profissional com Auto-Geração e Inteligência

---

## 🚀 PLANO DE AÇÃO PRINCIPAL - 4 SPRINTS

### **📌 VISÃO GERAL DO SISTEMA**

#### **Fluxo de Recorrências (Core do Sistema)**
```
CRIAR RECORRÊNCIA (Ex: Aluguel R$1.000 - Dia 10)
    ↓
GERA AUTOMÁTICO: 3 MESES FUTUROS
    • Janeiro/2026 - A Pagar
    • Fevereiro/2026 - A Pagar  
    • Março/2026 - A Pagar
    ↓
APARECE NO CALENDÁRIO (Dia 10 de cada mês)
    ↓
APARECE EM TRANSAÇÕES (Status: A Pagar)
    ↓
APARECE NO DASHBOARD (Provisionamento)
    ↓
ALERTA 3 DIAS ANTES (Notificações)
    ↓
USUÁRIO PAGA → Desconta da conta bancária
    ↓
CRIA AUTOMATICAMENTE: Próximo mês (Abril/2026)
    ↓
RELATÓRIOS: Reconhece como Despesa Fixa
```

#### **Diferenças: Recorrências vs Parcelamentos**
```
RECORRÊNCIAS:
• Infinitas (todo mês até cancelar)
• Usuário define: Fixa ou Variável
• Ex: Aluguel, Salário, Água, Luz
• Gera 3 meses sempre

PARCELAMENTOS:
• Finitas (X parcelas e acabou)
• Usuário define: Fixa ou Variável
• Ex: Geladeira 12x, Conta atrasada 3x
• Não gera automático
```

---

## 🎯 SPRINT 1 - SISTEMA DE AUTO-GERAÇÃO (1 semana) ⚡ PRIORIDADE MÁXIMA

**Objetivo:** Implementar geração automática de 3 meses + Sistema de Pagamento Profissional

### **Backend (3 dias)**

#### **Dia 1 - Ajustes no Schema Prisma**
- [ ] **Adicionar campos em `RecurringBill`**
  ```prisma
  isFixed          Boolean   @default(true)  // Fixa ou Variável
  autoGenerate     Boolean   @default(true)  // Gerar automático?
  monthsAhead      Int       @default(3)     // Quantos meses gerar
  ```

- [ ] **Adicionar campos em `Transaction`**
  ```prisma
  dueDate          DateTime?           // Data de vencimento
  paidDate         DateTime?           // Data real do pagamento
  isPaidEarly      Boolean?            // Pago antecipado?
  isPaidLate       Boolean?            // Pago atrasado?
  daysEarlyLate    Int?               // Quantos dias antes/depois
  isFixed          Boolean   @default(true)  // Fixa ou Variável
  recurringBillId  String?            // Link com recorrência
  installmentId    String?            // Link com parcelamento
  ```

- [ ] **Criar model `Notification`**
  ```prisma
  model Notification {
    id               String    @id @default(uuid())
    userId           String
    type             String    // 'payment_due', 'low_balance', 'goal_reached'
    title            String
    message          String
    transactionId    String?
    isRead           Boolean   @default(false)
    createdAt        DateTime  @default(now())
    user             User      @relation(fields: [userId], references: [id])
  }
  ```

- [ ] **Rodar migration**
  ```bash
  npx prisma migrate dev --name add-auto-generation-fields
  ```

#### **Dia 2 - Endpoints de Auto-Geração**

- [ ] **Criar `POST /recurring-bills/:id/generate-occurrences`**
  ```typescript
  // Lógica:
  // 1. Busca RecurringBill
  // 2. Verifica últimas transações geradas
  // 3. Gera próximos X meses (default: 3)
  // 4. Não duplica se já existe
  // 5. Retorna lista de transações criadas
  ```

- [ ] **Criar `POST /recurring-bills/auto-generate-all`**
  ```typescript
  // Cron job diário:
  // 1. Busca todas recorrências ativas
  // 2. Para cada uma, gera próximos 3 meses
  // 3. Log de quantas foram criadas
  ```

- [ ] **Ajustar `POST /recurring-bills` (criar)**
  - Após criar recorrência, disparar auto-geração
  - Retornar recorrência + 3 transações criadas

#### **Dia 3 - Sistema de Pagamento**

- [ ] **Criar `POST /transactions/:id/pay`**
  ```typescript
  // Input:
  // - transactionId
  // - paidDate (data do pagamento)
  // - bankAccountId (opcional, se quiser alterar)
  
  // Validações:
  // 1. Transação existe?
  // 2. Já foi paga?
  // 3. Conta tem saldo?
  
  // Cálculos:
  // 1. paidDate vs dueDate → isPaidEarly/isPaidLate
  // 2. Calcular daysEarlyLate
  
  // Ações:
  // 1. Atualizar status → 'paid'
  // 2. Setar paidDate
  // 3. Descontar da conta bancária
  // 4. Se recorrência, gerar próximo mês
  
  // Retorno:
  // - transaction atualizada
  // - bankAccount com novo saldo
  // - flag de "antecipado" ou "atrasado"
  ```

- [ ] **Criar `GET /transactions/pending`**
  - Retorna transações com status 'pending'
  - Filtros: startDate, endDate, type (expense/income)
  - Usado no dashboard e calendário

### **Frontend (2 dias)**

#### **Dia 4 - Campo "Tipo" nas Recorrências**

- [ ] **Atualizar `CreateBillModal.tsx`**
  ```tsx
  // Adicionar após campo "Categoria":
  <div>
    <label>Tipo de Despesa</label>
    <div className="flex gap-4">
      <label>
        <input type="radio" name="isFixed" value="true" />
        Fixa (Ex: Aluguel, Água)
      </label>
      <label>
        <input type="radio" name="isFixed" value="false" />
        Variável (Ex: Lazer, Compras)
      </label>
    </div>
  </div>
  ```

- [ ] **Atualizar `EditBillModal.tsx`** (mesmo campo)

- [ ] **Atualizar `useRecurringBills.ts`**
  ```typescript
  const handleCreateBill = async (e) => {
    const payload = {
      // ... campos existentes
      isFixed: recurringBillForm.isFixed, // ← Novo
    };
    
    const response = await api.post('/recurring-bills', payload);
    // Resposta agora inclui 3 transações geradas
    
    toast.success(`Recorrência criada! 3 meses provisionados.`);
  };
  ```

#### **Dia 5 - Modal de Pagamento Profissional**

- [ ] **Criar `PaymentModal.tsx`**
  ```tsx
  interface Props {
    transaction: Transaction;
    onConfirm: (paidDate: Date, bankAccountId: string) => void;
    onCancel: () => void;
  }
  
  // Features:
  // - Date picker (data de pagamento)
  // - Alerta se antecipado/atrasado
  // - Select de conta bancária
  // - Preview do saldo após pagamento
  // - Botões: Cancelar / Confirmar Pagamento
  ```

- [ ] **Integrar no `useTransactions.ts`** (criar hook se não existir)
  ```typescript
  const handlePayTransaction = async (id: string, paidDate: Date) => {
    const response = await api.post(`/transactions/${id}/pay`, {
      paidDate: paidDate.toISOString(),
    });
    
    if (response.data.isPaidEarly) {
      toast.warning('Pagamento antecipado registrado!');
    } else if (response.data.isPaidLate) {
      toast.error('Pagamento em atraso registrado.');
    } else {
      toast.success('Pagamento registrado no prazo!');
    }
    
    await loadData(); // Recarrega transações
  };
  ```

- [ ] **Badge de Alertas na Sidebar**
  ```tsx
  // Em components/Sidebar.tsx:
  <Link href="/dashboard/alerts">
    Alertas
    {pendingCount > 0 && (
      <span className="bg-red-500 text-white rounded-full px-2 py-1">
        {pendingCount}
      </span>
    )}
  </Link>
  ```

---

## 🎯 SPRINT 2 - CALENDÁRIO & DASHBOARD (1 semana) 🔥

**Objetivo:** Calendário com contador simples + Dashboard elaborado com gráficos

### **Backend (1 dia)**

#### **Dia 6 - Endpoint de Eventos do Calendário**

- [ ] **Ajustar `GET /calendar/events`**
  ```typescript
  // Retornar estrutura:
  {
    "2025-12-10": {
      expenses: 4,  // Quantidade de despesas
      income: 1,    // Quantidade de receitas
      totalExpense: 1429.90,
      totalIncome: 5000.00,
      transactions: [...] // Array completo
    }
  }
  ```

### **Frontend (4 dias)**

#### **Dia 7 - Calendário Simples**

- [ ] **Atualizar `calendar/page.tsx`**
  ```tsx
  // Visual por dia:
  <div className="day">
    <span>10</span>
    {data['2025-12-10'] && (
      <>
        <div className="text-red-500">Despesas: 4</div>
        <div className="text-green-500">Receitas: 1</div>
      </>
    )}
  </div>
  ```

- [ ] **Modal ao clicar no dia**
  ```tsx
  <CalendarDayModal
    date="2025-12-10"
    transactions={transactions}
    onPay={(id) => handlePay(id)}
  />
  
  // Lista:
  // 🔴 DESPESAS A PAGAR
  // • Aluguel - R$ 1.000 - Nubank [Botão: Pagar]
  // • Água - R$ 80 - Inter [Botão: Pagar]
  //
  // 🟢 RECEITAS A RECEBER
  // • Salário - R$ 5.000 - Nubank [Botão: Receber]
  ```

#### **Dia 8-9 - Dashboard Elaborado**

- [ ] **Criar `DashboardSummaryCards.tsx`**
  ```tsx
  // 4 cards grandes:
  // 1. Receitas (Provisionadas / Recebidas / A Receber)
  // 2. Despesas (Provisionadas / Pagas / A Pagar)
  // 3. Saldo Projetado vs Real
  // 4. Alertas Urgentes
  ```

- [ ] **Criar `FixedExpensesWidget.tsx`**
  ```tsx
  // Lista de despesas fixas do mês:
  // • Aluguel R$1.000 ⏳ A Pagar (Vence 10/12)
  // • Água R$80 ✅ Pago (05/12)
  // Total: R$1.329,90 | Pago: R$330 | A Pagar: R$999,90
  ```

- [ ] **Criar `VariableExpensesWidget.tsx`**
  ```tsx
  // Lista de despesas variáveis:
  // • Geladeira (3/12) R$400 ✅ Pago
  // • Supermercado R$520 ✅ Pago
  ```

- [ ] **Instalar Chart.js**
  ```bash
  npm install chart.js react-chartjs-2
  ```

- [ ] **Criar gráficos**
  ```tsx
  // Gráfico de Pizza: Despesas por Categoria
  // Gráfico de Barras: Receitas vs Despesas (últimos 6 meses)
  // Gráfico de Linha: Evolução do Saldo
  ```

#### **Dia 10 - Integração e Testes**

- [ ] Testar fluxo completo:
  1. Criar recorrência → Verificar 3 meses gerados
  2. Ver no calendário → Contador aparece
  3. Clicar no dia → Modal abre
  4. Pagar despesa → Alerta de antecipado
  5. Verificar dashboard → Atualiza em tempo real

---

## 🎯 SPRINT 3 - RELATÓRIOS PROFISSIONAIS (1 semana) 📊

**Objetivo:** Relatórios mensais e anuais com exportação PDF/Excel

### **Backend (2 dias)**

#### **Dia 11 - Endpoints de Relatórios**

- [ ] **Criar `GET /reports/monthly`**
  ```typescript
  // Query params: year, month
  // Retorna:
  {
    fixedExpenses: [...],    // Despesas fixas
    variableExpenses: [...], // Despesas variáveis
    fixedIncome: [...],      // Receitas fixas
    totals: {
      fixedExpenses: 1629.90,
      variableExpenses: 1500.00,
      totalExpenses: 3129.90,
      totalIncome: 6500.00,
      balance: 3370.10
    }
  }
  ```

- [ ] **Criar `GET /reports/annual`**
  ```typescript
  // Query param: year
  // Retorna array de 12 meses com totais
  ```

- [ ] **Criar `GET /reports/category`**
  ```typescript
  // Agrupa por categoria
  // Retorna totais por categoria
  ```

### **Frontend (3 dias)**

#### **Dia 12 - Página de Relatórios**

- [ ] **Criar `app/dashboard/reports/page.tsx`**
  ```tsx
  // Abas:
  // - Mensal
  // - Anual
  // - Por Categoria
  // - Por Conta Bancária
  ```

- [ ] **Relatório Mensal**
  ```tsx
  // Seções:
  // 1. Resumo (cards com totais)
  // 2. Despesas Fixas (tabela)
  // 3. Despesas Variáveis (tabela)
  // 4. Receitas Fixas (tabela)
  // 5. Gráfico de pizza (categorias)
  // 6. Botões: [Exportar PDF] [Exportar Excel]
  ```

#### **Dia 13 - Relatório Anual**

- [ ] **Criar comparativo mensal**
  ```tsx
  // Tabela:
  // Mês | Receitas | Despesas Fixas | Despesas Variáveis | Saldo
  // Jan | 6.500    | 1.630          | 1.500              | 3.370
  // ...
  // Total Anual
  ```

- [ ] **Gráficos anuais**
  ```tsx
  // Gráfico de barras: Receitas vs Despesas (12 meses)
  // Gráfico de linha: Evolução do saldo
  ```

#### **Dia 14 - Exportação**

- [ ] **Instalar bibliotecas**
  ```bash
  npm install jspdf jspdf-autotable exceljs
  ```

- [ ] **Exportação PDF**
  ```tsx
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Relatório Mensal - Dezembro 2025', 10, 10);
    // ... adicionar tabelas
    doc.save('relatorio-dezembro-2025.pdf');
  };
  ```

- [ ] **Exportação Excel**
  ```tsx
  const exportExcel = () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Relatório');
    // ... adicionar dados
    workbook.xlsx.writeBuffer().then(buffer => {
      saveAs(new Blob([buffer]), 'relatorio.xlsx');
    });
  };
  ```

---

## 🎯 SPRINT 4 - ALERTAS & NOTIFICAÇÕES (3 dias) 🔔

**Objetivo:** Sistema completo de alertas 3 dias antes

### **Backend (1 dia)**

#### **Dia 15 - Sistema de Notificações**

- [ ] **Criar `POST /notifications`**
  ```typescript
  // Criar notificação manual
  ```

- [ ] **Criar `GET /notifications`**
  ```typescript
  // Listar notificações do usuário
  // Filtro: isRead
  ```

- [ ] **Criar `PUT /notifications/:id/read`**
  ```typescript
  // Marcar como lida
  ```

- [ ] **Criar Cron Job (node-cron)**
  ```typescript
  // Rodar todo dia às 9h:
  // 1. Buscar transações que vencem em 3 dias
  // 2. Criar notificações
  ```

### **Frontend (2 dias)**

#### **Dia 16 - Página de Alertas**

- [ ] **Criar `app/dashboard/alerts/page.tsx`**
  ```tsx
  // Lista de notificações:
  // 🔴 Aluguel vence em 3 dias (R$ 1.000)
  //    Vencimento: 10/12/2025
  //    [Pagar Agora] [Marcar como Lido]
  //
  // 🔴 Luz vence em 5 dias (R$ 150)
  //    [Pagar Agora] [Marcar como Lido]
  ```

- [ ] **Badge na Sidebar**
  ```tsx
  // Hook: useNotifications
  const { unreadCount } = useNotifications();
  
  <Link href="/dashboard/alerts">
    Alertas
    {unreadCount > 0 && (
      <span className="badge">{unreadCount}</span>
    )}
  </Link>
  ```

#### **Dia 17 - Notificações Push**

- [ ] **Configurar Web Push API**
  ```tsx
  // Pedir permissão ao usuário
  const requestPermission = async () => {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Registrar service worker
    }
  };
  ```

- [ ] **Criar Service Worker**
  ```javascript
  // public/sw.js
  self.addEventListener('push', (event) => {
    const data = event.data.json();
    self.registration.showNotification(data.title, {
      body: data.message,
      icon: '/logo.png'
    });
  });
  ```

---

## 📊 STATUS GERAL DO ROADMAP

### ✅ **JÁ IMPLEMENTADO**
- [x] API Client centralizado
- [x] Zustand state management
- [x] Validação com Zod
- [x] Error Boundary
- [x] Toast notifications
- [x] Recurring Bills (7 componentes + hook)
- [x] Installments (4 componentes + hook)
- [x] Calendar (implementação básica)
- [x] UX improvements (campo mensal simplificado)

### 🔄 **EM DESENVOLVIMENTO (SPRINT 1)**
- [ ] Sistema de auto-geração (3 meses)
- [ ] Modal de pagamento profissional
- [ ] Campo "Tipo" (Fixa/Variável)
- [ ] Badge de alertas

### ⏳ **PRÓXIMOS (SPRINTS 2-4)**
- [ ] Calendário elaborado
- [ ] Dashboard com gráficos
- [ ] Relatórios profissionais
- [ ] Sistema de notificações

---

## 🎯 PRIORIDADES CRÍTICAS (NÃO ESQUECER)

### **P0 - Bloqueadores**
1. ⚠️ **Bug: Recurring Bill não aparece após criação**
   - Debug: Adicionar logs em useRecurringBills
   - Verificar resposta GET /recurring-bills
   - Testar com DevTools Network aberto

### **P1 - Alta Prioridade**
2. Auto-geração de recorrências (SPRINT 1)
3. Sistema de pagamento (SPRINT 1)
4. Dashboard elaborado (SPRINT 2)

### **P2 - Média Prioridade**
5. Relatórios (SPRINT 3)
6. Alertas (SPRINT 4)

### **P3 - Baixa Prioridade (Futuro)**
7. Integração WhatsApp
8. Integração Email
9. Multi-usuário
10. PWA Mobile

---

## 📈 MELHORIAS FUTURAS (BACKLOG)

### **Automação com IA**
- [ ] Categorização automática com ML
- [ ] OCR para notas fiscais
- [ ] Insights inteligentes de economia
- [ ] Previsão de gastos futuros

### **Integrações Bancárias**
- [ ] Open Banking (Pluggy/Belvo)
- [ ] Conciliação automática
- [ ] Importação de extratos

### **Mobile**
- [ ] PWA (Progressive Web App)
- [ ] App nativo (React Native)
- [ ] Widgets de resumo

### **Colaboração**
- [ ] Multi-usuário (famílias)
- [ ] Permissões granulares
- [ ] Workflows de aprovação

---

## 📝 NOTAS IMPORTANTES

### **Decisões de Arquitetura**
1. **Recorrências geram 3 meses automático** → Sempre visibilidade futura
2. **Usuário define Fixa/Variável** → Flexibilidade total
3. **Pagamento antecipado é rastreado** → Histórico completo
4. **Transações linkadas à recorrência** → Rastreabilidade

### **Convenções de Código**
- Backend: TypeScript + Prisma + Express
- Frontend: Next.js 14 + Tailwind + Zustand
- Validação: Zod em ambos (frontend + backend)
- Notificações: Sonner (toast) + Web Push

### **Performance**
- Cache de transações: 5 minutos
- Paginação: 50 itens por página
- Lazy loading: Gráficos e relatórios
- Debounce: Buscas e filtros (300ms)

---

**Data:** 27 de Novembro de 2025  
**Status Atual:** Backend 7.5/10 | Frontend 7.5/10 ⬆️ (era 4.5/10)

---

## ✅ PRIORIDADES CRÍTICAS IMPLEMENTADAS

### **1. ✅ API Client Centralizado** (`frontend/src/lib/api.ts`)
- ✅ Interceptor de request: Auto-inject de Bearer token
- ✅ Interceptor de response: Refresh automático em 401
- ✅ Fila de requisições durante refresh
- ✅ Logout automático se refresh falhar
- ✅ Timeout 10s, base URL centralizada
- **Impacto:** Eliminou ~150 linhas de código duplicado

### **2. ✅ State Management com Zustand** (`frontend/src/stores/auth.ts`)
- ✅ Store persistido no localStorage
- ✅ Estado reativo entre componentes
- ✅ Hooks: useUser, useTenant, useIsAuthenticated
- ✅ Funções: setAuth, updateTokens, logout
- **Impacto:** Estado sincronizado em tempo real

### **3. ✅ Validação de Formulários** (`frontend/src/schemas/validations.ts`)
- ✅ Schemas Zod para todas entidades
- ✅ Transações, categorias, contas, pagamentos
- ✅ Orçamentos e contas recorrentes
- ✅ Mensagens de erro em português
- **Impacto:** Type-safe, validação antes do envio

### **4. ✅ Refatoração Frontend Completa**
- ✅ Login/Register usando Zustand
- ✅ Dashboard principal com API client
- ✅ 9 páginas refatoradas automaticamente
- **Impacto:** ~1000 linhas duplicadas → 574 linhas reutilizáveis

---

## ✅ MELHORIAS DE UX IMPLEMENTADAS

### **5. ✅ Error Boundary** (`frontend/src/components/ErrorBoundary.tsx`)
- ✅ Captura crashes React não tratados
- ✅ UI de fallback amigável com ações
- ✅ Stack trace em desenvolvimento
- ✅ Botões: Tentar Novamente, Voltar ao Início
- **Impacto:** App não quebra completamente em erros

### **6. ✅ Toast Notifications** (Sonner)
- ✅ Integrado no layout.tsx
- ✅ Substituiu todos os `alert()` por toasts
- ✅ Feedback visual: success, error, loading
- ✅ Position top-right, 4s duration
- **Impacto:** UX profissional, não-bloqueante

### **7. ✅ Loading Skeletons** (`frontend/src/components/Skeletons.tsx`)
- ✅ DashboardMetricsSkeleton (4 cards)
- ✅ ChartSkeleton (gráficos)
- ✅ RankingCardSkeleton (top receitas/despesas)
- ✅ TransactionTableSkeleton (tabela)
- ✅ FormSkeleton, ListSkeleton, ButtonSkeleton
- **Impacto:** Perceived performance, UX suave

---

## 📊 Situação Atual

### ✅ Backend (Nota: 7.5/10) - BOM
- ✅ Documentação completa (Swagger/OpenAPI, README, .env.example)
- ✅ 71 testes passando (18% coverage)
- ✅ Autenticação JWT com refresh tokens
- ✅ Multi-tenant funcional
- ✅ Rate limiting configurável
- ✅ Redis caching operacional
- ⚠️ Falta: Maior cobertura de testes, monitoring, health checks

### ❌ Frontend (Nota: 4.5/10) - PRECISA MELHORAR
- ✅ UI funcional (10 páginas de dashboard)
- ✅ Autenticação básica funcionando
- ❌ **CRÍTICO:** Sem interceptor Axios (token manual em cada request)
- ❌ **CRÍTICO:** Sem refresh automático de token (usuário é deslogado)
- ❌ **CRÍTICO:** Sem state management (localStorage não reativo)
- ❌ Sem validação de formulários
- ❌ Sem tratamento global de erros
- ❌ 0% cobertura de testes

---

## 📊 Estado Atual do Projeto

### ✅ Backend (7.5/10) - BOM
- ✅ Documentação completa (Swagger/OpenAPI, README, .env.example)
- ✅ 71 testes passando (18% coverage)
- ✅ Autenticação JWT com refresh tokens
- ✅ Multi-tenant funcional
- ✅ Rate limiting configurável (100 dev / 5 prod)
- ✅ Redis caching operacional
- ⚠️ Falta: Maior cobertura de testes, monitoring, health checks

### ✅ Frontend (7.5/10) - MELHORADO ⬆️ (era 4.5/10)

**Implementações Concluídas:**
- ✅ API Client centralizado (`src/lib/api.ts`)
  - Interceptor de request: auto-inject token
  - Interceptor de response: refresh automático em 401
  - Fila de requisições durante refresh
  - Logout automático se refresh falhar
  
- ✅ State Management (`src/stores/auth.ts`)
  - Zustand com persist middleware
  - Hooks: useUser, useTenant, useIsAuthenticated
  - Estado reativo entre componentes
  
- ✅ Validação de Formulários (`src/schemas/validations.ts`)
  - 8 schemas Zod com mensagens em português
  - Type-safe com TypeScript
  
- ✅ Error Boundary (`src/components/ErrorBoundary.tsx`)
  - Captura crashes React não tratados
  - UI de fallback amigável
  
- ✅ Toast Notifications (Sonner)
  - Substituiu alerts por toasts no dashboard principal
  - Feedback visual profissional
  
- ✅ Loading Skeletons (`src/components/Skeletons.tsx`)
  - 12 componentes de skeleton criados
  - Aplicado no dashboard principal

**Próximas Melhorias (Opcionais):**
- ⏳ Aplicar skeletons em 9 páginas restantes
- ⏳ Substituir alerts por toasts nas 9 páginas restantes
- 🔄 Integrar React Hook Form com schemas Zod
- 🔄 Testes frontend (Jest + React Testing Library)
- 🔄 Performance: memo, useMemo, lazy loading

---

## 🎯 INSTRUÇÕES DE IMPLEMENTAÇÃO

> **⚠️ NOTA:** As 3 prioridades críticas abaixo já foram implementadas!  
> O código está no sistema e funcionando. Use estas instruções apenas como referência.

### ~~1. Criar API Client Centralizado~~ ✅ COMPLETO

**Status:** ✅ Implementado em `frontend/src/lib/api.ts` (151 linhas)

<details>
<summary>📁 Ver código implementado (clique para expandir)</summary>
```typescript
// frontend/src/lib/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  timeout: 10000,
});

// Interceptor de Request - Adiciona token automaticamente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de Response - Refresh automático
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Se 401 e não é retry, tenta refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            'http://localhost:3000/api/v1/auth/refresh',
            { refreshToken }
          );

          // Salva novo token
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);

          // Reexecuta request original
          originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api.request(originalRequest);
        } catch (refreshError) {
          // Refresh falhou, desloga
          localStorage.clear();
          window.location.href = '/';
          return Promise.reject(refreshError);
        }
      } else {
        // Sem refresh token, desloga
        localStorage.clear();
        window.location.href = '/';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

**Impacto:**
- ✅ Remove 100+ linhas de código duplicado
- ✅ Token refresh automático (usuário não é deslogado)
- ✅ Única fonte de verdade para API calls
- ✅ Facilita manutenção futura

**Arquivos a modificar:**
- Criar: `frontend/src/lib/api.ts`
- Refatorar (10 arquivos):
  - `dashboard/page.tsx`
  - `dashboard/transactions/page.tsx`
  - `dashboard/bank-accounts/page.tsx`
  - `dashboard/categories/page.tsx`
  - `dashboard/payment-methods/page.tsx`
  - `dashboard/recurring-bills/page.tsx`
  - `dashboard/installments/page.tsx`
  - `dashboard/budgets/page.tsx`
  - `dashboard/reports/page.tsx`
  - `dashboard/calendar/page.tsx`

**Exemplo de refatoração:**
```typescript
// ANTES (dashboard/page.tsx)
const token = localStorage.getItem('accessToken');
const config = { headers: { Authorization: `Bearer ${token}` } };
const response = await axios.get(`${API_URL}/dashboard/balance`, config);

// DEPOIS
import api from '@/lib/api';
const response = await api.get('/dashboard/balance');
```

</details>

---

### ~~2. Implementar State Management com Zustand~~ ✅ COMPLETO

**Status:** ✅ Implementado em `frontend/src/stores/auth.ts` (175 linhas)

<details>
<summary>📁 Ver código implementado (clique para expandir)</summary>
```bash
npm install zustand
```

```typescript
// frontend/src/stores/auth.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  
  setAuth: (tokens: { accessToken: string; refreshToken: string }, user: User, tenant: Tenant) => void;
  logout: () => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (tokens, user, tenant) => {
        set({
          user,
          tenant,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          user: null,
          tenant: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      updateTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
```

**Uso:**
```typescript
// Em qualquer componente
import { useAuth } from '@/stores/auth';

function Dashboard() {
  const { user, tenant, logout } = useAuth();
  
  return (
    <div>
      <h1>Olá, {user?.fullName}</h1>
      <p>Tenant: {tenant?.name}</p>
      <button onClick={logout}>Sair</button>
    </div>
  );
}
```

**Impacto:**
- ✅ Estado reativo entre páginas
- ✅ Persistência automática
- ✅ TypeScript type-safe
- ✅ Integração fácil com interceptor

</details>

---

### ~~3. Implementar Validação de Formulários~~ ✅ COMPLETO

**Status:** ✅ Schemas criados em `frontend/src/schemas/validations.ts` (248 linhas)  
⏳ **Pendente:** Integração com React Hook Form nos formulários

<details>
<summary>📁 Ver código implementado (clique para expandir)</summary>
```bash
npm install react-hook-form zod @hookform/resolvers
```

```typescript
// frontend/src/schemas/transaction.ts
import { z } from 'zod';

export const transactionSchema = z.object({
  description: z.string().min(3, 'Descrição deve ter no mínimo 3 caracteres'),
  amount: z.number().positive('Valor deve ser positivo'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  type: z.enum(['income', 'expense']),
  categoryId: z.string().uuid('Categoria inválida'),
  bankAccountId: z.string().uuid('Conta inválida').optional(),
  paymentMethodId: z.string().uuid('Método de pagamento inválido').optional(),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;
```

```typescript
// Uso em formulário
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function TransactionForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
  });

  const onSubmit = async (data: TransactionFormData) => {
    await api.post('/transactions', data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('description')} />
      {errors.description && <span>{errors.description.message}</span>}
      {/* ... */}
    </form>
  );
}
```

**Impacto:**
- ✅ Validação client-side antes de enviar
- ✅ Mensagens de erro claras
- ✅ TypeScript type-safe
- ✅ Reduz erros de backend

---

## 🔥 ALTA PRIORIDADE (Próxima semana - 3-5 dias)

### 4. Error Boundary Global
```typescript
// frontend/src/components/ErrorBoundary.tsx
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Algo deu errado</h1>
            <p className="text-gray-600 mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 5. Toast Notifications
```bash
npm install sonner
```

```typescript
// frontend/src/app/layout.tsx
import { Toaster } from 'sonner';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
```

```typescript
// Uso
import { toast } from 'sonner';

toast.success('Transação criada com sucesso!');
toast.error('Erro ao criar transação');
toast.loading('Salvando...');
```

</details>

---

### ~~6. Loading States (Skeletons)~~ ✅ COMPLETO

**Status:** ✅ Componentes criados em `frontend/src/components/Skeletons.tsx` (185 linhas)  
✅ Aplicado no dashboard principal  
⏳ **Pendente:** Aplicar em 9 páginas restantes

<details>
<summary>📁 Ver código implementado (clique para expandir)</summary>
```bash
npm install react-loading-skeleton
```

```typescript
// frontend/src/components/DashboardSkeleton.tsx
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} height={120} />
      ))}
    </div>
  );
}
```

### 7. Protected Routes (Route Guards)
```typescript
// frontend/src/components/ProtectedRoute.tsx
import { useAuth } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
```

</details>

---

## ⚡ PRÓXIMAS MELHORIAS (Opcionais)

### 8. ⏳ Aplicar Skeletons nas Páginas Restantes
**Status:** 1 de 10 páginas completo (dashboard principal)

**Páginas Pendentes:**
- `/dashboard/transactions` - TransactionTableSkeleton
- `/dashboard/bank-accounts` - ListSkeleton
- `/dashboard/categories` - ListSkeleton
- `/dashboard/payment-methods` - ListSkeleton
- `/dashboard/recurring-bills` - ListSkeleton
- `/dashboard/installments` - ListSkeleton
- `/dashboard/budgets` - FormSkeleton + ListSkeleton
- `/dashboard/reports` - ChartSkeleton
- `/dashboard/calendar` - CalendarSkeleton (criar novo)

**Tempo Estimado:** 1-2 horas

---

### 9. ⏳ Substituir Alerts por Toasts nas Páginas Restantes
**Status:** 1 de 10 páginas completo (dashboard principal)

**Padrão:**
```typescript
// ANTES
alert('Erro ao criar');

// DEPOIS
toast.error('Erro ao criar');
```

**Tempo Estimado:** 1 hora

---

### 10. 🔄 Integrar React Hook Form com Schemas Zod
**Status:** Schemas criados, falta integrar nos formulários

**Exemplo:**
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { transactionSchema } from '@/schemas/validations';

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(transactionSchema)
});
```

**Tempo Estimado:** 2-3 horas

---

### 11. 🔄 Setup de Testes Frontend
```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
```

**Meta:** 40-60% coverage em componentes críticos
- Testes de autenticação (login, refresh, logout)
- Testes de formulários (validação Zod)
- Testes de interceptors (API client)
- Testes de listagens (CRUD básico)

**Tempo Estimado:** 3-4 horas

---

### 12. 🔄 Aumentar Cobertura Backend
**Status Atual:** 18% coverage  
**Meta:** 40-60% coverage

**Áreas Prioritárias:**
- Testar rotas de dashboard completas
- Testar rotas de relatórios
- Testar edge cases de autenticação
- Testar multi-tenancy
- Testar rate limiting

### 10. Documentar Rotas Restantes
- Dashboard endpoints (6 rotas)
- Categories CRUD (5 rotas)
- Bank Accounts CRUD (5 rotas)
- Reports (3 rotas)

---

## 🔧 BAIXA PRIORIDADE (Depois do MVP)

**Tempo Estimado:** 2-3 horas

---

### 13. 🔄 Performance Optimization
- React.memo em componentes pesados (tabelas, gráficos)
- useMemo/useCallback em cálculos e event handlers
- Lazy loading de páginas do dashboard
- Image optimization com next/image
- Code splitting

**Tempo Estimado:** 3-4 horas

---

### 14. 🔄 Production Readiness
- Docker Compose full stack (frontend + backend + PostgreSQL + Redis)
- CI/CD pipeline (GitHub Actions)
- Monitoring (Sentry frontend/backend)
- Health check endpoints
- Backup strategy PostgreSQL

**Tempo Estimado:** 1-2 dias

---

### 15. 🔄 Features Avançadas
- PWA support (offline-first)
- Real-time notifications (WebSocket)
- Export PDF/Excel de relatórios
- Dashboards customizáveis
- Dark mode

**Tempo Estimado:** 1-2 semanas

---

## 📋 Checklist de Implementação

### ✅ Fase 1 - Crítico (COMPLETO)
- [x] Criar `lib/api.ts` com interceptors
- [x] Refatorar 10 páginas para usar novo API client
- [x] Instalar e configurar Zustand
- [x] Migrar autenticação para Zustand
- [x] Testar refresh automático de token ✅ Funciona!
- [x] Instalar React Hook Form + Zod
- [x] Criar schemas de validação (8 entidades)

### ✅ Fase 2 - UX (COMPLETO)
- [x] Implementar ErrorBoundary
- [x] Adicionar Toast notifications (Sonner)
- [x] Criar skeletons para loading states (12 componentes)
- [x] Integrar toasts e skeletons no dashboard principal

### ⏳ Fase 3 - Refinamento (OPCIONAL)
- [ ] Aplicar skeletons em 9 páginas restantes
- [ ] Substituir alerts por toasts em 9 páginas restantes
- [ ] Integrar React Hook Form nos formulários
- [ ] Implementar ProtectedRoute component
- [ ] Testar fluxo completo end-to-end

### 🔄 Fase 4 - Testes (DEFERRED)
- [ ] Setup Jest + React Testing Library
- [ ] Escrever testes de autenticação
- [ ] Escrever testes de formulários
- [ ] Escrever testes de API client interceptor
- [ ] Aumentar coverage backend para 40-60%

### 🔄 Fase 5 - Performance & Produção (FUTURE)
- [ ] Performance optimizations (memo, lazy loading)
- [ ] Docker Compose production
- [ ] CI/CD GitHub Actions
- [ ] Monitoring Sentry
- [ ] Documentar rotas restantes no Swagger

---

## 🎯 KPIs de Sucesso

### Métricas Técnicas
- **Frontend Coverage:** 0% → 60% (testes)
- **Backend Coverage:** 18% → 40%
- **Código Duplicado:** -70% (com API client)
- **Tempo de Resposta:** < 200ms (95th percentile)

## 📊 KPIs de Sucesso

### Métricas de Qualidade
- **Cobertura de testes backend:** 18% → 40-60%
- **Cobertura de testes frontend:** 0% → 40-60%
- **Duplicação de código:** ~1000 linhas → 0 ✅
- **Bugs de autenticação:** Resolvidos ✅
- **Tempo de resposta API:** < 200ms média

### Métricas de Experiência
- **Token refresh:** Automático, transparente ✅
- **Feedback visual:** Toast em todas ações (1/10 páginas) ⏳
- **Loading states:** Skeletons (1/10 páginas) ⏳
- **Validação:** Mensagens em português ✅
- **Crashes:** Capturados por ErrorBoundary ✅

### Notas de Qualidade
- **Backend:** 7.5/10 ✅ (meta: 8.5)
- **Frontend:** 7.5/10 ✅ (era 4.5, meta: 8.0)
- **Sistema Geral:** 7.5/10 ✅ (era 6.0, meta: 8.0)

---

## 💡 Comandos Úteis

```bash
# ✅ Dependências já instaladas
cd frontend
npm install zustand                                    # ✅ INSTALADO
npm install react-hook-form zod @hookform/resolvers   # ✅ INSTALADO
npm install sonner                                     # ✅ INSTALADO
npm install react-loading-skeleton                    # ✅ INSTALADO

# Rodar servidores
cd backend
npm run dev              # Backend: http://localhost:3000

cd frontend
npm run dev              # Frontend: http://localhost:3001

# Rodar testes
cd backend
npm test                 # 71 testes passando (18% coverage)
npm run test:coverage    # Ver relatório completo
npm test -- --coverage      # Com coverage

# Build
npm run build              # Backend
cd ../frontend && npm run build  # Frontend
```

---

## 📞 Próximos Passos Imediatos

1. **AGORA:** Criar API client com interceptor
2. **HOJE:** Implementar Zustand para auth
3. **AMANHÃ:** Refatorar todas as páginas
4. **DIA 3:** Adicionar validação de formulários
5. **DIA 4-5:** Error boundaries + Toast + Loading states

**Estimativa total:** 1-2 semanas para prioridades críticas e altas

---

**Dúvidas?** Consulte:
- Swagger: http://localhost:3000/api-docs
- Backend README: `backend/README.md`
- Este documento: `PRIORIDADES-DESENVOLVIMENTO.md`
