import { createHash } from 'crypto'

/**
 * Verifactu (AEAT) record helpers.
 *
 * Generates the "registro de alta" data, the SHA-256 huella (fingerprint)
 * chained to the previous record, and the QR "cotejo" URL — all per the AEAT
 * technical specification. Real-time submission to AEAT (SOAP web service with
 * a digital certificate) is a separate, later phase; these helpers produce the
 * compliant, immutable record that such submission would carry.
 */

// 'test' uses the AEAT pre-production cotejo host; 'prod' the production host.
const VERIFACTU_ENV = (process.env.VERIFACTU_ENV ?? 'test').toLowerCase()
const QR_BASE = VERIFACTU_ENV === 'prod'
  ? 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR'
  : 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR'

export type InvoiceKind = 'ordinary' | 'simplified' | 'rectifying'

/**
 * Who produces this software, as the AEAT wants it declared.
 *
 * The producer's own name and NIF are not ours to guess — they identify the
 * legal entity that signs the declaración responsable — so they come from the
 * environment. Missing values are reported rather than filled in with
 * something plausible: a registro carrying an invented producer is worse than
 * one that is visibly incomplete.
 */
export function sistemaInformatico(numeroInstalacion: string) {
  return {
    NombreRazon: process.env.VERIFACTU_PRODUCER_NAME ?? '',
    NIF: process.env.VERIFACTU_PRODUCER_NIF ?? '',
    NombreSistemaInformatico: process.env.VERIFACTU_SYSTEM_NAME ?? 'Archivum',
    IdSistemaInformatico: process.env.VERIFACTU_SYSTEM_ID ?? 'AR',
    Version: process.env.VERIFACTU_SYSTEM_VERSION ?? '1.0',
    // One installation per organization: each is a separate taxpayer.
    NumeroInstalacion: numeroInstalacion,
    // The software only ever operates in Veri*Factu mode — it has no
    // non-remitting variant — and it is a multi-tenant service serving many
    // taxpayers at once.
    TipoUsoPosibleSoloVerifactu: 'S',
    TipoUsoPosibleMultiOT: 'S',
    IndicadorMultiplesOT: 'S',
  }
}

/** Producer identity that has to be configured before a registro is complete. */
export function missingProducerConfig(): string[] {
  const missing: string[] = []
  if (!process.env.VERIFACTU_PRODUCER_NAME?.trim()) missing.push('VERIFACTU_PRODUCER_NAME')
  if (!process.env.VERIFACTU_PRODUCER_NIF?.trim()) missing.push('VERIFACTU_PRODUCER_NIF')
  return missing
}

/** AEAT TipoFactura code for our invoice kinds. */
export function tipoFactura(kind: InvoiceKind): string {
  switch (kind) {
    case 'simplified': return 'F2'
    case 'rectifying': return 'R1'
    default:           return 'F1'
  }
}

/** Two-decimal string with '.' separator, as AEAT expects in the huella/QR. */
export function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

