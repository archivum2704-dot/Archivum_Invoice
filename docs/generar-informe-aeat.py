# -*- coding: utf-8 -*-
"""Genera el informe de situación de Veri*Factu para llevar a la AEAT."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, PageBreak,
)

F = "/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont("DJ", F + "DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DJ-B", F + "DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("DJ-M", F + "DejaVuSansMono.ttf"))
# DejaVu Sans no trae oblicua en esta imagen; la cursiva cae a la redonda.
pdfmetrics.registerFontFamily("DJ", normal="DJ", bold="DJ-B", italic="DJ", boldItalic="DJ-B")

AZUL = colors.HexColor("#1F4E9C")
AZULC = colors.HexColor("#2E6FD6")
GRIS = colors.HexColor("#4A4A4A")
GRISC = colors.HexColor("#F2F4F7")
LINEA = colors.HexColor("#D4D9E0")
VERDE = colors.HexColor("#166534")
VERDEC = colors.HexColor("#E7F5EC")
AMBAR = colors.HexColor("#8A5A00")
AMBARC = colors.HexColor("#FDF3DC")
ROJO = colors.HexColor("#9B2226")
ROJOC = colors.HexColor("#FBEAEA")

W, H = A4
MARGEN = 20 * mm
ANCHO = W - 2 * MARGEN

S = {
    "titulo": ParagraphStyle("titulo", fontName="DJ-B", fontSize=21, leading=26,
                             textColor=AZUL, spaceAfter=2),
    "subtitulo": ParagraphStyle("subtitulo", fontName="DJ", fontSize=11.5, leading=16,
                                textColor=GRIS, spaceAfter=14),
    "h1": ParagraphStyle("h1", fontName="DJ-B", fontSize=14, leading=18,
                         textColor=AZUL, spaceBefore=16, spaceAfter=7),
    "h2": ParagraphStyle("h2", fontName="DJ-B", fontSize=11, leading=15,
                         textColor=colors.HexColor("#1A1A1A"), spaceBefore=11, spaceAfter=5),
    "p": ParagraphStyle("p", fontName="DJ", fontSize=9.7, leading=14.6,
                        textColor=colors.HexColor("#1A1A1A"), alignment=TA_JUSTIFY,
                        spaceAfter=7),
    "pi": ParagraphStyle("pi", fontName="DJ", fontSize=9.7, leading=14.6,
                         textColor=colors.HexColor("#1A1A1A"), alignment=TA_JUSTIFY,
                         spaceAfter=5, leftIndent=10 * mm),
    "celda": ParagraphStyle("celda", fontName="DJ", fontSize=8.5, leading=12,
                            textColor=colors.HexColor("#1A1A1A")),
    "celdaB": ParagraphStyle("celdaB", fontName="DJ-B", fontSize=8.5, leading=12,
                             textColor=colors.HexColor("#1A1A1A")),
    "celdaC": ParagraphStyle("celdaC", fontName="DJ", fontSize=8, leading=11,
                             textColor=GRIS),
    "th": ParagraphStyle("th", fontName="DJ-B", fontSize=8.3, leading=11,
                         textColor=colors.white),
    "nota": ParagraphStyle("nota", fontName="DJ", fontSize=8.7, leading=13,
                           textColor=GRIS, alignment=TA_JUSTIFY),
    "preg": ParagraphStyle("preg", fontName="DJ-B", fontSize=9.7, leading=14,
                           textColor=AZUL, spaceAfter=3),
    "kv": ParagraphStyle("kv", fontName="DJ", fontSize=9, leading=13,
                         textColor=colors.HexColor("#1A1A1A")),
}


def p(t, e="p"):
    return Paragraph(t, S[e])


def regla(color=LINEA, grosor=0.8, antes=2, despues=8):
    t = Table([[""]], colWidths=[ANCHO], rowHeights=[grosor])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), color)]))
    return [Spacer(1, antes), t, Spacer(1, despues)]


def encabezado(txt, fondo, texto):
    """Barra de sección de color, para separar bloques."""
    t = Table([[Paragraph(txt, ParagraphStyle("b", fontName="DJ-B", fontSize=10.5,
                                              leading=14, textColor=texto))]],
              colWidths=[ANCHO])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), fondo),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBEFORE", (0, 0), (0, -1), 3, texto),
    ]))
    return t


def tabla(cabeceras, filas, anchos, colores_estado=None):
    data = [[Paragraph(c, S["th"]) for c in cabeceras]]
    for f in filas:
        data.append([c if isinstance(c, Paragraph) else Paragraph(str(c), S["celda"])
                     for c in f])
    t = Table(data, colWidths=anchos, repeatRows=1)
    est = [
        ("BACKGROUND", (0, 0), (-1, 0), AZUL),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINEA),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRISC]),
    ]
    if colores_estado:
        for i, (fondo, texto) in enumerate(colores_estado, start=1):
            est.append(("BACKGROUND", (len(anchos) - 1, i), (len(anchos) - 1, i), fondo))
            est.append(("TEXTCOLOR", (len(anchos) - 1, i), (len(anchos) - 1, i), texto))
    t.setStyle(TableStyle(est))
    return t


def estado(txt, tipo):
    c = {"ok": VERDE, "parcial": AMBAR, "no": ROJO}[tipo]
    return Paragraph(txt, ParagraphStyle("e", fontName="DJ-B", fontSize=8.3,
                                         leading=11, textColor=c))


def bloque_pregunta(n, titulo, cuerpo, pedimos):
    partes = [
        p("%d. %s" % (n, titulo), "preg"),
        p(cuerpo, "p"),
        Table([[Paragraph("<b>Lo que necesitamos:</b> " + pedimos, S["nota"])]],
              colWidths=[ANCHO],
              style=TableStyle([
                  ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EEF3FB")),
                  ("LINEBEFORE", (0, 0), (0, -1), 2.5, AZULC),
                  ("LEFTPADDING", (0, 0), (-1, -1), 8),
                  ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                  ("TOPPADDING", (0, 0), (-1, -1), 6),
                  ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
              ])),
        Spacer(1, 11),
    ]
    return KeepTogether(partes)


# ─────────────────────────── contenido ───────────────────────────

story = []

story.append(p("Sistema informático de facturación «Archivum»", "titulo"))
story.append(p("Estado de conformidad con el RD 1007/2023 y la Orden HAC/1177/2024<br/>"
               "Informe de situación y puntos a consultar con la Agencia Tributaria",
               "subtitulo"))

ficha = [
    ["Sistema", "Archivum — facturación y gestión documental (web y aplicación móvil)"],
    ["Modo de operación", "VERI*FACTU (con remisión de los registros a la AEAT)"],
    ["Naturaleza", "Servicio multi-obligado: cada organización dada de alta es un obligado "
                   "tributario distinto y una instalación independiente"],
    ["Productor del sistema", "Pendiente de consignar (razón social y NIF)"],
    ["Fecha del informe", "9 de agosto de 2026"],
    ["Situación global", "Núcleo del reglamento implementado y verificado en código. "
                         "No se ha realizado ninguna prueba real contra la AEAT."],
]
t = Table([[Paragraph(a, S["celdaB"]), Paragraph(b, S["celda"])] for a, b in ficha],
          colWidths=[42 * mm, ANCHO - 42 * mm])
t.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("BACKGROUND", (0, 0), (0, -1), GRISC),
    ("LINEBELOW", (0, 0), (-1, -2), 0.5, LINEA),
    ("BOX", (0, 0), (-1, -1), 0.8, LINEA),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story.append(t)

story.append(p("Resumen para la reunión", "h1"))
story.append(p(
    "Archivum tiene construido y verificado el núcleo de lo que exige el Reglamento: genera el "
    "registro de facturación en el mismo acto de expedición, lo encadena mediante huella SHA-256, "
    "impide su alteración posterior desde la propia base de datos, mantiene el registro de eventos, "
    "detecta anomalías de integridad y trazabilidad, y tiene programada la remisión a la AEAT por "
    "servicio web con TLS mutuo."))
story.append(p(
    "Lo que <b>no</b> tenemos es la confirmación de los detalles técnicos que el propio articulado "
    "remite a un documento de la sede electrónica de la AEAT, y no hemos podido ejecutar ni una sola "
    "prueba real: falta el certificado electrónico y falta el acceso al entorno de preproducción. "
    "Mientras eso no se resuelva, el sistema no puede declararse conforme."))
story.append(p(
    "Este informe se divide en tres partes: lo que ya está hecho (apartado 1), lo que falta y de quién "
    "depende (apartado 2), y —lo más importante para esta reunión— <b>las preguntas concretas que "
    "necesitamos resolver con la Agencia Tributaria</b> (apartado 3)."))

nota = Table([[Paragraph(
    "<b>Punto de partida honesto.</b> Hasta que se cierren los puntos del apartado 2, no procede "
    "afirmar que el sistema es conforme ni emitir declaración responsable alguna. Este documento "
    "describe la situación real, no la deseada.", S["nota"])]], colWidths=[ANCHO])
nota.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), AMBARC),
    ("LINEBEFORE", (0, 0), (0, -1), 3, AMBAR),
    ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]))
story.append(nota)

# ── 1. Implementado ──
story.append(PageBreak())
story.append(p("1. Lo que ya está implementado y verificado", "h1"))
story.append(p(
    "Cada línea corresponde a funcionalidad existente en el sistema, contrastada contra el texto "
    "consolidado de la norma. El repositorio incluye además una batería de 78 comprobaciones "
    "automáticas que se ejecutan en cada cambio y que hoy pasan íntegramente."))

anchos1 = [56 * mm, 25 * mm, ANCHO - 56 * mm - 25 * mm - 19 * mm, 19 * mm]
filas1 = [
    ["Registro de facturación de alta, completo: desglose, descripción de la operación, "
     "destinatarios y sistema informático", "RD art. 10",
     "Se genera dentro del mismo acto de expedición; no hay forma de expedir sin registro",
     estado("Hecho", "ok")],
    ["Huella SHA-256 encadenada", "Orden art. 13.1.a",
     "64 caracteres hexadecimales en mayúsculas, TipoHuella = 01", estado("Hecho", "ok")],
    ["No bifurcación de la cadena", "RD art. 8.2.b",
     "Garantizada por índice único en base de datos, no por lógica de aplicación: dos registros "
     "no pueden declarar el mismo predecesor", estado("Hecho", "ok")],
    ["Inalterabilidad del registro expedido", "RD art. 8.2.a",
     "Impuesta por disparadores de base de datos; ni el administrador de la plataforma puede "
     "alterar importes, fechas, NIF o huella", estado("Hecho", "ok")],
    ["Facturas rectificativas por diferencias", "RD art. 10",
     "TipoRectificativa = I, referenciando emisor, número y fecha de la rectificada",
     estado("Hecho", "ok")],
    ["Registro de facturación de anulación", "RD art. 11",
     "Con marca de «sin registro previo» cuando la factura nunca llegó a remitirse",
     estado("Hecho", "ok")],
    ["Registro de eventos, consultable desde el propio sistema", "RD art. 8.3",
     "Encadenado con su propia huella; incluye pantalla de consulta dentro de la aplicación",
     estado("Hecho", "ok")],
    ["Descarga, volcado y exportación de registros", "RD art. 8.2.c",
     "Exportación a fichero electrónico legible por período", estado("Hecho", "ok")],
    ["Remisión a la AEAT por servicio web", "RD art. 15-16",
     "SOAP sobre TLS mutuo con el certificado del obligado, con reintentos y respeto del tiempo "
     "de espera que devuelve la AEAT", estado("Hecho", "ok")],
    ["Código QR y leyenda en la factura", "Orden art. 21",
     "ISO 18004, nivel de corrección M, 31,75 mm, con la leyenda VERI*FACTU",
     estado("Hecho", "ok")],
    ["Detección de anomalías de integridad y trazabilidad", "Orden art. 9.1.c-f",
     "Re-calcula la huella de cada registro almacenado y verifica el encadenamiento; deja "
     "constancia tanto del lanzamiento como del resultado", estado("Hecho", "ok")],
    ["Causas de exención E1 a E6, por línea de factura", "Orden lista L10",
     "El desglose agrupa por causa de exención, no solo por tipo impositivo",
     estado("Hecho", "ok")],
    ["Clientes no residentes identificados por IDOtro", "Orden lista L7",
     "El sistema impide consignar un identificador extranjero en el campo NIF",
     estado("Hecho", "ok")],
    ["Declaración responsable visible dentro del sistema", "RD art. 13.2",
     "Página accesible desde Ajustes y desde el pie de la web. Falta el contenido firmado",
     estado("Parcial", "parcial")],
    ["Registro resumen de eventos", "Orden art. 9.2",
     "Implementado, pero hoy se genera una vez al día en lugar de cada seis horas, por una "
     "limitación del plan de alojamiento contratado", estado("Parcial", "parcial")],
]
cols1 = [(VERDEC, VERDE)] * 13 + [(AMBARC, AMBAR)] * 2
story.append(tabla(["Requisito", "Norma", "Cómo está resuelto", "Estado"], filas1, anchos1, cols1))

story.append(Spacer(1, 8))
story.append(p(
    "<b>Sobre la verificación independiente.</b> Los registros ya generados se volvieron a calcular "
    "en la propia base de datos, con una implementación distinta de la del programa, y coincidieron "
    "uno a uno. Al alterar deliberadamente una copia, la comprobación dejó de coincidir. La "
    "detección de manipulaciones funciona.", "nota"))

# ── 2. Pendiente ──
story.append(Spacer(1, 10))
story.append(p("2. Lo que falta, y de quién depende", "h1"))
story.append(p(
    "Lo pendiente no es homogéneo: una parte es trabajo nuestro de desarrollo, otra depende de "
    "información que solo la Agencia Tributaria puede facilitar, otra de documentación y decisiones "
    "del titular, y una última del asesor jurídico. Separarlo importa, porque el orden en que se "
    "desbloquea condiciona todo lo demás."))

anchos2 = [62 * mm, 30 * mm, ANCHO - 62 * mm - 30 * mm]
story.append(KeepTogether([
    encabezado("2.A · Depende de la Agencia Tributaria — es lo que bloquea las pruebas",
               ROJOC, ROJO),
    Spacer(1, 7),
    tabla(["Qué falta", "Norma", "Por qué bloquea"], [
    ["Documento técnico con el algoritmo y la codificación exactos de la huella",
     "Orden art. 13.2",
     "El articulado fija <b>qué campos</b> entran en la huella —y esos los tenemos confirmados— pero "
     "remite el <b>formato de concatenación y la codificación</b> a un documento de la sede "
     "electrónica. Un formato equivocado produce una huella de aspecto correcto que la AEAT rechaza. "
     "Es lo primero que hay que contrastar."],
    ["Endpoints de los servicios web y espacios de nombres del esquema", "—",
     "Hoy están configurados según nuestra mejor interpretación y son parametrizables, pero no "
     "confirmados. Sin ellos no se puede enviar nada."],
    ["Acceso al entorno de preproducción", "—",
     "Nunca se ha ejecutado un envío real. Todo lo relativo a la remisión está probado contra "
     "simulaciones propias, no contra la AEAT."],
    ["Listado de códigos de error", "—",
     "No podemos traducir ni explicar al usuario por qué la AEAT rechaza un registro."],
    ["Formato XML de los registros de evento (anexo 5)", "Orden art. 9.4",
     "Hoy los eventos se conservan en formato estructurado propio. Falta confirmar la estructura "
     "exigida antes de convertirlos."],
    ["Criterio de disociación de accesos para la Administración", "RD art. 8.4 y 14",
     "Sabemos que hay que permitir el acceso de la Administración a los registros, pero no en qué "
     "forma: ¿volcado a requerimiento, acceso en línea, formato concreto?"],
], anchos2),
]))

story.append(Spacer(1, 12))
story.append(KeepTogether([
    encabezado("2.B · Depende del titular del sistema", AMBARC, AMBAR),
    Spacer(1, 7),
    tabla(["Qué falta", "Por qué bloquea"], [
    ["Certificado electrónico (0 subidos hasta hoy)",
     "Sin él no se puede autenticar ninguna comunicación con la AEAT. Es el requisito que impide "
     "incluso empezar a probar."],
    ["Razón social, NIF, domicilio y contacto del productor del sistema",
     "Van dentro de cada registro de facturación, en el bloque «SistemaInformatico», y también en la "
     "declaración responsable. Sin ellos el registro está incompleto."],
    ["Decisión sobre el modelo de servicio: apoderamiento o certificado por cliente",
     "Cambia el producto y el modelo de negocio. Conviene decidirlo antes de seguir programando "
     "sobre la remisión (ver pregunta 6)."],
    ["Ampliación del plan de alojamiento",
     "El plan actual solo permite una tarea programada diaria. El resumen de eventos cada seis "
     "horas del artículo 9.2 no se puede cumplir con esa limitación."],
], [62 * mm, ANCHO - 62 * mm]),
]))

story.append(Spacer(1, 12))
story.append(KeepTogether([
    encabezado("2.C · Depende de nosotros (desarrollo, ya planificado)", GRISC, GRIS),
    Spacer(1, 7),
    tabla(["Qué falta", "Norma", "Observación"], [
    ["Convertir los registros de evento a XML según el anexo 5", "Orden art. 9.4",
     "Trabajo mecánico una vez confirmado el formato exacto"],
    ["Exportación de eventos como operación independiente", "Orden art. 9.1.i",
     "Hoy salen dentro de la exportación de facturación"],
    ["Selector de causa de exención también en presupuestos", "Orden lista L10",
     "Ya está en facturas, web y móvil"],
    ["Regímenes distintos del general", "Orden lista L8",
     "Hoy la clave de régimen está fijada a 01. Falta saber qué alcance es exigible (pregunta 8)"],
], [62 * mm, 30 * mm, ANCHO - 92 * mm]),
]))

story.append(Spacer(1, 12))
story.append(KeepTogether([
    encabezado("2.D · Depende del asesor jurídico", GRISC, GRIS),
    Spacer(1, 7),
    p(
    "La <b>declaración responsable</b> del artículo 13 debe redactarla y firmarla el productor con "
    "asesoramiento jurídico. La página que la mostrará dentro del sistema ya existe y está publicada; "
    "lo que falta es el contenido firmado. Debe recoger los datos que identifican el sistema y "
    "permiten conocer su tipología, composición y funcionalidades; las características de la "
    "instalación; los datos identificativos y de localización del productor; y la fecha y el lugar de "
    "la firma. Los dos primeros apartados podemos redactarlos nosotros a partir de la documentación "
    "técnica del sistema.", "pi"),
]))

# ── 3. Preguntas ──
story.append(PageBreak())
story.append(p("3. Preguntas concretas para la Agencia Tributaria", "h1"))
story.append(p(
    "Esta es la parte operativa del documento. Son las cuestiones que, resueltas, desbloquean todo "
    "lo demás. Están ordenadas por urgencia: las cinco primeras impiden hoy hacer una sola prueba real."))

preguntas = [
    ("Documento técnico del formato de la huella",
     "El artículo 13.2 de la Orden HAC/1177/2024 remite el algoritmo y la codificación de la huella a "
     "un documento técnico publicado en la sede electrónica. Tenemos confirmados los campos que "
     "intervienen en los tres tipos de huella —alta (art. 13.1.a), anulación (13.1.b) y evento "
     "(13.1.c)— pero no el formato exacto de concatenación ni la codificación de caracteres. Nuestra "
     "implementación sigue el criterio publicado para los registros de facturación y lo extiende a "
     "los eventos por analogía, lo cual no es garantía de nada.",
     "La referencia exacta y la versión vigente de ese documento técnico, y confirmación de si el "
     "criterio de concatenación de los registros de facturación es el mismo que se aplica al registro "
     "de eventos."),

    ("URLs de los servicios web, WSDL y esquemas XSD vigentes",
     "El sistema envía los registros por servicio web SOAP con autenticación por TLS mutuo. Las "
     "direcciones de producción y preproducción, los espacios de nombres y el juego de esquemas están "
     "hoy configurados según nuestra interpretación de la documentación pública, y son parametrizables "
     "precisamente porque no están confirmados.",
     "Direcciones de los servicios de producción y preproducción, WSDL, y ubicación del juego de "
     "esquemas XSD vigente, con su número de versión."),

    ("Cómo se accede al entorno de preproducción",
     "No hemos ejecutado ni un solo envío real. Es la verificación que más nos importa y la que hoy es "
     "imposible. Necesitamos saber qué requisitos hay que cumplir previamente.",
     "Requisitos de acceso a preproducción: si hace falta certificado específico de pruebas o sirve el "
     "del obligado, si es necesaria alta o solicitud previa, si existen NIF de prueba, y si hay algún "
     "protocolo de homologación antes de pasar a producción."),

    ("Listado de códigos de error y su significado",
     "Cuando la AEAT rechaza un registro, hoy podemos mostrar al usuario el código devuelto pero no "
     "explicárselo. Para un usuario que acaba de expedir una factura, un código sin explicación es "
     "inútil, y aumenta el riesgo de que ignore un rechazo real.",
     "Listado oficial de códigos de error del servicio, con su descripción y, en particular, cuáles "
     "son subsanables reenviando y cuáles exigen rectificar o anular el registro."),

    ("Registro de eventos: formato del anexo 5 y si debe remitirse",
     "Tenemos el registro de eventos implementado, encadenado y consultable desde el sistema, con los "
     "tipos de evento del artículo 9.1. Hoy se conserva en un formato estructurado propio y falta "
     "convertirlo al XML del anexo 5.",
     "Confirmación de la estructura del anexo 5 y, sobre todo, si el registro de eventos debe "
     "<b>remitirse</b> a la AEAT como los de facturación, o basta con conservarlo y ponerlo a "
     "disposición cuando se requiera."),

    ("Modelo de servicio para un SaaS multi-obligado: certificado propio o apoderamiento",
     "Archivum da servicio a varios obligados tributarios distintos desde una misma plataforma. Hoy "
     "está construido para que cada obligado suba su propio certificado electrónico, que se conserva "
     "cifrado y solo se usa para firmar sus propias remisiones. La alternativa sería actuar como "
     "representante mediante apoderamiento. Esta decisión afecta al producto y al modelo de negocio, "
     "y preferimos tomarla con criterio de la Agencia y no por conjetura.",
     "Qué vías admite la AEAT para un sistema multi-obligado, qué trámite o modelo de apoderamiento "
     "correspondería, y si existe alguna preferencia o requisito adicional sobre la custodia de "
     "certificados de terceros."),

    ("Número de instalación e identificador del sistema informático",
     "En el bloque «SistemaInformatico» declaramos un identificador de sistema y un número de "
     "instalación. En nuestro caso usamos como número de instalación el identificador interno de cada "
     "organización, entendiendo que cada obligado constituye una instalación independiente aunque el "
     "programa sea único y compartido.",
     "Confirmación de que ese criterio es correcto para un servicio web multi-obligado, y qué "
     "requisitos hay sobre el identificador del sistema informático y sobre su versión (en particular, "
     "cuándo un cambio obliga a considerarlo una versión nueva a efectos del artículo 13)."),

    ("Regímenes especiales exigibles desde el inicio",
     "El sistema declara hoy únicamente la clave de régimen 01, régimen general. Está preparado para "
     "admitir otras, pero no queremos implementar a ciegas ni dejar fuera algo obligatorio.",
     "Qué claves de régimen y qué calificaciones de operación son exigibles con carácter general, y "
     "cuáles pueden implementarse más adelante según el perfil de los usuarios."),

    ("Resumen de eventos cada seis horas: qué se entiende por sistema en funcionamiento",
     "El artículo 9.2 exige un registro resumen por cada seis horas de funcionamiento del sistema. En "
     "un servicio web que está permanentemente encendido y da servicio a varios obligados, no está "
     "claro el criterio: ¿un resumen por cada obligado, o uno por instalación del programa? ¿Cuentan "
     "las seis horas aunque ese obligado no haya realizado ninguna operación?",
     "Criterio aplicable a un servicio en la nube: unidad a la que se refiere el resumen y cómo se "
     "computan las seis horas cuando no hay actividad."),

    ("Acceso de la Administración y disociación de la información",
     "El artículo 8.4 exige que el acceso a la información con trascendencia tributaria esté disociado "
     "del acceso a información confidencial de carácter no patrimonial, de modo que la Administración "
     "pueda consultar directamente los registros de facturación y de eventos. Hoy separamos por roles "
     "y por organización, con seguridad a nivel de fila en la base de datos, pero no existe una vía "
     "de acceso pensada específicamente para la Administración.",
     "Qué espera exactamente la Administración: si es un procedimiento de volcado a requerimiento, un "
     "acceso en línea, o un formato de entrega determinado. Y si existe alguna especificación técnica "
     "publicada al respecto."),

    ("Declaración responsable: forma, presentación y conservación",
     "Sabemos que corresponde al productor emitirla, que debe constar por escrito y de modo visible en "
     "el propio sistema en cada una de sus versiones, y que hay que conservar las de todas las "
     "versiones producidas. La página que la muestra dentro del sistema ya está publicada, a la espera "
     "del contenido firmado.",
     "Si existe modelo normalizado, si debe presentarse o registrarse ante la AEAT o basta con "
     "conservarla y exhibirla, y qué se considera «versión» a estos efectos en un servicio web que se "
     "actualiza de forma continua."),
]

for i, (tit, cuerpo, pide) in enumerate(preguntas, start=1):
    story.append(bloque_pregunta(i, tit, cuerpo, pide))

# ── 4. Orden ──
story.append(p("4. Orden en que conviene desbloquear", "h1"))
story.append(p(
    "Todo lo que queda de desarrollo es acotado. Lo que no es acotado es probar contra la AEAT, y eso "
    "depende de dos cosas que no están en nuestra mano."))
story.append(tabla(["Paso", "Qué desbloquea", "De quién depende"], [
    ["1. Certificado electrónico del obligado", "Cualquier comunicación con la AEAT",
     "Titular del sistema"],
    ["2. Documento técnico de la huella y esquemas vigentes",
     "Poder contrastar que las huellas ya generadas son válidas antes de emitir en producción",
     "Agencia Tributaria"],
    ["3. Acceso a preproducción",
     "La primera prueba real de extremo a extremo: envío, respuesta, rechazo, reenvío",
     "Agencia Tributaria"],
    ["4. Datos del productor", "Completar el registro y poder redactar la declaración responsable",
     "Titular del sistema"],
    ["5. Declaración responsable firmada", "Distribuir el sistema legalmente", "Asesor jurídico"],
    ["6. Resto de desarrollo (eventos en XML, exportación propia, regímenes)",
     "Cierre de los últimos puntos del reglamento", "Nosotros"],
], [58 * mm, ANCHO - 58 * mm - 38 * mm, 38 * mm]))

story.append(PageBreak())
story.append(p("5. Lista para llevar a la reunión", "h1"))
story.append(p(
    "Resumen de una página. Si de la reunión solo salieran estas cinco cosas, el proyecto quedaría "
    "desbloqueado por completo."))

pedidos = [
    ("Documento técnico de la huella",
     "Referencia y versión vigente del documento de la sede electrónica al que remite el art. 13.2 "
     "de la Orden, y confirmación de si el mismo criterio de concatenación aplica al registro de "
     "eventos."),
    ("Servicios web y esquemas",
     "URLs de producción y preproducción, WSDL, espacios de nombres y juego de esquemas XSD vigente."),
    ("Acceso a preproducción",
     "Qué hace falta para poder ejecutar la primera prueba real: certificado, alta previa, NIF de "
     "prueba, protocolo de homologación."),
    ("Códigos de error",
     "Listado oficial con descripción, distinguiendo los subsanables por reenvío de los que exigen "
     "rectificar o anular."),
    ("Criterio para un servicio multi-obligado",
     "Certificado por cliente o apoderamiento; número de instalación; cómputo del resumen de eventos "
     "cada seis horas; y forma de acceso de la Administración."),
]
filas_p = []
for i, (a, b) in enumerate(pedidos, start=1):
    filas_p.append([
        Paragraph("☐", ParagraphStyle("chk", fontName="DJ", fontSize=12, leading=14,
                                      textColor=AZULC)),
        Paragraph("<b>%d. %s</b><br/>%s" % (i, a, b), S["celda"]),
    ])
tp = Table(filas_p, colWidths=[10 * mm, ANCHO - 10 * mm])
tp.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ("LINEBELOW", (0, 0), (-1, -2), 0.5, LINEA),
    ("BOX", (0, 0), (-1, -1), 0.8, LINEA),
]))
story.append(tp)

story.append(Spacer(1, 10))
story.append(Table([[Paragraph(
    "<b>Y dos cosas que no dependen de la Agencia:</b> el certificado electrónico del obligado, sin "
    "el cual no se puede probar nada, y los datos identificativos del productor del sistema, que van "
    "dentro de cada registro de facturación.", S["nota"])]], colWidths=[ANCHO],
    style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), AMBARC),
        ("LINEBEFORE", (0, 0), (0, -1), 3, AMBAR),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ])))

story.append(Spacer(1, 14))
story.append(KeepTogether([
    p("Referencias normativas manejadas", "h2"),
    p(
    "Real Decreto 1007/2023, de 5 de diciembre, por el que se aprueba el Reglamento que establece los "
    "requisitos que deben adoptar los sistemas y programas informáticos de facturación (texto "
    "consolidado del BOE).<br/>"
    "Orden HAC/1177/2024, de 17 de octubre, de desarrollo de las especificaciones técnicas, "
    "funcionales y de contenido.<br/>"
    "Sede electrónica de la AEAT — «Sistemas Informáticos de Facturación y VERI*FACTU».<br/>"
    "Consultas técnicas: verifactu@correo.aeat.es", "nota"),
]))


# ─────────────────────────── montaje ───────────────────────────

def pie(canvas, doc):
    canvas.saveState()
    canvas.setFont("DJ", 7.5)
    canvas.setFillColor(GRIS)
    canvas.drawString(MARGEN, 12 * mm,
                      "Archivum · Estado de conformidad Veri*Factu · 9 de agosto de 2026")
    canvas.drawRightString(W - MARGEN, 12 * mm, "Página %d" % doc.page)
    canvas.setStrokeColor(LINEA)
    canvas.setLineWidth(0.5)
    canvas.line(MARGEN, 16 * mm, W - MARGEN, 16 * mm)
    if doc.page == 1:
        canvas.setStrokeColor(AZULC)
        canvas.setLineWidth(3)
        canvas.line(MARGEN, H - MARGEN + 6 * mm, MARGEN + 34 * mm, H - MARGEN + 6 * mm)
    canvas.restoreState()


SALIDA = "/tmp/claude-0/-home-user-Archivum-Invoice/05041d6a-244d-5bfb-8208-3d7257529c54/scratchpad/Archivum-Verifactu-Estado-y-Consultas-AEAT.pdf"
doc = BaseDocTemplate(
    SALIDA, pagesize=A4,
    leftMargin=MARGEN, rightMargin=MARGEN, topMargin=MARGEN, bottomMargin=22 * mm,
    title="Archivum — Estado de conformidad Veri*Factu y consultas a la AEAT",
    author="Archivum", subject="RD 1007/2023 y Orden HAC/1177/2024",
)
frame = Frame(MARGEN, 22 * mm, ANCHO, H - MARGEN - 22 * mm, id="f")
doc.addPageTemplates([PageTemplate(id="normal", frames=[frame], onPage=pie)])
doc.build(story)
print("OK →", SALIDA)
