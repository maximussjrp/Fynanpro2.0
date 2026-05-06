Plano para deixar o agent 10/10
Fase 1 — Base obrigatória de confiança

Meta: sair de “chat que age” para “chat que age com governança”.

Entregas
Adicionar rastreabilidade nas entidades acionadas pelo chat:
source
sourceMessageId
createdByAssistant
assistantRunId
confirmationMode
Escrever em AuditLog toda ação iniciada pelo assistente.
Correlacionar:
ChatMessage → ToolCall → Transaction/BankAccount/etc.
Confirmar se o provider LLM está realmente ativo em produção.
Definir política LGPD:
o que pode sair para LLM externo;
anonimização;
retenção;
consentimento/termo.
Resultado

Você ganha:

rastreabilidade;
suporte muito melhor;
base regulatória;
confiança para crescer.
Nota

Sem essa fase, eu não chamaria nada de “agent 10/10”.

Fase 2 — Tool layer real

Meta: transformar serviços do sistema em ferramentas padronizadas.

Criar uma camada de tools

Cada ação vira uma tool com:

nome
descrição
schema Zod
política de permissão
modo dry-run
execução real
retorno estruturado
Tools iniciais
create_transaction
list_categories
list_accounts
get_account_balance
create_bank_account
mark_recurring_bill_paid
get_budget_status
get_recent_transactions
Regras
tools financeiras críticas sempre com confirmação;
tools de leitura sem confirmação;
tudo tenant-scoped;
tudo com audit trail.
Resultado

Você separa:

conversa
decisão
execução

Esse é o divisor entre chatbot e agent.

Fase 3 — Orquestrador LLM

Meta: trocar regex-first por um roteador inteligente com fallback seguro.

O que entra
Um orquestrador que decide:
responder diretamente;
pedir esclarecimento;
chamar tool;
cair para fluxo determinístico.
Classificação de intenção por LLM com saída estruturada.
Fallback para a máquina de estados atual quando:
confiança baixa;
parsing falhar;
tool não aplicável;
onboarding guiado.
Estratégia
onboarding continua determinístico;
lançamentos simples podem continuar híbridos;
perguntas abertas passam pelo orquestrador.
Resultado

O agent deixa de depender só de regex e começa a entender:

“ontem gastei uns 50 no mercado”
“quanto eu tenho livre esse mês?”
“marca a conta de internet como paga”
“essa despesa foi no cartão nubank”
Fase 4 — Memória de verdade

Meta: sair de memória operacional curta para memória útil e segura.

Tipos de memória
Memória operacional
sessão atual
contexto in-flight
tool calls da conversa
Memória de usuário
preferências de categoria
contas favoritas
padrões de linguagem
recorrências
Memória de consultor
regras de acompanhamento
estilo de classificação
observações operacionais
Memória semântica resumida
fatos estáveis do usuário
metas
prioridades
alertas recorrentes
Estrutura sugerida
AgentThread
AgentMessage
AgentMemoryFact
AgentToolCall
AgentFeedback
AgentSummary
Regras
memória sempre por tenant + user;
nada de vazamento cross-tenant;
memória global só agregada e anonimizada.
Resultado

O agent começa a “lembrar” sem virar risco.

Fase 5 — Feedback e aprendizado supervisionado

Meta: fazer o agent melhorar com uso real sem aprender coisa errada sozinho.

Criar loop de correção

Toda vez que o usuário/consultor corrigir:

categoria
conta
valor
interpretação
resposta

isso vira registro em:

AgentFeedback
CorrectionType
Accepted/Rejected suggestion
O que isso alimenta
regras de ranking de categorias;
few-shots internos;
priorização de tools;
memória do usuário;
relatórios de erro.
Resultado

O agent passa a melhorar por correção validada, não por “aprendizado solto”.

Fase 6 — Segurança e governança avançadas

Meta: tornar o agent seguro em produção de verdade.

Itens
Sanitização de PII antes de mandar ao LLM externo.
Classificação de sensibilidade por dado.
Guardrails por tipo de ação:
leitura
sugestão
simulação
execução
Modo:
answer_only
suggest_only
execute_with_confirmation
Idempotência por intenção:
evitar transação duplicada
Policy engine por tool:
quem pode chamar
quando pode chamar
com qual contexto
Resultado

