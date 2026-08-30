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
      campaign_replies: {
        Row: {
          account_id: string | null
          author_handle: string
          campaign_id: string
          created_at: string
          error: string | null
          handle: string
          id: string
          persona_name: string
          reply_text: string
          result_tweet_id: string | null
          status: string
          tweet_id: string
          tweet_text: string
          tweet_url: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          author_handle?: string
          campaign_id: string
          created_at?: string
          error?: string | null
          handle?: string
          id?: string
          persona_name?: string
          reply_text?: string
          result_tweet_id?: string | null
          status?: string
          tweet_id: string
          tweet_text?: string
          tweet_url?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          author_handle?: string
          campaign_id?: string
          created_at?: string
          error?: string | null
          handle?: string
          id?: string
          persona_name?: string
          reply_text?: string
          result_tweet_id?: string | null
          status?: string
          tweet_id?: string
          tweet_text?: string
          tweet_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_replies_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "listening_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_reviews: {
        Row: {
          approval_required: string
          auto_publish_allowed: boolean
          confidence: number
          created_at: string
          escalation_note: string | null
          facts_changed: boolean
          findings: Json
          function_preserved: boolean
          id: string
          original_text: string
          persona_id: string | null
          persona_preserved: boolean
          reference: string | null
          revised_text: string
          risk_categories: string[]
          risk_level: number
          surface: string
          user_id: string | null
        }
        Insert: {
          approval_required?: string
          auto_publish_allowed?: boolean
          confidence?: number
          created_at?: string
          escalation_note?: string | null
          facts_changed?: boolean
          findings?: Json
          function_preserved?: boolean
          id?: string
          original_text: string
          persona_id?: string | null
          persona_preserved?: boolean
          reference?: string | null
          revised_text?: string
          risk_categories?: string[]
          risk_level?: number
          surface: string
          user_id?: string | null
        }
        Update: {
          approval_required?: string
          auto_publish_allowed?: boolean
          confidence?: number
          created_at?: string
          escalation_note?: string | null
          facts_changed?: boolean
          findings?: Json
          function_preserved?: boolean
          id?: string
          original_text?: string
          persona_id?: string | null
          persona_preserved?: boolean
          reference?: string | null
          revised_text?: string
          risk_categories?: string[]
          risk_level?: number
          surface?: string
          user_id?: string | null
        }
        Relationships: []
      }
      listening_campaigns: {
        Row: {
          account_ids: string[]
          core_message: string
          created_at: string
          follow_author: boolean
          hashtags: string[]
          id: string
          is_active: boolean
          keywords: string[]
          language: string
          last_run_at: string | null
          like_target: boolean
          max_replies_per_run: number
          name: string
          spread_hours: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_ids?: string[]
          core_message?: string
          created_at?: string
          follow_author?: boolean
          hashtags?: string[]
          id?: string
          is_active?: boolean
          keywords?: string[]
          language?: string
          last_run_at?: string | null
          like_target?: boolean
          max_replies_per_run?: number
          name: string
          spread_hours?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_ids?: string[]
          core_message?: string
          created_at?: string
          follow_author?: boolean
          hashtags?: string[]
          id?: string
          is_active?: boolean
          keywords?: string[]
          language?: string
          last_run_at?: string | null
          like_target?: boolean
          max_replies_per_run?: number
          name?: string
          spread_hours?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          analysis: Json | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          role: string
          thread_id: string
          user_id: string | null
        }
        Insert: {
          analysis?: Json | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          role: string
          thread_id: string
          user_id?: string | null
        }
        Update: {
          analysis?: Json | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          role?: string
          thread_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_daily_plans: {
        Row: {
          account_id: string
          activity_type: string
          campaign_count: number
          created_at: string
          id: string
          notes: string
          persona_id: string
          persona_name: string
          plan_date: string
          target: number
          updated_at: string
          user_id: string
          windows: Json
        }
        Insert: {
          account_id: string
          activity_type?: string
          campaign_count?: number
          created_at?: string
          id?: string
          notes?: string
          persona_id: string
          persona_name?: string
          plan_date: string
          target?: number
          updated_at?: string
          user_id: string
          windows?: Json
        }
        Update: {
          account_id?: string
          activity_type?: string
          campaign_count?: number
          created_at?: string
          id?: string
          notes?: string
          persona_id?: string
          persona_name?: string
          plan_date?: string
          target?: number
          updated_at?: string
          user_id?: string
          windows?: Json
        }
        Relationships: [
          {
            foreignKeyName: "persona_daily_plans_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "x_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_daily_posts: {
        Row: {
          account_id: string
          category: string
          content: string
          created_at: string
          error: string | null
          id: string
          image_credit_name: string | null
          image_credit_url: string | null
          image_id: string | null
          image_url: string | null
          legal: Json
          persona_id: string
          plan_id: string
          published_at: string | null
          quality: Json
          result_tweet_id: string | null
          review_notes: string
          scheduled_at: string
          slot_index: number
          status: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          category?: string
          content?: string
          created_at?: string
          error?: string | null
          id?: string
          image_credit_name?: string | null
          image_credit_url?: string | null
          image_id?: string | null
          image_url?: string | null
          legal?: Json
          persona_id: string
          plan_id: string
          published_at?: string | null
          quality?: Json
          result_tweet_id?: string | null
          review_notes?: string
          scheduled_at?: string
          slot_index?: number
          status?: string
          topic?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          category?: string
          content?: string
          created_at?: string
          error?: string | null
          id?: string
          image_credit_name?: string | null
          image_credit_url?: string | null
          image_id?: string | null
          image_url?: string | null
          legal?: Json
          persona_id?: string
          plan_id?: string
          published_at?: string | null
          quality?: Json
          result_tweet_id?: string | null
          review_notes?: string
          scheduled_at?: string
          slot_index?: number
          status?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "persona_daily_posts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "x_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persona_daily_posts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "persona_daily_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_images: {
        Row: {
          avatar_url: string
          background_url: string
          color: string | null
          created_at: string
          persona_id: string
          photographer_name: string
          photographer_url: string
          query: string
          unsplash_id: string
          updated_at: string
        }
        Insert: {
          avatar_url: string
          background_url: string
          color?: string | null
          created_at?: string
          persona_id: string
          photographer_name?: string
          photographer_url?: string
          query?: string
          unsplash_id?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string
          background_url?: string
          color?: string | null
          created_at?: string
          persona_id?: string
          photographer_name?: string
          photographer_url?: string
          query?: string
          unsplash_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      persona_learning_events: {
        Row: {
          created_at: string
          delta: number
          field: string
          id: string
          note: string | null
          outcome: string
          persona_id: string
          user_id: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          delta: number
          field: string
          id?: string
          note?: string | null
          outcome: string
          persona_id: string
          user_id?: string | null
          weight: number
        }
        Update: {
          created_at?: string
          delta?: number
          field?: string
          id?: string
          note?: string | null
          outcome?: string
          persona_id?: string
          user_id?: string | null
          weight?: number
        }
        Relationships: []
      }
      persona_state: {
        Row: {
          adaptive: Json
          created_at: string
          drift_score: number
          frozen: boolean
          learning_rate: number
          persona_id: string
          persona_version: number
          updated_at: string
        }
        Insert: {
          adaptive?: Json
          created_at?: string
          drift_score?: number
          frozen?: boolean
          learning_rate?: number
          persona_id: string
          persona_version?: number
          updated_at?: string
        }
        Update: {
          adaptive?: Json
          created_at?: string
          drift_score?: number
          frozen?: boolean
          learning_rate?: number
          persona_id?: string
          persona_version?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          org: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          org?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          org?: string
          updated_at?: string
        }
        Relationships: []
      }
      publish_actions: {
        Row: {
          account_id: string | null
          action_type: string
          content: string
          created_at: string
          error: string | null
          id: string
          job_id: string
          result_tweet_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          action_type: string
          content?: string
          created_at?: string
          error?: string | null
          id?: string
          job_id: string
          result_tweet_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          action_type?: string
          content?: string
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string
          result_tweet_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_actions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "x_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_actions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "publish_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_jobs: {
        Row: {
          comment_text: string
          created_at: string
          engagement_actions: Json
          engagement_targets: Json
          id: string
          image_urls: string[]
          link_url: string | null
          mode: string
          objective_mode: boolean
          objective_text: string
          status: string
          target_tweet_url: string | null
          tweet_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment_text?: string
          created_at?: string
          engagement_actions?: Json
          engagement_targets?: Json
          id?: string
          image_urls?: string[]
          link_url?: string | null
          mode?: string
          objective_mode?: boolean
          objective_text?: string
          status?: string
          target_tweet_url?: string | null
          tweet_text?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment_text?: string
          created_at?: string
          engagement_actions?: Json
          engagement_targets?: Json
          id?: string
          image_urls?: string[]
          link_url?: string | null
          mode?: string
          objective_mode?: boolean
          objective_text?: string
          status?: string
          target_tweet_url?: string | null
          tweet_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_actions: {
        Row: {
          account_id: string | null
          action_type: string
          attempts: number
          campaign_id: string | null
          campaign_reply_id: string | null
          content: string
          created_at: string
          error: string | null
          handle: string
          id: string
          job_id: string | null
          media_urls: string[]
          persona_name: string
          publish_action_id: string | null
          result_tweet_id: string | null
          run_at: string
          source: string
          status: string
          target_handle: string | null
          target_tweet_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          action_type: string
          attempts?: number
          campaign_id?: string | null
          campaign_reply_id?: string | null
          content?: string
          created_at?: string
          error?: string | null
          handle?: string
          id?: string
          job_id?: string | null
          media_urls?: string[]
          persona_name?: string
          publish_action_id?: string | null
          result_tweet_id?: string | null
          run_at?: string
          source: string
          status?: string
          target_handle?: string | null
          target_tweet_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          action_type?: string
          attempts?: number
          campaign_id?: string | null
          campaign_reply_id?: string | null
          content?: string
          created_at?: string
          error?: string | null
          handle?: string
          id?: string
          job_id?: string | null
          media_urls?: string[]
          persona_name?: string
          publish_action_id?: string | null
          result_tweet_id?: string | null
          run_at?: string
          source?: string
          status?: string
          target_handle?: string | null
          target_tweet_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_actions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "x_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_actions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "listening_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_actions_campaign_reply_id_fkey"
            columns: ["campaign_reply_id"]
            isOneToOne: false
            referencedRelation: "campaign_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_actions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "publish_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_actions_publish_action_id_fkey"
            columns: ["publish_action_id"]
            isOneToOne: false
            referencedRelation: "publish_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          created_at: string
          id: string
          org: string
          pinned: boolean
          title: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          id?: string
          org?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          created_at?: string
          id?: string
          org?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      tweet_metrics: {
        Row: {
          account_id: string | null
          bookmark_count: number
          content: string
          created_at: string
          fetched_at: string
          handle: string
          id: string
          impression_count: number
          kind: string
          like_count: number
          quote_count: number
          reply_count: number
          retweet_count: number
          tweet_id: string
          tweeted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          bookmark_count?: number
          content?: string
          created_at?: string
          fetched_at?: string
          handle?: string
          id?: string
          impression_count?: number
          kind?: string
          like_count?: number
          quote_count?: number
          reply_count?: number
          retweet_count?: number
          tweet_id: string
          tweeted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          bookmark_count?: number
          content?: string
          created_at?: string
          fetched_at?: string
          handle?: string
          id?: string
          impression_count?: number
          kind?: string
          like_count?: number
          quote_count?: number
          reply_count?: number
          retweet_count?: number
          tweet_id?: string
          tweeted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tweet_metrics_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "x_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      x_accounts: {
        Row: {
          always_on: boolean
          auth_token: string | null
          avatar_color: string | null
          avatar_credit_name: string | null
          avatar_credit_url: string | null
          avatar_url: string | null
          background_url: string | null
          bio: string
          created_at: string
          display_name: string
          handle: string
          id: string
          is_active: boolean
          persona_label: string
          proxy: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          always_on?: boolean
          auth_token?: string | null
          avatar_color?: string | null
          avatar_credit_name?: string | null
          avatar_credit_url?: string | null
          avatar_url?: string | null
          background_url?: string | null
          bio?: string
          created_at?: string
          display_name?: string
          handle: string
          id?: string
          is_active?: boolean
          persona_label?: string
          proxy?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          always_on?: boolean
          auth_token?: string | null
          avatar_color?: string | null
          avatar_credit_name?: string | null
          avatar_credit_url?: string | null
          avatar_url?: string | null
          background_url?: string | null
          bio?: string
          created_at?: string
          display_name?: string
          handle?: string
          id?: string
          is_active?: boolean
          persona_label?: string
          proxy?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      x_login_attempts: {
        Row: {
          created_at: string
          email: string
          error: string | null
          handle: string
          id: string
          password: string
          persona_label: string
          proxy: string
          status: string
          totp_secret: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          error?: string | null
          handle: string
          id?: string
          password: string
          persona_label?: string
          proxy?: string
          status?: string
          totp_secret?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          error?: string | null
          handle?: string
          id?: string
          password?: string
          persona_label?: string
          proxy?: string
          status?: string
          totp_secret?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_thread: { Args: { _thread_id: string }; Returns: boolean }
      current_org: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member"
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
    Enums: {
      app_role: ["admin", "member"],
    },
  },
} as const
