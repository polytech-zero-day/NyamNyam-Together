import type { Candidate, PlaceType } from './types.ts';

const DRINK_REQUIRED_TYPES = new Set<string>(['bar', 'pub', 'wine_bar', 'night_club']);
const COMPATIBLE_TYPES = new Set<string>(['barbecue_restaurant', 'brewery', 'bar_and_grill']);

export function classifyPlaceType(types: string[], primaryType?: string | null): PlaceType {
  const all = [primaryType, ...types].filter(
    (t): t is string => typeof t === 'string' && t.length > 0,
  );
  if (all.some((t) => DRINK_REQUIRED_TYPES.has(t))) return 'drink_required';
  if (all.some((t) => COMPATIBLE_TYPES.has(t))) return 'compatible';
  return 'general';
}

export function placeTypeOf(c: Candidate): PlaceType {
  if (c.placeTypeOverride) return c.placeTypeOverride;
  return classifyPlaceType(c.types, c.primaryType);
}

export interface DrinkDistribution {
  drinker: number;
  ok: number;
  uncomfortable: number;
}

export function allowedPlaceTypes(drink: DrinkDistribution): Set<PlaceType> {
  if (drink.uncomfortable >= 1) {
    return new Set<PlaceType>(['general']);
  }
  if (drink.drinker > 0 && drink.ok === 0) {
    return new Set<PlaceType>(['drink_required', 'compatible', 'general']);
  }
  return new Set<PlaceType>(['compatible', 'general']);
}

export function filterByPlaceType(candidates: Candidate[], drink: DrinkDistribution): Candidate[] {
  const allowed = allowedPlaceTypes(drink);
  return candidates.filter((c) => allowed.has(placeTypeOf(c)));
}
