# 🤖 Isis IA - Script de Onboarding

## Teste de Fluxo de Implantação

**Data do Teste:** 14/12/2025
**Objetivo:** Validar o fluxo completo de perguntas e respostas para implantação do sistema
**Nome do Chatbot:** Isis

---

## 📝 Registro do Teste

### ETAPA 1: Boas-vindas e Perfil

**🤖 Isis:** Olá! Eu sou a Isis, sua assistente financeira! Vou te ajudar a configurar seu controle financeiro. Vamos começar?

**👤 Usuário:** Começar Implantação ✅

**🤖 Isis:** Ótimo! Vamos lá! 🚀 Primeiro, como posso te chamar?

**👤 Usuário:** Max Victor

**🤖 Isis:** Prazer, Max Victor! 😊 Você quer organizar as finanças de qual tipo?
- 👤 Pessoal (só minhas)
- 👨‍👩‍👧‍👦 Familiar (junta com cônjuge/família)

**👤 Usuário:** Familiar

---

### ETAPA 1.5: Ano do Planejamento

**🤖 Isis:** 📅 Uma pergunta importante!

Estamos em **Dezembro/2025**. Para qual ano você quer fazer o planejamento financeiro?

💡 *As receitas e despesas recorrentes serão criadas para o período de Janeiro a Dezembro do ano escolhido.*

- 📆 2025 (este ano - restante dos meses)
- 📆 2026 (ano que vem - Janeiro a Dezembro completo)

**👤 Usuário:** 2026

**🤖 Isis:** ✅ Perfeito! Vou criar o planejamento para **2026** (Janeiro a Dezembro).

---

### ETAPA 2: Contas Bancárias

**🤖 Isis:** Agora vou cadastrar suas contas bancárias! 🏦

⚠️ **Algumas orientações importantes:**

- Você poderá cadastrar **quantas contas precisar** - ao final de cada uma, vou perguntar se deseja adicionar outra
- É **essencial informar se a conta é Pessoa Física (CPF) ou Pessoa Jurídica (CNPJ)** - isso ajuda a organizar melhor suas finanças

Vamos começar? Qual banco você usa como principal?

**👤 Usuário:** Nubank

**🤖 Isis:** 🟣 Nubank! Essa conta é Pessoa Física ou Pessoa Jurídica?

💡 *Se você usa essa conta para receber pagamentos do seu negócio, cadastre aqui para acompanhar o dinheiro que entra!*

- 👤 Pessoa Física (CPF)
- 🏢 Pessoa Jurídica (CNPJ)

**👤 Usuário:** Pessoa Física

**🤖 Isis:** Qual o tipo dessa conta PF?
- 🏦 Corrente
- 💰 Poupança
- 💵 Carteira Digital
- 📈 Investimento

**👤 Usuário:** Corrente

**🤖 Isis:** 🏦 Conta Corrente PF no Nubank! Qual o saldo atual dessa conta?

**👤 Usuário:** R$ 15.000,00

**🤖 Isis:** ✅ Conta cadastrada!
| Banco | Tipo | Natureza | Saldo |
|-------|------|----------|-------|
| 🟣 Nubank | Corrente | Pessoa Física | R$ 15.000,00 |

**🤖 Isis:** Você tem mais alguma conta bancária?

**👤 Usuário:** Sim, tenho outra

**🤖 Isis:** Qual banco é essa outra conta?

**👤 Usuário:** Nubank

**🤖 Isis:** 🟣 Nubank novamente! Essa conta é Pessoa Física ou Pessoa Jurídica?

💡 *Se você usa essa conta para receber pagamentos do seu negócio, cadastre aqui para acompanhar o dinheiro que entra!*

- 👤 Pessoa Física (CPF)
- 🏢 Pessoa Jurídica (CNPJ)

**👤 Usuário:** Pessoa Jurídica

**🤖 Isis:** 🏢 Conta PJ no Nubank! Qual o tipo dessa conta?

**👤 Usuário:** Corrente

**🤖 Isis:** 🏦 Conta Corrente PJ no Nubank! Qual o saldo atual dessa conta?

**👤 Usuário:** R$ 2.500,00

**🤖 Isis:** ✅ Conta cadastrada! Veja suas contas até agora:

