// 이 파일은 Supabase CLI로 자동 생성합니다.
// 재생성: supabase gen types typescript --local > src/types/database.types.ts
// 기준 스키마: supabase/migrations/0001_init.sql (places/station_places/recommendations).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SessionStatus = 'collecting' | 'aggregating' | 'voting' | 'closed';
export type SortMode = 'review_count' | 'rating' | 'random';
export type PlaceType = 'drink_required' | 'compatible' | 'general';
export type PlaceSource = 'google' | 'owner' | 'community';
export type PlaceStatus = 'active' | 'closed';
export type DrinkValue = 'drinker' | 'ok' | 'uncomfortable';
export type MoodValue = 'quiet' | 'any';

export interface Database {
  public: {
    Tables: {
      station_places: {
        Row: {
          station_id: string;
          station_lat: number;
          station_lng: number;
          places_discovered_at: string | null;
          place_count: number;
        };
        Insert: {
          station_id: string;
          station_lat: number;
          station_lng: number;
          places_discovered_at?: string | null;
          place_count?: number;
        };
        Update: {
          station_id?: string;
          station_lat?: number;
          station_lng?: number;
          places_discovered_at?: string | null;
          place_count?: number;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          host_user_key: number;
          title: string;
          purpose: string | null;
          min_participants: number;
          station_id: string;
          station_lat: number | null;
          station_lng: number | null;
          deadline: string | null;
          status: SessionStatus;
          sort_mode: SortMode;
          sort_seed: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          host_user_key: number;
          title: string;
          purpose?: string | null;
          min_participants?: number;
          station_id: string;
          station_lat?: number | null;
          station_lng?: number | null;
          deadline?: string | null;
          status?: SessionStatus;
          sort_mode?: SortMode;
          sort_seed?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          host_user_key?: number;
          title?: string;
          purpose?: string | null;
          min_participants?: number;
          station_id?: string;
          station_lat?: number | null;
          station_lng?: number | null;
          deadline?: string | null;
          status?: SessionStatus;
          sort_mode?: SortMode;
          sort_seed?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      participants: {
        Row: {
          id: string;
          session_id: string;
          user_key: number;
          joined_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_key: number;
          joined_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_key?: number;
          joined_at?: string;
        };
        Relationships: [];
      };
      places: {
        Row: {
          id: string;
          source: PlaceSource;
          google_place_id: string | null;
          station_id: string;
          place_type: PlaceType | null;
          name: string | null;
          lat: number | null;
          lng: number | null;
          category: string | null;
          price_level: number | null;
          open_date: string | null;
          status: PlaceStatus | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source: PlaceSource;
          google_place_id?: string | null;
          station_id: string;
          place_type?: PlaceType | null;
          name?: string | null;
          lat?: number | null;
          lng?: number | null;
          category?: string | null;
          price_level?: number | null;
          open_date?: string | null;
          status?: PlaceStatus | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          source?: PlaceSource;
          google_place_id?: string | null;
          station_id?: string;
          place_type?: PlaceType | null;
          name?: string | null;
          lat?: number | null;
          lng?: number | null;
          category?: string | null;
          price_level?: number | null;
          open_date?: string | null;
          status?: PlaceStatus | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'places_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'station_places';
            referencedColumns: ['station_id'];
          },
        ];
      };
      recommendations: {
        Row: {
          id: string;
          session_id: string;
          place_id: string;
          place_type: PlaceType | null;
          rank: number;
          relaxed: boolean;
          ai_reason: string | null;
          review_count_at_agg: number | null;
          rating_at_agg: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          place_id: string;
          place_type?: PlaceType | null;
          rank: number;
          relaxed?: boolean;
          ai_reason?: string | null;
          review_count_at_agg?: number | null;
          rating_at_agg?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          place_id?: string;
          place_type?: PlaceType | null;
          rank?: number;
          relaxed?: boolean;
          ai_reason?: string | null;
          review_count_at_agg?: number | null;
          rating_at_agg?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recommendations_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recommendations_place_id_fkey';
            columns: ['place_id'];
            isOneToOne: false;
            referencedRelation: 'places';
            referencedColumns: ['id'];
          },
        ];
      };
      votes: {
        Row: {
          id: string;
          session_id: string;
          user_key: number;
          stage: 1 | 2;
          drink: DrinkValue | null;
          budget_min: number | null;
          budget_max: number | null;
          categories: Json | null;
          mood: MoodValue | null;
          recommendation_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_key: number;
          stage: 1 | 2;
          drink?: DrinkValue | null;
          budget_min?: number | null;
          budget_max?: number | null;
          categories?: Json | null;
          mood?: MoodValue | null;
          recommendation_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_key?: number;
          stage?: 1 | 2;
          drink?: DrinkValue | null;
          budget_min?: number | null;
          budget_max?: number | null;
          categories?: Json | null;
          mood?: MoodValue | null;
          recommendation_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'votes_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'votes_recommendation_id_fkey';
            columns: ['recommendation_id'];
            isOneToOne: false;
            referencedRelation: 'recommendations';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
