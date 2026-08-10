/**
 * Vectores de prueba oficiales de la AEAT.
 *
 * Del documento «Detalle de las especificaciones técnicas para generación de la
 * huella o hash de los registros de facturación», v0.1.2 de 27/08/2024,
 * apartado 6. Son los únicos valores que confirman que nuestra huella es la que
 * la AEAT espera: hasta tenerlos, la implementación seguía la norma pero nadie
 * había comprobado el formato exacto de concatenación.
 *
 * Si alguna de estas comprobaciones falla, la huella está mal y la AEAT marcará
 * los registros como «Aceptado con errores» (apartado 7 del documento). No las
 * ajustes para que pasen: corrige la implementación.
 *
 *   npx tsx scripts/verifactu-vectors.ts
 */
import { huellaAltaFromParts, huellaAnulacionFromParts } from '@/lib/verifactu'
import { computeEventHuella } from '@/lib/verifactu-events'
import { createHash } from 'crypto'

let fails = 0
const check = (name: string, got: string, want: string) => {
  const ok = got === want
  if (!ok) fails++
  console.log(`  ${ok ? 'OK  ' : 'FALLA'}  ${name}`)
  if (!ok) {
    console.log(`         esperado: ${want}`)
    console.log(`         obtenido: ${got}`)
  }
}

console.log('\nVectores oficiales de la AEAT (huella v0.1.2, apartado 6)\n')

// 6.1 — primer registro de alta, sin huella anterior.
check('caso 1: primer registro de alta', huellaAltaFromParts({
  issuerNif: '89890001K',
  fullNumber: '12345678/G33',
  fechaExpedicion: '01-01-2024',
  tipoFactura: 'F1',
  cuotaTotal: '12.35',
  importeTotal: '123.45',
  previousHuella: '',
  generatedAt: '2024-01-01T19:20:30+01:00',
}), '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60')

// 6.2 — registro de alta encadenado sobre el anterior.
check('caso 2: alta encadenada', huellaAltaFromParts({
  issuerNif: '89890001K',
  fullNumber: '12345679/G34',
  fechaExpedicion: '01-01-2024',
  tipoFactura: 'F1',
  cuotaTotal: '12.35',
  importeTotal: '123.45',
  previousHuella: '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60',
  generatedAt: '2024-01-01T19:20:35+01:00',
}), 'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97')

// 6.3 — registro de anulación encadenado.
check('caso 3: anulación encadenada', huellaAnulacionFromParts({
  issuerNif: '89890001K',
  annulledFullNumber: '12345679/G34',
  fechaExpedicion: '01-01-2024',
  previousHuella: 'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97',
  generatedAt: '2024-01-01T19:20:40+01:00',
}), '177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68')

// El documento no publica vector para el registro de evento. Lo que sí fija
// (apartado 3.c) es el orden y el nombre de sus nueve campos, incluido que el
// primero y el sexto se llaman ambos «NIF» y que el octavo es «HuellaEvento».
// Se comprueba la cadena, que es lo verificable sin vector.
const esperado =
  'NIF=89890001K&ID=&IdSistemaInformatico=AR&Version=1.0&NumeroInstalacion=org-1' +
  '&NIF=B12345678&TipoEvento=90&HuellaEvento=&FechaHoraHusoGenEvento=2024-01-01T19:20:30+01:00'
check('registro de evento: 9 campos en el orden del apartado 3.c',
  computeEventHuella({
    producerNif: '89890001K',
    producerOtroId: '',
    systemId: 'AR',
    systemVersion: '1.0',
    installationId: 'org-1',
    obligadoNif: 'B12345678',
    eventType: '90',
    previousHuella: '',
    occurredAt: '2024-01-01T19:20:30+01:00',
  }),
  createHash('sha256').update(esperado, 'utf8').digest('hex').toUpperCase())

console.log(`\n${fails === 0 ? 'TODOS LOS VECTORES COINCIDEN' : fails + ' VECTORES NO COINCIDEN'}\n`)
process.exit(fails === 0 ? 0 : 1)
