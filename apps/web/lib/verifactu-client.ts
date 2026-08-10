import { request as httpsRequest } from 'https'
import { open as unseal } from '@/lib/crypto-vault'
import { parseSubmissionResponse, type RespuestaSuministro } from '@/lib/verifactu-xml'

/**
 * Transport for the AEAT Veri*Factu web service.
 *
 * The AEAT authenticates the caller with the taxpayer's own digital
 * certificate over mutual TLS — there is no API key. That rules out the global
 * fetch: it offers no way to attach a client certificate. node:https does, and
 * it is in the standard library, so this stays dependency-free.
 *
 * Runs on the Node runtime only. On Edge there is no TLS socket to present a
 * certificate on, so every route that reaches this must declare nodejs.
 */

/**
 * Which kind of certificate the organization uploaded.
 *
 * It decides where the submission goes: the AEAT serves seal certificates from
 * a different host than certificates held by a representative. Posting to the
 * wrong one fails the submission outright.
 */
export type CertKind = 'representante' | 'sello'

// Overridable because these are AEAT-side URLs: they have moved before, and a
// deployment must be able to follow without a code change.
//
// The test URLs are the ones the AEAT gave us directly (August 2026). The
// production URL for representative certificates follows their published
// naming. There is no default for production with a seal certificate: we have
// not been told that URL, and inventing one by analogy would send real records
// to a host nobody confirmed. Configure VERIFACTU_ENDPOINT_PROD_SELLO from the
// WSDL before going live with a seal certificate.
const ENDPOINTS: Record<'prod' | 'test', Record<CertKind, string | undefined>> = {
  prod: {
    representante: process.env.VERIFACTU_ENDPOINT_PROD
      ?? 'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
    sello: process.env.VERIFACTU_ENDPOINT_PROD_SELLO,
  },
  test: {
    representante: process.env.VERIFACTU_ENDPOINT_TEST
      ?? 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
    sello: process.env.VERIFACTU_ENDPOINT_TEST_SELLO
      ?? 'https://prewww10.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
  },
}

/**
 * The endpoint for this environment and certificate kind.
 *
 * Throws when it is not known, rather than falling back to the representative
 * URL: a seal certificate presented to the representative endpoint is a
 * failure we would rather surface at configuration time than at submission.
 */
export function verifactuEndpoint(kind: CertKind = 'representante'): string {
  const env = (process.env.VERIFACTU_ENV ?? 'test').toLowerCase() === 'prod' ? 'prod' : 'test'
  const url = ENDPOINTS[env][kind]
  if (!url) {
    throw new Error(
      `No hay endpoint configurado para un certificado de ${kind} en ${env}. ` +
      'Defina VERIFACTU_ENDPOINT_PROD_SELLO con la URL del WSDL de la AEAT.',
    )
  }
  return url
}

/** The encrypted certificate as stored in org_certificates. */
export interface StoredCertificate {
  cert_cipher: string; cert_iv: string; cert_tag: string
  pass_cipher: string; pass_iv: string; pass_tag: string
  /** Absent on rows stored before the column existed; those are representative. */
  cert_kind?: CertKind | null
}

export interface SubmissionResult {
  ok: boolean
  httpStatus: number
  response: RespuestaSuministro | null
  /** Raw body, kept for the audit trail when something is wrong. */
  raw: string
  error: string | null
}

const TIMEOUT_MS = 60_000

/**
 * POST a submission envelope to the AEAT with the organization's certificate.
 *
 * Never throws for a rejection: a refused submission is an outcome to record
 * against the invoice, not an exception to lose. Only a programming error
 * escapes.
 */
export async function submitToAeat(
  xml: string,
  cert: StoredCertificate,
): Promise<SubmissionResult> {
  let pfx: Buffer
  let passphrase: string
  try {
    pfx = unseal({ cipher: cert.cert_cipher, iv: cert.cert_iv, tag: cert.cert_tag })
    passphrase = unseal({ cipher: cert.pass_cipher, iv: cert.pass_iv, tag: cert.pass_tag }).toString('utf8')
  } catch (err) {
    return { ok: false, httpStatus: 0, response: null, raw: '', error: `No se pudo descifrar el certificado: ${err}` }
  }

  let url: URL
  try {
    url = new URL(verifactuEndpoint(cert.cert_kind ?? 'representante'))
  } catch (err) {
    return { ok: false, httpStatus: 0, response: null, raw: '', error: String(err) }
  }
  const body = Buffer.from(xml, 'utf8')

  return new Promise<SubmissionResult>(resolve => {
    const req = httpsRequest(
      {
        host: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        pfx,
        passphrase,
        // The AEAT chain must validate; never relax this. A submission that
        // silently accepted any certificate would be talking to anyone.
        rejectUnauthorized: true,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': body.length,
          SOAPAction: '""',
        },
        timeout: TIMEOUT_MS,
      },
      res => {
        const chunks: Buffer[] = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          const status = res.statusCode ?? 0
          let parsed: RespuestaSuministro | null = null
          try {
            parsed = parseSubmissionResponse(raw)
          } catch (err) {
            return resolve({ ok: false, httpStatus: status, response: null, raw, error: `Respuesta ilegible: ${err}` })
          }
          resolve({
            ok: status >= 200 && status < 300 && !parsed.fault,
            httpStatus: status,
            response: parsed,
            raw,
            error: parsed.fault ? `SOAP Fault: ${parsed.fault}` : null,
          })
        })
      },
    )

    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, httpStatus: 0, response: null, raw: '', error: `Sin respuesta de la AEAT en ${TIMEOUT_MS / 1000}s` })
    })
    req.on('error', err => {
      resolve({ ok: false, httpStatus: 0, response: null, raw: '', error: String(err) })
    })

    req.write(body)
    req.end()
  })
}
