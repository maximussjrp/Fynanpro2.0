# 🚀 UTOP - API Backend

Sistema completo de gestão financeira pessoal e empresarial com suporte multi-tenant, desenvolvido com Node.js, TypeScript, Express e Prisma ORM.

> **Slogan**: Seu dinheiro em equilíbrio

## 🚀 Funcionalidades

### Core Features
- ✅ **Autenticação JWT** com refresh tokens
- ✅ **Multi-tenant** com isolamento de dados
- ✅ **CRUD Completo** de transações financeiras
- ✅ **Categorização** automática de despesas/receitas
- ✅ **Contas Bancárias** múltiplas por tenant
- ✅ **Dashboard** com métricas em tempo real
- ✅ **Relatórios** financeiros avançados
- ✅ **Parcelas** e compras parceladas
- ✅ **Contas Recorrentes** mensais/anuais
- ✅ **Orçamentos** por categoria com alertas

### Segurança
- 🔐 Hash de senhas com bcrypt
- 🔐 Tokens JWT assinados
- 🔐 Rate limiting em todas as rotas
- 🔐 Tenant isolation automático
- 🔐 Validação de dados com Zod

### Performance
- ⚡ Cache Redis para dashboard
- ⚡ Índices compostos otimizados
- ⚡ Queries N+1 eliminadas
- ⚡ Paginação em todas as listagens

## 📋 Pré-requisitos

- Node.js >= 18.0.0
- PostgreSQL >= 14.0
- Redis >= 6.0 (opcional, mas recomendado)
- npm ou yarn

## 🔧 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/utop.git
cd utop/backend
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/utop"

# JWT
JWT_SECRET="sua-chave-secreta-muito-segura-com-pelo-menos-32-caracteres"
JWT_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# Server
PORT=3000
NODE_ENV="development"
FRONTEND_URL="http://localhost:3001"

# Redis (opcional)
REDIS_URL="redis://localhost:6379"
REDIS_ENABLED="true"

# Logs
LOG_LEVEL="info"
```

### 4. Execute as migrations

```bash
npx prisma migrate deploy
```

### 5. (Opcional) Popule dados iniciais

```bash
npx prisma db seed
```

## 🚀 Execução

### Desenvolvimento

```bash
npm run dev
```

A API estará disponível em `http://localhost:3000`

### Produção

```bash
# Build
npm run build

# Start
npm start
```

### Testes

```bash
# Todos os testes
npm test

# Com cobertura
npm run test:coverage

# Watch mode
npm run test:watch
```

## 📚 Documentação da API

### Swagger UI

Acesse a documentação interativa em:
```
http://localhost:3000/api-docs
```

### Endpoints Principais

#### Autenticação

- `POST /api/v1/auth/register` - Registrar novo usuário
- `POST /api/v1/auth/login` - Fazer login
- `POST /api/v1/auth/refresh` - Renovar access token
- `POST /api/v1/auth/change-password` - Alterar senha
- `POST /api/v1/auth/revoke-token` - Revogar refresh token

#### Transações

- `GET /api/v1/transactions` - Listar transações (com filtros e paginação)
- `GET /api/v1/transactions/:id` - Buscar transação por ID
- `POST /api/v1/transactions` - Criar transação
- `PUT /api/v1/transactions/:id` - Atualizar transação
- `DELETE /api/v1/transactions/:id` - Deletar transação (soft delete)
- `GET /api/v1/transactions/summary` - Resumo financeiro

#### Dashboard

- `GET /api/v1/dashboard/summary` - Métricas gerais
- `GET /api/v1/dashboard/balance` - Saldo consolidado
- `GET /api/v1/dashboard/expenses` - Top despesas
- `GET /api/v1/dashboard/chart` - Dados para gráficos

#### Outras Rotas

- Contas Bancárias: `/api/v1/bank-accounts`
- Categorias: `/api/v1/categories`
- Meios de Pagamento: `/api/v1/payment-methods`
- Orçamentos: `/api/v1/budgets`
- Relatórios: `/api/v1/reports`
- Parcelas: `/api/v1/installments`
- Contas Recorrentes: `/api/v1/recurring-bills`

### Autenticação

Todas as rotas (exceto `/auth/register` e `/auth/login`) exigem autenticação via Bearer Token:

```bash
curl -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  http://localhost:3000/api/v1/transactions
```

## 🗄️ Estrutura do Banco de Dados

### Modelos Principais

- **User** - Usuários do sistema
- **Tenant** - Empresas/organizações (multi-tenant)
- **TenantUser** - Relação many-to-many entre User e Tenant
- **Transaction** - Transações financeiras (receitas/despesas)
- **BankAccount** - Contas bancárias
- **Category** - Categorias de transações
- **PaymentMethod** - Meios de pagamento
- **Budget** - Orçamentos por categoria
- **RecurringBill** - Contas recorrentes
- **InstallmentPurchase** - Compras parceladas
- **RefreshToken** - Tokens de refresh (JWT)

### Diagrama ER

```
User ←→ TenantUser ←→ Tenant
         ↓
    Transaction
         ↓
  (Category, BankAccount, PaymentMethod)
```

## 🧪 Testes

O projeto possui **71 testes** cobrindo:

- ✅ **19 testes** de AuthService (registro, login, tokens)
- ✅ **22 testes** de TransactionService (CRUD completo)
- ✅ **14 testes** de Auth Routes (integração HTTP)
- ✅ **16 testes** de Transaction Routes (integração HTTP)

Cobertura atual: **~18%** (focada em services e routes críticos)

```bash
# Rodar todos os testes
npm test

# Com cobertura
npm run test:coverage
```

## 📦 Scripts Disponíveis

```json
{
  "dev": "nodemon src/main.ts",
  "build": "tsc",
  "start": "node dist/main.js",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "prisma:migrate": "prisma migrate dev",
  "prisma:studio": "prisma studio",
  "prisma:generate": "prisma generate",
  "lint": "eslint src --ext .ts",
  "format": "prettier --write \"src/**/*.ts\""
}
```

## 🐳 Docker

### Development

```bash
docker-compose up
```

### Production

```bash
docker-compose -f docker-compose.prod.yml up
```

## 🔒 Segurança

- Senhas hasheadas com bcrypt (10 rounds)
- JWT com expiração (15min access, 7 dias refresh)
- Rate limiting (5 tentativas de login por 15min)
- Validação de inputs com Zod
- SQL injection protegido pelo Prisma ORM
- CORS configurado para frontend específico
- Headers de segurança com helmet (recomendado)

## 📊 Performance

- Cache Redis para dashboard (5min TTL)
- Índices compostos em queries frequentes
- Paginação padrão: 20 itens
- Soft delete para transações (histórico preservado)
- Connection pooling do Prisma

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📝 Licença

MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 👥 Autores

- **Seu Nome** - Desenvolvedor Principal

## 🙏 Agradecimentos

- Prisma ORM
- Express.js
- TypeScript
- PostgreSQL
- Redis

## 📞 Suporte

- Email: support@utopsistema.com.br
- Issues: https://github.com/maximussjrp/Fynanpro2.0/issues
- Docs: http://localhost:3000/api-docs
