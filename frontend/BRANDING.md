# 🌐 BRANDING OFICIAL — UTOP

## 1️⃣ Essência da Marca

### Nome
**UTOP**

- **Origem:** Utopia
- **Significado:** "Um lugar ideal onde as finanças fazem sentido, são organizadas e não geram ansiedade."

---

## 2️⃣ Posicionamento da Marca

> UTOP não é só um sistema financeiro.
> É um ambiente de clareza, onde o dinheiro deixa de ser caótico.

### Promessa Central
**"Organizar suas finanças pode ser simples, leve e previsível."**

### Público-Alvo
- Pessoas físicas
- Profissionais liberais
- Pequenos empreendedores
- Usuários cansados de planilhas confusas

---

## 3️⃣ Personalidade da Marca

### UTOP é:
- 🧘‍♂️ **Tranquila** (não agressiva, não alarmista)
- 🧠 **Inteligente** (organiza, não julga)
- 🧭 **Guiada** (conduz o usuário)
- 🔒 **Confiável**
- 🌱 **Progressiva** (crescimento constante)

### O que UTOP NÃO é:
- ❌ Não é bancão
- ❌ Não é robô frio
- ❌ Não é planilha feia
- ❌ Não é "fintech gritante"

---

## 4️⃣ Conceito Visual

### Ideia Central
**Equilíbrio, horizonte, futuro possível**

### Visual inspirado em:
- Horizonte
- Linhas suaves
- Círculos incompletos
- Caminhos
- Simetria leve

> **Nada agressivo. Nada pesado.**

---

## 5️⃣ Logotipo — Conceito

### Símbolo
O símbolo da UTOP deve representar:
- Um horizonte ou portal
- Um "U" abstrato
- Um caminho indo para frente
- Uma utopia financeira possível

### Formas Recomendadas
- Geométricas
- Curvas suaves
- Círculos abertos
- Linhas contínuas

### Estilo
- Minimalista
- Flat design
- Futurista leve
- Atemporal

---

## 6️⃣ Paleta de Cores — UTOP

### 🎨 Paleta Principal (Utopia + Tranquilidade)

| Função | Nome | Hex | CSS Variable |
|--------|------|-----|--------------|
| **Primária** | Azul Horizonte | `#1F4FD8` | `--utop-primary` |
| **Secundária** | Verde Futuro | `#2ECC9A` | `--utop-secondary` |
| **Destaque** | Verde Aurora | `#9AF0C6` | `--utop-accent` |

### 🌫 Paleta Neutra

| Uso | Hex | CSS Variable |
|-----|-----|--------------|
| Preto Suave | `#0F172A` | `--utop-dark` |
| Cinza Profissional | `#475569` | `--utop-gray` |
| Cinza Interface | `#CBD5E1` | `--utop-light` |
| Fundo Principal | `#F8FAFC` | `--utop-background` |

### 🚦 Alertas (financeiro padrão)

| Tipo | Hex | CSS Variable |
|------|-----|--------------|
| Sucesso | `#22C55E` | `--utop-success` |
| Aviso | `#FACC15` | `--utop-warning` |
| Erro | `#EF4444` | `--utop-error` |

### Sensação Geral
> **Calmo, tecnológico, confiável, moderno**

---

## 7️⃣ Tipografia

### Principal (UI e títulos)
**Inter**
- Extremamente legível
- Moderna
- Perfeita para dashboards

### Alternativa Premium
- **Poppins** (títulos)
- **Satoshi** (branding)
- **SF Pro** (Apple-like)

### Classes CSS
```css
.font-inter { font-family: 'Inter', sans-serif; }
.font-poppins { font-family: 'Poppins', sans-serif; }
.font-satoshi { font-family: 'Satoshi', sans-serif; }
```

---

## 8️⃣ Voz da Marca (Brand Voice)

### Como o UTOP fala
- ✅ Direto
- ✅ Humano
- ✅ Sem julgamento
- ✅ Sem termos financeiros complexos

