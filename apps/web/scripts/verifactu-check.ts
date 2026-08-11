import {
  buildRegistroAlta, buildDesglose, describeOperation, computeHuella,
  missingProducerConfig, type RegistroLine,
} from '@/lib/verifactu'
import { buildSubmissionXml, parseSubmissionResponse, esc } from '@/lib/verifactu-xml'
import { buildRegistroAnulacion, computeHuellaAnulacion } from '@/lib/verifactu'
import { verifactuEndpoint } from '@/lib/verifactu-client'
import {
  describeAeatError, isSubsanable, rejectsWholeSubmission, AEAT_ERROR_COUNT,
} from '@/lib/verifactu-error-codes'
import { registroEventoXml } from '@/lib/verifactu-events-xml'
import { buildInvoicePdf } from '@/lib/invoice-pdf'

let fails = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '  OK  ' : ' FALLA'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!cond) fails++
}

// Una factura con tres tipos distintos, uno de ellos repetido y uno exento.
const lines: RegistroLine[] = [
  { description: 'Diseño web',      taxRate: 21, base: 1000,  cuota: 210 },
  { description: 'Hosting anual',   taxRate: 21, base: 500,   cuota: 105 },
  { description: 'Libro técnico',   taxRate: 4,  base: 100,   cuota: 4 },
  { description: 'Formación',       taxRate: 0,  base: 300,   cuota: 0 },
]
const cuotaTotal = 319, importeTotal = 2219

const chainInput = {
  issuerNif: 'B12345678', fullNumber: 'FAC-2026-0001', issueDate: '2026-08-08',
  kind: 'ordinary' as const, cuotaTotal, importeTotal,
  previousHuella: 'ABC123', generatedAt: '2026-08-08T12:00:00+02:00',
}

console.log('\n── Desglose ──')
const d = buildDesglose(lines)
check('una entrada por tipo, no por línea', d.length === 3, `${d.length} entradas`)
check('el 21% agrupa las dos líneas', (d.find((x: any) => x.TipoImpositivo === '21.00') as any)?.BaseImponibleOimporteNoSujeto === '1500.00')
check('cuota del 21% sumada', (d.find((x: any) => x.TipoImpositivo === '21.00') as any)?.CuotaRepercutida === '315.00')
check('el 0% sale como exento, no como tipo 0', !!(d.find((x: any) => x.OperacionExenta) as any))
check('el exento no lleva CuotaRepercutida', !(d.find((x: any) => x.OperacionExenta) as any)?.CuotaRepercutida)
const sumBase = d.reduce((a: number, x: any) => a + Number(x.BaseImponibleOimporteNoSujeto), 0)
const sumCuota = d.reduce((a: number, x: any) => a + Number(x.CuotaRepercutida ?? 0), 0)
check('las bases del desglose suman la base total', sumBase === 1900, String(sumBase))
check('las cuotas del desglose suman CuotaTotal', sumCuota === cuotaTotal, `${sumCuota} vs ${cuotaTotal}`)

console.log('\n── DescripcionOperacion ──')
check('sale de las líneas si no hay notas', describeOperation(lines).includes('Diseño web'))
check('la nota manda cuando existe', describeOperation(lines, 'Servicios agosto') === 'Servicios agosto')
check('se recorta a 500', describeOperation([{ ...lines[0], description: 'x'.repeat(900) }]).length <= 500)

console.log('\n── Registro completo ──')
const reg: any = buildRegistroAlta({
  ...chainInput, issuerName: 'Lumen S.A',
  client: { name: 'Cliente_2', id: 'A87654321' },
  lines, installationId: 'org-abc', notes: null,
})
for (const f of ['IDVersion','IDFactura','NombreRazonEmisor','TipoFactura','DescripcionOperacion',
                 'Desglose','CuotaTotal','ImporteTotal','Encadenamiento','SistemaInformatico',
                 'FechaHoraHusoGenRegistro','TipoHuella','Huella']) {
  check(`lleva ${f}`, reg[f] !== undefined)
}
for (const f of ['NombreRazon','NIF','NombreSistemaInformatico','IdSistemaInformatico','Version',
                 'NumeroInstalacion','TipoUsoPosibleSoloVerifactu','TipoUsoPosibleMultiOT','IndicadorMultiplesOT']) {
  check(`SistemaInformatico lleva ${f}`, reg.SistemaInformatico[f] !== undefined)
}

