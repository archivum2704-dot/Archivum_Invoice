import https from 'https'
import forge from 'node-forge'
import { fechaExpedicion, money, tipoFactura, type InvoiceKind } from '@/lib/verifactu'

/**
 * AEAT VeriFactu real-time submission (SOAP + mutual TLS).
 *
 * Builds the RegFactuSistemaFacturacion / RegistroAlta envelope per the AEAT
 * SuministroLR/SuministroInformacion schemas and submits it over a TLS
 * connection authenticated with the issuer's digital certificate.
 *
 * NOTE: requires a real qualified certificate and network reachability to
 * AEAT. Defaults to the pre-production (test) endpoint.
 */

const ENV = (process.env.VERIFACTU_ENV ?? 'test').toLowerCase()
const ENDPOINT = ENV === 'prod'
  ? 'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP'
  : 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP'

const NS_LR = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd'
const NS_SI = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd'

// Our software (SIF) identity — configurable via env, with safe placeholders.
const SIF = {
  nombre: process.env.VERIFACTU_SIF_NOMBRE ?? 'Archivum',
  nif: process.env.VERIFACTU_SIF_NIF ?? '',
  nombreSistema: 'Archivum',
  id: process.env.VERIFACTU_SIF_ID ?? '01',
  version: process.env.VERIFACTU_SIF_VERSION ?? '1.0',
  instalacion: process.env.VERIFACTU_SIF_INSTALACION ?? '001',
}

function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!))
}

/** Extract cert + private key PEM from a .p12 buffer using its password. */
export function p12ToPem(p12: Buffer, password: string): { certPem: string; keyPem: string } {
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12.toString('binary')))
  const p = forge.pkcs12.pkcs12FromAsn1(asn1, password)
  const keyBag = p.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
    ?? p.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0]
  const certBag = p.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0]
  if (!keyBag?.key || !certBag?.cert) throw new Error('cert_extract_failed')
  return {
    certPem: forge.pki.certificateToPem(certBag.cert),
    keyPem: forge.pki.privateKeyToPem(keyBag.key),
  }
}

export interface AeatInvoice {
  full_number: string
  issue_date: string
  kind: InvoiceKind
  issuer_name: string
  issuer_cif: string
  client_name: string | null
  client_cif: string | null
  tax_amount: number
  total: number
  huella: string
  huella_anterior: string | null
  issued_at: string
  notes: string | null
}
export interface AeatLine { tax_rate: number; line_subtotal: number; line_tax: number }
export interface AeatPrev { issuer_cif: string; full_number: string; issue_date: string; huella: string }

/** Build the Desglose (breakdown grouped by VAT rate). */
function buildDesglose(lines: AeatLine[]): string {
  const byRate = new Map<number, { base: number; cuota: number }>()
  for (const l of lines) {
    const r = Number(l.tax_rate) || 0
    const g = byRate.get(r) ?? { base: 0, cuota: 0 }
    g.base += Number(l.line_subtotal) || 0
    g.cuota += Number(l.line_tax) || 0
    byRate.set(r, g)
  }
  let xml = ''
  for (const [rate, g] of byRate) {
    const exento = rate === 0
    xml += `<sum1:DetalleDesglose>` +
      `<sum1:ClaveRegimen>01</sum1:ClaveRegimen>` +
      (exento
        ? `<sum1:CalificacionOperacion>S2</sum1:CalificacionOperacion>`
        : `<sum1:CalificacionOperacion>S1</sum1:CalificacionOperacion>`) +
      `<sum1:TipoImpositivo>${money(rate)}</sum1:TipoImpositivo>` +
      `<sum1:BaseImponibleOimporteNoSujeto>${money(g.base)}</sum1:BaseImponibleOimporteNoSujeto>` +
      `<sum1:CuotaRepercutida>${money(g.cuota)}</sum1:CuotaRepercutida>` +
      `</sum1:DetalleDesglose>`
  }
  return xml
}

