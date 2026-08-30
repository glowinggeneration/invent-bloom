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
          status?: string
          target_tweet_url?: string | null
          tweet_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
