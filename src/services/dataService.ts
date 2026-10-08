/**
 * ─── FoodFlow Analytics — Centralized Data Service ──────────────────────────
 *
 * This is the SINGLE source of truth for all dashboard components.
 * Components must never import from generateOrders / generateRestaurants /
 * generateCustomers directly — they always go through this service.
 *
 * The public API is intentionally thin:
 *   - Raw datasets  → getRawOrders(), getRawCustomers(), getRawRestaurants()
 *   - KPI summary   → getKPISummary()
 *   - Aggregations  → getOrdersByMonth(), getOrdersByCity(), etc.
 *
 * To swap in a real backend, replace the three `get*Raw` functions at the
 * bottom of this file with API calls (or CSV parsing, etc.).  Everything
 * else in this file derives from those three arrays and will continue to work.
 */

import type {
  Order,
  Customer,
  Restaurant,
  FoodCategory,
  OrderStatus,
  PaymentMethod,
} from '../types';

import { orders as _rawOrders, enrichEntities } from '../data/generateOrders';
import { restaurants as _rawRestaurants } from '../data/generateRestaurants';
import { customers as _rawCustomers } from '../data/generateCustomers';

// Run enrichment exactly once at module load time
enrichEntities();

// ─── Data Access (swap these out to connect a real data source) ───────────────

export function getRawOrders(): Order[] {
  return _rawOrders;
}

export function getRawRestaurants(): Restaurant[] {
  return _rawRestaurants;
}

export function getRawCustomers(): Customer[] {
  return _rawCustomers;
}

// ─── Types returned by aggregation functions ──────────────────────────────────

export interface KPISummary {
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  averageDeliveryTime: number;
  averageRating: number;
  totalCustomers: number;
  totalRestaurants: number;
  activeRestaurants: number;
  deliveryRate: number;   // fraction 0–1
  cancellationRate: number;
}

export interface MonthlyTrend {
  month: string;   // "Jan 2024"
  orders: number;
  revenue: number;
  avgOrderValue: number;
}

export interface CategoryBreakdown {
  category: FoodCategory;
  orders: number;
  revenue: number;
  avgOrderValue: number;
  avgRating: number;
}

export interface CityMetrics {
  city: string;
  orders: number;
  revenue: number;
  avgDeliveryTime: number;
  avgRating: number;
  cancellationRate: number;
}

export interface HourlyDistribution {
  hour: number;     // 0–23
  orders: number;
}

export interface DailyDistribution {
  dayName: string;  // "Mon", "Tue", …
  orders: number;
  revenue: number;
}

export interface PaymentBreakdown {
  method: PaymentMethod;
  orders: number;
  revenue: number;
  share: number;  // fraction of total orders
}

export interface StatusBreakdown {
  status: OrderStatus;
  count: number;
  share: number;
}

export interface TopRestaurant {
  restaurant_id: string;
  restaurant_name: string;
  city: string;
  cuisine: string;
  rating: number;
  total_orders: number;
  total_revenue: number;
  avg_delivery_time: number;
  cancellation_rate: number;
}

export interface TopCustomer {
  customer_id: string;
  customer_name: string;
  city: string;
  total_orders: number;
  total_spending: number;
  average_order_value: number;
  customer_type: string;
}

export interface CustomerTypeBreakdown {
  type: string;
  count: number;
  share: number;
}

export interface DeliveryTimeBucket {
  label: string;
  count: number;
}

