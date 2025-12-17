# 🚀 UTOP - Seu dinheiro em equilíbrio

Sistema completo de gestão financeira pessoal com arquitetura multi-tenant.

> **Missão**: Ajudar pessoas a conquistarem equilíbrio financeiro de forma leve, sem pressão ou complicações.

##  Tecnologias

### Backend
- Node.js 18+
- Express 4.18
- TypeScript 5.3
- Prisma ORM 5.22
- PostgreSQL 16
- JWT Authentication

### Frontend
- Next.js 14
- React 18.2
- TypeScript 5.3
- Zustand (State Management)
- Tailwind CSS 3.4
- Zod (Validação)

##  Funcionalidades

-  **Autenticação Multi-tenant**: Controle de acesso seguro com JWT + Refresh Tokens
-  **Transações Unificadas**: Sistema único para transações simples, recorrentes e parceladas
-  **Dashboard Completo**: Métricas, rankings e análises financeiras
-  **Categorias Hierárquicas**: Até 3 níveis de organização
-  **Contas Bancárias**: Múltiplas contas com transferências
-  **Métodos de Pagamento**: Cartões, PIX, dinheiro e mais
-  **Orçamentos**: Controle de gastos por categoria
-  **Calendário Financeiro**: Visualização temporal das transações
-  **Relatórios**: Análises detalhadas e exportações
-  **Alertas e Notificações**: Avisos de vencimentos e limites

##  Status do Projeto

- **Backend**: 136 testes passando 
- **Frontend**: 47 testes passando 
- **Code Quality**: 12 warnings (apenas estilos dinâmicos válidos)
- **Migration**: Schema unificado aplicado 

##  Instalação

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Configure o DATABASE_URL no .env
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

##  Estrutura do Projeto

```
FYNANPRO2.0/
 backend/          # API REST + Jobs
 frontend/         # Interface Next.js
 docker-compose.yml
 docs/            # Documentação completa
```

##  Segurança

- Autenticação JWT com refresh tokens
- Isolamento multi-tenant em todas as queries
- Middleware de segurança em todas as rotas
- Validação de dados com Zod
- Logs estruturados

##  Documentação

Veja [DOCUMENTACAO-COMPLETA.md](./DOCUMENTACAO-COMPLETA.md) para detalhes técnicos completos.

##  Autor

**Max Guarinieri**
- Email: max.guarinieri@gmail.com

##  Licença

Propriedade privada - Todos os direitos reservados.
