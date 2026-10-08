import { useMemo } from 'react';
import {
  DollarSign, TrendingUp, Tag, Percent, CreditCard, Users,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList,
} from 'recharts';
import { KPICard } from '../components/KPICard';
import { GlobalFilterBar } from '../components/GlobalFilterBar';
import { applyFilters, getRawOrders } from '../services/dataService';
import { useFilters, toDashboardFilters } from '../context/FilterContext';

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
const PAYMENT_COLORS: Record<string, string> = {
  'UPI': '#6366f1', 'Credit Card': '#1d4ed8', 'Debit Card': '#0ea5e9',
  'Cash on Delivery': '#f59e0b', 'Wallet': '#10b981',
};
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

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

export default function RevenuePage() {
  const filters   = useFilters();
  const dfFilters = toDashboardFilters(filters);
  const allOrders = useMemo(() => getRawOrders(), []);
  const filtered  = useMemo(() => applyFilters(allOrders, dfFilters), [allOrders, dfFilters]);

  // ── Core KPIs ─────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const delivered      = filtered.filter(o => o.order_status === 'Delivered');
    const gross          = delivered.reduce((s, o) => s + o.order_amount, 0);
    const totalFees      = delivered.reduce((s, o) => s + o.delivery_fee, 0);
    const totalDiscounts = delivered.reduce((s, o) => s + o.discount, 0);
    const finalRevenue   = delivered.reduce((s, o) => s + o.final_amount, 0);
    const aov            = delivered.length ? finalRevenue / delivered.length : 0;
    const uniqueCustomers = new Set(delivered.map(o => o.customer_id)).size;
    const revenuePerCustomer = uniqueCustomers ? finalRevenue / uniqueCustomers : 0;
    const discountRate   = (gross + totalFees) ? totalDiscounts / (gross + totalFees) : 0;
    return { gross, totalFees, totalDiscounts, finalRevenue, aov, uniqueCustomers, revenuePerCustomer, discountRate, count: delivered.length };
  }, [filtered]);

  // ── Waterfall data: Gross → +Fees → −Discounts → Final ───────────────────
  const waterfallData = useMemo(() => [
    { name: 'Gross Order Value', value: Math.round(kpi.gross),          fill: '#1d4ed8', type: 'abs' },
    { name: '+ Delivery Fees',   value: Math.round(kpi.totalFees),      fill: '#10b981', type: 'add' },
    { name: '− Discounts',       value: -Math.round(kpi.totalDiscounts),fill: '#ef4444', type: 'sub' },
    { name: 'Final Revenue',     value: Math.round(kpi.finalRevenue),   fill: '#6366f1', type: 'abs' },
  ], [kpi]);


  // ── Monthly trend ─────────────────────────────────────────────────────────
  const monthlyTrend = useMemo(() => {
    const map: Record<string, { revenue: number; orders: number; discounts: number; fees: number }> = {};
    for (const o of filtered) {
      if (o.order_status !== 'Delivered') continue;
      const d   = new Date(o.order_date);
      const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      if (!map[key]) map[key] = { revenue: 0, orders: 0, discounts: 0, fees: 0 };
      map[key].revenue   += o.final_amount;
      map[key].orders++;
      map[key].discounts += o.discount;
      map[key].fees      += o.delivery_fee;
    }
    return Object.entries(map)
      .sort(([a], [b]) => {
        const parse = (s: string) => { const [m, y] = s.split(' '); return parseInt(y) * 12 + MONTH_NAMES.indexOf(m); };
        return parse(a) - parse(b);
      })
      .map(([month, d]) => ({
        month,
        revenue:   Math.round(d.revenue),
        orders:    d.orders,
        discounts: Math.round(d.discounts),
        fees:      Math.round(d.fees),
        aov:       d.orders ? Math.round(d.revenue / d.orders) : 0,
      }));
  }, [filtered]);

  // ── Weekday revenue ───────────────────────────────────────────────────────
  const weekdayRevenue = useMemo(() => {
    const map: Record<string, { revenue: number; orders: number }> = {};
    for (const d of DAY_NAMES) map[d] = { revenue: 0, orders: 0 };
    for (const o of filtered) {
      if (o.order_status !== 'Delivered') continue;
      const day = DAY_NAMES[new Date(o.order_date).getDay()];
      map[day].revenue += o.final_amount;
      map[day].orders++;
    }
    return DAY_NAMES.map(d => ({
      day:     d,
      revenue: Math.round(map[d].revenue),
      orders:  map[d].orders,
      aov:     map[d].orders ? Math.round(map[d].revenue / map[d].orders) : 0,
    }));
  }, [filtered]);

  // ── Hourly revenue ────────────────────────────────────────────────────────
  const hourlyRevenue = useMemo(() => {
    const map: Record<number, { revenue: number; orders: number }> = {};
    for (let h = 0; h < 24; h++) map[h] = { revenue: 0, orders: 0 };
    for (const o of filtered) {
      if (o.order_status !== 'Delivered') continue;
      const h = parseInt(o.order_time.split(':')[0], 10);
      map[h].revenue += o.final_amount;
      map[h].orders++;
    }
    return Array.from({ length: 24 }, (_, h) => ({
      hour:    `${String(h).padStart(2, '0')}:00`,
      revenue: Math.round(map[h].revenue),
      aov:     map[h].orders ? Math.round(map[h].revenue / map[h].orders) : 0,
    }));
  }, [filtered]);

  // ── By category ───────────────────────────────────────────────────────────
  const categoryRevenue = useMemo(() => {
    const map: Record<string, { revenue: number; orders: number; discounts: number }> = {};
    for (const o of filtered) {
      if (o.order_status !== 'Delivered') continue;
      if (!map[o.food_category]) map[o.food_category] = { revenue: 0, orders: 0, discounts: 0 };
      map[o.food_category].revenue   += o.final_amount;
      map[o.food_category].orders++;
      map[o.food_category].discounts += o.discount;
    }
    return Object.entries(map)
      .map(([cat, d]) => ({
        category:  cat,
        revenue:   Math.round(d.revenue),
        orders:    d.orders,
        aov:       d.orders ? Math.round(d.revenue / d.orders) : 0,
        discounts: Math.round(d.discounts),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // ── By city ───────────────────────────────────────────────────────────────
  const cityRevenue = useMemo(() => {
    const map: Record<string, { revenue: number; orders: number; discounts: number }> = {};
    for (const o of filtered) {
      if (o.order_status !== 'Delivered') continue;
      if (!map[o.city]) map[o.city] = { revenue: 0, orders: 0, discounts: 0 };
      map[o.city].revenue   += o.final_amount;
      map[o.city].orders++;
      map[o.city].discounts += o.discount;
    }
    const total = Object.values(map).reduce((s, d) => s + d.revenue, 0);
    return Object.entries(map)
      .map(([city, d]) => ({
        city,
        revenue:   Math.round(d.revenue),
        orders:    d.orders,
        share:     total ? d.revenue / total : 0,
        aov:       d.orders ? Math.round(d.revenue / d.orders) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // ── By payment method ─────────────────────────────────────────────────────
  const paymentRevenue = useMemo(() => {
    const map: Record<string, { revenue: number; orders: number }> = {};
    for (const o of filtered) {
      if (o.order_status !== 'Delivered') continue;
      if (!map[o.payment_method]) map[o.payment_method] = { revenue: 0, orders: 0 };
      map[o.payment_method].revenue += o.final_amount;
      map[o.payment_method].orders++;
    }
    const total = Object.values(map).reduce((s, d) => s + d.revenue, 0);
    return Object.entries(map)
      .map(([method, d]) => ({
        method,
        revenue: Math.round(d.revenue),
        orders:  d.orders,
        share:   total ? d.revenue / total : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // ── AOV monthly trend ─────────────────────────────────────────────────────
  const aovTrend = useMemo(() =>
    monthlyTrend.map(m => ({ month: m.month, aov: m.aov })),
  [monthlyTrend]);

  // ── Monthly discount rate ─────────────────────────────────────────────────
  const discountTrend = useMemo(() =>
    monthlyTrend.map(m => ({
      month: m.month,
      discountRate: m.revenue ? Math.round((m.discounts / (m.revenue + m.discounts)) * 1000) / 10 : 0,
    })),
  [monthlyTrend]);

  // ── Top 10 restaurants by revenue ─────────────────────────────────────────
  const topRestaurants = useMemo(() => {
    const map: Record<string, { name: string; city: string; revenue: number; orders: number }> = {};
    for (const o of filtered) {
      if (o.order_status !== 'Delivered') continue;
      if (!map[o.restaurant_id]) map[o.restaurant_id] = { name: o.restaurant_name, city: o.city, revenue: 0, orders: 0 };
      map[o.restaurant_id].revenue += o.final_amount;
      map[o.restaurant_id].orders++;
    }
    return Object.values(map)
      .map(r => ({ ...r, revenue: Math.round(r.revenue), aov: r.orders ? Math.round(r.revenue / r.orders) : 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filtered]);

  return (
    <div className="page-container">
      <GlobalFilterBar matchingCount={filtered.length} totalCount={allOrders.length} />

      {/* ── 6 KPI cards ── */}
      <div className="kpi-grid">
        <KPICard label="Final Revenue" value={inr(kpi.finalRevenue)}
          subValue={`${kpi.count.toLocaleString('en-IN')} orders`}
          icon={<DollarSign size={18}/>} iconBg="#eff6ff" iconColor="#1d4ed8"
          comparisonLabel="gross + fees − discounts" />
        <KPICard label="Gross Order Value" value={inr(kpi.gross)}
          subValue="before fees & discounts"
          icon={<Percent size={18}/>} iconBg="#f0fdf4" iconColor="#10b981"
          comparisonLabel="sum of base order amounts" />
        <KPICard label="Avg Order Value" value={inr(kpi.aov)}
          subValue="per delivered order"
          icon={<TrendingUp size={18}/>} iconBg="#fefce8" iconColor="#ca8a04"
          comparisonLabel="final revenue ÷ delivered orders" />
        <KPICard label="Revenue / Customer" value={inr(kpi.revenuePerCustomer)}
          subValue={`${kpi.uniqueCustomers.toLocaleString('en-IN')} unique customers`}
          icon={<Users size={18}/>} iconBg="#fff7ed" iconColor="#ea580c"
          comparisonLabel="final revenue ÷ unique customers" />
        <KPICard label="Delivery Fee Revenue" value={inr(kpi.totalFees)}
          subValue={kpi.finalRevenue ? `${((kpi.totalFees / kpi.finalRevenue) * 100).toFixed(1)}% of final` : '—'}
          icon={<CreditCard size={18}/>} iconBg="#faf5ff" iconColor="#7c3aed"
          comparisonLabel="aggregate delivery fees collected" />
        <KPICard label="Total Discounts" value={inr(kpi.totalDiscounts)}
          subValue={`${(kpi.discountRate * 100).toFixed(1)}% discount rate`}
          icon={<Tag size={18}/>} iconBg="#fff7ed" iconColor="#ea580c"
          comparisonLabel="discounts ÷ (gross + fees)" />
      </div>

      {/* ── Revenue waterfall ── */}
      <ChartCard
        title="Revenue Waterfall: Gross → Fees → Discounts → Final"
        subtitle="How gross order value transforms into final revenue"
      >
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 0, alignItems: 'flex-end', padding: '16px 8px 0', minWidth: 480 }}>
            {waterfallData.map((d, i) => {
              const maxVal = kpi.gross + kpi.totalFees;
              const barH   = Math.max(8, Math.round((Math.abs(d.value) / maxVal) * 200));
              const isNeg  = d.value < 0;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isNeg ? '#ef4444' : d.fill }}>
                    {isNeg ? '−' : i > 0 ? '+' : ''}{inr(Math.abs(d.value))}
                  </div>
                  <div style={{
                    width: '70%', height: barH, background: d.fill,
                    borderRadius: '4px 4px 0 0', opacity: 0.85,
                    border: d.name === 'Final Revenue' ? `2px solid ${d.fill}` : 'none',
                  }} />
                  <div style={{ fontSize: 11, textAlign: 'center', color: 'var(--text-secondary)', lineHeight: 1.3, paddingBottom: 4 }}>
                    {d.name}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Connectors and equation */}
          <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {inr(kpi.gross)} + {inr(kpi.totalFees)} − {inr(kpi.totalDiscounts)} = <strong style={{ color: '#6366f1' }}>{inr(kpi.finalRevenue)}</strong>
          </div>
        </div>
      </ChartCard>

      {/* ── Monthly trend + AOV trend ── */}
      <div className="charts-grid-2">
        <ChartCard title="Monthly Revenue Trend" subtitle="Net revenue and order volume over time">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={monthlyTrend} margin={{ top: 8, right: 32, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ ...TICK, fontSize: 10 }} interval={1} />
              <YAxis yAxisId="left"  tick={TICK} tickFormatter={(v: number) => inr(v)} />
              <YAxis yAxisId="right" orientation="right" tick={TICK} />
              <Tooltip contentStyle={TS} labelStyle={TL}
                formatter={(v: unknown, name: unknown) =>
                  [name === 'revenue' ? inr(fv(v)) : fv(v).toLocaleString('en-IN'),
                   name === 'revenue' ? 'Revenue' : 'Orders']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area yAxisId="left"  type="monotone" dataKey="revenue" name="revenue" fill="#eff6ff" stroke="#1d4ed8" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="orders"  name="orders"  stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="AOV Trend" subtitle="Average order value and monthly discount rate">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={monthlyTrend} margin={{ top: 8, right: 32, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ ...TICK, fontSize: 10 }} interval={1} />
              <YAxis yAxisId="left"  tick={TICK} tickFormatter={(v: number) => inr(v)} />
              <YAxis yAxisId="right" orientation="right" tick={TICK} unit="%" domain={[0, 'auto']} />
              <Tooltip contentStyle={TS} labelStyle={TL}
                formatter={(v: unknown, name: unknown) =>
                  [name === 'aov' ? inr(fv(v)) : `${fv(v).toFixed(1)}%`,
                   name === 'aov' ? 'AOV' : 'Discount Rate']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="left"  type="monotone" dataKey="aov" name="aov" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              <Area yAxisId="right" type="monotone" dataKey={
                // inline compute discount rate
                undefined as unknown as string
              } fill="transparent" stroke="transparent" />
              {/* Use discountTrend separately — render a second dataset via <Line> */}
            </ComposedChart>
          </ResponsiveContainer>
          {/* Simpler: just show AOV line chart alone since ComposedChart with two separate data arrays is complex */}
          {/* Replaced with clean single-metric chart below */}
        </ChartCard>
      </div>

      {/* Cleaner AOV + discount rate charts (replace the second chart above) */}
      <div className="charts-grid-2">
        <ChartCard title="AOV by Month" subtitle="How average order value shifts over time">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={aovTrend} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ ...TICK, fontSize: 10 }} interval={1} />
              <YAxis tick={TICK} tickFormatter={(v: number) => inr(v)} />
              <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown) => [inr(fv(v)), 'AOV']} />
              <Area type="monotone" dataKey="aov" fill="#fef3c7" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Discount Rate" subtitle="Discounts as % of gross revenue">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={discountTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ ...TICK, fontSize: 10 }} interval={1} />
              <YAxis tick={TICK} unit="%" domain={[0, 'auto']} />
              <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown) => [`${fv(v).toFixed(1)}%`, 'Discount Rate']} />
              <Area type="monotone" dataKey="discountRate" fill="#fef2f2" stroke="#ef4444" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Weekday + hourly revenue ── */}
      <div className="charts-grid-2">
        <ChartCard title="Revenue by Day of Week" subtitle="Which days generate the most revenue (delivered orders)">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={weekdayRevenue} margin={{ top: 8, right: 32, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={TICK} />
              <YAxis yAxisId="left"  tick={TICK} tickFormatter={(v: number) => inr(v)} />
              <YAxis yAxisId="right" orientation="right" tick={TICK} tickFormatter={(v: number) => inr(v)} />
              <Tooltip contentStyle={TS} labelStyle={TL}
                formatter={(v: unknown, name: unknown) =>
                  [name === 'revenue' ? inr(fv(v)) : inr(fv(v)),
                   name === 'revenue' ? 'Revenue' : 'AOV']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar  yAxisId="left"  dataKey="revenue" name="revenue" fill="#1d4ed8" radius={[4,4,0,0]} maxBarSize={48} />
              <Line yAxisId="right" dataKey="aov"     name="aov"     stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue by Hour of Day" subtitle="Revenue concentration by time of day">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hourlyRevenue} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ ...TICK, fontSize: 9 }} interval={2} />
              <YAxis tick={TICK} tickFormatter={(v: number) => inr(v)} />
              <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown) => [inr(fv(v)), 'Revenue']} />
              <Bar dataKey="revenue" radius={[3,3,0,0]} maxBarSize={22}>
                {hourlyRevenue.map((_, i) => <Cell key={i} fill={C[Math.floor(i / 4) % C.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Category + city revenue ── */}
      <div className="charts-grid-2">
        <ChartCard title="Revenue by Category" subtitle="Which food categories drive the most revenue">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart layout="vertical" data={categoryRevenue} margin={{ top: 4, right: 80, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={TICK} tickFormatter={(v: number) => inr(v)} />
              <YAxis dataKey="category" type="category" tick={TICK} width={90} />
              <Tooltip contentStyle={TS} labelStyle={TL}
                formatter={(v: unknown, name: unknown) =>
                  [name === 'revenue' ? inr(fv(v)) : fv(v).toLocaleString('en-IN'),
                   name === 'revenue' ? 'Revenue' : 'Orders']} />
              <Bar dataKey="revenue" radius={[0,4,4,0]} maxBarSize={26}>
                {categoryRevenue.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                <LabelList dataKey="revenue" position="right" style={{ fontSize: 10, fill: 'var(--text-secondary)' }} formatter={(v: unknown) => inr(fv(v))} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue by City" subtitle="Geographic revenue breakdown with share">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart layout="vertical" data={cityRevenue} margin={{ top: 4, right: 80, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={TICK} tickFormatter={(v: number) => inr(v)} />
              <YAxis dataKey="city" type="category" tick={TICK} width={78} />
              <Tooltip contentStyle={TS} labelStyle={TL}
                formatter={(v: unknown, name: unknown) =>
                  [name === 'revenue' ? inr(fv(v)) : inr(fv(v)),
                   name === 'revenue' ? 'Revenue' : 'AOV']} />
              <Bar dataKey="revenue" radius={[0,4,4,0]} maxBarSize={26}>
                {cityRevenue.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                <LabelList dataKey="revenue" position="right" style={{ fontSize: 10, fill: 'var(--text-secondary)' }} formatter={(v: unknown) => inr(fv(v))} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Payment method pie ── */}
      <div className="charts-grid-2">
        <ChartCard title="Revenue by Payment Method" subtitle="How customers pay and how much they spend">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={paymentRevenue} dataKey="revenue" nameKey="method"
                cx="42%" cy="50%" outerRadius={90} innerRadius={45}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label={(p: any) => `${p.method}: ${((p.share as number) * 100).toFixed(1)}%`}
                labelLine={false}
              >
                {paymentRevenue.map(d => <Cell key={d.method} fill={PAYMENT_COLORS[d.method] ?? C[0]} />)}
              </Pie>
              <Tooltip contentStyle={TS} formatter={(v: unknown) => [inr(fv(v)), 'Revenue']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Category table */}
        <div className="card">
          <div className="card-body">
            <div className="section-title" style={{ marginBottom: 12 }}>Category Revenue Breakdown</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Orders</th>
                    <th style={{ textAlign: 'right' }}>AOV</th>
                    <th style={{ textAlign: 'right' }}>Discount %</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRevenue.map((row, i) => (
                    <tr key={row.category}>
                      <td>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C[i % C.length], marginRight: 8 }} />
                        {row.category}
                      </td>
                      <td style={{ textAlign: 'right' }}><strong>{inr(row.revenue)}</strong></td>
                      <td style={{ textAlign: 'right' }}>{row.orders.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right' }}>{inr(row.aov)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ color: row.revenue ? (row.discounts / row.revenue > 0.15 ? '#ef4444' : '#10b981') : 'inherit' }}>
                          {row.revenue ? `${((row.discounts / row.revenue) * 100).toFixed(1)}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Top restaurants by revenue ── */}
      <div className="card">
        <div className="card-body">
          <div className="section-title" style={{ marginBottom: 12 }}>Top 10 Restaurants by Revenue</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Restaurant</th>
                  <th>City</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                  <th style={{ textAlign: 'right' }}>Orders</th>
                  <th style={{ textAlign: 'right' }}>AOV</th>
                </tr>
              </thead>
              <tbody>
                {topRestaurants.map((r, i) => (
                  <tr key={i}>
                    <td style={{ width: 36, textAlign: 'center', color: i < 3 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 700 }}>
                      {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i + 1}`}
                    </td>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.city}</td>
                    <td style={{ textAlign: 'right' }}><strong>{inr(r.revenue)}</strong></td>
                    <td style={{ textAlign: 'right' }}>{r.orders.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right' }}>{inr(r.aov)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
