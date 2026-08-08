/**
 * The AEAT SOAP envelope for a Veri*Factu submission.
 *
 * Records are built and stored at issue time (lib/verifactu.ts) and turned into
 * XML here, at send time. Keeping the two apart matters: the stored record is
 * what the huella was computed over and is immutable, so serialising must never
 * reshape it — this module only transcribes.
 *
 * Element order is significant. The AEAT schema is sequence-based, so a correct
 * set of fields in the wrong order is rejected; the writers below emit in
 * schema order rather than iterating object keys.
 */

const NS_SUM = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd'
const NS_SUM1 = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd'
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/'

/** XML text escaping. Attribute quoting is not needed: we emit no attributes. */
export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const el = (name: string, value: unknown) =>
  value === undefined || value === null || value === '' ? '' : `<${name}>${esc(value)}</${name}>`

/** The obliged party, as the AEAT identifies the taxpayer the records belong to. */
export interface Obligado {
  nombreRazon: string
  nif: string
}

/**
 * One registro de alta, in schema order.
 *
 * `registro` is the JSONB stored on the invoice. It is read defensively —
 * records written before a field existed simply omit it, and a submission that
 * threw on old data would strand exactly the invoices most in need of sending.
 */
export function registroAltaXml(registro: Record<string, any>): string {
  const f = registro.IDFactura ?? {}
  const sis = registro.SistemaInformatico ?? {}
  const detalles: any[] = registro.Desglose?.DetalleDesglose ?? []

  const desglose = detalles.map(d => [
    '<sum1:DetalleDesglose>',
    el('sum1:Impuesto', d.Impuesto),
    el('sum1:ClaveRegimen', d.ClaveRegimen),
    el('sum1:CalificacionOperacion', d.CalificacionOperacion),
    el('sum1:OperacionExenta', d.OperacionExenta),
    el('sum1:TipoImpositivo', d.TipoImpositivo),
    el('sum1:BaseImponibleOimporteNoSujeto', d.BaseImponibleOimporteNoSujeto),
    el('sum1:CuotaRepercutida', d.CuotaRepercutida),
    '</sum1:DetalleDesglose>',
  ].join('')).join('')

  const rectificadas = (registro.FacturasRectificadas ?? []).map((r: any) => [
    '<sum1:IDFacturaRectificada>',
    el('sum1:IDEmisorFactura', r.IDEmisorFactura),
    el('sum1:NumSerieFactura', r.NumSerieFactura),
    el('sum1:FechaExpedicionFactura', r.FechaExpedicionFactura),
    '</sum1:IDFacturaRectificada>',
  ].join('')).join('')

  const encadenamiento = registro.Encadenamiento?.RegistroAnterior
    ? [
        '<sum1:Encadenamiento><sum1:RegistroAnterior>',
        el('sum1:IDEmisorFactura', registro.Encadenamiento.RegistroAnterior.IDEmisorFactura ?? f.IDEmisorFactura),
        el('sum1:NumSerieFactura', registro.Encadenamiento.RegistroAnterior.NumSerieFactura),
        el('sum1:FechaExpedicionFactura', registro.Encadenamiento.RegistroAnterior.FechaExpedicionFactura),
        el('sum1:Huella', registro.Encadenamiento.RegistroAnterior.Huella),
        '</sum1:RegistroAnterior></sum1:Encadenamiento>',
      ].join('')
    : '<sum1:Encadenamiento><sum1:PrimerRegistro>S</sum1:PrimerRegistro></sum1:Encadenamiento>'

  return [
    '<sum1:RegistroAlta>',
    el('sum1:IDVersion', registro.IDVersion ?? '1.0'),
    '<sum1:IDFactura>',
    el('sum1:IDEmisorFactura', f.IDEmisorFactura),
    el('sum1:NumSerieFactura', f.NumSerieFactura),
    el('sum1:FechaExpedicionFactura', f.FechaExpedicionFactura),
    '</sum1:IDFactura>',
    el('sum1:NombreRazonEmisor', registro.NombreRazonEmisor),
    el('sum1:TipoFactura', registro.TipoFactura),
    el('sum1:TipoRectificativa', registro.TipoRectificativa),
    rectificadas ? `<sum1:FacturasRectificadas>${rectificadas}</sum1:FacturasRectificadas>` : '',
    el('sum1:DescripcionOperacion', registro.DescripcionOperacion),
    registro.Destinatario
      ? [
          '<sum1:Destinatarios><sum1:IDDestinatario>',
          el('sum1:NombreRazon', registro.Destinatario.NombreRazon),
          // A Spanish client carries a NIF; anyone else the IDOtro block. The
          // two are alternatives in the schema, never both.
          registro.Destinatario.IDOtro
            ? [
                '<sum1:IDOtro>',
                el('sum1:CodigoPais', registro.Destinatario.IDOtro.CodigoPais),
                el('sum1:IDType', registro.Destinatario.IDOtro.IDType),
                el('sum1:ID', registro.Destinatario.IDOtro.ID),
                '</sum1:IDOtro>',
              ].join('')
            : el('sum1:NIF', registro.Destinatario.NIF),
          '</sum1:IDDestinatario></sum1:Destinatarios>',
        ].join('')
      : '',
    desglose ? `<sum1:Desglose>${desglose}</sum1:Desglose>` : '',
    el('sum1:CuotaTotal', registro.CuotaTotal),
    el('sum1:ImporteTotal', registro.ImporteTotal),
    encadenamiento,
    '<sum1:SistemaInformatico>',
    el('sum1:NombreRazon', sis.NombreRazon),
    el('sum1:NIF', sis.NIF),
    el('sum1:NombreSistemaInformatico', sis.NombreSistemaInformatico),
    el('sum1:IdSistemaInformatico', sis.IdSistemaInformatico),
    el('sum1:Version', sis.Version),
    el('sum1:NumeroInstalacion', sis.NumeroInstalacion),
    el('sum1:TipoUsoPosibleSoloVerifactu', sis.TipoUsoPosibleSoloVerifactu),
    el('sum1:TipoUsoPosibleMultiOT', sis.TipoUsoPosibleMultiOT),
    el('sum1:IndicadorMultiplesOT', sis.IndicadorMultiplesOT),
    '</sum1:SistemaInformatico>',
    el('sum1:FechaHoraHusoGenRegistro', registro.FechaHoraHusoGenRegistro),
    el('sum1:TipoHuella', registro.TipoHuella ?? '01'),
    el('sum1:Huella', registro.Huella),
    '</sum1:RegistroAlta>',
  ].join('')
}

