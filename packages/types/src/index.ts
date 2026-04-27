// Tipos de base de datos Supabase (puedes regenerarlos con: supabase gen types typescript)
export interface Database {
  public: {
    Tables: {
      invoices: {
        Row: Invoice;
        Insert: Omit<Invoice, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Invoice, "id" | "created_at">>;
      };
      clients: {
        Row: Client;
        Insert: Omit<Client, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Client, "id" | "created_at">>;
      };
      invoice_items: {
        Row: InvoiceItem;
        Insert: Omit<InvoiceItem, "id">;
        Update: Partial<Omit<InvoiceItem, "id">>;
      };
    };
  };
}

export type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  total: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  tax_id?: string | null; // NIF/CIF para España
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

// Tipo enriquecido con relaciones
export interface InvoiceWithClient extends Invoice {
  client_name: string;
  client_email: string;
  items?: InvoiceItem[];
}
