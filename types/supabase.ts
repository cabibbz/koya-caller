/**
 * Supabase Database Types
 * Complete type definitions for all database tables
 * 
 * Spec Reference: 
 * - Part 9, Lines 852-936 (Session 2: Core Tables)
 * - Part 9, Lines 937-1178 (Session 3: Operations Tables)
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // ============================================
      // Users (Spec Lines 856-861)
      // ============================================
      users: {
        Row: {
          id: string
          email: string
          phone: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          phone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          phone?: string | null
          created_at?: string
        }
        Relationships: []
      }

      // ============================================
      // Plans (Spec Lines 863-874)
      // ============================================
      plans: {
        Row: {
          id: string
          slug: string
          name: string
          price_cents: number
          included_minutes: number
          features: Json | null
          stripe_price_id: string | null
          sort_order: number
          is_active: boolean
        }
        Insert: {
          id?: string
          slug: string
          name: string
          price_cents: number
          included_minutes: number
          features?: Json | null
          stripe_price_id?: string | null
          sort_order?: number
          is_active?: boolean
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          price_cents?: number
          included_minutes?: number
          features?: Json | null
          stripe_price_id?: string | null
          sort_order?: number
          is_active?: boolean
        }
        Relationships: []
      }

      // ============================================
      // Businesses (Spec Lines 876-907)
      // ============================================
      businesses: {
        Row: {
          id: string
          user_id: string | null
          name: string
          business_type: string | null
          address: string | null
          website: string | null
          service_area: string | null
          differentiator: string | null
          timezone: string
          created_at: string
          updated_at: string
          onboarding_step: number
          onboarding_completed_at: string | null
          subscription_status: string
          plan_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          current_cycle_start: string | null
          current_cycle_end: string | null
          minutes_used_this_cycle: number
          minutes_included: number
          last_usage_alert_percent: number
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          business_type?: string | null
          address?: string | null
          website?: string | null
          service_area?: string | null
          differentiator?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
          onboarding_step?: number
          onboarding_completed_at?: string | null
          subscription_status?: string
          plan_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_cycle_start?: string | null
          current_cycle_end?: string | null
          minutes_used_this_cycle?: number
          minutes_included?: number
          last_usage_alert_percent?: number
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          business_type?: string | null
          address?: string | null
          website?: string | null
          service_area?: string | null
          differentiator?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
          onboarding_step?: number
          onboarding_completed_at?: string | null
          subscription_status?: string
          plan_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_cycle_start?: string | null
          current_cycle_end?: string | null
          minutes_used_this_cycle?: number
          minutes_included?: number
          last_usage_alert_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "businesses_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_plan_id_fkey"
            columns: ["plan_id"]
            referencedRelation: "plans"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Business Hours (Spec Lines 909-918)
      // ============================================
      business_hours: {
        Row: {
          id: string
          business_id: string | null
          day_of_week: number
          open_time: string | null
          close_time: string | null
          is_closed: boolean
        }
        Insert: {
          id?: string
          business_id?: string | null
          day_of_week: number
          open_time?: string | null
          close_time?: string | null
          is_closed?: boolean
        }
        Update: {
          id?: string
          business_id?: string | null
          day_of_week?: number
          open_time?: string | null
          close_time?: string | null
          is_closed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Services (Spec Lines 920-935)
      // ============================================
      services: {
        Row: {
          id: string
          business_id: string | null
          name: string
          description: string | null
          duration_minutes: number
          price_cents: number | null
          price_type: string
          is_bookable: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          name: string
          description?: string | null
          duration_minutes?: number
          price_cents?: number | null
          price_type?: string
          is_bookable?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string | null
          name?: string
          description?: string | null
          duration_minutes?: number
          price_cents?: number | null
          price_type?: string
          is_bookable?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // FAQs (Spec Lines 937-948)
      // ============================================
      faqs: {
        Row: {
          id: string
          business_id: string | null
          question: string
          answer: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          question: string
          answer: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string | null
          question?: string
          answer?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faqs_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Knowledge (Spec Lines 950-958)
      // ============================================
      knowledge: {
        Row: {
          id: string
          business_id: string | null
          content: string | null
          never_say: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          content?: string | null
          never_say?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string | null
          content?: string | null
          never_say?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // AI Config (Spec Lines 960-987)
      // ============================================
      ai_config: {
        Row: {
          id: string
          business_id: string | null
          voice_id: string | null
          voice_id_spanish: string | null
          ai_name: string
          personality: string
          greeting: string | null
          greeting_spanish: string | null
          after_hours_greeting: string | null
          after_hours_greeting_spanish: string | null
          minutes_exhausted_greeting: string | null
          minutes_exhausted_greeting_spanish: string | null
          spanish_enabled: boolean
          language_mode: string
          system_prompt: string | null
          system_prompt_spanish: string | null
          system_prompt_version: number
          system_prompt_generated_at: string | null
          retell_agent_id: string | null
          retell_agent_id_spanish: string | null
          retell_agent_version: number
          // Enhanced prompt system (migration 20250110000001)
          prompt_config: Json | null
          // Upselling feature flags (migrations 20250111000001, 20250112000001)
          upsells_enabled: boolean
          bundles_enabled: boolean
          packages_enabled: boolean
          memberships_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          voice_id?: string | null
          voice_id_spanish?: string | null
          ai_name?: string
          personality?: string
          greeting?: string | null
          greeting_spanish?: string | null
          after_hours_greeting?: string | null
          after_hours_greeting_spanish?: string | null
          minutes_exhausted_greeting?: string | null
          minutes_exhausted_greeting_spanish?: string | null
          spanish_enabled?: boolean
          language_mode?: string
          system_prompt?: string | null
          system_prompt_spanish?: string | null
          system_prompt_version?: number
          system_prompt_generated_at?: string | null
          retell_agent_id?: string | null
          retell_agent_id_spanish?: string | null
          retell_agent_version?: number
          prompt_config?: Json | null
          upsells_enabled?: boolean
          bundles_enabled?: boolean
          packages_enabled?: boolean
          memberships_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string | null
          voice_id?: string | null
          voice_id_spanish?: string | null
          ai_name?: string
          personality?: string
          greeting?: string | null
          greeting_spanish?: string | null
          after_hours_greeting?: string | null
          after_hours_greeting_spanish?: string | null
          minutes_exhausted_greeting?: string | null
          minutes_exhausted_greeting_spanish?: string | null
          spanish_enabled?: boolean
          language_mode?: string
          system_prompt?: string | null
          system_prompt_spanish?: string | null
          system_prompt_version?: number
          system_prompt_generated_at?: string | null
          retell_agent_id?: string | null
          retell_agent_id_spanish?: string | null
          retell_agent_version?: number
          prompt_config?: Json | null
          upsells_enabled?: boolean
          bundles_enabled?: boolean
          packages_enabled?: boolean
          memberships_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_config_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Call Settings (Spec Lines 989-1010)
      // ============================================
      call_settings: {
        Row: {
          id: string
          business_id: string | null
          transfer_number: string | null
          backup_transfer_number: string | null
          transfer_on_request: boolean
          transfer_on_emergency: boolean
          transfer_on_upset: boolean
          transfer_keywords: string[]
          transfer_hours_type: string
          transfer_hours_custom: Json | null
          no_answer_action: string
          no_answer_timeout_seconds: number
          after_hours_enabled: boolean
          after_hours_can_book: boolean
          after_hours_message_only: boolean
          max_call_duration_seconds: number
          recording_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          transfer_number?: string | null
          backup_transfer_number?: string | null
          transfer_on_request?: boolean
          transfer_on_emergency?: boolean
          transfer_on_upset?: boolean
          transfer_keywords?: string[]
          transfer_hours_type?: string
          transfer_hours_custom?: Json | null
          no_answer_action?: string
          no_answer_timeout_seconds?: number
          after_hours_enabled?: boolean
          after_hours_can_book?: boolean
          after_hours_message_only?: boolean
          max_call_duration_seconds?: number
          recording_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string | null
          transfer_number?: string | null
          backup_transfer_number?: string | null
          transfer_on_request?: boolean
          transfer_on_emergency?: boolean
          transfer_on_upset?: boolean
          transfer_keywords?: string[]
          transfer_hours_type?: string
          transfer_hours_custom?: Json | null
          no_answer_action?: string
          no_answer_timeout_seconds?: number
          after_hours_enabled?: boolean
          after_hours_can_book?: boolean
          after_hours_message_only?: boolean
          max_call_duration_seconds?: number
          recording_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_settings_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Calendar Integrations (Spec Lines 1012-1027)
      // ============================================
      calendar_integrations: {
        Row: {
          id: string
          business_id: string | null
          provider: string
          access_token: string | null
          refresh_token: string | null
          token_expires_at: string | null
          calendar_id: string | null
          default_duration_minutes: number
          buffer_minutes: number
          advance_booking_days: number
          require_email: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          provider: string
          access_token?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          calendar_id?: string | null
          default_duration_minutes?: number
          buffer_minutes?: number
          advance_booking_days?: number
          require_email?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string | null
          provider?: string
          access_token?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          calendar_id?: string | null
          default_duration_minutes?: number
          buffer_minutes?: number
          advance_booking_days?: number
          require_email?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_integrations_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Availability Slots (Spec Lines 1029-1038)
      // ============================================
      availability_slots: {
        Row: {
          id: string
          business_id: string | null
          day_of_week: number
          start_time: string
          end_time: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          day_of_week: number
          start_time: string
          end_time: string
        }
        Update: {
          id?: string
          business_id?: string | null
          day_of_week?: number
          start_time?: string
          end_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Phone Numbers (Spec Lines 1040-1054)
      // ============================================
      phone_numbers: {
        Row: {
          id: string
          business_id: string | null
          number: string
          twilio_sid: string | null
          setup_type: string
          forwarded_from: string | null
          carrier: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          number: string
          twilio_sid?: string | null
          setup_type?: string
          forwarded_from?: string | null
          carrier?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string | null
          number?: string
          twilio_sid?: string | null
          setup_type?: string
          forwarded_from?: string | null
          carrier?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Calls (Spec Lines 1056-1082)
      // ============================================
      calls: {
        Row: {
          id: string
          business_id: string | null
          retell_call_id: string | null
          from_number: string | null
          to_number: string | null
          started_at: string | null
          ended_at: string | null
          duration_seconds: number | null
          duration_minutes_billed: number | null
          language: string
          recording_url: string | null
          transcript: Json | null
          summary: string | null
          outcome: string | null
          lead_info: Json | null
          message_taken: string | null
          cost_cents: number | null
          // Added in migration 20250109000001
          flagged: boolean
          notes: string | null
          // Enhanced prompt system (migration 20250110000001)
          sentiment_detected: string | null
          error_recovery_used: boolean
          created_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          retell_call_id?: string | null
          from_number?: string | null
          to_number?: string | null
          started_at?: string | null
          ended_at?: string | null
          duration_seconds?: number | null
          duration_minutes_billed?: number | null
          language?: string
          recording_url?: string | null
          transcript?: Json | null
          summary?: string | null
          outcome?: string | null
          lead_info?: Json | null
          message_taken?: string | null
          cost_cents?: number | null
          flagged?: boolean
          notes?: string | null
          sentiment_detected?: string | null
          error_recovery_used?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string | null
          retell_call_id?: string | null
          from_number?: string | null
          to_number?: string | null
          started_at?: string | null
          ended_at?: string | null
          duration_seconds?: number | null
          duration_minutes_billed?: number | null
          language?: string
          recording_url?: string | null
          transcript?: Json | null
          summary?: string | null
          outcome?: string | null
          lead_info?: Json | null
          message_taken?: string | null
          cost_cents?: number | null
          flagged?: boolean
          notes?: string | null
          sentiment_detected?: string | null
          error_recovery_used?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Appointments (Spec Lines 1084-1107)
      // ============================================
      appointments: {
        Row: {
          id: string
          business_id: string | null
          call_id: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_email: string | null
          service_id: string | null
          service_name: string | null
          scheduled_at: string | null
          duration_minutes: number | null
          status: string
          notes: string | null
          external_event_id: string | null
          confirmation_sent_at: string | null
          reminder_sent_at: string | null
          reminder_1hr_sent_at: string | null
          reminder_24hr_sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          call_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_email?: string | null
          service_id?: string | null
          service_name?: string | null
          scheduled_at?: string | null
          duration_minutes?: number | null
          status?: string
          notes?: string | null
          external_event_id?: string | null
          confirmation_sent_at?: string | null
          reminder_sent_at?: string | null
          reminder_1hr_sent_at?: string | null
          reminder_24hr_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string | null
          call_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_email?: string | null
          service_id?: string | null
          service_name?: string | null
          scheduled_at?: string | null
          duration_minutes?: number | null
          status?: string
          notes?: string | null
          external_event_id?: string | null
          confirmation_sent_at?: string | null
          reminder_sent_at?: string | null
          reminder_1hr_sent_at?: string | null
          reminder_24hr_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_call_id_fkey"
            columns: ["call_id"]
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // SMS Messages (Spec Lines 1109-1127)
      // ============================================
      sms_messages: {
        Row: {
          id: string
          business_id: string | null
          call_id: string | null
          appointment_id: string | null
          direction: string
          message_type: string
          from_number: string | null
          to_number: string | null
          body: string | null
          twilio_sid: string | null
          status: string
          sent_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          call_id?: string | null
          appointment_id?: string | null
          direction: string
          message_type: string
          from_number?: string | null
          to_number?: string | null
          body?: string | null
          twilio_sid?: string | null
          status?: string
          sent_at?: string
        }
        Update: {
          id?: string
          business_id?: string | null
          call_id?: string | null
          appointment_id?: string | null
          direction?: string
          message_type?: string
          from_number?: string | null
          to_number?: string | null
          body?: string | null
          twilio_sid?: string | null
          status?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_call_id_fkey"
            columns: ["call_id"]
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Notification Settings (Spec Lines 1128-1141)
      // ============================================
      notification_settings: {
        Row: {
          id: string
          business_id: string | null
          sms_all_calls: boolean
          sms_bookings: boolean
          sms_missed: boolean
          sms_messages: boolean
          sms_usage_alerts: boolean
          email_daily: boolean
          email_weekly: boolean
          sms_customer_confirmation: boolean
          sms_customer_reminder: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          sms_all_calls?: boolean
          sms_bookings?: boolean
          sms_missed?: boolean
          sms_messages?: boolean
          sms_usage_alerts?: boolean
          email_daily?: boolean
          email_weekly?: boolean
          sms_customer_confirmation?: boolean
          sms_customer_reminder?: string
        }
        Update: {
          id?: string
          business_id?: string | null
          sms_all_calls?: boolean
          sms_bookings?: boolean
          sms_missed?: boolean
          sms_messages?: boolean
          sms_usage_alerts?: boolean
          email_daily?: boolean
          email_weekly?: boolean
          sms_customer_confirmation?: boolean
          sms_customer_reminder?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Business Templates (Spec Lines 1143-1152)
      // ============================================
      business_templates: {
        Row: {
          id: string
          type_slug: string
          type_name: string
          default_services: Json
          default_faqs: Json
          urgency_triggers: string[]
          sort_order: number
        }
        Insert: {
          id?: string
          type_slug: string
          type_name: string
          default_services?: Json
          default_faqs?: Json
          urgency_triggers?: string[]
          sort_order?: number
        }
        Update: {
          id?: string
          type_slug?: string
          type_name?: string
          default_services?: Json
          default_faqs?: Json
          urgency_triggers?: string[]
          sort_order?: number
        }
        Relationships: []
      }

      // ============================================
      // Demo Leads (Spec Lines 1154-1164)
      // ============================================
      demo_leads: {
        Row: {
          id: string
          email: string
          demo_started_at: string
          demo_completed: boolean
          converted_to_signup: boolean
          converted_at: string | null
        }
        Insert: {
          id?: string
          email: string
          demo_started_at?: string
          demo_completed?: boolean
          converted_to_signup?: boolean
          converted_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          demo_started_at?: string
          demo_completed?: boolean
          converted_to_signup?: boolean
          converted_at?: string | null
        }
        Relationships: []
      }

      // ============================================
      // Prompt Regeneration Queue (Spec Lines 1166-1178)
      // ============================================
      prompt_regeneration_queue: {
        Row: {
          id: string
          business_id: string | null
          triggered_by: string
          status: string
          error_message: string | null
          created_at: string
          processed_at: string | null
        }
        Insert: {
          id?: string
          business_id?: string | null
          triggered_by: string
          status?: string
          error_message?: string | null
          created_at?: string
          processed_at?: string | null
        }
        Update: {
          id?: string
          business_id?: string | null
          triggered_by?: string
          status?: string
          error_message?: string | null
          created_at?: string
          processed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_regeneration_queue_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Bundles (Advanced Upselling)
      // ============================================
      bundles: {
        Row: {
          id: string
          business_id: string | null
          name: string
          description: string | null
          discount_percent: number
          pitch_message: string | null
          is_active: boolean
          times_offered: number
          times_accepted: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          name: string
          description?: string | null
          discount_percent?: number
          pitch_message?: string | null
          is_active?: boolean
          times_offered?: number
          times_accepted?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string | null
          name?: string
          description?: string | null
          discount_percent?: number
          pitch_message?: string | null
          is_active?: boolean
          times_offered?: number
          times_accepted?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundles_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Bundle Services (Junction table)
      // ============================================
      bundle_services: {
        Row: {
          id: string
          bundle_id: string
          service_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          bundle_id: string
          service_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          bundle_id?: string
          service_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_services_bundle_id_fkey"
            columns: ["bundle_id"]
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_services_service_id_fkey"
            columns: ["service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Packages (Multi-visit packages)
      // ============================================
      packages: {
        Row: {
          id: string
          business_id: string | null
          name: string
          description: string | null
          service_id: string | null
          session_count: number
          discount_percent: number
          price_cents: number | null
          validity_days: number | null
          pitch_message: string | null
          min_visits_to_pitch: number
          is_active: boolean
          times_offered: number
          times_accepted: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          name: string
          description?: string | null
          service_id?: string | null
          session_count: number
          discount_percent?: number
          price_cents?: number | null
          validity_days?: number | null
          pitch_message?: string | null
          min_visits_to_pitch?: number
          is_active?: boolean
          times_offered?: number
          times_accepted?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string | null
          name?: string
          description?: string | null
          service_id?: string | null
          session_count?: number
          discount_percent?: number
          price_cents?: number | null
          validity_days?: number | null
          pitch_message?: string | null
          min_visits_to_pitch?: number
          is_active?: boolean
          times_offered?: number
          times_accepted?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_service_id_fkey"
            columns: ["service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Memberships (Subscription plans)
      // ============================================
      memberships: {
        Row: {
          id: string
          business_id: string | null
          name: string
          description: string | null
          price_cents: number
          billing_period: string
          benefits: string
          pitch_message: string | null
          pitch_after_booking_amount_cents: number | null
          pitch_after_visit_count: number | null
          is_active: boolean
          times_offered: number
          times_accepted: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          name: string
          description?: string | null
          price_cents: number
          billing_period?: string
          benefits: string
          pitch_message?: string | null
          pitch_after_booking_amount_cents?: number | null
          pitch_after_visit_count?: number | null
          is_active?: boolean
          times_offered?: number
          times_accepted?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string | null
          name?: string
          description?: string | null
          price_cents?: number
          billing_period?: string
          benefits?: string
          pitch_message?: string | null
          pitch_after_booking_amount_cents?: number | null
          pitch_after_visit_count?: number | null
          is_active?: boolean
          times_offered?: number
          times_accepted?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Caller Profiles (migration 20250110000001)
      // ============================================
      caller_profiles: {
        Row: {
          id: string
          business_id: string
          phone_number: string
          name: string | null
          email: string | null
          preferences: Json
          call_count: number
          last_call_at: string
          last_outcome: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          phone_number: string
          name?: string | null
          email?: string | null
          preferences?: Json
          call_count?: number
          last_call_at?: string
          last_outcome?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          phone_number?: string
          name?: string | null
          email?: string | null
          preferences?: Json
          call_count?: number
          last_call_at?: string
          last_outcome?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "caller_profiles_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Upsells (migration 20250111000001)
      // ============================================
      upsells: {
        Row: {
          id: string
          business_id: string
          source_service_id: string
          target_service_id: string
          discount_percent: number
          pitch_message: string | null
          trigger_timing: string
          suggest_when_unavailable: boolean
          is_active: boolean
          times_offered: number
          times_accepted: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          source_service_id: string
          target_service_id: string
          discount_percent?: number
          pitch_message?: string | null
          trigger_timing?: string
          suggest_when_unavailable?: boolean
          is_active?: boolean
          times_offered?: number
          times_accepted?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          source_service_id?: string
          target_service_id?: string
          discount_percent?: number
          pitch_message?: string | null
          trigger_timing?: string
          suggest_when_unavailable?: boolean
          is_active?: boolean
          times_offered?: number
          times_accepted?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "upsells_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upsells_source_service_id_fkey"
            columns: ["source_service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upsells_target_service_id_fkey"
            columns: ["target_service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Site Settings (migration 20241229000001)
      // ============================================
      site_settings: {
        Row: {
          id: string
          key: string
          value: Json
          category: string
          description: string | null
          updated_by: string | null
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Json
          category?: string
          description?: string | null
          updated_by?: string | null
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          category?: string
          description?: string | null
          updated_by?: string | null
          updated_at?: string
          created_at?: string
        }
        Relationships: []
      }

      // ============================================
      // Blog Posts (migration 20241229000003)
      // ============================================
      blog_posts: {
        Row: {
          id: string
          title: string
          slug: string
          excerpt: string | null
          content: string
          meta_title: string | null
          meta_description: string | null
          target_keyword: string | null
          lsi_keywords: string[] | null
          featured_image_url: string | null
          featured_image_alt: string | null
          category: string | null
          tags: string[] | null
          status: string
          published_at: string | null
          scheduled_for: string | null
          generation_config: Json
          view_count: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          excerpt?: string | null
          content: string
          meta_title?: string | null
          meta_description?: string | null
          target_keyword?: string | null
          lsi_keywords?: string[] | null
          featured_image_url?: string | null
          featured_image_alt?: string | null
          category?: string | null
          tags?: string[] | null
          status?: string
          published_at?: string | null
          scheduled_for?: string | null
          generation_config?: Json
          view_count?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          excerpt?: string | null
          content?: string
          meta_title?: string | null
          meta_description?: string | null
          target_keyword?: string | null
          lsi_keywords?: string[] | null
          featured_image_url?: string | null
          featured_image_alt?: string | null
          category?: string | null
          tags?: string[] | null
          status?: string
          published_at?: string | null
          scheduled_for?: string | null
          generation_config?: Json
          view_count?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Blog Generation Queue (migration 20241229000003)
      // ============================================
      blog_generation_queue: {
        Row: {
          id: string
          topic: string
          target_keyword: string | null
          config: Json
          status: string
          error_message: string | null
          blog_post_id: string | null
          created_by: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          topic: string
          target_keyword?: string | null
          config?: Json
          status?: string
          error_message?: string | null
          blog_post_id?: string | null
          created_by?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          topic?: string
          target_keyword?: string | null
          config?: Json
          status?: string
          error_message?: string | null
          blog_post_id?: string | null
          created_by?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_generation_queue_blog_post_id_fkey"
            columns: ["blog_post_id"]
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_generation_queue_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================
      // Blog Presets (migration 20241229000003)
      // ============================================
      blog_presets: {
        Row: {
          id: string
          name: string
          description: string | null
          config: Json
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          config?: Json
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          config?: Json
          is_default?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      tenant_id: {
        Args: Record<PropertyKey, never>
        Returns: string
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

// ============================================
// Helper Types
// ============================================

// Extract Row types for convenience
export type UserRow = Database['public']['Tables']['users']['Row']
export type PlanRow = Database['public']['Tables']['plans']['Row']
export type BusinessRow = Database['public']['Tables']['businesses']['Row']
export type BusinessHoursRow = Database['public']['Tables']['business_hours']['Row']
export type ServiceRow = Database['public']['Tables']['services']['Row']
export type FAQRow = Database['public']['Tables']['faqs']['Row']
export type KnowledgeRow = Database['public']['Tables']['knowledge']['Row']
export type AIConfigRow = Database['public']['Tables']['ai_config']['Row']
export type CallSettingsRow = Database['public']['Tables']['call_settings']['Row']
export type CalendarIntegrationRow = Database['public']['Tables']['calendar_integrations']['Row']
export type AvailabilitySlotRow = Database['public']['Tables']['availability_slots']['Row']
export type PhoneNumberRow = Database['public']['Tables']['phone_numbers']['Row']
export type CallRow = Database['public']['Tables']['calls']['Row']
export type AppointmentRow = Database['public']['Tables']['appointments']['Row']
export type SMSMessageRow = Database['public']['Tables']['sms_messages']['Row']
export type NotificationSettingsRow = Database['public']['Tables']['notification_settings']['Row']
export type BusinessTemplateRow = Database['public']['Tables']['business_templates']['Row']
export type DemoLeadRow = Database['public']['Tables']['demo_leads']['Row']
export type PromptRegenerationQueueRow = Database['public']['Tables']['prompt_regeneration_queue']['Row']
export type BundleRow = Database['public']['Tables']['bundles']['Row']
export type BundleServiceRow = Database['public']['Tables']['bundle_services']['Row']
export type PackageRow = Database['public']['Tables']['packages']['Row']
export type MembershipRow = Database['public']['Tables']['memberships']['Row']
// New tables (migrations 20241229, 20250110, 20250111)
export type CallerProfileRow = Database['public']['Tables']['caller_profiles']['Row']
export type UpsellRow = Database['public']['Tables']['upsells']['Row']
export type SiteSettingRow = Database['public']['Tables']['site_settings']['Row']
export type BlogPostRow = Database['public']['Tables']['blog_posts']['Row']
export type BlogGenerationQueueRow = Database['public']['Tables']['blog_generation_queue']['Row']
export type BlogPresetRow = Database['public']['Tables']['blog_presets']['Row']

// Extract Insert types
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type PlanInsert = Database['public']['Tables']['plans']['Insert']
export type BusinessInsert = Database['public']['Tables']['businesses']['Insert']
export type BusinessHoursInsert = Database['public']['Tables']['business_hours']['Insert']
export type ServiceInsert = Database['public']['Tables']['services']['Insert']
export type FAQInsert = Database['public']['Tables']['faqs']['Insert']
export type KnowledgeInsert = Database['public']['Tables']['knowledge']['Insert']
export type AIConfigInsert = Database['public']['Tables']['ai_config']['Insert']
export type CallSettingsInsert = Database['public']['Tables']['call_settings']['Insert']
export type CalendarIntegrationInsert = Database['public']['Tables']['calendar_integrations']['Insert']
export type AvailabilitySlotInsert = Database['public']['Tables']['availability_slots']['Insert']
export type PhoneNumberInsert = Database['public']['Tables']['phone_numbers']['Insert']
export type CallInsert = Database['public']['Tables']['calls']['Insert']
export type AppointmentInsert = Database['public']['Tables']['appointments']['Insert']
export type SMSMessageInsert = Database['public']['Tables']['sms_messages']['Insert']
export type NotificationSettingsInsert = Database['public']['Tables']['notification_settings']['Insert']
export type BusinessTemplateInsert = Database['public']['Tables']['business_templates']['Insert']
export type DemoLeadInsert = Database['public']['Tables']['demo_leads']['Insert']
export type PromptRegenerationQueueInsert = Database['public']['Tables']['prompt_regeneration_queue']['Insert']
export type BundleInsert = Database['public']['Tables']['bundles']['Insert']
export type BundleServiceInsert = Database['public']['Tables']['bundle_services']['Insert']
export type PackageInsert = Database['public']['Tables']['packages']['Insert']
export type MembershipInsert = Database['public']['Tables']['memberships']['Insert']
// New tables (migrations 20241229, 20250110, 20250111)
export type CallerProfileInsert = Database['public']['Tables']['caller_profiles']['Insert']
export type UpsellInsert = Database['public']['Tables']['upsells']['Insert']
export type SiteSettingInsert = Database['public']['Tables']['site_settings']['Insert']
export type BlogPostInsert = Database['public']['Tables']['blog_posts']['Insert']
export type BlogGenerationQueueInsert = Database['public']['Tables']['blog_generation_queue']['Insert']
export type BlogPresetInsert = Database['public']['Tables']['blog_presets']['Insert']

// Extract Update types
export type UserUpdate = Database['public']['Tables']['users']['Update']
export type PlanUpdate = Database['public']['Tables']['plans']['Update']
export type BusinessUpdate = Database['public']['Tables']['businesses']['Update']
export type BusinessHoursUpdate = Database['public']['Tables']['business_hours']['Update']
export type ServiceUpdate = Database['public']['Tables']['services']['Update']
export type FAQUpdate = Database['public']['Tables']['faqs']['Update']
export type KnowledgeUpdate = Database['public']['Tables']['knowledge']['Update']
export type AIConfigUpdate = Database['public']['Tables']['ai_config']['Update']
export type CallSettingsUpdate = Database['public']['Tables']['call_settings']['Update']
export type CalendarIntegrationUpdate = Database['public']['Tables']['calendar_integrations']['Update']
export type AvailabilitySlotUpdate = Database['public']['Tables']['availability_slots']['Update']
export type PhoneNumberUpdate = Database['public']['Tables']['phone_numbers']['Update']
export type CallUpdate = Database['public']['Tables']['calls']['Update']
export type AppointmentUpdate = Database['public']['Tables']['appointments']['Update']
export type SMSMessageUpdate = Database['public']['Tables']['sms_messages']['Update']
export type NotificationSettingsUpdate = Database['public']['Tables']['notification_settings']['Update']
export type BusinessTemplateUpdate = Database['public']['Tables']['business_templates']['Update']
export type DemoLeadUpdate = Database['public']['Tables']['demo_leads']['Update']
export type PromptRegenerationQueueUpdate = Database['public']['Tables']['prompt_regeneration_queue']['Update']
export type BundleUpdate = Database['public']['Tables']['bundles']['Update']
export type BundleServiceUpdate = Database['public']['Tables']['bundle_services']['Update']
export type PackageUpdate = Database['public']['Tables']['packages']['Update']
export type MembershipUpdate = Database['public']['Tables']['memberships']['Update']
// New tables (migrations 20241229, 20250110, 20250111)
export type CallerProfileUpdate = Database['public']['Tables']['caller_profiles']['Update']
export type UpsellUpdate = Database['public']['Tables']['upsells']['Update']
export type SiteSettingUpdate = Database['public']['Tables']['site_settings']['Update']
export type BlogPostUpdate = Database['public']['Tables']['blog_posts']['Update']
export type BlogGenerationQueueUpdate = Database['public']['Tables']['blog_generation_queue']['Update']
export type BlogPresetUpdate = Database['public']['Tables']['blog_presets']['Update']
