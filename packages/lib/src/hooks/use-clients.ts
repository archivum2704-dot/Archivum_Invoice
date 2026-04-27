import useSWR from "swr";
import { supabase } from "../supabase/client";

async function fetchClients() {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data;
}

export function useClients() {
  const { data, error, isLoading, mutate } = useSWR("clients", fetchClients);

  return {
    clients: data,
    error,
    isLoading,
    mutate,
  };
}

export async function createClient(payload: {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  tax_id?: string;
}) {
  const { data, error } = await supabase
    .from("clients")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}
