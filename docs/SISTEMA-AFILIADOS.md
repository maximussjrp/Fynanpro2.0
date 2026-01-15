# 📋 ESCOPO COMPLETO - SISTEMA DE AFILIADOS UTOP

> **Status**: Pendente de implementação  
> **Data de criação**: 15/01/2026  
> **Estimativa**: ~27 horas de desenvolvimento

---

## ✅ REGRAS DE NEGÓCIO DEFINIDAS

| Regra | Definição |
|-------|-----------|
| Aprovação | Super master aprova cadastros |
| Comissão | **50% de cada pagamento** |
| Duração | **Vitalício** (enquanto cliente pagar) |
| Cancelamento | Só recebe pelos meses que o cliente pagou |
| Troca de plano | Comissão recalculada sobre novo valor |
| Pagamento mínimo | Sem mínimo |
| Anti-fraude | 30 dias após pagamento do cliente |
| Link | Único e exclusivo, com opção de regenerar |
| Afiliado = Cliente? | **NÃO** - Contas separadas |
| Forma de pagamento | PIX ou TED |
| Acesso ao painel | Só após aprovação |
| Material | Banners + Textos prontos |

---

## 🗄️ BANCO DE DADOS - NOVOS MODELOS

### 1. `Affiliate` - Cadastro do Afiliado

```prisma
model Affiliate {
  id                String    @id @default(uuid())
  
  // Dados pessoais (obrigatórios)
  name              String
  email             String    @unique
  phone             String
  cpfCnpj           String    @unique
  
  // Dados opcionais
  socialMedia       String?   // JSON com redes sociais
  howToPromote      String?   // Como pretende divulgar
  
  // Credenciais
  passwordHash      String
  
  // Link de afiliado
  referralCode      String    @unique  // Código único (ex: ABC123)
  
  // Dados de pagamento
  pixKeyType        String?   // cpf, cnpj, email, phone, random
  pixKey            String?
  bankName          String?
  bankAgency        String?
  bankAccount       String?
  
  // Status
  status            String    @default("pending") // pending, approved, rejected, suspended
  approvedAt        DateTime?
  approvedBy        String?   // ID do super master
  rejectionReason   String?
  
  // Estatísticas (calculadas)
  totalClicks       Int       @default(0)
  totalSignups      Int       @default(0)
  totalConversions  Int       @default(0)
  totalEarnings     Decimal   @default(0) @db.Decimal(15, 2)
  pendingBalance    Decimal   @default(0) @db.Decimal(15, 2)
  availableBalance  Decimal   @default(0) @db.Decimal(15, 2)
  paidBalance       Decimal   @default(0) @db.Decimal(15, 2)
  
  // Tokens
  emailVerificationToken   String?
  emailVerified            Boolean   @default(false)
  passwordResetToken       String?
  passwordResetExpires     DateTime?
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relações
  referrals         AffiliateReferral[]
  commissions       AffiliateCommission[]
  withdrawals       AffiliateWithdrawal[]
  
  @@index([status])
  @@index([referralCode])
  @@index([email])
}
```

### 2. `AffiliateReferral` - Clientes Indicados

```prisma
model AffiliateReferral {
  id              String    @id @default(uuid())
  affiliateId     String
  tenantId        String    @unique  // Cliente indicado
  
  // Rastreamento
  referralCode    String    // Código usado
  ipAddress       String?
  userAgent       String?
  
  // Status
  status          String    @default("signed_up") // signed_up, subscribed, cancelled
  subscribedAt    DateTime?
  cancelledAt     DateTime?
  
  createdAt       DateTime  @default(now())
  
  affiliate       Affiliate @relation(fields: [affiliateId], references: [id])
  
  @@index([affiliateId])
  @@index([tenantId])
  @@index([status])
}
```

### 3. `AffiliateCommission` - Comissões

```prisma
model AffiliateCommission {
  id              String    @id @default(uuid())
  affiliateId     String
  referralId      String    // AffiliateReferral
  tenantId        String    // Cliente que pagou
  
  // Valores
  paymentAmount   Decimal   @db.Decimal(15, 2)  // Valor pago pelo cliente
  commissionRate  Decimal   @db.Decimal(5, 4)   // 0.50 = 50%
  commissionAmount Decimal  @db.Decimal(15, 2)  // Valor da comissão
  
  // Referência ao pagamento
  stripePaymentId String?   // ID do pagamento no Stripe
  paymentDate     DateTime  // Data do pagamento do cliente
  
  // Status
  status          String    @default("pending") // pending, available, paid, cancelled
  availableAt     DateTime  // paymentDate + 30 dias
  paidAt          DateTime?
  withdrawalId    String?   // Quando for pago
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  affiliate       Affiliate @relation(fields: [affiliateId], references: [id])
  
  @@index([affiliateId, status])
  @@index([tenantId])
  @@index([availableAt])
  @@index([status])
}
```

