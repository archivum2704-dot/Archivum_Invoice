# Archivum — Estado del Proyecto
> Última actualización: 29 de abril de 2026

---

## ¿Qué es Archivum?

Archivum es un archivo digital de documentos fiscales y facturas para empresas. Permite subir, organizar, filtrar y exportar documentos como facturas, albaranes, contratos y más. Diseñado para que el administrador de una empresa gestione su documentación y comparta acceso con su equipo.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16.1.6 (App Router + Turbopack) |
| Estilos | Tailwind CSS + shadcn/ui |
| Autenticación | Supabase Auth |
| Base de datos | Supabase (PostgreSQL) con RLS |
| Almacenamiento | Supabase Storage |
| i18n | next-intl (ES / EN) |
| Data fetching | SWR |
| Deploy | Vercel |
| Monorepo | Turborepo |

---

## Rutas Disponibles

### Públicas (sin autenticación)
| Ruta | Descripción |
|---|---|
| `/auth/login` | Login con dos pestañas: **Empresa** (email/contraseña) y **Usuario** (código de empresa + credenciales) |
| `/auth/signup` | Registro de nuevo administrador de empresa |
| `/auth/reset-password` | Solicitud de restablecimiento de contraseña |

### Protegidas (requieren sesión)
| Ruta | Descripción | Quién la ve |
|---|---|---|
| `/dashboard` | Panel con estadísticas, documentos recientes y accesos rápidos | Todos |
| `/biblioteca` | Biblioteca de documentos con filtros, búsqueda y exportación | Todos |
| `/buscador` | Búsqueda avanzada con filtros por tipo, estado, fecha, empresa y tags | Todos |
| `/subir` | Formulario para subir y archivar nuevos documentos | Miembro, Admin, Owner |
| `/empresas` | Gestión de empresas/clientes con modal de creación | Admin, Owner |
| `/usuarios` | Gestión de usuarios del equipo con límite de 3 | Admin, Owner |
| `/configuracion` | Configuración de la organización (código de acceso, identidad, contacto, dirección) | Admin, Owner |
| `/factura/[id]` | Vista detallada de un documento individual | Todos |
| `/admin-dashboard` | Panel global de la plataforma (todas las orgs y usuarios) | Platform Admin |
| `/onboarding` | Creación de organización para usuarios nuevos sin organización | Usuarios sin org |

---

## Funcionalidades Implementadas

### Autenticación y Acceso
- Login con email/contraseña (tab **Empresa** para owners/admins)
- Login con código de empresa + credenciales (tab **Usuario** para miembros del equipo)
- Registro de nueva cuenta con confirmación por email
- Restablecimiento de contraseña por email
- Cierre de sesión desde la barra lateral
- Redirección automática a `/onboarding` si el usuario no tiene organización

### Onboarding
- Formulario para crear una nueva organización (nombre + identificador URL)
- Generación automática de código de acceso único para la empresa
- El creador queda como **owner** automáticamente

### Dashboard
- Estadísticas: total de documentos, facturas, albaranes y recibos
- Contador de documentos del mes actual
- Gráfico de actividad mensual (últimos 6 meses)
- Lista de documentos recientes
- Accesos rápidos: facturas de hoy, pendientes de pago, empresas activas, búsqueda avanzada
- Botón **Nuevo Documento** (navega a `/subir`)
- Botón secundario **Nueva Empresa** (abre `/empresas`)

### Biblioteca de Documentos
- Listado tabular de todos los documentos de la organización
- Filtros por tipo de documento y estado
- Búsqueda por ID o nombre de empresa
- Exportación a **CSV** y **Excel (.xls)**
- Columnas: documento, empresa, tipo, importe, fecha, estado/etiquetas

### Buscador Avanzado
- Filtros combinables: tipo, estado, fecha, empresa, tags
- Búsqueda por número de documento, empresa, importe, CIF
- Ordenación por fecha
- Estado vacío con mensaje de ayuda

### Subir Documento
- Carga de archivos PDF/imagen (drag & drop o clic), máx. 25 MB
- Selección de tipo de documento (10 tipos disponibles)
- Selección de empresa/cliente desde datos reales de Supabase
- Enlace **"+ Nueva empresa"** directo a `/empresas` si no hay empresas
- Campos: número, fecha de emisión, importe (EUR), estado, notas, tags
- Estado de éxito con opción de ver en biblioteca o subir otro

### Tipos de Documento
`order`, `receipt`, `delivery_note`, `invoice_issued`, `invoice_received`, `quote`, `contract`, `payroll`, `tax`, `other`

### Estados de Documento
`draft`, `pending`, `paid`, `overdue`, `cancelled`

### Gestión de Empresas (`/empresas`)
- Listado de todas las empresas/clientes de la organización
- Búsqueda por nombre o CIF
- Modal de creación de empresa (nombre, CIF, sector, ciudad, teléfono, email)
- Estado vacío con llamada a la acción
- Acceso a documentos de cada empresa
- Total facturado por empresa

### Gestión de Usuarios (`/usuarios`)
- Listado de miembros del equipo con su rol, nombre y email
- Contador: **X de 3 usuarios** (límite máximo por organización)
- Formulario de creación de usuario (nombre, apellido, email, rol)
- El nuevo usuario recibe email de activación y establece su contraseña
- El botón de añadir se deshabilita al alcanzar el límite
- Cambio de rol por dropdown
- Eliminación de miembro con confirmación
- Panel de acceso a empresas por miembro (asignar qué empresas puede ver)
- Leyenda de roles con descripción de permisos

