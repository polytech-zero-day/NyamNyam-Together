// 이 파일은 Supabase CLI로 자동 생성합니다.
// 재생성: supabase gen types typescript --local > src/types/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SessionStatus = 'collecting' | 'aggregating' | 'voting' | 'closed';
export type PlaceType = 'drink_required' | 'compatible' | 'general';
export type DrinkValue = 'drinker' | 'ok' | 'uncomfortable';
export type MoodValue = 'quiet' | 'any';
export type ConfidenceValue = 'high' | 'medium';

export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string;
          host_user_key: number;
          title: string;
          purpose: string | null;
          min_participants: number;
          station_id: string;
          deadline: string | null;
          status: SessionStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          host_user_key: number;
          title: string;
          purpose?: string | null;
          min_participants?: number;
          station_id: string;
          deadline?: string | null;
          status?: SessionStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          host_user_key?: number;
          title?: string;
          purpose?: string | null;
          min_participants?: number;
          station_id?: string;
          deadline?: string | null;
          status?: SessionStatus;
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
          restaurant_id: string | null;
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
          restaurant_id?: string | null;
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
          restaurant_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      restaurants: {
        Row: {
          id: string;
          kakao_id: string;
          station_id: string;
          name: string;
          category_large: string;
          category_mid: string | null;
          category_small: string | null;
          category_name: string;
          address: string | null;
          road_address: string | null;
          phone: string | null;
          lat: number;
          lng: number;
          distance_m: number | null;
          kakao_url: string | null;
          price_level: number | null;
          avg_price_min: number | null;
          avg_price_max: number | null;
          mood: string[] | null;
          source: string | null;
          source_rating: number | null;
          source_url: string | null;
          crawled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          kakao_id: string;
          station_id: string;
          name: string;
          category_large: string;
          category_mid?: string | null;
          category_small?: string | null;
          category_name: string;
          address?: string | null;
          road_address?: string | null;
          phone?: string | null;
          lat: number;
          lng: number;
          distance_m?: number | null;
          kakao_url?: string | null;
          price_level?: number | null;
          avg_price_min?: number | null;
          avg_price_max?: number | null;
          mood?: string[] | null;
          source?: string | null;
          source_rating?: number | null;
          source_url?: string | null;
          crawled_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          kakao_id?: string;
          station_id?: string;
          name?: string;
          category_large?: string;
          category_mid?: string | null;
          category_small?: string | null;
          category_name?: string;
          address?: string | null;
          road_address?: string | null;
          phone?: string | null;
          lat?: number;
          lng?: number;
          distance_m?: number | null;
          kakao_url?: string | null;
          price_level?: number | null;
          avg_price_min?: number | null;
          avg_price_max?: number | null;
          mood?: string[] | null;
          source?: string | null;
          source_rating?: number | null;
          source_url?: string | null;
          crawled_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurants_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'station_restaurants';
            referencedColumns: ['station_id'];
          },
        ];
      };
      recommendations: {
        Row: {
          id: string;
          session_id: string;
          restaurant_id: string;
          name: string;
          category_name: string | null;
          place_type: PlaceType;
          lat: number;
          lng: number;
          distance: number | null;
          place_url: string | null;
          relaxed: boolean;
          rank: number;
          ai_reason: string | null;
          confidence: ConfidenceValue | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          restaurant_id: string;
          name: string;
          category_name?: string | null;
          place_type: PlaceType;
          lat: number;
          lng: number;
          distance?: number | null;
          place_url?: string | null;
          relaxed?: boolean;
          rank: number;
          ai_reason?: string | null;
          confidence?: ConfidenceValue | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          restaurant_id?: string;
          name?: string;
          category_name?: string | null;
          place_type?: PlaceType;
          lat?: number;
          lng?: number;
          distance?: number | null;
          place_url?: string | null;
          relaxed?: boolean;
          rank?: number;
          ai_reason?: string | null;
          confidence?: ConfidenceValue | null;
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
            foreignKeyName: 'recommendations_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      station_restaurants: {
        Row: {
          station_id: string;
          station_lat: number;
          station_lng: number;
          kakao_fetched_at: string | null;
          web_enriched_at: string | null;
          restaurant_count: number | null;
        };
        Insert: {
          station_id: string;
          station_lat: number;
          station_lng: number;
          kakao_fetched_at?: string | null;
          web_enriched_at?: string | null;
          restaurant_count?: number | null;
        };
        Update: {
          station_id?: string;
          station_lat?: number;
          station_lng?: number;
          kakao_fetched_at?: string | null;
          web_enriched_at?: string | null;
          restaurant_count?: number | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
