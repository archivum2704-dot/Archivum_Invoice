import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"

export type OverdueDoc = {
  id: string
  document_number: string | null
  document_type: string
  status: string
  due_date: string | null
  total: number | null
  currency: string
  company: { name: string } | null
}

async function fetchOverdue(orgId: string): Promise<OverdueDoc[]> {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  // Fetch docs that are either:
  //   a) explicitly status=overdue, OR
  //   b) status=pending with a due_date that has already passed
  const { data, error } = await supabase
    .from("documents")
    .select("id, document_number, document_type, status, due_date, total, currency, company:companies(name)")
    .eq("organization_id", orgId)
    .or(`status.eq.overdue,and(status.eq.pending,due_date.lt.${today})`)
    .not("due_date", "is", null)
    .order("due_date", { ascending: true })

  if (error) throw error
  return (data ?? []) as OverdueDoc[]
}

export function useOverdueDocs(orgId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    orgId ? ["overdue-docs", orgId] : null,
    () => fetchOverdue(orgId!),
    { revalidateOnFocus: true, refreshInterval: 5 * 60 * 1000 }, // refresh every 5 min
  )

  return {
    overdueDocs: data ?? [],
    overdueCount: data?.length ?? 0,
    loading: isLoading,
    error,
    mutate,
  }
}
