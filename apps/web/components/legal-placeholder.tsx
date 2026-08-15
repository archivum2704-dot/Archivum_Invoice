import Link from 'next/link'
import { AlertTriangle, ArrowLeft, type LucideIcon } from 'lucide-react'

export interface LegalSection {
  title: string
  /** What this section will cover once the final text is drafted — not the text itself. */
  summary: string
}

/**
 * Shared shell for the legal pages still pending final text from a lawyer
 * (política de privacidad, cookies, términos de servicio).
 *
 * Deliberately does not draft legal text: a placeholder that read like a
 * finished policy would give a false sense of legal cover, which is the one
 * thing this page exists to avoid. It states plainly that it isn't final yet
 * and lists what each section will address, mirroring how
 * /declaracion-responsable handles "not issued yet" — the honest state,
 * not an invented one.
 */
export function LegalPlaceholder({
  icon: Icon,
  title,
  subtitle,
  sections,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  sections: LegalSection[]
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        <div className="flex items-start gap-3 mb-2">
          <Icon className="w-7 h-7 text-primary shrink-0 mt-0.5" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 bg-[var(--status-pending)]/10 border border-[var(--status-pending)]/20 rounded-xl px-4 py-3.5 my-6">
          <AlertTriangle className="w-4 h-4 text-[var(--status-pending)] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[var(--status-pending)]">
              Texto pendiente de redacción legal
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Esta página existe para que el enlace no falte, pero el contenido que sigue no es
              el texto legal definitivo — es un índice de lo que cubrirá cuando esté redactado
              y revisado por un abogado. No lo trates como una política vigente todavía.
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {sections.map(s => (
            <section key={s.title} className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-2 leading-snug">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.summary}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
