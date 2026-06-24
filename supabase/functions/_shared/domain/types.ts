export type PlaceType = 'drink_required' | 'compatible' | 'general';
export type PlaceSource = 'google' | 'owner' | 'community';
export type MoodPref = 'quiet' | 'any';

export interface AggregatedConstraints {
  drink: { drinker: number; ok: number; uncomfortable: number };
  budgetMin: number;
  budgetMax: number;
  categories: { name: string; votes: number }[];
  moodDominant: MoodPref | null;
}

export interface Station {
  id: string;
  lat: number;
  lng: number;
}

export interface Candidate {
  ref: string;
  placeId: string | null;
  source: PlaceSource;
  types: string[];
  primaryType: string | null;
  priceLevel: number | null;
  rating: number | null;
  userRatingCount: number | null;
  name: string | null;
  distanceM: number | null;
  placeTypeOverride: PlaceType | null;
  categoryKorean: string | null;
  openDate: string | null;
}

export interface RankedCandidate extends Candidate {
  placeType: PlaceType;
  score: number;
  rank: number;
  relaxed: boolean;
  reviewCountAtAgg: number | null;
  ratingAtAgg: number | null;
}
