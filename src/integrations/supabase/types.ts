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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      menu_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          enabled: boolean | null
          id: string
          image: string | null
          name: string
          popular: boolean | null
          price: number
          restaurant_id: string
          sauces: string[] | null
          sort_order: number | null
          supplements: Json | null
          tags: string[] | null
          translations: Json | null
          updated_at: string
          variants: Json | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          id?: string
          image?: string | null
          name: string
          popular?: boolean | null
          price: number
          restaurant_id: string
          sauces?: string[] | null
          sort_order?: number | null
          supplements?: Json | null
          tags?: string[] | null
          translations?: Json | null
          updated_at?: string
          variants?: Json | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          id?: string
          image?: string | null
          name?: string
          popular?: boolean | null
          price?: number
          restaurant_id?: string
          sauces?: string[] | null
          sort_order?: number | null
          supplements?: Json | null
          tags?: string[] | null
          translations?: Json | null
          updated_at?: string
          variants?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          created_at: string
          email: string
          id: string
          phone: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          phone: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          phone?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_name: string
          customer_phone: string
          delivery_fee: number | null
          id: string
          items: Json
          notes: string | null
          order_number: number
          order_type: string
          restaurant_id: string
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_name: string
          customer_phone: string
          delivery_fee?: number | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: number
          order_type: string
          restaurant_id: string
          status?: string
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_fee?: number | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: number
          order_type?: string
          restaurant_id?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_hours: {
        Row: {
          close_time: string | null
          day_of_week: number
          id: string
          is_open: boolean | null
          open_time: string | null
          restaurant_id: string
        }
        Insert: {
          close_time?: string | null
          day_of_week: number
          id?: string
          is_open?: boolean | null
          open_time?: string | null
          restaurant_id: string
        }
        Update: {
          close_time?: string | null
          day_of_week?: number
          id?: string
          is_open?: boolean | null
          open_time?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          availability_mode: string | null
          bg_color: string | null
          categories: string[] | null
          category_translations: Json | null
          city: string | null
          cover_image: string | null
          created_at: string
          cuisine: string | null
          delivery_fee: number | null
          description: string | null
          estimated_time: string | null
          features: Json | null
          google_place_id: string | null
          hours: string | null
          id: string
          image: string | null
          is_accepting_orders: boolean | null
          is_open: boolean | null
          minimum_order: number | null
          name: string
          notification_sound: string | null
          order_mode: string | null
          owner_id: string | null
          payment_methods: string[] | null
          prep_time_config: Json | null
          primary_color: string | null
          rating: number | null
          restaurant_phone: string | null
          review_count: number | null
          schedule: Json | null
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_plan: string | null
          subscription_start_date: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          availability_mode?: string | null
          bg_color?: string | null
          categories?: string[] | null
          category_translations?: Json | null
          city?: string | null
          cover_image?: string | null
          created_at?: string
          cuisine?: string | null
          delivery_fee?: number | null
          description?: string | null
          estimated_time?: string | null
          features?: Json | null
          google_place_id?: string | null
          hours?: string | null
          id?: string
          image?: string | null
          is_accepting_orders?: boolean | null
          is_open?: boolean | null
          minimum_order?: number | null
          name: string
          notification_sound?: string | null
          order_mode?: string | null
          owner_id?: string | null
          payment_methods?: string[] | null
          prep_time_config?: Json | null
          primary_color?: string | null
          rating?: number | null
          restaurant_phone?: string | null
          review_count?: number | null
          schedule?: Json | null
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?: string | null
          subscription_start_date?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          availability_mode?: string | null
          bg_color?: string | null
          categories?: string[] | null
          category_translations?: Json | null
          city?: string | null
          cover_image?: string | null
          created_at?: string
          cuisine?: string | null
          delivery_fee?: number | null
          description?: string | null
          estimated_time?: string | null
          features?: Json | null
          google_place_id?: string | null
          hours?: string | null
          id?: string
          image?: string | null
          is_accepting_orders?: boolean | null
          is_open?: boolean | null
          minimum_order?: number | null
          name?: string
          notification_sound?: string | null
          order_mode?: string | null
          owner_id?: string | null
          payment_methods?: string[] | null
          prep_time_config?: Json | null
          primary_color?: string | null
          rating?: number | null
          restaurant_phone?: string | null
          review_count?: number | null
          schedule?: Json | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?: string | null
          subscription_start_date?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
