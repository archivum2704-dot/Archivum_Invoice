/**
 * The declaración responsable, as the software has to carry it.
 *
 * Article 13.2 of RD 1007/2023 is a product requirement, not just paperwork:
 * the declaration must appear "por escrito y de modo visible en el propio
 * sistema informático en cada una de sus versiones", and be available to the
 * client and the reseller at the moment of acquisition. A signed PDF in a
 * drawer does not satisfy it.
 *
 * The structure below is the AEAT's own, from «Ejemplos de declaraciones
 * responsables de sistemas informáticos de facturación» (docs/aeat/): twelve
 * numbered sections 1.a to 1.l, plus an annex 2.a to 2.c. It is followed
 * literally, including the wording of each heading, so that whoever reviews or
 * signs this is reading the form the Agency expects and not our paraphrase of
 * it. Example 1 of that document — commercial software, VERI*FACTU only,
 * Spanish producer — is the closest to Archivum, the difference being that
 * Archivum is delivered as a service rather than installed on the client's
 * machines.
 *
 * Until a declaration is actually issued, this reports that it has not been —
 * openly. Section 1.k is the statement of conformity itself, so it is withheld
 * entirely rather than shown as a draft: displaying it would assert a
 * conformity nobody has certified, which is the precise thing the article
 * exists to prevent.
 */

export interface DeclaracionField {
  /** The AEAT's own reference, e.g. "1.d". */
  ref: string
  /** The AEAT's own heading, kept verbatim. */
  label: string
  /** Free text, or a list where the answer is naturally a list. */
  value: string | string[] | null
}

export interface DeclaracionResponsable {
  /** False until the producer has actually issued and signed one. */
  issued: boolean
  /** Sections 1.a to 1.l, in order. */
  fields: DeclaracionField[]
  /** Annex, sections 2.a to 2.c. */
  annex: DeclaracionField[]
  /** The statement of conformity, 1.k — null until the declaration is issued. */
  conformity: string | null
  /** Everything article 13 requires that is not yet in place. */
  missing: string[]
}

/** 1.k, the actual declaration. Withheld until the producer issues it. */
const CONFORMIDAD =
  'La entidad productora del sistema informático a que se refiere esta declaración ' +
  'responsable hace constar que dicho sistema informático, en la versión indicada en ' +
  'ella, cumple con lo dispuesto en el artículo 29.2.j) de la Ley 58/2003, de 17 de ' +
  'diciembre, General Tributaria, en el Reglamento que establece los requisitos que ' +
  'deben adoptar los sistemas y programas informáticos o electrónicos que soporten los ' +
  'procesos de facturación de empresarios y profesionales, y la estandarización de ' +
  'formatos de los registros de facturación, aprobado por el Real Decreto 1007/2023, de ' +
  '5 de diciembre, en la Orden HAC/1177/2024, de 17 de octubre, y en la sede electrónica ' +
  'de la Agencia Estatal de Administración Tributaria para todo aquello que complete las ' +
  'especificaciones de dicha orden.'

