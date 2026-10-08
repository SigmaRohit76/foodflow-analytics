import { useMemo } from 'react';
import {
  ShoppingCart, DollarSign, CreditCard, Clock, Star, XCircle,
} from 'lucide-react';
import { KPICard }                 from '../components/KPICard';
import { GlobalFilterBar }         from '../components/GlobalFilterBar';
import { InsightsPanel }           from '../components/InsightsPanel';
import { OrderStatusBadge, StarRating } from '../components/Badge';
import {
  ChartOrdersRevenueTrend,
  ChartOrdersByStatus,
  ChartRevenueByCategory,
  ChartDeliveryByCity,
  ChartRatingDistribution,
  ChartOrdersByPayment,
  ChartOrderValueDistrib,
  ChartTopRestaurants,
  ChartOrdersByDow,
  ChartOrdersByHour,
} from '../components/DashboardCharts';
import { getKPIWithComparison, getFilteredAggregations, getRawOrders } from '../services/dataService';
import { useFilters, useFilterDispatch, toDashboardFilters }            from '../context/FilterContext';

// ─── Formatters ───────────────────────────────────────────────────────────────

function inr(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}
function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 20px', textAlign: 'center', gap: 16 }}>
      <div style={{ fontSize: 52 }}>🔍</div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          No orders match your filters
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 380 }}>
          The current combination of filters returns 0 results. Try broadening
          your date range or removing some filter chips.
        </div>
      </div>
      <button onClick={onReset} style={{
        padding: '8px 20px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700,
        background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer',
      }}>
        Clear All Filters
      </button>
    </div>
  );
}

// ─── 2-col responsive grid ────────────────────────────────────────────────────

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="charts-grid-2" style={{ marginBottom: 20 }}>{children}</div>;
}
function Full({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 20 }}>{children}</div>;
}

