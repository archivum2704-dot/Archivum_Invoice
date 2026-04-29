export type DocumentType =
  | 'order'
  | 'receipt'
  | 'delivery_note'
  | 'invoice_issued'
  | 'invoice_received'
  | 'quote'
  | 'contract'
  | 'payroll'
  | 'tax'
  | 'other'

export type DocumentStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled'

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'

export type PlatformRole = 'super_admin' | 'user'

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          access_code: string
          cif: string | null
          address: string | null
          city: string | null
          postal_code: string | null
          country: string
          phone: string | null
          email: string | null
          logo_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          cif?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          is_active?: boolean
        }
        Update: {
          name?: string
          slug?: string
          cif?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          platform_role: PlatformRole
          current_org_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          platform_role?: PlatformRole
          current_org_id?: string | null
        }
        Update: {
          email?: string
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          platform_role?: PlatformRole
          current_org_id?: string | null
          updated_at?: string
        }
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: OrgRole
          invited_by: string | null
          joined_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role?: OrgRole
          invited_by?: string | null
        }
        Update: {
          role?: OrgRole
        }
      }
      companies: {
        Row: {
          id: string
          organization_id: string
          parent_company_id: string | null
          name: string
          cif: string | null
          sector: string | null
          address: string | null
          city: string | null
          postal_code: string | null
          country: string
          phone: string | null
          email: string | null
          contact_person: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          parent_company_id?: string | null
          name: string
          cif?: string | null
          sector?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string
          phone?: string | null
          email?: string | null
          contact_person?: string | null
          notes?: string | null
          is_active?: boolean
        }
        Update: {
          parent_company_id?: string | null
          name?: string
          cif?: string | null
          sector?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string
          phone?: string | null
          email?: string | null
          contact_person?: string | null
          notes?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      company_user_access: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          company_id: string
          can_upload: boolean
          can_edit: boolean
          can_delete: boolean
          granted_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          company_id: string
          can_upload?: boolean
          can_edit?: boolean
          can_delete?: boolean
          granted_by?: string | null
        }
        Update: {
          can_upload?: boolean
          can_edit?: boolean
          can_delete?: boolean
        }
      }
      documents: {
        Row: {
          id: string
          organization_id: string
          company_id: string | null
          uploaded_by: string | null
          parent_document_id: string | null
          document_number: string | null
          document_type: DocumentType
          status: DocumentStatus
          subtotal: number | null
          tax_rate: number
          tax_amount: number | null
          total: number | null
          currency: string
          issue_date: string | null
          due_date: string | null
          payment_date: string | null
          file_url: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          description: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          company_id?: string | null
          uploaded_by?: string | null
          parent_document_id?: string | null
          document_number?: string | null
          document_type?: DocumentType
          status?: DocumentStatus
          subtotal?: number | null
          tax_rate?: number
          tax_amount?: number | null
          total?: number | null
          currency?: string
          issue_date?: string | null
          due_date?: string | null
          payment_date?: string | null
          file_url?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          description?: string | null
          notes?: string | null
        }
        Update: {
          company_id?: string | null
          parent_document_id?: string | null
          document_number?: string | null
          document_type?: DocumentType
          status?: DocumentStatus
          subtotal?: number | null
          tax_rate?: number
          tax_amount?: number | null
          total?: number | null
          currency?: string
          issue_date?: string | null
          due_date?: string | null
          payment_date?: string | null
          file_url?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          description?: string | null
          notes?: string | null
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
          tax_rate: number
          subtotal: number | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          description: string
          quantity?: number
          unit_price: number
          tax_rate?: number
          subtotal?: number | null
        }
        Update: {
          description?: string
          quantity?: number
          unit_price?: number
          tax_rate?: number
          subtotal?: number | null
        }
      }
      tags: {
        Row: {
          id: string
          organization_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          color?: string
        }
        Update: {
          name?: string
          color?: string
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
        Update: never
      }
      activity_log: {
        Row: {
          id: string
          organization_id: string
          user_id: string | null
          document_id: string | null
          action: string
          resource_type: string | null
          details: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id?: string | null
          document_id?: string | null
          action: string
          resource_type?: string | null
          details?: Record<string, unknown> | null
        }
        Update: never
      }
    }
    Functions: {
      is_platform_admin: { Args: Record<never, never>; Returns: boolean }
      is_org_member: { Args: { org_id: string }; Returns: boolean }
      is_org_admin: { Args: { org_id: string }; Returns: boolean }
      can_access_company: { Args: { co_id: string }; Returns: boolean }
      create_organization_with_owner: {
        Args: { org_name: string; org_slug: string; owner_id: string }
        Returns: string
      }
    }
  }
}
