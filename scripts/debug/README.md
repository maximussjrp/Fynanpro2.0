# Debug scripts

Scripts ad-hoc usados para auditoria e correções pontuais. **Não são executados em produção automaticamente**.

## SQL (auditoria)
- `check_25jan.sql`, `check_jan.sql`, `check_today.sql`, `check_recent.sql` — queries por período
- `check_accounts.sql`, `check_tenant.sql`, `list_tenants.sql` — queries de contas/tenants
- `check_db.sql`, `check_smart.sql`, `check_foto.sql` — inspeções diversas

Executar com:
```bash
docker exec -i utop-postgres psql -U utop_user -d utop < scripts/debug/check_today.sql
```

## Python (fixes pontuais — históricos)
- `fix_desc_search.py` — correção de busca por descrição
- `fix_table_height.py` — correção visual de tabelas
- `fix_transactions.py` — correção de dados de transações
- `add_bulk_actions.py` — adicionou ações em lote

**Importante:** estes scripts Python já foram executados; estão aqui apenas como registro histórico. Ler o código antes de rodar novamente.