| Banco | Tipo | Natureza | Saldo |
|-------|------|----------|-------|
| 🟣 Nubank | Corrente | Pessoa Física | R$ 15.000,00 |
| 🟣 Nubank | Corrente | Pessoa Jurídica | R$ 2.500,00 |

**💰 Saldo Total: R$ 17.500,00**

**🤖 Isis:** Você tem mais alguma conta bancária?

**👤 Usuário:** Não, só essas

---

### ETAPA 3: Rendas (Dinheiro que Entra)

**🤖 Isis:** 💰 Agora vamos cadastrar suas RENDAS!

Rendas são todo dinheiro que entra regularmente: salários, freelances, aluguéis, pensões, etc.

Você trabalha como:
- 💼 CLT (Carteira assinada)
- 🏢 Autônomo / MEI / PJ
- 👔 Funcionário Público
- 🏠 Aposentado / Pensionista
- 📚 Estudante / Sem renda fixa
- 🔀 Misto (CLT + Renda Extra)

**👤 Usuário:** Autônomo

**🤖 Isis:** 🏢 Autônomo! Legal! Como autônomo, sua renda costuma ser:
- 📅 Fixa (recebo um valor parecido todo mês)
- 📊 Variável (muda bastante de mês pra mês)

**👤 Usuário:** Variável

**🤖 Isis:** 📊 Renda variável! Entendi.

Como autônomo com renda variável, você provavelmente recebe por serviço/projeto, certo?

Nesse caso, você pode:
- 📝 **Lançar manualmente** cada recebimento quando acontecer (recomendado!)
- 📅 **Cadastrar uma média** mensal como estimativa

💡 *Se você recebe valores diferentes em datas diferentes, recomendo lançar manualmente. Assim seu controle fica mais preciso!*

O que prefere?
- 📝 Vou lançar manualmente (pular essa etapa)
- 📅 Quero cadastrar uma média mensal

**👤 Usuário:** Vou lançar manualmente

**🤖 Isis:** ✅ Perfeito! Você vai lançar suas receitas de autônomo conforme receber.

**🤖 Isis:** Você tem mais alguma fonte de renda na família? (cônjuge trabalha, aluguel, pensão, etc.)

**👤 Usuário:** Não

**🤖 Isis:** ✅ Ok! Suas receitas serão lançadas manualmente conforme receber.

---

### ETAPA 4: Despesas Fixas (Contas que pagam todo mês)

**🤖 Isis:** 🏠 Agora vamos cadastrar suas DESPESAS FIXAS!

São aquelas contas que você paga todo mês: aluguel, luz, água, internet, etc.

Marque todas as despesas fixas que você tem:

**👤 Usuário:** Selecionou:
- ☑️ IPTU
- ☑️ Energia Elétrica
- ☑️ Água / Esgoto
- ☑️ Internet
- ☑️ Celular
- ☑️ Financiamento Veículo
- ☑️ Seguro do Carro
- ☑️ Outros (iCloud, apps, etc)

**🤖 Isis:** ✅ 8 despesas selecionadas! Agora vou pedir os detalhes de cada uma.

**📄 IPTU** (1 de 8)

O IPTU é pago de qual forma?
- 💰 À vista (1x no ano)
- 📅 Parcelado

**👤 Usuário:** Parcelado

**🤖 Isis:** Em quantas parcelas?

**👤 Usuário:** 12 parcelas

**🤖 Isis:** Qual o valor de cada parcela?

**👤 Usuário:** R$ 20,00

**🤖 Isis:** Qual o dia de vencimento?

**👤 Usuário:** Dia 20

**🤖 Isis:** De qual conta sai o pagamento do IPTU?
- 🟣 Nubank PF - Corrente
- 🟣 Nubank PJ - Corrente

**👤 Usuário:** Nubank PF

**🤖 Isis:** ✅ IPTU cadastrado!

| Despesa | Valor | Parcelas | Vencimento | Conta |
|---------|-------|----------|------------|-------|
| IPTU | R$ 20,00 | 12x | Dia 20 | Nubank PF |

**🤖 Isis:** ⚡ ENERGIA ELÉTRICA (2 de 8)

Qual o valor MÉDIO da sua conta de energia?

**👤 Usuário:** R$ 160,00

**🤖 Isis:** Qual o dia de vencimento?

**👤 Usuário:** Dia 15

**🤖 Isis:** De qual conta sai o pagamento?

**👤 Usuário:** Nubank PF

