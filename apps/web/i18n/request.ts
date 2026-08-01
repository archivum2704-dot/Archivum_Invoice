import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export type Locale = 'en' | 'es'
export const locales: Locale[] = ['es', 'en']
// Spanish is the product's primary language (Verifactu, Spanish tax law), so it
// is what we serve until the visitor picks otherwise. Serving English by
// default made Spanish-speaking browsers offer to machine-translate the page,
// which mangles the fiscal terminology.
export const defaultLocale: Locale = 'es'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const raw = cookieStore.get('locale')?.value
  const locale: Locale = locales.includes(raw as Locale) ? (raw as Locale) : defaultLocale

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
