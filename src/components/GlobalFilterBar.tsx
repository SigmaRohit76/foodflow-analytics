/**
 * GlobalFilterBar — 9-dimension filter panel.
 *
 * Dimensions: Date range · City · Area · Restaurant · Category ·
 *             Cuisine · Status · Payment · Min Rating
 *
 * Features:
 *  - Quick date presets
 *  - Custom date-range pickers
 *  - Expandable panel for deep filters
 *  - Active filter count badge
 *  - Active filter chips with individual × removal
 *  - Clear Filters button
 *  - Matching-record count badge (passed in as prop)
 */
import { useState, useMemo } from 'react';
import { Filter, RotateCcw, ChevronDown, X, Search } from 'lucide-react';
import {
  useFilters,
  useFilterDispatch,
  countActiveFilters,
  FILTER_OPTIONS,
} from '../context/FilterContext';

// ─── Date presets ─────────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { label: 'All',  from: '2024-01-01', to: '2024-12-31' },
  { label: 'H1',   from: '2024-01-01', to: '2024-06-30' },
  { label: 'H2',   from: '2024-07-01', to: '2024-12-31' },
  { label: 'Q1',   from: '2024-01-01', to: '2024-03-31' },
  { label: 'Q2',   from: '2024-04-01', to: '2024-06-30' },
  { label: 'Q3',   from: '2024-07-01', to: '2024-09-30' },
  { label: 'Q4',   from: '2024-10-01', to: '2024-12-31' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  Delivered:          '#10b981',
  Cancelled:          '#ef4444',
  Pending:            '#94a3b8',
  Preparing:          '#f59e0b',
  'Out for Delivery': '#6366f1',
};

// ─── Chip ────────────────────────────────────────────────────────────────────

function Chip({ label, active, onClick, color }: {
  label: string; active: boolean; onClick: () => void; color?: string;
}) {
  const accent = color ?? 'var(--accent)';
  return (
    <button onClick={onClick} style={{
      padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
      border: `1.5px solid ${active ? accent : 'var(--border)'}`,
      background: active ? (color ? color + '20' : 'var(--accent-light)') : 'var(--bg-surface)',
      color: active ? accent : 'var(--text-secondary)',
      cursor: 'pointer', transition: 'all 120ms', whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  );
}

// ─── Searchable select list ───────────────────────────────────────────────────

function SearchableList({ options, selected, onToggle, placeholder }: {
  options: { value: string; label: string; sub?: string }[];
  selected: string[] | undefined;
  onToggle: (v: string) => void;
  placeholder: string;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())),
    [options, q]
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 320 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-surface-2)' }}>
        <Search size={12} color="var(--text-muted)" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
          style={{ border: 'none', background: 'none', outline: 'none', fontSize: 12,
            color: 'var(--text-primary)', flex: 1 }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
        {filtered.slice(0, 40).map((o) => (
          <Chip key={o.value} label={o.label} active={selected?.includes(o.value) ?? false}
            onClick={() => onToggle(o.value)} />
        ))}
      </div>
    </div>
  );
}

// ─── FilterRow wrapper ────────────────────────────────────────────────────────

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
        letterSpacing: '.06em', minWidth: 76, paddingTop: 6, flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ─── Active tag chip ──────────────────────────────────────────────────────────

function ActiveTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
      background: 'var(--accent-light)', color: 'var(--accent)', padding: '3px 8px', borderRadius: 99 }}>
      {label}
      <button onClick={onRemove} style={{ display: 'flex', background: 'none', border: 'none',
        cursor: 'pointer', padding: 0, color: 'inherit', lineHeight: 1 }}>
        <X size={9} />
      </button>
    </span>
  );
}

// ─── GlobalFilterBar ──────────────────────────────────────────────────────────

interface GlobalFilterBarProps {
  matchingCount: number;
  totalCount:    number;
}

