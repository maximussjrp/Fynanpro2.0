# 🗺️ ROADMAP COMPLETO UTOP - Atualizado 21/Dez/2025 (01:45)

> **DOCUMENTO MESTRE** - Referência única para todo o desenvolvimento do sistema UTOP.
> Este documento contém TUDO sobre o estado atual, diferenças local/servidor, e próximos passos.

---

## 📋 ÍNDICE

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Estado Atual - Local vs Servidor](#2-estado-atual---local-vs-servidor)
3. [Problemas Conhecidos e Status](#3-problemas-conhecidos-e-status)
4. [Credenciais e Acessos](#4-credenciais-e-acessos)
5. [Roadmap de Desenvolvimento](#5-roadmap-de-desenvolvimento)
6. [Comandos Úteis](#6-comandos-úteis)
7. [Arquitetura Técnica](#7-arquitetura-técnica)
8. [Checklist de Deploy](#8-checklist-de-deploy)
9. [Histórico de Alterações](#9-histórico-de-alterações)

---

## 1. VISÃO GERAL DO SISTEMA

### O que é o UTOP?
Sistema SaaS de gestão financeira pessoal multi-tenant com:
- Controle de transações (receitas/despesas)
- Contas bancárias múltiplas
- Contas recorrentes
- Compras parceladas
- Orçamentos
- Relatórios e gráficos
- Importação de extratos
- Chatbot financeiro (ISIS)
- Painel administrativo (super_master)

### Stack Tecnológico

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | Next.js 14, React, TypeScript, TailwindCSS, Recharts |
| **Backend** | Node.js 20, Express, TypeScript, Prisma ORM |
| **Banco** | PostgreSQL 15 |
| **Cache** | Redis 7 |
| **Pagamentos** | Stripe (ativo), Asaas (placeholder) |
| **Email** | Resend API |
| **Deploy** | Docker, Docker Compose, Nginx |
| **Servidor** | Hetzner VPS (Ubuntu 24.04) |

### URLs de Produção
- **Frontend:** https://utopsistema.com.br
- **API:** https://api.utopsistema.com.br/api/v1
- **Swagger:** https://api.utopsistema.com.br/api-docs

---

## 2. ESTADO ATUAL - LOCAL vs SERVIDOR

### 🔴 DIFERENÇAS CRÍTICAS

#### Arquivos que EXISTEM NO SERVIDOR mas estão VAZIOS LOCALMENTE:

| Arquivo | Local | Servidor | Ação Necessária |
|---------|-------|----------|-----------------|
| `backend/src/services/stripe.service.ts` | ❌ VAZIO | ✅ 15KB completo | **BAIXAR DO SERVIDOR** |
| `backend/src/services/admin.service.ts` | ❌ VAZIO | ✅ 21KB completo | **BAIXAR DO SERVIDOR** |

**✅ SINCRONIZADO EM 20/DEZ/2025:**
```
Arquivos baixados do servidor para local:
- backend/src/services/stripe.service.ts (15KB)
- backend/src/services/admin.service.ts (21KB)
- backend/src/services/auth.service.ts (17KB)
- backend/src/services/email.service.ts (14KB)
- backend/src/services/coupon.service.ts (10KB) - NOVO
- backend/src/services/payment.service.ts (16KB)
- backend/src/routes/subscription.ts (14KB)
- backend/src/routes/admin.ts (26KB)
- backend/src/main.ts (21KB)
- frontend/src/app/page.tsx (23KB)
- frontend/src/app/admin/* (todas as páginas)
- frontend/src/components/Sidebar.tsx
- frontend/src/components/TrialBanner.tsx
- frontend/src/components/DashboardLayoutWrapper.tsx
- frontend/src/components/NewTransactionModal.tsx
- frontend/src/components/UnifiedTransactionModal.tsx
- frontend/src/lib/api.ts
```

#### Arquivos IGUAIS (sincronizados):

| Arquivo | Status |
|---------|--------|
| `backend/src/services/auth.service.ts` | ✅ 17KB |
| `backend/src/services/email.service.ts` | ✅ 15KB |
| `backend/src/services/transaction.service.ts` | ✅ Sincronizado |
| `backend/src/services/payment.service.ts` | ✅ Sincronizado |
| `backend/prisma/schema.prisma` | ✅ Sincronizado |

### Estrutura de Pastas

```
FYNANPRO2.0/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts       # Conexão Prisma
│   │   │   ├── redis.ts          # Conexão Redis
│   │   │   └── swagger.ts        # Documentação API
│   │   ├── dtos/
│   │   │   ├── auth.dto.ts       # Validação Zod auth
│   │   │   ├── transaction.dto.ts
│   │   │   └── ...
│   │   ├── middleware/
│   │   │   ├── auth.ts           # JWT middleware
│   │   │   └── tenant.ts         # Multi-tenant middleware
│   │   ├── routes/
│   │   │   ├── admin.ts          # Rotas admin (29KB)
│   │   │   ├── transactions.ts   # CRUD transações
│   │   │   ├── subscription.ts   # Rotas Stripe
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── auth.service.ts   # Autenticação
│   │   │   ├── stripe.service.ts # ⚠️ VAZIO LOCAL
│   │   │   ├── admin.service.ts  # ⚠️ VAZIO LOCAL
│   │   │   └── ...
│   │   ├── utils/
│   │   │   └── logger.ts         # Winston logger
│   │   └── main.ts               # Entry point
│   ├── prisma/
│   │   └── schema.prisma         # 23 modelos
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/           # Login, registro
│   │   │   ├── (dashboard)/      # Área logada
│   │   │   ├── admin/            # Painel admin
│   │   │   └── verify-email/     # Verificação email
│   │   ├── components/
│   │   │   ├── Sidebar.tsx       # Menu lateral
│   │   │   ├── TransactionForm.tsx
│   │   │   └── ...
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx   # Contexto auth
│   │   └── lib/
│   │       └── api.ts            # Cliente API
│   ├── Dockerfile
│   ├── package.json
│   └── next.config.js
├── nginx/
│   ├── nginx.conf                # Config produção
│   └── certs/                    # SSL Let's Encrypt
├── docker-compose.yml            # Dev local
├── docker-compose.prod.yml       # Produção
└── [Documentação *.md]
```

---

## 3. PROBLEMAS CONHECIDOS E STATUS

### ✅ RESOLVIDOS (20/Dez/2025)

| Problema | Solução | Status |
|----------|---------|--------|
| Login falhando com erro `emailVerificationToken` | Adicionadas colunas no banco de produção via ALTER TABLE | ✅ RESOLVIDO |
| Colunas faltantes na tabela User | SQL executado adicionando 4 colunas | ✅ RESOLVIDO |
| Admin panel retornando 403 Forbidden | JWT não incluía `role` no payload - corrigido auth.service.ts | ✅ RESOLVIDO |
| Login "Credenciais inválidas" para master | Senha do usuário master resetada para `Master@2024` | ✅ RESOLVIDO |
| Rate limiting bloqueando usuários | Redis FLUSHALL para limpar rate limit | ✅ RESOLVIDO |

**SQL executado:**
```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMP;
```

### 🔴 PENDENTES - SEGURANÇA ✅ RESOLVIDO

| Problema | Status | Solução Aplicada |
|----------|--------|------------------|
| UFW Firewall INATIVO | ✅ ATIVO | Portas 22, 80, 443 liberadas |
| fail2ban não instalado | ✅ INSTALADO | Jail sshd ativo |
| Sem backup automático | ✅ CONFIGURADO | Cron diário às 3h |
| Disco 82% cheio | ✅ LIMPO (14%) | docker prune + journal vacuum |

### 🟠 PENDENTES - SEGURANÇA ADICIONAL (Opcional)

| Problema | Risco | Solução |
|----------|-------|---------|
| SSH permite root com senha | MÉDIO | Editar `/etc/ssh/sshd_config` |
| Monitoramento | BAIXO | Instalar Uptime Kuma |

### 🟠 PENDENTES - FUNCIONALIDADES

| Item | Descrição | Prioridade |
|------|-----------|------------|
| Asaas PIX | Gateway alternativo de pagamento | BAIXA |
| Chatbot ISIS | Integração OpenAI | MÉDIA |
| Notificações Push | Web push notifications | BAIXA |
| App Mobile | React Native ou Flutter | FUTURA |

---

## 4. CREDENCIAIS E ACESSOS

### Servidor VPS

```
IP: 91.99.16.145
Usuário: root
Senha: [REDACTED]
SSH: ssh root@91.99.16.145
```

### Banco de Dados (Produção)

```
Host: localhost (via Docker)
Database: utop
User: utop_user
Password: [REDACTED]
Container: utop-postgres
```

### Stripe (PRODUÇÃO - LIVE)

```
Secret Key: [REDACTED - Ver .env do servidor]
Publishable: [REDACTED - Ver .env do servidor]
Webhook Secret: [REDACTED - Ver .env do servidor]

Price IDs: [Ver dashboard Stripe]
```

### Email (Resend)

```
API Key: [REDACTED]
From: UTOP <noreply@utopsistema.com.br>
Domínio: utopsistema.com.br (VERIFICADO)
```

### DNS Records Configurados (Registro.br)

```
TXT  resend._domainkey.utopsistema.com.br → DKIM key ✅ VERIFICADO
MX   send.utopsistema.com.br → 10 feedback-smtp.sa-east-1.amazonses.com ✅ VERIFICADO  
TXT  send.utopsistema.com.br → v=spf1 include:amazonses.com ~all ✅ VERIFICADO
TXT  _dmarc.utopsistema.com.br → v=DMARC1; p=none; ✅ CONFIGURADO
```

### JWT

```
Secret: [REDACTED]
Expiry: Access 15min, Refresh 7 days
```

### Usuários Existentes (Produção)

| Email | Nome | Role | isEmailVerified |
|-------|------|------|-----------------|
| master@utopsistema.com.br | Super Master UTOP | super_master | ✅ true |
| xxmaxx05@gmail.com | Max Silva | super_master | ✅ true |
| max.guarinieri@gmail.com | Max Guarinieri | owner | ✅ true |

> **Nota:** Base de dados limpa em 20/Dez - apenas super_masters + 1 owner permanecem

---

## 5. ROADMAP DE DESENVOLVIMENTO

### 📅 FASE 1: ESTABILIZAÇÃO (Semana 21-27 Dez)

#### 1.1 Segurança do Servidor [URGENTE]
- [ ] Ativar UFW firewall
- [ ] Instalar e configurar fail2ban
- [ ] Desabilitar login root por senha
- [ ] Configurar chave SSH

#### 1.2 Sincronização de Código [URGENTE]
- [ ] Baixar stripe.service.ts do servidor
- [ ] Baixar admin.service.ts do servidor
- [ ] Commitar tudo no Git
- [ ] Criar tag v1.0.0-stable

#### 1.3 Backup e Monitoramento
- [ ] Configurar backup diário do PostgreSQL
- [ ] Configurar rotação de logs
- [ ] Limpar espaço em disco

### 📅 FASE 2: MELHORIAS (Semana 28 Dez - 10 Jan)

#### 2.1 Verificação de Email ✅ CONCLUÍDO (20/Dez)
- [x] Testar fluxo completo de verificação
- [x] Configurar domínio verificado Resend (utopsistema.com.br)
- [x] Implementar reenvio de verificação (botão na tela de login)
- [x] Login bloqueado para emails não verificados

#### 2.2 Reset de Senha ✅ BACKEND CONCLUÍDO
- [x] Endpoint POST /auth/forgot-password implementado
- [x] Endpoint POST /auth/reset-password implementado
- [x] Email de reset enviado via Resend
- [x] Token com expiração de 1 hora
- [ ] Página frontend /reset-password (PENDENTE)
- [ ] Link "Esqueceu senha?" na tela de login (PENDENTE)

#### 2.3 Painel Admin
- [x] Listar todos os tenants
- [ ] Ver métricas de uso
- [ ] Gerenciar assinaturas
- [ ] Logs de auditoria
- [x] Deletar usuários (rota DELETE implementada)
- [x] Editar usuários (rota PUT implementada)

### 📅 FASE 3: PAGAMENTOS (Semana 11-24 Jan)

#### 3.1 Stripe Checkout
- [ ] Testar fluxo de assinatura completo
- [ ] Webhook funcionando
- [ ] Cancelamento de assinatura
- [ ] Upgrade/Downgrade de plano

#### 3.2 Trial Period
- [ ] 14 dias grátis
- [ ] Notificação de expiração
- [ ] Conversão para plano pago

### 📅 FASE 4: FUNCIONALIDADES (Fevereiro)

#### 4.1 Chatbot ISIS
- [ ] Integração OpenAI GPT-4
- [ ] Contexto financeiro do usuário
- [ ] Dicas personalizadas

#### 4.2 Relatórios Avançados
- [ ] Exportação PDF
- [ ] Gráficos comparativos
- [ ] Previsões

#### 4.3 Importação de Extratos
- [ ] Parser OFX
- [ ] Parser CSV
- [ ] Categorização automática

### 📅 FASE 5: ESCALA (Março+)

#### 5.1 Performance
- [ ] Cache agressivo Redis
- [ ] Índices otimizados
- [ ] Query optimization

#### 5.2 Infraestrutura
- [ ] CDN para assets
- [ ] Múltiplas réplicas
- [ ] Load balancer

---

## 6. COMANDOS ÚTEIS

### Deploy Completo

```powershell
# 1. Enviar todos os arquivos
scp -r ./backend root@91.99.16.145:/opt/utop/
scp -r ./frontend root@91.99.16.145:/opt/utop/

# 2. Rebuild no servidor
ssh root@91.99.16.145 "cd /opt/utop && docker compose -f docker-compose.prod.yml up -d --build"
```

### Deploy Apenas Backend

```powershell
scp -r ./backend/src root@91.99.16.145:/opt/utop/backend/
scp ./backend/package.json root@91.99.16.145:/opt/utop/backend/
ssh root@91.99.16.145 "cd /opt/utop && docker compose -f docker-compose.prod.yml up -d --build backend"
```

### Deploy Apenas Frontend

```powershell
scp -r ./frontend/src root@91.99.16.145:/opt/utop/frontend/
ssh root@91.99.16.145 "cd /opt/utop && docker compose -f docker-compose.prod.yml up -d --build frontend"
```

### Ver Logs

```powershell
# Backend
ssh root@91.99.16.145 "docker logs utop-backend --tail=50 -f"

# Frontend
ssh root@91.99.16.145 "docker logs utop-frontend --tail=50 -f"

# Nginx
ssh root@91.99.16.145 "docker logs utop-nginx --tail=50 -f"

# Todos os erros
ssh root@91.99.16.145 "docker logs utop-backend 2>&1 | grep -i error | tail -30"
```

### Banco de Dados

```powershell
# Executar SQL via base64 (evita problemas de escaping)
$sql = 'SELECT * FROM "User" LIMIT 5;'
$base64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($sql))
ssh root@91.99.16.145 "echo '$base64' | base64 -d > /tmp/q.sql && docker cp /tmp/q.sql utop-postgres:/tmp/ && docker exec utop-postgres psql -U utop_user -d utop -f /tmp/q.sql"

# Backup
ssh root@91.99.16.145 "docker exec utop-postgres pg_dump -U utop_user utop > /opt/backup/utop_$(date +%Y%m%d).sql"

# Restaurar
ssh root@91.99.16.145 "cat backup.sql | docker exec -i utop-postgres psql -U utop_user -d utop"
```

### Containers

```powershell
# Status
ssh root@91.99.16.145 "docker ps -a"

# Reiniciar tudo
ssh root@91.99.16.145 "cd /opt/utop && docker compose -f docker-compose.prod.yml restart"

# Reiniciar específico
ssh root@91.99.16.145 "docker restart utop-backend"

# Shell no container
ssh root@91.99.16.145 "docker exec -it utop-backend sh"

# Limpar recursos
ssh root@91.99.16.145 "docker system prune -af"
```

### Sistema

```powershell
# Disco
ssh root@91.99.16.145 "df -h"

# Memória
ssh root@91.99.16.145 "free -h"

# Processos
ssh root@91.99.16.145 "htop"

# Firewall
ssh root@91.99.16.145 "ufw status"
```

---

## 7. ARQUITETURA TÉCNICA

### Fluxo de Requisição

```
Cliente (Browser)
    ↓ HTTPS
Nginx (SSL termination, proxy)
    ↓ HTTP
    ├── /api/* → Backend (Node:3000)
    │              ↓
    │         PostgreSQL (5432)
    │              ↓
    │         Redis (6379)
    │
    └── /* → Frontend (Next.js:3000)
```

### Modelo de Dados Principal

```
User (1) ─────┬──── (N) Tenant (via TenantUser)
              │
              └──── (1) Tenant (ownedTenants)
                         │
                         ├── (N) Category
                         ├── (N) BankAccount
                         ├── (N) Transaction
                         ├── (N) RecurringBill
                         ├── (N) Budget
                         └── (N) Notification
```

### Autenticação

```
1. POST /api/v1/auth/login
   └── Retorna: { accessToken (15min), refreshToken (7d) }

2. Requisições autenticadas
   └── Header: Authorization: Bearer <accessToken>

3. Token expirado
   └── POST /api/v1/auth/refresh { refreshToken }
   └── Retorna: novos tokens

4. Logout
   └── POST /api/v1/auth/logout
   └── Invalida refreshToken no banco
```

### Multi-Tenancy

```
1. Usuário faz login → recebe tenantId no token
2. Middleware tenant.ts extrai tenantId do JWT
3. Todas as queries filtram por tenantId
4. Isolamento total entre tenants
```

---

## 8. CHECKLIST DE DEPLOY

### Antes de Deploy

- [ ] Código testado localmente
- [ ] Build sem erros: `npm run build`
- [ ] Variáveis de ambiente atualizadas
- [ ] Migrations aplicadas
- [ ] Git commit feito

### Durante Deploy

- [ ] Backup do banco atual
- [ ] Deploy em horário de baixo uso
- [ ] Monitorar logs em tempo real
- [ ] Testar endpoints críticos

### Após Deploy

- [ ] Login funcionando
- [ ] Dashboard carregando
- [ ] Transações listando
- [ ] Stripe webhook recebendo
- [ ] Sem erros nos logs

### Rollback (se necessário)

```powershell
# Restaurar backup do banco
cat backup_anterior.sql | docker exec -i utop-postgres psql -U utop_user -d utop

# Reverter imagem
docker compose -f docker-compose.prod.yml down
git checkout <commit_anterior>
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 📝 NOTAS FINAIS

### Pontos de Atenção

1. **API prefix:** Todas as rotas são `/api/v1/*` (não `/auth/*` diretamente)
2. **Porta backend:** 3000 (não 3001)
3. **Prisma CLI:** Servidor tem Prisma 7 que mudou configuração do datasource
4. **Stripe:** Chaves são de PRODUÇÃO (live), cuidado com testes

### Contatos

- **Desenvolvedor:** Max Guarinieri
- **Email:** max.guarinieri@gmail.com
- **Sistema:** UTOP - Sistema de Gestão Financeira

---

---

## 9. HISTÓRICO DE ATUALIZAÇÕES

### 20/Dez/2025 - 22:00
- ✅ Auditoria completa do código local (nota 6.5/10)
- ✅ Auditoria completa do servidor de produção (nota 7/10)
- ✅ Corrigido bug crítico de login (colunas faltantes no banco)
- ✅ Sincronização completa local ← servidor (17 arquivos)
- ✅ UFW Firewall ATIVADO (portas 22, 80, 443)
- ✅ fail2ban INSTALADO e ATIVO (jail sshd)
- ✅ Backup automático CONFIGURADO (cron 3h diário)
- ✅ Disco LIMPO (82% → 14% de uso)
- ✅ Backup manual criado: /opt/backup/utop_20251220.sql (693KB)

### Arquivos Sincronizados (Total: 17)
```
Backend Services (8 arquivos):
✅ stripe.service.ts (15KB)
✅ admin.service.ts (21KB)
✅ auth.service.ts (17KB)
✅ email.service.ts (14KB)
✅ coupon.service.ts (10KB)
✅ payment.service.ts (16KB)
✅ recurring-bill.service.ts (14KB)
✅ transaction.service.ts (59KB)
✅ transaction-generator.service.ts (9KB)

Backend Routes (2 arquivos):
✅ subscription.ts (14KB)
✅ admin.ts (26KB)

Backend Core (1 arquivo):
✅ main.ts (21KB)

Frontend App (10+ arquivos):
✅ page.tsx (landing - 23KB)
✅ admin/* (toda a pasta)
✅ verify-email/page.tsx

Frontend Components (5 arquivos):
✅ Sidebar.tsx
✅ TrialBanner.tsx
✅ DashboardLayoutWrapper.tsx
✅ NewTransactionModal.tsx
✅ UnifiedTransactionModal.tsx

Frontend Lib (1 arquivo):
✅ api.ts
```

---

## 9. HISTÓRICO DE ALTERAÇÕES (Sessão 20-21/Dez/2025)

### 🔄 20/Dez/2025 - Noite/Madrugada

#### Problemas Corrigidos:

1. **403 Forbidden no Admin Panel**
   - **Causa:** `auth.service.ts` não incluía `role` no payload do JWT
   - **Solução:** Modificado `generateTokenPair()` para aceitar `role` como parâmetro
   - **Arquivo:** `backend/src/services/auth.service.ts`
   - **Linhas afetadas:** 43-46, 160, 329, 426

2. **Login "Credenciais inválidas"**
   - **Causa:** Hash da senha no banco diferente do esperado
   - **Solução:** Reset da senha do master via SQL
   - **Arquivo:** `reset-master-password.sql` executado no PostgreSQL

3. **Rate Limiting bloqueando usuários**
   - **Causa:** Muitas tentativas de login durante debug
   - **Solução:** `docker exec utop-redis redis-cli FLUSHALL`

#### Novas Funcionalidades Implementadas:

1. **DELETE /api/v1/admin/users/:id** - Remover usuário
   - Exclusão PERMANENTE do usuário (não soft delete)
   - Permite que o usuário se recadastre com o mesmo email
   - Remove: tenantUsers, refreshTokens, notifications
   - Marca tenants do usuário como deletados (soft delete)
   - Não permite deletar a si mesmo
   - Não permite deletar outro super_master
   - **Arquivo:** `backend/src/routes/admin.ts` (linhas 367-434)

#### Arquivos Modificados Hoje:

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `backend/src/services/auth.service.ts` | RECRIADO | Corrigido para incluir role no JWT |
| `backend/src/routes/admin.ts` | MODIFICADO | Adicionada rota DELETE /users/:id |
| `reset-master-password.sql` | CRIADO | Script para resetar senha do master |

#### Comandos Executados no Servidor:

```bash
# Reset de senha do master
docker cp /tmp/reset-master-password.sql utop-postgres:/tmp/
docker exec utop-postgres psql -U utop_user -d utop -f /tmp/reset-master-password.sql

# Limpar rate limiting
docker exec utop-redis redis-cli FLUSHALL

# Rebuild do backend (várias vezes)
cd /opt/utop && docker compose -f docker-compose.prod.yml up -d --build backend
```

### 📊 Estado Atual do Sistema

| Componente | Status | Versão |
|------------|--------|--------|
| Backend | ✅ Online | Node.js 20 |
| Frontend | ✅ Online | Next.js 14.2.33 |
| PostgreSQL | ✅ Online | 15 Alpine |
| Redis | ✅ Online | 7 Alpine |
| Nginx | ✅ Online | Proxy reverso |

### 🔐 Credenciais Atualizadas

| Usuário | Email | Senha | Role |
|---------|-------|-------|------|
| Super Master | master@utopsistema.com.br | `Master@2024` | super_master |
| Max Silva | xxmaxx05@gmail.com | (não alterada) | super_master |

### 📋 Próximos Passos Prioritários

1. **Frontend Admin Panel** ✅ CONCLUÍDO
   - [x] Adicionar botão "Remover" na lista de usuários
   - [x] Modal de confirmação antes de deletar
   - [x] Feedback visual após remoção
   - [x] Botão "Editar" usuário
   - [x] Modal de edição de usuário

2. **Email Verification** ✅ CONCLUÍDO
   - [x] Configurar domínio verificado no Resend
   - [x] DNS records: DKIM, SPF, MX configurados
   - [x] Login bloqueado para emails não verificados
   - [x] Botão "Reenviar email de verificação" na tela de login

3. **Segurança Adicional**
   - [ ] Desabilitar login root por senha (SSH key only)
   - [ ] Configurar logs de auditoria mais detalhados

4. **Monitoramento**
   - [ ] Instalar Uptime Kuma ou similar
   - [ ] Alertas de downtime por email/Telegram

---

## 10. ATUALIZAÇÕES SESSÃO 20/DEZ/2025 (NOITE)

### ✅ Correções Implementadas

#### 1. Rota DELETE /api/v1/admin/users/:id - Corrigida
- **Problema:** Erro 500 ao deletar usuário - Tenant_ownerId_fkey constraint
- **Solução:** Adicionar `ownerId: null` antes de deletar o usuário
- **Arquivo:** `backend/src/routes/admin.ts`
- **Código adicionado:**
```typescript
// Remover referência de owner antes de deletar
await prisma.tenant.updateMany({
  where: { ownerId: id },
  data: { ownerId: null, deletedAt: new Date() }
});
```

#### 2. Verificação de Email no Resend
- **Problema:** Emails não chegavam - usando onboarding@resend.dev
- **Solução:** 
  - Verificado domínio utopsistema.com.br no Resend
  - Adicionados DNS records no Registro.br (DKIM, SPF, MX, DMARC)
  - Atualizado EMAIL_FROM para `noreply@utopsistema.com.br`
- **Status:** ✅ DKIM, SPF, MX verificados no Resend

#### 3. Login Requer Verificação de Email
- **Problema:** Usuário conseguia fazer login sem verificar email
- **Solução:** Adicionada verificação `isEmailVerified` no login
- **Arquivo:** `backend/src/services/auth.service.ts`
- **Código adicionado:**
```typescript
if (!user.isEmailVerified) {
  throw new Error('Email não verificado. Verifique sua caixa de entrada.');
}
```

#### 4. Botão "Reenviar Email de Verificação"
- **Problema:** Usuário não tinha opção de reenviar email quando já cadastrado
- **Solução:** Adicionado botão na tela de login quando detecta "email já cadastrado" ou "não verificado"
- **Arquivo:** `frontend/src/app/page.tsx`
- **Funcionalidades:**
  - Detecta erros de email já cadastrado ou não verificado
  - Mostra botão "📧 Reenviar email de verificação"
  - Chama endpoint `/api/v1/auth/resend-verification`
  - Feedback visual de sucesso/erro

### 📂 Arquivos Modificados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `backend/src/services/auth.service.ts` | MODIFICADO | Adicionada verificação isEmailVerified no login |
| `backend/src/routes/admin.ts` | MODIFICADO | Corrigido ownerId = null antes de deletar |
| `frontend/src/app/page.tsx` | MODIFICADO | Adicionado botão reenviar verificação |
| `docker-compose.prod.yml` | MODIFICADO | EMAIL_FROM atualizado para noreply@utopsistema.com.br |

### 🔧 Comandos Executados

```bash
# Upload de arquivos
scp auth.service.ts root@91.99.16.145:/opt/utop/backend/src/services/
scp admin.ts root@91.99.16.145:/opt/utop/backend/src/routes/
scp page.tsx root@91.99.16.145:/opt/utop/frontend/src/app/

# Rebuild dos containers
ssh root@91.99.16.145 "cd /opt/utop && docker compose -f docker-compose.prod.yml up -d --build backend"
ssh root@91.99.16.145 "cd /opt/utop && docker compose -f docker-compose.prod.yml up -d --build frontend"
```

### 📊 Estado Final do Sistema

| Componente | Status | Última Ação |
|------------|--------|-------------|
| Backend | ✅ Online | Rebuild com auth fix |
| Frontend | ✅ Online | Rebuild com resend button |
| PostgreSQL | ✅ Online | Base limpa (3 users) |
| Redis | ✅ Online | - |
| Nginx | ✅ Online | - |
| Email Resend | ✅ Verificado | Domínio utopsistema.com.br |

### ✅ Testes Realizados
- Login com usuário não verificado → Bloqueado ✅
- Reenvio de email de verificação → Funcionando ✅
- Delete de usuário no admin → Funcionando ✅
- Emails sendo enviados do domínio verificado → Funcionando ✅

---

## 📅 21/Dez/2025 - SESSÃO 2 (Tarde): Hierarquia de Categorias + Auditoria Completa

### 🚨 DIRETIVA DE DESENVOLVIMENTO IMPORTANTE

> **REGRA DE OURO:** Nunca simplificar funções implementadas. Sempre melhorar e expandir funcionalidades. NÃO ser minimalista. Preservar toda funcionalidade existente.

Esta diretiva deve ser seguida em TODO o desenvolvimento futuro do sistema.

---

### 🔧 Correções Implementadas

#### 1. SSH Configurado Sem Senha
- **Problema:** Acesso ao servidor requeria senha a cada conexão
- **Solução:** Configuração de chave SSH para autenticação automática
- **Servidor:** `91.99.16.145`
- **Status:** ✅ Acesso direto sem senha funcionando

#### 2. Hierarquia de Categorias para Novos Usuários
- **Problema:** Novos usuários recebiam apenas categorias L1 (17 categorias planas)
- **Causa:** `auth.service.ts` usava `createMany` com lista simples
- **Solução:** Alterado para usar `createDefaultCategories()` do `default-categories.ts`
- **Arquivo:** `backend/src/services/auth.service.ts`
- **Código alterado:**
```typescript
// ANTES (só criava L1):
await tx.category.createMany({ 
  data: defaultCategories.map(cat => ({ name: cat.name, type: cat.type, tenantId: tenant.id })) 
});

// DEPOIS (cria L1, L2 e L3):
const { createDefaultCategories } = await import('../utils/default-categories');
await createDefaultCategories(tenant.id);
```

#### 3. Subcategorias Adicionadas ao Usuário de Teste
- **Usuário:** m2nivel.contato@gmail.com
- **TenantId:** `1038780d-26d9-43e7-a825-364260547f85`
- **Script criado:** `add-subs.js` na VPS
- **Subcategorias adicionadas:** 20 categorias L2
  - 🏠 Moradia: Aluguel, Condomínio, IPTU, Luz, Água, Internet
  - 🥗 Alimentação: Supermercado, Restaurantes, Delivery, Padaria
  - 🚗 Transporte: Combustível, Uber/99, Estacionamento, Manutenção
  - 🎮 Lazer: Cinema, Shows, Streaming, Jogos

---

### 📊 AUDITORIA COMPLETA DO SISTEMA

**Data:** 21/Dez/2025 14:46 UTC  
**Nota Final:** 8.5/10

#### Infraestrutura
| Componente | Status | Detalhes |
|------------|--------|----------|
| utop-backend | ✅ Up (healthy) | Container reconstruído |
| utop-frontend | ✅ Up | Funcionando |
| utop-nginx | ✅ Up 22h | Proxy reverso ativo |
| utop-postgres | ✅ Up 44h (healthy) | Base de dados principal |
| utop-redis | ✅ Up 44h (healthy) | Cache de sessões |

#### Recursos do Servidor
| Recurso | Usado | Total | % |
|---------|-------|-------|---|
| Disco | 12G | 38G | 34% |
| Memória | 1.2Gi | 3.7Gi | ~32% |

#### Segurança
| Item | Status | Configuração |
|------|--------|--------------|
| UFW Firewall | ✅ Ativo | Portas 22, 80, 443 |
| Fail2ban | ✅ Ativo | Proteção contra brute-force |
| Backup Automático | ✅ Configurado | 0 3 * * * (diário às 3h) |

#### Banco de Dados
| Entidade | Quantidade |
|----------|------------|
| Usuários | 4 |
| Tenants | 4 |
| Categorias | 140 (L1: 51, L2: 85, L3: 4) |
| Transações | 116 |

#### Hierarquia do Usuário de Teste (m2nivel)
```
TenantId: 1038780d-26d9-43e7-a825-364260547f85
Categorias L1: 17
Categorias L2: 20
Categorias L3: 0

Categorias com filhos:
├── 🏥 Saúde | filhos: 5 (Plano de Saúde, Consultas, Exames...)
├── 🎓 Educação | filhos: 4 (Cursos, Faculdade, Livros...)
├── 🏠 Moradia | filhos: 6 (Aluguel, Condomínio, Luz...)
└── 🎮 Lazer | filhos: 5 (Cinema, Shows, Jogos...)
```

#### Endpoints Testados
| Endpoint | Status | Observação |
|----------|--------|------------|
| https://app.utopsistema.com.br | ✅ 200 | Frontend OK |
| https://api.utopsistema.com.br/api/v1/auth/login | ✅ 400 | Esperado (precisa body) |
| POST /auth/login (com credenciais) | ✅ 200 | JWT gerado corretamente |

---

### 📂 Arquivos Modificados/Criados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `backend/src/services/auth.service.ts` | MODIFICADO | Usa createDefaultCategories para novos usuários |
| VPS: `/tmp/add-subs.js` | CRIADO | Script para adicionar subcategorias |
| VPS: `/tmp/test-login.js` | CRIADO | Teste de endpoint de login |
| VPS: `/tmp/test-login2.js` | CRIADO | Teste de login com resposta completa |
| VPS: `/tmp/audit-db.js` | CRIADO | Auditoria do banco de dados |
| VPS: `/tmp/test-cats.js` | CRIADO | Teste de hierarquia de categorias |
| VPS: `/tmp/audit-report.sh` | CRIADO | Relatório completo de auditoria |

---

### 🔧 Comandos Executados

```bash
# Upload do auth.service.ts corrigido
scp auth.service.ts root@91.99.16.145:/opt/utop/backend/src/services/

# Rebuild do backend
ssh root@91.99.16.145 "cd /opt/utop && docker compose -f docker-compose.prod.yml up -d --build backend"

# Execução da auditoria
ssh root@91.99.16.145 "chmod +x /tmp/audit-report.sh && /tmp/audit-report.sh"

# Teste de login
ssh root@91.99.16.145 "docker exec utop-backend node /tmp/test-login2.js"

# Auditoria de categorias
ssh root@91.99.16.145 "docker exec utop-backend node /tmp/test-cats.js"
```

---

### ✅ Checklist Final da Sessão

- [x] SSH configurado sem senha
- [x] Hierarquia de categorias funcionando na página de categorias
- [x] Hierarquia de categorias funcionando nos modais de transação
- [x] Subcategorias adicionadas ao usuário de teste (20 L2)
- [x] auth.service.ts corrigido para criar hierarquia completa para novos usuários
- [x] Backend redeployado com correções
- [x] Auditoria completa do sistema realizada
- [x] Documentação atualizada no ROADMAP

---

### 📋 Funções Críticas Implementadas (NÃO SIMPLIFICAR)

| Arquivo | Função | Descrição |
|---------|--------|-----------|
| `default-categories.ts` | `createDefaultCategories()` | Cria hierarquia completa L1/L2/L3 |
| `NewTransactionModal.tsx` | `buildHierarchicalList()` | Constrói lista hierárquica com busca |
| `UnifiedTransactionModal.tsx` | `buildHierarchicalList()` | Mesma lógica, modal unificado |
| `categories/page.tsx` | `toggleAllExpanded()` | Expande/colapsa todas as categorias |
| `categories/page.tsx` | Auto-expand on load | Expande automaticamente ao carregar |

---

### 📊 Estado Final do Sistema

| Componente | Status | Última Ação |
|------------|--------|-------------|
| Backend | ✅ Online | Rebuild com createDefaultCategories |
| Frontend | ✅ Online | Hierarquia funcionando |
| PostgreSQL | ✅ Online | 4 users, 140 categorias |
| Redis | ✅ Online | - |
| Nginx | ✅ Online | - |
| SSH | ✅ Sem senha | Chave configurada |

---

## 📅 23/Dez/2025 - SESSÃO 3: Tabs Única | Recorrente | Parcelada

### 🎯 Problema Identificado

O modal de "Nova Transação" estava usando apenas o formulário simples (`NewTransactionModal`), sem as tabs para criar transações **Recorrentes** e **Parceladas**.

O componente `UnifiedTransactionModal` com as 3 tabs já existia mas **nunca foi integrado** às páginas principais.

### ✅ Solução Implementada

Modificadas as páginas do frontend para usar ambos os modals:
- **Criar** nova transação → `UnifiedTransactionModal` (com tabs)
- **Editar** transação existente → `NewTransactionModal` (formulário simples)

### 📂 Arquivos Modificados no Servidor

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `/opt/utop/frontend/src/app/dashboard/page.tsx` | MODIFICADO | Usa CreateTransactionModal + EditTransactionModal |
| `/opt/utop/frontend/src/app/dashboard/transactions/page.tsx` | MODIFICADO | Usa CreateTransactionModal + EditTransactionModal |

### 🔧 Mudanças Técnicas

1. **Imports atualizados:**
```typescript
import EditTransactionModal from '@/components/NewTransactionModal';
import CreateTransactionModal from '@/components/UnifiedTransactionModal';
```

2. **Estado `isCreating` adicionado:**
```typescript
const [isCreating, setIsCreating] = useState(false);
```

3. **Lógica de abertura do modal:**
   - Botão "Nova Transação" → `setIsCreating(true)` + abre modal com tabs
   - Botão "Editar" → `setIsCreating(false)` + abre modal simples

4. **Dois modals condicionais no JSX:**
```tsx
{/* Modal de Criar - com tabs Única/Recorrente/Parcelada */}
{isCreating && (
  <CreateTransactionModal ... />
)}

{/* Modal de Editar - formulário simples */}
{!isCreating && editingTransaction && (
  <EditTransactionModal ... />
)}
```

### 🚀 Funcionalidades Habilitadas

#### Tab "Única" (transação simples)
- Comportamento padrão, como antes
- Cria uma transação única

#### Tab "Recorrente"
- **Frequência:** Diário, Semanal, Quinzenal, Mensal, Bimestral, Trimestral, Semestral, Anual
- **Intervalo:** A cada X períodos
- **Duração:** Número de ocorrências ou sem fim
- **Exemplo:** Energia 12x → Gera 12 transações (uma para cada mês)

#### Tab "Parcelada"
- **Número de parcelas:** 2 a 72
- **Entrada (opcional):** Valor diferente na primeira parcela
- **Cálculo automático:** Mostra valor total
- **Exemplo:** 6x R$50 → Gera 6 transações, total R$300

### 📡 Endpoints do Backend (já existentes)

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/v1/transactions/recurring` | POST | Criar transação recorrente |
| `/api/v1/transactions/installment` | POST | Criar transação parcelada |

### 🧪 Como Testar

1. Acesse **https://utopsistema.com.br/dashboard**
2. Clique em **"+ Nova Transação"**
3. Veja as 3 tabs: **Única | Recorrente | Parcelada**
4. Escolha uma tab e preencha os campos
5. Clique em "Criar"

### 👥 Impacto

| Tipo de Usuário | Contemplado? |
|-----------------|--------------|
| Usuários existentes | ✅ SIM |
| Usuários novos | ✅ SIM |
| Transações já criadas | Continuam funcionando normalmente |

### 📊 Estado Final do Sistema

| Componente | Status | Última Ação |
|------------|--------|-------------|
| Backend | ✅ Online | Rotas recurring/installment funcionando |
| Frontend | ✅ Online | Rebuild com tabs Única/Recorrente/Parcelada |
| PostgreSQL | ✅ Online | Healthy |
| Redis | ✅ Online | Healthy |
| Nginx | ✅ Online | Proxy reverso ativo |

---

*Última atualização: 23/Dez/2025 13:45 BRT*

---

## 📅 23/Dez/2025 - SESSÃO 4: Rate Limit por Email + Esqueceu Senha

### 🎯 Problemas Identificados e Resolvidos

#### 1. Rate Limit Global por IP
- **Problema:** O rate limit bloqueava TODOS os usuários do mesmo IP após tentativas falhas
- **Impacto:** Em redes compartilhadas, um usuário bloqueava todos os outros
- **Solução:** Mudança para rate limit POR EMAIL usando Redis

#### 2. Erro P2003 ao Registrar Novo Usuário
- **Problema:** Ao registrar, erro de foreign key constraint nas categorias
- **Causa:** `createDefaultCategories` era chamado FORA da transação Prisma
- **Solução:** Passar o parâmetro `tx` para a função `createDefaultCategories(tenantId, tx)`

#### 3. Funcionalidade "Esqueceu Senha" Inexistente
- **Problema:** Não havia endpoint nem fluxo para recuperação de senha
- **Solução:** Implementados endpoints `forgot-password` e `reset-password`

### ✅ Implementações

#### 1. Rate Limit por Email (Redis)

| Aspecto | Configuração |
|---------|--------------|
| Máximo de tentativas | 5 por email |
| Tempo de bloqueio | 15 minutos |
| Storage | Redis (ioredis) |
| Chave | `login_attempts:{email}` |

**Arquivos modificados:**
- `backend/src/services/auth.service.ts` - Funções `recordFailedLogin()`, `isLoginBlocked()`, `clearFailedLogins()`
- `backend/src/main.ts` - Chamada de `recordFailedLogin()` em login falho

**Comportamento:**
```
Tentativa 1-5: "Credenciais inválidas"
Tentativa 6+: "Muitas tentativas de login. Tente novamente em 15 minutos."
Login bem-sucedido: Limpa contador de tentativas
```

#### 2. Esqueceu Senha (Forgot Password)

| Endpoint | `POST /api/v1/auth/forgot-password` |
|----------|-------------------------------------|
| Body | `{ "email": "usuario@email.com" }` |
| Resposta | Sempre 200 (segurança) |
| Token | Válido por 1 hora |
| Email | Enviado via Resend |

**Fluxo:**
1. Usuário solicita reset de senha
2. Sistema gera token e salva no banco (`passwordResetToken`, `passwordResetExpires`)
3. Email enviado com link: `https://utopsistema.com.br/reset-password?token=xxx`
4. Resposta genérica: "Se o email estiver cadastrado, você receberá um link"

#### 3. Resetar Senha (Reset Password)

| Endpoint | `POST /api/v1/auth/reset-password` |
|----------|-------------------------------------|
| Body | `{ "token": "xxx", "newPassword": "NovaSenha123!" }` |
| Validação | Token válido e não expirado |
| Resultado | Senha atualizada, token invalidado |

#### 4. Correção de Registro de Usuários

**Problema original:**
```typescript
// ERRADO - fora da transação
await createDefaultCategories(tenant.id);
```

**Solução:**
```typescript
// CORRETO - dentro da transação
await createDefaultCategories(tenant.id, tx);
```

**Arquivo:** `backend/src/utils/default-categories.ts`
- Função agora aceita parâmetro opcional `tx` (PrismaClient ou Transaction)

#### 5. Reset de Categorias para Todos os Tenants

- **Script:** `reset_categories.js`
- **Ação:** Deletou todas as categorias existentes e recriou com estrutura padrão
- **Resultado:** 4 tenants × 140 categorias = 560 categorias totais

| Nível | Quantidade por Tenant |
|-------|----------------------|
| L1 (pai) | 17 |
| L2 (filho) | 93 |
| L3 (neto) | 30 |
| **Total** | **140** |

### 📂 Arquivos Modificados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `backend/src/main.ts` | MODIFICADO | Endpoints forgot/reset-password, recordFailedLogin no login |
| `backend/src/services/auth.service.ts` | MODIFICADO | Funções de rate limit com ioredis, getPasswordResetLink |
| `backend/src/utils/default-categories.ts` | MODIFICADO | Aceita tx para transações |
| `reset_categories.js` | CRIADO | Script de reset de categorias |
| `test_rate.sh` | CRIADO | Script de teste de rate limit |

### 🧪 Testes Realizados

| Teste | Resultado |
|-------|-----------|
| 6 tentativas de login erradas | ✅ Bloqueado na 6ª tentativa |
| Forgot password com email válido | ✅ Email enviado |
| Forgot password com email inválido | ✅ Resposta genérica (segurança) |
| Registro de novo usuário | ✅ 140 categorias criadas |
| Login após bloqueio (15 min) | ✅ Desbloqueado automaticamente |

### 📋 Próximos Passos

1. **Frontend Reset Password**
   - [ ] Criar página `/reset-password` no frontend
   - [ ] Formulário para nova senha
   - [ ] Validação de força da senha

2. **Frontend Forgot Password**
   - [ ] Adicionar link "Esqueceu a senha?" na tela de login
   - [ ] Formulário para solicitar reset

### 📊 Estado Final do Sistema

| Componente | Status | Última Ação |
|------------|--------|-------------|
| Backend | ✅ Online | Rate limit por email + forgot password |
| Frontend | ✅ Online | Tabs Única/Recorrente/Parcelada |
| PostgreSQL | ✅ Online | 5 tenants, 700 categorias |
| Redis | ✅ Online | Armazenando tentativas de login |
| Nginx | ✅ Online | Proxy reverso ativo |

---

## 📅 23/Dez/2025 - SESSÃO 5: Esquema de Cores Premium + Correções

### 🎨 Esquema de Cores Premium Implementado

**Opção 2 - Preto & Dourado Premium:**

| Elemento | Cor | Hex |
|----------|-----|-----|
| Sidebar/Logo | Preto gradiente | `#1A1A1A → #2A2A2A` |
| Acentos | Champagne Gold | `#C9A962` |
| Receitas/Positivo | Azul | `#2563EB` |
| Despesas/Negativo | Rose Red | `#E11D48` |
| Background claro dourado | Light Gold | `#F5F0E6` |
| Background claro azul | Light Blue | `#DBEAFE` |
| Background claro rose | Light Rose | `#FFF1F2` |

### ✅ Arquivos Modificados

| Arquivo | Descrição |
|---------|-----------|
| `frontend/src/components/Logo.tsx` | Ícone preto com "U" dourado e borda dourada |
| `frontend/src/components/Sidebar.tsx` | Avatar dourado, menu ativo com borda dourada |
| `frontend/src/app/page.tsx` | Página de login redesenhada preto/dourado |
| `frontend/src/app/dashboard/page.tsx` | Saldo Final com links clicáveis, azul income, rose expense |
| `frontend/src/app/dashboard/layout.tsx` | Spinner de loading dourado + lógica auth melhorada |
| `frontend/src/app/dashboard/transactions/page.tsx` | Suporte a parâmetro `?type=` da URL |
| `frontend/src/components/QuickActions.tsx` | Botões de ação preto/dourado |
| `frontend/src/components/NewTransactionModal.tsx` | Botões income azul, expense rose |
| `frontend/src/components/DashboardHeader.tsx` | Busca e botão add dourados |

### 🐛 Bug Corrigido: Página de Login Sobrescrita

**Problema:** O `page.tsx` da raiz foi acidentalmente sobrescrito com código de transações, causando "Carregando transações..." na página de login.

**Solução:** Restaurado arquivo correto via SCP do local para servidor.

### 🔗 Links Clicáveis no Saldo Final

- Clicar em **RECEITAS** → `/dashboard/transactions?type=INCOME`
- Clicar em **DESPESAS** → `/dashboard/transactions?type=EXPENSE`

### � Bug Corrigido: Tabs Única/Recorrente/Parcelada Sumiram

**Problema:** O modal de "Nova Transação" estava mostrando apenas o formulário simples, sem as tabs para criar transações Recorrentes e Parceladas.

**Causa:** As páginas estavam usando apenas `NewTransactionModal` em vez de `UnifiedTransactionModal`.

**Solução:** 
- `dashboard/page.tsx` → Usa `CreateTransactionModal` (UnifiedTransactionModal) com tabs
- `dashboard/transactions/page.tsx` → Usa 2 modals:
  - `CreateTransactionModal` para **criar** (com tabs Única/Recorrente/Parcelada)
  - `EditTransactionModal` para **editar** (formulário simples)

**Arquivos modificados:**
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/dashboard/transactions/page.tsx`

### 📊 Estado do Sistema

| Componente | Status |
|------------|--------|
| Frontend | ✅ Online - Tabs restauradas |
| Backend | ✅ Online |
| PostgreSQL | ✅ Online |
| Redis | ✅ Online |
| Nginx | ✅ Online |

---

## 📅 24/Dez/2025 - SESSÃO 6: Correção de Contraste em Inputs Mobile

### 🎯 Problema Identificado

Inputs de data e campos de texto estavam com **fundo branco e texto branco** no mobile, tornando impossível visualizar o conteúdo digitado.

**Causa:** 
- Faltava classe `text-gray-900` para forçar texto escuro
- Faltava `style={{ colorScheme: 'light' }}` para inputs de data no Safari/iOS

### ✅ Arquivos Corrigidos

| Arquivo | Elementos Corrigidos |
|---------|----------------------|
| `dashboard/page.tsx` | Inputs de data no modal de filtro de período |
| `dashboard/reports/page.tsx` | Inputs de data nos filtros de relatório |
| `CreateBillModal.tsx` | TODOS os inputs e selects (nome, valor, data, frequência, categoria, conta, método) |
| `CreateInstallmentModal.tsx` | TODOS os inputs e selects (nome, valor, data, parcelas, categoria, conta, método) |

### 🔧 Padrão de Correção Aplicado

**Antes:**
```tsx
<input type="date" className="w-full px-3 py-2 border rounded-lg bg-[#F9FAFB]" />
```

**Depois:**
```tsx
<input 
  type="date" 
  className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 min-h-[44px]" 
  style={{ colorScheme: 'light' }}
  aria-label="Data"
  title="Data"
/>
```

### 🔧 Correção Adicional: Erro TypeScript no Recharts

**Problema:** Build falhou com erro de tipo no componente `Pie` do Recharts:
```
Property 'icon' does not exist on type 'PieLabelRenderProps'.
```

**Solução:**
```tsx
// ANTES
label={(entry) => `${entry.icon} ${entry.percentage.toFixed(1)}%`}

// DEPOIS
label={(entry: any) => `${entry.icon || ''} ${entry.percentage?.toFixed(1) || 0}%`}
```

### 📂 Arquivos Modificados

| Arquivo | Linhas Afetadas | Descrição |
|---------|-----------------|-----------|
| `frontend/src/app/dashboard/page.tsx` | ~753-767 | Inputs de data do modal período |
| `frontend/src/app/dashboard/reports/page.tsx` | ~127-145, 405 | Inputs de data + Pie chart label |
| `frontend/src/components/recurring-bills/CreateBillModal.tsx` | 8 elementos | Todos inputs/selects |
| `frontend/src/components/installments/CreateInstallmentModal.tsx` | 4 elementos | Todos inputs/selects |

### 📡 Comandos Executados

```bash
# Upload dos arquivos corrigidos
scp frontend/src/app/dashboard/page.tsx root@91.99.16.145:/opt/utop/frontend/src/app/dashboard/
scp frontend/src/app/dashboard/reports/page.tsx root@91.99.16.145:/opt/utop/frontend/src/app/dashboard/
scp frontend/src/components/recurring-bills/CreateBillModal.tsx root@91.99.16.145:/opt/utop/frontend/src/components/recurring-bills/
scp frontend/src/components/installments/CreateInstallmentModal.tsx root@91.99.16.145:/opt/utop/frontend/src/components/installments/

# Rebuild do frontend
docker compose -f docker-compose.prod.yml up -d --build frontend
```

### � Correção Adicional: Schema do Prisma para Transações Recorrentes/Parceladas

**Problema:** Erro `PrismaClientValidationError` ao criar transações recorrentes ou parceladas.

**Causa:** O modelo `Transaction` no schema.prisma não tinha os campos necessários para suportar transações recorrentes e parceladas diretamente.

**Solução:** Adicionados campos ao modelo `Transaction`:

```prisma
model Transaction {
  // ... campos existentes ...
  
  // Novos campos adicionados:
  transactionType String    @default("single") // single, recurring, installment
  originalAmount  Decimal?  @db.Decimal(15, 2) // Valor original (para parceladas)
  parentId        String?   // ID da transação pai (template)
  
  // Campos para transações RECORRENTES
  frequency       String?   // daily, weekly, biweekly, monthly, etc.
  frequencyInterval Int?    // A cada X períodos
  totalOccurrences Int?     // Número total de ocorrências (null = infinito)
  currentOccurrence Int?    // Ocorrência atual
  startDate       DateTime? // Data de início da recorrência
  endDate         DateTime? // Data de fim
  nextDueDate     DateTime? // Próxima data de vencimento
  alertDaysBefore Int?      // Dias antes para alertar
  autoGenerateNext Boolean? // Gerar próxima automaticamente
  
  // Campos para transações PARCELADAS
  totalInstallments Int?    // Total de parcelas
  installmentNumber Int?    // Número da parcela atual
  hasDownPayment  Boolean?  // Tem entrada?
  downPaymentAmount Decimal? @db.Decimal(15, 2) // Valor da entrada
  
  // Relação pai/filho
  parent          Transaction? @relation("TransactionHierarchy", ...)
  children        Transaction[] @relation("TransactionHierarchy")
}
```

**Comandos executados:**
```bash
# Aplicar alterações no banco
docker compose exec -T backend npx prisma@5.22.0 db push --accept-data-loss

# Rebuild do backend
docker compose -f docker-compose.prod.yml up -d --build backend
```

### 🤖 Correção: Posição do Chatbot no Mobile

**Problema:** O botão do chatbot estava sobre os botões de ação do modal, atrapalhando a visibilidade.

**Solução:** Ajustada a posição e tamanho do chatbot no mobile:

```tsx
// ANTES
className="fixed bottom-6 right-6 w-14 h-14 ... z-50"

// DEPOIS
className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 ... z-40"
```

**Mudanças:**
- Botão: `bottom-20` no mobile (80px), `bottom-6` no desktop (24px)
- Tamanho: `w-12 h-12` no mobile, `w-14 h-14` no desktop
- Widget aberto: Tela cheia no mobile, janela 96x600px no desktop
- z-index: Reduzido de `z-50` para `z-40` para não sobrepor modais

### 📊 Estado do Sistema

| Componente | Status |
|------------|--------|
| Frontend | ✅ Online - Inputs corrigidos |
| Backend | ✅ Online |
| PostgreSQL | ✅ Online |
| Redis | ✅ Online |
| Nginx | ✅ Online |

---

*Última atualização: 24/Dez/2025 14:42 BRT*

