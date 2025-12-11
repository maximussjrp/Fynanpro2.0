# 🎨 Guia de Uso do Branding FynanPro

## 📁 Estrutura de Arquivos

```
frontend/public/images/logo/fynanpro_branding/
├── logo-horizontal-light.png    → Logo completa para fundos claros
├── logo-horizontal-dark.png     → Logo completa para fundos escuros
├── logo-icon-gradient.png       → Ícone com gradiente oficial
├── logo-icon-dark.png           → Ícone versão dark
├── icon-small-1.png             → Ícone pequeno (menu lateral)
├── icon-small-2.png             → Ícone pequeno alternativo
└── icon-small-3.png             → Ícone pequeno alternativo 2
```

---

## 🧩 Componente Logo

### Importação
```tsx
import Logo from '@/components/Logo';
```

### Variantes Disponíveis

#### 1. Logo Horizontal (Padrão)
```tsx
<Logo variant="horizontal-light" />
```
**Uso:** Headers, página de login, topo do dashboard  
**Tamanho padrão:** 180x40px

#### 2. Logo Horizontal Dark
```tsx
<Logo variant="horizontal-dark" />
```
**Uso:** Headers em dark mode  
**Tamanho padrão:** 180x40px

#### 3. Ícone com Gradiente
```tsx
<Logo variant="icon-gradient" />
```
**Uso:** Favicon, splash screen, ícone standalone  
**Tamanho padrão:** 48x48px

#### 4. Ícone Dark
```tsx
<Logo variant="icon-dark" />
```
**Uso:** Dark mode, ícones em fundos claros  
**Tamanho padrão:** 48x48px

#### 5. Ícone Pequeno
```tsx
<Logo variant="icon-small" />
```
**Uso:** Menu lateral, notificações, breadcrumbs  
**Tamanho padrão:** 32x32px

---

## 📐 Personalizando Tamanho

### Com props width/height
```tsx
<Logo 
  variant="horizontal-light" 
  width={240} 
  height={60} 
/>
```

### Com className (Tailwind)
```tsx
<Logo 
  variant="icon-gradient" 
  className="w-16 h-16 rounded-full shadow-lg" 
/>
```

---

## 💡 Exemplos de Uso

### Header do Dashboard
```tsx
<header className="bg-white shadow-sm border-b">
  <div className="flex items-center justify-between p-4">
    <Logo variant="horizontal-light" className="h-10 w-auto" />
    <nav>...</nav>
  </div>
</header>
```

### Menu Lateral
```tsx
<aside className="w-64 bg-gray-900">
  <div className="p-4 flex items-center gap-3">
    <Logo variant="icon-small" className="w-8 h-8" />
    <span className="text-white font-semibold">FynanPro</span>
  </div>
</aside>
```

### Página de Login
```tsx
<div className="text-center mb-8">
  <Logo 
    variant="horizontal-light" 
    className="mx-auto mb-4" 
  />
  <h2>Bem-vindo de volta!</h2>
</div>
```

### Loading Spinner com Logo
```tsx
<div className="flex flex-col items-center justify-center min-h-screen">
  <Logo 
    variant="icon-gradient" 
    className="w-20 h-20 animate-pulse" 
  />
  <p className="mt-4 text-gray-600">Carregando...</p>
</div>
```

---

## 🎨 Paleta de Cores Oficial

```css
/* Gradiente Principal (FP) */
--gradient-primary: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);

/* Cores Secundárias */
--green-success: #10B981;   /* Receitas */
--red-danger: #EF4444;      /* Despesas */
--blue-neutral: #3B82F6;    /* Informação */
--purple-premium: #8B5CF6;  /* Premium */
```

---

## 📱 Responsividade

### Mobile
```tsx
<Logo 
  variant="icon-small" 
  className="sm:hidden w-8 h-8" 
/>
<Logo 
  variant="horizontal-light" 
  className="hidden sm:block h-10 w-auto" 
/>
```

### Tablet/Desktop
```tsx
<Logo 
  variant="horizontal-light" 
  className="h-8 md:h-10 lg:h-12 w-auto" 
/>
```

---

## ✅ Checklist de Implementação

- [x] Logo aplicada no header do dashboard
- [x] Logo aplicada na página de login
- [x] Favicon configurado
- [x] Componente `Logo` criado
- [ ] Logo no menu lateral (quando criar sidebar)
- [ ] Logo em dark mode (quando implementar)
- [ ] Logo em e-mails transacionais
- [ ] Logo em relatórios PDF

---

## 🚀 Próximos Passos

1. **Sidebar com Logo:** Criar menu lateral com `icon-small`
2. **Dark Mode:** Trocar automaticamente para `horizontal-dark` e `icon-dark`
3. **PWA:** Usar `logo-icon-gradient.png` como ícone do app
4. **E-mails:** Incluir logo nos templates de notificação

---

**Última atualização:** 05/12/2025  
**Versão do Branding:** 1.0