### Roles de Usuario

#### Rol de Plataforma
| Rol | Descripción |
|---|---|
| `super_admin` | Acceso a todas las organizaciones — panel admin global |
| `user` | Usuario estándar de la plataforma |

#### Rol en la Organización
| Rol | Permisos | Qué ve en el sidebar |
|---|---|---|
| `owner` | Control total | Todo |
| `admin` | Gestión de miembros y empresas | Todo |
| `member` | Subir y ver documentos | Dashboard, Biblioteca, Buscador, Subir |
| `viewer` | Solo lectura | Dashboard, Biblioteca, Buscador |

### Configuración de Organización (`/configuracion`)
- **Acceso**: código de empresa con copia al portapapeles
- **Identidad**: nombre de la organización y CIF/NIF
- **Contacto**: teléfono y email de la organización
- **Dirección**: dirección, ciudad y país
- Guardado con feedback visual (confirmación/error)

### Internacionalización (i18n)
- Idiomas soportados: **Español** y **Inglés**
- Selector de idioma persistente en la barra lateral (cookie)
- Cobertura: login, signup, reset de contraseña, navegación, dashboard, documentos, empresas, usuarios, configuración, exportación, búsqueda

### Panel de Admin (`/admin-dashboard`)
- Vista global de todas las organizaciones de la plataforma
- Lista de todos los usuarios registrados
- Estadísticas globales de la plataforma
- Solo visible para usuarios con rol `super_admin`

---

## Estructura de la Base de Datos

### Tablas principales

**`organizations`** — organizaciones/empresas cliente de Archivum
- `id`, `name`, `slug`, `access_code` (código de 6 chars), `cif`, `address`, `city`, `country`, `phone`, `email`, `is_active`

**`profiles`** — perfil de cada usuario autenticado
- `id` (= auth.users.id), `email`, `first_name`, `last_name`, `platform_role` (super_admin | user), `current_org_id`

**`organization_members`** — vinculación usuario ↔ organización
- `id`, `organization_id`, `user_id`, `role` (owner | admin | member | viewer), `created_at`

**`companies`** — empresas/clientes dentro de una organización
- `id`, `organization_id`, `name`, `cif`, `sector`, `city`, `phone`, `email`, `is_active`

**`documents`** — documentos archivados
- `id`, `organization_id`, `company_id`, `type`, `status`, `number`, `amount`, `issue_date`, `due_date`, `file_url`, `notes`, `tags`, `created_at`

---

## Límites y Reglas de Negocio

| Regla | Valor |
|---|---|
| Máximo de usuarios por organización | **3** (excluye al owner) |
| Tamaño máximo de archivo | **25 MB** |
| Código de acceso | **6 caracteres** alfanuméricos |
| Moneda | **EUR** (fijo por ahora) |

---

## ⚠️ Lo que frena venderlo fuerte hoy

Estas son las brechas críticas antes de cobrar bien por el producto:

### 1. ❌ No hay preview de documentos — Prioridad #1
El usuario no puede ver el PDF sin descargarlo. Esto es un bloqueador de UX importante:
- Rompe el flujo de revisión rápida de facturas
- Le quita la sensación de herramienta "pro"
- Cualquier competidor con preview gana en percepción de valor

**Fix**: Visualizador inline (iframe / react-pdf) en la vista `/factura/[id]`.

### 2. ❌ No hay workflow real de documentos
Hoy Archivum es un archivo. Para ser una herramienta de gestión necesita flujo:

> Orden → Albarán → Factura

Sin esto el usuario guarda documentos pero no *trabaja* con ellos. Ese salto es el que convierte un archivo en una herramienta por la que se paga.

### 3. ❌ No hay notificaciones
Sin alertas, el usuario entra cuando se acuerda, no cuando lo necesita. El caso más crítico:
- Factura en estado `overdue` → sin notificación → el usuario no lo ve → pierde dinero → culpa a la herramienta

**Fix mínimo viable**: email/badge en dashboard cuando hay documentos vencidos.

### 4. ❌ Falta un hook comercial claro
El copy actual "archivo digital de documentos" describe *qué es*, no *por qué importa*. No vende solo. Propuestas de posicionamiento más potentes:

> "Tu contabilidad organizada sin estrés"
> "Centraliza todas tus facturas en un solo lugar"
> "Olvídate de perder documentos fiscales"

Esto no es código — es lo primero que ve un posible cliente. Hay que alinearlo antes de salir a vender.

---

## Pendiente / Próximas funcionalidades

- [ ] Visualizador de PDF inline (preview sin descarga) — **🔥 Prioridad #1**
- [ ] Flujo de documentos vinculados (Orden → Albarán → Factura) — **🔥 Prioridad #2**
- [ ] Notificaciones de documentos vencidos (`overdue`) — **🔥 Prioridad #3**
- [ ] Filtrado por empresa en `/biblioteca`
- [ ] Subida de logo de organización
- [ ] Paginación real en biblioteca (hoy carga todos)
- [ ] Soporte para múltiples monedas
- [ ] Aumento del límite de usuarios (planes de precio)
- [ ] Panel de actividad / log de auditoría
- [ ] Acceso granular por empresa para miembros (`company_access`)
