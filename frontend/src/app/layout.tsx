import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/components/AuthProvider'
import './globals.css'

export const viewport: Viewport = {
  themeColor: '#0B1020',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: 'UTOP - Seu dinheiro em equilíbrio',
  description: 'Organizar suas finanças pode ser simples, leve e previsível. UTOP é um ambiente de clareza onde o dinheiro deixa de ser caótico.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/branding/favicons/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/branding/favicons/favicon-16.png', type: 'image/png', sizes: '16x16' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
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
