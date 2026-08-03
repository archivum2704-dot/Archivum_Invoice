/**
 * Which sections each kind of member may open.
 *
 * Mirror of `apps/web/lib/permissions.ts` — the two apps must grant the same
 * access, so any change here needs the same change there. They are kept as
 * separate files because Metro and Next resolve modules differently and a
 * shared workspace package would couple the mobile bundler to the web app.
 *
 * This governs navigation only. The real boundary is the database: row-level
 * security decides what a member can read and write regardless of what the
 * interface shows.
 */

export type SectionId =
  | "dashboard"
  | "biblioteca"
  | "buscar"
  | "inventario"
  | "presupuestos"
  | "albaranes"
  | "facturacion"
  | "subir"
  | "empresas"
  | "equipo"
  | "ajustes";

export type AccessContext = {
  isPlatformAdmin: boolean;
  /** owner | admin (or platform admin) */
  isOrgAdmin: boolean;
  /** read-only member — external auditors (Hacienda, DIAN…) */
  isViewer: boolean;
  /** Has upload rights on at least one assigned client */
  canUploadSomewhere: boolean;
};

/** Reason a section is closed, so the notice can explain itself. */
export type DenyReason = "role" | "noCompanies";

const ALWAYS = (): true => true;

const RULES: Record<SectionId, (c: AccessContext) => true | DenyReason> = {
  // Everyone gets an overview, the archive, search and their own settings.
  // What those contain is already scoped per member by the database.
  dashboard: ALWAYS,
  biblioteca: ALWAYS,
  buscar: ALWAYS,
  ajustes: ALWAYS,

  // Issued invoices are readable by any member — an auditor reviewing them is
  // the point of the viewer role. Creating them is gated inside the screen.
  facturacion: ALWAYS,

  // Stock is an operational tool: useful to members, meaningless to auditors.
  inventario: (c) => (c.isViewer ? "role" : true),

  // Quotes are commercial documents only admins draft, and a delivery note is
  // where a quote gets billed — same audience.
  presupuestos: (c) => (c.isOrgAdmin ? true : "role"),
  albaranes: (c) => (c.isOrgAdmin ? true : "role"),

  // Uploading needs both a role that may write and a client to write into.
  subir: (c) => {
    if (c.isViewer) return "role";
    if (c.isOrgAdmin || c.canUploadSomewhere) return true;
    return "noCompanies";
  },

  empresas: (c) => (c.isOrgAdmin ? true : "role"),
  equipo: (c) => (c.isOrgAdmin ? true : "role"),
};

/** True when the member may open the section. */
export function canAccess(id: SectionId, ctx: AccessContext): boolean {
  return RULES[id](ctx) === true;
}

/** Why the section is closed, or null when it is open. */
export function denyReason(id: SectionId, ctx: AccessContext): DenyReason | null {
  const result = RULES[id](ctx);
  return result === true ? null : result;
}
