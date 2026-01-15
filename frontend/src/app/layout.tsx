import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/components/AuthProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'UTOP - Seu dinheiro em equilíbrio',
  description: 'Organizar suas finanças pode ser simples, leve e previsível. UTOP é um ambiente de clareza onde o dinheiro deixa de ser caótico.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>
        <ErrorBoundary>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ErrorBoundary>
        <Toaster 
          position="top-right" 
          richColors 
          expand={false}
          duration={4000}
        />
      </body>
    </html>
  )
}