console.log('\n── La huella NO puede cambiar (rompería la cadena) ──')
const expected = computeHuella(chainInput)
check('la huella del registro es la de la cadena', reg.Huella === expected, expected.slice(0, 16) + '…')
check('huella conocida estable', expected === computeHuella({ ...chainInput }))

console.log('\n── Configuración del productor ──')
const missing = missingProducerConfig()
console.log(missing.length ? `  AVISO  faltan: ${missing.join(', ')}` : '  OK   configurado')

console.log('\n── XML de envío a la AEAT ──')
const xml = buildSubmissionXml({ nombreRazon: 'Lumen S.A', nif: 'B12345678' }, [reg])
check('envuelve en SOAP', xml.includes('<soapenv:Envelope') && xml.includes('</soapenv:Envelope>'))
check('lleva la cabecera del obligado', xml.includes('<sum1:ObligadoEmision>') && xml.includes('B12345678'))
check('lleva el registro de alta', xml.includes('<sum1:RegistroAlta>'))
check('lleva el desglose', (xml.match(/<sum1:DetalleDesglose>/g) ?? []).length === 3)
check('lleva la huella', xml.includes(`<sum1:Huella>${reg.Huella}</sum1:Huella>`))
check('lleva el encadenamiento anterior', xml.includes('<sum1:RegistroAnterior>') && xml.includes('ABC123'))
check('lleva SistemaInformatico completo', xml.includes('<sum1:TipoUsoPosibleSoloVerifactu>S<'))
check('etiquetas equilibradas', (xml.match(/</g) ?? []).length === (xml.match(/>/g) ?? []).length)

// El orden del esquema es secuencia: campos correctos en orden incorrecto =
// rechazo. Hay que mirar solo los hijos directos: Huella aparece también
// dentro de Encadenamiento, y buscar por posición encontraría esa primero.
function directChildren(xml: string, parent: string): string[] {
  const openTag = `<sum1:${parent}>`
  const start = xml.indexOf(openTag) + openTag.length
  const body = xml.slice(start, xml.indexOf(`</sum1:${parent}>`))
  const names: string[] = []
  let depth = 0
  for (const m of body.matchAll(/<(\/?)sum1:([A-Za-z]+)(\/?)>/g)) {
    const [, closing, name, selfClosing] = m
    if (closing) { depth--; continue }
    if (depth === 0) names.push(name)
    if (!selfClosing) depth++
  }
  return names
}

const schemaOrder = ['IDVersion','IDFactura','NombreRazonEmisor','TipoFactura','DescripcionOperacion',
                     'Destinatarios','Desglose','CuotaTotal','ImporteTotal','Encadenamiento',
                     'SistemaInformatico','FechaHoraHusoGenRegistro','TipoHuella','Huella']
const actualOrder = directChildren(xml, 'RegistroAlta')
check('orden de elementos según el esquema',
  JSON.stringify(actualOrder) === JSON.stringify(schemaOrder),
  actualOrder.join(' > '))

check('escapa el XML', esc('Bar & Co <script>') === 'Bar &amp; Co &lt;script&gt;')
const withAmp = buildSubmissionXml({ nombreRazon: 'Bar & Co', nif: 'B1' }, [reg])
check('un & en el nombre no rompe el XML', withAmp.includes('Bar &amp; Co') && !withAmp.includes('Bar & Co<'))

// Primer registro de una cadena
const first: any = buildRegistroAlta({
  ...chainInput, previousHuella: '', issuerName: 'Lumen S.A',
  client: { name: 'C', id: 'A1' },
  lines, installationId: 'org-abc',
})
check('el primer registro va como PrimerRegistro',
  buildSubmissionXml({ nombreRazon: 'L', nif: 'B1' }, [first]).includes('<sum1:PrimerRegistro>S<'))

