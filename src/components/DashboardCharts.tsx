/**
 * DashboardCharts — 10 named chart panels, each self-contained.
 *
 * Each component receives its data already computed by getFilteredAggregations()
 * and returns a <div className="card"> with header + Recharts chart inside.
 *
 * Chart types used:
 *   1  OrdersRevenueTrend    → ComposedChart (Area + Line)
 *   2  OrdersByStatus        → PieChart (donut) with legend
 *   3  RevenueByCategory     → HorizontalBarChart
 *   4  DeliveryTimeByCity    → HorizontalBarChart
 *   5  RatingDistribution    → BarChart (histogram)
 *   6  OrdersByPayment       → PieChart (donut) with legend
 *   7  OrderValueDistrib     → BarChart (histogram)
 *   8  TopRestaurantsByRev   → HorizontalBarChart
 *   9  OrdersByDow           → BarChart + Line overlay
 *  10  OrdersByHour          → AreaChart heat-curve
 */
import {
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import type { getFilteredAggregations } from '../services/dataService';

// Derive the aggregation return type directly from the function signature
type Agg = ReturnType<typeof getFilteredAggregations>;

// ─── Shared palette / helpers ────────────────────────────────────────────────

export const C = [
  '#1d4ed8','#10b981','#f59e0b','#ef4444',
  '#6366f1','#ec4899','#14b8a6','#f97316',
  '#8b5cf6','#06b6d4','#84cc16','#a78bfa',
];

const STATUS_COLORS: Record<string, string> = {
  Delivered: '#10b981', Cancelled: '#ef4444',
  Pending: '#94a3b8', Preparing: '#f59e0b', 'Out for Delivery': '#6366f1',
};
const PAY_COLORS = ['#1d4ed8','#f59e0b','#10b981','#6366f1','#ec4899'];

// Recharts passes ValueType|undefined; cast safely
const fv = (v: unknown) => v as number;
const fn = (n: unknown) => n as string;

const TS: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border)',
  borderRadius: 8, boxShadow: 'var(--shadow-md)', fontSize: 12,
  color: 'var(--text-primary)', padding: '8px 12px',
};
const TL: React.CSSProperties = {
  color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4,
};
const TICK = { fontSize: 11, fill: 'var(--text-secondary)' };

