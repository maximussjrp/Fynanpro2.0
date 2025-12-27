# INVENTÁRIO FRONTEND - UTOP
**Data:** 25/Dezembro/2025  
**Sincronizado do servidor:** 91.99.16.145:/opt/utop  

---

## 📊 RESUMO EXECUTIVO

### Estatísticas
- **Páginas no Dashboard:** 12 rotas principais
- **Páginas Admin:** 8 rotas  
- **Componentes:** 20+ componentes
- **Modais Críticos:** 6 modais principais
- **Hooks Customizados:** 2 hooks (useRecurringBills, useInstallments)

### ⚠️ PROBLEMA PRINCIPAL IDENTIFICADO
Os componentes UI padronizados existem (`Input`, `Select`, `DateInput`) mas **NÃO ESTÃO SENDO USADOS** nas páginas e modais. Cada arquivo tem estilos inline repetitivos.

---

## 🗂️ ESTRUTURA DE ROTAS

### Área Pública
| Rota | Arquivo | Linhas | Status Mobile |
|------|---------|--------|---------------|
| `/` (Login/Registro) | `app/page.tsx` | 524 | 🔍 Verificar |
| `/verify-email` | `app/verify-email/page.tsx` | ~100 | ✅ Simples |
| `/privacidade` | `app/privacidade/page.tsx` | ~400 | ✅ Texto |

### Dashboard (Usuário)
| Rota | Arquivo | Linhas | Status Mobile |
|------|---------|--------|---------------|
| `/dashboard` | `dashboard/page.tsx` | ~1300 | ⚠️ CRÍTICO |
| `/dashboard/transactions` | `dashboard/transactions/page.tsx` | ~700 | ⚠️ CRÍTICO |
| `/dashboard/recurring-bills` | `dashboard/recurring-bills/page.tsx` | ~200 | ⚠️ Verificar |
| `/dashboard/installments` | `dashboard/installments/page.tsx` | ~150 | ⚠️ Verificar |
| `/dashboard/categories` | `dashboard/categories/page.tsx` | ~600 | 🔍 Verificar |
| `/dashboard/reports` | `dashboard/reports/page.tsx` | ~500 | ⚠️ Verificar |
| `/dashboard/calendar` | `dashboard/calendar/page.tsx` | ~300 | 🔍 Verificar |
| `/dashboard/bank-accounts` | `dashboard/bank-accounts/page.tsx` | ~600 | 🔍 Verificar |
| `/dashboard/budgets` | `dashboard/budgets/page.tsx` | ~500 | 🔍 Verificar |
| `/dashboard/imports` | `dashboard/imports/page.tsx` | ~800 | 🔍 Verificar |
| `/dashboard/planning` | `dashboard/planning/page.tsx` | ~700 | 🔍 Verificar |
| `/dashboard/plans` | `dashboard/plans/page.tsx` | ~350 | ✅ |
| `/dashboard/settings` | `dashboard/settings/page.tsx` | ~700 | 🔍 Verificar |

### Admin (Super Admin)
| Rota | Arquivo | Linhas | Status |
|------|---------|--------|--------|
| `/admin` | `admin/page.tsx` | ~700 | Desktop-only |
| `/admin/tenants` | `admin/tenants/page.tsx` | ~500 | Desktop-only |
| `/admin/users` | `admin/users/page.tsx` | ~400 | Desktop-only |
| `/admin/subscriptions` | `admin/subscriptions/page.tsx` | ~500 | Desktop-only |
| `/admin/announcements` | `admin/announcements/page.tsx` | ~400 | Desktop-only |
| `/admin/coupons` | `admin/coupons/page.tsx` | ~600 | Desktop-only |
| `/admin/logs` | `admin/logs/page.tsx` | ~300 | Desktop-only |
| `/admin/reports` | `admin/reports/page.tsx` | ~300 | Desktop-only |
| `/admin/settings` | `admin/settings/page.tsx` | ~600 | Desktop-only |

---

## 🧩 COMPONENTES

### UI Base (Padronizados) ✅
Estes componentes estão prontos e bem feitos:

| Componente | Arquivo | Features |
|------------|---------|----------|
| `Input` | `components/ui/Input.tsx` | forwardRef, min-h-[44px], leftIcon/rightIcon, error state |
| `Select` | `components/ui/Select.tsx` | forwardRef, min-h-[44px], custom arrow, leftIcon |
| `DateInput` | `components/ui/DateInput.tsx` | forwardRef, colorScheme:light, iOS compatible |

### Modais Principais ⚠️
Estes modais **NÃO USAM** os componentes UI padronizados:

| Modal | Arquivo | Linhas | Problema |
|-------|---------|--------|----------|
| `NewTransactionModal` | `components/NewTransactionModal.tsx` | 947 | Estilos inline |
| `UnifiedTransactionModal` | `components/UnifiedTransactionModal.tsx` | ~1000 | Estilos inline |
| `CreateBillModal` | `components/recurring-bills/CreateBillModal.tsx` | 367 | Estilos inline |
| `EditBillModal` | `components/recurring-bills/EditBillModal.tsx` | ~400 | Estilos inline |
| `CreateInstallmentModal` | `components/installments/CreateInstallmentModal.tsx` | ~300 | Estilos inline |
| `ChatbotWidget` | `components/ChatbotWidget.tsx` | ~300 | Verificar |