let threw = false
try { buildSubmissionXml({ nombreRazon: 'L', nif: 'B1' }, new Array(1001).fill(reg)) } catch { threw = true }
check('rechaza un lote de más de 1000 en vez de recortarlo', threw)

console.log('\n── Cliente extranjero (IDOtro) ──')
const spanish: any = buildRegistroAlta({
  ...chainInput, issuerName: 'L', client: { name: 'Cliente ES', id: 'A87654321', countryCode: 'ES' },
  lines, installationId: 'org-abc',
})
check('un cliente español va por NIF', spanish.Destinatario.NIF === 'A87654321' && !spanish.Destinatario.IDOtro)

const foreign: any = buildRegistroAlta({
  ...chainInput, issuerName: 'L',
  client: { name: 'Acme GmbH', id: 'DE123456789', countryCode: 'DE', idType: '02' },
  lines, installationId: 'org-abc',
})
check('un cliente extranjero va por IDOtro', !!foreign.Destinatario.IDOtro && !foreign.Destinatario.NIF)
check('IDOtro lleva país, tipo e identificador',
  foreign.Destinatario.IDOtro.CodigoPais === 'DE' &&
  foreign.Destinatario.IDOtro.IDType === '02' &&
  foreign.Destinatario.IDOtro.ID === 'DE123456789')
check('nunca salen NIF e IDOtro a la vez',
  !(foreign.Destinatario.NIF && foreign.Destinatario.IDOtro))

const foreignXml = buildSubmissionXml({ nombreRazon: 'L', nif: 'B1' }, [foreign])
check('el XML emite IDOtro', foreignXml.includes('<sum1:IDOtro>') && foreignXml.includes('<sum1:CodigoPais>DE<'))
check('el XML del extranjero no emite NIF de destinatario',
  !foreignXml.includes('<sum1:NIF>DE123456789<'))

// Un país extranjero sin tipo de documento no debe colarse como NIF español.
const noType: any = buildRegistroAlta({
  ...chainInput, issuerName: 'L', client: { name: 'X', id: 'FR999', countryCode: 'FR' },
  lines, installationId: 'org-abc',
})
check('sin tipo de documento cae al NIF (y por eso el formulario lo exige)',
  noType.Destinatario.NIF === 'FR999')

console.log('\n── Registro de anulación (art. 11) ──')
const anulInput = {
  issuerNif: 'B12345678',
  annulledFullNumber: 'FAC-2026-0001',
  annulledIssueDate: '2026-08-08',
  previousHuella: reg.Huella,
  generatedAt: '2026-08-08T13:00:00+02:00',
}
const anul: any = buildRegistroAnulacion({ ...anulInput, installationId: 'org-abc' })

check('identifica la factura anulada',
  anul.IDFactura.IDEmisorFacturaAnulada === 'B12345678' &&
  anul.IDFactura.NumSerieFacturaAnulada === 'FAC-2026-0001' &&
  anul.IDFactura.FechaExpedicionFacturaAnulada === '08-08-2026')
check('se encadena al registro anterior', anul.Encadenamiento.RegistroAnterior.Huella === reg.Huella)
check('declara quién lo genera', anul.GeneradoPor === 'E')
check('lleva SistemaInformatico', !!anul.SistemaInformatico.NombreSistemaInformatico)
check('su huella es la de anulación, no la de alta', anul.Huella === computeHuellaAnulacion(anulInput))
check('huella distinta a la del alta que anula', anul.Huella !== reg.Huella)

// Anular un registro que la AEAT nunca recibió debe decirlo.
const nuncaEnviado: any = buildRegistroAnulacion({ ...anulInput, installationId: 'org-abc', sinRegistroPrevio: true })
check('marca SinRegistroPrevio cuando nunca se envió', nuncaEnviado.SinRegistroPrevio === 'S')
check('no lo marca cuando sí se envió', anul.SinRegistroPrevio === undefined)

const anulXml = buildSubmissionXml({ nombreRazon: 'L', nif: 'B12345678' },
  [{ kind: 'anulacion', registro: anul }])
