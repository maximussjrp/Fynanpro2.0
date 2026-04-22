# 🚀 UTOP - Sistema Financeiro Pessoal

> **Missão**: Ajudar pessoas a conquistarem equilíbrio financeiro de forma leve, sem pressão ou complicações.

## 📋 Informações do Projeto

| Item | Valor |
|------|-------|
| **Nome** | UTOP Sistema |
| **Servidor VPS** | 91.99.16.145 |
| **Projeto no servidor** | /opt/utop |
| **API URL (Produção)** | https://api.utopsistema.com.br/api/v1 |
| **Frontend URL (Produção)** | https://utopsistema.com.br |
| **Backend Port** | 4000 (interno: 3000) |
| **Frontend Port** | 3001 (interno: 3000) |

## 🏗️ Stack Tecnológica

### Backend
- Node.js 18+
- Express 4.18
- TypeScript 5.3
- Prisma ORM 5.22
- PostgreSQL 15

### Frontend
- Next.js 14
- React 18.2
- TypeScript 5.3
- Zustand (State Management)
- Tailwind CSS 3.4
- Zod (Validação)

## ⚠️ IMPORTANTE - Banco de Dados

**Este projeto utiliza APENAS o banco de dados do servidor de produção.**

Não existe banco de dados local. Todas as operações devem ser feitas:
1. Diretamente no servidor via SSH
2. Localmente via SSH Tunnel

### Conectar ao banco via SSH Tunnel (desenvolvimento local):
```bash
# Terminal 1: Criar tunnel
ssh -L 5433:localhost:5432 root@91.99.16.145

# No .env local, usar:
DATABASE_URL="postgresql://utop_user:SENHA@localhost:5433/utop?schema=public"
```

## 🚀 Deploy

### Deploy do Frontend:
```bash
scp arquivo root@91.99.16.145:/opt/utop/frontend/caminho/arquivo

ssh root@91.99.16.145 "cd /opt/utop/frontend && docker build --build-arg NEXT_PUBLIC_API_URL=https://api.utopsistema.com.br/api/v1 -t utop-frontend:latest . && docker rm -f utop-frontend && docker run -d --name utop-frontend --network utop_utop_net -p 3001:3001 utop-frontend:latest"
```

### Deploy do Backend:
```bash
scp arquivo root@91.99.16.145:/opt/utop/backend/caminho/arquivo

ssh root@91.99.16.145 "cd /opt/utop/backend && docker build -t utop-backend:latest . && docker rm -f utop-backend && docker run -d --name utop-backend --network utop_utop_net -p 4000:3000 --env-file .env utop-backend:latest"
```

## 📁 Estrutura do Projeto

```
utop-sistema/
├── backend/           # API REST Node.js/Express
│   ├── src/           # Código fonte
│   ├── prisma/        # Schema e migrations
│   └── dist/          # Build compilado
├── frontend/          # Interface Next.js
│   ├── src/           # Código fonte
│   └── public/        # Assets estáticos
├── nginx/             # Configuração do proxy reverso
├── ssl/               # Certificados SSL
└── docker-compose.prod.yml  # Orquestração Docker
```

## 🔐 Regras de Segurança

⚠️ **REGRA CRÍTICA - NÃO VIOLAR EM HIPÓTESE ALGUMA** ⚠️

**NÃO MEXA NOS DADOS DOS USUÁRIOS.**
- NÃO ALTERE dados de usuários
- NÃO DELETE registros de usuários
- NÃO MODIFIQUE transações de usuários

## 👤 Autor

**Max Guarinieri**
- Email: max.guarinieri@gmail.com

## 📄 Licença

Propriedade privada - Todos os direitos reservados.