// ─── Overview Page ────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const filterState  = useFilters();
  const filters      = useMemo(() => toDashboardFilters(filterState), [filterState]);
  const totalOrders  = useMemo(() => getRawOrders().length, []);

  // All data from the same filtered slice
  const kpi = useMemo(() => getKPIWithComparison(filters), [filters]);
  const agg = useMemo(() => getFilteredAggregations(filters), [filters]);

  const noResults = agg.orders.length === 0;
  const cl        = kpi.comparisonLabel;
  const { reset } = useFilterDispatch();

  return (
    <div>
      {/* ── Global filter bar ──────────────────────────────────────────── */}
      <GlobalFilterBar matchingCount={agg.orders.length} totalCount={totalOrders} />

      {/* ── Summary strip ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Showing{' '}
          <strong style={{ color: 'var(--text-primary)' }}>
            {agg.orders.length.toLocaleString('en-IN')}
          </strong>{' '}
          orders · <span style={{ color: 'var(--text-muted)' }}>{filterState.dateLabel}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          KPIs compared: <strong style={{ color: 'var(--text-secondary)' }}>{cl}</strong>
        </div>
      </div>

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {noResults && (
        <div className="card" style={{ marginBottom: 20 }}>
          <EmptyState onReset={reset} />
        </div>
      )}

      {!noResults && (
        <>
          {/* ── KPI Cards ───────────────────────────────────────────────── */}
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <KPICard label="Total Orders"
              value={kpi.totalOrders.toLocaleString('en-IN')}
              icon={<ShoppingCart size={17} />}
              iconBg="var(--accent-light)" iconColor="var(--accent)"
              delta={kpi.deltas.totalOrders}
              prevValueLabel={kpi.prev.totalOrders.toLocaleString('en-IN')}
              comparisonLabel={cl} />

            <KPICard label="Total Revenue"
              value={inr(kpi.totalRevenue)}
              icon={<DollarSign size={17} />}
              iconBg="var(--success-light)" iconColor="var(--success)"
              delta={kpi.deltas.totalRevenue}
              prevValueLabel={inr(kpi.prev.totalRevenue)}
              comparisonLabel={cl} />

            <KPICard label="Avg Order Value"
              value={inr(kpi.averageOrderValue)}
              icon={<CreditCard size={17} />}
              iconBg="var(--info-light)" iconColor="var(--info)"
              delta={kpi.deltas.averageOrderValue}
              prevValueLabel={inr(kpi.prev.averageOrderValue)}
              comparisonLabel={cl} />

            <KPICard label="Avg Delivery Time"
              value={`${kpi.averageDeliveryTime} min`}
              icon={<Clock size={17} />}
              iconBg="var(--warning-light)" iconColor="var(--warning)"
              delta={kpi.deltas.averageDeliveryTime}
              prevValueLabel={`${kpi.prev.averageDeliveryTime} min`}
              comparisonLabel={cl} />

            <KPICard label="Avg Rating"
              value={`${kpi.averageRating.toFixed(2)} / 5`}
              icon={<Star size={17} />}
              iconBg="#fef9c3" iconColor="#ca8a04"
              delta={kpi.deltas.averageRating}
              prevValueLabel={`${kpi.prev.averageRating.toFixed(2)}`}
              comparisonLabel={cl} />

            <KPICard label="Cancellation Rate"
              value={pct(kpi.cancellationRate)}
              icon={<XCircle size={17} />}
              iconBg="var(--danger-light)" iconColor="var(--danger)"
              delta={kpi.deltas.cancellationRate}
              prevValueLabel={pct(kpi.prev.cancellationRate)}
              comparisonLabel={cl} />
          </div>

          {/* ── Key Business Insights ────────────────────────────────── */}
          <InsightsPanel orders={agg.orders} />

          {/* ── Chart 1: Orders & Revenue Trend (full width) ─────────── */}
          <Full><ChartOrdersRevenueTrend data={agg.monthlyTrend} /></Full>

          {/* ── Charts 2 + 6: Status + Payment donuts ─────────────────── */}
          <Grid2>
            <ChartOrdersByStatus   data={agg.statusBreakdown}  />
            <ChartOrdersByPayment  data={agg.paymentBreakdown} />
          </Grid2>

          {/* ── Charts 9 + 10: Day of week + Hour ────────────────────── */}
          <Grid2>
            <ChartOrdersByDow  data={agg.ordersByDow}  />
            <ChartOrdersByHour data={agg.ordersByHour} />
          </Grid2>

          {/* ── Chart 3: Revenue by Category (full width) ─────────────── */}
          <Full><ChartRevenueByCategory data={agg.categoryBreakdown} /></Full>

          {/* ── Charts 4 + 5: Delivery by city + Rating distribution ─── */}
          <Grid2>
            <ChartDeliveryByCity      data={agg.deliveryByCity}       />
            <ChartRatingDistribution  data={agg.ratingDistribution}   />
          </Grid2>

          {/* ── Charts 7 + 8: Order-value dist + Top restaurants ─────── */}
          <Grid2>
            <ChartOrderValueDistrib data={agg.orderValueDistribution} />
            <ChartTopRestaurants    data={agg.topRestaurants}         />
          </Grid2>

          {/* ── Recent Orders table ───────────────────────────────────── */}
          <div className="card" style={{ marginBottom: 8 }}>
            <div className="card-body">
              <div className="section-header">
                <div>
                  <div className="section-title">Recent Orders</div>
                  <div className="section-subtitle">
                    Latest {agg.recentOrders.length} delivered orders in selected period
                  </div>
                </div>
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Restaurant</th>
                    <th>Category</th>
                    <th>Cuisine</th>
                    <th>City</th>
                    <th>Area</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Rating</th>
                    <th>Delivery</th>
                    <th>Payment</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {agg.recentOrders.map((o) => (
                    <tr key={o.order_id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                        {o.order_id}
                      </td>
                      <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {o.restaurant_name}
                      </td>
                      <td>{o.food_category}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{o.cuisine}</td>
                      <td>{o.city}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{o.area}</td>
                      <td style={{ fontWeight: 700 }}>₹{o.final_amount.toLocaleString('en-IN')}</td>
                      <td><OrderStatusBadge status={o.order_status} /></td>
                      <td><StarRating value={o.rating} /></td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{o.delivery_time_minutes} min</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{o.payment_method}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{o.order_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