Menos risco operacional e muito mais previsibilidade.

Fase 7 — Observabilidade total

Meta: saber quando o agent está bom ou ruim.

Métricas mínimas
taxa de “não entendi”
taxa de tool success
taxa de tool rollback
taxa de confirmação vs cancelamento
acerto de categoria
custo por conversa
latência por etapa
fallback rate para regex/state machine
top intents
top falhas
top correções humanas
Dashboards
saúde do agent
precisão por tipo de tarefa
produtividade do consultor
erros de lançamento
custo LLM
Resultado

Você para de operar no escuro.

Fase 8 — Capacidades 10/10 para cliente

Meta: transformar o agent em copiloto financeiro.

O que ele passa a fazer
lançar receita/despesa por linguagem natural;
explicar saldo e fluxo do mês;
alertar risco de caixa;
comparar gasto com orçamento;
identificar assinaturas;
sugerir categorização;
resumir o mês;
responder “o que mais pesou esse mês?”;
sugerir ações de economia.
Importante

Primeiro leitura e sugestão.
Depois execução.
Sempre com trilha.

Fase 9 — Capacidades 10/10 para consultor

Meta: transformar o agent em operador de carteira.

O que ele faz para o consultor
resumir cada cliente;
apontar clientes em risco;
sugerir plano de ação;
identificar padrões ruins;
montar resumo pré-atendimento;
gerar follow-up;
comparar evolução;
priorizar carteira.
Resultado

O agent deixa de ser só “bot do cliente” e vira também “copiloto do consultor”.

Fase 10 — Proatividade controlada

Meta: agent agir sem esperar pergunta, mas com regras.

Exemplos
“Sua fatura subiu 18% este mês.”
“Você ainda não lançou a conta de aluguel.”
“Seu fluxo livre até o dia 30 está apertado.”
“3 gastos parecem duplicados.”
“Seu consultor recomendou revisar categoria X.”
Regras
opt-in
frequência controlada
explicabilidade
canal certo
auditoria
Resultado

Aqui ele chega perto do 10/10 mesmo.

Ordem recomendada de execução
Bloco 1 — obrigatório
Rastreabilidade
AuditLog
confirmação de LLM em prod
política LGPD
Bloco 2 — fundação do agent
tools
orquestrador
memória
feedback
Bloco 3 — excelência operacional
observabilidade
capacidades cliente
capacidades consultor
proatividade
O que reaproveitar do sistema atual

A auditoria mostra que você já tem ativos muito valiosos:

ChatSession e ChatMessage;
widget do chat;
auth/tenant sólido;
serviços de domínio;
onboarding determinístico;
categorização híbrida;
isolamento multi-tenant.

Isso significa que o agent 10/10 não exige reescrever o UTOP.
Exige trocar o cérebro e fortalecer a espinha dorsal.

O que não fazer

Não faça isso:

jogar fora o chatbot atual;
substituir onboarding por LLM puro;
deixar o agent criar transações sem auditoria;
deixar usuários influenciarem memória global bruta;
usar LLM externo sem política de PII;
ativar proatividade antes de rastreabilidade.
Scorecard de maturidade
Hoje

1,5/10
chat transacional determinístico com memória operacional curta.

Depois da Fase 1 + 2

4/10
assistente auditável com tools.

Depois da Fase 3 + 4 + 5

7/10
agent operacional com memória e feedback.

Depois da Fase 6 + 7 + 8 + 9 + 10

9 a 10/10
agent financeiro confiável, útil e governável.

Minha recomendação objetiva

Se você quiser fazer isso direito, eu começaria por este pacote imediato:

Sprint 1
source e sourceMessageId em Transaction
AuditLog para ações do chat
checar GEMINI_API_KEY em produção
decidir política LGPD/PII
Sprint 2
ToolRegistry
create_transaction, list_categories, list_accounts
confirmação estruturada
Sprint 3
intent router por LLM
fallback para state machine atual
Sprint 4
memória do usuário
feedback supervisionado