# Prisma orphans

Arquivos que estavam em `backend/prisma/` mas **nenhum código importa** (verificado por `grep` em todo o workspace).

- `prisma-client.ts` + artefatos compilados (`.js`, `.d.ts`, `.map`) — singleton alternativo (não usado; o sistema usa `backend/src/config/database.ts` e `backend/src/main.ts`)
- `recurring-bills.ts`, `transactions.ts`, `transaction.service.ts` — implementações antigas; versões ativas vivem em `backend/src/routes/` e `backend/src/services/`

## Restauração

```bash
git mv archive/prisma-orphans/<arquivo> backend/prisma/<arquivo>
```

## Por que arquivar, não deletar?

Preservar histórico caso contenham lógica que tenha sido perdida sem querer na migração para `src/`.
