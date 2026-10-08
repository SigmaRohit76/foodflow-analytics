/**
 * ─── FoodFlow Analytics — Insights Service ───────────────────────────────────
 *
 * Generates dynamic, data-driven business insights from the filtered order slice.
 * EVERY statement is calculated from the real dataset — nothing is hardcoded.
 * Respects the active global filter state.
 */

import type { Order } from '../types';

export interface Insight {
  id: string;
  type: 'positive' | 'negative' | 'neutral' | 'warning';
  category: 'revenue' | 'orders' | 'delivery' | 'customers' | 'restaurants' | 'ratings' | 'cancellations' | 'timing';
  title: string;
  body: string;
  metric?: string;   // primary metric value (e.g. "₹4.2L")
  delta?: string;    // optional change indicator (e.g. "+12%")
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inr(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function topByValue<K extends string>(
  map: Map<K, number>,
  n: number,
  desc = true
): [K, number][] {
  return [...map.entries()].sort(([, a], [, b]) => desc ? b - a : a - b).slice(0, n);
}

const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ─── Main insight generator ───────────────────────────────────────────────────

export function generateInsights(orders: Order[]): Insight[] {
  if (orders.length < 10) return [];

  const insights: Insight[] = [];

  const delivered   = orders.filter(o => o.order_status === 'Delivered');
  const cancelled   = orders.filter(o => o.order_status === 'Cancelled');
  const rated       = delivered.filter(o => o.rating !== null);

  const totalRevenue    = delivered.reduce((s, o) => s + o.final_amount, 0);
  const totalOrders     = orders.length;
  const cancelRate      = totalOrders ? cancelled.length / totalOrders : 0;
  const avgRating       = avg(rated.map(o => o.rating as number));
  const avgDeliveryTime = avg(delivered.map(o => o.delivery_time_minutes));
  const aov             = delivered.length ? totalRevenue / delivered.length : 0;

  // ── 1. Top revenue-generating restaurant ───────────────────────────────────
  const revenueByRest = new Map<string, number>();
  const ordersByRest  = new Map<string, number>();
  for (const o of delivered) {
    revenueByRest.set(o.restaurant_name, (revenueByRest.get(o.restaurant_name) ?? 0) + o.final_amount);
    ordersByRest.set(o.restaurant_name, (ordersByRest.get(o.restaurant_name) ?? 0) + 1);
  }
  const topRestByRev = topByValue(revenueByRest, 1);
  if (topRestByRev.length) {
    const [name, rev] = topRestByRev[0];
    const ordCount = ordersByRest.get(name) ?? 0;
    insights.push({
      id: 'top-restaurant-revenue',
      type: 'positive',
      category: 'restaurants',
      title: 'Top Revenue Restaurant',
      body: `${name} is the highest-earning restaurant with ${inr(rev)} across ${ordCount.toLocaleString('en-IN')} delivered orders.`,
      metric: inr(rev),
    });
  }

  // ── 2. Top city by orders ──────────────────────────────────────────────────
  const ordersByCity = new Map<string, number>();
  const revenueByCity = new Map<string, number>();
  for (const o of delivered) {
    ordersByCity.set(o.city, (ordersByCity.get(o.city) ?? 0) + 1);
    revenueByCity.set(o.city, (revenueByCity.get(o.city) ?? 0) + o.final_amount);
  }
  const topCity = topByValue(ordersByCity, 1);
  if (topCity.length) {
    const [city, cnt] = topCity[0];
    const cityRev = revenueByCity.get(city) ?? 0;
    const cityShare = delivered.length ? cnt / delivered.length : 0;
    insights.push({
      id: 'top-city-orders',
      type: 'neutral',
      category: 'orders',
      title: 'Busiest City',
      body: `${city} leads all cities with ${cnt.toLocaleString('en-IN')} delivered orders (${pct(cityShare)} of total) generating ${inr(cityRev)}.`,
      metric: city,
    });
  }

  // ── 3. Top food category by revenue ───────────────────────────────────────
  const revenueByCategory = new Map<string, number>();
  for (const o of delivered) {
    revenueByCategory.set(o.food_category, (revenueByCategory.get(o.food_category) ?? 0) + o.final_amount);
  }
  const topCategory = topByValue(revenueByCategory, 1);
  if (topCategory.length) {
    const [cat, rev] = topCategory[0];
    const catShare = totalRevenue ? rev / totalRevenue : 0;
    insights.push({
      id: 'top-category-revenue',
      type: 'positive',
      category: 'revenue',
      title: 'Top Revenue Category',
      body: `${cat} is the highest-revenue food category, contributing ${inr(rev)} (${pct(catShare)} of total revenue).`,
      metric: pct(catShare),
    });
  }

  // ── 4. Cancellation rate health ───────────────────────────────────────────
  const cancelInsightType = cancelRate > 0.15 ? 'negative' : cancelRate > 0.08 ? 'warning' : 'positive';
  insights.push({
    id: 'cancellation-rate',
    type: cancelInsightType,
    category: 'cancellations',
    title: cancelRate > 0.15 ? 'High Cancellation Rate' : cancelRate > 0.08 ? 'Moderate Cancellation Rate' : 'Healthy Cancellation Rate',
    body: cancelRate > 0.15
      ? `${pct(cancelRate)} of orders are cancelled — significantly above the 15% threshold. Focus on improving restaurant availability and delivery estimates.`
      : cancelRate > 0.08
      ? `${pct(cancelRate)} cancellation rate is slightly elevated. Monitor top-cancelling restaurants and cities for action.`
      : `Cancellation rate is a healthy ${pct(cancelRate)} across ${cancelled.length.toLocaleString('en-IN')} cancelled orders.`,
    metric: pct(cancelRate),
  });

  // ── 5. City with highest cancellation rate (highlight problem areas) ───────
  const cancelByCity = new Map<string, { total: number; cancelled: number }>();
  for (const o of orders) {
    if (!cancelByCity.has(o.city)) cancelByCity.set(o.city, { total: 0, cancelled: 0 });
    const d = cancelByCity.get(o.city)!;
    d.total++;
    if (o.order_status === 'Cancelled') d.cancelled++;
  }
  const worstCancelCity = [...cancelByCity.entries()]
    .filter(([, d]) => d.total >= 20)
    .map(([city, d]) => ({ city, rate: d.cancelled / d.total }))
    .sort((a, b) => b.rate - a.rate)[0];
  if (worstCancelCity && worstCancelCity.rate > cancelRate * 1.3) {
    insights.push({
      id: 'worst-cancel-city',
      type: 'warning',
      category: 'cancellations',
      title: 'Highest Cancellation City',
      body: `${worstCancelCity.city} has a ${pct(worstCancelCity.rate)} cancellation rate — ${((worstCancelCity.rate / cancelRate - 1) * 100).toFixed(0)}% above average. Investigate restaurant reliability in this city.`,
      metric: pct(worstCancelCity.rate),
    });
  }

  // ── 6. Average rating health ──────────────────────────────────────────────
  const ratingType = avgRating >= 4.2 ? 'positive' : avgRating >= 3.8 ? 'neutral' : 'negative';
  insights.push({
    id: 'avg-rating',
    type: ratingType,
    category: 'ratings',
    title: avgRating >= 4.2 ? 'Excellent Customer Ratings' : avgRating >= 3.8 ? 'Good Customer Ratings' : 'Ratings Need Attention',
    body: avgRating >= 4.2
      ? `Average order rating is ${avgRating.toFixed(2)}/5 across ${rated.length.toLocaleString('en-IN')} rated deliveries — customers are highly satisfied.`
      : avgRating >= 3.8
      ? `Average rating is ${avgRating.toFixed(2)}/5 — solid performance with room to improve. Focus on slow-delivery restaurants.`
      : `Average rating of ${avgRating.toFixed(2)}/5 is below expectations. Long delivery times and order accuracy may be impacting satisfaction.`,
    metric: `${avgRating.toFixed(2)} / 5`,
  });

  // ── 7. Delivery time health ────────────────────────────────────────────────
  const onTimeCount  = delivered.filter(o => o.delivery_time_minutes <= 45).length;
  const lateCount    = delivered.filter(o => o.delivery_time_minutes > 60).length;
  const onTimePct    = delivered.length ? onTimeCount / delivered.length : 0;
  const latePct      = delivered.length ? lateCount   / delivered.length : 0;
  const delType      = avgDeliveryTime <= 35 ? 'positive' : avgDeliveryTime <= 50 ? 'neutral' : 'warning';
  insights.push({
    id: 'delivery-time',
    type: delType,
    category: 'delivery',
    title: `${pct(onTimePct)} On-Time Delivery Rate`,
    body: `Average delivery time is ${Math.round(avgDeliveryTime)} min. ${pct(onTimePct)} of orders arrive within 45 min; ${pct(latePct)} exceed 60 min and may be hurting ratings.`,
    metric: `${Math.round(avgDeliveryTime)} min`,
  });

  // ── 8. Slowest city ────────────────────────────────────────────────────────
  const delivTimeByCity = new Map<string, number[]>();
  for (const o of delivered) {
    if (!delivTimeByCity.has(o.city)) delivTimeByCity.set(o.city, []);
    delivTimeByCity.get(o.city)!.push(o.delivery_time_minutes);
  }
  const cityAvgTimes = [...delivTimeByCity.entries()]
    .filter(([, times]) => times.length >= 10)
    .map(([city, times]) => ({ city, avg: avg(times) }))
    .sort((a, b) => b.avg - a.avg);
  if (cityAvgTimes.length >= 2) {
    const slowCity = cityAvgTimes[0];
    const fastCity = cityAvgTimes[cityAvgTimes.length - 1];
    insights.push({
      id: 'delivery-city-gap',
      type: 'warning',
      category: 'delivery',
      title: 'Delivery Time Gap Across Cities',
      body: `${slowCity.city} has the slowest avg delivery (${Math.round(slowCity.avg)} min) vs ${fastCity.city} at ${Math.round(fastCity.avg)} min — a ${Math.round(slowCity.avg - fastCity.avg)}-min gap. Logistics improvements needed in ${slowCity.city}.`,
      metric: `${Math.round(slowCity.avg)} min`,
    });
  }

  // ── 9. Slowest restaurant (among popular ones) ─────────────────────────────
  const delivTimeByRest = new Map<string, number[]>();
  for (const o of delivered) {
    if (!delivTimeByRest.has(o.restaurant_name)) delivTimeByRest.set(o.restaurant_name, []);
    delivTimeByRest.get(o.restaurant_name)!.push(o.delivery_time_minutes);
  }
  const slowRestaurants = [...delivTimeByRest.entries()]
    .filter(([, times]) => times.length >= 15)
    .map(([name, times]) => ({ name, avgTime: avg(times), count: times.length }))
    .sort((a, b) => b.avgTime - a.avgTime)
    .slice(0, 1);
  if (slowRestaurants.length && slowRestaurants[0].avgTime > avgDeliveryTime * 1.25) {
    const r = slowRestaurants[0];
    insights.push({
      id: 'slowest-restaurant',
      type: 'negative',
      category: 'delivery',
      title: 'Slowest Popular Restaurant',
      body: `${r.name} averages ${Math.round(r.avgTime)} min delivery — ${Math.round(r.avgTime - avgDeliveryTime)} min above the overall average across ${r.count} deliveries. Consider operational review.`,
      metric: `${Math.round(r.avgTime)} min`,
    });
  }

  // ── 10. Busiest day of week ────────────────────────────────────────────────
  const ordersByDow = new Map<number, number>();
  for (const o of orders) {
    const d = new Date(o.order_date).getDay();
    ordersByDow.set(d, (ordersByDow.get(d) ?? 0) + 1);
  }
  const topDow = [...ordersByDow.entries()].sort(([, a], [, b]) => b - a)[0];
  const bottomDow = [...ordersByDow.entries()].sort(([, a], [, b]) => a - b)[0];
  if (topDow && bottomDow) {
    const topCnt    = topDow[1];
    const bottomCnt = bottomDow[1];
    const lift      = bottomCnt > 0 ? ((topCnt / bottomCnt - 1) * 100).toFixed(0) : '—';
    insights.push({
      id: 'busiest-day',
      type: 'neutral',
      category: 'timing',
      title: `${DAY_NAMES[topDow[0]]} is the Busiest Day`,
      body: `${DAY_NAMES[topDow[0]]} sees ${topCnt.toLocaleString('en-IN')} orders — ${lift}% more than ${DAY_SHORT[bottomDow[0]]}, the quietest day (${bottomCnt.toLocaleString('en-IN')} orders).`,
      metric: DAY_SHORT[topDow[0]],
    });
  }

  // ── 11. Busiest hour ───────────────────────────────────────────────────────
  const ordersByHour = new Map<number, number>();
  for (const o of orders) {
    const h = parseInt(o.order_time.split(':')[0], 10);
    ordersByHour.set(h, (ordersByHour.get(h) ?? 0) + 1);
  }
  const topHour   = [...ordersByHour.entries()].sort(([, a], [, b]) => b - a)[0];
  if (topHour) {
    const h = topHour[0];
    const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
    insights.push({
      id: 'busiest-hour',
      type: 'neutral',
      category: 'timing',
      title: `Peak Hour: ${label}`,
      body: `The busiest ordering hour is ${label} with ${topHour[1].toLocaleString('en-IN')} orders. Ensure restaurant and delivery capacity is optimised for this window.`,
      metric: label,
    });
  }

  // ── 12. Revenue trend (compare first vs last third of period) ──────────────
  if (orders.length >= 30) {
    const sorted = [...orders].sort((a, b) => a.order_date.localeCompare(b.order_date));
    const third  = Math.floor(sorted.length / 3);
    const firstThird = sorted.slice(0, third).filter(o => o.order_status === 'Delivered');
    const lastThird  = sorted.slice(sorted.length - third).filter(o => o.order_status === 'Delivered');
    const revFirst = firstThird.reduce((s, o) => s + o.final_amount, 0);
    const revLast  = lastThird.reduce((s, o) => s + o.final_amount, 0);
    if (revFirst > 0) {
      const changePct = ((revLast - revFirst) / revFirst) * 100;
      const isGrowing = changePct > 5;
      const isDeclining = changePct < -5;
      insights.push({
        id: 'revenue-trend',
        type: isGrowing ? 'positive' : isDeclining ? 'negative' : 'neutral',
        category: 'revenue',
        title: isGrowing ? 'Revenue Trending Up' : isDeclining ? 'Revenue Declining' : 'Revenue Stable',
        body: isGrowing
          ? `Revenue in the most recent third of this period (${inr(revLast)}) is ${changePct.toFixed(0)}% higher than the earliest third (${inr(revFirst)}) — strong growth momentum.`
          : isDeclining
          ? `Revenue has declined ${Math.abs(changePct).toFixed(0)}% from ${inr(revFirst)} in the early period to ${inr(revLast)} recently. Investigate whether pricing, competition or seasonality is the cause.`
          : `Revenue is stable across the period (${inr(revFirst)} early → ${inr(revLast)} recent, ${changePct >= 0 ? '+' : ''}${changePct.toFixed(0)}%).`,
        metric: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(0)}%`,
        delta: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(0)}%`,
      });
    }
  }

  // ── 13. Average order value insight ───────────────────────────────────────
  if (delivered.length > 0) {
    const aovType = aov >= 400 ? 'positive' : aov >= 250 ? 'neutral' : 'warning';
    insights.push({
      id: 'aov-insight',
      type: aovType,
      category: 'revenue',
      title: `AOV: ${inr(Math.round(aov))} Per Order`,
      body: aov >= 400
        ? `Strong average order value of ${inr(Math.round(aov))}. Premium and multi-item orders are driving healthy basket sizes.`
        : `Average order value is ${inr(Math.round(aov))}. Consider bundling, upsell or free-delivery-above-threshold strategies to grow this metric.`,
      metric: inr(Math.round(aov)),
    });
  }

  // ── 14. Unique customers vs orders — retention signal ─────────────────────
  const uniqueCustomers = new Set(orders.map(o => o.customer_id)).size;
  const ordersPerCustomer = uniqueCustomers > 0 ? totalOrders / uniqueCustomers : 0;
  if (ordersPerCustomer >= 2) {
    insights.push({
      id: 'repeat-customers',
      type: 'positive',
      category: 'customers',
      title: 'Strong Customer Retention',
      body: `Customers average ${ordersPerCustomer.toFixed(1)} orders each in this period across ${uniqueCustomers.toLocaleString('en-IN')} unique customers — a good indicator of repeat usage.`,
      metric: `${ordersPerCustomer.toFixed(1)}×`,
    });
  } else if (ordersPerCustomer > 0) {
    insights.push({
      id: 'low-repeat',
      type: 'warning',
      category: 'customers',
      title: 'Low Repeat Order Rate',
      body: `With ${ordersPerCustomer.toFixed(1)} orders per customer, most ${uniqueCustomers.toLocaleString('en-IN')} customers ordered only once. Loyalty programmes or re-engagement campaigns could improve retention.`,
      metric: `${ordersPerCustomer.toFixed(1)}×`,
    });
  }

  // ── 15. Top payment method ─────────────────────────────────────────────────
  const ordersByPayment = new Map<string, number>();
  for (const o of orders) {
    ordersByPayment.set(o.payment_method, (ordersByPayment.get(o.payment_method) ?? 0) + 1);
  }
  const topPayment = topByValue(ordersByPayment, 1);
  if (topPayment.length) {
    const [method, count] = topPayment[0];
    const payShare = totalOrders ? count / totalOrders : 0;
    insights.push({
      id: 'top-payment',
      type: 'neutral',
      category: 'revenue',
      title: `${method} Dominates Payments`,
      body: `${method} is used for ${pct(payShare)} of all orders (${count.toLocaleString('en-IN')} orders). Ensuring ${method} reliability is critical for business continuity.`,
      metric: pct(payShare),
    });
  }

  // Return max 10 most actionable insights, sorted by type priority
  const priority: Record<string, number> = { negative: 0, warning: 1, positive: 2, neutral: 3 };
  return insights.sort((a, b) => priority[a.type] - priority[b.type]).slice(0, 12);
}
