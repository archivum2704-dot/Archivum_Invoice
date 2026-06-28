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

/** The canonical registro de alta payload stored on the invoice (JSONB). */
export function buildRegistroAlta(args: RegistroAltaInput & {
  issuerName: string
  clientNif: string | null
  clientName: string | null
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
    ...(args.clientNif ? {
      Destinatario: { NIF: args.clientNif, NombreRazon: args.clientName ?? '' },
    } : {}),
    CuotaTotal: money(args.cuotaTotal),
    ImporteTotal: money(args.importeTotal),
    Encadenamiento: args.previousHuella
      ? { RegistroAnterior: { Huella: args.previousHuella } }
      : { PrimerRegistro: 'S' },
    SistemaInformatico: { NombreSistema: 'Archivum', Version: '1.0' },
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
