import { useState, useMemo } from 'react';
import {
  Users, ShoppingBag, DollarSign, Star, UserCheck, Repeat2,
  Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList,
} from 'recharts';
import { KPICard } from '../components/KPICard';
import { GlobalFilterBar } from '../components/GlobalFilterBar';
import { applyFilters, getRawOrders, getRawCustomers } from '../services/dataService';
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

// Dynamic classification based on ACTUAL order count in the filtered period
// New:      1 order
// Returning: 2–4 orders
// Loyal:    5+ orders
function classifyCustomer(orders: number): string {
  if (orders >= 5) return 'Loyal';
  if (orders >= 2) return 'Returning';
  return 'New';
}

const TYPE_COLORS: Record<string, string> = {
  New: '#6366f1', Returning: '#10b981', Loyal: '#f59e0b',
};

const PAGE_SIZE  = 15;
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
type SortField = 'name' | 'city' | 'orders' | 'revenue' | 'aov' | 'lastOrder';
type SortDir   = 'asc' | 'desc';

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

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] ?? '#94a3b8';
  return (
    <span style={{
      background: color + '1a', color, border: `1px solid ${color}33`,
      borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600,
    }}>{type}</span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const filters      = useFilters();
  const dfFilters    = toDashboardFilters(filters);
  const allOrders    = useMemo(() => getRawOrders(), []);
  const allCustomers = useMemo(() => getRawCustomers(), []);
  const filtered     = useMemo(() => applyFilters(allOrders, dfFilters), [allOrders, dfFilters]);

  // ── Build per-customer stats from filtered orders ─────────────────────────
  const customerStats = useMemo(() => {
    type Stats = {
      orders: number; revenue: number; lastOrderDate: string;
      firstOrderDate: string; ratings: number[];
    };
    const map: Record<string, Stats> = {};
    for (const o of filtered) {
      if (!map[o.customer_id]) map[o.customer_id] = {
        orders: 0, revenue: 0, lastOrderDate: o.order_date, firstOrderDate: o.order_date, ratings: [],
      };
      const s = map[o.customer_id];
      s.orders++;
      if (o.order_status === 'Delivered') s.revenue += o.final_amount;
      if (o.order_date > s.lastOrderDate)  s.lastOrderDate  = o.order_date;
      if (o.order_date < s.firstOrderDate) s.firstOrderDate = o.order_date;
      if (o.rating !== null) s.ratings.push(o.rating);
    }
    return map;
  }, [filtered]);

  // ── Enriched customer rows ────────────────────────────────────────────────
  const enriched = useMemo(() => {
    return allCustomers
      .filter(c => customerStats[c.customer_id])
      .map(c => {
        const s = customerStats[c.customer_id];
        const type = classifyCustomer(s.orders);
        return {
          id:            c.customer_id,
          name:          c.customer_name,
          city:          c.city,
          area:          c.area,
          orders:        s.orders,
          revenue:       Math.round(s.revenue),
          aov:           s.orders ? Math.round(s.revenue / s.orders) : 0,
          lastOrderDate: s.lastOrderDate,
          firstOrderDate:s.firstOrderDate,
          type,
        };
      });
  }, [allCustomers, customerStats]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const total         = enriched.length;
    const totalRevenue  = enriched.reduce((s, c) => s + c.revenue, 0);
    const totalOrders   = enriched.reduce((s, c) => s + c.orders, 0);
    const avgOrders     = total ? totalOrders / total : 0;
    const avgSpend      = total ? totalRevenue / total : 0;
    const repeatCust    = enriched.filter(c => c.orders >= 2).length;
    const repeatRate    = total ? repeatCust / total : 0;
    const loyal         = enriched.filter(c => c.type === 'Loyal').length;
    return { total, totalRevenue, totalOrders, avgOrders, avgSpend, repeatRate, repeatCust, loyal };
  }, [enriched]);

  // ── Type breakdown ────────────────────────────────────────────────────────
  const typeBreakdown = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    for (const c of enriched) {
      if (!map[c.type]) map[c.type] = { count: 0, revenue: 0 };
      map[c.type].count++;
      map[c.type].revenue += c.revenue;
    }
    const total = enriched.length;
    return Object.entries(map)
      .map(([type, d]) => ({ type, count: d.count, revenue: d.revenue, share: total ? d.count / total : 0 }));
  }, [enriched]);

  // ── Orders-per-customer histogram ─────────────────────────────────────────
  const orderHistogram = useMemo(() => {
    const buckets = [
      { label: '1',    min: 1,  max: 1,    count: 0 },
      { label: '2–3',  min: 2,  max: 3,    count: 0 },
      { label: '4–6',  min: 4,  max: 6,    count: 0 },
      { label: '7–10', min: 7,  max: 10,   count: 0 },
      { label: '11–20',min: 11, max: 20,   count: 0 },
      { label: '21+',  min: 21, max: 9999, count: 0 },
    ];
    for (const c of enriched) {
      for (const b of buckets) { if (c.orders >= b.min && c.orders <= b.max) { b.count++; break; } }
    }
    return buckets;
  }, [enriched]);

  // ── Spending distribution ─────────────────────────────────────────────────
  const spendingHistogram = useMemo(() => {
    const buckets = [
      { label: '₹0–500',    min: 0,     max: 500,    count: 0 },
      { label: '₹501–1K',   min: 501,   max: 1000,   count: 0 },
      { label: '₹1K–2K',    min: 1001,  max: 2000,   count: 0 },
      { label: '₹2K–5K',    min: 2001,  max: 5000,   count: 0 },
      { label: '₹5K–10K',   min: 5001,  max: 10000,  count: 0 },
      { label: '₹10K+',     min: 10001, max: 999999, count: 0 },
    ];
    for (const c of enriched) {
      for (const b of buckets) { if (c.revenue >= b.min && c.revenue <= b.max) { b.count++; break; } }
    }
    return buckets;
  }, [enriched]);

  // ── Monthly new customers (first order in period) ─────────────────────────
  const monthlyNew = useMemo(() => {
    // "new" = first order in the filtered dataset (first order date = earliest in filtered)
    const firstOrder: Record<string, string> = {};
    for (const o of filtered) {
      if (!firstOrder[o.customer_id] || o.order_date < firstOrder[o.customer_id])
        firstOrder[o.customer_id] = o.order_date;
    }
    const map: Record<string, number> = {};
    for (const [, date] of Object.entries(firstOrder)) {
      const d   = new Date(date);
      const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      map[key] = (map[key] ?? 0) + 1;
    }
    return Object.entries(map)
      .sort(([a], [b]) => {
        const parse = (s: string) => { const [m, y] = s.split(' '); return parseInt(y) * 12 + MONTH_NAMES.indexOf(m); };
        return parse(a) - parse(b);
      })
      .map(([month, count]) => ({ month, newCustomers: count }));
  }, [filtered]);

  // ── Monthly active (any order) ────────────────────────────────────────────
  const monthlyActive = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const o of filtered) {
      const d   = new Date(o.order_date);
      const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      if (!map[key]) map[key] = new Set();
      map[key].add(o.customer_id);
    }
    return Object.entries(map)
      .sort(([a], [b]) => {
        const parse = (s: string) => { const [m, y] = s.split(' '); return parseInt(y) * 12 + MONTH_NAMES.indexOf(m); };
        return parse(a) - parse(b);
      })
      .map(([month, set]) => ({ month, active: set.size }));
  }, [filtered]);

  // Merge new + active by month
  const monthlyData = useMemo(() => {
    const activeMap = Object.fromEntries(monthlyActive.map(m => [m.month, m.active]));
    return monthlyNew.map(m => ({ ...m, active: activeMap[m.month] ?? 0 }));
  }, [monthlyNew, monthlyActive]);

  // ── Customers by city ─────────────────────────────────────────────────────
  const cityCustomers = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    for (const c of enriched) {
      if (!map[c.city]) map[c.city] = { count: 0, revenue: 0 };
      map[c.city].count++;
      map[c.city].revenue += c.revenue;
    }
    return Object.entries(map)
      .map(([city, d]) => ({ city, count: d.count, revenue: d.revenue }))
      .sort((a, b) => b.count - a.count);
  }, [enriched]);

  // ── Top 10 customers ──────────────────────────────────────────────────────
  const topCustomers = useMemo(() =>
    [...enriched].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
  [enriched]);

  // ── Table ─────────────────────────────────────────────────────────────────
  const [search,     setSearch]    = useState('');
  const [sortField,  setSort]      = useState<SortField>('revenue');
  const [sortDir,    setSortDir]   = useState<SortDir>('desc');
  const [page,       setPage]      = useState(1);
  const [typeFilter, setTypeFilter]= useState<string>('All');

  const tableData = useMemo(() => {
    let rows = enriched;
    if (typeFilter !== 'All') rows = rows.filter(c => c.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
      );
    }
    return [...rows].sort((a, b) => {
      const get = (x: typeof a) => {
        if (sortField === 'name')      return x.name;
        if (sortField === 'city')      return x.city;
        if (sortField === 'orders')    return x.orders;
        if (sortField === 'revenue')   return x.revenue;
        if (sortField === 'aov')       return x.aov;
        if (sortField === 'lastOrder') return x.lastOrderDate;
        return 0;
      };
      const av = get(a), bv = get(b);
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [enriched, search, sortField, sortDir, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(tableData.length / PAGE_SIZE));
  const pageData   = tableData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(f: SortField) {
    if (f === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSort(f); setSortDir('desc'); }
    setPage(1);
  }
  function SortIcon({ field }: { field: SortField }) {
    if (field !== sortField) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  }

  return (
    <div className="page-container">
      <GlobalFilterBar matchingCount={filtered.length} totalCount={allOrders.length} />

      {/* ── 6 KPI cards ── */}
      <div className="kpi-grid">
        <KPICard label="Active Customers"     value={kpi.total.toLocaleString('en-IN')}
          subValue="placed at least one order"
          icon={<Users size={18}/>} iconBg="#eff6ff" iconColor="#1d4ed8"
          comparisonLabel="unique customers in period" />
        <KPICard label="Total Customer Revenue" value={inr(kpi.totalRevenue)}
          subValue="from delivered orders"
          icon={<DollarSign size={18}/>} iconBg="#f0fdf4" iconColor="#10b981"
          comparisonLabel="net of discounts" />
        <KPICard label="Avg Orders / Customer" value={kpi.avgOrders.toFixed(1)}
          subValue={`${kpi.totalOrders.toLocaleString('en-IN')} total orders`}
          icon={<ShoppingBag size={18}/>} iconBg="#fefce8" iconColor="#ca8a04"
          comparisonLabel="orders ÷ active customers" />
        <KPICard label="Avg Spending / Customer" value={inr(kpi.avgSpend)}
          subValue="avg lifetime value"
          icon={<Star size={18}/>} iconBg="#fff7ed" iconColor="#ea580c"
          comparisonLabel="revenue ÷ active customers" />
        <KPICard label="Repeat Customer Rate"  value={`${(kpi.repeatRate * 100).toFixed(1)}%`}
          subValue={`${kpi.repeatCust.toLocaleString('en-IN')} repeat customers`}
          icon={<Repeat2 size={18}/>} iconBg="#faf5ff" iconColor="#7c3aed"
          comparisonLabel="customers with ≥ 2 orders" />
        <KPICard label="Loyal Customers (5+)"  value={kpi.loyal.toLocaleString('en-IN')}
          subValue={kpi.total ? `${((kpi.loyal / kpi.total) * 100).toFixed(1)}% of active` : '—'}
          icon={<UserCheck size={18}/>} iconBg="#f0fdf4" iconColor="#10b981"
          comparisonLabel="≥ 5 orders in period" />
      </div>

      {/* ── Row 1: type pie + order histogram ── */}
      <div className="charts-grid-2">
        <ChartCard title="Customer Type Distribution" subtitle="Classified dynamically: New (1 order) · Returning (2–4) · Loyal (5+)">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            {typeBreakdown.map(d => (
              <div key={d.type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: TYPE_COLORS[d.type] }} />
                <span style={{ fontSize: 12 }}><strong>{d.type}</strong>: {d.count.toLocaleString('en-IN')} ({(d.share * 100).toFixed(0)}%)</span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={typeBreakdown} dataKey="count" nameKey="type"
                cx="42%" cy="50%" outerRadius={85} innerRadius={42}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label={(p: any) => `${p.type}: ${((p.share as number) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {typeBreakdown.map(d => <Cell key={d.type} fill={TYPE_COLORS[d.type] ?? C[0]} />)}
              </Pie>
              <Tooltip contentStyle={TS} formatter={(v: unknown, name: unknown) => [fv(v).toLocaleString('en-IN'), String(name)]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Orders per Customer" subtitle="How frequently customers order">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={orderHistogram} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={TICK} />
              <YAxis tick={TICK} />
              <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown) => [fv(v).toLocaleString('en-IN'), 'Customers']} />
              <Bar dataKey="count" radius={[4,4,0,0]} maxBarSize={60}>
                {orderHistogram.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Row 2: spending distribution + monthly new vs active ── */}
      <div className="charts-grid-2">
        <ChartCard title="Spending Distribution" subtitle="How much customers spend in total (₹ buckets)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={spendingHistogram} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ ...TICK, fontSize: 10 }} />
              <YAxis tick={TICK} />
              <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown) => [fv(v).toLocaleString('en-IN'), 'Customers']} />
              <Bar dataKey="count" fill="#6366f1" radius={[4,4,0,0]} maxBarSize={56}>
                <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Customer Activity" subtitle="New customers (first order) vs. total active per month">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={monthlyData} margin={{ top: 8, right: 32, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ ...TICK, fontSize: 10 }} interval={1} />
              <YAxis yAxisId="left"  tick={TICK} />
              <YAxis yAxisId="right" orientation="right" tick={TICK} />
              <Tooltip contentStyle={TS} labelStyle={TL}
                formatter={(v: unknown, name: unknown) =>
                  [fv(v).toLocaleString('en-IN'), name === 'newCustomers' ? 'New' : 'Active']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area yAxisId="left"  type="monotone" dataKey="active"       name="active"       fill="#eff6ff" stroke="#1d4ed8" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="newCustomers" name="newCustomers" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Row 3: customers by city + top 10 by revenue ── */}
      <div className="charts-grid-2">
        <ChartCard title="Customers by City" subtitle="Active customer count per city">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart layout="vertical" data={cityCustomers} margin={{ top: 4, right: 60, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={TICK} />
              <YAxis dataKey="city" type="category" tick={TICK} width={78} />
              <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown) => [fv(v).toLocaleString('en-IN'), 'Customers']} />
              <Bar dataKey="count" radius={[0,4,4,0]} maxBarSize={24}>
                {cityCustomers.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                <LabelList dataKey="count" position="right" style={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Repeat vs One-Time Customers by City" subtitle="Customers with 1 order vs 2+ orders per city">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart layout="vertical"
              data={cityCustomers.map(c => ({
                city: c.city,
                oneTime:  enriched.filter(e => e.city === c.city && e.orders === 1).length,
                repeat:   enriched.filter(e => e.city === c.city && e.orders >= 2).length,
              }))}
              margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={TICK} />
              <YAxis dataKey="city" type="category" tick={TICK} width={78} />
              <Tooltip contentStyle={TS} labelStyle={TL}
                formatter={(v: unknown, name: unknown) => [fv(v).toLocaleString('en-IN'), name === 'repeat' ? 'Repeat' : 'One-Time']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="repeat"  name="repeat"  stackId="a" fill="#10b981" maxBarSize={22} />
              <Bar dataKey="oneTime" name="oneTime" stackId="a" fill="#94a3b8" maxBarSize={22} radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Top 10 customers ── */}
      <ChartCard title="Top 10 Customers by Revenue" subtitle="Highest-spending customers in the selected period">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart layout="vertical" data={topCustomers} margin={{ top: 4, right: 80, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={TICK} tickFormatter={(v: number) => inr(v)} />
            <YAxis dataKey="name" type="category" tick={{ ...TICK, fontSize: 10 }} width={120} />
            <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v: unknown) => [inr(fv(v)), 'Revenue']} />
            <Bar dataKey="revenue" fill="#6366f1" radius={[0,4,4,0]} maxBarSize={20}>
              <LabelList dataKey="revenue" position="right" style={{ fontSize: 10, fill: 'var(--text-secondary)' }} formatter={(v: unknown) => inr(fv(v))} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Full customer table ── */}
      <div className="card">
        <div className="card-body">
          {/* Table toolbar */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Customer Directory</div>
            <div style={{ flex: 1 }} />
            {/* Type filter tabs */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['All', 'New', 'Returning', 'Loyal'].map(t => (
                <button key={t} onClick={() => { setTypeFilter(t); setPage(1); }}
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    border: `1px solid ${typeFilter === t ? (TYPE_COLORS[t] ?? 'var(--accent)') : 'var(--border)'}`,
                    background: typeFilter === t ? ((TYPE_COLORS[t] ?? '#1d4ed8') + '18') : 'transparent',
                    color:  typeFilter === t ? (TYPE_COLORS[t] ?? 'var(--accent)') : 'var(--text-secondary)',
                    fontWeight: typeFilter === t ? 600 : 400,
                  }}
                >{t}</button>
              ))}
            </div>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search customers…"
                style={{ paddingLeft: 28, paddingRight: 8, height: 32, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', width: 180 }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Name <SortIcon field="name" /></span>
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('city')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>City <SortIcon field="city" /></span>
                  </th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('orders')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>Orders <SortIcon field="orders" /></span>
                  </th>
                  <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('revenue')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>Spending <SortIcon field="revenue" /></span>
                  </th>
                  <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('aov')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>AOV <SortIcon field="aov" /></span>
                  </th>
                  <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('lastOrder')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>Last Order <SortIcon field="lastOrder" /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageData.map(c => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong><br />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.id}</span>
                    </td>
                    <td>{c.city}<br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.area}</span></td>
                    <td><TypeBadge type={c.type} /></td>
                    <td style={{ textAlign: 'right' }}>{c.orders}</td>
                    <td style={{ textAlign: 'right' }}><strong>{inr(c.revenue)}</strong></td>
                    <td style={{ textAlign: 'right' }}>{inr(c.aov)}</td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>{c.lastOrderDate}</td>
                  </tr>
                ))}
                {pageData.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No customers match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {tableData.length.toLocaleString('en-IN')} customers · page {page} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { icon: <ChevronsLeft size={14}/>,  fn: () => setPage(1),             disabled: page === 1 },
                { icon: <ChevronLeft  size={14}/>,   fn: () => setPage(p => p - 1),    disabled: page === 1 },
                { icon: <ChevronRight size={14}/>,   fn: () => setPage(p => p + 1),    disabled: page === totalPages },
                { icon: <ChevronsRight size={14}/>,  fn: () => setPage(totalPages),    disabled: page === totalPages },
              ].map((btn, i) => (
                <button key={i} onClick={btn.fn} disabled={btn.disabled}
                  style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', background: 'transparent', cursor: btn.disabled ? 'not-allowed' : 'pointer', color: btn.disabled ? 'var(--text-muted)' : 'var(--text-secondary)' }}
                >{btn.icon}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