check('el XML emite RegistroAnulacion', anulXml.includes('<sum1:RegistroAnulacion>'))
check('el XML del anulación no emite RegistroAlta', !anulXml.includes('<sum1:RegistroAlta>'))
check('lleva el número de la factura anulada', anulXml.includes('<sum1:NumSerieFacturaAnulada>FAC-2026-0001<'))

const anulOrder = ['IDVersion','IDFactura','GeneradoPor','Encadenamiento','SistemaInformatico',
                   'FechaHoraHusoGenRegistro','TipoHuella','Huella']
check('orden de elementos de la anulación',
  JSON.stringify(directChildren(anulXml, 'RegistroAnulacion')) === JSON.stringify(anulOrder),
  directChildren(anulXml, 'RegistroAnulacion').join(' > '))

// Alta y anulación viajan en el mismo envío.
const mixed = buildSubmissionXml({ nombreRazon: 'L', nif: 'B1' },
  [{ kind: 'alta', registro: reg }, { kind: 'anulacion', registro: anul }])
check('un envío mezcla altas y anulaciones',
  mixed.includes('<sum1:RegistroAlta>') && mixed.includes('<sum1:RegistroAnulacion>'))
check('los registros bare siguen tratándose como alta',
  buildSubmissionXml({ nombreRazon: 'L', nif: 'B1' }, [reg]).includes('<sum1:RegistroAlta>'))

console.log('\n── Respuesta de la AEAT ──')
const okResp = parseSubmissionResponse(`
<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body>
<tikR:RespuestaSuministro xmlns:tikR="urn:x">
  <tikR:CSV>ABC123CSV</tikR:CSV>
  <tikR:EstadoEnvio>Correcto</tikR:EstadoEnvio>
  <tikR:TiempoEsperaEnvio>60</tikR:TiempoEsperaEnvio>
  <tikR:RespuestaLinea>
    <tikR:IDFactura><tikR:NumSerieFactura>FAC-2026-0001</tikR:NumSerieFactura></tikR:IDFactura>
    <tikR:EstadoRegistro>Correcto</tikR:EstadoRegistro>
  </tikR:RespuestaLinea>
</tikR:RespuestaSuministro></env:Body></env:Envelope>`)
check('lee el CSV', okResp.csv === 'ABC123CSV')
check('lee el estado', okResp.estadoEnvio === 'Correcto')
check('lee el control de flujo', okResp.tiempoEsperaSegundos === 60)
check('lee la línea y su número', okResp.lineas[0]?.numSerieFactura === 'FAC-2026-0001')
check('ignora el prefijo de espacio de nombres', okResp.lineas[0]?.estado === 'Correcto')

const badResp = parseSubmissionResponse(`
<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body>
<tikR:RespuestaSuministro xmlns:tikR="urn:x">
  <tikR:EstadoEnvio>Incorrecto</tikR:EstadoEnvio>
  <tikR:RespuestaLinea>
    <tikR:IDFactura><tikR:NumSerieFactura>FAC-2026-0002</tikR:NumSerieFactura></tikR:IDFactura>
    <tikR:EstadoRegistro>Incorrecto</tikR:EstadoRegistro>
    <tikR:CodigoErrorRegistro>1100</tikR:CodigoErrorRegistro>
    <tikR:DescripcionErrorRegistro>NIF no identificado</tikR:DescripcionErrorRegistro>
  </tikR:RespuestaLinea>
</tikR:RespuestaSuministro></env:Body></env:Envelope>`)
check('lee el código de error', badResp.lineas[0]?.codigoError === '1100')
check('lee la descripción del error', badResp.lineas[0]?.descripcionError === 'NIF no identificado')

const fault = parseSubmissionResponse(`<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body>
<env:Fault><faultstring>Certificado no valido</faultstring></env:Fault></env:Body></env:Envelope>`)
check('detecta un SOAP Fault', fault.fault === 'Certificado no valido')
check('un Fault no parece un envío correcto', fault.estadoEnvio === null)

