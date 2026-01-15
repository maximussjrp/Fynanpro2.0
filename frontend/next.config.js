/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Otimização para Docker - gera build standalone
  output: 'standalone',
  
  images: {
    unoptimized: true,
  },
  
  // Variáveis de ambiente públicas
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  },
}

module.exports = nextConfig
