import Link from 'next/link'
import { ShieldCheck, AlertTriangle, ArrowLeft } from 'lucide-react'
import { declaracionResponsable } from '@/lib/declaracion-responsable'

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
            <h1 className="text-2xl font-bold text-foreground">Declaración responsable</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sistema informático de facturación · Real Decreto 1007/2023 y Orden HAC/1177/2024
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
                Los datos técnicos que figuran a continuación describen el sistema, pero no
                constituyen una certificación de cumplimiento.
              </p>
              {d.missing.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Pendiente de aportar: {d.missing.join(', ')}.
                </p>
              )}
            </div>
          </div>
        )}

        <Section title="Identificación del sistema">
          <Row label="Nombre" value={d.system.name} />
          <Row label="Identificador" value={d.system.id} />
          <Row label="Versión" value={d.system.version} />
          <Row label="Modo de operación" value="VERI*FACTU (remisión a la AEAT)" />
        </Section>

        <Section title="Tipología">
          <p className="text-sm text-foreground leading-relaxed">{d.system.typology}</p>
        </Section>

        <Section title="Composición">
          <ul className="space-y-1.5">
            {d.system.composition.map(c => (
              <li key={c} className="text-sm text-foreground flex gap-2">
                <span className="text-muted-foreground">·</span>{c}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Funcionalidades">
          <ul className="space-y-1.5">
            {d.system.functionalities.map(f => (
              <li key={f} className="text-sm text-foreground flex gap-2">
                <span className="text-muted-foreground">·</span>{f}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Características de la instalación">
          <p className="text-sm text-foreground leading-relaxed">{d.system.installation}</p>
        </Section>

        <Section title="Productor del sistema">
          <Row label="Razón social" value={d.producer.nombreRazon} />
          <Row label="NIF" value={d.producer.nif} />
          <Row label="Domicilio" value={d.producer.address} />
          <Row label="Correo" value={d.producer.email} />
          <Row label="Web" value={d.producer.website} />
        </Section>

        <Section title="Firma">
          <Row label="Lugar" value={d.signature.place} />
          <Row label="Fecha" value={d.signature.date} />
        </Section>

        <p className="text-xs text-muted-foreground mt-10 leading-relaxed">
          Esta declaración se refiere a la versión {d.system.version} del sistema. El productor
          conserva las declaraciones responsables de todas las versiones producidas o
          comercializadas, conforme al artículo 13.3 del RD 1007/2023.
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{title}</h2>
      <div className="bg-card border border-border rounded-xl p-5">{children}</div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={value ? 'text-sm text-foreground text-right' : 'text-sm text-[var(--status-pending)] text-right'}>
        {value ?? 'Pendiente'}
      </span>
    </div>
  )
}
