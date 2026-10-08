import { useState, useMemo } from 'react';
import {
  Store, Star, Clock, DollarSign, TrendingUp,
  Search, ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList, RadarChart,
  Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import { KPICard }         from '../components/KPICard';
import { GlobalFilterBar } from '../components/GlobalFilterBar';
import { Badge }           from '../components/Badge';
import {
  getRestaurantsPageData,
  applyFilters,
  getRawOrders,
  getRawRestaurants,
} from '../services/dataService';
import { useFilters, toDashboardFilters, useFilterDispatch } from '../context/FilterContext';
import type { RestaurantRow } from '../services/dataService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inr(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}
function pct(n: number)    { return `${(n * 100).toFixed(1)}%`; }
function stars(n: number)  { return `★ ${n.toFixed(1)}`; }
const fv = (v: unknown) => v as number;

const C = ['#1d4ed8','#10b981','#f59e0b','#ef4444','#6366f1','#ec4899','#14b8a6','#f97316','#8b5cf6','#06b6d4'];
const TS: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border)',
  borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', padding: '8px 12px',
};
const TL: React.CSSProperties = { color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 };
const TICK = { fontSize: 11, fill: 'var(--text-secondary)' };

function statusBadge(status: string) {
  const map: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
    Active: 'success', Inactive: 'neutral', Suspended: 'danger',
  };
  return <Badge variant={map[status] ?? 'neutral'}>{status}</Badge>;
}

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

// ─── Restaurant Detail Panel ──────────────────────────────────────────────────

