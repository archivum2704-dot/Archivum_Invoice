export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          website: string | null
          industry: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          website?: string | null
          industry?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          slug?: string
          logo_url?: string | null
          website?: string | null
          industry?: string | null
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          created_at?: string
        }
        Update: {
          role?: 'owner' | 'admin' | 'member'
        }
      }
      companies: {
        Row: {
          id: string
          organization_id: string
          name: string
          cif: string
          sector: string | null
          city: string | null
          address: string | null
          phone: string | null
          email: string | null
          contact_person: string | null
          total_invoiced: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          cif: string
          sector?: string | null
          city?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          contact_person?: string | null
          total_invoiced?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          cif?: string
          sector?: string | null
          city?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          contact_person?: string | null
          total_invoiced?: number
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          organization_id: string
          company_id: string
          document_number: string
          document_type: 'invoice' | 'receipt' | 'report' | 'contract'
          date: string
          due_date: string | null
          status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
          total_amount: number
          tax_amount: number | null
          subtotal: number | null
          description: string | null
          file_url: string | null
          file_path: string | null
          file_size: number | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          company_id: string
          document_number: string
          document_type: 'invoice' | 'receipt' | 'report' | 'contract'
          date: string
          due_date?: string | null
          status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
          total_amount: number
          tax_amount?: number | null
          subtotal?: number | null
          description?: string | null
          file_url?: string | null
          file_path?: string | null
          file_size?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
          total_amount?: number
          tax_amount?: number | null
          subtotal?: number | null
          description?: string | null
          file_url?: string | null
          updated_at?: string
        }
      }
      document_items: {
        Row: {
          id: string
          document_id: string
          description: string
          quantity: number
          unit_price: number
          line_total: number
          tax_rate: number | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          description: string
          quantity: number
          unit_price: number
          line_total: number
          tax_rate?: number | null
          created_at?: string
        }
        Update: {
          description?: string
          quantity?: number
          unit_price?: number
          line_total?: number
          tax_rate?: number | null
        }
      }
      tags: {
        Row: {
          id: string
          organization_id: string
          name: string
          color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          color?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          color?: string | null
        }
      }
      document_tags: {
        Row: {
          document_id: string
          tag_id: string
        }
        Insert: {
          document_id: string
          tag_id: string
        }
        Update: {
          document_id?: string
          tag_id?: string
        }
      }
      activity_log: {
        Row: {
          id: string
          organization_id: string
          user_id: string | null
          action: string
          resource_type: string | null
          resource_id: string | null
          details: Record<string, any> | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id?: string | null
          action: string
          resource_type?: string | null
          resource_id?: string | null
          details?: Record<string, any> | null
          created_at?: string
        }
        Update: never
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
