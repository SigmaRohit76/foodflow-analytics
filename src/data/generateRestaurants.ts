import type { Restaurant } from '../types';
import {
  CITIES,
  AREAS_BY_CITY,
  FOOD_CATEGORIES,
  CUISINES_BY_CATEGORY,
  RESTAURANT_NAME_PREFIXES,
  RESTAURANT_NAME_SUFFIXES,
} from './constants';
import { createRng, pick, randNormal } from './seededRandom';

const rng = createRng(0xdeadbeef);

/** Total restaurants generated. More restaurants = richer aggregations. */
const RESTAURANT_COUNT = 180;

/**
 * Generates a stable list of restaurants with realistic attributes.
 *
 * Design decisions:
 * - Ratings follow a skewed normal distribution (most 3.5–4.5, few outliers).
 * - Higher-rated restaurants get lower average delivery times.
 * - Cancellation rate inversely correlated with rating.
 * - ~5 % of restaurants are Inactive/Suspended.
 */
function generateRestaurants(): Restaurant[] {
  const restaurants: Restaurant[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < RESTAURANT_COUNT; i++) {
    const city = pick(CITIES, rng);
    const areas = AREAS_BY_CITY[city];
    const area = pick(areas, rng);

    // Pick a primary food category and derive cuisine from it
    const primaryCategory = pick(FOOD_CATEGORIES, rng);
    const cuisineList = CUISINES_BY_CATEGORY[primaryCategory];
    const cuisine = pick(cuisineList, rng);

    // Unique name
    let name: string;
    let attempts = 0;
    do {
      const prefix = pick(RESTAURANT_NAME_PREFIXES, rng);
      const suffix = pick(RESTAURANT_NAME_SUFFIXES, rng);
      name = `${prefix} ${suffix}`;
      attempts++;
    } while (usedNames.has(name) && attempts < 20);
    usedNames.add(name);

    // Rating: skewed towards 3.8–4.4
    const rating = parseFloat(
      Math.min(5, Math.max(1, randNormal(4.0, 0.45, 1, 5, rng))).toFixed(1)
    );

    // Delivery time negatively correlated with rating
    const baseDelivery = 35 - (rating - 3) * 5; // 4.0 rating → ~35 min
    const avgDeliveryTime = Math.round(
      randNormal(baseDelivery, 6, 15, 75, rng)
    );

    // Cancellation rate inversely correlated with rating
    const baseCancellation = Math.max(0.01, 0.25 - (rating - 1) * 0.05);
    const cancellationRate = parseFloat(
      Math.min(0.4, Math.max(0.01, randNormal(baseCancellation, 0.03, 0.01, 0.4, rng))).toFixed(3)
    );

    // Popularity tier drives order volume (set to 0 now; updated after orders are generated)
    const status =
      rng() < 0.93 ? 'Active' : rng() < 0.6 ? 'Inactive' : 'Suspended';

    restaurants.push({
      restaurant_id: `R${String(i + 1).padStart(4, '0')}`,
      restaurant_name: name,
      cuisine,
      city,
      area,
      rating,
      total_orders: 0,    // populated by order generator
      total_revenue: 0,   // populated by order generator
      average_delivery_time: avgDeliveryTime,
      cancellation_rate: cancellationRate,
      status,
    });
  }

  return restaurants;
}

export const restaurants: Restaurant[] = generateRestaurants();

/** Look-up map for O(1) access by id */
export const restaurantMap: Map<string, Restaurant> = new Map(
  restaurants.map((r) => [r.restaurant_id, r])
);
