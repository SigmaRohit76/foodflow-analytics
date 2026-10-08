import { useState, useRef, useEffect, useMemo } from 'react';
import { Download, FileText, ChevronDown, FileJson, FileSpreadsheet } from 'lucide-react';
import {
  exportOrdersCsv, exportOrdersJson,
  exportRestaurantsCsv, exportRestaurantsJson,
  exportCustomersCsv, exportCustomersJson,
  downloadReport,
} from '../services/exportService';
import { generateInsights } from '../services/insightsService';
import {
  getRawOrders, getRawRestaurants, getRawCustomers,
  applyFilters, getKPIWithComparison,
} from '../services/dataService';
import { useFilters, toDashboardFilters } from '../context/FilterContext';

// ─── Menu item ────────────────────────────────────────────────────────────────

function MenuItem({
  icon, label, sub, onClick, separator,
}: {
  icon: React.ReactNode; label: string; sub?: string;
  onClick: () => void; separator?: boolean;
}) {
  return (
    <>
      {separator && <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />}
      <button
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '8px 12px', borderRadius: 'var(--radius-sm)',
          background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', transition: 'background var(--transition)',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>{label}</span>
          {sub && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</span>}
        </span>
      </button>
    </>
  );
}

// ─── Export menu ──────────────────────────────────────────────────────────────

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filters    = useFilters();
  const dfFilters  = toDashboardFilters(filters);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Filtered data computed lazily when menu opens or export is triggered
  const filteredOrders = useMemo(() => applyFilters(getRawOrders(), dfFilters), [dfFilters]);

  function handleOrderCsv()        { exportOrdersCsv(filteredOrders);           setOpen(false); }
  function handleOrderJson()       { exportOrdersJson(filteredOrders);           setOpen(false); }
  function handleRestaurantCsv()   { exportRestaurantsCsv(getRawRestaurants());  setOpen(false); }
  function handleRestaurantJson()  { exportRestaurantsJson(getRawRestaurants()); setOpen(false); }
  function handleCustomerCsv()     { exportCustomersCsv(getRawCustomers());      setOpen(false); }
  function handleCustomerJson()    { exportCustomersJson(getRawCustomers());      setOpen(false); }

  function handleReport() {
    const kpi      = getKPIWithComparison(dfFilters);
    const insights = generateInsights(filteredOrders);
    downloadReport({
      dateRange:   filters.dateLabel ?? 'All Dates',
      generatedAt: new Date().toLocaleString('en-IN'),
      kpi,
      orders:      filteredOrders,
      restaurants: getRawRestaurants(),
      customers:   getRawCustomers(),
      insights:    insights.map(i => ({ title: i.title, body: i.body, type: i.type })),
    });
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--accent)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-sm)',
          padding: '6px 12px', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', transition: 'background var(--transition)',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
        title="Export data"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={14} />
        Export
        <ChevronDown size={12} style={{ opacity: 0.7 }} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            minWidth: 240, zIndex: 200,
            padding: '6px',
          }}
        >
          {/* Report */}
          <MenuItem
            icon={<FileText size={14} />}
            label="Download Full Report"
            sub="HTML report with all KPIs & insights"
            onClick={handleReport}
          />

          {/* Orders */}
          <MenuItem separator icon={<FileSpreadsheet size={14} />}
            label="Export Orders — CSV"
            sub={`${filteredOrders.length.toLocaleString('en-IN')} filtered orders`}
            onClick={handleOrderCsv} />
          <MenuItem icon={<FileJson size={14} />}
            label="Export Orders — JSON"
            sub={`${filteredOrders.length.toLocaleString('en-IN')} filtered orders`}
            onClick={handleOrderJson} />

          {/* Restaurants */}
          <MenuItem separator icon={<FileSpreadsheet size={14} />}
            label="Export Restaurants — CSV"
            sub={`${getRawRestaurants().length} restaurants`}
            onClick={handleRestaurantCsv} />
          <MenuItem icon={<FileJson size={14} />}
            label="Export Restaurants — JSON"
            sub={`${getRawRestaurants().length} restaurants`}
            onClick={handleRestaurantJson} />

          {/* Customers */}
          <MenuItem separator icon={<FileSpreadsheet size={14} />}
            label="Export Customers — CSV"
            sub={`${getRawCustomers().length.toLocaleString('en-IN')} customers`}
            onClick={handleCustomerCsv} />
          <MenuItem icon={<FileJson size={14} />}
            label="Export Customers — JSON"
            sub={`${getRawCustomers().length.toLocaleString('en-IN')} customers`}
            onClick={handleCustomerJson} />
        </div>
      )}
    </div>
  );
}
