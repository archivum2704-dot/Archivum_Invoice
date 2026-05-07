import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { OrganizationProvider } from '@/lib/context/organization-context'
import './globals.css'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Archivum — Invoice Archive',
  description: 'Digital invoice and document management platform.',
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className={`${plusJakarta.variable} font-sans antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <OrganizationProvider>
            {children}
          </OrganizationProvider>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  )
}
