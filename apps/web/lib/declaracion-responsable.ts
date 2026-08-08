/**
 * The declaración responsable, as the software has to carry it.
 *
 * Article 13.2 of RD 1007/2023 is a product requirement, not just paperwork:
 * the declaration must appear "por escrito y de modo visible en el propio
 * sistema informático en cada una de sus versiones", and be available to the
 * client and the reseller at the moment of acquisition. A signed PDF in a
 * drawer does not satisfy it.
 *
 * Article 13.4 fixes the content: what identifies the system and its
 * typology, composition and functionalities; the characteristics of the
 * installation; the producer's identifying and location data; and the date and
 * place of signature.
 *
 * Until a declaration is actually issued, this reports that it has not been —
 * openly. Displaying a placeholder that reads like a declaration would assert
 * a conformity nobody has certified, which is the precise thing the article
 * exists to prevent.
 */

export interface DeclaracionResponsable {
  /** False until an adviser has drafted and signed one. */
  issued: boolean
  system: {
    name: string
    id: string
    version: string
    /** How the system is delivered and what it does — art. 13.4. */
    typology: string
    composition: string[]
    functionalities: string[]
    installation: string
  }
  producer: {
    nombreRazon: string | null
    nif: string | null
    address: string | null
    email: string | null
    website: string | null
  }
  signature: {
    place: string | null
    date: string | null
  }
  /** Everything article 13 requires that is not yet in place. */
  missing: string[]
}

export function declaracionResponsable(): DeclaracionResponsable {
  const producer = {
    nombreRazon: process.env.VERIFACTU_PRODUCER_NAME?.trim() || null,
    nif: process.env.VERIFACTU_PRODUCER_NIF?.trim() || null,
    address: process.env.VERIFACTU_PRODUCER_ADDRESS?.trim() || null,
    email: process.env.VERIFACTU_PRODUCER_EMAIL?.trim() || null,
    website: process.env.VERIFACTU_PRODUCER_WEBSITE?.trim() || null,
  }
  const signature = {
    place: process.env.VERIFACTU_DECLARATION_PLACE?.trim() || null,
    date: process.env.VERIFACTU_DECLARATION_DATE?.trim() || null,
  }

  const missing: string[] = []
  if (!producer.nombreRazon) missing.push('Razón social del productor')
  if (!producer.nif) missing.push('NIF del productor')
  if (!producer.address) missing.push('Domicilio del productor')
  if (!signature.place || !signature.date) missing.push('Lugar y fecha de la firma')

  // A declaration is only issued when someone has decided it is, and that
  // decision belongs to whoever signs it — never to a default value.
  const issued = process.env.VERIFACTU_DECLARATION_ISSUED === 'true' && missing.length === 0

  return {
    issued,
    system: {
      name: process.env.VERIFACTU_SYSTEM_NAME ?? 'Archivum',
      id: process.env.VERIFACTU_SYSTEM_ID ?? 'AR',
      version: process.env.VERIFACTU_SYSTEM_VERSION ?? '1.0',
      typology:
        'Sistema informático de facturación multi-contribuyente ofrecido como ' +
        'servicio en la nube (SaaS), accesible mediante navegador web y ' +
        'aplicaciones móviles para Android e iOS. Opera exclusivamente en modo ' +
        'VERI*FACTU, remitiendo los registros de facturación a la AEAT.',
      composition: [
        'Aplicación web servida desde infraestructura en la nube (Next.js)',
        'Aplicaciones móviles para Android e iOS (React Native)',
        'Base de datos PostgreSQL gestionada, con seguridad a nivel de fila',
        'Servicio de remisión a la AEAT mediante TLS mutuo con certificado del obligado tributario',
      ],
      functionalities: [
        'Expedición de facturas completas, simplificadas y rectificativas',
        'Generación del registro de facturación de alta en el acto de expedición',
        'Encadenamiento mediante huella SHA-256, con no bifurcación garantizada en base de datos',
        'Inalterabilidad de los registros expedidos, impuesta mediante disparadores de base de datos',
        'Representación gráfica con código QR de cotejo, huella y leyenda VERI*FACTU',
        'Remisión de los registros a la AEAT, con reintento automático y control de flujo',
        'Presupuestos, albaranes, inventario y archivo documental',
      ],
      installation:
        'Instalación única por obligado tributario. Cada organización dada de ' +
        'alta constituye una instalación independiente, identificada por su ' +
        'propio número de instalación en el registro de facturación. El ' +
        'obligado no instala software: accede al servicio y aporta su ' +
        'certificado electrónico, que se conserva cifrado.',
    },
    producer,
    signature,
    missing,
  }
}
