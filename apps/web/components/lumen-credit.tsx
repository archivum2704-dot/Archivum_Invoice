// Crédito del estudio que diseñó la web («Diseñado por Lumen Studio»), con el símbolo de la llama de Lumen.
// Un solo componente para la landing y el login, para que no diverjan. El enlace lleva UTM para medir
// en la web del estudio las visitas que llegan desde Archivum.
const LUMEN_STUDIO_URL =
  'https://lumen-ruddy-beta.vercel.app/?utm_source=archivum&utm_medium=referral&utm_campaign=credito'

export function LumenCredit({
  label = 'Diseñado por',
  ariaLabel = 'Diseñado por Lumen Studio (se abre en una pestaña nueva)',
  className = '',
}: {
  label?: string
  ariaLabel?: string
  className?: string
}) {
  return (
    <a
      href={LUMEN_STUDIO_URL}
      target="_blank"
      rel="noopener"
      aria-label={ariaLabel}
      className={`group inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <span>{label}</span>
      <svg
        viewBox="0 0 64 64"
        width={16}
        height={16}
        aria-hidden="true"
        focusable="false"
        className="shrink-0 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
      >
        <circle cx="32" cy="32" r="28" fill="currentColor" />
        <path d="M32 14c8 9 12 15 12 21.5a12 12 0 0 1-24 0C20 29 24 23 32 14z" fill="#f2a93b" />
        <path d="M32 30c3 3.5 4.5 6 4.5 8.5a4.5 4.5 0 0 1-9 0c0-2.5 1.5-5 4.5-8.5z" fill="#fff4dc" />
      </svg>
      <strong className="font-semibold">Lumen Studio</strong>
    </a>
  )
}
