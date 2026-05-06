/**
 * UTOP Reliability Sprint 3 — Reconciliação de saldo de conta bancária.
 *
 * O `BankAccount.currentBalance` é mantido por incrementos/decrementos
 * dispersos (criação/edição/remoção de transação, transferências, etc.).
 * Em produção podem aparecer divergências por:
 *   - bugs históricos de cascata
 *   - importações OFX que falham parcialmente
 *   - migrations parciais
 *   - edição manual via Prisma Studio
 *
 * Este script é a FERRAMENTA MÍNIMA de reconciliação:
 *
 *   Modo DRY-RUN (default): só reporta divergência. Não escreve.
 *   Modo APPLY: corrige `currentBalance` para o valor reconciliado E grava
 *               linha em `AuditLog` para rastreabilidade.
 *
 * Fórmula reconciliada:
 *   reconciled =
 *     initialBalance
 *     + Σ amount  (transactions WHERE deletedAt IS NULL AND status='completed')
 *
 * Detalhes:
 *   - Transações 'income' têm `amount` positivo já no banco; 'expense'
 *     positivo (serviço grava sempre absoluto). Para reconciliar,
 *     somamos com sinal: income +, expense -, transfer (já gravado com
 *     sinal correto: -saída em uma perna, +entrada na outra).
 *   - Pendentes/atrasadas NÃO entram (não impactam saldo "real").
 *   - `deletedAt IS NULL` filtro obrigatório.
 *
 * Uso:
 *
 *   # Reconcilia TODAS as contas de um tenant (dry-run):
 *   ts-node backend/scripts/reconcile-balance.ts --tenant=<TENANT_ID>
 *
 *   # Conta específica:
 *   ts-node backend/scripts/reconcile-balance.ts --tenant=<T_ID> --account=<A_ID>
 *
 *   # Aplica correção:
 *   ts-node backend/scripts/reconcile-balance.ts --tenant=<T_ID> --apply
 *
 *   # Todas as contas de TODOS os tenants (audit global, dry-run):
 *   ts-node backend/scripts/reconcile-balance.ts --all
 *
 * Saída: tabela com colunas
 *   account | currentBalance | reconciled | diff | status
 *
 * Segurança:
 *   - Todas as escritas em `prisma.$transaction`.
 *   - Cada correção gera AuditLog com action='balance_reconcile'.
 *   - Tolerância 0.01 (1 centavo) para evitar ruído de arredondamento.
 *   - Sem --apply, NUNCA escreve.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// 1 centavo — abaixo disso é arredondamento, não divergência real.
const TOLERANCE = new Prisma.Decimal('0.01');

interface CliArgs {
  tenantId?: string;
  accountId?: string;
  all: boolean;
  apply: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { all: false, apply: false };
  for (const a of argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--all') args.all = true;
    else if (a.startsWith('--tenant=')) args.tenantId = a.slice('--tenant='.length);
    else if (a.startsWith('--account=')) args.accountId = a.slice('--account='.length);
  }
  return args;
}

interface ReconcileResult {
  accountId: string;
  accountName: string;
  tenantId: string;
  currentBalance: Prisma.Decimal;
  reconciled: Prisma.Decimal;
  diff: Prisma.Decimal;
  status: 'OK' | 'DIVERGENT' | 'FIXED' | 'ERROR';
  error?: string;
}

async function reconcileAccount(
  accountId: string,
  apply: boolean,
): Promise<ReconcileResult> {
  const account = await prisma.bankAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      name: true,
      tenantId: true,
      currentBalance: true,
      initialBalance: true,
      deletedAt: true,
    },
  });

  if (!account) {
    return {
      accountId,
      accountName: '<not found>',
      tenantId: '',
      currentBalance: new Prisma.Decimal(0),
      reconciled: new Prisma.Decimal(0),
      diff: new Prisma.Decimal(0),
      status: 'ERROR',
      error: 'Account not found',
    };
  }

  // Soma com sinal: amount já está com sinal correto na tabela
  // (transferências usam negativo na perna OUT, positivo na IN; receita
  // positiva; despesa NEGATIVA — confirmar com a service. O serviço grava
  // expense com sinal positivo e a aplicação dos sinais é feita no read.
  // Para garantir robustez, separamos por type aqui.).
  const txns = await prisma.transaction.findMany({
    where: {
      bankAccountId: accountId,
      deletedAt: null,
      status: 'completed',
    },
    select: { type: true, amount: true },
  });

  let sum = new Prisma.Decimal(0);
  for (const t of txns) {
    const amt = new Prisma.Decimal(t.amount as any);
    switch (t.type) {
      case 'income':
        sum = sum.add(amt.abs());
        break;
      case 'expense':
        sum = sum.sub(amt.abs());
        break;
      case 'transfer':
        // Transferências são gravadas COM sinal (negativo em uma perna,
        // positivo na outra). Soma sem manipular.
        sum = sum.add(amt);
        break;
      default:
        sum = sum.add(amt);
    }
  }

  const reconciled = new Prisma.Decimal(account.initialBalance as any).add(sum);
  const current = new Prisma.Decimal(account.currentBalance as any);
  const diff = reconciled.sub(current);

  const isOk = diff.abs().lessThanOrEqualTo(TOLERANCE);

  if (isOk) {
    return {
      accountId: account.id,
      accountName: account.name,
      tenantId: account.tenantId,
      currentBalance: current,
      reconciled,
      diff,
      status: 'OK',
    };
  }

  if (!apply) {
    return {
      accountId: account.id,
      accountName: account.name,
      tenantId: account.tenantId,
      currentBalance: current,
      reconciled,
      diff,
      status: 'DIVERGENT',
    };
  }

  // APPLY: corrigir + auditar dentro de tx.
  await prisma.$transaction(async (tx) => {
    await tx.bankAccount.update({
      where: { id: account.id },
      data: { currentBalance: reconciled },
    });
    // AuditLog requer userId (não nullable). Usa o ownerId do tenant
    // (sempre existe — Tenant.ownerId é NOT NULL no schema).
    const tenant = await tx.tenant.findUnique({
      where: { id: account.tenantId },
      select: { ownerId: true },
    });
    if (!tenant) return;
    await tx.auditLog.create({
      data: {
        tenantId: account.tenantId,
        userId: tenant.ownerId,
        action: 'balance_reconcile',
        resourceType: 'BankAccount',
        resourceId: account.id,
        changes: JSON.stringify({
          previous: current.toString(),
          new: reconciled.toString(),
          diff: diff.toString(),
          tool: 'reconcile-balance.ts',
        }),
      },
    });
  });

  return {
    accountId: account.id,
    accountName: account.name,
    tenantId: account.tenantId,
    currentBalance: current,
    reconciled,
    diff,
    status: 'FIXED',
  };
}

async function listAccounts(args: CliArgs): Promise<string[]> {
  const where: Prisma.BankAccountWhereInput = { deletedAt: null };
  if (args.accountId) where.id = args.accountId;
  if (args.tenantId) where.tenantId = args.tenantId;
  const accounts = await prisma.bankAccount.findMany({
    where,
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  return accounts.map((a) => a.id);
}

function printRow(r: ReconcileResult) {
  const tag =
    r.status === 'OK'
      ? '✅'
      : r.status === 'FIXED'
        ? '🔧'
        : r.status === 'ERROR'
          ? '❌'
          : '⚠️ ';
  // eslint-disable-next-line no-console
  console.log(
    `${tag} [${r.status.padEnd(9)}] ${r.accountId}  "${r.accountName}"  ` +
      `current=${r.currentBalance.toFixed(2)}  reconciled=${r.reconciled.toFixed(2)}  ` +
      `diff=${r.diff.toFixed(2)}` +
      (r.error ? `  err=${r.error}` : ''),
  );
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.all && !args.tenantId) {
    // eslint-disable-next-line no-console
    console.error(
      'usage: reconcile-balance.ts [--tenant=<id>] [--account=<id>] [--all] [--apply]',
    );
    process.exit(2);
  }

  // eslint-disable-next-line no-console
  console.log(
    `\n🔍 reconcile-balance — mode=${args.apply ? 'APPLY' : 'DRY-RUN'} ` +
      `tenant=${args.tenantId ?? '(all)'} account=${args.accountId ?? '(all)'}\n`,
  );

  const ids = await listAccounts(args);
  if (ids.length === 0) {
    // eslint-disable-next-line no-console
    console.log('Nenhuma conta encontrada para os filtros.');
    return;
  }

  const results: ReconcileResult[] = [];
  for (const id of ids) {
    try {
      const r = await reconcileAccount(id, args.apply);
      results.push(r);
      printRow(r);
    } catch (err: any) {
      const r: ReconcileResult = {
        accountId: id,
        accountName: '<error>',
        tenantId: '',
        currentBalance: new Prisma.Decimal(0),
        reconciled: new Prisma.Decimal(0),
        diff: new Prisma.Decimal(0),
        status: 'ERROR',
        error: err?.message ?? String(err),
      };
      results.push(r);
      printRow(r);
    }
  }

  const ok = results.filter((r) => r.status === 'OK').length;
  const div = results.filter((r) => r.status === 'DIVERGENT').length;
  const fix = results.filter((r) => r.status === 'FIXED').length;
  const err = results.filter((r) => r.status === 'ERROR').length;

  // eslint-disable-next-line no-console
  console.log(
    `\nResumo: ${results.length} contas | ${ok} OK | ${div} divergentes | ` +
      `${fix} corrigidas | ${err} erros\n`,
  );

  if (!args.apply && div > 0) {
    // eslint-disable-next-line no-console
    console.log('Para aplicar correção: rode novamente com --apply');
    process.exit(1);
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('reconcile-balance falhou:', err);
    process.exit(2);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