### 4. `AffiliateWithdrawal` - Saques

```prisma
model AffiliateWithdrawal {
  id              String    @id @default(uuid())
  affiliateId     String
  
  // Valor
  amount          Decimal   @db.Decimal(15, 2)
  
  // Dados do pagamento
  paymentMethod   String    // pix, ted
  pixKeyType      String?
  pixKey          String?
  bankName        String?
  bankAgency      String?
  bankAccount     String?
  
  // Status
  status          String    @default("pending") // pending, processing, paid, failed, cancelled
  processedAt     DateTime?
  processedBy     String?   // ID do super master
  paidAt          DateTime?
  failedReason    String?
  proofUrl        String?   // URL do comprovante
  
  // Notas
  notes           String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  affiliate       Affiliate @relation(fields: [affiliateId], references: [id])
  
  @@index([affiliateId, status])
  @@index([status])
}
```

---

## 🌐 PÁGINAS - FRONTEND

### Páginas Públicas

| Rota | Descrição |
|------|-----------|
| `/afiliados` | Landing page do programa de afiliados |
| `/afiliados/cadastro` | Formulário de cadastro |
| `/afiliados/login` | Login do afiliado |
| `/afiliados/esqueci-senha` | Recuperação de senha |
| `/afiliados/redefinir-senha` | Nova senha |

### Área do Afiliado (após aprovação)

| Rota | Descrição |
|------|-----------|
| `/afiliado` | Dashboard com estatísticas |
| `/afiliado/link` | Seu link + opção de gerar novo |
| `/afiliado/indicados` | Lista de clientes indicados |
| `/afiliado/comissoes` | Histórico de comissões |
| `/afiliado/saques` | Solicitar saque + histórico |
| `/afiliado/materiais` | Banners e textos para divulgação |
| `/afiliado/configuracoes` | Dados pessoais e de pagamento |

### Admin (Super Master)

| Rota | Descrição |
|------|-----------|
| `/admin/afiliados` | Lista de afiliados |
| `/admin/afiliados/pendentes` | Aprovar/rejeitar cadastros |
| `/admin/afiliados/[id]` | Detalhes de um afiliado |
| `/admin/afiliados/saques` | Processar saques |
| `/admin/afiliados/relatorios` | Relatórios gerais |

---

## 🔌 API - BACKEND

### Rotas Públicas (Afiliado)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/affiliate/register` | Cadastro |
| POST | `/api/v1/affiliate/login` | Login |
| POST | `/api/v1/affiliate/forgot-password` | Esqueci senha |
| POST | `/api/v1/affiliate/reset-password` | Redefinir senha |
| GET | `/api/v1/affiliate/verify-email/:token` | Verificar email |

### Rotas Autenticadas (Afiliado)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/affiliate/me` | Dados do afiliado |
| PUT | `/api/v1/affiliate/me` | Atualizar dados |
| GET | `/api/v1/affiliate/dashboard` | Estatísticas |
| GET | `/api/v1/affiliate/link` | Seu link |
| POST | `/api/v1/affiliate/link/regenerate` | Gerar novo link |
| GET | `/api/v1/affiliate/referrals` | Clientes indicados |
| GET | `/api/v1/affiliate/commissions` | Comissões |
| GET | `/api/v1/affiliate/withdrawals` | Histórico de saques |
| POST | `/api/v1/affiliate/withdrawals` | Solicitar saque |
| GET | `/api/v1/affiliate/materials` | Materiais de divulgação |

### Rotas Admin

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/admin/affiliates` | Listar afiliados |
| GET | `/api/v1/admin/affiliates/pending` | Pendentes de aprovação |
| GET | `/api/v1/admin/affiliates/:id` | Detalhes |
| PUT | `/api/v1/admin/affiliates/:id/approve` | Aprovar |
| PUT | `/api/v1/admin/affiliates/:id/reject` | Rejeitar |
| PUT | `/api/v1/admin/affiliates/:id/suspend` | Suspender |
| GET | `/api/v1/admin/affiliates/withdrawals` | Saques pendentes |
| PUT | `/api/v1/admin/affiliates/withdrawals/:id/process` | Processar saque |
| PUT | `/api/v1/admin/affiliates/withdrawals/:id/complete` | Marcar como pago |
| GET | `/api/v1/admin/affiliates/reports` | Relatórios |

### Webhook/Integração Stripe

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/webhooks/stripe` | **Atualizar** para criar comissão quando pagamento confirmado |

