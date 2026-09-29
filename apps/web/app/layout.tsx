import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { OrganizationProvider } from '@/lib/context/organization-context'
import './globals.css'
import { Toaster } from "@/components/ui/sonner"

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Archivum — Invoice Archive',
  description: 'Digital invoice and document management platform.',
  // Google shows the site's favicon next to the search result. It asks for
  // /favicon.ico first and wants a square multiple of 48px; there was no
  // favicon.ico, and public/ still held the template's placeholder icons,
  // so the result did not show the Archivum mark (WEB-031).
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48 64x64' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: { url: '/apple-icon.png', sizes: '180x180' },
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
        {/* One place for success/failure confirmations (WEB-010): a toast
            floats over the page, so it never pushes the form under the
            cursor the way the inline banners did (WEB-005). */}
        <Toaster richColors position="top-center" closeButton />
        <Analytics />
      </body>
    </html>
  )
}
