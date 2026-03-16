import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { OrganizationProvider } from '@/lib/context/organization-context'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'DocVault — Archivo Digital de Facturación',
  description: 'Gestión y archivo digital de documentos de facturación empresarial en España.',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased`}>
        <OrganizationProvider>
          {children}
        </OrganizationProvider>
        <Analytics />
      </body>
    </html>
  )
}
