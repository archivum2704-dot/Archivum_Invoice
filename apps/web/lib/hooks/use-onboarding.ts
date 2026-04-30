import { useMemo } from "react"
import { useCompanies } from "@/lib/hooks/use-companies"
import { useDocuments } from "@/lib/hooks/use-documents"

export type OnboardingStep = {
  id: string
  label: string
  description: string
  href: string
  cta: string
  done: boolean
}

export function useOnboarding(orgId: string | null) {
  const { companies, loading: companiesLoading } = useCompanies(orgId)
  const { documents, loading: docsLoading }      = useDocuments(orgId)

  const loading = companiesLoading || docsLoading

  const steps: OnboardingStep[] = useMemo(() => [
    {
      id:          "org",
      label:       "Organización creada",
      description: "Ya tienes tu espacio de trabajo listo.",
      href:        "/configuracion",
      cta:         "Ver ajustes",
      done:        !!orgId,
    },
    {
      id:          "company",
      label:       "Añade tu primera empresa",
      description: "Vincula clientes o proveedores a tus documentos.",
      href:        "/empresas",
      cta:         "Añadir empresa",
      done:        companies.length > 0,
    },
    {
      id:          "document",
      label:       "Sube tu primer documento",
      description: "Archiva una factura, albarán o pedido.",
      href:        "/subir",
      cta:         "Subir documento",
      done:        documents.length > 0,
    },
    {
      id:          "explore",
      label:       "Explora tu biblioteca",
      description: "Filtra, busca y exporta todos tus documentos.",
      href:        "/biblioteca",
      cta:         "Ir a biblioteca",
      done:        documents.length > 0,
    },
  ], [orgId, companies.length, documents.length])

  const completedCount = steps.filter(s => s.done).length
  const totalCount     = steps.length
  const allDone        = completedCount === totalCount
  const pct            = Math.round((completedCount / totalCount) * 100)

  return { steps, completedCount, totalCount, allDone, pct, loading }
}
