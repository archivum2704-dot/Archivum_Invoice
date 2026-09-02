import Link from 'next/link'
import { ArrowLeft, type LucideIcon } from 'lucide-react'

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'quote'; lines: string[] }

export interface LegalArticle {
  heading: string
  blocks: LegalBlock[]
}

/**
 * Shared shell for the legal pages once they carry real text from the lawyer
 * (as opposed to LegalPlaceholder, which is for the ones still pending).
 * Mirrors the layout of /declaracion-responsable so all four legal pages
 * read as one family.
 */
export function LegalDocument({
  icon: Icon,
  title,
  subtitle,
  lastUpdated,
  intro,
  articles,
  footer,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  lastUpdated: string
  intro?: LegalBlock[]
  articles: LegalArticle[]
  footer?: LegalBlock[]
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
        <p className="text-xs text-muted-foreground mb-8">Última actualización: {lastUpdated}</p>

        {intro && (
          <div className="space-y-3 mb-10">
            {intro.map((b, i) => <Block key={i} block={b} />)}
          </div>
        )}

        <div className="space-y-9">
          {articles.map((a, i) => (
            <section key={i}>
              <h2 className="text-base font-semibold text-foreground mb-3 leading-snug">{a.heading}</h2>
              <div className="space-y-3">
                {a.blocks.map((b, j) => <Block key={j} block={b} />)}
              </div>
            </section>
          ))}
        </div>

        {footer && (
          <div className="mt-12 pt-6 border-t border-border space-y-1.5 text-sm text-muted-foreground">
            {footer.map((b, i) => <Block key={i} block={b} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === 'list') {
    return (
      <ul className="list-disc pl-5 space-y-1.5 marker:text-muted-foreground">
        {block.items.map((it, i) => (
          <li key={i} className="text-sm text-foreground leading-relaxed">{it}</li>
        ))}
      </ul>
    )
  }
  if (block.type === 'quote') {
    return (
      <div className="bg-card border border-border rounded-xl px-4 py-3.5 space-y-1">
        {block.lines.map((l, i) => (
          <p key={i} className="text-sm text-foreground leading-relaxed">{l || ' '}</p>
        ))}
      </div>
    )
  }
  return <p className="text-sm text-foreground leading-relaxed">{block.text}</p>
}