const garbage = parseSubmissionResponse('<html>error 500</html>')
check('una respuesta ilegible NO parece correcta', garbage.estadoEnvio === null && garbage.csv === null)

// ── Endpoints: representante y sello van a hosts distintos ──
// Confirmado por la AEAT (agosto de 2026). Enviar al host equivocado no
// degrada nada: la remisión falla. Estas comprobaciones existen para que
// nadie los unifique "simplificando".
const envAntes = process.env.VERIFACTU_ENV
process.env.VERIFACTU_ENV = 'test'
check('pruebas, representante → prewww1',
  verifactuEndpoint('representante').startsWith('https://prewww1.aeat.es/'))
check('pruebas, sello → prewww10',
  verifactuEndpoint('sello').startsWith('https://prewww10.aeat.es/'))
check('representante y sello no comparten host',
  verifactuEndpoint('representante') !== verifactuEndpoint('sello'))
check('por defecto se asume representante',
  verifactuEndpoint() === verifactuEndpoint('representante'))

process.env.VERIFACTU_ENV = 'prod'
// Las cuatro direcciones salen del WSDL de la AEAT, no de deducirlas.
check('producción, representante → www1',
  verifactuEndpoint('representante').startsWith('https://www1.agenciatributaria.gob.es/'))
check('producción, sello → www10',
  verifactuEndpoint('sello').startsWith('https://www10.agenciatributaria.gob.es/'))
check('en producción tampoco comparten host',
  verifactuEndpoint('representante') !== verifactuEndpoint('sello'))
if (envAntes === undefined) delete process.env.VERIFACTU_ENV
else process.env.VERIFACTU_ENV = envAntes

// ── Códigos de error de la AEAT ──
check('4102 rechaza el envío completo', rejectsWholeSubmission('4102'))
check('1100 no rechaza el envío completo', !rejectsWholeSubmission('1100'))
check('2004 es subsanable', isSubsanable('2004'))
check('describe un código conocido',
  describeAeatError('4107').includes('censo de la AEAT'))
// Un código que no conocemos no se disfraza de conocido: si algún día la AEAT
// añade uno, el usuario debe ver que no lo sabemos interpretar.
check('un código desconocido se declara desconocido',
  describeAeatError('9999').includes('no reconocido'))
check('sin código pero con texto de la AEAT, se muestra el texto',
  describeAeatError(null, 'Algo pasó') === 'Algo pasó')

// ── ClaveRegimen ──
check('por defecto, régimen general', (buildDesglose(lines)[0] as any).ClaveRegimen === '01')
check('respeta un régimen distinto', (buildDesglose(lines, '17')[0] as any).ClaveRegimen === '17')
check('lo aplica también a las líneas exentas',
  (buildDesglose(lines, '17').find((x: any) => x.OperacionExenta) as any)?.ClaveRegimen === '17')
// Un código inválido tumba el registro entero en la AEAT. Preferimos el
// régimen general a que se rechace la factura.
check('un código inválido cae al general', (buildDesglose(lines, '99')[0] as any).ClaveRegimen === '01')
check('vacío cae al general', (buildDesglose(lines, '')[0] as any).ClaveRegimen === '01')

// ── Serialización del registro de evento (anexo 5) ──
const evtRegistro = {
  IDVersion: '1.0',
  Evento: {
    SistemaInformatico: {
      NombreRazon: 'Productora S.L', NIF: 'B12345678',
      NombreSistemaInformatico: 'Archivum', IdSistemaInformatico: 'AR',
      Version: '1.0', NumeroInstalacion: 'org-abc',
      TipoUsoPosibleSoloVerifactu: 'S', TipoUsoPosibleMultiOT: 'S', IndicadorMultiplesOT: 'S',
    },
    ObligadoEmision: { NombreRazon: 'Lumen S.A', NIF: 'A87654321' },
    FechaHoraHusoGenEvento: '2026-08-10T12:00:00+02:00',
    TipoEvento: '03',
    OtrosDatosEvento: 'deteccion_anomalias_facturacion_lanzada',
    Encadenamiento: { PrimerEvento: 'S' },
    TipoHuella: '01',
    HuellaEvento: 'ABC123',
  },
}
const evtXml = registroEventoXml(evtRegistro) ?? ''
check('el evento se serializa con el espacio de nombres del esquema',
  evtXml.includes('EventosSIF.xsd'))
