import {
  buildRegistroAlta, buildDesglose, describeOperation, computeHuella,
  missingProducerConfig, type RegistroLine,
} from '@/lib/verifactu'
import { buildSubmissionXml, parseSubmissionResponse, esc } from '@/lib/verifactu-xml'

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

console.log(`\n${fails === 0 ? 'TODO CORRECTO' : fails + ' COMPROBACIONES FALLIDAS'}\n`)
process.exit(fails === 0 ? 0 : 1)
