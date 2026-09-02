import { FileText } from 'lucide-react'
import { LegalDocument, type LegalArticle } from '@/components/legal-document'

export const metadata = {
  title: 'Términos y condiciones · Archivum',
  description: 'Términos y condiciones de uso de Archivum.',
}

const CONTACT_EMAIL = 'facturas@archivum.es'

const articles: LegalArticle[] = [
  {
    heading: '1. Identificación del titular',
    blocks: [
      { type: 'p', text: 'Los presentes Términos y Condiciones regulan el acceso y el uso del sitio web www.archivum.es, de la aplicación web y de los servicios ofrecidos bajo la denominación ARCHIVUM.' },
      { type: 'p', text: 'El titular y prestador del servicio es:' },
      {
        type: 'list',
        items: [
          'Titular: ARCHIVUM.VV, S.C.',
          'NIF: J93941003',
          'Domicilio: C/ Bajada al Molino, 10 - 3.º A, 09400 Aranda de Duero (Burgos, España)',
          `Correo electrónico: ${CONTACT_EMAIL}`,
          'Sitio web: www.archivum.es',
        ],
      },
      { type: 'p', text: 'Estos Términos se complementan con la Política de Privacidad, la Política de Cookies y, en su caso, las condiciones particulares aplicables a determinados planes, funcionalidades o servicios.' },
    ],
  },
  {
    heading: '2. Objeto de ARCHIVUM',
    blocks: [
      { type: 'p', text: 'ARCHIVUM es una plataforma digital destinada a facilitar la organización, gestión, conservación, consulta y tratamiento de archivos, documentos, información y contenidos digitales aportados o gestionados por sus usuarios.' },
      { type: 'p', text: 'Las funcionalidades concretas disponibles dependerán del plan contratado, de la modalidad de acceso y de la evolución del servicio. ARCHIVUM podrá incorporar, modificar o retirar funcionalidades conforme a lo previsto en estos Términos.' },
      { type: 'p', text: 'Salvo que se indique expresamente lo contrario, ARCHIVUM proporciona una herramienta tecnológica y no presta servicios de asesoramiento jurídico, fiscal, contable, archivístico profesional ni de certificación documental.' },
    ],
  },
  {
    heading: '3. Ámbito de aplicación y aceptación',
    blocks: [
      { type: 'p', text: 'Estos Términos son aplicables a todas las personas que accedan a ARCHIVUM, creen una cuenta o utilicen sus servicios.' },
      { type: 'p', text: 'El acceso meramente informativo al sitio web implica el cumplimiento de las disposiciones aplicables a la navegación. La creación de una cuenta o la contratación de un servicio requerirá la aceptación expresa de estos Términos mediante el mecanismo habilitado para ello.' },
      { type: 'p', text: 'Al aceptar los Términos, el usuario declara:' },
      {
        type: 'list',
        items: [
          'haberlos leído y comprendido;',
          'tener capacidad legal suficiente para contratar;',
          'facilitar información veraz y actualizada;',
          'y aceptar quedar vinculado por su contenido.',
        ],
      },
      { type: 'p', text: 'Si el usuario actúa en nombre de una empresa, asociación, comunidad, organismo u otra entidad, declara disponer de facultades suficientes para vincularla.' },
    ],
  },
  {
    heading: '4. Requisitos de edad y capacidad',
    blocks: [
      { type: 'p', text: 'Solo podrán crear una cuenta y contratar los servicios las personas mayores de 18 años con capacidad legal suficiente.' },
      { type: 'p', text: 'Las personas menores de edad no podrán registrarse ni contratar directamente los servicios. Cuando ARCHIVUM tenga conocimiento razonable de que una cuenta pertenece a una persona que no cumple estos requisitos, podrá suspenderla hasta verificar la edad, la capacidad o la correspondiente representación legal.' },
    ],
  },
  {
    heading: '5. Registro y cuenta de usuario',
    blocks: [
      { type: 'p', text: 'Para acceder a determinadas funcionalidades será necesario crear una cuenta y proporcionar la información solicitada durante el proceso de registro.' },
      { type: 'p', text: 'El usuario se compromete a:' },
      {
        type: 'list',
        items: [
          'proporcionar datos exactos, completos y actualizados;',
          'mantener actualizada la información de su cuenta;',
          'custodiar sus credenciales de acceso;',
          'utilizar contraseñas suficientemente seguras;',
          'no compartir su cuenta con personas no autorizadas;',
          'y comunicar inmediatamente cualquier acceso, uso o incidente de seguridad no autorizado.',
        ],
      },
      { type: 'p', text: 'La cuenta es personal, salvo que el plan contratado permita expresamente cuentas de equipo, colaboradores o distintos perfiles de acceso.' },
      { type: 'p', text: 'El usuario será responsable de la actividad realizada desde su cuenta cuando esta derive del incumplimiento de sus deberes de custodia o de una actuación imputable al propio usuario. Esta previsión no limitará la responsabilidad de ARCHIVUM cuando el incidente sea atribuible al servicio.' },
      { type: 'p', text: 'ARCHIVUM podrá solicitar medidas razonables de verificación cuando detecte indicios de suplantación, fraude, acceso indebido o riesgo para la seguridad.' },
    ],
  },
  {
    heading: '6. Organizaciones, equipos y usuarios autorizados',
    blocks: [
      { type: 'p', text: 'Cuando una cuenta se utilice por una organización o permita incorporar a varias personas, el titular o administrador de la cuenta será responsable de gestionar los permisos y autorizaciones correspondientes.' },
      { type: 'p', text: 'El administrador deberá asegurarse de que los usuarios invitados:' },
      {
        type: 'list',
        items: [
          'están autorizados para acceder a la información compartida;',
          'conocen y respetan estos Términos;',
          'disponen únicamente de los permisos necesarios;',
          'y dejan de tener acceso cuando finalice su relación con la organización.',
        ],
      },
      { type: 'p', text: 'La organización será responsable de determinar qué personas pueden acceder a sus espacios, archivos y documentos, sin perjuicio de las obligaciones de seguridad que correspondan a ARCHIVUM.' },
    ],
  },
  {
    heading: '7. Uso permitido del servicio',
    blocks: [
      { type: 'p', text: 'El usuario deberá utilizar ARCHIVUM de forma diligente, lícita y conforme a estos Términos, a la buena fe y a la normativa aplicable.' },
      { type: 'p', text: 'El usuario podrá utilizar el servicio para almacenar, organizar, consultar y gestionar contenidos sobre los que tenga derechos o autorización suficiente.' },
      { type: 'p', text: 'No está permitido:' },
      {
        type: 'list',
        items: [
          'utilizar ARCHIVUM para fines ilícitos, fraudulentos o engañosos;',
          'introducir programas maliciosos, virus o código destinado a alterar el servicio;',
          'intentar acceder sin autorización a cuentas, sistemas, datos o áreas restringidas;',
          'eludir medidas de seguridad o límites técnicos;',
          'realizar pruebas de vulnerabilidad sin autorización previa y escrita;',
          'interferir en el funcionamiento o disponibilidad de la plataforma;',
          'utilizar sistemas automatizados de extracción masiva de información sin autorización;',
          'revender, sublicenciar o explotar comercialmente el servicio fuera de las modalidades permitidas;',
          'suplantar la identidad de otras personas o entidades;',
          'almacenar o difundir contenidos que vulneren derechos de terceros;',
          'o utilizar el servicio de forma que pueda causar daños a ARCHIVUM, a otros usuarios o a terceros.',
        ],
      },
      { type: 'p', text: 'ARCHIVUM podrá adoptar medidas proporcionadas para prevenir, investigar o detener estos usos, incluida la limitación o suspensión de una cuenta cuando resulte necesario.' },
    ],
  },
  {
    heading: '8. Contenidos aportados por el usuario',
    blocks: [
      { type: 'p', text: 'El usuario conserva la titularidad y los derechos que le correspondan sobre los archivos, documentos, datos, textos, imágenes y demás contenidos que incorpore a ARCHIVUM.' },
      { type: 'p', text: 'El usuario concede a ARCHIVUM una autorización limitada, no exclusiva y durante el tiempo necesario para alojar, copiar, procesar, transmitir y mostrar esos contenidos exclusivamente con el fin de prestar, mantener, proteger y mejorar técnicamente el servicio contratado. Esta autorización no permite a ARCHIVUM vender los contenidos ni utilizarlos con fines publicitarios ajenos a la prestación del servicio.' },
      { type: 'p', text: 'El usuario declara que:' },
      {
        type: 'list',
        items: [
          'dispone de los derechos o autorizaciones necesarios sobre los contenidos;',
          'su incorporación y tratamiento mediante ARCHIVUM son lícitos;',
          'los contenidos no infringen derechos de propiedad intelectual, privacidad, honor, imagen, secreto o confidencialidad;',
          'y cumple las obligaciones de información y legitimación que le correspondan respecto de los datos personales de terceros.',
        ],
      },
      { type: 'p', text: 'ARCHIVUM no adquiere la propiedad de los contenidos del usuario por el hecho de alojarlos o tratarlos para prestar el servicio.' },
    ],
  },
  {
    heading: '9. Contenidos prohibidos',
    blocks: [
      { type: 'p', text: 'No podrán utilizarse los servicios para almacenar, gestionar o difundir contenidos:' },
      {
        type: 'list',
        items: [
          'manifiestamente ilícitos;',
          'que promuevan delitos o instrucciones destinadas a cometerlos;',
          'que vulneren derechos de propiedad intelectual o industrial;',
          'obtenidos o divulgados infringiendo obligaciones de confidencialidad;',
          'que contengan programas maliciosos;',
          'que vulneren los derechos fundamentales de otras personas;',
          'o cuya posesión, tratamiento o difusión estén prohibidos por la legislación aplicable.',
        ],
      },
      { type: 'p', text: 'La existencia de contenidos especialmente protegidos o sujetos a obligaciones sectoriales deberá comunicarse a ARCHIVUM antes de contratar cuando pueda requerir garantías, funcionalidades o condiciones específicas.' },
      { type: 'p', text: 'ARCHIVUM podrá retirar o bloquear contenidos cuando exista una obligación legal, una resolución de autoridad competente o indicios suficientemente fundados de una infracción grave, procurando adoptar una medida proporcionada y notificándola cuando legalmente sea posible.' },
    ],
  },
  {
    heading: '10. Protección de datos personales',
    blocks: [
      { type: 'p', text: 'El tratamiento de los datos personales relacionados con la cuenta, la contratación, la seguridad y el uso del servicio se regula en la Política de Privacidad, disponible en:' },
      { type: 'p', text: 'https://www.archivum.es/privacidad' },
      { type: 'p', text: 'Cuando el usuario incorpore a ARCHIVUM datos personales respecto de los cuales actúe como responsable del tratamiento y ARCHIVUM deba tratarlos por cuenta de aquel para prestar el servicio, ambas partes formalizarán, cuando resulte necesario, el correspondiente acuerdo de encargo del tratamiento.' },
      { type: 'p', text: 'En tal caso, el usuario será responsable de:' },
      {
        type: 'list',
        items: [
          'disponer de una base jurídica válida;',
          'facilitar la información exigida a las personas afectadas;',
          'atender el ejercicio de sus derechos;',
          'determinar los plazos de conservación;',
          'y dar instrucciones lícitas y documentadas a ARCHIVUM.',
        ],
      },
      { type: 'p', text: 'ARCHIVUM tratará dichos datos de acuerdo con las instrucciones documentadas del usuario, las medidas de seguridad aplicables y el acuerdo de encargo formalizado entre las partes.' },
    ],
  },
  {
    heading: '11. Confidencialidad y seguridad',
    blocks: [
      { type: 'p', text: 'ARCHIVUM aplicará medidas técnicas y organizativas razonables y proporcionadas a los riesgos asociados al servicio para proteger la confidencialidad, integridad y disponibilidad de la información.' },
      { type: 'p', text: 'No obstante, ningún sistema conectado a internet puede garantizar una seguridad o disponibilidad absoluta. El usuario deberá mantener sus propios dispositivos, sistemas, credenciales y copias bajo medidas de seguridad adecuadas.' },
      { type: 'p', text: 'Cada parte mantendrá la confidencialidad de la información de la otra a la que acceda como consecuencia de la relación contractual y que, por su naturaleza o por indicación expresa, deba considerarse confidencial.' },
      { type: 'p', text: 'Esta obligación no se aplicará a información que:' },
      {
        type: 'list',
        items: [
          'sea pública sin incumplimiento de estos Términos;',
          'ya fuera conocida legítimamente por la parte receptora;',
          'haya sido obtenida legítimamente de un tercero;',
          'deba comunicarse por obligación legal o requerimiento de una autoridad;',
          'o haya sido desarrollada de forma independiente.',
        ],
      },
    ],
  },
  {
    heading: '12. Copias, conservación y exportación',
    blocks: [
      { type: 'p', text: 'ARCHIVUM podrá aplicar medidas de respaldo, redundancia y recuperación para mantener la continuidad del servicio. Estas medidas no sustituyen necesariamente una estrategia de copia de seguridad independiente del usuario.' },
      { type: 'p', text: 'Cuando el plan lo permita, el usuario podrá exportar sus contenidos mediante las funcionalidades disponibles. Los formatos, límites y procedimientos de exportación dependerán del plan contratado y de la naturaleza de la información.' },
      { type: 'p', text: 'El usuario es responsable de conservar copias independientes cuando la pérdida temporal o definitiva de sus contenidos pueda ocasionarle un perjuicio significativo o cuando exista una obligación legal de conservación.' },
      { type: 'p', text: 'ARCHIVUM no garantiza que el servicio otorgue por sí solo valor probatorio, autenticidad certificada, sellado de tiempo, conservación electrónica cualificada o cumplimiento de requisitos archivísticos sectoriales, salvo que una funcionalidad o condición particular lo establezca expresamente.' },
    ],
  },
  {
    heading: '13. Disponibilidad, mantenimiento y modificaciones técnicas',
    blocks: [
      { type: 'p', text: 'ARCHIVUM procurará mantener el servicio disponible y operativo, pero podrá experimentar interrupciones por mantenimiento, actualizaciones, incidencias técnicas, fallos de proveedores, causas de fuerza mayor o circunstancias ajenas a su control razonable.' },
      { type: 'p', text: 'Cuando sea posible, los mantenimientos programados que puedan afectar sustancialmente al servicio se comunicarán con antelación razonable.' },
      { type: 'p', text: 'ARCHIVUM podrá modificar la infraestructura, el diseño y las funcionalidades para:' },
      {
        type: 'list',
        items: [
          'mejorar el servicio;',
          'corregir errores;',
          'reforzar la seguridad;',
          'adaptarse a cambios técnicos o legales;',
          'prevenir abusos;',
          'o incorporar nuevas prestaciones.',
        ],
      },
      { type: 'p', text: 'Si una modificación reduce de forma sustancial una funcionalidad esencial de un plan de pago vigente, se informará al usuario con antelación razonable y se reconocerán los derechos que correspondan conforme al contrato y a la normativa aplicable.' },
    ],
  },
  {
    heading: '14. Planes, precios e impuestos',
    blocks: [
      { type: 'p', text: 'ARCHIVUM podrá ofrecer planes gratuitos, de prueba o de pago, cuyas características, límites, duración y precios se mostrarán antes de la contratación.' },
      { type: 'p', text: 'Los precios se expresarán en euros e indicarán si incluyen o no los impuestos aplicables. Antes de confirmar la contratación se mostrará el importe total y la periodicidad del cobro.' },
      { type: 'p', text: 'Las promociones, descuentos o periodos de prueba podrán estar sujetos a condiciones específicas. Salvo indicación contraria, no serán acumulables ni canjeables por dinero.' },
      { type: 'p', text: 'ARCHIVUM podrá modificar los precios para periodos futuros. Los cambios no se aplicarán retroactivamente a periodos ya abonados y se comunicarán con antelación suficiente cuando afecten a una suscripción activa.' },
    ],
  },
  {
    heading: '15. Pagos y facturación',
    blocks: [
      { type: 'p', text: 'Los pagos podrán gestionarse mediante Stripe u otros proveedores identificados durante el proceso de contratación.' },
      { type: 'p', text: 'El usuario autoriza el cobro del precio, los impuestos y los conceptos expresamente indicados antes de confirmar la operación. La información de pago podrá ser tratada directamente por el proveedor correspondiente conforme a sus propias condiciones y políticas.' },
      { type: 'p', text: 'El usuario deberá facilitar información de facturación completa y veraz. Las facturas se emitirán conforme a la información proporcionada y podrán ponerse a disposición del usuario por medios electrónicos.' },
      { type: 'p', text: 'Si un pago es rechazado, devuelto o permanece pendiente, ARCHIVUM podrá solicitar un medio de pago válido y, tras comunicarlo al usuario, limitar o suspender las funcionalidades de pago hasta que la situación se regularice.' },
    ],
  },
  {
    heading: '16. Suscripciones y renovación',
    blocks: [
      { type: 'p', text: 'Cuando se contrate una suscripción, esta tendrá la periodicidad indicada durante el proceso de compra y se renovará automáticamente si así se informa y acepta expresamente antes de contratar.' },
      { type: 'p', text: 'Antes de confirmar la contratación se indicarán:' },
      {
        type: 'list',
        items: [
          'la duración del periodo inicial;',
          'la periodicidad de las renovaciones;',
          'el precio aplicable;',
          'el procedimiento de cancelación;',
          'y, en su caso, las condiciones del periodo de prueba.',
        ],
      },
      { type: 'p', text: 'El usuario podrá cancelar la renovación desde el área habilitada en su cuenta, dentro del apartado "Ajustes / Cancelar mi suscripción". La cancelación impedirá futuros cobros, pero, salvo que la ley o las condiciones particulares dispongan otra cosa, el servicio continuará disponible hasta finalizar el periodo ya pagado.' },
    ],
  },
  {
    heading: '17. Derecho de desistimiento de consumidores',
    blocks: [
      { type: 'p', text: 'Cuando el usuario sea consumidor y contrate a distancia, dispondrá, con carácter general, de 14 días naturales para desistir del contrato, salvo que concurra alguna excepción legal.' },
      { type: 'p', text: 'Si el usuario solicita que la prestación del servicio comience durante ese plazo, ARCHIVUM podrá requerir su solicitud expresa. En caso de desistimiento después de haberse iniciado el servicio, el usuario podrá tener que abonar la parte proporcional ya prestada cuando legalmente proceda.' },
      { type: 'p', text: 'Si el contrato consiste en el suministro de contenido digital sin soporte material y se inicia su ejecución durante el plazo de desistimiento, la pérdida de este derecho solo se producirá cuando concurran los requisitos legales, incluido el consentimiento previo y expreso del consumidor y su reconocimiento de que pierde el derecho de desistimiento.' },
      { type: 'p', text: `El desistimiento podrá ejercerse mediante una declaración inequívoca enviada a ${CONTACT_EMAIL} o utilizando el siguiente formulario:` },
      {
        type: 'quote',
        lines: [
          `A la atención de ARCHIVUM.VV, S.C., C/ Bajada al Molino, 10 - 3.º A, 09400 Aranda de Duero (Burgos), ${CONTACT_EMAIL}:`,
          '',
          'Por la presente comunico que desisto del contrato relativo al servicio siguiente: [SERVICIO].',
          'Contratado el: [FECHA].',
          'Nombre del consumidor: [NOMBRE].',
          'Domicilio: [DOMICILIO].',
          'Fecha: [FECHA].',
          'Firma, únicamente si el formulario se presenta en papel: [FIRMA].',
        ],
      },
      { type: 'p', text: 'Este apartado se aplicará sin perjuicio de cualquier derecho más favorable reconocido por la normativa de consumo.' },
    ],
  },
  {
    heading: '18. Cancelación, baja y eliminación de la cuenta',
    blocks: [
      { type: 'p', text: 'El usuario podrá solicitar la baja de su cuenta mediante las opciones disponibles en ARCHIVUM.' },
      { type: 'p', text: 'Antes de solicitarla, deberá exportar los contenidos que desee conservar. La baja podrá provocar la pérdida de acceso a los contenidos y funcionalidades asociados a la cuenta.' },
      { type: 'p', text: 'Una vez terminada la relación, ARCHIVUM podrá bloquear los datos durante los plazos necesarios para atender responsabilidades legales y proceder posteriormente a su eliminación o anonimización, sin perjuicio de:' },
      {
        type: 'list',
        items: [
          'los plazos legales de conservación;',
          'las copias temporales de seguridad;',
          'las obligaciones de bloqueo;',
          'los requerimientos de autoridades;',
          'y lo establecido en el acuerdo de encargo del tratamiento.',
        ],
      },
      { type: 'p', text: 'El usuario dispondrá de 15 días tras la cancelación de su suscripción para exportar o recuperar los contenidos antes de su eliminación. Pasado este plazo, dichos archivos serán eliminados definitivamente.' },
    ],
  },
  {
    heading: '19. Suspensión y resolución por incumplimiento',
    blocks: [
      { type: 'p', text: 'ARCHIVUM podrá limitar, suspender o resolver una cuenta cuando:' },
      {
        type: 'list',
        items: [
          'exista un incumplimiento grave o reiterado de estos Términos;',
          'se utilice el servicio para fines ilícitos;',
          'exista un riesgo significativo para la seguridad;',
          'se produzca fraude o suplantación;',
          'se vulneren derechos de terceros;',
          'no se abonen cantidades vencidas después del correspondiente aviso;',
          'o resulte necesario cumplir una obligación legal.',
        ],
      },
      { type: 'p', text: 'Siempre que sea razonablemente posible y no exista una urgencia de seguridad o prohibición legal, ARCHIVUM comunicará el motivo y concederá un plazo adecuado para subsanar el incumplimiento.' },
      { type: 'p', text: 'Las medidas adoptadas serán proporcionadas a la gravedad y naturaleza de la situación. La terminación no afectará a las obligaciones ni a las responsabilidades nacidas con anterioridad.' },
    ],
  },
  {
    heading: '20. Propiedad intelectual e industrial de ARCHIVUM',
    blocks: [
      { type: 'p', text: 'El software, diseño, estructura, bases de datos, textos, elementos gráficos, marcas, nombres comerciales, logotipos y demás componentes propios de ARCHIVUM están protegidos por las normas de propiedad intelectual e industrial.' },
      { type: 'p', text: 'La contratación o utilización del servicio concede al usuario un derecho limitado, revocable, no exclusivo, no sublicenciable e intransferible para utilizar ARCHIVUM durante la vigencia de la relación y conforme al plan contratado.' },
      { type: 'p', text: 'No se permite, salvo autorización legal o escrita:' },
      {
        type: 'list',
        items: [
          'copiar o distribuir el software;',
          'descompilarlo o realizar ingeniería inversa;',
          'modificarlo o crear obras derivadas;',
          'eliminar avisos de propiedad;',
          'utilizar las marcas de ARCHIVUM;',
          'o explotar comercialmente elementos del servicio fuera de lo contratado.',
        ],
      },
      { type: 'p', text: 'Nada de lo anterior afecta a la titularidad de los contenidos aportados por el usuario.' },
    ],
  },
  {
    heading: '21. Servicios y enlaces de terceros',
    blocks: [
      { type: 'p', text: 'ARCHIVUM puede depender de proveedores externos para prestar determinadas funcionalidades, entre ellos servicios de alojamiento, autenticación, monitorización, analítica técnica y pagos.' },
      { type: 'p', text: 'Algunas operaciones pueden redirigir al usuario a sitios o entornos de terceros, como Stripe, sometidos a sus propias condiciones y políticas.' },
      { type: 'p', text: 'ARCHIVUM seleccionará y gestionará a sus proveedores con la diligencia razonablemente exigible, pero no controla los sitios o servicios externos independientes ni responde de sus contenidos o condiciones, sin perjuicio de las responsabilidades que legalmente correspondan a ARCHIVUM por sus propios proveedores o por la prestación contratada.' },
    ],
  },
  {
    heading: '22. Comunicaciones electrónicas',
    blocks: [
      { type: 'p', text: 'ARCHIVUM podrá enviar al usuario comunicaciones necesarias para la ejecución del contrato, como avisos de seguridad, modificaciones relevantes, facturación, incidencias, renovaciones y cambios en el servicio.' },
      { type: 'p', text: 'Estas comunicaciones no tienen naturaleza comercial cuando resultan necesarias para gestionar la cuenta o prestar el servicio.' },
      { type: 'p', text: 'Las comunicaciones promocionales se enviarán únicamente cuando exista una base jurídica válida. El usuario podrá retirar su consentimiento u oponerse mediante los mecanismos indicados en cada comunicación, sin que ello afecte a los mensajes estrictamente necesarios para el servicio.' },
    ],
  },
  {
    heading: '23. Responsabilidad',
    blocks: [
      { type: 'p', text: 'ARCHIVUM responderá por los daños directos causados por incumplimientos que le sean imputables conforme a la legislación aplicable.' },
      { type: 'p', text: 'En la medida permitida por la ley, ARCHIVUM no será responsable de daños derivados exclusivamente de:' },
      {
        type: 'list',
        items: [
          'un uso contrario a estos Términos;',
          'la pérdida o divulgación de credenciales imputable al usuario;',
          'contenidos ilícitos o no autorizados aportados por el usuario;',
          'equipos, conexiones o servicios externos ajenos al control razonable de ARCHIVUM;',
          'o decisiones profesionales tomadas por el usuario basándose exclusivamente en la plataforma.',
        ],
      },
      { type: 'p', text: 'ARCHIVUM no excluye ni limita la responsabilidad cuando hacerlo esté prohibido, particularmente en caso de dolo, responsabilidad legalmente irrenunciable o vulneración de los derechos de consumidores.' },
      { type: 'p', text: 'Nada en estos Términos excluye las garantías legales aplicables a los servicios o contenidos digitales contratados por consumidores.' },
    ],
  },
  {
    heading: '24. Indemnidad en relaciones profesionales',
    blocks: [
      { type: 'p', text: 'Cuando el usuario actúe como empresario o profesional, deberá mantener indemne a ARCHIVUM frente a reclamaciones de terceros derivadas directamente de contenidos o instrucciones ilícitas aportados por dicho usuario o de un incumplimiento imputable a este.' },
      { type: 'p', text: 'Esta obligación no será aplicable en la medida en que la reclamación sea consecuencia de una actuación u omisión imputable a ARCHIVUM.' },
      { type: 'p', text: 'Este apartado no limita los derechos reconocidos a consumidores y usuarios.' },
    ],
  },
  {
    heading: '25. Atención al usuario y reclamaciones',
    blocks: [
      { type: 'p', text: 'Las consultas, incidencias y reclamaciones podrán dirigirse a:' },
      {
        type: 'quote',
        lines: [
          'ARCHIVUM.VV, S.C.',
          'C/ Bajada al Molino, 10 - 3.º A',
          '09400 Aranda de Duero, Burgos, España',
          `Correo electrónico: ${CONTACT_EMAIL}`,
        ],
      },
      { type: 'p', text: 'ARCHIVUM procurará responder a las reclamaciones en un plazo razonable y, cuando resulte aplicable, dentro del plazo exigido por la normativa de consumo.' },
      { type: 'p', text: 'El usuario consumidor podrá solicitar las hojas oficiales de reclamaciones cuando legalmente proceda y acudir a los organismos públicos de consumo competentes.' },
    ],
  },
  {
    heading: '26. Modificación de los Términos',
    blocks: [
      { type: 'p', text: 'ARCHIVUM podrá modificar estos Términos por cambios legales, técnicos, de seguridad, organizativos o funcionales.' },
      { type: 'p', text: 'La versión vigente estará disponible en www.archivum.es e indicará su fecha de actualización.' },
      { type: 'p', text: 'Cuando una modificación afecte de forma sustancial a derechos u obligaciones de usuarios registrados, se comunicará con una antelación razonable. Si la normativa exige una nueva aceptación, ARCHIVUM la solicitará antes de aplicar el cambio correspondiente.' },
      { type: 'p', text: 'Las modificaciones no tendrán efectos retroactivos, salvo cuando sean favorables para el usuario o resulten exigidas por la ley.' },
    ],
  },
  {
    heading: '27. Nulidad parcial',
    blocks: [
      { type: 'p', text: 'Si alguna disposición fuese declarada nula, inválida o inaplicable, las restantes conservarán su vigencia.' },
      { type: 'p', text: 'La disposición afectada se interpretará o sustituirá, cuando sea posible, por otra válida que respete su finalidad y el equilibrio contractual, sin reducir los derechos imperativos del usuario.' },
    ],
  },
  {
    heading: '28. Legislación aplicable y jurisdicción',
    blocks: [
      { type: 'p', text: 'Estos Términos se rigen por la legislación española.' },
      { type: 'p', text: 'Cuando el usuario sea consumidor, cualquier controversia se someterá a los juzgados y tribunales que correspondan conforme a las normas imperativas de protección de consumidores, generalmente los de su domicilio.' },
      { type: 'p', text: 'Cuando el usuario actúe exclusivamente como empresario o profesional y la ley permita pactar la jurisdicción, las partes se someten a los juzgados y tribunales de Aranda de Duero (Burgos), salvo que unas condiciones particulares establezcan válidamente otra cosa.' },
    ],
  },
  {
    heading: '29. Documentación contractual',
    blocks: [
      { type: 'p', text: 'Forman parte de la relación contractual, según resulte aplicable:' },
      {
        type: 'list',
        items: [
          'estos Términos y Condiciones;',
          'las condiciones particulares del plan contratado;',
          'la información mostrada durante la contratación;',
          'la Política de Privacidad;',
          'la Política de Cookies;',
          'el acuerdo de encargo del tratamiento;',
          'y las instrucciones o anexos aceptados expresamente por las partes.',
        ],
      },
      { type: 'p', text: 'En caso de contradicción, prevalecerán las condiciones particulares sobre estos Términos respecto del servicio específico contratado, sin perjuicio de la normativa imperativa.' },
    ],
  },
  {
    heading: '30. Contacto',
    blocks: [
      { type: 'p', text: 'Para cualquier consulta sobre estos Términos:' },
      {
        type: 'quote',
        lines: [
          'ARCHIVUM.VV, S.C.',
          `Correo electrónico: ${CONTACT_EMAIL}`,
          'Dirección postal: C/ Bajada al Molino, 10 - 3.º A, 09400 Aranda de Duero (Burgos, España)',
        ],
      },
    ],
  },
]

export default function TerminosPage() {
  return (
    <LegalDocument
      icon={FileText}
      title="Términos y condiciones de uso de Archivum"
      subtitle="Condiciones de uso"
      lastUpdated="1 de septiembre de 2026"
      articles={articles}
    />
  )
}