/**
 * A full submission: one header and up to 1000 records, per the AEAT cap.
 *
 * Batching is the caller's job — this refuses an oversized batch rather than
 * truncating one, because a silently dropped invoice is a missing legal record.
 */
export function buildSubmissionXml(obligado: Obligado, registros: Record<string, any>[]): string {
  if (registros.length === 0) throw new Error('Nothing to submit')
  if (registros.length > 1000) throw new Error(`Batch of ${registros.length} exceeds the AEAT limit of 1000`)

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<soapenv:Envelope xmlns:soapenv="${NS_SOAP}" xmlns:sum="${NS_SUM}" xmlns:sum1="${NS_SUM1}">`,
    '<soapenv:Header/>',
    '<soapenv:Body>',
    '<sum:RegFactuSistemaFacturacion>',
    '<sum:Cabecera>',
    '<sum1:ObligadoEmision>',
    el('sum1:NombreRazon', obligado.nombreRazon),
    el('sum1:NIF', obligado.nif),
    '</sum1:ObligadoEmision>',
    '</sum:Cabecera>',
    registros.map(r => `<sum:RegistroFactura>${registroAltaXml(r)}</sum:RegistroFactura>`).join(''),
    '</sum:RegFactuSistemaFacturacion>',
    '</soapenv:Body>',
    '</soapenv:Envelope>',
  ].join('')
}

// ── Response ────────────────────────────────────────────────────────────────

export type EstadoEnvio = 'Correcto' | 'ParcialmenteCorrecto' | 'Incorrecto'

export interface LineaRespuesta {
  numSerieFactura: string | null
  estado: string | null
  codigoError: string | null
  descripcionError: string | null
}

export interface RespuestaSuministro {
  estadoEnvio: EstadoEnvio | null
  csv: string | null
  /** Seconds the AEAT asks us to wait before submitting again. */
  tiempoEsperaSegundos: number | null
  lineas: LineaRespuesta[]
  /** A SOAP Fault, when the request never reached the business logic. */
  fault: string | null
}

const tag = (xml: string, name: string): string | null => {
  // Namespace prefixes vary between AEAT environments, so match on local name.
  const m = xml.match(new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>`, 'i'))
  return m ? m[1].trim() : null
}

const allTags = (xml: string, name: string): string[] => {
  const re = new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>`, 'gi')
  return Array.from(xml.matchAll(re)).map(m => m[1])
}

/**
 * Read the AEAT's answer.
 *
 * Deliberately tolerant: it reads by local element name and treats anything it
 * cannot find as absent. A submission whose response we failed to parse must
 * not look like a success, so estadoEnvio stays null and the caller keeps the
 * record pending rather than marking it sent.
 */
export function parseSubmissionResponse(xml: string): RespuestaSuministro {
  const faultString = tag(xml, 'faultstring') ?? tag(xml, 'Reason')
  const estado = tag(xml, 'EstadoEnvio')
  const espera = tag(xml, 'TiempoEsperaEnvio')

  return {
    estadoEnvio: (estado as EstadoEnvio) ?? null,
    csv: tag(xml, 'CSV'),
    tiempoEsperaSegundos: espera && !Number.isNaN(Number(espera)) ? Number(espera) : null,
    lineas: allTags(xml, 'RespuestaLinea').map(l => ({
      numSerieFactura: tag(l, 'NumSerieFactura'),
      estado: tag(l, 'EstadoRegistro'),
      codigoError: tag(l, 'CodigoErrorRegistro'),
      descripcionError: tag(l, 'DescripcionErrorRegistro'),
    })),
    fault: faultString,
  }
}
