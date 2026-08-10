import { esc } from '@/lib/verifactu-xml'

/**
 * Registro de eventos serialised to XML (art. 9.4 de la Orden HAC/1177/2024).
 *
 * The article requires the event records to be kept in XML, UTF-8, following
 * the layout of annex 5. That layout is published as `EventosSIF.xsd`, a copy
 * of which is in `docs/aeat/`.
 *
 * The record is stored as JSON shaped after that schema, so this is a
 * serialisation and not a translation: the element names already match, and
 * what this adds is the namespace, the ordering the schema fixes as a sequence,
 * and the escaping.
 *
 * ⚠ **The schema requires a `ds:Signature` and this does not emit one.**
 * Archivum operates exclusively as VERI*FACTU, where records are considered
 * signed by having reached the AEAT under the obliged party's certificate —
 * there is no separate XAdES signature to serialise, and fabricating an empty
 * element would produce a document that claims a signature it does not carry.
 * Note also that the AEAT publishes this schema as «Definición del Registro de
 * Eventos para sistemas **no** VERI*FACTU»; whether it applies to us at all is
 * an open question with the Agency. Until that is answered, the export carries
 * everything the schema asks for except the signature, and says so.
 */

const NS = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/EventosSIF.xsd'

/** One element, omitted entirely when there is no value — the schema's optionals. */
function el(name: string, value: unknown, indent: string): string {
  if (value === null || value === undefined || value === '') return ''
  return `${indent}<sf:${name}>${esc(String(value))}</sf:${name}>\n`
}

/** Emits the named children of an object in the order the schema fixes. */
function seq(obj: Record<string, unknown> | null | undefined, order: string[], indent: string): string {
  if (!obj) return ''
  return order.map(k => el(k, obj[k], indent)).join('')
}

const ORDEN_SISTEMA = [
  'NombreRazon', 'NIF', 'NombreSistemaInformatico', 'IdSistemaInformatico',
  'Version', 'NumeroInstalacion', 'TipoUsoPosibleSoloVerifactu',
  'TipoUsoPosibleMultiOT', 'IndicadorMultiplesOT',
]

/**
 * Serialise one stored event record.
 *
 * Returns null for a record written before the layout was corrected — those
 * carry the old field names at the top level and cannot be expressed in the
 * schema, and emitting something schema-shaped from them would misrepresent
 * what was actually recorded.
 */
export function registroEventoXml(registro: any): string | null {
  const ev = registro?.Evento
  if (!ev) return null

  const sis = ev.SistemaInformatico ?? {}
  const enc = ev.Encadenamiento ?? {}

  let xml = `<sf:RegistroEvento xmlns:sf="${NS}">\n`
  xml += el('IDVersion', registro.IDVersion ?? '1.0', '  ')
  xml += '  <sf:Evento>\n'

  xml += '    <sf:SistemaInformatico>\n'
  xml += seq(sis, ORDEN_SISTEMA, '      ')
  if (sis.IDOtro) {
    xml += '      <sf:IDOtro>\n'
    xml += seq(sis.IDOtro, ['CodigoPais', 'IDType', 'ID'], '        ')
    xml += '      </sf:IDOtro>\n'
  }
  xml += '    </sf:SistemaInformatico>\n'

  xml += '    <sf:ObligadoEmision>\n'
  xml += seq(ev.ObligadoEmision, ['NombreRazon', 'NIF'], '      ')
  xml += '    </sf:ObligadoEmision>\n'

  xml += el('FechaHoraHusoGenEvento', ev.FechaHoraHusoGenEvento, '    ')
  xml += el('TipoEvento', ev.TipoEvento, '    ')

  // DatosPropiosEvento is a choice of typed blocks in the schema. What we hold
  // is our own detail object, which does not map onto them one to one, so it
  // goes in OtrosDatosEvento — the free-text field the schema provides for
  // exactly this — rather than being forced into a shape it does not fit.
  xml += el('OtrosDatosEvento', ev.OtrosDatosEvento, '    ')

  xml += '    <sf:Encadenamiento>\n'
  if (enc.PrimerEvento) {
    xml += el('PrimerEvento', enc.PrimerEvento, '      ')
  } else if (enc.EventoAnterior) {
    xml += '      <sf:EventoAnterior>\n'
    xml += el('HuellaEvento', enc.EventoAnterior.HuellaEvento, '        ')
    xml += '      </sf:EventoAnterior>\n'
  }
  xml += '    </sf:Encadenamiento>\n'

  xml += el('TipoHuella', ev.TipoHuella ?? '01', '    ')
  xml += el('HuellaEvento', ev.HuellaEvento, '    ')
  xml += '  </sf:Evento>\n'
  xml += '</sf:RegistroEvento>'
  return xml
}
