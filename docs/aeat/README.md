# Documentación técnica de la AEAT

Descargada de la página de desarrolladores y de la sede electrónica de la AEAT
el **10 de agosto de 2026**.

**Está aquí porque los dominios de la AEAT están bloqueados desde el entorno de
trabajo.** Sin estos ficheros en el repositorio, cada sesión vuelve a quedarse
sin la referencia y a implementar «según la norma» sin poder contrastar nada,
que es exactamente como se llegó a tener mal la huella del registro de eventos.

## Lo que usa el código directamente

| Fichero | Para qué |
|---|---|
| `Veri-Factu_especificaciones_huella_hash_registros.pdf` | **v0.1.2.** Fija los campos, su orden, el formato de concatenación y la codificación de las tres huellas. Sus tres ejemplos del apartado 6 son los vectores de `scripts/verifactu-vectors.ts` |
| `CodigosError.txt` | Los 247 códigos de error, de donde se genera `lib/verifactu-error-codes.ts` |
| `WSDL de los servicios web.txt` | Las cuatro direcciones del servicio `sfVerifactu`: representante y sello, pruebas y producción |
| `EventosSIF.xsd.txt` | Estructura del registro de eventos y los códigos de `TipoEvento` |
| `SuministroLR.xsd.txt`, `SuministroInformacion.xsd.txt` | Alta y anulación; tipos comunes |
| `RespuestaSuministro.xsd.txt` | Respuesta del servicio |

## Referencia, sin uso directo todavía

`Veri-Factu_Descripcion_SWeb.pdf`, `Validaciones_Errores_Veri-Factu.pdf`,
`FAQs-Desarrolladores.pdf`, `DetalleEspecificacTecnCodigoQRfactura.pdf`,
`EjemplosDeclaracionResponsable.pdf`, `DsRegistroVeriFactu.xlsx`,
`ejemploRegistro*.xml`, y los ficheros de la operación de consulta.

`EspecTecGenerFirmaElectRfact.pdf` y
`Descripcion_ServicioWeb_ValidacionNoVerifactu.pdf` describen la firma
electrónica y la validación de los sistemas **NO VERI\*FACTU**. Archivum opera
como VERI\*FACTU, así que no aplican hoy; se conservan por si cambia el modo.

## Antes de fiarte de esto

Son documentos con versión y la AEAT los actualiza. El de la huella es el
v0.1.2 de 27/08/2024. **Si aparece una versión nueva, hay que volver a pasar
`npm run verifactu:check`**: los vectores del apartado 6 son lo que confirma
que nuestra huella sigue siendo la que la AEAT espera.

No se ha modificado ningún fichero. Los `.xsd.txt` conservan el contenido tal
cual se descargó; solo se les ha simplificado el nombre, que traía la
descripción larga y caracteres escapados.