/** DD-MM-YYYY from a YYYY-MM-DD date string. */
export function fechaExpedicion(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}-${m}-${y}`
}

export interface RegistroAltaInput {
  issuerNif: string
  fullNumber: string        // NumSerieFactura
  issueDate: string         // YYYY-MM-DD
  kind: InvoiceKind
  cuotaTotal: number        // total VAT
  importeTotal: number      // grand total
  previousHuella: string    // '' for the first record in the chain
  generatedAt: string       // FechaHoraHusoGenRegistro, ISO-8601 with offset
}

/**
 * SHA-256 huella over the ordered, '&'-concatenated mandatory fields plus the
 * previous record's huella — exactly the AEAT registro-de-alta field order.
 * Returns 64-char uppercase hex.
 */
export function computeHuella(i: RegistroAltaInput): string {
  const chain =
    `IDEmisorFactura=${i.issuerNif}` +
    `&NumSerieFactura=${i.fullNumber}` +
    `&FechaExpedicionFactura=${fechaExpedicion(i.issueDate)}` +
    `&TipoFactura=${tipoFactura(i.kind)}` +
    `&CuotaTotal=${money(i.cuotaTotal)}` +
    `&ImporteTotal=${money(i.importeTotal)}` +
    `&Huella=${i.previousHuella}` +
    `&FechaHoraHusoGenRegistro=${i.generatedAt}`
  return createHash('sha256').update(chain, 'utf8').digest('hex').toUpperCase()
}

/** AEAT cotejo URL embedded in the invoice QR code. */
export function buildQrUrl(issuerNif: string, fullNumber: string, issueDate: string, importeTotal: number): string {
  const params = new URLSearchParams({
    nif: issuerNif,
    numserie: fullNumber,
    fecha: fechaExpedicion(issueDate),
    importe: money(importeTotal),
  })
  return `${QR_BASE}?${params.toString()}`
}

/**
 * How the recipient of an invoice is identified.
 *
 * A Spanish client goes in as a NIF. Anyone else has no NIF to give, so the
 * AEAT takes a country, a type of document and the number — sending a foreign
 * identifier in the NIF field would be a false declaration, not a shortcut.
 */
export interface RegistroDestinatario {
  name: string | null
  /** NIF for a Spanish client; the foreign identifier otherwise. */
  id: string | null
  /** ISO-3166-1 alpha-2. 'ES' (or unset) means the NIF path. */
  countryCode?: string | null
  /** AEAT L7 code. Unset means the NIF path. */
  idType?: string | null
}

/** The Destinatario block, in whichever of its two shapes applies. */
export function buildDestinatario(d: RegistroDestinatario) {
  if (!d.id) return null
  const foreign = !!d.idType && (d.countryCode ?? 'ES').toUpperCase() !== 'ES'
  return foreign
    ? {
        NombreRazon: d.name ?? '',
        IDOtro: {
          CodigoPais: (d.countryCode ?? '').toUpperCase(),
          IDType: d.idType,
          ID: d.id,
        },
      }
    : { NombreRazon: d.name ?? '', NIF: d.id }
}

/** One invoice line, reduced to what the desglose needs. */
export interface RegistroLine {
  description: string
  /** VAT rate as a number; 0 means exempt. */
  taxRate: number
  /** Taxable base after any discount. */
  base: number
  /** VAT charged on that base. */
  cuota: number
}

/**
 * Desglose: the invoice broken down by VAT rate.
 *
 * The AEAT does not accept a single total — it wants one entry per rate, with
 * its base and its cuota, so the tax can be checked without reading the lines.
 * Entries are grouped by rate and capped at the 12 the spec allows.
 *
 * A 0% line is declared exempt rather than taxed at zero. Which exemption
 * applies is a legal question the invoice does not currently ask, so it goes
 * out as E1 (artículo 20), the common case; capturing the real cause per line
 * is the correct fix and is not something to guess line by line.
 */
export function buildDesglose(lines: RegistroLine[]) {
  const byRate = new Map<number, { base: number; cuota: number }>()
  for (const l of lines) {
    const rate = Number(l.taxRate) || 0
    const acc = byRate.get(rate) ?? { base: 0, cuota: 0 }
    acc.base += Number(l.base) || 0
    acc.cuota += Number(l.cuota) || 0
    byRate.set(rate, acc)
  }

  return Array.from(byRate.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(0, 12)
    .map(([rate, { base, cuota }]) => rate === 0
      ? {
          Impuesto: '01',                       // IVA
          ClaveRegimen: '01',                   // régimen general
          OperacionExenta: 'E1',                // exenta por el artículo 20
          BaseImponibleOimporteNoSujeto: money(base),
        }
      : {
          Impuesto: '01',
          ClaveRegimen: '01',
          CalificacionOperacion: 'S1',          // sujeta y no exenta, sin ISP
          TipoImpositivo: money(rate),
          BaseImponibleOimporteNoSujeto: money(base),
          CuotaRepercutida: money(cuota),
        })
}

/**
 * DescripcionOperacion — mandatory free text, capped at the spec's 500 chars.
 *
 * The line descriptions are what actually describe the operation, so they are
 * what goes out; a note written on the invoice takes precedence when there is
 * one, since it was written for a reader.
 */
export function describeOperation(lines: RegistroLine[], notes?: string | null): string {
  const fromNotes = notes?.trim()
  const text = fromNotes || lines.map(l => l.description?.trim()).filter(Boolean).join('; ')
  const clean = (text || 'Prestación de servicios').replace(/\s+/g, ' ').trim()
  return clean.length > 500 ? `${clean.slice(0, 497)}...` : clean
}

/** The canonical registro de alta payload stored on the invoice (JSONB). */
export function buildRegistroAlta(args: RegistroAltaInput & {
  issuerName: string
  /** The recipient, Spanish or not. */
  client: RegistroDestinatario
  /** Lines, for the desglose and the description. */
  lines: RegistroLine[]
  /** Identifies this installation to the AEAT — the organization's id. */
  installationId: string
  notes?: string | null
  rectified?: { issuerNif: string; fullNumber: string; issueDate: string } | null
}) {
  return {
    IDVersion: '1.0',
    IDFactura: {
      IDEmisorFactura: args.issuerNif,
      NumSerieFactura: args.fullNumber,
      FechaExpedicionFactura: fechaExpedicion(args.issueDate),
    },
    NombreRazonEmisor: args.issuerName,
    TipoFactura: tipoFactura(args.kind),
    ...(args.rectified ? {
      // 'I' = por diferencias, which is what negated lines express: the
      // rectificativa carries only the correction, not the replacement total.
      TipoRectificativa: 'I',
      FacturasRectificadas: [{
        IDEmisorFactura: args.rectified.issuerNif,
        NumSerieFactura: args.rectified.fullNumber,
        FechaExpedicionFactura: fechaExpedicion(args.rectified.issueDate),
      }],
    } : {}),
    ...(() => {
      const dest = buildDestinatario(args.client)
      return dest ? { Destinatario: dest } : {}
    })(),
    DescripcionOperacion: describeOperation(args.lines, args.notes),
    Desglose: { DetalleDesglose: buildDesglose(args.lines) },
    CuotaTotal: money(args.cuotaTotal),
    ImporteTotal: money(args.importeTotal),
    Encadenamiento: args.previousHuella
      ? { RegistroAnterior: { Huella: args.previousHuella } }
      : { PrimerRegistro: 'S' },
    SistemaInformatico: sistemaInformatico(args.installationId),
    FechaHoraHusoGenRegistro: args.generatedAt,
    TipoHuella: '01', // SHA-256
    Huella: computeHuella(args),
  }
}

/** ISO-8601 timestamp with local timezone offset (FechaHoraHusoGenRegistro). */
export function nowWithOffset(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const off = -date.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const oh = pad(Math.floor(Math.abs(off) / 60))
  const om = pad(Math.abs(off) % 60)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${oh}:${om}`
}
