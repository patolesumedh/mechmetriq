// Auto-generated from the live Supabase schema via `mcp__Supabase__generate_typescript_types`.
// Regenerate with: npx supabase gen types typescript --project-id qrnxhmasqpwjaceiuvds > src/lib/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          created_at: string
          full_address: string
          id: string
          is_default: boolean
          label: string
          pincode: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          full_address: string
          id?: string
          is_default?: boolean
          label: string
          pincode: string
          profile_id: string
        }
        Update: {
          created_at?: string
          full_address?: string
          id?: string
          is_default?: boolean
          label?: string
          pincode?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cad_analyses: {
        Row: {
          analysis_version: string | null
          attempts: number
          buyer_id: string
          completed_at: string | null
          created_at: string
          error: string | null
          file_name: string
          id: string
          processing_ms: number | null
          result: Json | null
          rfq_id: string | null
          status: string
          storage_path: string
          summary: Json | null
          thumbnail_path: string | null
          updated_at: string
        }
        Insert: {
          analysis_version?: string | null
          attempts?: number
          buyer_id: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          file_name: string
          id?: string
          processing_ms?: number | null
          result?: Json | null
          rfq_id?: string | null
          status?: string
          storage_path: string
          summary?: Json | null
          thumbnail_path?: string | null
          updated_at?: string
        }
        Update: {
          analysis_version?: string | null
          attempts?: number
          buyer_id?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          file_name?: string
          id?: string
          processing_ms?: number | null
          result?: Json | null
          rfq_id?: string | null
          status?: string
          storage_path?: string
          summary?: Json | null
          thumbnail_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cad_analyses_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cad_analyses_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          expiry: string | null
          id: string
          min_cart_value: number | null
          status: Database["public"]["Enums"]["master_status"]
          type: Database["public"]["Enums"]["coupon_type"]
          usage_cap: number | null
          used_count: number
          value: number
        }
        Insert: {
          code: string
          expiry?: string | null
          id?: string
          min_cart_value?: number | null
          status?: Database["public"]["Enums"]["master_status"]
          type: Database["public"]["Enums"]["coupon_type"]
          usage_cap?: number | null
          used_count?: number
          value: number
        }
        Update: {
          code?: string
          expiry?: string | null
          id?: string
          min_cart_value?: number | null
          status?: Database["public"]["Enums"]["master_status"]
          type?: Database["public"]["Enums"]["coupon_type"]
          usage_cap?: number | null
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      disputes: {
        Row: {
          created_at: string
          id: string
          issue: string
          order_id: string
          raised_by: string
          resolution: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue: string
          order_id: string
          raised_by: string
          resolution?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          issue?: string
          order_id?: string
          raised_by?: string
          resolution?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          fields: string[]
          id: number
          vendor_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          fields?: string[]
          id?: number
          vendor_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          fields?: string[]
          id?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_audit_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          auto_publish: boolean
          available_stock: number
          category_id: string | null
          created_at: string
          description: string | null
          dimensions_spec: string | null
          gst_rate: number
          hsn_code: string | null
          id: string
          image_urls: string[] | null
          low_stock_threshold: number | null
          material_id: string | null
          min_order_qty: number
          price_per_unit: number
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          unit: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          auto_publish?: boolean
          available_stock?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          dimensions_spec?: string | null
          gst_rate: number
          hsn_code?: string | null
          id?: string
          image_urls?: string[] | null
          low_stock_threshold?: number | null
          material_id?: string | null
          min_order_qty: number
          price_per_unit: number
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          unit: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          auto_publish?: boolean
          available_stock?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          dimensions_spec?: string | null
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          image_urls?: string[] | null
          low_stock_threshold?: number | null
          material_id?: string | null
          min_order_qty?: number
          price_per_unit?: number
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          unit?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "master_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "master_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      master_items: {
        Row: {
          applicable_processes: string[] | null
          created_at: string
          default_unit: string | null
          gst_rate: number | null
          hsn_code: string | null
          icon_url: string | null
          id: string
          name: string
          parent_id: string | null
          status: Database["public"]["Enums"]["master_status"]
          type: Database["public"]["Enums"]["master_item_type"]
        }
        Insert: {
          applicable_processes?: string[] | null
          created_at?: string
          default_unit?: string | null
          gst_rate?: number | null
          hsn_code?: string | null
          icon_url?: string | null
          id?: string
          name: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["master_status"]
          type: Database["public"]["Enums"]["master_item_type"]
        }
        Update: {
          applicable_processes?: string[] | null
          created_at?: string
          default_unit?: string | null
          gst_rate?: number | null
          hsn_code?: string | null
          icon_url?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["master_status"]
          type?: Database["public"]["Enums"]["master_item_type"]
        }
        Relationships: [
          {
            foreignKeyName: "master_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "master_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          rm_line_no: number | null
          rm_cut: boolean | null
          rm_cut_charge: number | null
          rm_dims: Json | null
          rm_discount: number | null
          rm_grade_id: string | null
          rm_gst_rate: number | null
          rm_hsn_code: string | null
          rm_length_mm: number | null
          rm_material_value: number | null
          rm_mtc: boolean | null
          rm_mtc_fee: number | null
          rm_piece_weight_kg: number | null
          rm_rate_per_kg: number | null
          rm_sell_by: string | null
          rm_shape_id: string | null
          rm_taxable_value: number | null
          rm_weight_kg: number | null
          description: string
          id: string
          line_total: number
          listing_id: string | null
          order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          rm_line_no?: number | null
          rm_cut?: boolean | null
          rm_cut_charge?: number | null
          rm_dims?: Json | null
          rm_discount?: number | null
          rm_grade_id?: string | null
          rm_gst_rate?: number | null
          rm_hsn_code?: string | null
          rm_length_mm?: number | null
          rm_material_value?: number | null
          rm_mtc?: boolean | null
          rm_mtc_fee?: number | null
          rm_piece_weight_kg?: number | null
          rm_rate_per_kg?: number | null
          rm_sell_by?: string | null
          rm_shape_id?: string | null
          rm_taxable_value?: number | null
          rm_weight_kg?: number | null
          description: string
          id?: string
          line_total: number
          listing_id?: string | null
          order_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          rm_line_no?: number | null
          rm_cut?: boolean | null
          rm_cut_charge?: number | null
          rm_dims?: Json | null
          rm_discount?: number | null
          rm_grade_id?: string | null
          rm_gst_rate?: number | null
          rm_hsn_code?: string | null
          rm_length_mm?: number | null
          rm_material_value?: number | null
          rm_mtc?: boolean | null
          rm_mtc_fee?: number | null
          rm_piece_weight_kg?: number | null
          rm_rate_per_kg?: number | null
          rm_sell_by?: string | null
          rm_shape_id?: string | null
          rm_taxable_value?: number | null
          rm_weight_kg?: number | null
          description?: string
          id?: string
          line_total?: number
          listing_id?: string | null
          order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          rm_admin_note: string | null
          rm_approved_at: string | null
          rm_approved_by: string | null
          rm_bulk_discount: number | null
          rm_cut_charges: number | null
          rm_material_value: number | null
          rm_mtc_charges: number | null
          rm_paid_at: string | null
          rm_total_weight_kg: number | null
          billing_gstin: string | null
          buyer_id: string
          created_at: string
          delivery_address_id: string | null
          gst_amount: number
          id: string
          invoice_url: string | null
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"]
          shipping_amount: number
          source_quote_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          tracking_number: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          rm_admin_note?: string | null
          rm_approved_at?: string | null
          rm_approved_by?: string | null
          rm_bulk_discount?: number | null
          rm_cut_charges?: number | null
          rm_material_value?: number | null
          rm_mtc_charges?: number | null
          rm_paid_at?: string | null
          rm_total_weight_kg?: number | null
          billing_gstin?: string | null
          buyer_id: string
          created_at?: string
          delivery_address_id?: string | null
          gst_amount?: number
          id?: string
          invoice_url?: string | null
          order_number?: string
          order_type: Database["public"]["Enums"]["order_type"]
          shipping_amount?: number
          source_quote_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          rm_admin_note?: string | null
          rm_approved_at?: string | null
          rm_approved_by?: string | null
          rm_bulk_discount?: number | null
          rm_cut_charges?: number | null
          rm_material_value?: number | null
          rm_mtc_charges?: number | null
          rm_paid_at?: string | null
          rm_total_weight_kg?: number | null
          billing_gstin?: string | null
          buyer_id?: string
          created_at?: string
          delivery_address_id?: string | null
          gst_amount?: number
          id?: string
          invoice_url?: string | null
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          shipping_amount?: number
          source_quote_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          gateway_ref: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          gateway_ref?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          gateway_ref?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          commission_deducted: number
          created_at: string
          id: string
          payout_date: string | null
          status: Database["public"]["Enums"]["payout_status"]
          vendor_id: string
        }
        Insert: {
          amount: number
          commission_deducted?: number
          created_at?: string
          id?: string
          payout_date?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          vendor_id: string
        }
        Update: {
          amount?: number
          commission_deducted?: number
          created_at?: string
          id?: string
          payout_date?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          email_verified: boolean
          full_name: string
          id: string
          phone: string | null
          phone_verified: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          email_verified?: boolean
          full_name: string
          id: string
          phone?: string | null
          phone_verified?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          email_verified?: boolean
          full_name?: string
          id?: string
          phone?: string | null
          phone_verified?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          attachment_urls: string[] | null
          created_at: string
          id: string
          lead_time_days: number
          material_confirmed_id: string | null
          notes: string | null
          rfq_id: string
          status: Database["public"]["Enums"]["quote_status"]
          total_price: number
          unit_price: number
          validity_date: string
          vendor_id: string
        }
        Insert: {
          attachment_urls?: string[] | null
          created_at?: string
          id?: string
          lead_time_days: number
          material_confirmed_id?: string | null
          notes?: string | null
          rfq_id: string
          status?: Database["public"]["Enums"]["quote_status"]
          total_price: number
          unit_price: number
          validity_date: string
          vendor_id: string
        }
        Update: {
          attachment_urls?: string[] | null
          created_at?: string
          id?: string
          lead_time_days?: number
          material_confirmed_id?: string | null
          notes?: string | null
          rfq_id?: string
          status?: Database["public"]["Enums"]["quote_status"]
          total_price?: number
          unit_price?: number
          validity_date?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_material_confirmed_id_fkey"
            columns: ["material_confirmed_id"]
            isOneToOne: false
            referencedRelation: "master_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          buyer_id: string
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          vendor_id: string
          vendor_response: string | null
        }
        Insert: {
          buyer_id: string
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          vendor_id: string
          vendor_response?: string | null
        }
        Update: {
          buyer_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          vendor_id?: string
          vendor_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          analysis_id: string | null
          buyer_id: string
          cad_file_urls: string[] | null
          certificates: string[]
          colour_coating: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_lead_days: number | null
          confirmed_total: number | null
          confirmed_unit_price: number | null
          created_at: string
          delivery_address_id: string | null
          estimate: Json | null
          estimated_lead_days: number | null
          estimated_total: number | null
          estimated_unit_price: number | null
          finish_options: string[]
          id: string
          inserts_qty: number | null
          inspection: string | null
          lead_time_pref: string | null
          material_id: string | null
          part_marking: string[]
          price_note: string | null
          price_status: string
          price_tier: string | null
          process_id: string | null
          quantity: number
          rm_grade_id: string | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["rfq_status"]
          subprocess: string | null
          surface_finish: string | null
          surface_roughness: string | null
          threads_qty: number | null
          tolerance: string | null
          updated_at: string
        }
        Insert: {
          analysis_id?: string | null
          buyer_id: string
          cad_file_urls?: string[] | null
          certificates?: string[]
          colour_coating?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_lead_days?: number | null
          confirmed_total?: number | null
          confirmed_unit_price?: number | null
          created_at?: string
          delivery_address_id?: string | null
          estimate?: Json | null
          estimated_lead_days?: number | null
          estimated_total?: number | null
          estimated_unit_price?: number | null
          finish_options?: string[]
          id?: string
          inserts_qty?: number | null
          inspection?: string | null
          lead_time_pref?: string | null
          material_id?: string | null
          part_marking?: string[]
          price_note?: string | null
          price_status?: string
          price_tier?: string | null
          process_id?: string | null
          quantity: number
          rm_grade_id?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["rfq_status"]
          subprocess?: string | null
          surface_finish?: string | null
          surface_roughness?: string | null
          threads_qty?: number | null
          tolerance?: string | null
          updated_at?: string
        }
        Update: {
          analysis_id?: string | null
          buyer_id?: string
          cad_file_urls?: string[] | null
          certificates?: string[]
          colour_coating?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_lead_days?: number | null
          confirmed_total?: number | null
          confirmed_unit_price?: number | null
          created_at?: string
          delivery_address_id?: string | null
          estimate?: Json | null
          estimated_lead_days?: number | null
          estimated_total?: number | null
          estimated_unit_price?: number | null
          finish_options?: string[]
          id?: string
          inserts_qty?: number | null
          inspection?: string | null
          lead_time_pref?: string | null
          material_id?: string | null
          part_marking?: string[]
          price_note?: string | null
          price_status?: string
          price_tier?: string | null
          process_id?: string | null
          quantity?: number
          rm_grade_id?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["rfq_status"]
          subprocess?: string | null
          surface_finish?: string | null
          surface_roughness?: string | null
          threads_qty?: number | null
          tolerance?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "cad_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "master_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "master_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_rm_grade_id_fkey"
            columns: ["rm_grade_id"]
            isOneToOne: false
            referencedRelation: "rm_grades"
            referencedColumns: ["id"]
          },
        ]
      }
      rm_cart_items: {
        Row: {
          buyer_id: string
          created_at: string
          dims: Json
          grade_id: string
          id: string
          length_mm: number | null
          mtc: boolean
          notes: string | null
          quantity: number
          shape_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          dims: Json
          grade_id: string
          id?: string
          length_mm?: number | null
          mtc?: boolean
          notes?: string | null
          quantity: number
          shape_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          dims?: Json
          grade_id?: string
          id?: string
          length_mm?: number | null
          mtc?: boolean
          notes?: string | null
          quantity?: number
          shape_id?: string
        }
        Relationships: []
      }
      rm_grades: {
        Row: {
          active: boolean
          applications: string | null
          created_at: string
          density: number | null
          description: string
          equivalents: string | null
          id: string
          material_id: string
          mtc_available: boolean
          name: string
          shape_slugs: string[] | null
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          applications?: string | null
          created_at?: string
          density?: number | null
          description?: string
          equivalents?: string | null
          id?: string
          material_id: string
          mtc_available?: boolean
          name: string
          shape_slugs?: string[] | null
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          applications?: string | null
          created_at?: string
          density?: number | null
          description?: string
          equivalents?: string | null
          id?: string
          material_id?: string
          mtc_available?: boolean
          name?: string
          shape_slugs?: string[] | null
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      rm_materials: {
        Row: {
          active: boolean
          created_at: string
          density: number
          description: string
          gst_rate: number
          hsn_codes: Json
          id: string
          name: string
          short_name: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          density: number
          description?: string
          gst_rate?: number
          hsn_codes?: Json
          id?: string
          name: string
          short_name?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          density?: number
          description?: string
          gst_rate?: number
          hsn_codes?: Json
          id?: string
          name?: string
          short_name?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      rm_rate_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          grade_id: string
          id: number
          new_rate: number | null
          old_rate: number | null
          shape_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          grade_id: string
          id?: number
          new_rate?: number | null
          old_rate?: number | null
          shape_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          grade_id?: string
          id?: number
          new_rate?: number | null
          old_rate?: number | null
          shape_id?: string | null
        }
        Relationships: []
      }
      rm_rates: {
        Row: {
          grade_id: string
          id: string
          rate_per_kg: number
          shape_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          grade_id: string
          id?: string
          rate_per_kg: number
          shape_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          grade_id?: string
          id?: string
          rate_per_kg?: number
          shape_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      rm_settings: {
        Row: {
          bulk_tiers: Json
          cut_charge_per_cut: number
          cut_charge_per_kg: number
          freight_gst_rate: number
          id: number
          min_order_value: number
          mtc_fee: number
          updated_at: string
        }
        Insert: {
          bulk_tiers?: Json
          cut_charge_per_cut?: number
          cut_charge_per_kg?: number
          freight_gst_rate?: number
          id?: number
          min_order_value?: number
          mtc_fee?: number
          updated_at?: string
        }
        Update: {
          bulk_tiers?: Json
          cut_charge_per_cut?: number
          cut_charge_per_kg?: number
          freight_gst_rate?: number
          id?: number
          min_order_value?: number
          mtc_fee?: number
          updated_at?: string
        }
        Relationships: []
      }
      rm_shape_materials: {
        Row: {
          material_id: string
          shape_id: string
        }
        Insert: {
          material_id: string
          shape_id: string
        }
        Update: {
          material_id?: string
          shape_id?: string
        }
        Relationships: []
      }
      rm_shapes: {
        Row: {
          active: boolean
          created_at: string
          description: string
          dims: Json
          family: string
          formula: string
          hsn_key: string
          id: string
          name: string
          rate_premium_pct: number
          sell_by: string
          slug: string
          sort_order: number
          std_lengths: number[]
          std_sheet_sizes: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          dims?: Json
          family: string
          formula: string
          hsn_key: string
          id?: string
          name: string
          rate_premium_pct?: number
          sell_by?: string
          slug: string
          sort_order?: number
          std_lengths?: number[]
          std_sheet_sizes?: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          dims?: Json
          family?: string
          formula?: string
          hsn_key?: string
          id?: string
          name?: string
          rate_premium_pct?: number
          sell_by?: string
          slug?: string
          sort_order?: number
          std_lengths?: number[]
          std_sheet_sizes?: Json
        }
        Relationships: []
      }
      rm_vendor_supply: {
        Row: {
          active: boolean
          created_at: string
          cut_to_size: boolean
          grade_id: string
          id: string
          mtc_available: boolean
          shape_id: string
          size_range: string | null
          vendor_id: string
          warehouse_pincode: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          cut_to_size?: boolean
          grade_id: string
          id?: string
          mtc_available?: boolean
          shape_id: string
          size_range?: string | null
          vendor_id: string
          warehouse_pincode?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          cut_to_size?: boolean
          grade_id?: string
          id?: string
          mtc_available?: boolean
          shape_id?: string
          size_range?: string | null
          vendor_id?: string
          warehouse_pincode?: string | null
        }
        Relationships: []
      }
      sq_settings: {
        Row: {
          config: Json
          id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config: Json
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sq_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          created_at: string
          id: string
          module_permissions: Json
          profile_id: string
          role: Database["public"]["Enums"]["staff_role"]
          status: Database["public"]["Enums"]["master_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          module_permissions?: Json
          profile_id: string
          role: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["master_status"]
        }
        Update: {
          created_at?: string
          id?: string
          module_permissions?: Json
          profile_id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["master_status"]
        }
        Relationships: [
          {
            foreignKeyName: "staff_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          message: string
          order_id: string | null
          profile_id: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          order_id?: string | null
          profile_id: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          order_id?: string | null
          profile_id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_kyc: {
        Row: {
          account_holder_name: string | null
          bank_account_enc: string | null
          bank_account_last4: string | null
          cancelled_cheque_path: string | null
          certification_paths: string[]
          consent_at: string | null
          consent_version: string | null
          created_at: string
          deletion_requested_at: string | null
          ifsc_enc: string | null
          ifsc_last4: string | null
          pan_enc: string | null
          pan_last4: string | null
          registered_address: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          account_holder_name?: string | null
          bank_account_enc?: string | null
          bank_account_last4?: string | null
          cancelled_cheque_path?: string | null
          certification_paths?: string[]
          consent_at?: string | null
          consent_version?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          ifsc_enc?: string | null
          ifsc_last4?: string | null
          pan_enc?: string | null
          pan_last4?: string | null
          registered_address?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          account_holder_name?: string | null
          bank_account_enc?: string | null
          bank_account_last4?: string | null
          cancelled_cheque_path?: string | null
          certification_paths?: string[]
          consent_at?: string | null
          consent_version?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          ifsc_enc?: string | null
          ifsc_last4?: string | null
          pan_enc?: string | null
          pan_last4?: string | null
          registered_address?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_kyc_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_profiles: {
        Row: {
          business_type: string | null
          capabilities: string[] | null
          categories_supplied: string[] | null
          category_permissions: string[] | null
          commission_override: number | null
          company_name: string
          created_at: string
          gstin: string | null
          id: string
          internal_notes: string | null
          kyc_rejection_reason: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          materials_handled: string[] | null
          materials_machined: string[] | null
          min_order_policy: string | null
          rating: number | null
          registered_pincode: string | null
          typical_lead_time: string | null
          updated_at: string
          vendor_type: Database["public"]["Enums"]["vendor_type"]
          warehouse_pincode: string | null
        }
        Insert: {
          business_type?: string | null
          capabilities?: string[] | null
          categories_supplied?: string[] | null
          category_permissions?: string[] | null
          commission_override?: number | null
          company_name: string
          created_at?: string
          gstin?: string | null
          id: string
          internal_notes?: string | null
          kyc_rejection_reason?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          materials_handled?: string[] | null
          materials_machined?: string[] | null
          min_order_policy?: string | null
          rating?: number | null
          registered_pincode?: string | null
          typical_lead_time?: string | null
          updated_at?: string
          vendor_type: Database["public"]["Enums"]["vendor_type"]
          warehouse_pincode?: string | null
        }
        Update: {
          business_type?: string | null
          capabilities?: string[] | null
          categories_supplied?: string[] | null
          category_permissions?: string[] | null
          commission_override?: number | null
          company_name?: string
          created_at?: string
          gstin?: string | null
          id?: string
          internal_notes?: string | null
          kyc_rejection_reason?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          materials_handled?: string[] | null
          materials_machined?: string[] | null
          min_order_policy?: string | null
          rating?: number | null
          registered_pincode?: string | null
          typical_lead_time?: string | null
          updated_at?: string
          vendor_type?: Database["public"]["Enums"]["vendor_type"]
          warehouse_pincode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      rm_add_to_cart: {
        Args: {
          p_dims: Json
          p_grade_id: string
          p_length_mm: number | null
          p_mtc: boolean
          p_notes?: string | null
          p_quantity: number
          p_shape_id: string
        }
        Returns: string
      }
      rm_approve_order: {
        Args: { p_freight: number; p_note?: string | null; p_order_id: string; p_vendor_id: string }
        Returns: undefined
      }
      rm_bulk_pct: { Args: { p_weight_kg: number }; Returns: number }
      rm_cancel_order: { Args: { p_order_id: string }; Returns: undefined }
      rm_cart_quote: {
        Args: Record<PropertyKey, never>
        Returns: {
          cart_item_id: string
          shape_id: string
          grade_id: string
          dims: Json
          quantity: number
          mtc: boolean
          notes: string | null
          description: string | null
          sell_by: string | null
          piece_weight_kg: number | null
          weight_kg: number | null
          rate_per_kg: number | null
          material_value: number | null
          cut: boolean | null
          cut_charge: number | null
          mtc_fee: number | null
          hsn_code: string | null
          gst_rate: number | null
          length_mm: number | null
          error: string | null
        }[]
      }
      rm_eligible_vendors: {
        Args: { p_order_id: string }
        Returns: {
          vendor_id: string
          company_name: string
          warehouse_pincodes: string | null
          lines_covered: number
          lines_total: number
        }[]
      }
      rm_pay_order: {
        Args: {
          p_gateway_ref?: string | null
          p_method: Database["public"]["Enums"]["payment_method"]
          p_order_id: string
        }
        Returns: undefined
      }
      rm_place_order: {
        Args: { p_address_id: string; p_billing_gstin?: string | null }
        Returns: string
      }
      rm_price_line: {
        Args: {
          p_dims: Json
          p_grade_id: string
          p_length_mm: number | null
          p_mtc: boolean
          p_quantity: number
          p_shape_id: string
        }
        Returns: {
          description: string
          sell_by: string
          piece_weight_kg: number | null
          weight_kg: number
          rate_per_kg: number
          material_value: number
          cut: boolean
          cut_charge: number
          mtc_fee: number
          hsn_code: string | null
          gst_rate: number
          length_mm: number | null
        }[]
      }
      rm_reject_order: { Args: { p_note: string; p_order_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_vendor_owner: { Args: { v_id: string }; Returns: boolean }
      log_kyc_event: {
        Args: { p_action: string; p_fields?: string[]; p_vendor_id: string }
        Returns: undefined
      }
    }
    Enums: {
      coupon_type: "percent" | "flat"
      dispute_status: "open" | "reviewing" | "resolved"
      kyc_status: "draft" | "pending" | "approved" | "rejected" | "on_hold"
      listing_status:
        | "draft"
        | "pending_review"
        | "active"
        | "rejected"
        | "inactive"
      master_item_type: "process" | "material" | "unit" | "finish"
      master_status: "active" | "inactive"
      order_status:
        | "draft"
        | "quoted"
        | "accepted_paid"
        | "in_production"
        | "qc_ready"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded"
        | "disputed"
      order_type: "custom_part" | "raw_material"
      payment_method: "upi" | "card" | "netbanking" | "wallet"
      payment_status: "pending" | "success" | "failed" | "refunded"
      payout_status: "pending" | "processing" | "paid"
      quote_status: "submitted" | "won" | "lost" | "expired" | "withdrawn"
      rfq_status: "pending" | "quoted" | "accepted" | "expired" | "cancelled"
      staff_role: "super_admin" | "ops" | "finance" | "support" | "content"
      ticket_status: "open" | "in_progress" | "resolved"
      user_role: "buyer" | "vendor" | "admin"
      vendor_type: "fabrication" | "raw_material"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      coupon_type: ["percent", "flat"],
      dispute_status: ["open", "reviewing", "resolved"],
      kyc_status: ["draft", "pending", "approved", "rejected", "on_hold"],
      listing_status: [
        "draft",
        "pending_review",
        "active",
        "rejected",
        "inactive",
      ],
      master_item_type: ["process", "material", "unit", "finish"],
      master_status: ["active", "inactive"],
      order_status: [
        "draft",
        "quoted",
        "accepted_paid",
        "in_production",
        "qc_ready",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
        "disputed",
      ],
      order_type: ["custom_part", "raw_material"],
      payment_method: ["upi", "card", "netbanking", "wallet"],
      payment_status: ["pending", "success", "failed", "refunded"],
      payout_status: ["pending", "processing", "paid"],
      quote_status: ["submitted", "won", "lost", "expired", "withdrawn"],
      rfq_status: ["pending", "quoted", "accepted", "expired", "cancelled"],
      staff_role: ["super_admin", "ops", "finance", "support", "content"],
      ticket_status: ["open", "in_progress", "resolved"],
      user_role: ["buyer", "vendor", "admin"],
      vendor_type: ["fabrication", "raw_material"],
    },
  },
} as const
