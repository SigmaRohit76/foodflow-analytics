import type { Order, OrderStatus, PaymentMethod, FoodCategory } from '../types';
import {
  FOOD_CATEGORIES,
  CATEGORY_PRICE_RANGE,
  CATEGORY_POPULARITY,
  CUISINES_BY_CATEGORY,
  PAYMENT_METHODS,
  PAYMENT_WEIGHTS,
  HOURLY_WEIGHTS,
} from './constants';
import { restaurants, restaurantMap } from './generateRestaurants';
import { customers, customerMap } from './generateCustomers';
import {
  createRng,
  pick,
  weightedPick,
  randInt,
  randNormal,
} from './seededRandom';

const rng = createRng(0xf00df00d);

// ─── Configuration ────────────────────────────────────────────────────────────

const ORDER_COUNT = 5200;

/** Date range: last 12 months */
const END_DATE = new Date('2024-12-31');
const START_DATE = new Date('2024-01-01');
const DATE_RANGE_MS = END_DATE.getTime() - START_DATE.getTime();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Pick an order hour weighted by HOURLY_WEIGHTS, then further boosted
 * by the day-of-week multiplier already applied to the caller.
 */
function pickHour(): number {
  return weightedPick(
    Array.from({ length: 24 }, (_, i) => i),
    HOURLY_WEIGHTS,
    rng
  );
}

/**
 * Determine order status given a restaurant's cancellation rate.
 * Most orders in a snapshot are Delivered; a small tail is in-progress.
 */
function pickStatus(cancellationRate: number): OrderStatus {
  const r = rng();
  if (r < cancellationRate) return 'Cancelled';
  if (r < cancellationRate + 0.03) return 'Pending';
  if (r < cancellationRate + 0.05) return 'Preparing';
  if (r < cancellationRate + 0.07) return 'Out for Delivery';
  return 'Delivered';
}

/**
 * Delivery time in minutes.
 * Base from restaurant average, perturbed by random noise.
 * Higher-rated restaurants skew lower.
 */
function deliveryTime(avgMinutes: number): number {
  return Math.round(
    Math.max(10, randNormal(avgMinutes, avgMinutes * 0.2, 10, 120, rng))
  );
}

/**
 * Rating: correlated with delivery time.
 * Long deliveries push rating down; cancelled/in-progress orders get null.
 */
function pickRating(
  status: OrderStatus,
  deliveryMins: number,
  restaurantRating: number
): number | null {
  if (status !== 'Delivered') return null;
  // Base around restaurant's own rating, nudged by delivery time
  const timePenalty = Math.max(0, (deliveryMins - 35) * 0.015);
  const base = restaurantRating - timePenalty;
  const raw = randNormal(base, 0.5, 1, 5, rng);
  // Round to nearest 0.5
  return Math.min(5, Math.max(1, Math.round(raw * 2) / 2));
}

/** Compute delivery fee based on order amount and category */
function deliveryFee(amount: number, category: FoodCategory): number {
  if (amount >= 400) return 0;              // free delivery above threshold
  if (category === 'Beverages') return 15;  // beverages often have low fee
  if (amount < 150) return 40;
  if (amount < 250) return 30;
  return 20;
}

/** Discount: occasional offers, higher probability on weekends & high amounts */
function discount(amount: number, isWeekend: boolean): number {
  const chance = isWeekend ? 0.35 : 0.20;
  if (rng() > chance) return 0;
  // Discount tiers
  const tier = rng();
  if (tier < 0.5) return Math.round(amount * 0.1);   // 10 %
  if (tier < 0.8) return Math.round(amount * 0.2);   // 20 %
  return Math.round(amount * 0.3);                   // 30 %
}

// ─── Popularity weights for restaurants ──────────────────────────────────────

/**
 * Assign each restaurant a popularity score based on its rating.
 * Top-rated restaurants attract proportionally more orders.
 */
const restaurantPopularityWeights: number[] = restaurants.map((r) => {
  const ratingFactor = Math.pow(r.rating / 3, 2.5); // exponential amplification
  return r.status === 'Active' ? ratingFactor : 0.05;
});

// ─── Main generator ───────────────────────────────────────────────────────────

