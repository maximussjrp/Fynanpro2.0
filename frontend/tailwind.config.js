/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // UTOP - Paleta Principal (Utopia + Tranquilidade)
        utop: {
          primary: '#1F4FD8',      // Azul Horizonte
          secondary: '#2ECC9A',    // Verde Futuro
          accent: '#9AF0C6',       // Verde Aurora
        },
        // Paleta Neutra
        neutral: {
          dark: '#0F172A',         // Preto Suave
          gray: '#475569',         // Cinza Profissional
          light: '#CBD5E1',        // Cinza Interface
          background: '#F8FAFC',   // Fundo Principal
        },
        // Alertas (financeiro padrão)
        alert: {
          success: '#22C55E',
          warning: '#FACC15',
          error: '#EF4444',
        },
        // Compatibilidade com código existente
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#1F4FD8',          // Azul Horizonte UTOP
          600: '#1A44BF',
          700: '#1539A6',
          800: '#102E8D',
          900: '#0B2374',
        },
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
        satoshi: ['Satoshi', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
