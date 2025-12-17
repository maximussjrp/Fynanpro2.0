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
      { url: '/images/logo/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/images/logo/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/images/logo/favicon-64.png', sizes: '64x64', type: 'image/png' },
    ],
    apple: '/images/logo/favicon-128.png',
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