check('lleva ObligadoEmision con nombre y NIF',
  evtXml.includes('<sf:NombreRazon>Lumen S.A</sf:NombreRazon>') && evtXml.includes('<sf:NIF>A87654321</sf:NIF>'))
check('el primer evento va como PrimerEvento', evtXml.includes('<sf:PrimerEvento>S</sf:PrimerEvento>'))
check('etiquetas de evento equilibradas',
  (evtXml.match(/</g) ?? []).length === (evtXml.match(/>/g) ?? []).length)
// Los eventos escritos antes de corregir el formato no se pueden expresar en
// el esquema; devolver null es lo correcto, inventar una envoltura no.
check('un evento con el formato anterior no se serializa',
  registroEventoXml({ TipoEvento: 'algo', SistemaInformatico: {} }) === null)

const evtOrden = directChildren(evtXml.replace(/sf:/g, 'sum1:'), 'Evento')
check('orden de elementos del evento según el esquema',
  JSON.stringify(evtOrden) === JSON.stringify([
    'SistemaInformatico', 'ObligadoEmision', 'FechaHoraHusoGenEvento', 'TipoEvento',
    'OtrosDatosEvento', 'Encadenamiento', 'TipoHuella', 'HuellaEvento',
  ]), evtOrden.join(' > '))

async function comprobarPdf() {
  // ── Factura sin obligación en España ──
  // El PDF no debe llevar bloque Verifactu si no hay registro. Se comprueba que
  // el tipo lo admite y que el generador no revienta: imprimir una leyenda de
  // cotejo en una factura sin registro seria afirmar algo falso.
  const sinRegistro = await buildInvoicePdf({
    fullNumber: 'FAC-2026-0001', issueDate: '2026-08-10', dueDate: null,
    issuer: { name: 'Acme Lda', cif: 'PT999999990', address: null, postalCode: null, city: null, province: null, logoUrl: null },
    client: { name: 'Cliente', cif: 'PT123456789', address: null, postalCode: null, city: null, province: null },
    lines: [{ description: 'Servicio', quantity: 1, unit_price: 100, tax_rate: 21, line_total: 121 }],
    subtotal: 100, discountPct: 0, discountAmount: 0, taxAmount: 21,
    retentionPct: 0, retentionAmount: 0, total: 121, notes: null,
    huella: null, qrUrl: null,
  })
  check('una factura sin registro genera PDF', sinRegistro.length > 0)
  // El texto del PDF va comprimido, pero la leyenda entra como cadena literal en
  // el flujo de contenido; comprobamos que el PDF con registro sí es mayor por
  // llevar el QR embebido.
  const conRegistro = await buildInvoicePdf({
    fullNumber: 'FAC-2026-0002', issueDate: '2026-08-10', dueDate: null,
    issuer: { name: 'Lumen S.A', cif: 'B12345678', address: null, postalCode: null, city: null, province: null, logoUrl: null },
    client: { name: 'Cliente', cif: 'A87654321', address: null, postalCode: null, city: null, province: null },
    lines: [{ description: 'Servicio', quantity: 1, unit_price: 100, tax_rate: 21, line_total: 121 }],
    subtotal: 100, discountPct: 0, discountAmount: 0, taxAmount: 21,
    retentionPct: 0, retentionAmount: 0, total: 121, notes: null,
    huella: 'A'.repeat(64), qrUrl: 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=B12345678',
  })
  check('el PDF con registro pesa más (lleva el QR embebido)',
    conRegistro.length > sinRegistro.length,
    `${sinRegistro.length} vs ${conRegistro.length} bytes`)
}

comprobarPdf().then(() => {

  console.log(`\n${fails === 0 ? 'TODO CORRECTO' : fails + ' COMPROBACIONES FALLIDAS'}\n`)
  process.exit(fails === 0 ? 0 : 1)
})
