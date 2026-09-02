import { Lock } from 'lucide-react'
import { LegalDocument, type LegalArticle } from '@/components/legal-document'

export const metadata = {
  title: 'Política de privacidad · Archivum',
  description: 'Política de privacidad de Archivum.',
}

const CONTACT_EMAIL = 'facturas@archivum.es'

const intro: LegalArticle['blocks'] = [
  { type: 'p', text: 'En ARCHIVUM.VV, S.C. nos comprometemos a proteger la privacidad y la seguridad de los datos personales de las personas que utilizan nuestra página web y nuestra aplicación ARCHIVUM.' },
  { type: 'p', text: 'La presente Política de Privacidad tiene por objeto informar de manera clara y transparente sobre cómo recopilamos, utilizamos, conservamos y protegemos los datos personales, así como sobre los derechos que pueden ejercer sus titulares.' },
]

const articles: LegalArticle[] = [
  {
    heading: '1. Responsable del tratamiento',
    blocks: [
      {
        type: 'list',
        items: [
          'Responsable: ARCHIVUM.VV, S.C.',
          'NIF: J93941003',
          'Domicilio: C/ Bajada al Molino, 10 - 3.º A (09400 Aranda de Duero — Burgos — España)',
          `Correo electrónico: ${CONTACT_EMAIL}`,
          'Sitio web: www.archivum.es',
        ],
      },
    ],
  },
  {
    heading: '2. ¿Qué datos personales tratamos?',
    blocks: [
      { type: 'p', text: 'Dependiendo de la relación que mantenga con nosotros y del uso que haga de nuestros servicios, podemos tratar diferentes categorías de datos personales, entre ellas:' },
      {
        type: 'list',
        items: [
          'Datos identificativos: nombre y apellidos, documento identificativo, firma, etc.',
          'Datos de contacto: dirección de correo electrónico, teléfono, dirección postal.',
          'Datos profesionales o empresariales: empresa, cargo, departamento, actividad profesional y datos de contacto profesional.',
          'Datos necesarios para la gestión de clientes y usuarios de ARCHIVUM.',
          'Datos relacionados con la facturación, contratación y prestación de servicios.',
          'Datos incluidos en los documentos que el usuario almacene o gestione mediante ARCHIVUM.',
          'Datos técnicos necesarios para el funcionamiento y seguridad de la plataforma, como dirección IP, identificadores de usuario, información del dispositivo y registros de actividad.',
          'Datos relacionados con las preferencias y configuración del servicio.',
        ],
      },
      { type: 'p', text: 'ARCHIVUM puede ser utilizado por empresas para almacenar y gestionar documentos que contengan datos personales de terceros, como clientes, proveedores, empleados u otras personas relacionadas con su actividad.' },
      { type: 'p', text: 'En estos casos, el contenido de dichos documentos será tratado conforme a las instrucciones y bajo la responsabilidad de la empresa usuaria, en los términos establecidos en la normativa de protección de datos.' },
    ],
  },
  {
    heading: '3. ¿Con qué finalidad utilizamos los datos?',
    blocks: [
      { type: 'p', text: 'Los datos personales podrán ser tratados para las siguientes finalidades:' },
      { type: 'p', text: 'a) Prestación de los servicios de ARCHIVUM — Gestionar el registro de usuarios, proporcionar acceso a la aplicación, mantener las cuentas y prestar las funcionalidades contratadas.' },
      { type: 'p', text: 'b) Gestión de la relación contractual — Gestionar altas, contratación, facturación, pagos, soporte y demás actuaciones necesarias para mantener la relación con nuestros clientes y usuarios.' },
      { type: 'p', text: 'c) Gestión documental — Permitir el almacenamiento, organización, consulta y gestión de los documentos incorporados a ARCHIVUM por los usuarios.' },
      { type: 'p', text: 'd) Gestión empresarial y de facturación — Permitir la utilización de las funcionalidades de gestión comercial, pedidos, albaranes, facturación, inventario y demás procesos empresariales incluidos en ARCHIVUM.' },
      { type: 'p', text: 'e) Seguridad — Prevenir usos fraudulentos o no autorizados, detectar incidentes, proteger la infraestructura tecnológica y garantizar la seguridad y disponibilidad del servicio.' },
      { type: 'p', text: 'f) Atención de consultas y solicitudes — Gestionar las consultas, solicitudes de información, incidencias y comunicaciones realizadas por los usuarios o personas interesadas.' },
      { type: 'p', text: 'g) Cumplimiento de obligaciones legales — Cumplir las obligaciones legales, fiscales, contables, administrativas y regulatorias que resulten aplicables a ARCHIVUM.VV, S.C.' },
      { type: 'p', text: 'h) Comunicaciones comerciales — Cuando el usuario haya prestado su consentimiento o exista otra base jurídica que lo permita, podremos enviar información sobre nuestros productos, servicios, novedades y funcionalidades.' },
      { type: 'p', text: 'El usuario podrá oponerse en cualquier momento al envío de comunicaciones comerciales.' },
    ],
  },
  {
    heading: '4. Base jurídica del tratamiento',
    blocks: [
      { type: 'p', text: 'Las bases jurídicas que pueden legitimar los tratamientos realizados son, según corresponda:' },
      {
        type: 'list',
        items: [
          'Ejecución de un contrato: cuando el tratamiento sea necesario para prestar los servicios contratados o gestionar la relación contractual.',
          'Cumplimiento de obligaciones legales: cuando el tratamiento sea necesario para cumplir una obligación establecida por la legislación aplicable.',
          'Consentimiento: cuando se haya solicitado y obtenido el consentimiento del interesado.',
          'Interés legítimo: cuando el tratamiento sea necesario para proteger nuestros intereses legítimos, siempre respetando los derechos y libertades de las personas afectadas.',
        ],
      },
      { type: 'p', text: 'Cuando el tratamiento se base en el consentimiento, el interesado podrá retirarlo en cualquier momento. La retirada del consentimiento no afectará a la licitud de los tratamientos realizados con anterioridad.' },
    ],
  },
  {
    heading: '5. ARCHIVUM como plataforma para empresas',
    blocks: [
      { type: 'p', text: 'ARCHIVUM es una herramienta destinada principalmente a empresas y profesionales.' },
      { type: 'p', text: 'Cuando una empresa utiliza ARCHIVUM para almacenar o gestionar datos personales de sus clientes, proveedores, empleados u otras personas, la empresa usuaria será, con carácter general, la responsable del tratamiento de dichos datos, mientras que ARCHIVUM.VV, S.C. podrá actuar como encargado del tratamiento, cuando corresponda.' },
      { type: 'p', text: 'En estos casos, ARCHIVUM.VV, S.C. tratará los datos personales únicamente siguiendo las instrucciones documentadas del cliente y de conformidad con el correspondiente contrato de encargo de tratamiento, cuando resulte aplicable.' },
      { type: 'p', text: 'La empresa usuaria será responsable de determinar las finalidades y los medios del tratamiento, así como de garantizar que dispone de una base jurídica adecuada y que proporciona a los interesados la información exigida por la normativa.' },
    ],
  },
  {
    heading: '6. Encargados del tratamiento y proveedores',
    blocks: [
      { type: 'p', text: 'Para poder prestar los servicios de ARCHIVUM podemos contar con proveedores tecnológicos y otros colaboradores que necesiten acceder a determinados datos personales para prestar los servicios contratados.' },
      { type: 'p', text: 'Estos proveedores actuarán, cuando corresponda, como encargados del tratamiento y estarán sujetos a las obligaciones de confidencialidad, seguridad y protección de datos establecidas en la normativa aplicable.' },
      { type: 'p', text: 'Entre los proveedores podrán encontrarse servicios de:' },
      {
        type: 'list',
        items: [
          'alojamiento y almacenamiento de información;',
          'infraestructura y servicios en la nube;',
          'mantenimiento y soporte técnico;',
          'comunicaciones electrónicas;',
          'copias de seguridad;',
          'seguridad informática;',
          'servicios de facturación y pago;',
          'servicios necesarios para la prestación de las funcionalidades de ARCHIVUM.',
        ],
      },
      { type: 'p', text: 'No autorizamos a nuestros proveedores a utilizar los datos personales para fines propios incompatibles con los servicios contratados.' },
    ],
  },
  {
    heading: '7. Transferencias internacionales',
    blocks: [
      { type: 'p', text: 'Con carácter general, procuraremos que los datos personales sean tratados dentro del Espacio Económico Europeo.' },
      { type: 'p', text: 'Cuando sea necesario utilizar proveedores que impliquen una transferencia internacional de datos fuera del Espacio Económico Europeo, adoptaremos las garantías exigidas por la normativa aplicable, incluyendo, cuando corresponda, decisiones de adecuación, cláusulas contractuales tipo u otros mecanismos legalmente reconocidos.' },
      { type: 'p', text: `Puede solicitar información adicional sobre las garantías aplicables a las transferencias internacionales contactando con nosotros a través de ${CONTACT_EMAIL}.` },
    ],
  },
  {
    heading: '8. Conservación de los datos',
    blocks: [
      { type: 'p', text: 'Conservaremos los datos personales durante el tiempo necesario para cumplir las finalidades para las que fueron recopilados.' },
      { type: 'p', text: 'Cuando exista una relación contractual, los datos se conservarán mientras dicha relación permanezca vigente y, posteriormente, durante los períodos necesarios para atender las posibles responsabilidades legales derivadas de la relación.' },
      { type: 'p', text: 'Los datos sujetos a obligaciones legales de conservación se mantendrán durante los plazos establecidos por la legislación correspondiente.' },
      { type: 'p', text: 'Una vez finalizados dichos períodos, los datos serán eliminados o, cuando proceda, anonimizados.' },
      { type: 'p', text: 'En el caso de los documentos y datos almacenados por una empresa usuaria de ARCHIVUM, los períodos de conservación dependerán también de las instrucciones del cliente y de las obligaciones legales que le resulten aplicables.' },
    ],
  },
  {
    heading: '9. Seguridad de los datos',
    blocks: [
      { type: 'p', text: 'ARCHIVUM.VV, S.C. aplica medidas técnicas y organizativas destinadas a garantizar un nivel de seguridad adecuado al riesgo del tratamiento.' },
      { type: 'p', text: 'Entre otras medidas, podrán incluirse:' },
      {
        type: 'list',
        items: [
          'control de acceso a los sistemas;',
          'gestión de usuarios y permisos;',
          'mecanismos de autenticación;',
          'cifrado de las comunicaciones;',
          'medidas de protección de la infraestructura;',
          'copias de seguridad;',
          'registro y supervisión de determinadas actividades;',
          'medidas destinadas a prevenir accesos no autorizados;',
          'procedimientos de gestión de incidentes de seguridad.',
        ],
      },
      { type: 'p', text: 'Las medidas de seguridad se revisan y actualizan periódicamente atendiendo a la evolución tecnológica, los riesgos existentes y las características de los servicios prestados.' },
    ],
  },
  {
    heading: '10. Confidencialidad',
    blocks: [
      { type: 'p', text: 'Las personas que intervienen en el tratamiento de datos personales están sujetas al correspondiente deber de confidencialidad y sólo podrán acceder a la información cuando resulte necesario para el desempeño de sus funciones.' },
      { type: 'p', text: 'Los usuarios de ARCHIVUM serán responsables de mantener la confidencialidad de sus credenciales de acceso y de utilizar la aplicación de acuerdo con las condiciones de seguridad establecidas.' },
    ],
  },
  {
    heading: '11. Derechos de las personas interesadas',
    blocks: [
      { type: 'p', text: 'Las personas cuyos datos personales sean objeto de tratamiento pueden ejercer, cuando resulte aplicable, los siguientes derechos:' },
      {
        type: 'list',
        items: [
          'Acceso: conocer qué datos personales tratamos y obtener una copia de los mismos.',
          'Rectificación: solicitar la corrección de datos inexactos o incompletos.',
          'Supresión: solicitar la eliminación de sus datos cuando proceda legalmente.',
          'Oposición: oponerse a determinados tratamientos.',
          'Limitación: solicitar la limitación del tratamiento en los casos previstos legalmente.',
          'Portabilidad: recibir determinados datos en un formato estructurado, de uso común y lectura mecánica, o solicitar su transmisión a otro responsable cuando sea técnicamente posible y proceda legalmente.',
          'Retirada del consentimiento: retirar el consentimiento previamente otorgado cuando el tratamiento se base en dicho consentimiento.',
        ],
      },
      { type: 'p', text: `Para ejercer estos derechos puede enviarse una solicitud a ${CONTACT_EMAIL}.` },
      { type: 'p', text: 'La solicitud deberá permitir identificar razonablemente al solicitante y especificar el derecho que desea ejercer.' },
      { type: 'p', text: 'Cuando existan dudas razonables sobre la identidad del solicitante, podremos solicitar información adicional necesaria para verificarla.' },
      { type: 'p', text: 'El ejercicio de estos derechos es gratuito, salvo que las solicitudes sean manifiestamente infundadas o excesivas en los términos previstos por la normativa.' },
    ],
  },
  {
    heading: '12. Reclamaciones ante la autoridad de control',
    blocks: [
      { type: 'p', text: 'Si una persona considera que el tratamiento de sus datos personales no se ajusta a la normativa aplicable, puede presentar una reclamación ante la autoridad de protección de datos competente.' },
      { type: 'p', text: 'En España, la autoridad de control es la Agencia Española de Protección de Datos (AEPD).' },
    ],
  },
  {
    heading: '13. Datos de menores',
    blocks: [
      { type: 'p', text: 'Nuestros servicios profesionales no están dirigidos específicamente a menores de edad.' },
      { type: 'p', text: 'No recopilamos deliberadamente datos personales de menores para finalidades que no sean necesarias para la prestación de los servicios.' },
      { type: 'p', text: 'Si consideramos que se han obtenido datos de un menor de forma indebida, adoptaremos las medidas razonables para proceder a su eliminación cuando corresponda.' },
    ],
  },
  {
    heading: '14. Cookies',
    blocks: [
      { type: 'p', text: 'Nuestra página web puede utilizar cookies y tecnologías similares.' },
      { type: 'p', text: 'La información relativa a las cookies utilizadas, su finalidad, duración y forma de gestión se recoge en nuestra Política de Cookies.' },
      { type: 'p', text: 'Cuando sea necesario obtener el consentimiento del usuario para determinadas cookies, estas no se instalarán hasta que dicho consentimiento haya sido obtenido, salvo aquellas que estén exceptuadas conforme a la normativa aplicable.' },
    ],
  },
  {
    heading: '15. Modificaciones de la Política de Privacidad',
    blocks: [
      { type: 'p', text: 'ARCHIVUM.VV, S.C. podrá modificar esta Política de Privacidad cuando sea necesario para adaptarla a cambios legislativos, jurisprudenciales, tecnológicos o relacionados con nuestros servicios.' },
      { type: 'p', text: 'La versión actualizada estará disponible permanentemente en esta página, indicando la fecha de su última actualización.' },
      { type: 'p', text: 'Recomendamos consultar periódicamente esta Política de Privacidad para conocer cualquier modificación relevante.' },
    ],
  },
  {
    heading: '16. Legislación aplicable',
    blocks: [
      { type: 'p', text: 'La presente Política de Privacidad se regirá por la normativa española y europea aplicable en materia de protección de datos personales, incluyendo, entre otras disposiciones:' },
      {
        type: 'list',
        items: [
          'Reglamento (UE) 2016/679, de 27 de abril de 2016 (Reglamento General de Protección de Datos — RGPD).',
          'Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales.',
          'Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y del Comercio Electrónico, cuando resulte aplicable.',
          'Demás normativa vigente que resulte aplicable al tratamiento de datos personales.',
        ],
      },
    ],
  },
]

const footer: LegalArticle['blocks'] = [
  { type: 'p', text: 'ARCHIVUM.VV, S.C.' },
  { type: 'p', text: 'NIF: J93941003' },
  { type: 'p', text: 'Domicilio: C/ Bajada al Molino, 10 - 3.º A' },
  { type: 'p', text: `Correo electrónico: ${CONTACT_EMAIL}` },
  { type: 'p', text: 'Última actualización: 1 de septiembre de 2026' },
]

export default function PrivacidadPage() {
  return (
    <LegalDocument
      icon={Lock}
      title="Política de privacidad"
      subtitle="RGPD y LOPDGDD"
      lastUpdated="1 de septiembre de 2026"
      intro={intro}
      articles={articles}
      footer={footer}
    />
  )
}