export interface RatingDistribution {
  rating: number;
  count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── KPI Summary ──────────────────────────────────────────────────────────────

export function getKPISummary(): KPISummary {
  const orders = getRawOrders();
  const restaurants = getRawRestaurants();
  const customers = getRawCustomers();

  const delivered = orders.filter((o) => o.order_status === 'Delivered');
  const cancelled = orders.filter((o) => o.order_status === 'Cancelled');
  const rated = delivered.filter((o) => o.rating !== null);

  const totalRevenue = delivered.reduce((s, o) => s + o.final_amount, 0);

  return {
    totalOrders: orders.length,
    deliveredOrders: delivered.length,
    cancelledOrders: cancelled.length,
    totalRevenue: Math.round(totalRevenue),
    averageOrderValue: round2(totalRevenue / (delivered.length || 1)),
    averageDeliveryTime: round2(avg(delivered.map((o) => o.delivery_time_minutes))),
    averageRating: round2(avg(rated.map((o) => o.rating as number))),
    totalCustomers: customers.length,
    totalRestaurants: restaurants.length,
    activeRestaurants: restaurants.filter((r) => r.status === 'Active').length,
    deliveryRate: round2(delivered.length / (orders.length || 1)),
    cancellationRate: round2(cancelled.length / (orders.length || 1)),
  };
}

// ─── Monthly Trend ────────────────────────────────────────────────────────────

export function getMonthlyTrend(): MonthlyTrend[] {
  const orders = getRawOrders();
  const map = new Map<string, { orders: number; revenue: number; amounts: number[] }>();

  for (const o of orders) {
    const d = new Date(o.order_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, { orders: 0, revenue: 0, amounts: [] });
    const entry = map.get(key)!;
    entry.orders += 1;
    if (o.order_status === 'Delivered') {
      entry.revenue += o.final_amount;
      entry.amounts.push(o.final_amount);
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([key, val]) => {
      const [year, month] = key.split('-');
      return {
        month: `${MONTH_NAMES[Number(month) - 1]} ${year}`,
        orders: val.orders,
        revenue: Math.round(val.revenue),
        avgOrderValue: round2(avg(val.amounts)),
      };
    });
}

// ─── Category Breakdown ───────────────────────────────────────────────────────

export function getCategoryBreakdown(): CategoryBreakdown[] {
  const orders = getRawOrders();
  const map = new Map<
    string,
    { orders: number; revenue: number; amounts: number[]; ratings: number[] }
  >();

  for (const o of orders) {
    if (!map.has(o.food_category)) {
      map.set(o.food_category, { orders: 0, revenue: 0, amounts: [], ratings: [] });
    }
    const e = map.get(o.food_category)!;
    e.orders += 1;
    if (o.order_status === 'Delivered') {
      e.revenue += o.final_amount;
      e.amounts.push(o.final_amount);
      if (o.rating !== null) e.ratings.push(o.rating);
    }
  }

  return Array.from(map.entries())
    .map(([category, val]) => ({
      category: category as FoodCategory,
      orders: val.orders,
      revenue: Math.round(val.revenue),
      avgOrderValue: round2(avg(val.amounts)),
      avgRating: round2(avg(val.ratings)),
    }))
    .sort((a, b) => b.orders - a.orders);
}

// ─── City Metrics ─────────────────────────────────────────────────────────────

export function getCityMetrics(): CityMetrics[] {
  const orders = getRawOrders();
  const map = new Map<
    string,
    {
      orders: number;
      revenue: number;
      deliveryTimes: number[];
      ratings: number[];
      cancelled: number;
    }
  >();

  for (const o of orders) {
    if (!map.has(o.city)) {
      map.set(o.city, { orders: 0, revenue: 0, deliveryTimes: [], ratings: [], cancelled: 0 });
    }
    const e = map.get(o.city)!;
    e.orders += 1;
    if (o.order_status === 'Delivered') {
      e.revenue += o.final_amount;
      e.deliveryTimes.push(o.delivery_time_minutes);
      if (o.rating !== null) e.ratings.push(o.rating);
    }
    if (o.order_status === 'Cancelled') e.cancelled += 1;
  }

  return Array.from(map.entries())
    .map(([city, val]) => ({
      city,
      orders: val.orders,
      revenue: Math.round(val.revenue),
      avgDeliveryTime: round2(avg(val.deliveryTimes)),
      avgRating: round2(avg(val.ratings)),
      cancellationRate: round2(val.cancelled / (val.orders || 1)),
    }))
    .sort((a, b) => b.orders - a.orders);
}

// ─── Hourly Distribution ──────────────────────────────────────────────────────

export function getHourlyDistribution(): HourlyDistribution[] {
  const orders = getRawOrders();
  const counts = new Array(24).fill(0);
  for (const o of orders) {
    const hour = parseInt(o.order_time.split(':')[0], 10);
    counts[hour] += 1;
  }
  return counts.map((count, hour) => ({ hour, orders: count }));
}

// ─── Daily Distribution ───────────────────────────────────────────────────────

export function getDailyDistribution(): DailyDistribution[] {
  const orders = getRawOrders();
  const map = new Map<number, { orders: number; revenue: number }>();
  for (let i = 0; i < 7; i++) map.set(i, { orders: 0, revenue: 0 });

  for (const o of orders) {
    const dow = new Date(o.order_date).getDay();
    const e = map.get(dow)!;
    e.orders += 1;
    if (o.order_status === 'Delivered') e.revenue += o.final_amount;
  }

  return Array.from(map.entries()).map(([dow, val]) => ({
    dayName: DAY_NAMES[dow],
    orders: val.orders,
    revenue: Math.round(val.revenue),
  }));
}

// ─── Payment Breakdown ────────────────────────────────────────────────────────

export function getPaymentBreakdown(): PaymentBreakdown[] {
  const orders = getRawOrders();
  const total = orders.length;
  const map = new Map<string, { orders: number; revenue: number }>();

  for (const o of orders) {
    if (!map.has(o.payment_method)) map.set(o.payment_method, { orders: 0, revenue: 0 });
    const e = map.get(o.payment_method)!;
    e.orders += 1;
    if (o.order_status === 'Delivered') e.revenue += o.final_amount;
  }

  return Array.from(map.entries())
    .map(([method, val]) => ({
      method: method as PaymentMethod,
      orders: val.orders,
      revenue: Math.round(val.revenue),
      share: round2(val.orders / (total || 1)),
    }))
    .sort((a, b) => b.orders - a.orders);
}

// ─── Status Breakdown ─────────────────────────────────────────────────────────

export function getStatusBreakdown(): StatusBreakdown[] {
  const orders = getRawOrders();
  const total = orders.length;
  const map = new Map<string, number>();

  for (const o of orders) {
    map.set(o.order_status, (map.get(o.order_status) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([status, count]) => ({
      status: status as OrderStatus,
      count,
      share: round2(count / (total || 1)),
    }))
    .sort((a, b) => b.count - a.count);
}

// ─── Top Restaurants ──────────────────────────────────────────────────────────

export function getTopRestaurants(limit = 10): TopRestaurant[] {
  return getRawRestaurants()
    .filter((r) => r.total_orders > 0)
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, limit)
    .map((r) => ({
      restaurant_id: r.restaurant_id,
      restaurant_name: r.restaurant_name,
      city: r.city,
      cuisine: r.cuisine,
      rating: r.rating,
      total_orders: r.total_orders,
      total_revenue: r.total_revenue,
      avg_delivery_time: r.average_delivery_time,
      cancellation_rate: r.cancellation_rate,
    }));
}

// ─── Top Customers ────────────────────────────────────────────────────────────

export function getTopCustomers(limit = 10): TopCustomer[] {
  return getRawCustomers()
    .filter((c) => c.total_orders > 0)
    .sort((a, b) => b.total_spending - a.total_spending)
    .slice(0, limit)
    .map((c) => ({
      customer_id: c.customer_id,
      customer_name: c.customer_name,
      city: c.city,
      total_orders: c.total_orders,
      total_spending: c.total_spending,
      average_order_value: c.average_order_value,
      customer_type: c.customer_type,
    }));
}

// ─── Customer Type Breakdown ──────────────────────────────────────────────────

export function getCustomerTypeBreakdown(): CustomerTypeBreakdown[] {
  const customers = getRawCustomers();
  const total = customers.length;
  const map = new Map<string, number>();

  for (const c of customers) {
    map.set(c.customer_type, (map.get(c.customer_type) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([type, count]) => ({
      type,
      count,
      share: round2(count / (total || 1)),
    }))
    .sort((a, b) => b.count - a.count);
}

// ─── Delivery Time Distribution (bucketed) ────────────────────────────────────

export function getDeliveryTimeBuckets(): DeliveryTimeBucket[] {
  const buckets: Array<{ label: string; min: number; max: number }> = [
    { label: '< 20 min',   min: 0,   max: 19  },
    { label: '20–30 min',  min: 20,  max: 30  },
    { label: '31–45 min',  min: 31,  max: 45  },
    { label: '46–60 min',  min: 46,  max: 60  },
    { label: '> 60 min',   min: 61,  max: Infinity },
  ];

  const delivered = getRawOrders().filter((o) => o.order_status === 'Delivered');
  return buckets.map((b) => ({
    label: b.label,
    count: delivered.filter(
      (o) => o.delivery_time_minutes >= b.min && o.delivery_time_minutes <= b.max
    ).length,
  }));
}

// ─── Rating Distribution ──────────────────────────────────────────────────────

export function getRatingDistribution(): RatingDistribution[] {
  const rated = getRawOrders().filter(
    (o) => o.order_status === 'Delivered' && o.rating !== null
  );
  const map = new Map<number, number>();
  for (const o of rated) {
    const r = o.rating as number;
    map.set(r, (map.get(r) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([rating, count]) => ({ rating, count }))
    .sort((a, b) => a.rating - b.rating);
}

// ─── Revenue by Category (for pie/bar) ───────────────────────────────────────

export function getRevenueByCuisine(): Array<{ cuisine: string; revenue: number; orders: number }> {
  const orders = getRawOrders().filter((o) => o.order_status === 'Delivered');
  const map = new Map<string, { revenue: number; orders: number }>();

  for (const o of orders) {
    if (!map.has(o.cuisine)) map.set(o.cuisine, { revenue: 0, orders: 0 });
    const e = map.get(o.cuisine)!;
    e.revenue += o.final_amount;
    e.orders += 1;
  }

  return Array.from(map.entries())
    .map(([cuisine, val]) => ({
      cuisine,
      revenue: Math.round(val.revenue),
      orders: val.orders,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ─── Dashboard Filters ────────────────────────────────────────────────────────

/**
 * All filter dimensions that can be applied to the order dataset.
 * undefined / empty-array = "no filter on this dimension" (show everything).
 */
export interface DashboardFilters {
  /** ISO date strings, e.g. "2024-01-01" */
  dateFrom?: string;
  dateTo?:   string;
  cities?:          string[];
  areas?:           string[];
  restaurants?:     string[];   // restaurant_id values
  categories?:      string[];
  cuisines?:        string[];
  statuses?:        string[];
  paymentMethods?:  string[];
  /** Minimum average rating (inclusive), e.g. 4.0 */
  minRating?:       number;
}

/** Empty filter object — convenience sentinel meaning "all data" */
export const NO_FILTER: DashboardFilters = {};

// ─── Filter application ───────────────────────────────────────────────────────

/**
 * Apply a DashboardFilters object to a raw order array.
 * This is the only place filter logic lives — all aggregations call it.
 */
export function applyFilters(orders: Order[], f: DashboardFilters): Order[] {
  return orders.filter((o) => {
    if (f.dateFrom && o.order_date < f.dateFrom) return false;
    if (f.dateTo   && o.order_date > f.dateTo)   return false;
    if (f.cities?.length         && !f.cities.includes(o.city))              return false;
    if (f.areas?.length          && !f.areas.includes(o.area))               return false;
    if (f.restaurants?.length    && !f.restaurants.includes(o.restaurant_id)) return false;
    if (f.categories?.length     && !f.categories.includes(o.food_category)) return false;
    if (f.cuisines?.length       && !f.cuisines.includes(o.cuisine))         return false;
    if (f.statuses?.length       && !f.statuses.includes(o.order_status))    return false;
    if (f.paymentMethods?.length && !f.paymentMethods.includes(o.payment_method)) return false;
    if (f.minRating !== undefined && (o.rating === null || (o.rating as number) < f.minRating)) return false;
    return true;
  });
}

// ─── KPI delta types ──────────────────────────────────────────────────────────

export interface KPIDelta {
  /** Absolute change: current − previous */
  absolute: number;
  /** Percentage change: (current − previous) / previous × 100  (NaN if prev=0) */
  percent: number;
  /** Semantic direction — useful for colouring the chip */
  direction: 'up' | 'down' | 'neutral';
  /** Formatted label, e.g. "+12.4%" or "−3 min" */
  label: string;
  /** Previous period value (raw number, callers format it) */
  prevValue: number;
}

export interface KPIWithComparison extends KPISummary {
  prev: KPISummary;
  deltas: {
    totalOrders:          KPIDelta;
    totalRevenue:         KPIDelta;
    averageOrderValue:    KPIDelta;
    averageDeliveryTime:  KPIDelta;
    averageRating:        KPIDelta;
    cancellationRate:     KPIDelta;
  };
  /** Human-readable label describing the comparison period */
  comparisonLabel: string;
}

// ─── Pure KPI calculator (no side-effects) ────────────────────────────────────

/**
 * Compute all six dashboard KPIs from an arbitrary order slice.
 * This is the single source of truth for every KPI formula.
 */
function computeKPI(orders: Order[]): KPISummary {
  const delivered = orders.filter((o) => o.order_status === 'Delivered');
  const cancelled = orders.filter((o) => o.order_status === 'Cancelled');
  const rated     = delivered.filter((o) => o.rating !== null);

  const totalRevenue = delivered.reduce((s, o) => s + o.final_amount, 0);
  const totalDelTime = delivered.reduce((s, o) => s + o.delivery_time_minutes, 0);
  const totalRating  = rated.reduce((s, o) => s + (o.rating as number), 0);

  return {
    totalOrders:        orders.length,
    deliveredOrders:    delivered.length,
    cancelledOrders:    cancelled.length,
    totalRevenue:       Math.round(totalRevenue),
    averageOrderValue:  round2(totalRevenue / (delivered.length || 1)),
    averageDeliveryTime: round2(totalDelTime / (delivered.length || 1)),
    averageRating:      round2(totalRating  / (rated.length || 1)),
    // KPISummary also has restaurant/customer fields — not order-derivable
    totalCustomers:     0,
    totalRestaurants:   0,
    activeRestaurants:  0,
    deliveryRate:       round2(delivered.length / (orders.length || 1)),
    cancellationRate:   round2(cancelled.length / (orders.length || 1)),
  };
}

// ─── Delta builder ────────────────────────────────────────────────────────────

/**
 * Build a KPIDelta between a current and previous value.
 *
 * @param current  Value for the current period
 * @param previous Value for the previous period
 * @param higherIsBetter  false for metrics like delivery time / cancellation rate
 * @param formatFn Custom label formatter (receives the percent value)
 */
function buildDelta(
  current: number,
  previous: number,
  higherIsBetter: boolean,
  formatFn?: (pct: number, abs: number) => string
): KPIDelta {
  const absolute = current - previous;
  const percent  = previous !== 0 ? round2((absolute / Math.abs(previous)) * 100) : 0;

  let direction: KPIDelta['direction'];
  if (Math.abs(percent) < 0.1) {
    direction = 'neutral';
  } else if (higherIsBetter) {
    direction = absolute >= 0 ? 'up' : 'down';
  } else {
    // For delivery time / cancellation rate: improvement = value went DOWN
    direction = absolute <= 0 ? 'up' : 'down';
  }

  const defaultLabel = formatFn
    ? formatFn(percent, absolute)
    : `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;

  return { absolute, percent, direction, label: defaultLabel, prevValue: previous };
}

// ─── Period utilities ─────────────────────────────────────────────────────────

/**
 * Given current [from, to] produce the immediately-preceding equal-length window.
 * Returns ISO date strings.
 */
function previousPeriod(from: string, to: string): { from: string; to: string } {
  const msFrom = new Date(from).getTime();
  const msTo   = new Date(to).getTime();
  const span   = msTo - msFrom + 86_400_000; // inclusive span in ms
  return {
    from: new Date(msFrom - span).toISOString().slice(0, 10),
    to:   new Date(msTo   - span).toISOString().slice(0, 10),
  };
}

/** Format a date range as a readable label, e.g. "Jan–Jun 2024" */
function rangeLabel(from: string, to: string): string {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const f = new Date(from);
  const t = new Date(to);
  if (f.getFullYear() === t.getFullYear()) {
    return `${MONTHS[f.getMonth()]}–${MONTHS[t.getMonth()]} ${f.getFullYear()}`;
  }
  return `${MONTHS[f.getMonth()]} ${f.getFullYear()} – ${MONTHS[t.getMonth()]} ${t.getFullYear()}`;
}

// ─── Main filtered KPI API ────────────────────────────────────────────────────

/**
 * Compute the 6 dashboard KPIs for the current filter window,
 * the mirrored previous period, and a delta for each metric.
 *
 * If no date range is provided the full dataset is used as current period
 * and the previous period is synthesised as a 50%-shifted window so there
 * is always a meaningful comparison to show.
 */
export function getKPIWithComparison(filters: DashboardFilters = NO_FILTER): KPIWithComparison {
  const allOrders = getRawOrders();

  // Determine effective date bounds
  const dates     = allOrders.map((o) => o.order_date).sort();
  const earliest  = dates[0]   ?? '2024-01-01';
  const latest    = dates[dates.length - 1] ?? '2024-12-31';

  const currFrom  = filters.dateFrom ?? earliest;
  const currTo    = filters.dateTo   ?? latest;
  const prev      = previousPeriod(currFrom, currTo);

  // Filter current period
  const currFilters: DashboardFilters = { ...filters, dateFrom: currFrom, dateTo: currTo };
  const prevFilters: DashboardFilters = {
    ...filters,          // apply all non-date filters identically
    dateFrom: prev.from,
    dateTo:   prev.to,
  };

  const currOrders = applyFilters(allOrders, currFilters);
  const prevOrders = applyFilters(allOrders, prevFilters);

  const curr = computeKPI(currOrders);
  const prevKPI = computeKPI(prevOrders);

  // Populate customer/restaurant counts from full set (not order-derivable)
  const restaurants  = getRawRestaurants();
  const customers    = getRawCustomers();
  curr.totalRestaurants  = restaurants.length;
  curr.activeRestaurants = restaurants.filter((r) => r.status === 'Active').length;
  curr.totalCustomers    = customers.length;

  const comparisonLabel = `vs. ${rangeLabel(prev.from, prev.to)}`;

  return {
    ...curr,
    prev: prevKPI,
    comparisonLabel,
    deltas: {
      totalOrders: buildDelta(
        curr.totalOrders, prevKPI.totalOrders, true
      ),
      totalRevenue: buildDelta(
        curr.totalRevenue, prevKPI.totalRevenue, true,
        (p) => `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`
      ),
      averageOrderValue: buildDelta(
        curr.averageOrderValue, prevKPI.averageOrderValue, true
      ),
      averageDeliveryTime: buildDelta(
        curr.averageDeliveryTime, prevKPI.averageDeliveryTime,
        false, // lower is better
        (_p, abs) => `${abs >= 0 ? '+' : ''}${abs.toFixed(1)} min`
      ),
      averageRating: buildDelta(
        curr.averageRating, prevKPI.averageRating, true,
        (_p, abs) => `${abs >= 0 ? '+' : ''}${abs.toFixed(2)}`
      ),
      cancellationRate: buildDelta(
        curr.cancellationRate, prevKPI.cancellationRate,
        false, // lower is better
        (p) => `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`
      ),
    },
  };
}

// ─── Filtered aggregations for charts ────────────────────────────────────────

/**
 * All chart-level aggregations derived from the same filtered order slice.
 * This guarantees charts and KPI cards always reflect the same dataset.
 */
export function getFilteredAggregations(filters: DashboardFilters = NO_FILTER) {
  const allOrders = getRawOrders();
  const orders    = applyFilters(allOrders, filters);

  // ── Monthly trend ──
  const monthMap = new Map<string, { orders: number; revenue: number; amounts: number[] }>();
  for (const o of orders) {
    const d   = new Date(o.order_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap.has(key)) monthMap.set(key, { orders: 0, revenue: 0, amounts: [] });
    const e = monthMap.get(key)!;
    e.orders += 1;
    if (o.order_status === 'Delivered') { e.revenue += o.final_amount; e.amounts.push(o.final_amount); }
  }
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthlyTrend: MonthlyTrend[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([key, val]) => {
      const [year, month] = key.split('-');
      return {
        month: `${MONTHS[Number(month) - 1]} ${year}`,
        orders: val.orders,
        revenue: Math.round(val.revenue),
        avgOrderValue: round2(val.amounts.length ? val.amounts.reduce((a, b) => a + b, 0) / val.amounts.length : 0),
      };
    });

  // ── Category breakdown ──
  const catMap = new Map<string, { orders: number; revenue: number; amounts: number[]; ratings: number[] }>();
  for (const o of orders) {
    if (!catMap.has(o.food_category)) catMap.set(o.food_category, { orders: 0, revenue: 0, amounts: [], ratings: [] });
    const e = catMap.get(o.food_category)!;
    e.orders += 1;
    if (o.order_status === 'Delivered') {
      e.revenue += o.final_amount; e.amounts.push(o.final_amount);
      if (o.rating !== null) e.ratings.push(o.rating);
    }
  }
  const categoryBreakdown: CategoryBreakdown[] = Array.from(catMap.entries())
    .map(([category, val]) => ({
      category: category as FoodCategory,
      orders: val.orders,
      revenue: Math.round(val.revenue),
      avgOrderValue: round2(val.amounts.length ? val.amounts.reduce((a, b) => a + b, 0) / val.amounts.length : 0),
      avgRating: round2(val.ratings.length ? val.ratings.reduce((a, b) => a + b, 0) / val.ratings.length : 0),
    }))
    .sort((a, b) => b.orders - a.orders);

  // ── Status breakdown ──
  const statusMap = new Map<string, number>();
  for (const o of orders) statusMap.set(o.order_status, (statusMap.get(o.order_status) ?? 0) + 1);
  const statusBreakdown: StatusBreakdown[] = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status: status as OrderStatus, count, share: round2(count / (orders.length || 1)) }))
    .sort((a, b) => b.count - a.count);

  // ── Payment breakdown ──
  const payMap = new Map<string, { orders: number; revenue: number }>();
  for (const o of orders) {
    if (!payMap.has(o.payment_method)) payMap.set(o.payment_method, { orders: 0, revenue: 0 });
    const e = payMap.get(o.payment_method)!;
    e.orders += 1;
    if (o.order_status === 'Delivered') e.revenue += o.final_amount;
  }
  const paymentBreakdown: PaymentBreakdown[] = Array.from(payMap.entries())
    .map(([method, val]) => ({
      method: method as PaymentMethod,
      orders: val.orders,
      revenue: Math.round(val.revenue),
      share: round2(val.orders / (orders.length || 1)),
    }))
    .sort((a, b) => b.orders - a.orders);

  // ── Delivery time buckets ──
  const BUCKETS = [
    { label: '< 20 min',  min: 0,  max: 19 },
    { label: '20–30 min', min: 20, max: 30 },
    { label: '31–45 min', min: 31, max: 45 },
    { label: '46–60 min', min: 46, max: 60 },
    { label: '> 60 min',  min: 61, max: Infinity },
  ];
  const delivered = orders.filter((o) => o.order_status === 'Delivered');
  const deliveryBuckets: DeliveryTimeBucket[] = BUCKETS.map((b) => ({
    label: b.label,
    count: delivered.filter((o) => o.delivery_time_minutes >= b.min && o.delivery_time_minutes <= b.max).length,
  }));

  // ── Top restaurants from filtered orders ──
  const restRevMap = new Map<string, { name: string; city: string; cuisine: string; revenue: number; orders: number; ratings: number[]; cancelCount: number }>();
  for (const o of orders) {
    if (!restRevMap.has(o.restaurant_id)) {
      restRevMap.set(o.restaurant_id, { name: o.restaurant_name, city: o.city, cuisine: o.cuisine, revenue: 0, orders: 0, ratings: [], cancelCount: 0 });
    }
    const e = restRevMap.get(o.restaurant_id)!;
    e.orders += 1;
    if (o.order_status === 'Delivered') { e.revenue += o.final_amount; if (o.rating !== null) e.ratings.push(o.rating); }
    if (o.order_status === 'Cancelled') e.cancelCount += 1;
  }
  const topRestaurants: TopRestaurant[] = Array.from(restRevMap.entries())
    .map(([id, v]) => ({
      restaurant_id: id,
      restaurant_name: v.name,
      city: v.city,
      cuisine: v.cuisine,
      rating: v.ratings.length ? round2(v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length) : 0,
      total_orders: v.orders,
      total_revenue: Math.round(v.revenue),
      avg_delivery_time: 0, // not available per-order in this slice
      cancellation_rate: round2(v.cancelCount / (v.orders || 1)),
    }))
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 10);

  // ── Recent orders (last 10 delivered in this slice) ──
  const recentOrders = [...orders]
    .reverse()
    .filter((o) => o.order_status === 'Delivered')
    .slice(0, 10);

  // ── Average delivery time by city ──
  const cityDelivMap = new Map<string, { total: number; count: number }>();
  for (const o of delivered) {
    if (!cityDelivMap.has(o.city)) cityDelivMap.set(o.city, { total: 0, count: 0 });
    const e = cityDelivMap.get(o.city)!;
    e.total += o.delivery_time_minutes;
    e.count += 1;
  }
  const deliveryByCity = Array.from(cityDelivMap.entries())
    .map(([city, v]) => ({ city, avgDeliveryTime: round2(v.total / (v.count || 1)), orderCount: v.count }))
    .sort((a, b) => a.avgDeliveryTime - b.avgDeliveryTime);

  // ── Rating distribution (half-star buckets 1.0–5.0) ──
  const ratingMap = new Map<number, number>();
  for (const o of orders) {
    if (o.rating !== null) ratingMap.set(o.rating as number, (ratingMap.get(o.rating as number) ?? 0) + 1);
  }
  const ratingDistribution = Array.from(ratingMap.entries())
    .map(([rating, count]) => ({ rating, count }))
    .sort((a, b) => a.rating - b.rating);

  // ── Order-value distribution (₹ buckets) ──
  const VALUE_BUCKETS = [
    { label: '< ₹100',     min: 0,   max: 99   },
    { label: '₹100–200',   min: 100, max: 200  },
    { label: '₹200–300',   min: 201, max: 300  },
    { label: '₹300–500',   min: 301, max: 500  },
    { label: '₹500–750',   min: 501, max: 750  },
    { label: '> ₹750',     min: 751, max: Infinity },
  ];
  const orderValueDistribution = VALUE_BUCKETS.map((b) => ({
    label: b.label,
    count: orders.filter((o) => o.final_amount >= b.min && o.final_amount <= b.max).length,
  }));

  // ── Orders by day of week ──
  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowMap = new Array(7).fill(0).map((_, i) => ({ day: DOW_LABELS[i], orders: 0, revenue: 0 }));
  for (const o of orders) {
    const dow = new Date(o.order_date).getDay();
    dowMap[dow].orders += 1;
    if (o.order_status === 'Delivered') dowMap[dow].revenue += o.final_amount;
  }
  const ordersByDow = dowMap.map((d) => ({ ...d, revenue: Math.round(d.revenue) }));

  // ── Orders by hour ──
  const hourMap = new Array(24).fill(0).map((_, h) => ({ hour: h, label: `${h}:00`, orders: 0 }));
  for (const o of orders) {
    const h = parseInt(o.order_time.split(':')[0], 10);
    hourMap[h].orders += 1;
  }
  const ordersByHour = hourMap;

  return {
    orders,
    monthlyTrend,
    categoryBreakdown,
    statusBreakdown,
    paymentBreakdown,
    deliveryBuckets,
    topRestaurants,
    recentOrders,
    deliveryByCity,
    ratingDistribution,
    orderValueDistribution,
    ordersByDow,
    ordersByHour,
  };
}


// ─── Orders Page aggregations ────────────────────────────────────────────────

export interface OrdersPageKPI {
  totalOrders:       number;
  delivered:         number;
  cancelled:         number;
  pending:           number;   // Pending + Preparing + Out for Delivery
  cancellationRate:  number;   // 0-1
  avgOrderValue:     number;
}

export interface OrdersOverTime {
  name:    string;   // "Jan 2024" or date label
  orders:  number;
  revenue: number;
}

export interface OrdersByCityRow {
  city:    string;
  orders:  number;
  revenue: number;
  share:   number;
}

/**
 * Returns KPIs + all chart-ready datasets for the Orders page.
 * Accepts a pre-filtered order array so it honours the global FilterContext.
 */
export function getOrdersPageData(orders: Order[]) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const delivered    = orders.filter((o) => o.order_status === 'Delivered');
  const cancelled    = orders.filter((o) => o.order_status === 'Cancelled');
  const inProgress   = orders.filter((o) =>
    o.order_status === 'Pending' || o.order_status === 'Preparing' || o.order_status === 'Out for Delivery'
  );
  const revenue = delivered.reduce((s, o) => s + o.final_amount, 0);

  const kpi: OrdersPageKPI = {
    totalOrders:      orders.length,
    delivered:        delivered.length,
    cancelled:        cancelled.length,
    pending:          inProgress.length,
    cancellationRate: round2(cancelled.length / (orders.length || 1)),
    avgOrderValue:    round2(revenue / (delivered.length || 1)),
  };

  // ── Over time (monthly) ──
  const monthMap = new Map<string, { orders: number; revenue: number }>();
  for (const o of orders) {
    const d = new Date(o.order_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap.has(key)) monthMap.set(key, { orders: 0, revenue: 0 });
    const e = monthMap.get(key)!;
    e.orders += 1;
    if (o.order_status === 'Delivered') e.revenue += o.final_amount;
  }
  const overTime: OrdersOverTime[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([key, val]) => {
      const [yr, mo] = key.split('-');
      return { name: `${MONTHS[Number(mo) - 1]} ${yr}`, orders: val.orders, revenue: Math.round(val.revenue) };
    });

  // ── By status ──
  const statusMap = new Map<string, number>();
  for (const o of orders) statusMap.set(o.order_status, (statusMap.get(o.order_status) ?? 0) + 1);
  const byStatus = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count, share: round2(count / (orders.length || 1)) }))
    .sort((a, b) => b.count - a.count);

  // ── By category ──
  const catMap = new Map<string, { orders: number; revenue: number }>();
  for (const o of orders) {
    if (!catMap.has(o.food_category)) catMap.set(o.food_category, { orders: 0, revenue: 0 });
    const e = catMap.get(o.food_category)!;
    e.orders += 1;
    if (o.order_status === 'Delivered') e.revenue += o.final_amount;
  }
  const byCategory = Array.from(catMap.entries())
    .map(([cat, v]) => ({ category: cat, orders: v.orders, revenue: Math.round(v.revenue) }))
    .sort((a, b) => b.orders - a.orders);

  // ── By city ──
  const cityMap = new Map<string, { orders: number; revenue: number }>();
  for (const o of orders) {
    if (!cityMap.has(o.city)) cityMap.set(o.city, { orders: 0, revenue: 0 });
    const e = cityMap.get(o.city)!;
    e.orders += 1;
    if (o.order_status === 'Delivered') e.revenue += o.final_amount;
  }
  const byCity: OrdersByCityRow[] = Array.from(cityMap.entries())
    .map(([city, v]) => ({
      city, orders: v.orders, revenue: Math.round(v.revenue),
      share: round2(v.orders / (orders.length || 1)),
    }))
    .sort((a, b) => b.orders - a.orders);

  // ── By payment ──
  const payMap = new Map<string, number>();
  for (const o of orders) payMap.set(o.payment_method, (payMap.get(o.payment_method) ?? 0) + 1);
  const byPayment = Array.from(payMap.entries())
    .map(([method, count]) => ({ method, count, share: round2(count / (orders.length || 1)) }))
    .sort((a, b) => b.count - a.count);

  // ── By day of week ──
  const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dowArr = DOW.map((d) => ({ day: d, orders: 0 }));
  for (const o of orders) { const dw = new Date(o.order_date).getDay(); dowArr[dw].orders += 1; }

  // ── By hour ──
  const hourArr = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0 }));
  for (const o of orders) { const h = parseInt(o.order_time.split(':')[0], 10); hourArr[h].orders += 1; }

  return { kpi, overTime, byStatus, byCategory, byCity, byPayment, byDow: dowArr, byHour: hourArr, orders };
}

// ─── Restaurants Page aggregations ──────────────────────────────────────────

export interface RestaurantRow {
  restaurant_id:      string;
  restaurant_name:    string;
  cuisine:            string;
  city:               string;
  area:               string;
  status:             string;
  totalOrders:        number;
  deliveredOrders:    number;
  cancelledOrders:    number;
  revenue:            number;
  aov:                number;   // average order value (delivered)
  rating:             number;
  avgDeliveryTime:    number;
  cancellationRate:   number;
}

export interface RestaurantsPageKPI {
  totalRestaurants:  number;
  activeRestaurants: number;
  avgRating:         number;
  avgDeliveryTime:   number;
  totalRevenue:      number;
}

/**
 * Build per-restaurant rows from the filtered order slice.
 * All metrics are computed from actual orders, not the pre-computed restaurant fields.
 */
export function getRestaurantsPageData(orders: Order[], allRestaurants: Restaurant[]) {
  // Aggregate from order-level data
  const map = new Map<string, {
    name: string; cuisine: string; city: string; area: string; status: string;
    totalOrders: number; deliveredOrders: number; cancelledOrders: number;
    revenue: number; deliveryTimes: number[]; ratings: number[];
  }>();

  // Seed with restaurant master so every restaurant appears (even with 0 orders in slice)
  for (const r of allRestaurants) {
    map.set(r.restaurant_id, {
      name: r.restaurant_name, cuisine: r.cuisine, city: r.city, area: r.area, status: r.status,
      totalOrders: 0, deliveredOrders: 0, cancelledOrders: 0,
      revenue: 0, deliveryTimes: [], ratings: [],
    });
  }

  for (const o of orders) {
    const e = map.get(o.restaurant_id);
    if (!e) continue;
    e.totalOrders += 1;
    if (o.order_status === 'Delivered') {
      e.deliveredOrders += 1;
      e.revenue += o.final_amount;
      e.deliveryTimes.push(o.delivery_time_minutes);
      if (o.rating !== null) e.ratings.push(o.rating as number);
    }
    if (o.order_status === 'Cancelled') e.cancelledOrders += 1;
  }

  const rows: RestaurantRow[] = Array.from(map.entries()).map(([id, v]) => ({
    restaurant_id:    id,
    restaurant_name:  v.name,
    cuisine:          v.cuisine,
    city:             v.city,
    area:             v.area,
    status:           v.status,
    totalOrders:      v.totalOrders,
    deliveredOrders:  v.deliveredOrders,
    cancelledOrders:  v.cancelledOrders,
    revenue:          Math.round(v.revenue),
    aov:              v.deliveredOrders > 0 ? round2(v.revenue / v.deliveredOrders) : 0,
    rating:           v.ratings.length > 0 ? round2(v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length) : 0,
    avgDeliveryTime:  v.deliveryTimes.length > 0 ? round2(v.deliveryTimes.reduce((a, b) => a + b, 0) / v.deliveryTimes.length) : 0,
    cancellationRate: v.totalOrders > 0 ? round2(v.cancelledOrders / v.totalOrders) : 0,
  }));

  // Only include restaurants that appear in the filtered slice (or have > 0 global orders)
  const visibleRows = rows.filter((r) => r.totalOrders > 0);

  const kpi: RestaurantsPageKPI = {
    totalRestaurants:  visibleRows.length,
    activeRestaurants: visibleRows.filter((r) => r.status === 'Active').length,
    avgRating:         round2(visibleRows.reduce((s, r) => s + r.rating, 0) / (visibleRows.length || 1)),
    avgDeliveryTime:   round2(visibleRows.reduce((s, r) => s + r.avgDeliveryTime, 0) / (visibleRows.length || 1)),
    totalRevenue:      visibleRows.reduce((s, r) => s + r.revenue, 0),
  };

  return { kpi, rows: visibleRows };
}
