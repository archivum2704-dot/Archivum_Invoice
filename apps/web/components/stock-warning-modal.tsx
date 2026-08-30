"use client"

import { useState } from "react"
import { PackageX, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StockWarning } from "@/lib/stock"

interface StockWarningModalProps {
  warnings: StockWarning[]
  /** Extra note shown once above the list — e.g. "no podrá deshacerse". */
  note?: string
  onCancel: () => void
  /** Called once the user chooses to bill anyway. */
  onConfirm: () => Promise<void> | void
}

/**
 * Shown right before issuing an invoice when one or more lines would take a
 * tracked product to or below its reorder floor. Purely advisory — it never
 * blocks on its own, it just makes the decision explicit instead of letting
 * stock run out silently.
 */
export function StockWarningModal({ warnings, note, onCancel, onConfirm }: StockWarningModalProps) {
  const [confirming, setConfirming] = useState(false)

  const handleConfirm = async () => {
    setConfirming(true)
    try { await onConfirm() } finally { setConfirming(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-lg bg-background rounded-2xl shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[var(--status-pending)]/5">
          <div className="flex items-center gap-2">
            <PackageX className="w-5 h-5 text-[var(--status-pending)]" />
            <h2 className="text-base font-bold text-foreground">Stock por debajo del mínimo</h2>
          </div>
          <button onClick={onCancel} disabled={confirming} className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Al emitir esta factura, {warnings.length === 1 ? "este producto quedará" : "estos productos quedarán"} por debajo de su stock mínimo:
          </p>

          <div className="space-y-2">
            {warnings.map(w => (
              <div key={w.productId} className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-xl border border-border">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{w.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {w.currentStock} {w.unit} disponibles − {w.quantity} {w.unit} de esta factura
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn("text-sm font-bold tabular-nums", w.afterStock < 0 ? "text-destructive" : "text-[var(--status-pending)]")}>
                    {w.afterStock} {w.unit}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">mínimo {w.minStock}</p>
                </div>
              </div>
            ))}
          </div>

          {note && <p className="text-xs text-muted-foreground leading-relaxed">{note}</p>}
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={confirming}
            className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {confirming && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirming ? "Emitiendo…" : "Emitir de todas formas"}
          </button>
        </div>
      </div>
    </div>
  )
}
