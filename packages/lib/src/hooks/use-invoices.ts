import useSWR from "swr";
import { supabase } from "../supabase/client";

async function fetchInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, clients(name, email)")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.map((inv) => ({
    ...inv,
    client_name: (inv.clients as any)?.name ?? "—",
    client_email: (inv.clients as any)?.email ?? "",
  }));
}

export function useInvoices() {
  const { data, error, isLoading, mutate } = useSWR("invoices", fetchInvoices);

  return {
    invoices: data,
    error,
    isLoading,
    mutate,
  };
}

export async function createInvoice(payload: {
  client_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  items: { description: string; quantity: number; unit_price: number }[];
  notes?: string;
}) {
  const total = payload.items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      ...payload,
      total,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateInvoiceStatus(
  id: string,
  status: "pending" | "paid" | "overdue" | "cancelled"
) {
  const { data, error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
