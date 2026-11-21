export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agenda_days: {
        Row: {
          closes_at: string
          day: string
          is_open: boolean
          opens_at: string
          week_start: string
        }
        Insert: {
          closes_at?: string
          day: string
          is_open?: boolean
          opens_at?: string
          week_start: string
        }
        Update: {
          closes_at?: string
          day?: string
          is_open?: boolean
          opens_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_days_week_start_fkey"
            columns: ["week_start"]
            isOneToOne: false
            referencedRelation: "agenda_weeks"
            referencedColumns: ["week_start"]
          },
        ]
      }
      agenda_settings: {
        Row: {
          id: boolean
          seats: number
          slot_minutes: number
          tolerance_minutes: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          seats?: number
          slot_minutes?: number
          tolerance_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          seats?: number
          slot_minutes?: number
          tolerance_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_weeks: {
        Row: {
          enabled: boolean
          updated_at: string
          updated_by: string | null
          week_start: string
        }
        Insert: {
          enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          week_start: string
        }
        Update: {
          enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_weeks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          avatar_url: string | null
          consent_at: string
          created_at: string
          disabled_at: string | null
          email: string | null
          full_name: string
          id: string
          origin: Database["public"]["Enums"]["customer_origin"]
          phone: string | null
          registered_by: string | null
          search_text: string
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
          user_id: string | null
          vehicle_plates: string
        }
        Insert: {
          avatar_url?: string | null
          consent_at?: string
          created_at?: string
          disabled_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          origin?: Database["public"]["Enums"]["customer_origin"]
          phone?: string | null
          registered_by?: string | null
          search_text?: string
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          user_id?: string | null
          vehicle_plates?: string
        }
        Update: {
          avatar_url?: string | null
          consent_at?: string
          created_at?: string
          disabled_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          origin?: Database["public"]["Enums"]["customer_origin"]
          phone?: string | null
          registered_by?: string | null
          search_text?: string
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          user_id?: string | null
          vehicle_plates?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_details: {
        Row: {
          commission_pct: number
          document_number: string
          document_type: Database["public"]["Enums"]["document_type"]
          employee_id: string
          phone: string | null
        }
        Insert: {
          commission_pct: number
          document_number: string
          document_type: Database["public"]["Enums"]["document_type"]
          employee_id: string
          phone?: string | null
        }
        Update: {
          commission_pct?: number
          document_number?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          employee_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_details_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          disabled_at: string | null
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          disabled_at?: string | null
          full_name: string
          id?: string
        }
        Update: {
          created_at?: string
          disabled_at?: string | null
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      municipalities: {
        Row: {
          code: string
          department: string
          name: string
        }
        Insert: {
          code: string
          department: string
          name: string
        }
        Update: {
          code?: string
          department?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activated_at: string | null
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_services: {
        Row: {
          position: number
          reservation_id: string
          service_id: string
        }
        Insert: {
          position: number
          reservation_id: string
          service_id: string
        }
        Update: {
          position?: number
          reservation_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_services_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservation_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_services_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_services_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "work_order_summaries"
            referencedColumns: ["reservation_id"]
          },
          {
            foreignKeyName: "reservation_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          attended_at: string | null
          attended_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          customer_id: string
          id: string
          no_show_at: string | null
          no_show_by: string | null
          notes: string | null
          number: number
          slot_end: string
          slot_start: string
          status: Database["public"]["Enums"]["reservation_status"]
          tolerance_minutes: number | null
          updated_at: string | null
          updated_by: string | null
          vehicle_id: string | null
          work_order_id: string | null
        }
        Insert: {
          attended_at?: string | null
          attended_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          id?: string
          no_show_at?: string | null
          no_show_by?: string | null
          notes?: string | null
          number?: never
          slot_end: string
          slot_start: string
          status?: Database["public"]["Enums"]["reservation_status"]
          tolerance_minutes?: number | null
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id?: string | null
          work_order_id?: string | null
        }
        Update: {
          attended_at?: string | null
          attended_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          no_show_at?: string | null
          no_show_by?: string | null
          notes?: string | null
          number?: never
          slot_end?: string
          slot_start?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          tolerance_minutes?: number | null
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_attended_by_fkey"
            columns: ["attended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_no_show_by_fkey"
            columns: ["no_show_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_order_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          disabled_at: string | null
          estimated_minutes: number | null
          id: string
          name: string
          name_key: string
          price_bicycle: number | null
          price_car: number | null
          price_motorcycle: number | null
        }
        Insert: {
          created_at?: string
          disabled_at?: string | null
          estimated_minutes?: number | null
          id?: string
          name: string
          name_key?: string
          price_bicycle?: number | null
          price_car?: number | null
          price_motorcycle?: number | null
        }
        Update: {
          created_at?: string
          disabled_at?: string | null
          estimated_minutes?: number | null
          id?: string
          name?: string
          name_key?: string
          price_bicycle?: number | null
          price_car?: number | null
          price_motorcycle?: number | null
        }
        Relationships: []
      }
      staff_invitations: {
        Row: {
          created_at: string
          email: string
          full_name: string
          invited_by: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_brands: {
        Row: {
          created_at: string
          id: string
          name: string
          name_key: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_key?: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_key?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      vehicle_lines: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          name: string
          name_key: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          name: string
          name_key?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          name?: string
          name_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_lines_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vehicle_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand_id: string
          color: Database["public"]["Enums"]["vehicle_color"]
          created_at: string
          customer_id: string
          displacement_cc: number | null
          id: string
          line_id: string | null
          plate: string | null
          plate_city_code: string | null
          retired_at: string | null
          updated_at: string
          vehicle_class: Database["public"]["Enums"]["vehicle_class"] | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          brand_id: string
          color: Database["public"]["Enums"]["vehicle_color"]
          created_at?: string
          customer_id: string
          displacement_cc?: number | null
          id?: string
          line_id?: string | null
          plate?: string | null
          plate_city_code?: string | null
          retired_at?: string | null
          updated_at?: string
          vehicle_class?: Database["public"]["Enums"]["vehicle_class"] | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          brand_id?: string
          color?: Database["public"]["Enums"]["vehicle_color"]
          created_at?: string
          customer_id?: string
          displacement_cc?: number | null
          id?: string
          line_id?: string | null
          plate?: string | null
          plate_city_code?: string | null
          retired_at?: string | null
          updated_at?: string
          vehicle_class?: Database["public"]["Enums"]["vehicle_class"] | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_brand_fk"
            columns: ["brand_id", "vehicle_type"]
            isOneToOne: false
            referencedRelation: "vehicle_brands"
            referencedColumns: ["id", "vehicle_type"]
          },
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_line_fk"
            columns: ["line_id", "brand_id"]
            isOneToOne: false
            referencedRelation: "vehicle_lines"
            referencedColumns: ["id", "brand_id"]
          },
          {
            foreignKeyName: "vehicles_plate_city_code_fkey"
            columns: ["plate_city_code"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["code"]
          },
        ]
      }
      work_order_line_employees: {
        Row: {
          employee_id: string
          line_id: string
          share_pct: number
        }
        Insert: {
          employee_id: string
          line_id: string
          share_pct: number
        }
        Update: {
          employee_id?: string
          line_id?: string
          share_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_order_line_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_line_employees_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "work_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_lines: {
        Row: {
          estimated_minutes: number | null
          id: string
          name: string
          position: number
          price: number
          service_id: string | null
          work_order_id: string
        }
        Insert: {
          estimated_minutes?: number | null
          id?: string
          name: string
          position: number
          price: number
          service_id?: string | null
          work_order_id: string
        }
        Update: {
          estimated_minutes?: number | null
          id?: string
          name?: string
          position?: number
          price?: number
          service_id?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_lines_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_lines_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_lines_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_payments: {
        Row: {
          amount: number
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          work_order_id: string
        }
        Insert: {
          amount: number
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          work_order_id: string
        }
        Update: {
          amount?: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_payments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_payments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          corrected_at: string | null
          corrected_by: string | null
          correction_reason: string | null
          customer_id: string
          discount: number
          id: string
          notes: string | null
          number: number
          opened_at: string
          opened_by: string
          started_at: string | null
          started_by: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          turn_at: string | null
          vehicle_id: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          correction_reason?: string | null
          customer_id: string
          discount?: number
          id?: string
          notes?: string | null
          number?: never
          opened_at?: string
          opened_by: string
          started_at?: string | null
          started_by?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          turn_at?: string | null
          vehicle_id: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          correction_reason?: string | null
          customer_id?: string
          discount?: number
          id?: string
          notes?: string | null
          number?: never
          opened_at?: string
          opened_by?: string
          started_at?: string | null
          started_by?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          turn_at?: string | null
          vehicle_id?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      reservation_summaries: {
        Row: {
          attended_at: string | null
          attended_by_name: string | null
          brand_name: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by_name: string | null
          created_at: string | null
          created_by_name: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          day: string | null
          effective_tolerance_minutes: number | null
          grace_until: string | null
          id: string | null
          line_name: string | null
          no_show_at: string | null
          no_show_by_name: string | null
          notes: string | null
          number: number | null
          out_of_hours: boolean | null
          over_capacity: boolean | null
          plate: string | null
          plate_city_name: string | null
          service_ids: string[] | null
          services: string[] | null
          slot_end: string | null
          slot_start: string | null
          status: Database["public"]["Enums"]["reservation_status"] | null
          tolerance_minutes: number | null
          updated_at: string | null
          updated_by_name: string | null
          vehicle_id: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          work_order_id: string | null
          work_order_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_order_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_summaries: {
        Row: {
          brand_name: string | null
          closed_at: string | null
          closed_by_name: string | null
          corrected_at: string | null
          corrected_by_name: string | null
          correction_reason: string | null
          customer_id: string | null
          customer_name: string | null
          discount: number | null
          estimated_minutes: number | null
          id: string | null
          line_name: string | null
          notes: string | null
          number: number | null
          opened_at: string | null
          opened_by_name: string | null
          plate: string | null
          plate_city_name: string | null
          reservation_id: string | null
          reserved_start: string | null
          services: string[] | null
          started_at: string | null
          started_by_name: string | null
          status: Database["public"]["Enums"]["work_order_status"] | null
          subtotal: number | null
          total: number | null
          turn_at: string | null
          unestimated: string[] | null
          vehicle_id: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          void_reason: string | null
          voided_at: string | null
          voided_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      agenda_slots: {
        Args: { p_day: string }
        Returns: {
          seats: number
          slot_end: string
          slot_start: string
          started: boolean
          taken: number
        }[]
      }
      cancel_reservation: {
        Args: { p_id: string; p_reason?: string }
        Returns: undefined
      }
      close_work_order: {
        Args: { p_id: string; p_payments?: Json }
        Returns: undefined
      }
      correct_work_order: {
        Args: {
          p_discount?: number
          p_id: string
          p_lines: Json
          p_notes?: string
          p_payments: Json
          p_reason: string
        }
        Returns: undefined
      }
      current_account: {
        Args: never
        Returns: {
          kind: string
          role: Database["public"]["Enums"]["user_role"]
          status: string
        }[]
      }
      current_profile_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      customer_registrar_name: {
        Args: { p_customer_id: string }
        Returns: string
      }
      customer_status_counts: {
        Args: never
        Returns: {
          status: Database["public"]["Enums"]["customer_status"]
          total: number
        }[]
      }
      email_in_use: { Args: { p_email: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      mark_reservation_no_show: { Args: { p_id: string }; Returns: undefined }
      save_agenda_settings: {
        Args: {
          p_seats: number
          p_slot_minutes: number
          p_tolerance_minutes: number
        }
        Returns: undefined
      }
      save_agenda_week: {
        Args: { p_days: Json; p_enabled: boolean; p_week_start: string }
        Returns: undefined
      }
      save_employee: {
        Args: {
          p_commission_pct: number
          p_document_number: string
          p_document_type: Database["public"]["Enums"]["document_type"]
          p_full_name: string
          p_id?: string
          p_phone?: string
        }
        Returns: string
      }
      save_reservation: {
        Args: {
          p_customer_id: string
          p_id?: string
          p_notes?: string
          p_service_ids?: string[]
          p_slot_start: string
          p_vehicle_id: string
        }
        Returns: string
      }
      save_vehicle: {
        Args: {
          p_brand_name: string
          p_color: Database["public"]["Enums"]["vehicle_color"]
          p_customer_id: string
          p_displacement_cc?: number
          p_line_name?: string
          p_plate?: string
          p_plate_city_code?: string
          p_vehicle_class?: Database["public"]["Enums"]["vehicle_class"]
          p_vehicle_id?: string
          p_vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Returns: string
      }
      save_work_order: {
        Args: {
          p_customer_id: string
          p_discount?: number
          p_id?: string
          p_lines: Json
          p_notes?: string
          p_reservation_id?: string
          p_vehicle_id: string
        }
        Returns: string
      }
      set_reservation_tolerance: {
        Args: { p_id: string; p_minutes: number }
        Returns: undefined
      }
      start_work_order: { Args: { p_id: string }; Returns: undefined }
      void_work_order: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
    }
    Enums: {
      customer_origin: "self_signup" | "google" | "counter"
      customer_status: "registered" | "walk_in" | "disabled"
      document_type: "cc" | "ce" | "ppt" | "passport"
      payment_method: "cash" | "transfer" | "card" | "other"
      reservation_status: "pending" | "attended" | "cancelled" | "no_show"
      user_role: "operator" | "admin"
      user_status: "invited" | "active" | "disabled"
      vehicle_class: "automobile" | "utility" | "mountain" | "road"
      vehicle_color:
        | "black"
        | "white"
        | "gray"
        | "silver"
        | "red"
        | "burgundy"
        | "blue"
        | "green"
        | "yellow"
        | "orange"
        | "brown"
        | "beige"
        | "gold"
        | "purple"
        | "pink"
        | "multicolor"
      vehicle_type: "motorcycle" | "bicycle" | "car"
      work_order_status: "open" | "closed" | "voided"
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
      customer_origin: ["self_signup", "google", "counter"],
      customer_status: ["registered", "walk_in", "disabled"],
      document_type: ["cc", "ce", "ppt", "passport"],
      payment_method: ["cash", "transfer", "card", "other"],
      reservation_status: ["pending", "attended", "cancelled", "no_show"],
      user_role: ["operator", "admin"],
      user_status: ["invited", "active", "disabled"],
      vehicle_class: ["automobile", "utility", "mountain", "road"],
      vehicle_color: [
        "black",
        "white",
        "gray",
        "silver",
        "red",
        "burgundy",
        "blue",
        "green",
        "yellow",
        "orange",
        "brown",
        "beige",
        "gold",
        "purple",
        "pink",
        "multicolor",
      ],
      vehicle_type: ["motorcycle", "bicycle", "car"],
      work_order_status: ["open", "closed", "voided"],
    },
  },
} as const

