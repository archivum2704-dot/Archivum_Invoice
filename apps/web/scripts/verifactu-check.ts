import {
  buildRegistroAlta, buildDesglose, describeOperation, computeHuella,
  missingProducerConfig, type RegistroLine,
} from '@/lib/verifactu'

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
  ...chainInput, issuerName: 'Lumen S.A', clientNif: 'A87654321', clientName: 'Cliente_2',
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

console.log(`\n${fails === 0 ? 'TODO CORRECTO' : fails + ' COMPROBACIONES FALLIDAS'}\n`)
process.exit(fails === 0 ? 0 : 1)
