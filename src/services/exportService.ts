/**
 * ─── FoodFlow Analytics — Export Service ─────────────────────────────────────
 *
 * Provides CSV, JSON and HTML-report export for filtered orders, restaurants
 * and customers. All data comes from the centralized data service.
 * Zero hardcoded analytics — every figure is computed at call time.
 */

import type { Order, Customer, Restaurant } from '../types';
import type { KPISummary } from './dataService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inr(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function pct(n: number): string { return `${(n * 100).toFixed(1)}%`; }

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsv(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n'))
    return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  return lines.join('\n');
}

function ts(): string {
  return new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
}

// ─── Orders CSV ───────────────────────────────────────────────────────────────

export function exportOrdersCsv(orders: Order[]): void {
  const headers = [
    'order_id','customer_id','restaurant_id','restaurant_name','food_category',
    'cuisine','order_date','order_time','order_amount','delivery_fee','discount',
    'final_amount','delivery_time_minutes','order_status','payment_method',
    'city','area','rating',
  ];
  const rows = orders.map(o => [
    o.order_id, o.customer_id, o.restaurant_id, o.restaurant_name, o.food_category,
    o.cuisine, o.order_date, o.order_time, o.order_amount, o.delivery_fee, o.discount,
    o.final_amount, o.delivery_time_minutes, o.order_status, o.payment_method,
    o.city, o.area, o.rating,
  ]);
  downloadBlob(toCsv(headers, rows), `foodflow_orders_${ts()}.csv`, 'text/csv');
}

// ─── Orders JSON ──────────────────────────────────────────────────────────────

export function exportOrdersJson(orders: Order[]): void {
  downloadBlob(JSON.stringify(orders, null, 2), `foodflow_orders_${ts()}.json`, 'application/json');
}

// ─── Restaurants CSV ──────────────────────────────────────────────────────────

export function exportRestaurantsCsv(restaurants: Restaurant[]): void {
  const headers = [
    'restaurant_id','restaurant_name','cuisine','city','area','rating',
    'total_orders','total_revenue','average_delivery_time','cancellation_rate','status',
  ];
  const rows = restaurants.map(r => [
    r.restaurant_id, r.restaurant_name, r.cuisine, r.city, r.area, r.rating,
    r.total_orders, r.total_revenue, r.average_delivery_time, r.cancellation_rate, r.status,
  ]);
  downloadBlob(toCsv(headers, rows), `foodflow_restaurants_${ts()}.csv`, 'text/csv');
}

// ─── Restaurants JSON ─────────────────────────────────────────────────────────

export function exportRestaurantsJson(restaurants: Restaurant[]): void {
  downloadBlob(JSON.stringify(restaurants, null, 2), `foodflow_restaurants_${ts()}.json`, 'application/json');
}

// ─── Customers CSV ────────────────────────────────────────────────────────────

export function exportCustomersCsv(customers: Customer[]): void {
  const headers = [
    'customer_id','customer_name','city','area',
    'total_orders','total_spending','average_order_value','customer_type',
  ];
  const rows = customers.map(c => [
    c.customer_id, c.customer_name, c.city, c.area,
    c.total_orders, c.total_spending, c.average_order_value, c.customer_type,
  ]);
  downloadBlob(toCsv(headers, rows), `foodflow_customers_${ts()}.csv`, 'text/csv');
}

// ─── Customers JSON ───────────────────────────────────────────────────────────

export function exportCustomersJson(customers: Customer[]): void {
  downloadBlob(JSON.stringify(customers, null, 2), `foodflow_customers_${ts()}.json`, 'application/json');
}

// ─── Report generation ────────────────────────────────────────────────────────

export interface ReportData {
  dateRange: string;
  generatedAt: string;
  kpi: KPISummary;
  orders: Order[];
  restaurants: Restaurant[];
  customers: Customer[];
  insights: { title: string; body: string; type: string }[];
}

