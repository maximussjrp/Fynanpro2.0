# Archive

Arquivos legados removidos do fluxo de execução, preservados para referência/rollback.

| Arquivo | Origem | Motivo da remoção | Data |
|---|---|---|---|
| `main-routes.ts.legacy` | `backend/src/main-routes.ts` | Segundo entrypoint com `app.listen()` próprio, conjunto de rotas duplicadas e `PrismaClient` paralelo. Não importado por nada em `backend/src/`. Risco de subir servidor "sombra" sem middlewares de tenant/JWT. Entrypoint oficial: `backend/src/main.ts` (via `docker-entrypoint.sh`). | 2026-04-22 |
| `nginx.conf.legacy` | `nginx.conf` (raiz) | Divergia de `nginx/nginx.conf` (o único montado em `docker-compose.prod.yml:100`). Certificados apontavam para `/etc/nginx/certs/` (path inexistente). Rodar `docker-compose.yml` de dev podia subir nginx quebrado. | 2026-04-22 |

## Restauração

Se necessário restaurar:

```powershell
Move-Item archive/main-routes.ts.legacy backend/src/main-routes.ts
Move-Item archive/nginx.conf.legacy nginx.conf
```

## Notas

- `backend/prisma/` contém artefatos gerados versionados indevidamente (`prisma-client.{ts,js,d.ts,d.ts.map,js.map}`, `dev.db`, `transactions.ts`, `transaction.service.ts`, `recurring-bills.ts`). Nenhum é importado por `backend/src/`. Pendentes de decisão — **não movidos nesta rodada**.
