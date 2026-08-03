/**
 * Which sections each kind of member may open.
 *
 * Single source of truth for the sidebar (which entries render locked) and for
 * the pages themselves (which render an "acceso restringido" notice instead of
 * their content). Keeping both sides on one table is what stops the menu and
 * the pages from drifting apart.
 *
 * This governs navigation only. The real boundary is the database: row-level
 * security decides what a member can read and write regardless of what the
 * interface shows.
 */

export type SectionId =
  | 'dashboard'
  | 'biblioteca'
  | 'buscador'
  | 'inventario'
  | 'presupuestos'
  | 'albaranes'
  | 'facturacion'
  | 'subir'
  | 'empresas'
  | 'usuarios'
  | 'admin'

export type AccessContext = {
  isPlatformAdmin: boolean
  /** owner | admin (or platform admin) */
  isOrgAdmin: boolean
  /** read-only member — external auditors (Hacienda, DIAN…) */
  isViewer: boolean
  /** Has upload rights on at least one assigned client */
  canUploadSomewhere: boolean
}

/** Reason a section is closed, so the notice can explain itself. */
export type DenyReason = 'role' | 'noCompanies'

const ALWAYS = (): true => true

const RULES: Record<SectionId, (c: AccessContext) => true | DenyReason> = {
  // Everyone gets an overview, the archive and search. What they actually
  // contain is already scoped per member by the database.
  dashboard:    ALWAYS,
  biblioteca:   ALWAYS,
  buscador:     ALWAYS,

  // Issued invoices are readable by any member — an auditor reviewing them is
  // the point of the viewer role. Creating them is gated inside the page.
  facturacion:  ALWAYS,

  // Stock is an operational tool: useful to members, meaningless to auditors.
  inventario:   c => c.isViewer ? 'role' : true,

  // Quotes are commercial documents only admins draft, and a delivery note is
  // where a quote gets billed — same audience.
  presupuestos: c => c.isOrgAdmin ? true : 'role',
  albaranes:    c => c.isOrgAdmin ? true : 'role',

  // Uploading needs both a role that may write and a client to write into.
  subir: c => {
    if (c.isViewer) return 'role'
    if (c.isOrgAdmin || c.canUploadSomewhere) return true
    return 'noCompanies'
  },

  empresas:     c => c.isOrgAdmin ? true : 'role',
  usuarios:     c => c.isOrgAdmin ? true : 'role',
  admin:        c => c.isPlatformAdmin ? true : 'role',
}

/** True when the member may open the section. */
export function canAccess(id: SectionId, ctx: AccessContext): boolean {
  return RULES[id](ctx) === true
}

/** Why the section is closed, or null when it is open. */
export function denyReason(id: SectionId, ctx: AccessContext): DenyReason | null {
  const result = RULES[id](ctx)
  return result === true ? null : result
}