---

## 🔄 FLUXOS COMPLETOS

### 1. Cadastro do Afiliado

```
1. Pessoa acessa /afiliados
2. Clica em "Quero ser afiliado"
3. Preenche formulário (nome, email, telefone, CPF/CNPJ, senha)
4. Recebe email de verificação
5. Verifica email
6. Status = "pending" (aguardando aprovação)
7. Super master recebe notificação
8. Super master aprova/rejeita em /admin/afiliados/pendentes
9. Se aprovado: afiliado recebe email + pode acessar painel
```

### 2. Geração de Link

```
1. Afiliado acessa /afiliado/link
2. Vê seu link: utopsistema.com.br/?ref=ABC123
3. Pode gerar novo link (desativa o antigo)
```

### 3. Indicação de Cliente

```
1. Visitante acessa utopsistema.com.br/?ref=ABC123
2. Cookie salvo com referralCode
3. Visitante cria conta
4. AffiliateReferral criado (status: signed_up)
5. Afiliado vê novo indicado no painel
```

### 4. Conversão e Comissão

```
1. Cliente assina plano (ex: Mensal R$39,90)
2. Pagamento confirmado no Stripe
3. Webhook cria AffiliateCommission:
   - paymentAmount: R$39,90
   - commissionRate: 0.50
   - commissionAmount: R$19,95
   - status: pending
   - availableAt: hoje + 30 dias
4. Após 30 dias: status → available
5. pendingBalance diminui, availableBalance aumenta
```

### 5. Pagamentos Recorrentes

```
1. Todo mês, cliente paga R$39,90
2. Nova AffiliateCommission criada
3. Mesmo fluxo de 30 dias
4. Afiliado continua recebendo enquanto cliente pagar
```

### 6. Cliente Troca de Plano

```
1. Cliente muda de Mensal (R$39,90) para Anual (R$335,00)
2. Próximo pagamento: R$335,00
3. Comissão: R$335,00 × 50% = R$167,50
```

### 7. Cliente Cancela

```
1. Cliente cancela assinatura
2. AffiliateReferral.status → cancelled
3. Comissões já pagas: mantidas
4. Comissões pendentes: canceladas
5. Novas comissões: não são mais criadas
```

### 8. Saque

```
1. Afiliado acessa /afiliado/saques
2. Vê availableBalance (saldo disponível)
3. Solicita saque (PIX ou TED)
4. AffiliateWithdrawal criado (status: pending)
5. Super master vê em /admin/afiliados/saques
6. Super master faz transferência manualmente
7. Marca como "pago" e anexa comprovante
8. Afiliado recebe email de confirmação
```

---

## 🎨 MATERIAIS DE DIVULGAÇÃO

### Banners (a criar)

| Tamanho | Uso |
|---------|-----|
| 1200x628 | Facebook/LinkedIn |
| 1080x1080 | Instagram Feed |
| 1080x1920 | Instagram Stories |
| 300x250 | Display Ads |
| 728x90 | Leaderboard |

### Textos Prontos

```
📱 TEXTO WHATSAPP:
Quer organizar suas finanças de verdade? 
Eu uso o UTOP e está mudando minha vida!
Teste 14 dias grátis: [SEU_LINK]

📸 TEXTO INSTAGRAM:
Chega de não saber pra onde vai seu dinheiro! 💰
O UTOP me ajuda a controlar tudo de forma simples.
Link na bio! #financaspessoais #organizacao

📧 TEXTO EMAIL:
Assunto: Descobri um app incrível para finanças

Oi [NOME],

Sabe aquela dificuldade de controlar os gastos? Encontrei uma solução!

O UTOP Sistema é um app de finanças pessoais que:
✅ Mostra pra onde vai seu dinheiro
✅ Alerta sobre contas a vencer
✅ Importa extrato do banco automaticamente
✅ Tem relatórios visuais incríveis

Teste 14 dias grátis: [SEU_LINK]

Abraço!
```

---

## 📊 DASHBOARD DO AFILIADO

### Cards de Estatísticas

| Métrica | Descrição |
|---------|-----------|
| Cliques | Total de cliques no link |
| Cadastros | Pessoas que criaram conta |
| Assinaturas | Clientes pagantes ativos |
| Taxa de conversão | Assinaturas / Cadastros |

### Cards de Valores