export function downloadReport(data: ReportData): void {
  const delivered   = data.orders.filter(o => o.order_status === 'Delivered');
  const cancelled   = data.orders.filter(o => o.order_status === 'Cancelled');
  const totalRevenue = delivered.reduce((s, o) => s + o.final_amount, 0);

  // Top 10 restaurants by revenue
  const restRev = new Map<string, { name: string; city: string; orders: number; rev: number }>();
  for (const o of delivered) {
    if (!restRev.has(o.restaurant_id)) restRev.set(o.restaurant_id, { name: o.restaurant_name, city: o.city, orders: 0, rev: 0 });
    restRev.get(o.restaurant_id)!.orders++;
    restRev.get(o.restaurant_id)!.rev += o.final_amount;
  }
  const topRestaurants = [...restRev.values()].sort((a, b) => b.rev - a.rev).slice(0, 10);

  // Revenue by category
  const catRev = new Map<string, number>();
  for (const o of delivered) catRev.set(o.food_category, (catRev.get(o.food_category) ?? 0) + o.final_amount);
  const catRows = [...catRev.entries()].sort(([, a], [, b]) => b - a);

  // Revenue by city
  const cityRev = new Map<string, { orders: number; rev: number }>();
  for (const o of delivered) {
    if (!cityRev.has(o.city)) cityRev.set(o.city, { orders: 0, rev: 0 });
    cityRev.get(o.city)!.orders++;
    cityRev.get(o.city)!.rev += o.final_amount;
  }
  const cityRows = [...cityRev.entries()].sort(([, a], [, b]) => b.rev - a.rev);

  // Delivery performance
  const avgDel = delivered.length ? delivered.reduce((s, o) => s + o.delivery_time_minutes, 0) / delivered.length : 0;
  const onTime = delivered.filter(o => o.delivery_time_minutes <= 45).length;
  const late   = delivered.filter(o => o.delivery_time_minutes > 60).length;

  const insightColor: Record<string, string> = {
    positive: '#10b981', negative: '#ef4444', warning: '#f59e0b', neutral: '#6366f1',
  };
  const insightBg: Record<string, string> = {
    positive: '#f0fdf4', negative: '#fef2f2', warning: '#fffbeb', neutral: '#eef2ff',
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FoodFlow Analytics Report — ${data.dateRange}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system,"Segoe UI",system-ui,sans-serif; font-size: 13px; line-height: 1.6; color: #1f2328; background: #fff; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px 32px; }
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
  .logo { width: 40px; height: 40px; background: #1d4ed8; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
  .header-text h1 { font-size: 20px; font-weight: 800; color: #0f172a; }
  .header-text p { font-size: 12px; color: #57606a; margin-top: 2px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 8px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
  .kpi-card { background: #f7f8fa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; }
  .kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #57606a; }
  .kpi-value { font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px; }
  .kpi-sub { font-size: 11px; color: #57606a; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; padding: 8px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #57606a; background: #f7f8fa; border-bottom: 1px solid #e5e7eb; }
  td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; color: #1f2328; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .insight-card { border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; border: 1px solid; }
  .insight-title { font-size: 12px; font-weight: 700; margin-bottom: 3px; }
  .insight-body { font-size: 12px; line-height: 1.5; }
  .bar-wrap { height: 8px; background: #e5e7eb; border-radius: 99px; overflow: hidden; display: inline-block; width: 80px; vertical-align: middle; margin-right: 6px; }
  .bar-fill { height: 100%; border-radius: 99px; background: #1d4ed8; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #57606a; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="logo">🍛</div>
    <div class="header-text">
      <h1>FoodFlow Analytics Report</h1>
      <p>Period: ${data.dateRange} &nbsp;·&nbsp; Generated: ${data.generatedAt} &nbsp;·&nbsp; ${data.orders.length.toLocaleString('en-IN')} orders analysed</p>
    </div>
  </div>

  <!-- KPI Summary -->
  <div class="section">
    <div class="section-title">📊 KPI Summary</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Orders</div>
        <div class="kpi-value">${data.kpi.totalOrders.toLocaleString('en-IN')}</div>
        <div class="kpi-sub">${data.kpi.deliveredOrders.toLocaleString('en-IN')} delivered</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Revenue</div>
        <div class="kpi-value">${inr(data.kpi.totalRevenue)}</div>
        <div class="kpi-sub">Net of discounts</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Avg Order Value</div>
        <div class="kpi-value">${inr(Math.round(data.kpi.averageOrderValue))}</div>
        <div class="kpi-sub">Per delivered order</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Avg Delivery Time</div>
        <div class="kpi-value">${data.kpi.averageDeliveryTime} min</div>
        <div class="kpi-sub">${inr(Math.round(avgDel * 100) / 100)} avg; on-time: ${pct(delivered.length ? onTime / delivered.length : 0)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Avg Rating</div>
        <div class="kpi-value">${data.kpi.averageRating.toFixed(2)} / 5</div>
        <div class="kpi-sub">${delivered.filter(o=>o.rating!==null).length.toLocaleString('en-IN')} ratings</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Cancellation Rate</div>
        <div class="kpi-value">${pct(data.kpi.cancellationRate)}</div>
        <div class="kpi-sub">${cancelled.length.toLocaleString('en-IN')} cancelled orders</div>
      </div>
    </div>
  </div>

  <!-- Revenue by Category -->
  <div class="section">
    <div class="section-title">🍽️ Revenue by Food Category</div>
    <table>
      <thead><tr><th>Category</th><th style="text-align:right">Revenue</th><th style="text-align:right">Share</th><th>Distribution</th></tr></thead>
      <tbody>
        ${catRows.map(([cat, rev]) => {
          const share = totalRevenue ? rev / totalRevenue : 0;
          const barW  = Math.round(share * 100);
          return `<tr>
            <td><strong>${cat}</strong></td>
            <td style="text-align:right">${inr(Math.round(rev))}</td>
            <td style="text-align:right">${pct(share)}</td>
            <td><div class="bar-wrap"><div class="bar-fill" style="width:${barW}%"></div></div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>

  <!-- Revenue by City -->
  <div class="section">
    <div class="section-title">🏙️ Revenue by City</div>
    <table>
      <thead><tr><th>City</th><th style="text-align:right">Orders</th><th style="text-align:right">Revenue</th><th style="text-align:right">Share</th></tr></thead>
      <tbody>
        ${cityRows.map(([city, d]) => {
          const share = totalRevenue ? d.rev / totalRevenue : 0;
          return `<tr>
            <td><strong>${city}</strong></td>
            <td style="text-align:right">${d.orders.toLocaleString('en-IN')}</td>
            <td style="text-align:right">${inr(Math.round(d.rev))}</td>
            <td style="text-align:right">${pct(share)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>

  <!-- Top Restaurants -->
  <div class="section">
    <div class="section-title">🏆 Top 10 Restaurants by Revenue</div>
    <table>
      <thead><tr><th>Rank</th><th>Restaurant</th><th>City</th><th style="text-align:right">Orders</th><th style="text-align:right">Revenue</th></tr></thead>
      <tbody>
        ${topRestaurants.map((r, i) => `<tr>
          <td style="color:#f59e0b;font-weight:700">#${i + 1}</td>
          <td><strong>${r.name}</strong></td>
          <td>${r.city}</td>
          <td style="text-align:right">${r.orders.toLocaleString('en-IN')}</td>
          <td style="text-align:right">${inr(Math.round(r.rev))}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <!-- Delivery Performance -->
  <div class="section">
    <div class="section-title">🚴 Delivery Performance</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Avg Delivery Time</div>
        <div class="kpi-value">${Math.round(avgDel)} min</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">On-Time Rate (≤45 min)</div>
        <div class="kpi-value">${pct(delivered.length ? onTime / delivered.length : 0)}</div>
        <div class="kpi-sub">${onTime.toLocaleString('en-IN')} orders</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Late Rate (&gt;60 min)</div>
        <div class="kpi-value">${pct(delivered.length ? late / delivered.length : 0)}</div>
        <div class="kpi-sub">${late.toLocaleString('en-IN')} orders</div>
      </div>
    </div>
  </div>

  <!-- Key Insights -->
  ${data.insights.length > 0 ? `
  <div class="section">
    <div class="section-title">💡 Key Business Insights</div>
    ${data.insights.map(ins => `
    <div class="insight-card" style="background:${insightBg[ins.type] ?? '#f7f8fa'};border-color:${insightColor[ins.type] ?? '#e5e7eb'}20">
      <div class="insight-title" style="color:${insightColor[ins.type] ?? '#0f172a'}">${ins.title}</div>
      <div class="insight-body" style="color:#1f2328">${ins.body}</div>
    </div>`).join('')}
  </div>` : ''}

  <div class="footer">
    <strong>FoodFlow Analytics</strong> &nbsp;·&nbsp; Exported ${data.generatedAt} &nbsp;·&nbsp; Data covers ${data.orders.length.toLocaleString('en-IN')} orders
  </div>
</div>
</body>
</html>`;

  downloadBlob(html, `foodflow_report_${ts()}.html`, 'text/html');
}