### Cards e Grids
| Componente | Arquivo | Status |
|------------|---------|--------|
| `RecurringBillCard` | `components/recurring-bills/RecurringBillCard.tsx` | 🔍 Verificar |
| `InstallmentCard` | `components/installments/InstallmentCard.tsx` | 🔍 Verificar |
| `BillsGrid` | `components/recurring-bills/BillsGrid.tsx` | ✅ Layout |
| `InstallmentsGrid` | `components/installments/InstallmentsGrid.tsx` | ✅ Layout |

### Headers e Navegação
| Componente | Arquivo | Status |
|------------|---------|--------|
| `Sidebar` | `components/Sidebar.tsx` | ✅ Bom |
| `DashboardHeader` | `components/DashboardHeader.tsx` | 🔍 Verificar |
| `RecurringBillsHeader` | `components/recurring-bills/RecurringBillsHeader.tsx` | 🔍 Verificar |
| `InstallmentsHeader` | `components/installments/InstallmentsHeader.tsx` | 🔍 Verificar |

### Outros
| Componente | Arquivo | Status |
|------------|---------|--------|
| `AuthProvider` | `components/AuthProvider.tsx` | ✅ OK |
| `Logo` | `components/Logo.tsx` | ✅ OK |
| `DashboardInsights` | `components/DashboardInsights.tsx` | 🔍 Verificar |
| `QuickActions` | `components/QuickActions.tsx` | 🔍 Verificar |
| `TrialBanner` | `components/TrialBanner.tsx` | 🔍 Verificar |
| `Skeletons` | `components/Skeletons.tsx` | ✅ OK |
| `ErrorBoundary` | `components/ErrorBoundary.tsx` | ✅ OK |
| `NotificationBell` | `components/NotificationBell.tsx` | 🔍 Verificar |
| `OnboardingRecurringBills` | `components/OnboardingRecurringBills.tsx` | 🔍 Verificar |

---

## 🎨 TOKENS DE DESIGN (Tailwind)

### Cores Principais
```css
/* Primária (Azul) */
--primary: #1F4FD8
--primary-dark: #1A44BF

/* Accent (Dourado UTOP) */
--accent: #C9A962

/* Success (Verde) */
--success: #2ECC9A
--success-bg: bg-green-50

/* Error (Vermelho) */
--error: #EF4444
--error-bg: bg-red-50

/* Neutrals */
--text-primary: #0F172A
--text-secondary: #475569
--text-muted: #94A3B8
--border: #CBD5E1
--bg-input: #F8FAFC / #F9FAFB
```

### Espaçamentos Usados
- `px-4 py-3` → padding inputs
- `py-3.5` → padding inputs login
- `min-h-[44px]` → touch target
- `gap-4`, `gap-6` → spacing grids
- `rounded-xl`, `rounded-2xl` → border radius

### Tipografia
- `font-poppins` / `font-['Poppins']` → títulos
- `font-inter` → body text
- `text-sm` → labels/inputs
- `text-2xl`, `text-3xl` → headings

---

## 📱 PRIORIDADE PARA AUDITORIA MOBILE

### CRÍTICO (Mais usados no mobile)
1. **`/dashboard`** - Dashboard principal
2. **`NewTransactionModal`** - Criar transação (mais usado!)
3. **`/` (Login/Registro)** - Primeira impressão
4. **`/dashboard/transactions`** - Lista de transações
5. **`CreateBillModal`** - Criar conta recorrente

### IMPORTANTE
6. **`/dashboard/recurring-bills`** - Lista de recorrentes
7. **`/dashboard/installments`** - Lista de parcelas
8. **`ChatbotWidget`** - Chatbot ISIS
9. **`/dashboard/reports`** - Relatórios
10. **`/dashboard/calendar`** - Calendário

### SECUNDÁRIO
11. Demais páginas do dashboard
12. Área Admin (desktop-only)

---

## 🔧 PLANO DE CORREÇÃO

### Fase 1: Auditar os 5 CRÍTICOS
Para cada um, verificar em 360px e 375px:
- [ ] Inputs com contraste visível
- [ ] Touch targets ≥ 44px
- [ ] Date pickers funcionais no iOS
- [ ] Selects com texto visível
- [ ] Modais não cortados
- [ ] Scroll funcional

### Fase 2: Migrar para componentes UI
Substituir estilos inline por:
```tsx
import { Input, Select, DateInput } from '@/components/ui';

// Em vez de:
<input className="w-full px-4 py-3 min-h-[44px] border-2..." />

// Usar:
<Input />
```

### Fase 3: Criar componentes faltantes
- `Button` (primário, secundário, danger)
- `Modal` (wrapper padrão)
- `Card` (container padrão)

---

## 📝 NOTAS

1. **Estilos Consistentes**: Os inputs já têm `min-h-[44px]` e `text-gray-900` em muitos lugares, mas de forma ad-hoc
2. **iOS Safari**: O `DateInput` tem `colorScheme: 'light'` que é essencial
3. **Focus Ring**: Padrão é `focus:ring-2 focus:ring-[#1F4FD8]`
4. **Background Inputs**: Alternância entre `bg-white` e `bg-[#F9FAFB]`/`bg-[#F8FAFC]`

---

*Gerado automaticamente em 25/Dez/2025*
