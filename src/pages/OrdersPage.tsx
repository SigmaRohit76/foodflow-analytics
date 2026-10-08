import { useState, useMemo } from 'react';
import {
  ShoppingCart, CheckCircle, XCircle, Clock, BarChart2, DollarSign,
  Search, ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import {
  ComposedChart, BarChart, Bar, Area, PieChart, Pie, Cell,
  AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { KPICard }          from '../components/KPICard';
import { GlobalFilterBar }  from '../components/GlobalFilterBar';
import { OrderStatusBadge, StarRating } from '../components/Badge';
import {
  getOrdersPageData,
  applyFilters,
  getRawOrders,
} from '../services/dataService';
import { useFilters, toDashboardFilters, useFilterDispatch } from '../context/FilterContext';
import type { Order } from '../types';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function inr(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}
function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }
const fv = (v: unknown) => v as number;
const fn = (n: unknown) => n as string;

const TS: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border)',
  borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', padding: '8px 12px',
};
const TL: React.CSSProperties = { color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 };
const TICK = { fontSize: 11, fill: 'var(--text-secondary)' };

const C = ['#1d4ed8','#10b981','#f59e0b','#ef4444','#6366f1','#ec4899','#14b8a6','#f97316','#8b5cf6','#06b6d4'];
const STATUS_COLORS: Record<string, string> = {
  Delivered: '#10b981', Cancelled: '#ef4444', Pending: '#94a3b8', Preparing: '#f59e0b', 'Out for Delivery': '#6366f1',
};

// ─── Mini chart card ──────────────────────────────────────────────────────────

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

// ─── Order Detail Panel ───────────────────────────────────────────────────────

