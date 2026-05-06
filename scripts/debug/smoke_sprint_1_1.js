/**
 * Smoke Sprint 1.1 — confirma que uma Transaction criada pelo chatbot
 * carrega atribuição (source/createdByAssistant/sourceSessionId/
 * sourceMessageId/assistantRunId) e gera AuditLog.
 *
 * Uso (dentro do container utop-backend):
 *   node /app/smoke_sprint_1_1.js
 */
const { PrismaClient } = require('@prisma/client');
const { chatbotService } = require('./dist/services/chatbot.service');

const TENANT_ID = 'eb21b270-170b-4c1e-83dc-2b4e49f22341';
const USER_ID = 'b627dea3-cd40-428e-ae2f-ff4da11c5799';
const ACCOUNT_ID = 'd891b545-361d-46dd-99fd-2ecb1287f510';
const CATEGORY_ID = '568cc402-8383-460d-995d-36602d40f853';

const prisma = new PrismaClient();

(async () => {
  // 1. Pré-popula a ChatSession em estado CONFIRMING, com um
  //    tempTransaction já montado. Isso isola o smoke no handleConfirming.
  const existing = await prisma.chatSession.findUnique({
    where: { tenantId_userId: { tenantId: TENANT_ID, userId: USER_ID } },
    select: { id: true, context: true, state: true },
  });

  const baseContext = existing?.context ? JSON.parse(existing.context) : {};
  const preparedContext = {
    ...baseContext,
    tempTransaction: {
      type: 'expense',
      amount: 0.01,
      description: 'SMOKE-SPRINT-1.1',
      categoryId: CATEGORY_ID,
      categoryName: 'Moradia',
      bankAccountId: ACCOUNT_ID,
    },
    bankAccounts: baseContext.bankAccounts || [
      { id: ACCOUNT_ID, name: 'Cofrinho Itaú Dan' },
    ],
  };

  if (existing) {
    await prisma.chatSession.update({
      where: { id: existing.id },
      data: {
        state: 'confirming',
        context: JSON.stringify(preparedContext),
      },
    });
    console.log(`[pre] session ${existing.id} -> state=confirming`);
  } else {
    const created = await prisma.chatSession.create({
      data: {
        tenantId: TENANT_ID,
        userId: USER_ID,
        state: 'confirming',
        context: JSON.stringify(preparedContext),
        learnedPatterns: '[]',
      },
      select: { id: true },
    });
    console.log(`[pre] session ${created.id} criada com state=confirming`);
  }

  // 2. Dispara a confirmação pelo service (mesmo caminho do POST /chatbot/message).
  const tsBefore = new Date();
  const result = await chatbotService.processMessage(TENANT_ID, USER_ID, 'sim');
  console.log('[chatbot response]', (result?.response || '').slice(0, 120), '...');

  // 3. Verifica a Transaction criada.
  const tx = await prisma.transaction.findFirst({
    where: {
      tenantId: TENANT_ID,
      description: 'SMOKE-SPRINT-1.1',
      createdAt: { gte: tsBefore },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      amount: true,
      source: true,
      createdByAssistant: true,
      sourceSessionId: true,
      sourceMessageId: true,
      assistantRunId: true,
      createdAt: true,
    },
  });
  console.log('[transaction]', JSON.stringify(tx, null, 2));

  // 4. Verifica o AuditLog correspondente.
  if (tx) {
    const audit = await prisma.auditLog.findFirst({
      where: {
        tenantId: TENANT_ID,
        action: 'CHATBOT_TRANSACTION_CREATE',
        resourceId: tx.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    console.log('[auditLog]', JSON.stringify(audit, null, 2));
  }

  // 5. Verdict automático.
  const ok =
    tx &&
    tx.source === 'chatbot' &&
    tx.createdByAssistant === true &&
    !!tx.sourceSessionId &&
    !!tx.sourceMessageId &&
    !!tx.assistantRunId;
  console.log(ok ? '[verdict] PASS' : '[verdict] FAIL');

  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(2);
});