### Exemplos
- *"Vamos organizar isso juntos."*
- *"Seu dinheiro, no seu ritmo."*
- *"Tudo sob controle. Sem pressão."*

---

## 9️⃣ Aplicações do Branding

### Interface
- Fundo claro (`#F8FAFC`)
- Cards brancos
- Destaques em azul horizonte
- Crescimento em verde

### Chatbot UTOP
O chatbot deve parecer um guia, não um robô:
> *"Posso te ajudar a montar seu mês financeiro agora."*

---

## 🔟 Tailwind CSS Classes

### Cores UTOP no Tailwind
```javascript
// tailwind.config.js
colors: {
  utop: {
    primary: '#1F4FD8',    // Azul Horizonte
    secondary: '#2ECC9A',  // Verde Futuro
    accent: '#9AF0C6',     // Verde Aurora
  },
  neutral: {
    dark: '#0F172A',
    gray: '#475569',
    light: '#CBD5E1',
    background: '#F8FAFC',
  },
  alert: {
    success: '#22C55E',
    warning: '#FACC15',
    error: '#EF4444',
  },
}
```

### Uso no Código
```tsx
// Botão primário
<button className="bg-[#1F4FD8] hover:bg-[#1A44BF] text-white">

// Botão gradiente UTOP
<button className="bg-gradient-to-r from-[#1F4FD8] to-[#2ECC9A]">

// Card
<div className="bg-white rounded-2xl shadow-sm border border-[#CBD5E1]/30">

// Texto
<p className="text-[#0F172A]">  // Escuro
<p className="text-[#475569]">  // Cinza
```

---

## 1️⃣1️⃣ Naming Interno

| Contexto | Nome |
|----------|------|
| Nome público | **UTOP** |
| Chatbot | **Utop Assistant** |
| Onboarding | "Bem-vindo ao UTOP" |
| Slogan | *"Seu dinheiro em equilíbrio."* |
| localStorage key | `utop-auth` |

---

## 1️⃣2️⃣ Prompts para IA

### Prompt para Criar Logo
```
Create a modern minimalist logo for a personal finance SaaS called "UTOP".
The brand concept is based on "utopia", clarity, balance, and financial peace.

Design a clean, geometric symbol inspired by:
- an abstract "U"
- a horizon or pathway
- a sense of future and equilibrium

Use smooth curves, open shapes, and soft geometry.
Flat design, timeless, elegant, and professional.
Avoid aggressive fintech aesthetics.

Color palette:
Primary blue (#1F4FD8)
Secondary green (#2ECC9A)
Light backgrounds

The logo must work well as:
- full logo (icon + UTOP)
- icon only
- monochrome
- app favicon

Style: futuristic but calm, premium, accessible, scalable.
```

### Prompt para Telas
```
Design a clean and calm personal finance dashboard for a SaaS called UTOP.
Use a light background (#F8FAFC), white cards, soft shadows, and rounded corners.
Primary actions in blue, positive values in green.

The interface should feel peaceful, intuitive, and organized,
reducing financial anxiety and promoting clarity.
```

---

## 📁 Estrutura de Arquivos Atualizados

```
frontend/
├── src/
│   ├── app/
│   │   ├── globals.css      # CSS com variáveis UTOP
│   │   ├── page.tsx         # Landing/Login UTOP
│   │   └── layout.tsx       # Metadata UTOP
│   ├── components/
│   │   ├── Logo.tsx         # Logo UTOP
│   │   ├── Sidebar.tsx      # Sidebar com cores UTOP
│   │   └── ChatbotWidget.tsx # Utop Assistant
│   └── stores/
│       └── auth.ts          # localStorage: utop-auth
├── tailwind.config.js       # Paleta UTOP
└── BRANDING.md              # Este arquivo
```

---

**© 2025 UTOP — Seu dinheiro em equilíbrio**