export function GlobalFilterBar({ matchingCount, totalCount }: GlobalFilterBarProps) {
  const filters  = useFilters();
  const actions  = useFilterDispatch();
  const [open, setOpen] = useState(false);

  const activeCount = countActiveFilters(filters);
  const hasDateChange = filters.dateFrom !== FILTER_OPTIONS.minDate || filters.dateTo !== FILTER_OPTIONS.maxDate;
  const showReset     = activeCount > 0 || hasDateChange;

  // Resolve restaurant names for active-tag display
  const restaurantNames = useMemo(() => {
    const map = new Map(FILTER_OPTIONS.restaurants.map((r) => [r.id, r.name]));
    return filters.restaurants?.map((id) => ({ id, name: map.get(id) ?? id })) ?? [];
  }, [filters.restaurants]);

  // Restaurant options for searchable list
  const restOpts = useMemo(
    () => FILTER_OPTIONS.restaurants.map((r) => ({ value: r.id, label: r.name, sub: r.city })),
    []
  );
  const areaOpts  = useMemo(() => FILTER_OPTIONS.areas.map((a)    => ({ value: a, label: a })), []);
  const cusineOpts = useMemo(() => FILTER_OPTIONS.cuisines.map((c) => ({ value: c, label: c })), []);

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', marginBottom: 20, overflow: 'hidden' }}>

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap' }}>

        {/* Label + count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <Filter size={14} color="var(--text-secondary)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Filters</span>
          {activeCount > 0 && (
            <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700,
              padding: '1px 6px', borderRadius: 99 }}>
              {activeCount}
            </span>
          )}
        </div>

        {/* Date presets */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {DATE_PRESETS.map((p) => (
            <Chip key={p.label} label={p.label}
              active={filters.dateFrom === p.from && filters.dateTo === p.to}
              onClick={() => actions.setDateRange(p.from, p.to)} />
          ))}
        </div>

        {/* Custom date pickers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {(['dateFrom', 'dateTo'] as const).map((field, i) => (
            <input key={field} type="date"
              value={filters[field] ?? ''}
              min={i === 0 ? FILTER_OPTIONS.minDate : (filters.dateFrom ?? FILTER_OPTIONS.minDate)}
              max={i === 0 ? (filters.dateTo ?? FILTER_OPTIONS.maxDate) : FILTER_OPTIONS.maxDate}
              onChange={(e) => {
                const v = e.target.value;
                if (i === 0) actions.setDateRange(v, filters.dateTo ?? FILTER_OPTIONS.maxDate);
                else         actions.setDateRange(filters.dateFrom ?? FILTER_OPTIONS.minDate, v);
              }}
              style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                padding: '4px 8px', fontSize: 12, background: 'var(--bg-surface-2)',
                color: 'var(--text-primary)', outline: 'none' }} />
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Matching count badge */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
          background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
          padding: '4px 10px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 800 }}>
            {matchingCount.toLocaleString('en-IN')}
          </span>
          <span style={{ color: 'var(--text-muted)' }}> / {totalCount.toLocaleString('en-IN')} orders</span>
        </div>

        {/* Expand toggle */}
        <button onClick={() => setOpen((v) => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
          color: open ? 'var(--accent)' : 'var(--text-secondary)',
          padding: '4px 10px', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', background: open ? 'var(--accent-light)' : 'transparent',
          cursor: 'pointer', flexShrink: 0 }}>
          More
          <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '150ms' }} />
        </button>

        {/* Reset */}
        {showReset && (
          <button onClick={actions.reset} style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
            color: 'var(--danger)', padding: '4px 10px',
            border: '1px solid transparent', borderRadius: 'var(--radius-sm)',
            background: 'var(--danger-light)', cursor: 'pointer', flexShrink: 0 }}>
            <RotateCcw size={11} /> Clear
          </button>
        )}
      </div>

      {/* ── Active filter chips ── */}
      {activeCount > 0 && (
        <div style={{ padding: '0 16px 10px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {filters.cities?.map((c)     => <ActiveTag key={c} label={`City: ${c}`}      onRemove={() => actions.toggleCity(c)} />)}
          {filters.areas?.map((a)      => <ActiveTag key={a} label={`Area: ${a}`}       onRemove={() => actions.toggleArea(a)} />)}
          {restaurantNames.map((r)     => <ActiveTag key={r.id} label={`Rest: ${r.name}`} onRemove={() => actions.toggleRestaurant(r.id)} />)}
          {filters.categories?.map((c) => <ActiveTag key={c} label={`Cat: ${c}`}        onRemove={() => actions.toggleCategory(c)} />)}
          {filters.cuisines?.map((c)   => <ActiveTag key={c} label={`Cuisine: ${c}`}    onRemove={() => actions.toggleCuisine(c)} />)}
          {filters.statuses?.map((s)   => <ActiveTag key={s} label={`Status: ${s}`}     onRemove={() => actions.toggleStatus(s)} />)}
          {filters.paymentMethods?.map((m) => <ActiveTag key={m} label={`Pay: ${m}`}    onRemove={() => actions.togglePayment(m)} />)}
          {filters.minRating !== undefined && (
            <ActiveTag label={`Rating ≥ ${filters.minRating}`} onRemove={() => actions.setMinRating(undefined)} />
          )}
        </div>
      )}

      {/* ── Expanded panel ── */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px',
          display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Row 1: City + Area */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <FilterRow label="City">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {FILTER_OPTIONS.cities.map((c) => (
                  <Chip key={c} label={c}
                    active={filters.cities?.includes(c) ?? false}
                    onClick={() => actions.toggleCity(c)} />
                ))}
              </div>
            </FilterRow>

            <FilterRow label="Area">
              <SearchableList options={areaOpts} selected={filters.areas}
                onToggle={actions.toggleArea} placeholder="Search areas…" />
            </FilterRow>
          </div>

          {/* Row 2: Restaurant + Cuisine */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <FilterRow label="Restaurant">
              <SearchableList options={restOpts} selected={filters.restaurants}
                onToggle={actions.toggleRestaurant} placeholder="Search restaurants…" />
            </FilterRow>

            <FilterRow label="Cuisine">
              <SearchableList options={cusineOpts} selected={filters.cuisines}
                onToggle={actions.toggleCuisine} placeholder="Search cuisines…" />
            </FilterRow>
          </div>

          {/* Row 3: Category */}
          <FilterRow label="Category">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {FILTER_OPTIONS.categories.map((c) => (
                <Chip key={c} label={c}
                  active={filters.categories?.includes(c) ?? false}
                  onClick={() => actions.toggleCategory(c)} />
              ))}
            </div>
          </FilterRow>

          {/* Row 4: Status + Payment */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <FilterRow label="Status">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {FILTER_OPTIONS.statuses.map((s) => (
                  <Chip key={s} label={s}
                    active={filters.statuses?.includes(s) ?? false}
                    onClick={() => actions.toggleStatus(s)}
                    color={STATUS_COLORS[s]} />
                ))}
              </div>
            </FilterRow>

            <FilterRow label="Payment">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {FILTER_OPTIONS.paymentMethods.map((m) => (
                  <Chip key={m} label={m}
                    active={filters.paymentMethods?.includes(m) ?? false}
                    onClick={() => actions.togglePayment(m)} />
                ))}
              </div>
            </FilterRow>
          </div>

          {/* Row 5: Rating */}
          <FilterRow label="Min Rating">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
              <Chip label="Any" active={filters.minRating === undefined}
                onClick={() => actions.setMinRating(undefined)} />
              {FILTER_OPTIONS.ratingOptions.map((r) => (
                <Chip key={r} label={`≥ ${r}★`}
                  active={filters.minRating === r}
                  onClick={() => actions.setMinRating(filters.minRating === r ? undefined : r)}
                  color="#ca8a04" />
              ))}
            </div>
          </FilterRow>
        </div>
      )}
    </div>
  );
}
