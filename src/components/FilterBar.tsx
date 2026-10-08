/**
 * FilterBar — rendered at the top of pages that support filtering.
 *
 * Shows:
 *   • Date range quick-presets + from/to inputs
 *   • City multi-select chips
 *   • Food category multi-select chips
 *   • Order status chips
 *   • Active filter count badge + Reset button
 *
 * All state lives in FilterContext; this component only dispatches actions.
 */
import { useState } from 'react';
import { Filter, RotateCcw, ChevronDown, X } from 'lucide-react';
import {
  useFilters,
  useFilterDispatch,
  FILTER_OPTIONS,
} from '../context/FilterContext';

// ─── Quick date presets ───────────────────────────────────────────────────────

const DATE_PRESETS = [
  { label: 'Full Year',  from: '2024-01-01', to: '2024-12-31' },
  { label: 'H1 2024',   from: '2024-01-01', to: '2024-06-30' },
  { label: 'H2 2024',   from: '2024-07-01', to: '2024-12-31' },
  { label: 'Q1',        from: '2024-01-01', to: '2024-03-31' },
  { label: 'Q2',        from: '2024-04-01', to: '2024-06-30' },
  { label: 'Q3',        from: '2024-07-01', to: '2024-09-30' },
  { label: 'Q4',        from: '2024-10-01', to: '2024-12-31' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Chip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 600,
        border: `1.5px solid ${active ? (color ?? 'var(--accent)') : 'var(--border)'}`,
        background: active ? (color ? color + '22' : 'var(--accent-light)') : 'var(--bg-surface)',
        color: active ? (color ?? 'var(--accent)') : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 120ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

// ─── Main FilterBar ───────────────────────────────────────────────────────────

export function FilterBar() {
  const filters  = useFilters();
  const { setDateRange, toggleCity, toggleCategory, toggleStatus, togglePayment, reset } = useFilterDispatch();
  const [expanded, setExpanded] = useState(false);

  // Count active non-date filters
  const activeCount =
    (filters.cities?.length          ?? 0) +
    (filters.categories?.length      ?? 0) +
    (filters.statuses?.length        ?? 0) +
    (filters.paymentMethods?.length  ?? 0);

  const STATUS_COLORS: Record<string, string> = {
    Delivered:          '#10b981',
    Cancelled:          '#ef4444',
    Pending:            '#94a3b8',
    Preparing:          '#f59e0b',
    'Out for Delivery': '#6366f1',
  };

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      {/* ── Header row ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        flexWrap: 'wrap',
      }}>
        {/* Filter icon + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
          <Filter size={14} />
          Filters
          {activeCount > 0 && (
            <span style={{
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 99,
            }}>
              {activeCount}
            </span>
          )}
        </div>

        {/* Date presets */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {DATE_PRESETS.map((p) => {
            const active = filters.dateFrom === p.from && filters.dateTo === p.to;
            return (
              <Chip
                key={p.label}
                label={p.label}
                active={active}
                onClick={() => setDateRange(p.from, p.to)}
              />
            );
          })}
        </div>

        {/* Custom date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            min={FILTER_OPTIONS.minDate}
            max={filters.dateTo ?? FILTER_OPTIONS.maxDate}
            onChange={(e) => setDateRange(e.target.value, filters.dateTo ?? FILTER_OPTIONS.maxDate)}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              fontSize: 12,
              background: 'var(--bg-surface-2)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <span style={{ color: 'var(--text-muted)' }}>–</span>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            min={filters.dateFrom ?? FILTER_OPTIONS.minDate}
            max={FILTER_OPTIONS.maxDate}
            onChange={(e) => setDateRange(filters.dateFrom ?? FILTER_OPTIONS.minDate, e.target.value)}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              fontSize: 12,
              background: 'var(--bg-surface-2)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>

        {/* Expand / collapse */}
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12, fontWeight: 600,
            color: 'var(--text-secondary)',
            padding: '4px 10px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: expanded ? 'var(--bg-surface-2)' : 'transparent',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          More filters
          <ChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '150ms' }} />
        </button>

        {/* Reset */}
        {(activeCount > 0 || (filters.dateFrom !== FILTER_OPTIONS.minDate || filters.dateTo !== FILTER_OPTIONS.maxDate)) && (
          <button
            onClick={reset}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 600,
              color: 'var(--danger)',
              padding: '4px 10px',
              border: '1px solid var(--danger-light)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--danger-light)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <RotateCcw size={11} /> Reset
          </button>
        )}
      </div>

      {/* ── Expanded panel ── */}
      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>

          {/* Cities */}
          <FilterRow label="City">
            {FILTER_OPTIONS.cities.map((c) => (
              <Chip
                key={c}
                label={c}
                active={filters.cities?.includes(c) ?? false}
                onClick={() => toggleCity(c)}
              />
            ))}
          </FilterRow>

          {/* Categories */}
          <FilterRow label="Category">
            {FILTER_OPTIONS.categories.map((c) => (
              <Chip
                key={c}
                label={c}
                active={filters.categories?.includes(c) ?? false}
                onClick={() => toggleCategory(c)}
              />
            ))}
          </FilterRow>

          {/* Statuses */}
          <FilterRow label="Status">
            {FILTER_OPTIONS.statuses.map((s) => (
              <Chip
                key={s}
                label={s}
                active={filters.statuses?.includes(s) ?? false}
                onClick={() => toggleStatus(s)}
                color={STATUS_COLORS[s]}
              />
            ))}
          </FilterRow>

          {/* Payment methods */}
          <FilterRow label="Payment">
            {FILTER_OPTIONS.paymentMethods.map((m) => (
              <Chip
                key={m}
                label={m}
                active={filters.paymentMethods?.includes(m) ?? false}
                onClick={() => togglePayment(m)}
              />
            ))}
          </FilterRow>

          {/* Active filter summary */}
          {activeCount > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4, borderTop: '1px solid var(--border-light)' }}>
              {filters.cities?.map((c) => <ActiveTag key={c} label={c} onRemove={() => toggleCity(c)} />)}
              {filters.categories?.map((c) => <ActiveTag key={c} label={c} onRemove={() => toggleCategory(c)} />)}
              {filters.statuses?.map((s) => <ActiveTag key={s} label={s} onRemove={() => toggleStatus(s)} />)}
              {filters.paymentMethods?.map((m) => <ActiveTag key={m} label={m} onRemove={() => togglePayment(m)} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helper sub-components ────────────────────────────────────────────────────

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', minWidth: 68, paddingTop: 5 }}>
        {label}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function ActiveTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 600,
      background: 'var(--accent-light)', color: 'var(--accent)',
      padding: '3px 8px', borderRadius: 99,
    }}>
      {label}
      <X size={9} style={{ cursor: 'pointer' }} onClick={onRemove} />
    </span>
  );
}