/** Build the SOAP envelope for a single RegistroAlta. */
export function buildEnvelope(inv: AeatInvoice, lines: AeatLine[], prev: AeatPrev | null): string {
  const encadenamiento = inv.huella_anterior && prev
    ? `<sum1:RegistroAnterior>` +
        `<sum1:IDEmisorFactura>${esc(prev.issuer_cif)}</sum1:IDEmisorFactura>` +
        `<sum1:NumSerieFactura>${esc(prev.full_number)}</sum1:NumSerieFactura>` +
        `<sum1:FechaExpedicionFactura>${fechaExpedicion(prev.issue_date)}</sum1:FechaExpedicionFactura>` +
        `<sum1:Huella>${esc(prev.huella)}</sum1:Huella>` +
      `</sum1:RegistroAnterior>`
    : `<sum1:PrimerRegistro>S</sum1:PrimerRegistro>`

  const rect = inv.kind === 'rectifying'
    ? `<sum1:TipoRectificativa>I</sum1:TipoRectificativa>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>` +
`<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sum="${NS_LR}" xmlns:sum1="${NS_SI}">` +
`<soapenv:Body>` +
`<sum:RegFactuSistemaFacturacion>` +
  `<sum:Cabecera>` +
    `<sum1:ObligadoEmision>` +
      `<sum1:NombreRazon>${esc(inv.issuer_name)}</sum1:NombreRazon>` +
      `<sum1:NIF>${esc(inv.issuer_cif)}</sum1:NIF>` +
    `</sum1:ObligadoEmision>` +
  `</sum:Cabecera>` +
  `<sum:RegistroFactura>` +
    `<sum:RegistroAlta>` +
      `<sum1:IDVersion>1.0</sum1:IDVersion>` +
      `<sum1:IDFactura>` +
        `<sum1:IDEmisorFactura>${esc(inv.issuer_cif)}</sum1:IDEmisorFactura>` +
        `<sum1:NumSerieFactura>${esc(inv.full_number)}</sum1:NumSerieFactura>` +
        `<sum1:FechaExpedicionFactura>${fechaExpedicion(inv.issue_date)}</sum1:FechaExpedicionFactura>` +
      `</sum1:IDFactura>` +
      `<sum1:NombreRazonEmisor>${esc(inv.issuer_name)}</sum1:NombreRazonEmisor>` +
      `<sum1:TipoFactura>${tipoFactura(inv.kind)}</sum1:TipoFactura>` +
      rect +
      `<sum1:DescripcionOperacion>${esc(inv.notes || 'Venta de bienes/servicios')}</sum1:DescripcionOperacion>` +
      (inv.client_cif
        ? `<sum1:Destinatarios><sum1:IDDestinatario>` +
            `<sum1:NombreRazon>${esc(inv.client_name)}</sum1:NombreRazon>` +
            `<sum1:NIF>${esc(inv.client_cif)}</sum1:NIF>` +
          `</sum1:IDDestinatario></sum1:Destinatarios>`
        : '') +
      `<sum1:Desglose>${buildDesglose(lines)}</sum1:Desglose>` +
      `<sum1:CuotaTotal>${money(inv.tax_amount)}</sum1:CuotaTotal>` +
      `<sum1:ImporteTotal>${money(inv.total)}</sum1:ImporteTotal>` +
      `<sum1:Encadenamiento>${encadenamiento}</sum1:Encadenamiento>` +
      `<sum1:SistemaInformatico>` +
        `<sum1:NombreRazon>${esc(SIF.nombre)}</sum1:NombreRazon>` +
        `<sum1:NIF>${esc(SIF.nif)}</sum1:NIF>` +
        `<sum1:NombreSistemaInformatico>${esc(SIF.nombreSistema)}</sum1:NombreSistemaInformatico>` +
        `<sum1:IdSistemaInformatico>${esc(SIF.id)}</sum1:IdSistemaInformatico>` +
        `<sum1:Version>${esc(SIF.version)}</sum1:Version>` +
        `<sum1:NumeroInstalacion>${esc(SIF.instalacion)}</sum1:NumeroInstalacion>` +
        `<sum1:TipoUsoPosibleSoloVerifactu>S</sum1:TipoUsoPosibleSoloVerifactu>` +
        `<sum1:TipoUsoPosibleMultiOT>S</sum1:TipoUsoPosibleMultiOT>` +
        `<sum1:IndicadorMultiplesOT>N</sum1:IndicadorMultiplesOT>` +
      `</sum1:SistemaInformatico>` +
      `<sum1:FechaHoraHusoGenRegistro>${esc(inv.issued_at)}</sum1:FechaHoraHusoGenRegistro>` +
      `<sum1:TipoHuella>01</sum1:TipoHuella>` +
      `<sum1:Huella>${esc(inv.huella)}</sum1:Huella>` +
    `</sum:RegistroAlta>` +
  `</sum:RegistroFactura>` +
`</sum:RegFactuSistemaFacturacion>` +
`</soapenv:Body></soapenv:Envelope>`
}

export interface AeatResult {
  ok: boolean
  estadoEnvio: string | null
  estadoRegistro: string | null
  csv: string | null
  errorCode: string | null
  errorDesc: string | null
  raw: string
}

/** mTLS POST of the SOAP envelope to AEAT; parses the response. */
export function submitToAeat(xml: string, certPem: string, keyPem: string): Promise<AeatResult> {
  return new Promise((resolve, reject) => {
    const url = new URL(ENDPOINT)
    const body = Buffer.from(xml, 'utf8')
    const req = https.request({
      host: url.host, path: url.pathname, method: 'POST',
      cert: certPem, key: keyPem,
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Content-Length': body.length, 'SOAPAction': '' },
      timeout: 30000,
    }, res => {
      let data = ''
      res.on('data', c => (data += c))
      res.on('end', () => {
        const pick = (tag: string) => new RegExp(`<(?:\\w+:)?${tag}>([^<]*)</(?:\\w+:)?${tag}>`, 'i').exec(data)?.[1] ?? null
        const estadoEnvio = pick('EstadoEnvio')
        const estadoRegistro = pick('EstadoRegistro')
        const csv = pick('CSV')
        const ok = res.statusCode === 200 &&
          (estadoEnvio === 'Correcto' || estadoRegistro === 'Correcto' || estadoRegistro === 'AceptadoConErrores')
        resolve({
          ok,
          estadoEnvio, estadoRegistro, csv,
          errorCode: pick('CodigoErrorRegistro') ?? pick('codigo'),
          errorDesc: pick('DescripcionErrorRegistro') ?? pick('descripcion') ?? pick('faultstring'),
          raw: data.slice(0, 4000),
        })
      })
    })
    req.on('timeout', () => req.destroy(new Error('aeat_timeout')))
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}