**🤖 Isis:** ✅ Energia cadastrada!

---

**🤖 Isis:** 💧 ÁGUA / ESGOTO (3 de 8)

Qual o valor MÉDIO da sua conta de água?

**👤 Usuário:** R$ 135,00

**🤖 Isis:** Qual o dia de vencimento?

**👤 Usuário:** Dia 20

**🤖 Isis:** ✅ Água cadastrada! (Conta: Nubank PF)

---

**🤖 Isis:** 🌐 INTERNET (4 de 8) - Valor e dia de vencimento?

**👤 Usuário:** R$ 99,90, dia 10

**🤖 Isis:** ✅ Internet cadastrada!

---

**🤖 Isis:** 📱 CELULAR (5 de 8) - Valor e dia de vencimento?

**👤 Usuário:** São duas: R$ 35 Max (dia 16) e R$ 35 Dandara (dia 18)

**🤖 Isis:** ✅ 2 linhas de celular cadastradas!
- 📱 Celular Max: R$ 35,00 - Dia 16
- 📱 Celular Dandara: R$ 35,00 - Dia 18

---

**🤖 Isis:** 🚗 FINANCIAMENTO VEÍCULO (6 de 8)

Qual o valor da parcela e dia de vencimento?

💡 *Quantas parcelas ainda faltam?*

**👤 Usuário:** R$ 1.832,42, dia 13, faltam 57 parcelas

**🤖 Isis:** ✅ Financiamento cadastrado!
- 🚗 Financiamento Veículo: R$ 1.832,42 - Dia 13
- Parcelas restantes: 57 (até Setembro/2030)

---

**🤖 Isis:** 🛡️ SEGURO DO CARRO (7 de 8)

O seguro é pago de qual forma?
- 💰 À vista (1x no ano)
- 📅 Parcelado

**👤 Usuário:** Parcelado, R$ 200,00 no cartão final 5826

**🤖 Isis:** Quantas parcelas ainda faltam?

**👤 Usuário:** 6 parcelas

**🤖 Isis:** ✅ Seguro cadastrado!
- 🛡️ Seguro Carro: R$ 200,00 - Cartão 5826 (6 parcelas restantes)

💡 *Vou criar o meio de pagamento "Cartão 5826" automaticamente!*

---

**🤖 Isis:** 📱 OUTROS - iCloud, apps, etc (8 de 8)

Quais assinaturas você tem? Informe o nome, valor e dia de vencimento.

💡 *Pode informar todas de uma vez, ex: iCloud 3,50 dia 15, Spotify 21,90 dia 5*

**👤 Usuário:** YouTube Premium R$ 49,90 mensal, dia 20, cartão 2277

**🤖 Isis:** ✅ Assinatura cadastrada!
- 📺 YouTube Premium: R$ 49,90 - Dia 20 - Cartão 2277

💡 *Meio de pagamento "Cartão 2277" criado!*

Tem mais alguma assinatura?

**👤 Usuário:** Não

---

### ✅ RESUMO DAS DESPESAS FIXAS CADASTRADAS

**🤖 Isis:** 🎉 Todas as despesas fixas foram cadastradas!

| # | Despesa | Valor | Vencimento | Conta/Cartão |
|---|---------|-------|------------|--------------|
| 1 | IPTU | R$ 20,00 (12x) | Dia 20 | Nubank PF |
| 2 | Energia Elétrica | R$ 160,00 | Dia 15 | Nubank PF |
| 3 | Água/Esgoto | R$ 135,00 | Dia 20 | Nubank PF |
| 4 | Internet | R$ 99,90 | Dia 10 | Nubank PF |
| 5 | Celular Max | R$ 35,00 | Dia 16 | Nubank PF |
| 6 | Celular Dandara | R$ 35,00 | Dia 18 | Nubank PF |
| 7 | Financiamento Veículo | R$ 1.832,42 (57x) | Dia 13 | Nubank PF |
| 8 | Seguro Carro | R$ 200,00 (6x) | Fatura | Cartão 5826 |
| 9 | YouTube Premium | R$ 49,90 | Dia 20 | Cartão 2277 |

**💰 Total Mensal Estimado: R$ 2.567,22**

**💳 Meios de Pagamento Criados:**
- Cartão 5826
- Cartão 2277

---

### ETAPA 5: Finalização

