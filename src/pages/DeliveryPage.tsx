import { useMemo } from 'react';
import {
  Clock, Zap, TrendingUp, AlertTriangle, CheckCircle, Timer,
} from 'lucide-react';
import {
  BarChart, Bar, ComposedChart, Area, Line,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, LabelList, ReferenceLine,
} from 'recharts';
import { KPICard } from '../components/KPICard';
import { GlobalFilterBar } from '../components/GlobalFilterBar';
import { applyFilters, getRawOrders } from '../services/dataService';
import { useFilters, toDashboardFilters } from '../context/FilterContext';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const TICK = { fontSize: 11, fill: 'var(--text-secondary)' };
const TS: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border)',
  borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', padding: '8px 12px',
};
const TL: React.CSSProperties = { color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 };
const C = ['#1d4ed8','#10b981','#f59e0b','#ef4444','#6366f1','#ec4899','#14b8a6','#f97316','#8b5cf6','#06b6d4'];
const BUCKET_COLORS = ['#10b981','#34d399','#86efac','#fbbf24','#f97316','#ef4444','#b91c1c'];
const fv = (v: unknown) => v as number;

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function ChartCard({ title, subtitle, children, fullWidth }: {
  title: string; subtitle?: string; children: React.ReactNode; fullWidth?: boolean;
}) {
  return (
    <div className="card" style={fullWidth ? { gridColumn: '1 / -1' } : undefined}>
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

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DeliveryPage() {
  const filters   = useFilters();
  const dfFilters = toDashboardFilters(filters);
  const allOrders = useMemo(() => getRawOrders(), []);

  const filtered = useMemo(() => applyFilters(allOrders, dfFilters), [allOrders, dfFilters]);

  // ── Core KPI calculations ─────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const delivered = filtered.filter(o => o.order_status === 'Delivered');
    const times = delivered.map(o => o.delivery_time_minutes).filter(t => t > 0);
    if (!times.length) return {
      avg: 0, med: 0, fastest: 0, slowest: 0, onTimePct: 0, latePct: 0,
      onTime: 0, late: 0, fast: 0, total: 0,
      fastAvgRating: 0, slowAvgRating: 0,
    };
    const sorted = [...times].sort((a, b) => a - b);
    const avg    = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
    const med    = median(times);
    const fastest = sorted[0];
    const slowest = sorted[sorted.length - 1];
    const onTime  = times.filter(t => t <= 45).length;
    const late    = times.filter(t => t > 60).length;
    const fast    = times.filter(t => t <= 30).length;

    const fastRatings = delivered.filter(o => o.delivery_time_minutes <= 30 && o.rating !== null).map(o => o.rating as number);
    const slowRatings = delivered.filter(o => o.delivery_time_minutes > 60  && o.rating !== null).map(o => o.rating as number);
    const rAvg = (arr: number[]) => arr.length ? arr.reduce((s, r) => s + r, 0) / arr.length : 0;

    return {
      avg, med, fastest, slowest,
      onTimePct: onTime / times.length,
      latePct:   late   / times.length,
      onTime, late, fast, total: times.length,
      fastAvgRating: rAvg(fastRatings),
      slowAvgRating: rAvg(slowRatings),
    };
  }, [filtered]);

  // ── Time-bucket histogram ─────────────────────────────────────────────────
  const timeBuckets = useMemo(() => {
    const buckets = [
      { label: '0–20m',  min: 0,  max: 20,   count: 0 },
      { label: '21–30m', min: 21, max: 30,   count: 0 },
      { label: '31–40m', min: 31, max: 40,   count: 0 },
      { label: '41–50m', min: 41, max: 50,   count: 0 },
      { label: '51–60m', min: 51, max: 60,   count: 0 },
      { label: '61–75m', min: 61, max: 75,   count: 0 },
      { label: '75+m',   min: 76, max: 9999, count: 0 },
    ];
    for (const o of filtered) {
      if (o.order_status !== 'Delivered') continue;
      const t = o.delivery_time_minutes;
      for (const b of buckets) { if (t >= b.min && t <= b.max) { b.count++; break; } }
    }
    return buckets;
  }, [filtered]);

  // ── Monthly delivery-time trend ───────────────────────────────────────────
  const monthlyTrend = useMemo(() => {
    const map: Record<string, { total: number; count: number; onTime: number }> = {};
    for (const o of filtered) {
      if (o.order_status !== 'Delivered') continue;
      const d   = new Date(o.order_date);
      const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      if (!map[key]) map[key] = { total: 0, count: 0, onTime: 0 };
      map[key].total  += o.delivery_time_minutes;
      map[key].count++;
      if (o.delivery_time_minutes <= 45) map[key].onTime++;
    }
    return Object.entries(map)
      .sort(([a], [b]) => {
        const parse = (s: string) => { const [m, y] = s.split(' '); return parseInt(y) * 12 + MONTH_NAMES.indexOf(m); };
        return parse(a) - parse(b);
      })
      .map(([month, d]) => ({
        month,
        avgTime:    d.count ? Math.round(d.total / d.count) : 0,
        onTimePct:  d.count ? Math.round((d.onTime / d.count) * 100) : 0,
      }));
  }, [filtered]);

  // ── Hourly pattern ────────────────────────────────────────────────────────
  const hourlyData = useMemo(() => {
    const map: Record<number, { orders: number; total: number }> = {};
    for (let h = 0; h < 24; h++) map[h] = { orders: 0, total: 0 };
    for (const o of filtered) {
      if (o.order_status !== 'Delivered') continue;
      const h = parseInt(o.order_time.split(':')[0], 10);
      map[h].orders++;
      map[h].total += o.delivery_time_minutes;
    }
    return Array.from({ length: 24 }, (_, h) => ({
      hour:    `${String(h).padStart(2, '0')}:00`,
      orders:  map[h].orders,
      avgTime: map[h].orders ? Math.round(map[h].total / map[h].orders) : 0,
    }));
  }, [filtered]);

  // ── Day-of-week performance ───────────────────────────────────────────────
  const dailyPerf = useMemo(() => {
    const map: Record<string, { total: number; count: number; onTime: number; late: number }> = {};
    for (const d of DAY_NAMES) map[d] = { total: 0, count: 0, onTime: 0, late: 0 };
    for (const o of filtered) {
      if (o.order_status !== 'Delivered') continue;
      const day = DAY_NAMES[new Date(o.order_date).getDay()];
      map[day].total += o.delivery_time_minutes;
      map[day].count++;
      if (o.delivery_time_minutes <= 45) map[day].onTime++;
      if (o.delivery_time_minutes > 60)  map[day].late++;
    }
    return DAY_NAMES.map(d => ({
      day:     d,
      avgTime:  map[d].count ? Math.round(map[d].total / map[d].count) : 0,
      onTimePct: map[d].count ? Math.round((map[d].onTime / map[d].count) * 100) : 0,
      latePct:  map[d].count ? Math.round((map[d].late  / map[d].count) * 100) : 0,
    }));
  }, [filtered]);

  // ── By city (highlight slow cities) ──────────────────────────────────────
  const cityDelivery = useMemo(() => {
    const map: Record<string, { total: number; count: number; onTime: number; late: number }> = {};
    for (const o of filtered) {
      if (o.order_status !== 'Delivered') continue;
      if (!map[o.city]) map[o.city] = { total: 0, count: 0, onTime: 0, late: 0 };
      map[o.city].total += o.delivery_time_minutes;
      map[o.city].count++;
      if (o.delivery_time_minutes <= 45) map[o.city].onTime++;
      if (o.delivery_time_minutes > 60)  map[o.city].late++;
    }
    return Object.entries(map)
      .map(([city, d]) => ({
        city,
        avgTime:   d.count ? Math.round(d.total / d.count) : 0,
        onTimePct: d.count ? Math.round((d.onTime / d.count) * 100) : 0,
        latePct:   d.count ? Math.round((d.late  / d.count) * 100) : 0,
        orders:    d.count,
      }))
      .sort((a, b) => a.avgTime - b.avgTime);
  }, [filtered]);

  const overallAvg = kpi.avg;

  // ── By category ───────────────────────────────────────────────────────────
  const categoryTimes = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const o of filtered) {
      if (o.order_status !== 'Delivered') continue;
      if (!map[o.food_category]) map[o.food_category] = { total: 0, count: 0 };
      map[o.food_category].total += o.delivery_time_minutes;
      map[o.food_category].count++;
    }
    return Object.entries(map)
      .map(([cat, d]) => ({ category: cat, avgTime: d.count ? Math.round(d.total / d.count) : 0 }))
      .sort((a, b) => a.avgTime - b.avgTime);
  }, [filtered]);

  // ── Top 10 slowest restaurants ────────────────────────────────────────────
  const restaurantDelivery = useMemo(() => {
    const map: Record<string, { name: string; city: string; total: number; count: number; late: number }> = {};
    for (const o of filtered) {
      if (o.order_status !== 'Delivered') continue;
      if (!map[o.restaurant_id]) map[o.restaurant_id] = { name: o.restaurant_name, city: o.city, total: 0, count: 0, late: 0 };
      map[o.restaurant_id].total += o.delivery_time_minutes;
      map[o.restaurant_id].count++;
      if (o.delivery_time_minutes > 60) map[o.restaurant_id].late++;
    }
    return Object.values(map)
      .filter(r => r.count >= 5)
      .map(r => ({
        name:    r.name,
        city:    r.city,
        avgTime: Math.round(r.total / r.count),
        latePct: Math.round((r.late / r.count) * 100),
        orders:  r.count,
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);
  }, [filtered]);

  // ── On-time vs late stacked by city (for the on-time vs late chart) ───────
  const onTimeLate = useMemo(() =>
    [...cityDelivery].sort((a, b) => b.orders - a.orders).map(c => ({
      city:     c.city,
      onTime:   c.onTimePct,
      late:     c.latePct,
      rest:     100 - c.onTimePct - c.latePct,
    })),
  [cityDelivery]);

  // ── Rating vs time scatter (sampled) ─────────────────────────────────────
  const ratingVsTime = useMemo(() => {
    const del = filtered.filter(o => o.order_status === 'Delivered' && o.rating !== null);
    const step = Math.max(1, Math.floor(del.length / 350));
    return del.filter((_, i) => i % step === 0)
      .map(o => ({ time: o.delivery_time_minutes, rating: o.rating as number }));
  }, [filtered]);

  return (
    <div className="page-container">
      <GlobalFilterBar matchingCount={filtered.length} totalCount={allOrders.length} />

      {/* ── 6 KPI cards ── */}
      <div className="kpi-grid">
        <KPICard label="Avg Delivery Time"    value={`${kpi.avg} min`}
          subValue={`${kpi.total.toLocaleString('en-IN')} deliveries`}
          icon={<Clock size={18}/>} iconBg="#eff6ff" iconColor="#1d4ed8"
          comparisonLabel="mean across delivered orders" />
        <KPICard label="Median Delivery Time" value={`${kpi.med} min`}
          subValue="50th percentile"
          icon={<Timer size={18}/>} iconBg="#f0fdf4" iconColor="#10b981"
          comparisonLabel="half of orders faster than this" />
        <KPICard label="On-Time Rate (≤45 min)" value={`${(kpi.onTimePct * 100).toFixed(1)}%`}
          subValue={`${kpi.onTime.toLocaleString('en-IN')} orders`}
          icon={<CheckCircle size={18}/>} iconBg="#fefce8" iconColor="#ca8a04"
          comparisonLabel="delivered within 45 min" />
        <KPICard label="Late Rate (>60 min)"    value={`${(kpi.latePct * 100).toFixed(1)}%`}
          subValue={`${kpi.late.toLocaleString('en-IN')} orders`}
          icon={<AlertTriangle size={18}/>} iconBg="#fff7ed" iconColor="#ea580c"
          comparisonLabel="took more than 60 minutes" />
        <KPICard label="Fastest Delivery"    value={`${kpi.fastest} min`}
          subValue="best single order"
          icon={<Zap size={18}/>} iconBg="#faf5ff" iconColor="#7c3aed"
          comparisonLabel={`slowest: ${kpi.slowest} min`} />
        <KPICard label="Rating Lift (Fast vs Slow)" value={kpi.fastAvgRating ? `+${(kpi.fastAvgRating - kpi.slowAvgRating).toFixed(2)}` : '—'}
          subValue={`fast: ${kpi.fastAvgRating.toFixed(2)} · slow: ${kpi.slowAvgRating.toFixed(2)}`}
          icon={<TrendingUp size={18}/>} iconBg="#f0fdf4" iconColor="#10b981"
          comparisonLabel="≤30 min vs >60 min avg rating" />
      </div>

      {/* ── Row 1: distribution + monthly trend ── */}
      <div className="charts-grid-2">
        <ChartCard title="Delivery Time Distribution" subtitle="Order count per time bucket — green=fast, red=slow">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={timeBuckets} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={TICK} />
              <YAxis tick={TICK} />
              <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown) => [fv(v).toLocaleString('en-IN'), 'Orders']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {timeBuckets.map((_, i) => <Cell key={i} fill={BUCKET_COLORS[i]} />)}
                <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Delivery Trend" subtitle="Avg delivery time (min) and on-time % by month">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={monthlyTrend} margin={{ top: 8, right: 32, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ ...TICK, fontSize: 10 }} interval={1} />
              <YAxis yAxisId="left"  tick={TICK} unit=" m" domain={['auto', 'auto']} />
              <YAxis yAxisId="right" orientation="right" tick={TICK} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={TS} labelStyle={TL}
                formatter={(v: unknown, name: unknown) =>
                  [name === 'avgTime' ? `${fv(v)} min` : `${fv(v)}%`, name === 'avgTime' ? 'Avg Time' : 'On-Time %']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area yAxisId="left"  type="monotone" dataKey="avgTime"   name="avgTime"   fill="#eff6ff" stroke="#1d4ed8" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="onTimePct" name="onTimePct" stroke="#10b981" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Row 2: hourly + day-of-week ── */}
      <div className="charts-grid-2">
        <ChartCard title="Hourly Delivery Load & Avg Time" subtitle="Volume and speed by hour of day">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={hourlyData} margin={{ top: 8, right: 32, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ ...TICK, fontSize: 9 }} interval={2} />
              <YAxis yAxisId="left"  tick={TICK} />
              <YAxis yAxisId="right" orientation="right" tick={TICK} unit=" m" />
              <Tooltip contentStyle={TS} labelStyle={TL}
                formatter={(v: unknown, name: unknown) =>
                  [name === 'orders' ? fv(v).toLocaleString('en-IN') : `${fv(v)} min`,
                   name === 'orders' ? 'Orders' : 'Avg Time']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar  yAxisId="left"  dataKey="orders"  name="orders"  fill="#1d4ed8" radius={[3,3,0,0]} maxBarSize={18} />
              <Line yAxisId="right" dataKey="avgTime" name="avgTime" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Day-of-Week Performance" subtitle="Avg delivery time and on-time % by weekday">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={dailyPerf} margin={{ top: 8, right: 32, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={TICK} />
              <YAxis yAxisId="left"  tick={TICK} unit=" m" domain={['auto', 'auto']} />
              <YAxis yAxisId="right" orientation="right" tick={TICK} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={TS} labelStyle={TL}
                formatter={(v: unknown, name: unknown) =>
                  [name === 'avgTime' ? `${fv(v)} min` : `${fv(v)}%`,
                   name === 'avgTime' ? 'Avg Time' : name === 'onTimePct' ? 'On-Time %' : 'Late %']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar  yAxisId="left"  dataKey="avgTime"   name="avgTime"   fill="#6366f1" radius={[4,4,0,0]} maxBarSize={40} />
              <Line yAxisId="right" dataKey="onTimePct" name="onTimePct" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="right" dataKey="latePct"   name="latePct"   stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Row 3: by city (highlighted) + by category ── */}
      <div className="charts-grid-2">
        <ChartCard title="Avg Delivery Time by City" subtitle="Red bars = above overall average — slow cities highlighted">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart layout="vertical" data={cityDelivery} margin={{ top: 4, right: 70, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={TICK} unit=" m" />
              <YAxis dataKey="city" type="category" tick={TICK} width={78} />
              <ReferenceLine x={overallAvg} yAxisId={0} stroke="#ef4444" strokeDasharray="4 2"
                label={{ value: `Avg ${overallAvg}m`, position: 'top', fontSize: 10, fill: '#ef4444' }} />
              <Tooltip contentStyle={TS} labelStyle={TL}
                formatter={(v: unknown, name: unknown) =>
                  [name === 'avgTime' ? `${fv(v)} min` : `${fv(v)}%`,
                   name === 'avgTime' ? 'Avg Time' : 'On-Time %']} />
              <Bar dataKey="avgTime" radius={[0,4,4,0]} maxBarSize={24}>
                {cityDelivery.map(d => <Cell key={d.city} fill={d.avgTime > overallAvg ? '#ef4444' : '#10b981'} />)}
                <LabelList dataKey="avgTime" position="right" style={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                  formatter={(v: unknown) => `${fv(v)}m`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Avg Delivery Time by Category" subtitle="Which food categories take longest">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart layout="vertical" data={categoryTimes} margin={{ top: 4, right: 70, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={TICK} unit=" m" />
              <YAxis dataKey="category" type="category" tick={TICK} width={90} />
              <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown) => [`${fv(v)} min`, 'Avg Time']} />
              <Bar dataKey="avgTime" radius={[0,4,4,0]} maxBarSize={24}>
                {categoryTimes.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                <LabelList dataKey="avgTime" position="right" style={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                  formatter={(v: unknown) => `${fv(v)}m`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Row 4: on-time vs late stacked + scatter ── */}
      <div className="charts-grid-2">
        <ChartCard title="On-Time vs Late % by City" subtitle="Stacked % — on-time (≤45 min) vs late (>60 min)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart layout="vertical" data={onTimeLate} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={TICK} unit="%" domain={[0, 100]} />
              <YAxis dataKey="city" type="category" tick={TICK} width={78} />
              <Tooltip contentStyle={TS} labelStyle={TL}
                formatter={(v: unknown, name: unknown) => [`${fv(v)}%`,
                  name === 'onTime' ? 'On-Time (≤45m)' : name === 'late' ? 'Late (>60m)' : 'In-between']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="onTime" name="onTime" stackId="a" fill="#10b981" maxBarSize={22} />
              <Bar dataKey="rest"   name="rest"   stackId="a" fill="#94a3b8" maxBarSize={22} />
              <Bar dataKey="late"   name="late"   stackId="a" fill="#ef4444" maxBarSize={22} radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Rating vs. Delivery Time" subtitle="Does speed drive higher ratings? (sampled)">
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="time" name="Delivery Time" tick={TICK} unit=" m" type="number" domain={[0, 100]}
                label={{ value: 'Delivery Time (min)', position: 'insideBottom', offset: -12, style: { fontSize: 10, fill: 'var(--text-secondary)' } }} />
              <YAxis dataKey="rating" name="Rating" tick={TICK} domain={[1, 5]}
                label={{ value: 'Rating', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'var(--text-secondary)' } }} />
              <Tooltip contentStyle={TS} cursor={{ strokeDasharray: '3 3' }}
                formatter={(v: unknown, name: unknown) =>
                  [name === 'time' ? `${fv(v)} min` : fv(v).toFixed(1),
                   name === 'time' ? 'Delivery Time' : 'Rating']} />
              <Scatter data={ratingVsTime} fill="#6366f1" opacity={0.4} />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Slowest restaurants table ── */}
      <div className="card">
        <div className="card-body">
          <div className="section-title" style={{ marginBottom: 4 }}>🐢 Slowest Restaurants (Top 10)</div>
          <div className="section-subtitle" style={{ marginBottom: 12 }}>Min 5 deliveries · sorted by avg delivery time (desc)</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th>City</th>
                  <th style={{ textAlign: 'right' }}>Deliveries</th>
                  <th style={{ textAlign: 'right' }}>Avg Time</th>
                  <th style={{ textAlign: 'right' }}>Late % (&gt;60m)</th>
                </tr>
              </thead>
              <tbody>
                {restaurantDelivery.map((r, i) => (
                  <tr key={i}>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.city}</td>
                    <td style={{ textAlign: 'right' }}>{r.orders}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ color: r.avgTime > overallAvg * 1.2 ? '#ef4444' : r.avgTime > overallAvg ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                        {r.avgTime} min
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ color: r.latePct > 30 ? '#ef4444' : r.latePct > 15 ? '#f59e0b' : '#10b981' }}>
                        {r.latePct}%
                      </span>
                    </td>
                  </tr>
                ))}
                {!restaurantDelivery.length && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No data for current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── City summary table ── */}
      <div className="card">
        <div className="card-body">
          <div className="section-title" style={{ marginBottom: 12 }}>City Delivery Summary</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>City</th>
                  <th style={{ textAlign: 'right' }}>Deliveries</th>
                  <th style={{ textAlign: 'right' }}>Avg Time</th>
                  <th style={{ textAlign: 'right' }}>On-Time % (≤45m)</th>
                  <th style={{ textAlign: 'right' }}>Late % (&gt;60m)</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {cityDelivery.map(row => {
                  const slow = row.avgTime > overallAvg * 1.1;
                  return (
                    <tr key={row.city}>
                      <td><strong>{row.city}</strong>{slow && <span style={{ marginLeft: 6, fontSize: 10, background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 3, padding: '1px 5px' }}>Slow</span>}</td>
                      <td style={{ textAlign: 'right' }}>{row.orders.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ color: row.avgTime > overallAvg ? '#ef4444' : '#10b981', fontWeight: 600 }}>{row.avgTime} min</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ color: row.onTimePct >= 70 ? '#10b981' : row.onTimePct >= 50 ? '#f59e0b' : '#ef4444' }}>{row.onTimePct}%</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ color: row.latePct <= 10 ? '#10b981' : row.latePct <= 20 ? '#f59e0b' : '#ef4444' }}>{row.latePct}%</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          background: slow ? '#fef2f2' : '#f0fdf4',
                          color:      slow ? '#ef4444' : '#10b981',
                          border: `1px solid ${slow ? '#fecaca' : '#bbf7d0'}`,
                        }}>{slow ? '⚠ Slow' : '✓ Good'}</span>
                      </td>
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