function inr(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)   return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n}`;
}

interface CardProps { title: string; subtitle?: string; children: React.ReactNode; }
function ChartCard({ title, subtitle, children }: CardProps) {
  return (
    <div className="card">
      <div className="card-body">
        <div style={{ marginBottom: 14 }}>
          <div className="section-title">{title}</div>
          {subtitle && <div className="section-subtitle">{subtitle}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── 1. Orders & Revenue over time ──────────────────────────────────────────

export function ChartOrdersRevenueTrend({ data }: { data: Agg['monthlyTrend'] }) {
  const chartData = data.map((m) => ({ name: m.month.slice(0, 3), orders: m.orders, revenue: m.revenue }));
  return (
    <ChartCard title="Orders & Revenue Trend" subtitle="Monthly orders (bars) and revenue (line)">
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 50, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C[1]} stopOpacity={0.15} />
              <stop offset="95%" stopColor={C[1]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} />
          <YAxis yAxisId="l" tick={TICK} tickLine={false} axisLine={false} width={36} />
          <YAxis yAxisId="r" orientation="right" tick={TICK} tickLine={false} axisLine={false}
            tickFormatter={inr} width={52} />
          <Tooltip contentStyle={TS} labelStyle={TL}
            formatter={(v, n) => [fn(n) === 'Revenue (₹)' ? inr(fv(v)) : fv(v).toLocaleString(), fn(n)]} />
          <Legend iconType="circle" iconSize={8} />
          <Bar yAxisId="l" dataKey="orders" name="Orders" fill={C[0]} radius={[3,3,0,0]} opacity={0.85} />
          <Area yAxisId="r" type="monotone" dataKey="revenue" name="Revenue (₹)"
            stroke={C[1]} strokeWidth={2.5} fill="url(#revGrad)" dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── 2. Orders by Status ────────────────────────────────────────────────────

export function ChartOrdersByStatus({ data }: { data: Agg['statusBreakdown'] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const pieData = data.map((d) => ({ name: d.status, value: d.count }));
  return (
    <ChartCard title="Orders by Status" subtitle={`${total.toLocaleString()} total orders`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={76}
              dataKey="value" stroke="var(--bg-surface)" strokeWidth={2}>
              {pieData.map((d, i) => <Cell key={i} fill={STATUS_COLORS[d.name] ?? C[i % C.length]} />)}
            </Pie>
            <Tooltip contentStyle={TS} labelStyle={TL}
              formatter={(v) => [fv(v).toLocaleString(), '']} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {data.map((d, i) => (
            <div key={d.status} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, flexShrink: 0,
                background: STATUS_COLORS[d.status] ?? C[i % C.length] }} />
              <span style={{ flex: 1, color: 'var(--text-primary)' }}>{d.status}</span>
              <strong>{d.count.toLocaleString()}</strong>
              <span style={{ color: 'var(--text-muted)', minWidth: 38, textAlign: 'right' }}>
                {(d.share * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

// ─── 3. Revenue by Food Category ────────────────────────────────────────────

export function ChartRevenueByCategory({ data }: { data: Agg['categoryBreakdown'] }) {
  const chartData = [...data].sort((a, b) => a.revenue - b.revenue)
    .map((d) => ({ name: d.category, revenue: d.revenue, orders: d.orders }));
  return (
    <ChartCard title="Revenue by Food Category" subtitle="Delivered revenue per category">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 80, left: 0, bottom: 0 }} barSize={14}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} tickFormatter={inr} width={52} />
          <YAxis type="category" dataKey="name" tick={TICK} tickLine={false} axisLine={false} width={80} />
          <Tooltip contentStyle={TS} labelStyle={TL}
            formatter={(v, n) => [fn(n) === 'Revenue' ? inr(fv(v)) : fv(v).toLocaleString(), fn(n)]} />
          <Legend iconType="square" iconSize={9} />
          <Bar dataKey="revenue" name="Revenue" fill={C[0]} radius={[0,4,4,0]}>
            <LabelList dataKey="revenue" position="right" style={{ fontSize: 10, fill: 'var(--text-secondary)' }}
              formatter={(v: unknown) => inr(fv(v))} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── 4. Avg Delivery Time by City ───────────────────────────────────────────

export function ChartDeliveryByCity({ data }: { data: Agg['deliveryByCity'] }) {
  const chartData = [...data].sort((a, b) => b.avgDeliveryTime - a.avgDeliveryTime);
  return (
    <ChartCard title="Avg Delivery Time by City" subtitle="Minutes (lower is better)">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }} barSize={14}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={TICK} tickLine={false} axisLine={false}
            tickFormatter={(v) => `${v}m`} domain={[0, 'dataMax + 5']} />
          <YAxis type="category" dataKey="city" tick={TICK} tickLine={false} axisLine={false} width={72} />
          <Tooltip contentStyle={TS} labelStyle={TL}
            formatter={(v) => [`${fv(v)} min`, 'Avg Delivery']} />
          <Bar dataKey="avgDeliveryTime" name="Avg Delivery (min)" radius={[0,4,4,0]}>
            {chartData.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
            <LabelList dataKey="avgDeliveryTime" position="right"
              style={{ fontSize: 10, fill: 'var(--text-secondary)' }}
              formatter={(v: unknown) => `${fv(v)}m`} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── 5. Rating Distribution ─────────────────────────────────────────────────

export function ChartRatingDistribution({ data }: { data: Agg['ratingDistribution'] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d) => ({ name: `${d.rating}★`, count: d.count, rating: d.rating }));
  const colorFn = (r: number) => r >= 4.5 ? '#10b981' : r >= 4 ? '#22c55e' : r >= 3 ? '#f59e0b' : r >= 2 ? '#f97316' : '#ef4444';
  return (
    <ChartCard title="Rating Distribution" subtitle={`${total.toLocaleString()} rated orders`}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} width={40} />
          <Tooltip contentStyle={TS} labelStyle={TL}
            formatter={(v) => [fv(v).toLocaleString(), 'Orders']} />
          <Bar dataKey="count" name="Orders" radius={[4,4,0,0]}>
            {chartData.map((d, i) => <Cell key={i} fill={colorFn(d.rating)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── 6. Orders by Payment Method ────────────────────────────────────────────

export function ChartOrdersByPayment({ data }: { data: Agg['paymentBreakdown'] }) {
  const pieData = data.map((d) => ({ name: d.method, value: d.orders }));
  return (
    <ChartCard title="Orders by Payment Method" subtitle="Share of order volume">
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={76}
              dataKey="value" stroke="var(--bg-surface)" strokeWidth={2}>
              {pieData.map((_, i) => <Cell key={i} fill={PAY_COLORS[i % PAY_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={TS} labelStyle={TL}
              formatter={(v) => [fv(v).toLocaleString(), '']} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {data.map((d, i) => (
            <div key={d.method} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, flexShrink: 0,
                background: PAY_COLORS[i % PAY_COLORS.length] }} />
              <span style={{ flex: 1, color: 'var(--text-primary)' }}>{d.method}</span>
              <strong>{d.orders.toLocaleString()}</strong>
              <span style={{ color: 'var(--text-muted)', minWidth: 38, textAlign: 'right' }}>
                {(d.share * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

// ─── 7. Order-Value Distribution ────────────────────────────────────────────

export function ChartOrderValueDistrib({ data }: { data: Agg['orderValueDistribution'] }) {
  return (
    <ChartCard title="Order Value Distribution" subtitle="Order count per price range">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ ...TICK, fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} width={40} />
          <Tooltip contentStyle={TS} labelStyle={TL}
            formatter={(v) => [fv(v).toLocaleString(), 'Orders']} />
          <Bar dataKey="count" name="Orders" radius={[4,4,0,0]}>
            {data.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── 8. Top 10 Restaurants by Revenue ───────────────────────────────────────

export function ChartTopRestaurants({ data }: { data: Agg['topRestaurants'] }) {
  const chartData = [...data]
    .sort((a, b) => a.total_revenue - b.total_revenue)
    .map((r) => ({ name: r.restaurant_name.length > 18 ? r.restaurant_name.slice(0,16)+'…' : r.restaurant_name,
      revenue: r.total_revenue, orders: r.total_orders, rating: r.rating }));
  return (
    <ChartCard title="Top 10 Restaurants by Revenue" subtitle="Revenue in filtered period">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 80, left: 0, bottom: 0 }} barSize={13}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} tickFormatter={inr} />
          <YAxis type="category" dataKey="name" tick={{ ...TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={120} />
          <Tooltip contentStyle={TS} labelStyle={TL}
            formatter={(v, n) => [fn(n) === 'Revenue' ? inr(fv(v)) : fv(v).toLocaleString(), fn(n)]} />
          <Bar dataKey="revenue" name="Revenue" radius={[0,4,4,0]}>
            {chartData.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
            <LabelList dataKey="revenue" position="right"
              style={{ fontSize: 10, fill: 'var(--text-secondary)' }}
              formatter={(v: unknown) => inr(fv(v))} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── 9. Orders by Day of Week ────────────────────────────────────────────────

export function ChartOrdersByDow({ data }: { data: Agg['ordersByDow'] }) {
  return (
    <ChartCard title="Orders by Day of Week" subtitle="Volume and revenue per weekday">
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 4, right: 50, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="day" tick={TICK} tickLine={false} axisLine={false} />
          <YAxis yAxisId="l" tick={TICK} tickLine={false} axisLine={false} width={36} />
          <YAxis yAxisId="r" orientation="right" tick={TICK} tickLine={false} axisLine={false}
            tickFormatter={inr} width={52} />
          <Tooltip contentStyle={TS} labelStyle={TL}
            formatter={(v, n) => [fn(n) === 'Revenue' ? inr(fv(v)) : fv(v).toLocaleString(), fn(n)]} />
          <Legend iconType="circle" iconSize={8} />
          <Bar yAxisId="l" dataKey="orders" name="Orders" fill={C[0]} radius={[3,3,0,0]} opacity={0.85}>
            {data.map((d, i) => {
              const isWeekend = d.day === 'Sun' || d.day === 'Sat';
              return <Cell key={i} fill={isWeekend ? C[2] : C[0]} />;
            })}
          </Bar>
          <Line yAxisId="r" type="monotone" dataKey="revenue" name="Revenue"
            stroke={C[1]} strokeWidth={2} dot={{ fill: C[1], r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── 10. Orders by Hour ─────────────────────────────────────────────────────

export function ChartOrdersByHour({ data }: { data: Agg['ordersByHour'] }) {
  const peak = Math.max(...data.map((d) => d.orders));
  return (
    <ChartCard title="Orders by Hour of Day" subtitle="24-hour order volume pattern">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C[4]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={C[4]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="hour" tick={TICK} tickLine={false} axisLine={false}
            tickFormatter={(v) => v % 3 === 0 ? `${v}h` : ''} interval={0} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} width={36} />
          <Tooltip contentStyle={TS} labelStyle={TL}
            labelFormatter={(v) => `${v}:00`}
            formatter={(v) => [fv(v).toLocaleString(), 'Orders']} />
          <Area type="monotone" dataKey="orders" name="Orders"
            stroke={C[4]} strokeWidth={2.5} fill="url(#hourGrad)"
            dot={(props) => {
              const { cx, cy, payload } = props;
              return payload.orders === peak
                ? <circle key={cx} cx={cx} cy={cy} r={5} fill={C[4]} stroke="var(--bg-surface)" strokeWidth={2} />
                : <g key={cx} />;
            }}
            activeDot={{ r: 4, strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