function OrderDetailPanel({ order, onClose }: { order: Order; onClose: () => void }) {
  const fields: [string, React.ReactNode][] = [
    ['Order ID',       <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{order.order_id}</code>],
    ['Customer ID',    order.customer_id],
    ['Restaurant',     order.restaurant_name],
    ['Category',       order.food_category],
    ['Cuisine',        order.cuisine],
    ['Date',           order.order_date],
    ['Time',           order.order_time],
    ['City',           order.city],
    ['Area',           order.area],
    ['Base Amount',    `₹${order.order_amount.toLocaleString('en-IN')}`],
    ['Delivery Fee',   `₹${order.delivery_fee}`],
    ['Discount',       order.discount > 0 ? `-₹${order.discount}` : '—'],
    ['Final Amount',   <strong style={{ color: 'var(--accent)' }}>₹{order.final_amount.toLocaleString('en-IN')}</strong>],
    ['Payment',        order.payment_method],
    ['Status',         <OrderStatusBadge status={order.order_status} />],
    ['Delivery Time',  order.delivery_time_minutes != null ? `${order.delivery_time_minutes} min` : '—'],
    ['Rating',         <StarRating value={order.rating} />],
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
      background: 'rgba(0,0,0,.4)',
    }} onClick={onClose}>
      <div style={{
        width: 380, maxWidth: '100vw', height: '100dvh',
        background: 'var(--bg-surface)', overflowY: 'auto',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex', flexDirection: 'column',
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Order Details</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{order.order_id}</div>
          </div>
          <button onClick={onClose} style={{ display: 'flex', background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-secondary)', borderRadius: 4, padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        {/* Status banner */}
        <div style={{ padding: '12px 20px', background: 'var(--bg-surface-2)',
          borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <OrderStatusBadge status={order.order_status} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {order.order_date} at {order.order_time}
          </span>
        </div>
        {/* Fields */}
        <div style={{ flex: 1, padding: '0 0 20px' }}>
          {fields.map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '10px 20px',
              borderBottom: '1px solid var(--border-light)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontWeight: 500, textAlign: 'right' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sort indicator ───────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc';
function SortIcon({ col, active, dir }: { col: string; active: string; dir: SortDir }) {
  const on = col === active;
  return on
    ? dir === 'asc' ? <ChevronUp size={12} style={{ marginLeft: 3 }} /> : <ChevronDown size={12} style={{ marginLeft: 3 }} />
    : <span style={{ display: 'inline-block', width: 15 }} />;
}

// ─── Orders Page ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

type SortKey = keyof Order | '';

export default function OrdersPage() {
  const filterState = useFilters();
  const filters     = useMemo(() => toDashboardFilters(filterState), [filterState]);
  const allOrders   = useMemo(() => getRawOrders(), []);
  const { reset }   = useFilterDispatch();

  // Filtered orders
  const filtered = useMemo(() => applyFilters(allOrders, filters), [allOrders, filters]);

  // Page data (KPIs + chart datasets)
  const data = useMemo(() => getOrdersPageData(filtered), [filtered]);

  // Table: search, sort, paginate
  const [search,  setSearch]  = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('order_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page,    setPage]    = useState(1);
  const [selected, setSelected] = useState<Order | null>(null);

  // Reset page when filters change
  useMemo(() => setPage(1), [filters]);

  const tableOrders = useMemo(() => {
    let rows = filtered;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((o) =>
        o.order_id.toLowerCase().includes(q) ||
        o.restaurant_name.toLowerCase().includes(q) ||
        o.food_category.toLowerCase().includes(q) ||
        o.city.toLowerCase().includes(q) ||
        o.order_status.toLowerCase().includes(q) ||
        o.payment_method.toLowerCase().includes(q)
      );
    }
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey as keyof Order];
        const bv = b[sortKey as keyof Order];
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [filtered, search, sortKey, sortDir]);

  const totalPages  = Math.max(1, Math.ceil(tableOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows    = tableOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const ThS = ({ label, k }: { label: string; k: SortKey }) => (
    <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      onClick={() => handleSort(k)}>
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        {label}<SortIcon col={k} active={sortKey} dir={sortDir} />
      </span>
    </th>
  );

  // Chart shared styles
  const pieData = data.byStatus.map((d) => ({ name: d.status, value: d.count }));

  return (
    <div>
      {/* Filter bar */}
      <GlobalFilterBar matchingCount={filtered.length} totalCount={allOrders.length} />

      {/* Summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Showing <strong style={{ color: 'var(--text-primary)' }}>{filtered.length.toLocaleString('en-IN')}</strong> orders
          {' · '}<span style={{ color: 'var(--text-muted)' }}>{filterState.dateLabel}</span>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 20px', textAlign: 'center', gap: 16 }}>
            <div style={{ fontSize: 48 }}>🔍</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>No orders match your filters</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Try broadening your date range or removing filter chips.</div>
            <button onClick={reset} style={{ padding: '8px 20px', borderRadius: 'var(--radius-md)',
              fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 16, marginBottom: 20 }}>
            <KPICard label="Total Orders"      value={data.kpi.totalOrders.toLocaleString('en-IN')}
              icon={<ShoppingCart size={17} />} iconBg="var(--accent-light)" iconColor="var(--accent)" />
            <KPICard label="Delivered"         value={data.kpi.delivered.toLocaleString('en-IN')}
              icon={<CheckCircle size={17} />} iconBg="var(--success-light)" iconColor="var(--success)" />
            <KPICard label="Cancelled"         value={data.kpi.cancelled.toLocaleString('en-IN')}
              icon={<XCircle size={17} />} iconBg="var(--danger-light)" iconColor="var(--danger)" />
            <KPICard label="In Progress"       value={data.kpi.pending.toLocaleString('en-IN')}
              icon={<Clock size={17} />} iconBg="var(--warning-light)" iconColor="var(--warning)" />
            <KPICard label="Cancellation Rate" value={pct(data.kpi.cancellationRate)}
              icon={<BarChart2 size={17} />} iconBg="var(--info-light)" iconColor="var(--info)" />
            <KPICard label="Avg Order Value"   value={inr(data.kpi.avgOrderValue)}
              icon={<DollarSign size={17} />} iconBg="var(--success-light)" iconColor="var(--success)" />
          </div>

          {/* Chart row 1: Trend (full width) */}
          <div style={{ marginBottom: 20 }}>
            <ChartCard title="Orders & Revenue Over Time" subtitle="Monthly totals">
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={data.overTime} margin={{ top: 4, right: 50, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ordRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C[1]} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={C[1]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="l" tick={TICK} tickLine={false} axisLine={false} width={36} />
                  <YAxis yAxisId="r" orientation="right" tick={TICK} tickLine={false} axisLine={false}
                    tickFormatter={(v) => inr(fv(v))} width={52} />
                  <Tooltip contentStyle={TS} labelStyle={TL}
                    formatter={(v, n) => [fn(n) === 'Revenue' ? inr(fv(v)) : fv(v).toLocaleString(), fn(n)]} />
                  <Legend iconType="circle" iconSize={8} />
                  <Bar yAxisId="l" dataKey="orders" name="Orders" fill={C[0]} radius={[3,3,0,0]} opacity={0.85} />
                  <Area yAxisId="r" type="monotone" dataKey="revenue" name="Revenue"
                    stroke={C[1]} strokeWidth={2.5} fill="url(#ordRevGrad)" dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Chart row 2: Status donut + Payment donut */}
          <div className="charts-grid-2" style={{ marginBottom: 20 }}>
            <ChartCard title="Orders by Status">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={46} outerRadius={68}
                      dataKey="value" stroke="var(--bg-surface)" strokeWidth={2}>
                      {pieData.map((d, i) => <Cell key={i} fill={STATUS_COLORS[d.name] ?? C[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={TS} formatter={(v) => [fv(v).toLocaleString(), '']} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {data.byStatus.map((d, i) => (
                    <div key={d.status} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: STATUS_COLORS[d.status] ?? C[i] }} />
                      <span style={{ flex: 1 }}>{d.status}</span>
                      <strong>{d.count.toLocaleString()}</strong>
                      <span style={{ color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>{pct(d.share)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>

            <ChartCard title="Orders by Payment Method">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={data.byPayment.map((d) => ({ name: d.method, value: d.count }))}
                      cx="50%" cy="50%" innerRadius={46} outerRadius={68}
                      dataKey="value" stroke="var(--bg-surface)" strokeWidth={2}>
                      {data.byPayment.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={TS} formatter={(v) => [fv(v).toLocaleString(), '']} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {data.byPayment.map((d, i) => (
                    <div key={d.method} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: C[i % C.length] }} />
                      <span style={{ flex: 1 }}>{d.method}</span>
                      <strong>{d.count.toLocaleString()}</strong>
                      <span style={{ color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>{pct(d.share)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>
          </div>

          {/* Chart row 3: Category + City */}
          <div className="charts-grid-2" style={{ marginBottom: 20 }}>
            <ChartCard title="Orders by Category" subtitle="Volume per food category">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={[...data.byCategory].sort((a, b) => a.orders - b.orders)}
                  layout="vertical" margin={{ top: 0, right: 55, left: 0, bottom: 0 }} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="category" tick={{ ...TICK, fontSize: 10 }}
                    tickLine={false} axisLine={false} width={82} />
                  <Tooltip contentStyle={TS} labelStyle={TL}
                    formatter={(v) => [fv(v).toLocaleString(), 'Orders']} />
                  <Bar dataKey="orders" name="Orders" radius={[0,4,4,0]}>
                    {data.byCategory.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Orders by City">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={[...data.byCity].sort((a, b) => a.orders - b.orders)}
                  layout="vertical" margin={{ top: 0, right: 55, left: 0, bottom: 0 }} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="city" tick={{ ...TICK, fontSize: 10 }}
                    tickLine={false} axisLine={false} width={72} />
                  <Tooltip contentStyle={TS} labelStyle={TL}
                    formatter={(v) => [fv(v).toLocaleString(), 'Orders']} />
                  <Bar dataKey="orders" name="Orders" radius={[0,4,4,0]}>
                    {data.byCity.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Chart row 4: Day of week + Hour */}
          <div className="charts-grid-2" style={{ marginBottom: 20 }}>
            <ChartCard title="Orders by Day of Week" subtitle="Weekends highlighted">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.byDow} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" tick={TICK} tickLine={false} axisLine={false} />
                  <YAxis tick={TICK} tickLine={false} axisLine={false} width={36} />
                  <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v) => [fv(v).toLocaleString(), 'Orders']} />
                  <Bar dataKey="orders" name="Orders" radius={[3,3,0,0]}>
                    {data.byDow.map((d, i) => (
                      <Cell key={i} fill={d.day === 'Sun' || d.day === 'Sat' ? C[2] : C[0]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Orders by Hour" subtitle="24-hour pattern">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.byHour} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C[4]} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={C[4]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="hour" tick={TICK} tickLine={false} axisLine={false}
                    tickFormatter={(v) => fv(v) % 3 === 0 ? `${v}h` : ''} interval={0} />
                  <YAxis tick={TICK} tickLine={false} axisLine={false} width={36} />
                  <Tooltip contentStyle={TS} labelStyle={TL} labelFormatter={(v) => `${v}:00`}
                    formatter={(v) => [fv(v).toLocaleString(), 'Orders']} />
                  <Area type="monotone" dataKey="orders" name="Orders"
                    stroke={C[4]} strokeWidth={2} fill="url(#hrGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Orders Table */}
          <div className="card" style={{ marginBottom: 8 }}>
            <div className="card-body" style={{ paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div className="section-title">Orders Table</div>
                  <div className="section-subtitle">
                    {tableOrders.length.toLocaleString()} orders
                    {search ? ` matching "${search}"` : ''}
                    {' · '}Page {currentPage} / {totalPages}
                  </div>
                </div>
                {/* Search */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '6px 12px', width: 260 }}>
                  <Search size={14} color="var(--text-muted)" />
                  <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search ID, restaurant, city…"
                    style={{ border: 'none', background: 'none', outline: 'none',
                      fontSize: 12, color: 'var(--text-primary)', flex: 1 }} />
                  {search && (
                    <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none',
                      cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <ThS label="Order ID"      k="order_id" />
                    <ThS label="Restaurant"    k="restaurant_name" />
                    <ThS label="Category"      k="food_category" />
                    <ThS label="Date"          k="order_date" />
                    <ThS label="Amount"        k="final_amount" />
                    <ThS label="Delivery"      k="delivery_time_minutes" />
                    <ThS label="Status"        k="order_status" />
                    <ThS label="Payment"       k="payment_method" />
                    <ThS label="City"          k="city" />
                    <ThS label="Rating"        k="rating" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((o) => (
                    <tr key={o.order_id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelected(o)}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                        {o.order_id}
                      </td>
                      <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {o.restaurant_name}
                      </td>
                      <td style={{ fontSize: 12 }}>{o.food_category}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{o.order_date}</td>
                      <td style={{ fontWeight: 700 }}>₹{o.final_amount.toLocaleString('en-IN')}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {o.delivery_time_minutes != null ? `${o.delivery_time_minutes}m` : '—'}
                      </td>
                      <td><OrderStatusBadge status={o.order_status} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{o.payment_method}</td>
                      <td style={{ fontSize: 12 }}>{o.city}</td>
                      <td><StarRating value={o.rating} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, tableOrders.length)} of {tableOrders.length.toLocaleString()}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { icon: <ChevronsLeft size={14} />, action: () => setPage(1),          disabled: currentPage === 1 },
                  { icon: <ChevronLeft  size={14} />, action: () => setPage((p) => p-1), disabled: currentPage === 1 },
                  { icon: <ChevronRight size={14} />, action: () => setPage((p) => p+1), disabled: currentPage === totalPages },
                  { icon: <ChevronsRight size={14} />, action: () => setPage(totalPages), disabled: currentPage === totalPages },
                ].map((btn, i) => (
                  <button key={i} onClick={btn.action} disabled={btn.disabled} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 30, height: 30, borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)', background: 'var(--bg-surface)',
                    cursor: btn.disabled ? 'default' : 'pointer',
                    color: btn.disabled ? 'var(--text-muted)' : 'var(--text-primary)',
                    opacity: btn.disabled ? 0.4 : 1,
                  }}>{btn.icon}</button>
                ))}
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center', padding: '0 8px' }}>
                  Page {currentPage} / {totalPages}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Detail panel */}
      {selected && <OrderDetailPanel order={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