function generateOrders(): Order[] {
  const orders: Order[] = [];
  const categoryNames = FOOD_CATEGORIES as unknown as FoodCategory[];
  const categoryWeights = categoryNames.map((c) => CATEGORY_POPULARITY[c]);

  for (let i = 0; i < ORDER_COUNT; i++) {
    // ── Date & time ──
    const dateMs = START_DATE.getTime() + rng() * DATE_RANGE_MS;
    const date = new Date(dateMs);
    const dow = date.getDay(); // 0=Sun
    const isWeekend = dow === 0 || dow === 6;

    // Optionally re-roll to favour weekend density (~30 % more on weekends)
    const effectiveDate =
      !isWeekend && rng() < 0.15
        ? new Date(dateMs + (rng() < 0.5 ? -1 : 1) * 86400000)
        : date;
    const hour = pickHour();
    const minute = randInt(0, 59, rng);

    // ── Participants ──
    const restaurant = weightedPick(restaurants, restaurantPopularityWeights, rng);
    const customer = pick(customers, rng);

    // ── Food ──
    const category = weightedPick(categoryNames, categoryWeights, rng);
    const [minPrice, maxPrice] = CATEGORY_PRICE_RANGE[category];
    const orderAmount = Math.round(
      randNormal((minPrice + maxPrice) / 2, (maxPrice - minPrice) / 4, minPrice, maxPrice, rng)
    );

    // ── Fees & discounts ──
    const fee = deliveryFee(orderAmount, category);
    const disc = discount(orderAmount, isWeekend);
    const finalAmount = Math.max(orderAmount + fee - disc, orderAmount * 0.5);

    // ── Status & delivery ──
    const status = pickStatus(restaurant.cancellation_rate);
    const deliveryMins = deliveryTime(restaurant.average_delivery_time);
    const rating = pickRating(status, deliveryMins, restaurant.rating);

    // ── Cuisine follows restaurant's primary cuisine ──
    const cuisineList = CUISINES_BY_CATEGORY[category];
    const cuisine = pick(cuisineList, rng);

    orders.push({
      order_id: `ORD${String(i + 1).padStart(6, '0')}`,
      customer_id: customer.customer_id,
      restaurant_id: restaurant.restaurant_id,
      restaurant_name: restaurant.restaurant_name,
      food_category: category,
      cuisine,
      order_date: formatDate(effectiveDate),
      order_time: formatTime(hour, minute),
      order_amount: orderAmount,
      delivery_fee: fee,
      discount: disc,
      final_amount: Math.round(finalAmount),
      delivery_time_minutes: deliveryMins,
      order_status: status,
      payment_method: weightedPick(
        PAYMENT_METHODS as unknown as PaymentMethod[],
        PAYMENT_WEIGHTS,
        rng
      ),
      city: restaurant.city,
      area: restaurant.area,
      rating,
    });
  }

  // Sort by date ascending for time-series charts
  orders.sort((a, b) => (a.order_date > b.order_date ? 1 : -1));
  return orders;
}

export const orders: Order[] = generateOrders();

// ─── Back-fill restaurant & customer aggregates ───────────────────────────────

/**
 * After orders are generated, enrich Restaurant and Customer records
 * with real totals so all entities are consistent.
 */
export function enrichEntities(): void {
  // Reset
  for (const r of restaurants) {
    r.total_orders = 0;
    r.total_revenue = 0;
  }
  for (const c of customers) {
    c.total_orders = 0;
    c.total_spending = 0;
  }

  for (const o of orders) {
    // Restaurant totals
    const rest = restaurantMap.get(o.restaurant_id);
    if (rest) {
      rest.total_orders += 1;
      if (o.order_status === 'Delivered') {
        rest.total_revenue += o.final_amount;
      }
    }

    // Customer totals
    const cust = customerMap.get(o.customer_id);
    if (cust && o.order_status === 'Delivered') {
      cust.total_orders += 1;
      cust.total_spending += o.final_amount;
    }
  }

  // Compute derived fields
  for (const r of restaurants) {
    // Recompute cancellation rate from actual data
    const rOrders = orders.filter((o) => o.restaurant_id === r.restaurant_id);
    if (rOrders.length > 0) {
      r.cancellation_rate = parseFloat(
        (rOrders.filter((o) => o.order_status === 'Cancelled').length / rOrders.length).toFixed(3)
      );
      const deliveredWithRating = rOrders.filter(
        (o) => o.order_status === 'Delivered' && o.rating !== null
      );
      if (deliveredWithRating.length > 0) {
        r.rating = parseFloat(
          (
            deliveredWithRating.reduce((s, o) => s + (o.rating as number), 0) /
            deliveredWithRating.length
          ).toFixed(1)
        );
      }
    }
  }

  for (const c of customers) {
    c.average_order_value =
      c.total_orders > 0
        ? parseFloat((c.total_spending / c.total_orders).toFixed(2))
        : 0;

    // Classify customer type by order count
    if (c.total_orders === 0) c.customer_type = 'Churned';
    else if (c.total_orders <= 2) c.customer_type = 'New';
    else if (c.total_orders <= 8) c.customer_type = 'Regular';
    else c.customer_type = 'Premium';
  }
}
