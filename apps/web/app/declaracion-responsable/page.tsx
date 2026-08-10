import Link from 'next/link'
import { ShieldCheck, AlertTriangle, ArrowLeft } from 'lucide-react'
import { declaracionResponsable, type DeclaracionField } from '@/lib/declaracion-responsable'

export const metadata = {
  title: 'Declaración responsable · Archivum',
  description: 'Declaración responsable del sistema informático de facturación, conforme al RD 1007/2023.',
}

/**
 * The declaración responsable, public and unauthenticated.
 *
 * Article 13.2 requires it to be visible in the software itself and available
 * to the client and the reseller at the moment of acquisition — which rules
 * out putting it behind a login, since someone deciding whether to buy has no
 * account yet.
 *
 * Laid out in the AEAT's numbered sections so it reads as the form they
 * publish, not as a page that happens to contain the same facts.
 */
export default function DeclaracionResponsablePage() {
  const d = declaracionResponsable()

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        <div className="flex items-start gap-3 mb-2">
          <ShieldCheck className="w-7 h-7 text-primary shrink-0 mt-0.5" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Declaración responsable del sistema informático de facturación
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real Decreto 1007/2023 y Orden HAC/1177/2024
            </p>
          </div>
        </div>

        {/* The honest state. A page that read like a declaration while none had
            been signed would assert a conformity nobody has certified. */}
        {!d.issued && (
          <div className="flex items-start gap-2.5 bg-[var(--status-pending)]/10 border border-[var(--status-pending)]/20 rounded-xl px-4 py-3.5 my-6">
            <AlertTriangle className="w-4 h-4 text-[var(--status-pending)] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[var(--status-pending)]">
                Declaración responsable no emitida
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                El productor todavía no ha emitido la declaración responsable de esta versión.
                Hasta que se emita, este sistema no puede considerarse conforme al RD 1007/2023.
                Los datos que figuran a continuación describen el sistema, pero no constituyen
                una certificación de cumplimiento.
              </p>
              {d.missing.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Pendiente de aportar: {d.missing.join('; ')}.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 space-y-4">
          {d.fields.map(f => <Field key={f.ref} field={f} />)}
        </div>

        <h2 className="text-lg font-bold text-foreground mt-12 mb-1">Anexo</h2>
        <div className="mt-4 space-y-4">
          {d.annex.map(f => <Field key={f.ref} field={f} />)}
        </div>

        <p className="text-xs text-muted-foreground mt-10 leading-relaxed">
          Esta declaración se refiere a la versión {d.fields.find(f => f.ref === '1.c')?.value} del
          sistema. El productor conserva las declaraciones responsables de todas las versiones
          producidas o comercializadas, conforme al artículo 13.3 del RD 1007/2023.
        </p>
      </div>
    </div>
  )
}

function Field({ field }: { field: DeclaracionField }) {
  const { ref, label, value } = field
  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-2.5 leading-snug">
        <span className="text-primary font-mono mr-1.5">{ref})</span>
        {label}
      </h3>
      {value === null ? (
        <p className="text-sm text-[var(--status-pending)]">Pendiente</p>
      ) : Array.isArray(value) ? (
        <div className="space-y-2.5">
          {value.map((v, i) => (
            <p key={i} className="text-sm text-foreground leading-relaxed">{v}</p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-foreground leading-relaxed">{value}</p>
      )}
    </section>
  )
}