export function declaracionResponsable(): DeclaracionResponsable {
  const env = (k: string) => process.env[k]?.trim() || null

  const name = process.env.VERIFACTU_SYSTEM_NAME ?? 'Archivum'
  const id = process.env.VERIFACTU_SYSTEM_ID ?? 'AR'
  const version = process.env.VERIFACTU_SYSTEM_VERSION ?? '1.0'

  const nombreRazon = env('VERIFACTU_PRODUCER_NAME')
  const nif = env('VERIFACTU_PRODUCER_NIF')
  const address = env('VERIFACTU_PRODUCER_ADDRESS')
  const email = env('VERIFACTU_PRODUCER_EMAIL')
  const website = env('VERIFACTU_PRODUCER_WEBSITE')
  const place = env('VERIFACTU_DECLARATION_PLACE')
  const date = env('VERIFACTU_DECLARATION_DATE')

  const missing: string[] = []
  if (!nombreRazon) missing.push('Razón social del productor (1.h)')
  if (!nif) missing.push('NIF del productor (1.i)')
  if (!address) missing.push('Dirección postal del productor (1.j)')
  if (!place || !date) missing.push('Lugar y fecha de la firma (1.l)')

  // A declaration is only issued when someone has decided it is, and that
  // decision belongs to whoever signs it — never to a default value.
  const issued = process.env.VERIFACTU_DECLARATION_ISSUED === 'true' && missing.length === 0

  const fields: DeclaracionField[] = [
    {
      ref: '1.a',
      label: 'Nombre del sistema informático a que se refiere esta declaración responsable',
      value: name,
    },
    {
      ref: '1.b',
      label: 'Código identificador del sistema informático a que se refiere el apartado a) de esta declaración responsable',
      value: id,
    },
    {
      ref: '1.c',
      label: 'Identificador completo de la versión concreta del sistema informático a que se refiere esta declaración responsable',
      value: version,
    },
    {
      ref: '1.d',
      label: 'Componentes, hardware y software, de que consta el sistema informático, junto con una breve descripción de lo que hace y de sus principales funcionalidades',
      value: [
        'Se trata de un sistema informático de facturación ofrecido como servicio en la nube ' +
        '(SaaS). El obligado tributario no instala ningún software: accede mediante navegador ' +
        'web o mediante las aplicaciones móviles para Android e iOS. Toda la generación de ' +
        'registros de facturación, el cálculo de la huella y la remisión a la Agencia ' +
        'Tributaria se ejecutan en el servidor; las aplicaciones cliente no pueden generar, ' +
        'alterar ni suprimir un registro.',
        'Componentes: aplicación web (Next.js) servida desde infraestructura en la nube; ' +
        'aplicaciones móviles (React Native) para Android e iOS; base de datos PostgreSQL ' +
        'gestionada, con seguridad a nivel de fila; y un servicio de remisión a la AEAT por ' +
        'servicio web SOAP con autenticación TLS mutua mediante el certificado electrónico ' +
        'del propio obligado tributario.',
        'Funcionalidades principales: expedición de facturas completas, simplificadas y ' +
        'rectificativas; generación del registro de facturación de alta en el mismo acto de ' +
        'expedición; registro de facturación de anulación; encadenamiento mediante huella ' +
        'SHA-256 con no bifurcación garantizada por la base de datos; inalterabilidad de los ' +
        'registros expedidos impuesta mediante disparadores de base de datos; registro de ' +
        'eventos consultable desde el propio sistema; detección de anomalías de integridad y ' +
        'trazabilidad; exportación de los registros; representación gráfica con código QR de ' +
        'cotejo y leyenda VERI*FACTU; y remisión a la AEAT con reintento automático y ' +
        'control de flujo.',
        'El sistema incluye además funcionalidades de gestión no reguladas por el ' +
        'Reglamento: pedidos, albaranes, inventario y archivo documental.',
        'Este sistema permite gestionar de forma independiente varias facturaciones dentro ' +
        'de él, cumpliendo separadamente con la normativa mencionada en el apartado 1.k) ' +
        'para cada una de ellas, como si, en la práctica, se tratara de sistemas ' +
        'informáticos de facturación distintos.',
      ],
    },
    {
      ref: '1.e',
      label: 'Indicación de si el sistema informático se ha producido de tal manera que, a los efectos de cumplir con el Reglamento, solo pueda funcionar exclusivamente como «VERI*FACTU»',
      value: 'S - Sí',
    },
    {
      ref: '1.f',
      label: 'Indicación de si el sistema informático permite ser usado por varios obligados tributarios o por un mismo usuario para dar soporte a la facturación de varios obligados tributarios',
      value: 'S - Sí',
    },
    {
      ref: '1.g',
      label: 'Tipos de firma utilizados para firmar los registros de facturación y de evento en el caso de que el sistema informático no sea utilizado como «VERI*FACTU»',
      value:
        'Dado que se trata de un sistema de facturación que solo puede ser utilizado ' +
        'exclusivamente en la modalidad de «VERI*FACTU», no se realiza una firma electrónica ' +
        'expresa de los registros de facturación generados, ya que la normativa considera que ' +
        'quedan firmados al ser remitidos correctamente a los servicios electrónicos de la ' +
        'Agencia Tributaria con la debida autenticación mediante el adecuado certificado ' +
        'electrónico cualificado.',
    },
    {
      ref: '1.h',
      label: 'Razón social de la entidad productora del sistema informático',
      value: nombreRazon,
    },
    {
      ref: '1.i',
      label: 'Número de identificación fiscal (NIF) español de la entidad productora del sistema informático',
      value: nif,
    },
    {
      ref: '1.j',
      label: 'Dirección postal completa de contacto de la entidad productora del sistema informático',
      value: address,
    },
    {
      ref: '1.k',
      label: 'Declaración de cumplimiento',
      // Withheld until issued: this sentence is the declaration itself.
      value: issued ? CONFORMIDAD : null,
    },
    {
      ref: '1.l',
      label: 'Fecha y lugar en que la entidad productora suscribe esta declaración responsable',
      value: place && date ? `${date} · ${place}` : null,
    },
  ]

  const annex: DeclaracionField[] = [
    {
      ref: '2.a',
      label: 'Otras formas de contacto con la entidad productora del sistema informático',
      value: email ? `Correo electrónico: ${email}` : null,
    },
    {
      ref: '2.b',
      label: 'Direcciones de internet de la entidad productora del sistema informático',
      value: website
        ? [`Sitio web: ${website}`, `Histórico de declaraciones responsables: ${website.replace(/\/$/, '')}/declaracion-responsable/historico`]
        : null,
    },
    {
      ref: '2.c',
      label: 'Manera en que el sistema informático cumple las especificaciones técnicas y funcionales de la Orden HAC/1177/2024 y de la sede electrónica de la AEAT',
      value: [
        'Además de lo que es de obligado cumplimiento en ciertos casos (como el algoritmo de ' +
        'huella a emplear, SHA-256), otras implementaciones utilizadas son:',
        'Empleo de la tecnología transaccional del sistema gestor de base de datos para ' +
        'lograr la consolidación, en una sola unidad transaccional, de la expedición de la ' +
        'factura y la generación del registro de facturación correspondiente.',
        'La no bifurcación de la cadena de huellas no se confía a la lógica de la aplicación: ' +
        'está impuesta por un índice único en la base de datos, de modo que dos registros no ' +
        'pueden declarar el mismo predecesor aunque se expidan de forma concurrente.',
        'La inalterabilidad de los registros expedidos se impone mediante disparadores de ' +
        'base de datos, por lo que afecta por igual al acceso desde la aplicación y al acceso ' +
        'directo a su interfaz de datos.',
        'La huella se ha contrastado con los ejemplos oficiales publicados por la Agencia ' +
        'Tributaria en el documento de especificaciones técnicas para su generación, y esa ' +
        'comprobación se ejecuta automáticamente en cada modificación del sistema.',
      ],
    },
  ]

  return { issued, fields, annex, conformity: issued ? CONFORMIDAD : null, missing }
}
