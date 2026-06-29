import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * App-side AES-256-GCM encryption for secrets at rest (the AEAT digital
 * certificate and its password). The key lives only in the environment
 * (VERIFACTU_CERT_KEY, 32 bytes base64), never in the database.
 */

function getKey(): Buffer {
  const k = process.env.VERIFACTU_CERT_KEY
  if (!k) throw new Error('VERIFACTU_CERT_KEY no configurada')
  const buf = Buffer.from(k, 'base64')
  if (buf.length !== 32) throw new Error('VERIFACTU_CERT_KEY debe ser 32 bytes en base64')
  return buf
}

export interface Sealed { cipher: string; iv: string; tag: string }

export function seal(plain: Buffer | string): Sealed {
  const key = getKey()
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const data = typeof plain === 'string' ? Buffer.from(plain, 'utf8') : plain
  const enc = Buffer.concat([c.update(data), c.final()])
  return { cipher: enc.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64') }
}

export function open(s: Sealed): Buffer {
  const key = getKey()
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(s.iv, 'base64'))
  d.setAuthTag(Buffer.from(s.tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(s.cipher, 'base64')), d.final()])
}
