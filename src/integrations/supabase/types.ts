export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_events: {
        Row: {
          correlation_id: string | null;
          created_at: string;
          failure_reason: string | null;
          fallback_used: boolean;
          feature: string;
          id: string;
          input_tokens: number | null;
          latency_ms: number | null;
          model: string;
          org: string | null;
          outcome: string;
          output_tokens: number | null;
          prompt_version: string | null;
          provider: string;
          retries: number;
          user_id: string | null;
        };
        Insert: {
          correlation_id?: string | null;
          created_at?: string;
          failure_reason?: string | null;
          fallback_used?: boolean;
          feature: string;
          id?: string;
          input_tokens?: number | null;
          latency_ms?: number | null;
          model: string;
          org?: string | null;
          outcome: string;
          output_tokens?: number | null;
          prompt_version?: string | null;
          provider: string;
          retries?: number;
          user_id?: string | null;
        };
        Update: {
          correlation_id?: string | null;
          created_at?: string;
          failure_reason?: string | null;
          fallback_used?: boolean;
          feature?: string;
          id?: string;
          input_tokens?: number | null;
          latency_ms?: number | null;
          model?: string;
          org?: string | null;
          outcome?: string;
          output_tokens?: number | null;
          prompt_version?: string | null;
          provider?: string;
          retries?: number;
          user_id?: string | null;
        };
        Relationships: [];
      };
      apify_mentions: {
        Row: {
          author_avatar: string | null;
          author_handle: string | null;
          author_name: string | null;
          collected_at: string;
          comments: number | null;
          content: string | null;
          content_type: string;
          created_at: string;
          entities: string[];
          external_id: string;
          id: string;
          likes: number | null;
          matched_keywords: string[];
          platform: string;
          published_at: string | null;
          raw_data: Json;
          sentiment: string;
          sentiment_reason: string | null;
          sentiment_score: number;
          shares: number | null;
          source_label: string;
          thumbnail_url: string | null;
          title: string | null;
          url: string;
          views: number | null;
        };
        Insert: {
          author_avatar?: string | null;
          author_handle?: string | null;
          author_name?: string | null;
          collected_at?: string;
          comments?: number | null;
          content?: string | null;
          content_type: string;
          created_at?: string;
          entities?: string[];
          external_id: string;
          id?: string;
          likes?: number | null;
          matched_keywords?: string[];
          platform: string;
          published_at?: string | null;
          raw_data?: Json;
          sentiment?: string;
          sentiment_reason?: string | null;
          sentiment_score?: number;
          shares?: number | null;
          source_label: string;
          thumbnail_url?: string | null;
          title?: string | null;
          url: string;
          views?: number | null;
        };
        Update: {
          author_avatar?: string | null;
          author_handle?: string | null;
          author_name?: string | null;
          collected_at?: string;
          comments?: number | null;
          content?: string | null;
          content_type?: string;
          created_at?: string;
          entities?: string[];
          external_id?: string;
          id?: string;
          likes?: number | null;
          matched_keywords?: string[];
          platform?: string;
          published_at?: string | null;
          raw_data?: Json;
          sentiment?: string;
          sentiment_reason?: string | null;
          sentiment_score?: number;
          shares?: number | null;
          source_label?: string;
          thumbnail_url?: string | null;
          title?: string | null;
          url?: string;
          views?: number | null;
        };
        Relationships: [];
      };
      apify_profiles: {
        Row: {
          avatar_url: string | null;
          banner_url: string | null;
          created_at: string;
          description: string | null;
          display_name: string | null;
          fetched_at: string;
          followers: number | null;
          following: number | null;
          handle: string;
          id: string;
          is_verified: boolean;
          likes_count: number | null;
          platform: string;
          posts_count: number | null;
          profile_url: string;
        };
        Insert: {
          avatar_url?: string | null;
          banner_url?: string | null;
          created_at?: string;
          description?: string | null;
          display_name?: string | null;
          fetched_at?: string;
          followers?: number | null;
          following?: number | null;
          handle: string;
          id?: string;
          is_verified?: boolean;
          likes_count?: number | null;
          platform: string;
          posts_count?: number | null;
          profile_url: string;
        };
        Update: {
          avatar_url?: string | null;
          banner_url?: string | null;
          created_at?: string;
          description?: string | null;
          display_name?: string | null;
          fetched_at?: string;
          followers?: number | null;
          following?: number | null;
          handle?: string;
          id?: string;
          is_verified?: boolean;
          likes_count?: number | null;
          platform?: string;
          posts_count?: number | null;
          profile_url?: string;
        };
        Relationships: [];
      };
      apify_source_status: {
        Row: {
          items_last_run: number;
          label: string;
          last_run_at: string | null;
          message: string | null;
          source_key: string;
          status: string;
          stored_last_run: number;
          updated_at: string;
        };
        Insert: {
          items_last_run?: number;
          label: string;
          last_run_at?: string | null;
          message?: string | null;
          source_key: string;
          status?: string;
          stored_last_run?: number;
          updated_at?: string;
        };
        Update: {
          items_last_run?: number;
          label?: string;
          last_run_at?: string | null;
          message?: string | null;
          source_key?: string;
          status?: string;
          stored_last_run?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          id: string;
          ip: unknown;
          metadata: Json;
          org: string | null;
          resource_id: string | null;
          resource_table: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          ip?: unknown;
          metadata?: Json;
          org?: string | null;
          resource_id?: string | null;
          resource_table: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          ip?: unknown;
          metadata?: Json;
          org?: string | null;
          resource_id?: string | null;
          resource_table?: string;
        };
        Relationships: [];
      };
      brand_profiles: {
        Row: {
          avatar_url: string | null;
          banner_url: string | null;
          created_at: string;
          description: string;
          display_name: string;
          favourites_count: number;
          fetched_at: string;
          followers: number;
          following: number;
          handle: string;
          id: string;
          is_verified: boolean;
          location: string;
          media_count: number;
          profile_created_at: string | null;
          tweet_count: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          banner_url?: string | null;
          created_at?: string;
          description?: string;
          display_name?: string;
          favourites_count?: number;
          fetched_at?: string;
          followers?: number;
          following?: number;
          handle: string;
          id?: string;
          is_verified?: boolean;
          location?: string;
          media_count?: number;
          profile_created_at?: string | null;
          tweet_count?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          banner_url?: string | null;
          created_at?: string;
          description?: string;
          display_name?: string;
          favourites_count?: number;
          fetched_at?: string;
          followers?: number;
          following?: number;
          handle?: string;
          id?: string;
          is_verified?: boolean;
          location?: string;
          media_count?: number;
          profile_created_at?: string | null;
          tweet_count?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      campaign_replies: {
        Row: {
          account_id: string | null;
          author_handle: string;
          campaign_id: string;
          created_at: string;
          error: string | null;
          handle: string;
          id: string;
          persona_name: string;
          reply_text: string;
          result_tweet_id: string | null;
          status: string;
          tweet_id: string;
          tweet_text: string;
          tweet_url: string | null;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          author_handle?: string;
          campaign_id: string;
          created_at?: string;
          error?: string | null;
          handle?: string;
          id?: string;
          persona_name?: string;
          reply_text?: string;
          result_tweet_id?: string | null;
          status?: string;
          tweet_id: string;
          tweet_text?: string;
          tweet_url?: string | null;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          author_handle?: string;
          campaign_id?: string;
          created_at?: string;
          error?: string | null;
          handle?: string;
          id?: string;
          persona_name?: string;
          reply_text?: string;
          result_tweet_id?: string | null;
          status?: string;
          tweet_id?: string;
          tweet_text?: string;
          tweet_url?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_replies_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "listening_campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_skip_audit: {
        Row: {
          account_id: string | null;
          campaign_id: string | null;
          created_at: string;
          detail: string;
          handle: string;
          id: string;
          job_id: string | null;
          persona_name: string;
          reason: string;
          run_ref: string;
          source: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          campaign_id?: string | null;
          created_at?: string;
          detail?: string;
          handle?: string;
          id?: string;
          job_id?: string | null;
          persona_name?: string;
          reason: string;
          run_ref?: string;
          source: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          campaign_id?: string | null;
          created_at?: string;
          detail?: string;
          handle?: string;
          id?: string;
          job_id?: string | null;
          persona_name?: string;
          reason?: string;
          run_ref?: string;
          source?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      decision_log: {
        Row: {
          created_at: string;
          created_by: string | null;
          decision: string;
          due_at: string | null;
          id: string;
          insight: string;
          owner: string;
          result: string;
          source_url: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          decision: string;
          due_at?: string | null;
          id?: string;
          insight: string;
          owner?: string;
          result?: string;
          source_url?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          decision?: string;
          due_at?: string | null;
          id?: string;
          insight?: string;
          owner?: string;
          result?: string;
          source_url?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      external_profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          description: string;
          display_name: string;
          fetched_at: string;
          followers: number;
          following: number;
          handle: string;
          is_verified: boolean;
          tweet_count: number;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          description?: string;
          display_name?: string;
          fetched_at?: string;
          followers?: number;
          following?: number;
          handle: string;
          is_verified?: boolean;
          tweet_count?: number;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          description?: string;
          display_name?: string;
          fetched_at?: string;
          followers?: number;
          following?: number;
          handle?: string;
          is_verified?: boolean;
          tweet_count?: number;
        };
        Relationships: [];
      };
      idempotency_keys: {
        Row: {
          completed_at: string | null;
          created_at: string;
          key: string;
          request_fingerprint: string;
          result: Json | null;
          status: string;
          user_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          key: string;
          request_fingerprint: string;
          result?: Json | null;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          key?: string;
          request_fingerprint?: string;
          result?: Json | null;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      legal_reviews: {
        Row: {
          approval_required: string;
          auto_publish_allowed: boolean;
          confidence: number;
          created_at: string;
          escalation_note: string | null;
          facts_changed: boolean;
          findings: Json;
          function_preserved: boolean;
          id: string;
          original_text: string;
          persona_id: string | null;
          persona_preserved: boolean;
          reference: string | null;
          revised_text: string;
          risk_categories: string[];
          risk_level: number;
          surface: string;
          user_id: string | null;
        };
        Insert: {
          approval_required?: string;
          auto_publish_allowed?: boolean;
          confidence?: number;
          created_at?: string;
          escalation_note?: string | null;
          facts_changed?: boolean;
          findings?: Json;
          function_preserved?: boolean;
          id?: string;
          original_text: string;
          persona_id?: string | null;
          persona_preserved?: boolean;
          reference?: string | null;
          revised_text?: string;
          risk_categories?: string[];
          risk_level?: number;
          surface: string;
          user_id?: string | null;
        };
        Update: {
          approval_required?: string;
          auto_publish_allowed?: boolean;
          confidence?: number;
          created_at?: string;
          escalation_note?: string | null;
          facts_changed?: boolean;
          findings?: Json;
          function_preserved?: boolean;
          id?: string;
          original_text?: string;
          persona_id?: string | null;
          persona_preserved?: boolean;
          reference?: string | null;
          revised_text?: string;
          risk_categories?: string[];
          risk_level?: number;
          surface?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      listening_campaigns: {
        Row: {
          account_ids: string[];
          core_message: string;
          created_at: string;
          follow_author: boolean;
          hashtags: string[];
          id: string;
          is_active: boolean;
          keywords: string[];
          language: string;
          last_run_at: string | null;
          like_target: boolean;
          max_replies_per_run: number;
          name: string;
          spread_hours: number;
          summary: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_ids?: string[];
          core_message?: string;
          created_at?: string;
          follow_author?: boolean;
          hashtags?: string[];
          id?: string;
          is_active?: boolean;
          keywords?: string[];
          language?: string;
          last_run_at?: string | null;
          like_target?: boolean;
          max_replies_per_run?: number;
          name: string;
          spread_hours?: number;
          summary?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_ids?: string[];
          core_message?: string;
          created_at?: string;
          follow_author?: boolean;
          hashtags?: string[];
          id?: string;
          is_active?: boolean;
          keywords?: string[];
          language?: string;
          last_run_at?: string | null;
          like_target?: boolean;
          max_replies_per_run?: number;
          name?: string;
          spread_hours?: number;
          summary?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      managed_reports: {
        Row: {
          campaign: string;
          category: string;
          client: string;
          cover_image: string | null;
          created_at: string;
          description: string;
          file_name: string;
          file_size: number;
          file_type: string;
          id: string;
          reporting_period_end: string | null;
          reporting_period_start: string | null;
          status: string;
          storage_path: string;
          tags: string[];
          title: string;
          updated_at: string;
          uploaded_at: string;
          uploaded_by: string;
        };
        Insert: {
          campaign?: string;
          category?: string;
          client?: string;
          cover_image?: string | null;
          created_at?: string;
          description?: string;
          file_name: string;
          file_size?: number;
          file_type: string;
          id?: string;
          reporting_period_end?: string | null;
          reporting_period_start?: string | null;
          status?: string;
          storage_path: string;
          tags?: string[];
          title: string;
          updated_at?: string;
          uploaded_at?: string;
          uploaded_by?: string;
        };
        Update: {
          campaign?: string;
          category?: string;
          client?: string;
          cover_image?: string | null;
          created_at?: string;
          description?: string;
          file_name?: string;
          file_size?: number;
          file_type?: string;
          id?: string;
          reporting_period_end?: string | null;
          reporting_period_start?: string | null;
          status?: string;
          storage_path?: string;
          tags?: string[];
          title?: string;
          updated_at?: string;
          uploaded_at?: string;
          uploaded_by?: string;
        };
        Relationships: [];
      };
      mention_keywords: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          last_refreshed_at: string | null;
          source: string;
          term: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          last_refreshed_at?: string | null;
          source?: string;
          term: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          last_refreshed_at?: string | null;
          source?: string;
          term?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          analysis: Json | null;
          content: string;
          created_at: string;
          id: string;
          image_url: string | null;
          role: string;
          thread_id: string;
          user_id: string | null;
        };
        Insert: {
          analysis?: Json | null;
          content?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          role: string;
          thread_id: string;
          user_id?: string | null;
        };
        Update: {
          analysis?: Json | null;
          content?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          role?: string;
          thread_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id"];
          },
        ];
      };
      monitoring_watchlist: {
        Row: {
          alert_enabled: boolean;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          kind: string;
          label: string;
          notes: string;
          platform: string | null;
          priority: string;
          updated_at: string;
          value: string;
        };
        Insert: {
          alert_enabled?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          kind: string;
          label: string;
          notes?: string;
          platform?: string | null;
          priority?: string;
          updated_at?: string;
          value: string;
        };
        Update: {
          alert_enabled?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          kind?: string;
          label?: string;
          notes?: string;
          platform?: string | null;
          priority?: string;
          updated_at?: string;
          value?: string;
        };
        Relationships: [];
      };
      news_articles: {
        Row: {
          category: string[];
          created_at: string;
          description: string;
          id: string;
          image_url: string | null;
          link: string;
          matched_query: string;
          provider: string;
          pub_date: string | null;
          source_id: string;
          title: string;
          title_key: string;
        };
        Insert: {
          category?: string[];
          created_at?: string;
          description?: string;
          id?: string;
          image_url?: string | null;
          link: string;
          matched_query?: string;
          provider?: string;
          pub_date?: string | null;
          source_id?: string;
          title: string;
          title_key?: string;
        };
        Update: {
          category?: string[];
          created_at?: string;
          description?: string;
          id?: string;
          image_url?: string | null;
          link?: string;
          matched_query?: string;
          provider?: string;
          pub_date?: string | null;
          source_id?: string;
          title?: string;
          title_key?: string;
        };
        Relationships: [];
      };
      overview_intel: {
        Row: {
          generated_at: string;
          key: string;
          payload: Json;
        };
        Insert: {
          generated_at?: string;
          key: string;
          payload?: Json;
        };
        Update: {
          generated_at?: string;
          key?: string;
          payload?: Json;
        };
        Relationships: [];
      };
      persona_daily_plans: {
        Row: {
          account_id: string;
          activity_type: string;
          campaign_count: number;
          created_at: string;
          id: string;
          notes: string;
          persona_id: string;
          persona_name: string;
          plan_date: string;
          target: number;
          updated_at: string;
          user_id: string;
          windows: Json;
        };
        Insert: {
          account_id: string;
          activity_type?: string;
          campaign_count?: number;
          created_at?: string;
          id?: string;
          notes?: string;
          persona_id: string;
          persona_name?: string;
          plan_date: string;
          target?: number;
          updated_at?: string;
          user_id: string;
          windows?: Json;
        };
        Update: {
          account_id?: string;
          activity_type?: string;
          campaign_count?: number;
          created_at?: string;
          id?: string;
          notes?: string;
          persona_id?: string;
          persona_name?: string;
          plan_date?: string;
          target?: number;
          updated_at?: string;
          user_id?: string;
          windows?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "persona_daily_plans_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "x_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      persona_daily_posts: {
        Row: {
          account_id: string;
          category: string;
          content: string;
          created_at: string;
          error: string | null;
          id: string;
          image_credit_name: string | null;
          image_credit_url: string | null;
          image_id: string | null;
          image_url: string | null;
          legal: Json;
          persona_id: string;
          plan_id: string;
          published_at: string | null;
          quality: Json;
          result_tweet_id: string | null;
          review_notes: string;
          scheduled_at: string;
          slot_index: number;
          status: string;
          topic: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          category?: string;
          content?: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          image_credit_name?: string | null;
          image_credit_url?: string | null;
          image_id?: string | null;
          image_url?: string | null;
          legal?: Json;
          persona_id: string;
          plan_id: string;
          published_at?: string | null;
          quality?: Json;
          result_tweet_id?: string | null;
          review_notes?: string;
          scheduled_at?: string;
          slot_index?: number;
          status?: string;
          topic?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          category?: string;
          content?: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          image_credit_name?: string | null;
          image_credit_url?: string | null;
          image_id?: string | null;
          image_url?: string | null;
          legal?: Json;
          persona_id?: string;
          plan_id?: string;
          published_at?: string | null;
          quality?: Json;
          result_tweet_id?: string | null;
          review_notes?: string;
          scheduled_at?: string;
          slot_index?: number;
          status?: string;
          topic?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "persona_daily_posts_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "x_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "persona_daily_posts_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "persona_daily_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      persona_images: {
        Row: {
          avatar_url: string;
          background_url: string;
          color: string | null;
          created_at: string;
          persona_id: string;
          photographer_name: string;
          photographer_url: string;
          query: string;
          unsplash_id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url: string;
          background_url: string;
          color?: string | null;
          created_at?: string;
          persona_id: string;
          photographer_name?: string;
          photographer_url?: string;
          query?: string;
          unsplash_id?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string;
          background_url?: string;
          color?: string | null;
          created_at?: string;
          persona_id?: string;
          photographer_name?: string;
          photographer_url?: string;
          query?: string;
          unsplash_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      persona_learning_events: {
        Row: {
          created_at: string;
          delta: number;
          field: string;
          id: string;
          note: string | null;
          outcome: string;
          persona_id: string;
          user_id: string | null;
          weight: number;
        };
        Insert: {
          created_at?: string;
          delta: number;
          field: string;
          id?: string;
          note?: string | null;
          outcome: string;
          persona_id: string;
          user_id?: string | null;
          weight: number;
        };
        Update: {
          created_at?: string;
          delta?: number;
          field?: string;
          id?: string;
          note?: string | null;
          outcome?: string;
          persona_id?: string;
          user_id?: string | null;
          weight?: number;
        };
        Relationships: [];
      };
      persona_state: {
        Row: {
          adaptive: Json;
          created_at: string;
          drift_score: number;
          frozen: boolean;
          learning_rate: number;
          persona_id: string;
          persona_version: number;
          updated_at: string;
        };
        Insert: {
          adaptive?: Json;
          created_at?: string;
          drift_score?: number;
          frozen?: boolean;
          learning_rate?: number;
          persona_id: string;
          persona_version?: number;
          updated_at?: string;
        };
        Update: {
          adaptive?: Json;
          created_at?: string;
          drift_score?: number;
          frozen?: boolean;
          learning_rate?: number;
          persona_id?: string;
          persona_version?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          brand_handle: string;
          brand_name: string;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          job_title: string;
          onboarding_completed_at: string | null;
          onboarding_skipped_at: string | null;
          org: string;
          phone: string;
          team: string;
          updated_at: string;
        };
        Insert: {
          brand_handle?: string;
          brand_name?: string;
          created_at?: string;
          email: string;
          full_name?: string;
          id: string;
          job_title?: string;
          onboarding_completed_at?: string | null;
          onboarding_skipped_at?: string | null;
          org?: string;
          phone?: string;
          team?: string;
          updated_at?: string;
        };
        Update: {
          brand_handle?: string;
          brand_name?: string;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          job_title?: string;
          onboarding_completed_at?: string | null;
          onboarding_skipped_at?: string | null;
          org?: string;
          phone?: string;
          team?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      publish_actions: {
        Row: {
          account_id: string | null;
          action_type: string;
          content: string;
          created_at: string;
          error: string | null;
          id: string;
          job_id: string;
          result_tweet_id: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          action_type: string;
          content?: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          job_id: string;
          result_tweet_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          action_type?: string;
          content?: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          job_id?: string;
          result_tweet_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "publish_actions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "x_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "publish_actions_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "publish_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      publish_jobs: {
        Row: {
          comment_text: string;
          created_at: string;
          engagement_actions: Json;
          engagement_targets: Json;
          id: string;
          image_urls: string[];
          link_url: string | null;
          mode: string;
          name: string;
          name_is_custom: boolean;
          objective_mode: boolean;
          objective_text: string;
          status: string;
          summary: string;
          target_tweet_url: string | null;
          tweet_text: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          comment_text?: string;
          created_at?: string;
          engagement_actions?: Json;
          engagement_targets?: Json;
          id?: string;
          image_urls?: string[];
          link_url?: string | null;
          mode?: string;
          name?: string;
          name_is_custom?: boolean;
          objective_mode?: boolean;
          objective_text?: string;
          status?: string;
          summary?: string;
          target_tweet_url?: string | null;
          tweet_text?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          comment_text?: string;
          created_at?: string;
          engagement_actions?: Json;
          engagement_targets?: Json;
          id?: string;
          image_urls?: string[];
          link_url?: string | null;
          mode?: string;
          name?: string;
          name_is_custom?: boolean;
          objective_mode?: boolean;
          objective_text?: string;
          status?: string;
          summary?: string;
          target_tweet_url?: string | null;
          tweet_text?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      rate_limit_hits: {
        Row: {
          bucket_key: string;
          created_at: string;
          id: number;
        };
        Insert: {
          bucket_key: string;
          created_at?: string;
          id?: never;
        };
        Update: {
          bucket_key?: string;
          created_at?: string;
          id?: never;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          campaigns: Json;
          conversation: Json;
          created_at: string;
          generated_at: string;
          id: string;
          insights: Json;
          kind: string;
          label: string;
          metrics: Json;
          period_end: string;
          period_start: string;
          personas: Json;
          recommendations: Json;
          report_date: string;
          source_errors: Json;
          status: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          campaigns?: Json;
          conversation?: Json;
          created_at?: string;
          generated_at?: string;
          id?: string;
          insights?: Json;
          kind?: string;
          label?: string;
          metrics?: Json;
          period_end: string;
          period_start: string;
          personas?: Json;
          recommendations?: Json;
          report_date: string;
          source_errors?: Json;
          status?: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          campaigns?: Json;
          conversation?: Json;
          created_at?: string;
          generated_at?: string;
          id?: string;
          insights?: Json;
          kind?: string;
          label?: string;
          metrics?: Json;
          period_end?: string;
          period_start?: string;
          personas?: Json;
          recommendations?: Json;
          report_date?: string;
          source_errors?: Json;
          status?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      scheduled_actions: {
        Row: {
          account_id: string | null;
          action_type: string;
          attempts: number;
          campaign_id: string | null;
          campaign_reply_id: string | null;
          content: string;
          created_at: string;
          error: string | null;
          handle: string;
          id: string;
          job_id: string | null;
          media_urls: string[];
          persona_name: string;
          publish_action_id: string | null;
          reassignments: number;
          result_tweet_id: string | null;
          run_at: string;
          source: string;
          status: string;
          target_handle: string | null;
          target_tweet_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          action_type: string;
          attempts?: number;
          campaign_id?: string | null;
          campaign_reply_id?: string | null;
          content?: string;
          created_at?: string;
          error?: string | null;
          handle?: string;
          id?: string;
          job_id?: string | null;
          media_urls?: string[];
          persona_name?: string;
          publish_action_id?: string | null;
          reassignments?: number;
          result_tweet_id?: string | null;
          run_at?: string;
          source: string;
          status?: string;
          target_handle?: string | null;
          target_tweet_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          action_type?: string;
          attempts?: number;
          campaign_id?: string | null;
          campaign_reply_id?: string | null;
          content?: string;
          created_at?: string;
          error?: string | null;
          handle?: string;
          id?: string;
          job_id?: string | null;
          media_urls?: string[];
          persona_name?: string;
          publish_action_id?: string | null;
          reassignments?: number;
          result_tweet_id?: string | null;
          run_at?: string;
          source?: string;
          status?: string;
          target_handle?: string | null;
          target_tweet_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_actions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "x_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_actions_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "listening_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_actions_campaign_reply_id_fkey";
            columns: ["campaign_reply_id"];
            isOneToOne: false;
            referencedRelation: "campaign_replies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_actions_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "publish_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_actions_publish_action_id_fkey";
            columns: ["publish_action_id"];
            isOneToOne: false;
            referencedRelation: "publish_actions";
            referencedColumns: ["id"];
          },
        ];
      };
      threads: {
        Row: {
          created_at: string;
          id: string;
          org: string;
          pinned: boolean;
          title: string;
          updated_at: string;
          user_id: string;
          visibility: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          org?: string;
          pinned?: boolean;
          title?: string;
          updated_at?: string;
          user_id: string;
          visibility?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          org?: string;
          pinned?: boolean;
          title?: string;
          updated_at?: string;
          user_id?: string;
          visibility?: string;
        };
        Relationships: [];
      };
      tweet_metrics: {
        Row: {
          account_id: string | null;
          bookmark_count: number;
          content: string;
          created_at: string;
          fetched_at: string;
          handle: string;
          id: string;
          impression_count: number;
          kind: string;
          like_count: number;
          quote_count: number;
          reply_count: number;
          retweet_count: number;
          tweet_id: string;
          tweeted_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          bookmark_count?: number;
          content?: string;
          created_at?: string;
          fetched_at?: string;
          handle?: string;
          id?: string;
          impression_count?: number;
          kind?: string;
          like_count?: number;
          quote_count?: number;
          reply_count?: number;
          retweet_count?: number;
          tweet_id: string;
          tweeted_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          bookmark_count?: number;
          content?: string;
          created_at?: string;
          fetched_at?: string;
          handle?: string;
          id?: string;
          impression_count?: number;
          kind?: string;
          like_count?: number;
          quote_count?: number;
          reply_count?: number;
          retweet_count?: number;
          tweet_id?: string;
          tweeted_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tweet_metrics_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "x_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      // Manually added pending a real `supabase gen types` regeneration -
      // no Supabase CLI is available in this environment. Matches
      // supabase/migrations/20260907130000_generalize_monitored_entity.sql.
      workspace_settings: {
        Row: {
          context_terms: string[];
          key_figures: string[];
          org_aliases: string[];
          org_handle: string;
          org_name: string;
          singleton: boolean;
          updated_at: string;
          updated_by: string | null;
          workspace_email_domain: string | null;
        };
        Insert: {
          context_terms?: string[];
          key_figures?: string[];
          org_aliases?: string[];
          org_handle?: string;
          org_name?: string;
          singleton?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          workspace_email_domain?: string | null;
        };
        Update: {
          context_terms?: string[];
          key_figures?: string[];
          org_aliases?: string[];
          org_handle?: string;
          org_name?: string;
          singleton?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          workspace_email_domain?: string | null;
        };
        Relationships: [];
      };
      workspace_execution_state: {
        Row: {
          paused: boolean;
          paused_at: string | null;
          paused_by: string | null;
          reason: string;
          singleton: boolean;
          updated_at: string;
        };
        Insert: {
          paused?: boolean;
          paused_at?: string | null;
          paused_by?: string | null;
          reason?: string;
          singleton?: boolean;
          updated_at?: string;
        };
        Update: {
          paused?: boolean;
          paused_at?: string | null;
          paused_by?: string | null;
          reason?: string;
          singleton?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      x_accounts: {
        Row: {
          always_on: boolean;
          auth_token: string | null;
          avatar_color: string | null;
          avatar_credit_name: string | null;
          avatar_credit_url: string | null;
          avatar_url: string | null;
          background_url: string | null;
          bio: string;
          created_at: string;
          display_name: string;
          handle: string;
          handle_synced_at: string | null;
          id: string;
          is_active: boolean;
          is_verified: boolean;
          persona_label: string;
          previous_handle: string | null;
          proxy: string | null;
          suspended: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          always_on?: boolean;
          auth_token?: string | null;
          avatar_color?: string | null;
          avatar_credit_name?: string | null;
          avatar_credit_url?: string | null;
          avatar_url?: string | null;
          background_url?: string | null;
          bio?: string;
          created_at?: string;
          display_name?: string;
          handle: string;
          handle_synced_at?: string | null;
          id?: string;
          is_active?: boolean;
          is_verified?: boolean;
          persona_label?: string;
          previous_handle?: string | null;
          proxy?: string | null;
          suspended?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          always_on?: boolean;
          auth_token?: string | null;
          avatar_color?: string | null;
          avatar_credit_name?: string | null;
          avatar_credit_url?: string | null;
          avatar_url?: string | null;
          background_url?: string | null;
          bio?: string;
          created_at?: string;
          display_name?: string;
          handle?: string;
          handle_synced_at?: string | null;
          id?: string;
          is_active?: boolean;
          is_verified?: boolean;
          persona_label?: string;
          previous_handle?: string | null;
          proxy?: string | null;
          suspended?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      x_login_attempts: {
        Row: {
          created_at: string;
          email: string;
          error: string | null;
          handle: string;
          id: string;
          password: string;
          persona_label: string;
          proxy: string;
          status: string;
          totp_secret: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email?: string;
          error?: string | null;
          handle: string;
          id?: string;
          password: string;
          persona_label?: string;
          proxy?: string;
          status?: string;
          totp_secret?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          error?: string | null;
          handle?: string;
          id?: string;
          password?: string;
          persona_label?: string;
          proxy?: string;
          status?: string;
          totp_secret?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      x_mentions: {
        Row: {
          author_handle: string;
          author_name: string;
          author_verified: boolean;
          collected_at: string;
          created_at: string;
          like_count: number;
          matched_keyword: string;
          mentions_federation: boolean;
          mentions_president: boolean;
          posted_at: string | null;
          reply_to_brand: boolean;
          sentiment: string;
          sentiment_reason: string;
          sentiment_score: number;
          source: string;
          text: string;
          tweet_id: string;
          url: string;
          view_count: number;
        };
        Insert: {
          author_handle?: string;
          author_name?: string;
          author_verified?: boolean;
          collected_at?: string;
          created_at?: string;
          like_count?: number;
          matched_keyword?: string;
          mentions_federation?: boolean;
          mentions_president?: boolean;
          posted_at?: string | null;
          reply_to_brand?: boolean;
          sentiment?: string;
          sentiment_reason?: string;
          sentiment_score?: number;
          source?: string;
          text?: string;
          tweet_id: string;
          url?: string;
          view_count?: number;
        };
        Update: {
          author_handle?: string;
          author_name?: string;
          author_verified?: boolean;
          collected_at?: string;
          created_at?: string;
          like_count?: number;
          matched_keyword?: string;
          mentions_federation?: boolean;
          mentions_president?: boolean;
          posted_at?: string | null;
          reply_to_brand?: boolean;
          sentiment?: string;
          sentiment_reason?: string;
          sentiment_score?: number;
          source?: string;
          text?: string;
          tweet_id?: string;
          url?: string;
          view_count?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      campaign_action_stats: {
        Args: never;
        Returns: {
          campaign_id: string;
          kind: string;
          last_at: string;
          n: number;
          next_run: string;
          source: string;
          status: string;
        }[];
      };
      log_audit_event: {
        Args: {
          _action: string;
          _metadata?: Json;
          _resource_id?: string;
          _resource_table: string;
        };
        Returns: string;
      };
      prune_idempotency_keys: {
        Args: { _older_than?: string };
        Returns: undefined;
      };
      prune_rate_limit_hits: {
        Args: { _older_than?: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin" | "member";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "member"],
    },
  },
} as const;
