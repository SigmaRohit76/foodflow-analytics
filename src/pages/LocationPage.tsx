import { useMemo } from 'react';
import {
  MapPin, TrendingUp, DollarSign, ShoppingBag, Star, MousePointerClick,
} from 'lucide-react';
import {
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { KPICard } from '../components/KPICard';
import { GlobalFilterBar } from '../components/GlobalFilterBar';
import { applyFilters, getRawOrders, getRawRestaurants } from '../services/dataService';
import { useFilters, toDashboardFilters, useFilterDispatch } from '../context/FilterContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inr(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}
const fv = (v: unknown) => v as number;

const TICK = { fontSize: 11, fill: 'var(--text-secondary)' };
const TS: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border)',
  borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', padding: '8px 12px',
};
const TL: React.CSSProperties = { color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 };
const C = ['#1d4ed8','#10b981','#f59e0b','#ef4444','#6366f1','#ec4899','#14b8a6','#f97316','#8b5cf6','#06b6d4'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-body">
        <div style={{ marginBottom: 12 }}>
          <div className="section-title">{title}</div>
          {subtitle && <div className="section-subtitle">{subtitle}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LocationPage() {
  const filters       = useFilters();
  const dfFilters     = toDashboardFilters(filters);
  const dispatch      = useFilterDispatch();
  const allOrders     = useMemo(() => getRawOrders(), []);
  const allRestaurants = useMemo(() => getRawRestaurants(), []);
  const filtered      = useMemo(() => applyFilters(allOrders, dfFilters), [allOrders, dfFilters]);

  // Active city filters (so we can highlight selected cards)
  const activeCities = filters.cities ?? [];

  // ── Restaurant count per city ─────────────────────────────────────────────
  const restaurantsByCity = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of allRestaurants) {
      map[r.city] = (map[r.city] ?? 0) + 1;
    }
    return map;
  }, [allRestaurants]);

  // ── Per-city aggregations ─────────────────────────────────────────────────
  const cityData = useMemo(() => {
    type CityAcc = {
      orders: number; revenue: number; delivered: number; cancelled: number;
      deliveryTimes: number[]; ratings: number[]; customers: Set<string>;
    };
    const map: Record<string, CityAcc> = {};

    for (const o of filtered) {
      if (!map[o.city]) map[o.city] = { orders: 0, revenue: 0, delivered: 0, cancelled: 0, deliveryTimes: [], ratings: [], customers: new Set() };
      const c = map[o.city];
      c.orders++;
      c.customers.add(o.customer_id);
      if (o.order_status === 'Delivered') {
        c.revenue += o.final_amount;
        c.delivered++;
        c.deliveryTimes.push(o.delivery_time_minutes);
        if (o.rating !== null) c.ratings.push(o.rating);
      }
      if (o.order_status === 'Cancelled') c.cancelled++;
    }

    const avg  = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const totalRev = Object.values(map).reduce((s, d) => s + d.revenue, 0);

    return Object.entries(map)
      .map(([city, d]) => ({
        city,
        orders:           d.orders,
        revenue:          Math.round(d.revenue),
        customers:        d.customers.size,
        restaurants:      restaurantsByCity[city] ?? 0,
        deliveryRate:     d.orders ? d.delivered / d.orders : 0,
        cancellationRate: d.orders ? d.cancelled / d.orders : 0,
        avgDeliveryTime:  Math.round(avg(d.deliveryTimes)),
        avgRating:        avg(d.ratings),
        revenueShare:     totalRev ? d.revenue / totalRev : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered, restaurantsByCity]);

  // ── Per-area top 15 ───────────────────────────────────────────────────────
  const areaData = useMemo(() => {
    const map: Record<string, { city: string; orders: number; revenue: number }> = {};
    for (const o of filtered) {
      const key = `${o.city} – ${o.area}`;
      if (!map[key]) map[key] = { city: o.city, orders: 0, revenue: 0 };
      map[key].orders++;
      if (o.order_status === 'Delivered') map[key].revenue += o.final_amount;
    }
    return Object.entries(map)
      .map(([area, d]) => ({ area, city: d.city, orders: d.orders, revenue: Math.round(d.revenue) }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 15);
  }, [filtered]);

  // ── Page-level KPIs ───────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const totalOrders  = cityData.reduce((s, c) => s + c.orders, 0);
    const totalRevenue = cityData.reduce((s, c) => s + c.revenue, 0);
    const totalCust    = new Set(filtered.map(o => o.customer_id)).size;
    const topCity      = cityData[0]?.city ?? '—';
    const weightedRating = cityData.length
      ? cityData.reduce((s, c) => s + c.avgRating * c.orders, 0) /
        Math.max(1, cityData.reduce((s, c) => s + c.orders, 0))
      : 0;
    const totalRestaurants = new Set(allRestaurants.map(r => r.restaurant_id)).size;
    return { totalOrders, totalRevenue, totalCust, topCity, weightedRating, totalRestaurants };
  }, [cityData, filtered, allRestaurants]);

  // ── Radar: normalised city comparison ────────────────────────────────────
  const radarData = useMemo(() => {
    const top5 = cityData.slice(0, 5);
    const maxOrders  = Math.max(...top5.map(c => c.orders))  || 1;
    const maxRevenue = Math.max(...top5.map(c => c.revenue)) || 1;
    const maxCust    = Math.max(...top5.map(c => c.customers)) || 1;
    return top5.map(c => ({
      city:         c.city,
      Orders:       Math.round((c.orders    / maxOrders)  * 100),
      Revenue:      Math.round((c.revenue   / maxRevenue) * 100),
      Customers:    Math.round((c.customers / maxCust)    * 100),
      DeliveryRate: Math.round(c.deliveryRate  * 100),
      Rating:       Math.round((c.avgRating / 5) * 100),
    }));
  }, [cityData]);

  // ── Monthly orders stacked by top 5 cities ────────────────────────────────
  const TOP_CITIES = useMemo(() => cityData.slice(0, 5).map(c => c.city), [cityData]);
  const monthlyByCity = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const o of filtered) {
      if (!TOP_CITIES.includes(o.city)) continue;
      const d   = new Date(o.order_date);
      const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      if (!map[key]) map[key] = {};
      map[key][o.city] = (map[key][o.city] ?? 0) + 1;
    }
    return Object.entries(map)
      .sort(([a], [b]) => {
        const parse = (s: string) => { const [m, y] = s.split(' '); return parseInt(y) * 12 + MONTH_NAMES.indexOf(m); };
        return parse(a) - parse(b);
      })
      .map(([month, counts]) => ({ month, ...counts }));
  }, [filtered, TOP_CITIES]);

  // ── Category mix by top 3 cities ─────────────────────────────────────────
  const TOP3 = useMemo(() => cityData.slice(0, 3).map(c => c.city), [cityData]);
  const catsByCity = useMemo(() => {
    const cats = ['Biryani','North Indian','South Indian','Chinese','Fast Food','Pizza','Desserts','Beverages','Street Food'];
    const map: Record<string, Record<string, number>> = {};
    for (const cat of cats) map[cat] = {};
    for (const o of filtered) {
      if (!TOP3.includes(o.city) || !map[o.food_category]) continue;
      map[o.food_category][o.city] = (map[o.food_category][o.city] ?? 0) + 1;
    }
    return cats.map(cat => ({ category: cat, ...map[cat] }));
  }, [filtered, TOP3]);

  // ── City click: toggle city filter ───────────────────────────────────────
  function handleCityClick(city: string) {
    dispatch.toggleCity(city);
  }

  return (
    <div className="page-container">
      <GlobalFilterBar matchingCount={filtered.length} totalCount={allOrders.length} />

      {/* ── 5 KPI cards ── */}
      <div className="kpi-grid">
        <KPICard label="Cities Active"     value={cityData.length.toString()}
          subValue={`top: ${kpi.topCity}`}
          icon={<MapPin size={18}/>} iconBg="#eff6ff" iconColor="#1d4ed8"
          comparisonLabel="cities with orders in period" />
        <KPICard label="Total Orders"      value={kpi.totalOrders.toLocaleString('en-IN')}
          subValue="across all cities"
          icon={<ShoppingBag size={18}/>} iconBg="#f0fdf4" iconColor="#10b981"
          comparisonLabel="all statuses included" />
        <KPICard label="Total Revenue"     value={inr(kpi.totalRevenue)}
          subValue="net of discounts"
          icon={<DollarSign size={18}/>} iconBg="#fefce8" iconColor="#ca8a04"
          comparisonLabel="delivered orders only" />
        <KPICard label="Unique Customers"  value={kpi.totalCust.toLocaleString('en-IN')}
          subValue="in selected period"
          icon={<TrendingUp size={18}/>} iconBg="#fff7ed" iconColor="#ea580c"
          comparisonLabel="customers who placed ≥1 order" />
        <KPICard label="Avg Rating"        value={kpi.weightedRating.toFixed(2)}
          subValue="weighted by orders"
          icon={<Star size={18}/>} iconBg="#faf5ff" iconColor="#7c3aed"
          comparisonLabel="across all delivered orders" />
      </div>

      {/* ── Clickable city cards ── */}
      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>City Overview</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <MousePointerClick size={12} /> Click a city card to filter the dashboard
            </span>
            {activeCities.length > 0 && (
              <button onClick={() => activeCities.forEach(c => dispatch.toggleCity(c))}
                style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                Clear city filter
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {cityData.map((c, i) => {
              const isActive = activeCities.includes(c.city);
              return (
                <div key={c.city} onClick={() => handleCityClick(c.city)}
                  style={{
                    padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${isActive ? C[i % C.length] : 'var(--border)'}`,
                    background: isActive ? C[i % C.length] + '12' : 'var(--bg-surface)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: C[i % C.length], flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 13, color: isActive ? C[i % C.length] : 'var(--text-primary)' }}>{c.city}</span>
                    {isActive && <span style={{ marginLeft: 'auto', fontSize: 9, background: C[i % C.length], color: '#fff', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>ACTIVE</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', fontSize: 11 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Orders</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{c.orders.toLocaleString('en-IN')}</span>
                    <span style={{ color: 'var(--text-muted)' }}>Revenue</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{inr(c.revenue)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>Restaurants</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{c.restaurants}</span>
                    <span style={{ color: 'var(--text-muted)' }}>Avg Rating</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>⭐ {c.avgRating.toFixed(1)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>Avg Delivery</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{c.avgDeliveryTime} min</span>
                    <span style={{ color: 'var(--text-muted)' }}>Cancel Rate</span>
                    <span style={{ textAlign: 'right', fontWeight: 600, color: c.cancellationRate > 0.12 ? '#ef4444' : '#10b981' }}>
                      {(c.cancellationRate * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Charts row 1: orders + revenue ── */}
      <div className="charts-grid-2">
        <ChartCard title="Orders by City" subtitle="Total orders per city (click bars to filter)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart layout="vertical" data={cityData} margin={{ top: 4, right: 60, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={TICK} />
              <YAxis dataKey="city" type="category" tick={TICK} width={78} />
              <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown) => [fv(v).toLocaleString('en-IN'), 'Orders']} />
              <Bar dataKey="orders" radius={[0,4,4,0]} maxBarSize={26} cursor="pointer"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={(data: any) => handleCityClick(data.city)}>
                {cityData.map((d, i) => <Cell key={i} fill={activeCities.includes(d.city) ? C[i % C.length] : C[i % C.length] + 'aa'} />)}
                <LabelList dataKey="orders" position="right" style={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue by City" subtitle="Net revenue per city">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart layout="vertical" data={cityData} margin={{ top: 4, right: 80, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={TICK} tickFormatter={(v: number) => inr(v)} />
              <YAxis dataKey="city" type="category" tick={TICK} width={78} />
              <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown) => [inr(fv(v)), 'Revenue']} />
              <Bar dataKey="revenue" radius={[0,4,4,0]} maxBarSize={26} cursor="pointer"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={(data: any) => handleCityClick(data.city)}>
                {cityData.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                <LabelList dataKey="revenue" position="right" style={{ fontSize: 10, fill: 'var(--text-secondary)' }} formatter={(v: unknown) => inr(fv(v))} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Charts row 2: delivery time + avg rating ── */}
      <div className="charts-grid-2">
        <ChartCard title="Avg Delivery Time by City" subtitle="Minutes from order to delivery">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart layout="vertical" data={[...cityData].sort((a, b) => a.avgDeliveryTime - b.avgDeliveryTime)} margin={{ top: 4, right: 70, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={TICK} unit=" m" />
              <YAxis dataKey="city" type="category" tick={TICK} width={78} />
              <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown) => [`${fv(v)} min`, 'Avg Delivery']} />
              <Bar dataKey="avgDeliveryTime" radius={[0,4,4,0]} maxBarSize={26}>
                {[...cityData].sort((a, b) => a.avgDeliveryTime - b.avgDeliveryTime).map((d, i) => (
                  <Cell key={i} fill={d.avgDeliveryTime > 45 ? '#ef4444' : '#10b981'} />
                ))}
                <LabelList dataKey="avgDeliveryTime" position="right" style={{ fontSize: 10, fill: 'var(--text-secondary)' }} formatter={(v: unknown) => `${fv(v)}m`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Avg Rating by City" subtitle="Customer satisfaction per city">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart layout="vertical" data={[...cityData].sort((a, b) => b.avgRating - a.avgRating)} margin={{ top: 4, right: 60, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={TICK} domain={[3.5, 5]} />
              <YAxis dataKey="city" type="category" tick={TICK} width={78} />
              <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown) => [fv(v).toFixed(2), 'Avg Rating']} />
              <Bar dataKey="avgRating" radius={[0,4,4,0]} maxBarSize={26}>
                {[...cityData].sort((a, b) => b.avgRating - a.avgRating).map((d, i) => (
                  <Cell key={i} fill={d.avgRating >= 4.0 ? '#10b981' : d.avgRating >= 3.5 ? '#f59e0b' : '#ef4444'} />
                ))}
                <LabelList dataKey="avgRating" position="right" style={{ fontSize: 10, fill: 'var(--text-secondary)' }} formatter={(v: unknown) => fv(v).toFixed(2)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Charts row 3: cancel rate + restaurant count ── */}
      <div className="charts-grid-2">
        <ChartCard title="Cancellation Rate by City" subtitle="% of orders cancelled per city">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart layout="vertical" data={[...cityData].sort((a, b) => b.cancellationRate - a.cancellationRate)} margin={{ top: 4, right: 60, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={TICK} unit="%" tickFormatter={(v: number) => `${v}%`} />
              <YAxis dataKey="city" type="category" tick={TICK} width={78} />
              <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown) => [`${(fv(v) * 100).toFixed(1)}%`, 'Cancel Rate']} />
              <Bar dataKey="cancellationRate" radius={[0,4,4,0]} maxBarSize={26}
                // convert fraction → pct for display
              >
                {[...cityData].sort((a, b) => b.cancellationRate - a.cancellationRate).map((d, i) => (
                  <Cell key={i} fill={d.cancellationRate > 0.12 ? '#ef4444' : d.cancellationRate > 0.08 ? '#f59e0b' : '#10b981'} />
                ))}
                <LabelList dataKey="cancellationRate" position="right" style={{ fontSize: 10, fill: 'var(--text-secondary)' }} formatter={(v: unknown) => `${(fv(v) * 100).toFixed(1)}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Restaurant Count by City" subtitle="Number of restaurants operating in each city">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart layout="vertical" data={[...cityData].sort((a, b) => b.restaurants - a.restaurants)} margin={{ top: 4, right: 60, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={TICK} />
              <YAxis dataKey="city" type="category" tick={TICK} width={78} />
              <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown) => [fv(v), 'Restaurants']} />
              <Bar dataKey="restaurants" fill="#6366f1" radius={[0,4,4,0]} maxBarSize={26}>
                <LabelList dataKey="restaurants" position="right" style={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Monthly trend by top 5 cities ── */}
      <ChartCard title="Monthly Order Trend — Top 5 Cities" subtitle="Order volumes over time per city">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={monthlyByCity} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ ...TICK, fontSize: 10 }} interval={1} />
            <YAxis tick={TICK} />
            <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown, name: unknown) => [fv(v).toLocaleString('en-IN'), String(name)]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {TOP_CITIES.map((city, i) => (
              <Area key={city} type="monotone" dataKey={city} name={city} stackId="1"
                fill={C[i % C.length]} stroke={C[i % C.length]} fillOpacity={0.55} dot={false} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Radar + top areas ── */}
      <div className="charts-grid-2">
        <ChartCard title="City Comparison Radar" subtitle="Normalised scores — top 5 cities across 5 dimensions">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={[
              { dim: 'Orders',       ...Object.fromEntries(radarData.map(c => [c.city, c.Orders])) },
              { dim: 'Revenue',      ...Object.fromEntries(radarData.map(c => [c.city, c.Revenue])) },
              { dim: 'Customers',    ...Object.fromEntries(radarData.map(c => [c.city, c.Customers])) },
              { dim: 'Delivery',     ...Object.fromEntries(radarData.map(c => [c.city, c.DeliveryRate])) },
              { dim: 'Rating',       ...Object.fromEntries(radarData.map(c => [c.city, c.Rating])) },
            ]} margin={{ top: 8, right: 32, left: 32, bottom: 8 }}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="dim" tick={{ ...TICK, fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              {radarData.map((c, i) => (
                <Radar key={c.city} name={c.city} dataKey={c.city}
                  stroke={C[i % C.length]} fill={C[i % C.length]} fillOpacity={0.15} />
              ))}
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip contentStyle={TS} formatter={(v: unknown, name: unknown) => [`${fv(v)}/100`, String(name)]} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 15 Areas by Orders" subtitle="Most active delivery areas">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart layout="vertical" data={areaData} margin={{ top: 4, right: 60, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={TICK} />
              <YAxis dataKey="area" type="category" tick={{ ...TICK, fontSize: 10 }} width={120} />
              <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown) => [fv(v).toLocaleString('en-IN'), 'Orders']} />
              <Bar dataKey="orders" fill="#1d4ed8" radius={[0,4,4,0]} maxBarSize={16}>
                <LabelList dataKey="orders" position="right" style={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Category mix top 3 cities ── */}
      <ChartCard title={`Category Mix — Top 3 Cities (${TOP3.join(', ')})`} subtitle="Which categories are most popular per city">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={catsByCity} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="category" tick={{ ...TICK, fontSize: 10 }} />
            <YAxis tick={TICK} />
            <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown, name: unknown) => [fv(v).toLocaleString('en-IN'), String(name)]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {TOP3.map((city, i) => (
              <Bar key={city} dataKey={city} name={city} fill={C[i % C.length]} radius={[3,3,0,0]} maxBarSize={30} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Full city table ── */}
      <div className="card">
        <div className="card-body">
          <div className="section-title" style={{ marginBottom: 12 }}>City Performance Summary</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>City</th>
                  <th style={{ textAlign: 'right' }}>Orders</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                  <th style={{ textAlign: 'right' }}>Share</th>
                  <th style={{ textAlign: 'right' }}>Customers</th>
                  <th style={{ textAlign: 'right' }}>Restaurants</th>
                  <th style={{ textAlign: 'right' }}>Delivery Rate</th>
                  <th style={{ textAlign: 'right' }}>Cancel Rate</th>
                  <th style={{ textAlign: 'right' }}>Avg Delivery</th>
                  <th style={{ textAlign: 'right' }}>Avg Rating</th>
                </tr>
              </thead>
              <tbody>
                {cityData.map((row, i) => {
                  const isActive = activeCities.includes(row.city);
                  return (
                    <tr key={row.city} style={{ cursor: 'pointer', background: isActive ? C[i % C.length] + '0d' : undefined }}
                      onClick={() => handleCityClick(row.city)}>
                      <td>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C[i % C.length], marginRight: 8 }} />
                        <strong style={{ color: isActive ? C[i % C.length] : undefined }}>{row.city}</strong>
                        {isActive && <span style={{ marginLeft: 6, fontSize: 10, background: C[i % C.length], color: '#fff', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>✓</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>{row.orders.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right' }}><strong>{inr(row.revenue)}</strong></td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                          <div style={{ width: 40, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${row.revenueShare * 100}%`, background: C[i % C.length], borderRadius: 3 }} />
                          </div>
                          {(row.revenueShare * 100).toFixed(1)}%
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{row.customers.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right' }}>{row.restaurants}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ color: row.deliveryRate >= 0.85 ? '#10b981' : row.deliveryRate >= 0.7 ? '#f59e0b' : '#ef4444' }}>
                          {(row.deliveryRate * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ color: row.cancellationRate <= 0.08 ? '#10b981' : row.cancellationRate <= 0.15 ? '#f59e0b' : '#ef4444' }}>
                          {(row.cancellationRate * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{row.avgDeliveryTime} min</td>
                      <td style={{ textAlign: 'right' }}>⭐ {row.avgRating.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
