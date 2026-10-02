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
      cuisine_step_templates: {
        Row: {
          config: Json | null
          created_at: string | null
          cuisine_type: string
          data_source: string
          id: string
          label_i18n: string
          required: boolean
          sort_order: number
          step_key: string
          step_type: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          cuisine_type: string
          data_source: string
          id?: string
          label_i18n: string
          required?: boolean
          sort_order?: number
          step_key: string
          step_type: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          cuisine_type?: string
          data_source?: string
          id?: string
          label_i18n?: string
          required?: boolean
          sort_order?: number
          step_key?: string
          step_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          created_at: string
          default_order_type: string
          email: string
          id: string
          name: string
          phone: string | null
          total_orders: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_order_type?: string
          email?: string
          id: string
          name?: string
          phone?: string | null
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_order_type?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: []
      }
      daily_order_counters: {
        Row: {
          counter: number
          order_date: string
          restaurant_id: string
        }
        Insert: {
          counter?: number
          order_date: string
          restaurant_id: string
        }
        Update: {
          counter?: number
          order_date?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_order_counters_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          email_type: string
          id: string
          metadata: Json | null
          recipient_email: string
          resend_id: string | null
          restaurant_id: string | null
          sent_at: string | null
          user_id: string | null
        }
        Insert: {
          email_type: string
          id?: string
          metadata?: Json | null
          recipient_email: string
          resend_id?: string | null
          restaurant_id?: string | null
          sent_at?: string | null
          user_id?: string | null
        }
        Update: {
          email_type?: string
          id?: string
          metadata?: Json | null
          recipient_email?: string
          resend_id?: string | null
          restaurant_id?: string | null
          sent_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          enabled: boolean | null
          id: string
          image: string | null
          is_alcohol: boolean | null
          name: string
          popular: boolean | null
          price: number
          product_type: string | null
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
          is_alcohol?: boolean | null
          name: string
          popular?: boolean | null
          price: number
          product_type?: string | null
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
          is_alcohol?: boolean | null
          name?: string
          popular?: boolean | null
          price?: number
          product_type?: string | null
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
      orders: {
        Row: {
          accepted_at: string | null
          client_ip: string | null
          completed_at: string | null
          covers: number | null
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          customer_user_id: string | null
          daily_number: number | null
          delivery_fee: number | null
          dessert_pending: boolean | null
          estimated_ready_at: string | null
          id: string
          is_test: boolean | null
          items: Json
          notes: string | null
          order_number: number
          order_type: string
          payment_method: string | null
          pickup_time: string | null
          ready_at: string | null
          restaurant_id: string
          source: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          client_ip?: string | null
          completed_at?: string | null
          covers?: number | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          customer_user_id?: string | null
          daily_number?: number | null
          delivery_fee?: number | null
          dessert_pending?: boolean | null
          estimated_ready_at?: string | null
          id?: string
          is_test?: boolean | null
          items?: Json
          notes?: string | null
          order_number?: number
          order_type: string
          payment_method?: string | null
          pickup_time?: string | null
          ready_at?: string | null
          restaurant_id: string
          source?: string | null
          status?: string
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          client_ip?: string | null
          completed_at?: string | null
          covers?: number | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          customer_user_id?: string | null
          daily_number?: number | null
          delivery_fee?: number | null
          dessert_pending?: boolean | null
          estimated_ready_at?: string | null
          id?: string
          is_test?: boolean | null
          items?: Json
          notes?: string | null
          order_number?: number
          order_type?: string
          payment_method?: string | null
          pickup_time?: string | null
          ready_at?: string | null
          restaurant_id?: string
          source?: string | null
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
      owners: {
        Row: {
          created_at: string | null
          email: string
          id: string
          phone: string
          role: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          phone: string
          role?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          phone?: string
          role?: string | null
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          device: string | null
          id: string
          language: string | null
          page_path: string
          page_type: string
          referrer: string | null
          restaurant_id: string | null
          screen_width: number | null
          session_id: string
          side: string
          user_agent: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          device?: string | null
          id?: string
          language?: string | null
          page_path: string
          page_type?: string
          referrer?: string | null
          restaurant_id?: string | null
          screen_width?: number | null
          session_id: string
          side?: string
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          device?: string | null
          id?: string
          language?: string | null
          page_path?: string
          page_type?: string
          referrer?: string | null
          restaurant_id?: string | null
          screen_width?: number | null
          session_id?: string
          side?: string
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_views_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_code_uses: {
        Row: {
          id: string
          promo_code_id: string
          restaurant_id: string
          used_at: string | null
        }
        Insert: {
          id?: string
          promo_code_id: string
          restaurant_id: string
          used_at?: string | null
        }
        Update: {
          id?: string
          promo_code_id?: string
          restaurant_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_uses_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_uses_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          active: boolean | null
          code: string
          created_at: string | null
          current_uses: number | null
          id: string
          max_uses: number | null
          type: string
          valid_from: string | null
          valid_until: string | null
          value: number
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          current_uses?: number | null
          id?: string
          max_uses?: number | null
          type: string
          valid_from?: string | null
          valid_until?: string | null
          value: number
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          current_uses?: number | null
          id?: string
          max_uses?: number | null
          type?: string
          valid_from?: string | null
          valid_until?: string | null
          value?: number
        }
        Relationships: []
      }
      prospection_events: {
        Row: {
          created_at: string | null
          email: string
          event_type: string
          id: string
          link_url: string | null
          metadata: Json | null
          resend_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          event_type: string
          id?: string
          link_url?: string | null
          metadata?: Json | null
          resend_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          event_type?: string
          id?: string
          link_url?: string | null
          metadata?: Json | null
          resend_id?: string
        }
        Relationships: []
      }
      prospection_sends: {
        Row: {
          city: string | null
          email: string
          id: string
          resend_id: string | null
          restaurant_name: string | null
          sent_at: string | null
        }
        Insert: {
          city?: string | null
          email: string
          id?: string
          resend_id?: string | null
          restaurant_name?: string | null
          sent_at?: string | null
        }
        Update: {
          city?: string | null
          email?: string
          id?: string
          resend_id?: string | null
          restaurant_name?: string | null
          sent_at?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_weeks_granted: number | null
          completed_at: string | null
          created_at: string | null
          id: string
          referee_email: string | null
          referee_id: string | null
          referrer_id: string
          status: string | null
        }
        Insert: {
          bonus_weeks_granted?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          referee_email?: string | null
          referee_id?: string | null
          referrer_id: string
          status?: string | null
        }
        Update: {
          bonus_weeks_granted?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          referee_email?: string | null
          referee_id?: string | null
          referrer_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_accompagnements: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          has_sauce_option: boolean | null
          has_sizes: boolean | null
          id: string
          name: string
          name_translations: Json | null
          price_default: number | null
          price_large: number | null
          price_medium: number | null
          price_small: number | null
          restaurant_id: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          has_sauce_option?: boolean | null
          has_sizes?: boolean | null
          id?: string
          name: string
          name_translations?: Json | null
          price_default?: number | null
          price_large?: number | null
          price_medium?: number | null
          price_small?: number | null
          restaurant_id: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          has_sauce_option?: boolean | null
          has_sizes?: boolean | null
          id?: string
          name?: string
          name_translations?: Json | null
          price_default?: number | null
          price_large?: number | null
          price_medium?: number | null
          price_small?: number | null
          restaurant_id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_accompagnements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_bases: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          group: string | null
          id: string
          image: string | null
          max_viandes: number | null
          name: string
          name_translations: Json | null
          price: number
          restaurant_id: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          group?: string | null
          id?: string
          image?: string | null
          max_viandes?: number | null
          name: string
          name_translations?: Json | null
          price?: number
          restaurant_id: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          group?: string | null
          id?: string
          image?: string | null
          max_viandes?: number | null
          name?: string
          name_translations?: Json | null
          price?: number
          restaurant_id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_bases_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_customers: {
        Row: {
          average_basket: number | null
          ban_expires_at: string | null
          banned_at: string | null
          banned_ip: string | null
          banned_reason: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          favorite_items: Json | null
          first_order_at: string | null
          flagged: boolean | null
          id: string
          is_banned: boolean | null
          last_items: Json | null
          last_order_at: string | null
          notes: string | null
          restaurant_id: string
          total_orders: number | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          average_basket?: number | null
          ban_expires_at?: string | null
          banned_at?: string | null
          banned_ip?: string | null
          banned_reason?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone: string
          favorite_items?: Json | null
          first_order_at?: string | null
          flagged?: boolean | null
          id?: string
          is_banned?: boolean | null
          last_items?: Json | null
          last_order_at?: string | null
          notes?: string | null
          restaurant_id: string
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          average_basket?: number | null
          ban_expires_at?: string | null
          banned_at?: string | null
          banned_ip?: string | null
          banned_reason?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          favorite_items?: Json | null
          first_order_at?: string | null
          flagged?: boolean | null
          id?: string
          is_banned?: boolean | null
          last_items?: Json | null
          last_order_at?: string | null
          notes?: string | null
          restaurant_id?: string
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_garnitures: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          is_default: boolean | null
          name: string
          name_translations: Json | null
          price_x2: number | null
          restaurant_id: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          is_default?: boolean | null
          name: string
          name_translations?: Json | null
          price_x2?: number | null
          restaurant_id: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          is_default?: boolean | null
          name?: string
          name_translations?: Json | null
          price_x2?: number | null
          restaurant_id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_garnitures_restaurant_id_fkey"
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
      restaurant_order_config: {
        Row: {
          created_at: string | null
          enable_boisson_upsell: boolean | null
          enable_dessert_upsell: boolean | null
          extra_accompagnement_price: number | null
          extra_sauce_price: number | null
          free_accompagnements: number | null
          free_sauces_frites: number | null
          free_sauces_sandwich: number | null
          id: string
          pain_supplement_price: number | null
          restaurant_id: string
          suggest_sauce_from_sandwich: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enable_boisson_upsell?: boolean | null
          enable_dessert_upsell?: boolean | null
          extra_accompagnement_price?: number | null
          extra_sauce_price?: number | null
          free_accompagnements?: number | null
          free_sauces_frites?: number | null
          free_sauces_sandwich?: number | null
          id?: string
          pain_supplement_price?: number | null
          restaurant_id: string
          suggest_sauce_from_sandwich?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enable_boisson_upsell?: boolean | null
          enable_dessert_upsell?: boolean | null
          extra_accompagnement_price?: number | null
          extra_sauce_price?: number | null
          free_accompagnements?: number | null
          free_sauces_frites?: number | null
          free_sauces_sandwich?: number | null
          id?: string
          pain_supplement_price?: number | null
          restaurant_id?: string
          suggest_sauce_from_sandwich?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_order_config_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_sauces: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          is_for_frites: boolean | null
          is_for_sandwich: boolean | null
          name: string
          name_translations: Json | null
          restaurant_id: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          is_for_frites?: boolean | null
          is_for_sandwich?: boolean | null
          name: string
          name_translations?: Json | null
          restaurant_id: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          is_for_frites?: boolean | null
          is_for_sandwich?: boolean | null
          name?: string
          name_translations?: Json | null
          restaurant_id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_sauces_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tablets: {
        Row: {
          activated_at: string | null
          created_at: string | null
          deactivated_at: string | null
          id: string
          name: string | null
          notes: string | null
          restaurant_id: string
          serial_number: string
          status: string
          usage_type: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          restaurant_id: string
          serial_number: string
          status?: string
          usage_type?: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          restaurant_id?: string
          serial_number?: string
          status?: string
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tablets_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_viandes: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          image: string | null
          name: string
          name_translations: Json | null
          restaurant_id: string
          sort_order: number | null
          supplement: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          image?: string | null
          name: string
          name_translations?: Json | null
          restaurant_id: string
          sort_order?: number | null
          supplement?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          image?: string | null
          name?: string
          name_translations?: Json | null
          restaurant_id?: string
          sort_order?: number | null
          supplement?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_viandes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          account_status: string | null
          address: string | null
          availability_mode: string | null
          bg_color: string | null
          bonus_weeks: number | null
          business_type: string | null
          categories: string[] | null
          category_translations: Json | null
          city: string | null
          cover_image: string | null
          created_at: string
          cuisine: string | null
          cuisine_type: string
          customization_config: Json | null
          deactivated_at: string | null
          deactivation_visit_count: number | null
          delivery_fee: number | null
          description: string | null
          dine_in_capacity: number | null
          estimated_time: string | null
          features: Json | null
          google_place_id: string | null
          hours: string | null
          id: string
          image: string | null
          is_accepting_orders: boolean | null
          is_demo: boolean | null
          is_open: boolean | null
          minimum_order: number | null
          name: string
          notification_sound: string | null
          order_mode: string | null
          out_of_stock_ingredients: Json | null
          owner_id: string | null
          payment_methods: string[] | null
          preferred_language: string | null
          prep_time_config: Json | null
          primary_color: string | null
          rating: number | null
          referral_code: string | null
          referred_by: string | null
          restaurant_phone: string | null
          review_count: number | null
          schedule: Json | null
          scheduled_deletion_at: string | null
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_plan: string | null
          subscription_start_date: string | null
          subscription_status: string | null
          trial_end_date: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_status?: string | null
          address?: string | null
          availability_mode?: string | null
          bg_color?: string | null
          bonus_weeks?: number | null
          business_type?: string | null
          categories?: string[] | null
          category_translations?: Json | null
          city?: string | null
          cover_image?: string | null
          created_at?: string
          cuisine?: string | null
          cuisine_type?: string
          customization_config?: Json | null
          deactivated_at?: string | null
          deactivation_visit_count?: number | null
          delivery_fee?: number | null
          description?: string | null
          dine_in_capacity?: number | null
          estimated_time?: string | null
          features?: Json | null
          google_place_id?: string | null
          hours?: string | null
          id?: string
          image?: string | null
          is_accepting_orders?: boolean | null
          is_demo?: boolean | null
          is_open?: boolean | null
          minimum_order?: number | null
          name: string
          notification_sound?: string | null
          order_mode?: string | null
          out_of_stock_ingredients?: Json | null
          owner_id?: string | null
          payment_methods?: string[] | null
          preferred_language?: string | null
          prep_time_config?: Json | null
          primary_color?: string | null
          rating?: number | null
          referral_code?: string | null
          referred_by?: string | null
          restaurant_phone?: string | null
          review_count?: number | null
          schedule?: Json | null
          scheduled_deletion_at?: string | null
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?: string | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          trial_end_date?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_status?: string | null
          address?: string | null
          availability_mode?: string | null
          bg_color?: string | null
          bonus_weeks?: number | null
          business_type?: string | null
          categories?: string[] | null
          category_translations?: Json | null
          city?: string | null
          cover_image?: string | null
          created_at?: string
          cuisine?: string | null
          cuisine_type?: string
          customization_config?: Json | null
          deactivated_at?: string | null
          deactivation_visit_count?: number | null
          delivery_fee?: number | null
          description?: string | null
          dine_in_capacity?: number | null
          estimated_time?: string | null
          features?: Json | null
          google_place_id?: string | null
          hours?: string | null
          id?: string
          image?: string | null
          is_accepting_orders?: boolean | null
          is_demo?: boolean | null
          is_open?: boolean | null
          minimum_order?: number | null
          name?: string
          notification_sound?: string | null
          order_mode?: string | null
          out_of_stock_ingredients?: Json | null
          owner_id?: string | null
          payment_methods?: string[] | null
          preferred_language?: string | null
          prep_time_config?: Json | null
          primary_color?: string | null
          rating?: number | null
          referral_code?: string | null
          referred_by?: string | null
          restaurant_phone?: string | null
          review_count?: number | null
          schedule?: Json | null
          scheduled_deletion_at?: string | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?: string | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          trial_end_date?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_photos: {
        Row: {
          created_at: string
          id: string
          image_url: string
          keywords: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          image_url: string
          keywords?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          keywords?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_day: number | null
          bonus_days: number | null
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          promo_code_used: string | null
          restaurant_id: string
          shopify_contract_id: string | null
          shopify_customer_id: string | null
          shopify_order_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_session_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
        }
        Insert: {
          billing_day?: number | null
          bonus_days?: number | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          promo_code_used?: string | null
          restaurant_id: string
          shopify_contract_id?: string | null
          shopify_customer_id?: string | null
          shopify_order_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_day?: number | null
          bonus_days?: number | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          promo_code_used?: string | null
          restaurant_id?: string
          shopify_contract_id?: string | null
          shopify_customer_id?: string | null
          shopify_order_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_email_preferences: {
        Row: {
          created_at: string | null
          id: string
          marketing_emails: boolean | null
          referral_emails: boolean | null
          subscription_emails: boolean | null
          unsubscribed_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          marketing_emails?: boolean | null
          referral_emails?: boolean | null
          subscription_emails?: boolean | null
          unsubscribed_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          marketing_emails?: boolean | null
          referral_emails?: boolean | null
          subscription_emails?: boolean | null
          unsubscribed_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_demo_order: {
        Args: { p_new_status: string; p_order_id: string }
        Returns: {
          accepted_at: string | null
          client_ip: string | null
          completed_at: string | null
          covers: number | null
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          customer_user_id: string | null
          daily_number: number | null
          delivery_fee: number | null
          dessert_pending: boolean | null
          estimated_ready_at: string | null
          id: string
          is_test: boolean | null
          items: Json
          notes: string | null
          order_number: number
          order_type: string
          payment_method: string | null
          pickup_time: string | null
          ready_at: string | null
          restaurant_id: string
          source: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      check_customer_ban: {
        Args: { p_email?: string; p_phone: string; p_restaurant_id: string }
        Returns: Json
      }
      cleanup_demo_orders: { Args: never; Returns: undefined }
      get_active_order_count: {
        Args: { p_restaurant_id: string }
        Returns: number
      }
      get_demo_customers: {
        Args: { p_restaurant_id: string }
        Returns: {
          average_basket: number | null
          ban_expires_at: string | null
          banned_at: string | null
          banned_ip: string | null
          banned_reason: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          favorite_items: Json | null
          first_order_at: string | null
          flagged: boolean | null
          id: string
          is_banned: boolean | null
          last_items: Json | null
          last_order_at: string | null
          notes: string | null
          restaurant_id: string
          total_orders: number | null
          total_spent: number | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "restaurant_customers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_demo_orders: {
        Args: { p_restaurant_id: string }
        Returns: {
          accepted_at: string | null
          client_ip: string | null
          completed_at: string | null
          covers: number | null
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          customer_user_id: string | null
          daily_number: number | null
          delivery_fee: number | null
          dessert_pending: boolean | null
          estimated_ready_at: string | null
          id: string
          is_test: boolean | null
          items: Json
          notes: string | null
          order_number: number
          order_type: string
          payment_method: string | null
          pickup_time: string | null
          ready_at: string | null
          restaurant_id: string
          source: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_demo_restaurant: {
        Args: { p_slug: string }
        Returns: {
          account_status: string | null
          address: string | null
          availability_mode: string | null
          bg_color: string | null
          bonus_weeks: number | null
          business_type: string | null
          categories: string[] | null
          category_translations: Json | null
          city: string | null
          cover_image: string | null
          created_at: string
          cuisine: string | null
          cuisine_type: string
          customization_config: Json | null
          deactivated_at: string | null
          deactivation_visit_count: number | null
          delivery_fee: number | null
          description: string | null
          dine_in_capacity: number | null
          estimated_time: string | null
          features: Json | null
          google_place_id: string | null
          hours: string | null
          id: string
          image: string | null
          is_accepting_orders: boolean | null
          is_demo: boolean | null
          is_open: boolean | null
          minimum_order: number | null
          name: string
          notification_sound: string | null
          order_mode: string | null
          out_of_stock_ingredients: Json | null
          owner_id: string | null
          payment_methods: string[] | null
          preferred_language: string | null
          prep_time_config: Json | null
          primary_color: string | null
          rating: number | null
          referral_code: string | null
          referred_by: string | null
          restaurant_phone: string | null
          review_count: number | null
          schedule: Json | null
          scheduled_deletion_at: string | null
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_plan: string | null
          subscription_start_date: string | null
          subscription_status: string | null
          trial_end_date: string | null
          updated_at: string
          website: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "restaurants"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_order_for_tracking: { Args: { p_order_id: string }; Returns: Json }
      get_public_restaurant_by_id: { Args: { p_id: string }; Returns: Json }
      get_public_restaurant_by_slug: { Args: { p_slug: string }; Returns: Json }
      grant_referral_bonus: {
        Args: { p_bonus_weeks: number; p_referrer_id: string }
        Returns: undefined
      }
      increment_deactivation_visits: {
        Args: { p_restaurant_id: string }
        Returns: undefined
      }
      is_super_admin: { Args: never; Returns: boolean }
      link_orders_to_user: {
        Args: { p_email: string; p_phone: string; p_user_id: string }
        Returns: undefined
      }
      place_order: {
        Args: {
          p_client_ip: string
          p_covers: number
          p_customer_email: string
          p_customer_name: string
          p_customer_phone: string
          p_estimated_ready_at: string
          p_is_test: boolean
          p_items: Json
          p_notes: string
          p_order_type: string
          p_payment_method: string
          p_pickup_time: string
          p_restaurant_id: string
          p_source: string
          p_subtotal: number
          p_total: number
        }
        Returns: {
          accepted_at: string | null
          client_ip: string | null
          completed_at: string | null
          covers: number | null
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          customer_user_id: string | null
          daily_number: number | null
          delivery_fee: number | null
          dessert_pending: boolean | null
          estimated_ready_at: string | null
          id: string
          is_test: boolean | null
          items: Json
          notes: string | null
          order_number: number
          order_type: string
          payment_method: string | null
          pickup_time: string | null
          ready_at: string | null
          restaurant_id: string
          source: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      process_referral_code: {
        Args: { p_ref_code: string; p_referee_restaurant_id: string }
        Returns: boolean
      }
      public_restaurant_payload: {
        Args: { r: Database["public"]["Tables"]["restaurants"]["Row"] }
        Returns: Json
      }
      validate_order_total: {
        Args: { p_claimed_total: number; p_items: Json }
        Returns: boolean
      }
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