| Métrica | Descrição |
|---------|-----------|
| Comissões Pendentes | Aguardando 30 dias |
| Saldo Disponível | Pode sacar |
| Total Recebido | Histórico |

### Gráficos

- Comissões por mês (últimos 6 meses)
- Novos indicados por mês

---

## ⚠️ MODIFICAÇÕES EM CÓDIGO EXISTENTE

### 1. Landing Page (`/page.tsx`)
- Adicionar link "Seja um Afiliado" no footer

### 2. Página de Login (`/login/page.tsx`)
- Verificar se tem `?ref=` na URL
- Salvar em localStorage/cookie

### 3. Cadastro de Usuário (Backend)
- Verificar se tem referralCode
- Criar AffiliateReferral se existir

### 4. Webhook Stripe
- Quando pagamento confirmado:
  - Verificar se tenant tem AffiliateReferral
  - Criar AffiliateCommission

### 5. Job Agendado (Novo)
- Rodar diariamente
- Atualizar comissões: pending → available (após 30 dias)
- Atualizar saldos dos afiliados

---

## 📁 ESTRUTURA DE ARQUIVOS NOVOS

```
backend/
├── src/
│   ├── routes/
│   │   └── affiliate.routes.ts       # Rotas do afiliado
│   ├── services/
│   │   └── affiliate.service.ts      # Lógica de negócio
│   ├── middleware/
│   │   └── affiliate-auth.ts         # Autenticação separada
│   └── jobs/
│       └── affiliate-commission.job.ts # Job diário

frontend/
├── src/
│   ├── app/
│   │   ├── afiliados/
│   │   │   ├── page.tsx              # Landing
│   │   │   ├── cadastro/page.tsx     # Cadastro
│   │   │   ├── login/page.tsx        # Login
│   │   │   ├── esqueci-senha/page.tsx
│   │   │   └── redefinir-senha/page.tsx
│   │   ├── afiliado/
│   │   │   ├── layout.tsx            # Layout com sidebar
│   │   │   ├── page.tsx              # Dashboard
│   │   │   ├── link/page.tsx         # Seu link
│   │   │   ├── indicados/page.tsx    # Clientes
│   │   │   ├── comissoes/page.tsx    # Comissões
│   │   │   ├── saques/page.tsx       # Saques
│   │   │   ├── materiais/page.tsx    # Materiais
│   │   │   └── configuracoes/page.tsx # Config
│   │   └── admin/
│   │       └── afiliados/
│   │           ├── page.tsx          # Lista
│   │           ├── pendentes/page.tsx # Aprovar
│   │           ├── [id]/page.tsx     # Detalhes
│   │           ├── saques/page.tsx   # Saques
│   │           └── relatorios/page.tsx # Relatórios
│   ├── stores/
│   │   └── affiliate-auth.ts         # Store Zustand
│   └── lib/
│       └── affiliate-api.ts          # API client
```

---

## ⏱️ ESTIMATIVA DE TEMPO

| Fase | Tarefa | Tempo |
|------|--------|-------|
| 1 | Modelos Prisma + Migration | 1h |
| 2 | Backend: Auth + Rotas básicas | 3h |
| 3 | Backend: Serviços completos | 4h |
| 4 | Backend: Integração Stripe + Job | 2h |
| 5 | Frontend: Landing + Cadastro + Login | 3h |
| 6 | Frontend: Dashboard afiliado | 4h |
| 7 | Frontend: Páginas afiliado (6 páginas) | 4h |
| 8 | Frontend: Admin afiliados (4 páginas) | 3h |
| 9 | Materiais de divulgação | 1h |
| 10 | Testes + Ajustes | 2h |
| **TOTAL** | | **~27 horas** |

---

## 🚀 ORDEM DE IMPLEMENTAÇÃO

1. **Fase 1**: Banco de dados (modelos + migration)
2. **Fase 2**: Backend completo
3. **Fase 3**: Frontend público (landing, cadastro, login)
4. **Fase 4**: Frontend afiliado (dashboard e páginas)
5. **Fase 5**: Frontend admin
6. **Fase 6**: Integração Stripe webhook
7. **Fase 7**: Job de comissões
8. **Fase 8**: Materiais de divulgação
9. **Fase 9**: Testes e deploy

---

## ❓ PENDÊNCIAS

- [ ] Definir tempo de validade do cookie (sugestão: 30 dias ou permanente até criar conta)

---

## 📝 CHANGELOG

| Data | Alteração |
|------|-----------|
| 15/01/2026 | Documento criado com escopo completo |