function RestaurantDetailPanel({ row, onClose }: { row: RestaurantRow; onClose: () => void }) {
  // Radar data: normalised 0-100 per metric so all fit one chart
  const radarData = [
    { metric: 'Revenue',    value: 0 }, // will be filled below
    { metric: 'Orders',     value: 0 },
    { metric: 'Rating',     value: Math.round((row.rating / 5) * 100) },
    { metric: 'Speed',      value: row.avgDeliveryTime > 0 ? Math.round(Math.max(0, 100 - row.avgDeliveryTime)) : 0 },
    { metric: 'Reliability', value: Math.round((1 - row.cancellationRate) * 100) },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
      background: 'rgba(0,0,0,.4)' }} onClick={onClose}>
      <div style={{ width: 420, maxWidth: '100vw', height: '100dvh',
        background: 'var(--bg-surface)', overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
        display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
              {row.restaurant_name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {row.cuisine} · {row.city}, {row.area}
            </div>
          </div>
          <button onClick={onClose} style={{ display: 'flex', background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-secondary)', borderRadius: 4, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Status strip */}
        <div style={{ padding: '10px 20px', background: 'var(--bg-surface-2)',
          borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
          {statusBadge(row.status)}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID: {row.restaurant_id}</span>
        </div>

        {/* Metric grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1,
          borderBottom: '1px solid var(--border)' }}>
          {[
            ['Total Orders', row.totalOrders.toLocaleString()],
            ['Delivered',    row.deliveredOrders.toLocaleString()],
            ['Cancelled',    row.cancelledOrders.toLocaleString()],
            ['Revenue',      inr(row.revenue)],
            ['Avg Order Val', inr(row.aov)],
            ['Rating',       stars(row.rating)],
            ['Avg Delivery', `${row.avgDeliveryTime} min`],
            ['Cancel Rate',  pct(row.cancellationRate)],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: '12px 20px', background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase',
                letterSpacing: '.04em', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Radar chart */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Performance Profile
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
            All metrics normalised 0–100 (higher is better)
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <Radar name="Score" dataKey="value" stroke={C[0]} fill={C[0]} fillOpacity={0.25} strokeWidth={2} />
              <Tooltip contentStyle={TS} labelStyle={TL} formatter={(v) => [fv(v).toFixed(0), 'Score']} />
            </RadarChart>
          </ResponsiveContainer>
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

// ─── Restaurants Page ─────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
type SortKey = keyof RestaurantRow | '';

export default function RestaurantsPage() {
  const filterState    = useFilters();
  const filters        = useMemo(() => toDashboardFilters(filterState), [filterState]);
  const allOrders      = useMemo(() => getRawOrders(), []);
  const allRestaurants = useMemo(() => getRawRestaurants(), []);
  const { reset }      = useFilterDispatch();

  // Apply global filters to orders, then compute restaurant metrics
  const filteredOrders = useMemo(() => applyFilters(allOrders, filters), [allOrders, filters]);
  const { kpi, rows }  = useMemo(
    () => getRestaurantsPageData(filteredOrders, allRestaurants),
    [filteredOrders, allRestaurants]
  );

  // Table state
  const [search,   setSearch]   = useState('');
  const [sortKey,  setSortKey]  = useState<SortKey>('revenue');
  const [sortDir,  setSortDir]  = useState<SortDir>('desc');
  const [page,     setPage]     = useState(1);
  const [selected, setSelected] = useState<RestaurantRow | null>(null);

  useMemo(() => setPage(1), [filters]);

  const tableRows = useMemo(() => {
    let r = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((row) =>
        row.restaurant_name.toLowerCase().includes(q) ||
        row.cuisine.toLowerCase().includes(q) ||
        row.city.toLowerCase().includes(q)
      );
    }
    if (sortKey) {
      r = [...r].sort((a, b) => {
        const av = a[sortKey as keyof RestaurantRow];
        const bv = b[sortKey as keyof RestaurantRow];
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return r;
  }, [rows, search, sortKey, sortDir]);

  const totalPages  = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows    = tableRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

  // Chart datasets — top 10 slices
  const topRevenue  = [...rows].sort((a, b) => b.revenue - a.revenue).slice(0, 10)
    .map((r) => ({ name: r.restaurant_name.slice(0, 16), revenue: r.revenue })).reverse();

  const topOrders   = [...rows].sort((a, b) => b.totalOrders - a.totalOrders).slice(0, 10)
    .map((r) => ({ name: r.restaurant_name.slice(0, 16), orders: r.totalOrders })).reverse();

  const bestRated   = [...rows].filter((r) => r.rating > 0).sort((a, b) => b.rating - a.rating).slice(0, 10)
    .map((r) => ({ name: r.restaurant_name.slice(0, 16), rating: r.rating })).reverse();

  const fastest     = [...rows].filter((r) => r.avgDeliveryTime > 0).sort((a, b) => a.avgDeliveryTime - b.avgDeliveryTime).slice(0, 10)
    .map((r) => ({ name: r.restaurant_name.slice(0, 16), time: r.avgDeliveryTime }));

  const highestCancel = [...rows].sort((a, b) => b.cancellationRate - a.cancellationRate).slice(0, 10)
    .map((r) => ({ name: r.restaurant_name.slice(0, 16), rate: r.cancellationRate })).reverse();

  return (
    <div>
      <GlobalFilterBar matchingCount={filteredOrders.length} totalCount={allOrders.length} />

      {/* Summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>{kpi.totalRestaurants}</strong> restaurants
          {' · '}<span style={{ color: 'var(--text-muted)' }}>{filterState.dateLabel}</span>
        </div>
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 20px', textAlign: 'center', gap: 16 }}>
            <div style={{ fontSize: 48 }}>🍽️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>No restaurants match your filters</div>
            <button onClick={reset} style={{ padding: '8px 20px', borderRadius: 'var(--radius-md)',
              fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginBottom: 20 }}>
            <KPICard label="Total Restaurants" value={kpi.totalRestaurants.toLocaleString()}
              icon={<Store size={17} />} iconBg="var(--accent-light)" iconColor="var(--accent)" />
            <KPICard label="Active Restaurants" value={kpi.activeRestaurants.toLocaleString()}
              icon={<TrendingUp size={17} />} iconBg="var(--success-light)" iconColor="var(--success)" />
            <KPICard label="Avg Rating"         value={`${kpi.avgRating.toFixed(2)} / 5`}
              icon={<Star size={17} />} iconBg="#fef9c3" iconColor="#ca8a04" />
            <KPICard label="Avg Delivery Time"  value={`${kpi.avgDeliveryTime} min`}
              icon={<Clock size={17} />} iconBg="var(--warning-light)" iconColor="var(--warning)" />
            <KPICard label="Total Revenue"       value={inr(kpi.totalRevenue)}
              icon={<DollarSign size={17} />} iconBg="var(--success-light)" iconColor="var(--success)" />
          </div>

          {/* Charts row 1 */}
          <div className="charts-grid-2" style={{ marginBottom: 20 }}>
            <ChartCard title="Top 10 by Revenue" subtitle="Total delivered revenue">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topRevenue} layout="vertical"
                  margin={{ top: 0, right: 70, left: 0, bottom: 0 }} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} tickFormatter={(v) => inr(fv(v))} />
                  <YAxis type="category" dataKey="name" tick={{ ...TICK, fontSize: 10 }}
                    tickLine={false} axisLine={false} width={110} />
                  <Tooltip contentStyle={TS} labelStyle={TL}
                    formatter={(v) => [inr(fv(v)), 'Revenue']} />
                  <Bar dataKey="revenue" name="Revenue" radius={[0,4,4,0]}>
                    {topRevenue.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                    <LabelList dataKey="revenue" position="right"
                      style={{ fontSize: 9, fill: 'var(--text-secondary)' }}
                      formatter={(v: unknown) => inr(fv(v))} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top 10 by Order Volume" subtitle="Total orders placed">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topOrders} layout="vertical"
                  margin={{ top: 0, right: 50, left: 0, bottom: 0 }} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ ...TICK, fontSize: 10 }}
                    tickLine={false} axisLine={false} width={110} />
                  <Tooltip contentStyle={TS} labelStyle={TL}
                    formatter={(v) => [fv(v).toLocaleString(), 'Orders']} />
                  <Bar dataKey="orders" name="Orders" radius={[0,4,4,0]}>
                    {topOrders.map((_, i) => <Cell key={i} fill={C[(i + 2) % C.length]} />)}
                    <LabelList dataKey="orders" position="right"
                      style={{ fontSize: 9, fill: 'var(--text-secondary)' }}
                      formatter={(v: unknown) => fv(v).toLocaleString()} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Charts row 2 */}
          <div className="charts-grid-2" style={{ marginBottom: 20 }}>
            <ChartCard title="Best Rated Restaurants" subtitle="Avg rating from delivered orders">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={bestRated} layout="vertical"
                  margin={{ top: 0, right: 50, left: 0, bottom: 0 }} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={TICK} tickLine={false} axisLine={false}
                    domain={[0, 5]} tickCount={6} />
                  <YAxis type="category" dataKey="name" tick={{ ...TICK, fontSize: 10 }}
                    tickLine={false} axisLine={false} width={110} />
                  <Tooltip contentStyle={TS} labelStyle={TL}
                    formatter={(v) => [`${fv(v).toFixed(2)} ★`, 'Rating']} />
                  <Bar dataKey="rating" name="Rating" radius={[0,4,4,0]}>
                    {bestRated.map((d) => (
                      <Cell key={d.name}
                        fill={d.rating >= 4.5 ? '#10b981' : d.rating >= 4 ? '#22c55e' : d.rating >= 3.5 ? '#f59e0b' : '#ef4444'} />
                    ))}
                    <LabelList dataKey="rating" position="right"
                      style={{ fontSize: 9, fill: 'var(--text-secondary)' }}
                      formatter={(v: unknown) => `${fv(v).toFixed(1)}★`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Fastest Restaurants" subtitle="Lowest avg delivery time (min)">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={fastest} layout="vertical"
                  margin={{ top: 0, right: 50, left: 0, bottom: 0 }} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={TICK} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `${v}m`} />
                  <YAxis type="category" dataKey="name" tick={{ ...TICK, fontSize: 10 }}
                    tickLine={false} axisLine={false} width={110} />
                  <Tooltip contentStyle={TS} labelStyle={TL}
                    formatter={(v) => [`${fv(v)} min`, 'Avg Delivery']} />
                  <Bar dataKey="time" name="Avg Delivery" radius={[0,4,4,0]}>
                    {fastest.map((_, i) => <Cell key={i} fill={C[(i + 4) % C.length]} />)}
                    <LabelList dataKey="time" position="right"
                      style={{ fontSize: 9, fill: 'var(--text-secondary)' }}
                      formatter={(v: unknown) => `${fv(v)}m`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Chart row 3: Highest cancellation (full width) */}
          <div style={{ marginBottom: 20 }}>
            <ChartCard title="Highest Cancellation Rate" subtitle="Top 10 restaurants by cancellation rate (lower is better)">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={highestCancel} layout="vertical"
                  margin={{ top: 0, right: 65, left: 0, bottom: 0 }} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={TICK} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `${(fv(v) * 100).toFixed(0)}%`} />
                  <YAxis type="category" dataKey="name" tick={{ ...TICK, fontSize: 10 }}
                    tickLine={false} axisLine={false} width={110} />
                  <Tooltip contentStyle={TS} labelStyle={TL}
                    formatter={(v) => [pct(fv(v)), 'Cancel Rate']} />
                  <Bar dataKey="rate" name="Cancellation Rate" radius={[0,4,4,0]}>
                    {highestCancel.map((d) => (
                      <Cell key={d.name}
                        fill={d.rate > 0.25 ? '#ef4444' : d.rate > 0.15 ? '#f97316' : '#f59e0b'} />
                    ))}
                    <LabelList dataKey="rate" position="right"
                      style={{ fontSize: 9, fill: 'var(--text-secondary)' }}
                      formatter={(v: unknown) => pct(fv(v))} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Restaurants Table */}
          <div className="card" style={{ marginBottom: 8 }}>
            <div className="card-body" style={{ paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div className="section-title">All Restaurants</div>
                  <div className="section-subtitle">
                    {tableRows.length.toLocaleString()} restaurants
                    {search ? ` matching "${search}"` : ''}
                    {' · '}Page {currentPage} / {totalPages}
                    <span style={{ color: 'var(--accent)', marginLeft: 8, fontSize: 11 }}>
                      Click a row for details
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '6px 12px', width: 260 }}>
                  <Search size={14} color="var(--text-muted)" />
                  <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search name, cuisine, city…"
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
                    <th style={{ width: 40 }}>Rank</th>
                    <ThS label="Restaurant"     k="restaurant_name" />
                    <ThS label="Cuisine"        k="cuisine" />
                    <ThS label="City"           k="city" />
                    <ThS label="Orders"         k="totalOrders" />
                    <ThS label="Revenue"        k="revenue" />
                    <ThS label="AOV"            k="aov" />
                    <ThS label="Rating"         k="rating" />
                    <ThS label="Delivery"       k="avgDeliveryTime" />
                    <ThS label="Cancel Rate"    k="cancellationRate" />
                    <ThS label="Status"         k="status" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, idx) => {
                    const globalRank = (currentPage - 1) * PAGE_SIZE + idx + 1;
                    return (
                      <tr key={row.restaurant_id} style={{ cursor: 'pointer' }}
                        onClick={() => setSelected(row)}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', fontWeight: 700 }}>
                          {globalRank}
                        </td>
                        <td style={{ fontWeight: 600, maxWidth: 160, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.restaurant_name}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.cuisine}</td>
                        <td style={{ fontSize: 12 }}>{row.city}</td>
                        <td style={{ fontWeight: 600 }}>{row.totalOrders.toLocaleString()}</td>
                        <td style={{ fontWeight: 700 }}>{inr(row.revenue)}</td>
                        <td style={{ fontSize: 12 }}>{inr(row.aov)}</td>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13 }}>
                            <span style={{ color: row.rating >= 4 ? '#10b981' : row.rating >= 3 ? '#f59e0b' : '#ef4444' }}>★</span>
                            <strong>{row.rating > 0 ? row.rating.toFixed(1) : '—'}</strong>
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {row.avgDeliveryTime > 0 ? `${row.avgDeliveryTime} min` : '—'}
                        </td>
                        <td>
                          <span style={{ fontSize: 12, fontWeight: 600,
                            color: row.cancellationRate > 0.2 ? 'var(--danger)' : row.cancellationRate > 0.1 ? 'var(--warning)' : 'var(--success)' }}>
                            {pct(row.cancellationRate)}
                          </span>
                        </td>
                        <td>{statusBadge(row.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, tableRows.length)} of {tableRows.length.toLocaleString()}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { icon: <ChevronsLeft size={14} />,  action: () => setPage(1),          disabled: currentPage === 1 },
                  { icon: <ChevronLeft  size={14} />,  action: () => setPage((p) => p-1), disabled: currentPage === 1 },
                  { icon: <ChevronRight size={14} />,  action: () => setPage((p) => p+1), disabled: currentPage === totalPages },
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
      {selected && <RestaurantDetailPanel row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
