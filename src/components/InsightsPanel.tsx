import { useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, Info, ChevronDown, ChevronUp,
  Lightbulb,
} from 'lucide-react';
import type { Insight } from '../services/insightsService';
import type { Order } from '../types';
import { generateInsights } from '../services/insightsService';

// ─── Colour maps ──────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  positive: { bg: 'var(--success-light)',  border: '#10b98122', text: 'var(--success)',  icon: '#10b981' },
  negative: { bg: 'var(--danger-light)',   border: '#ef444422', text: 'var(--danger)',   icon: '#ef4444' },
  warning:  { bg: 'var(--warning-light)',  border: '#f59e0b22', text: 'var(--warning)',  icon: '#f59e0b' },
  neutral:  { bg: 'var(--info-light)',     border: '#6366f122', text: 'var(--info)',     icon: '#6366f1' },
};

const CATEGORY_LABELS: Record<string, string> = {
  revenue:       'Revenue',
  orders:        'Orders',
  delivery:      'Delivery',
  customers:     'Customers',
  restaurants:   'Restaurants',
  ratings:       'Ratings',
  cancellations: 'Cancellations',
  timing:        'Timing',
};

// ─── Single insight card ──────────────────────────────────────────────────────

function InsightCard({ ins }: { ins: Insight }) {
  const colors = TYPE_COLORS[ins.type] ?? TYPE_COLORS.neutral;
  const Icon = ins.type === 'positive'  ? TrendingUp
             : ins.type === 'negative'  ? TrendingDown
             : ins.type === 'warning'   ? AlertTriangle
             :                            Info;

  return (
    <div style={{
      background:   colors.bg,
      border:       `1px solid ${colors.border}`,
      borderLeft:   `3px solid ${colors.icon}`,
      borderRadius: 'var(--radius-md)',
      padding:      '12px 14px',
      display:      'flex',
      gap:          10,
      transition:   'box-shadow var(--transition)',
    }}>
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        <Icon size={15} color={colors.icon} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 12, fontWeight: 700, color: colors.text,
          }}>
            {ins.title}
          </span>
          {ins.metric && (
            <span style={{
              fontSize: 11, fontWeight: 700,
              background: colors.icon + '18',
              color: colors.icon,
              border: `1px solid ${colors.icon}33`,
              borderRadius: 99, padding: '0 7px',
            }}>
              {ins.metric}
            </span>
          )}
          <span style={{
            fontSize: 10, color: 'var(--text-muted)',
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-light)',
            borderRadius: 4, padding: '1px 6px',
          }}>
            {CATEGORY_LABELS[ins.category] ?? ins.category}
          </span>
        </div>
        <p style={{
          fontSize: 12, color: 'var(--text-secondary)',
          marginTop: 3, lineHeight: 1.55,
        }}>
          {ins.body}
        </p>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface InsightsPanelProps {
  orders: Order[];
}

export function InsightsPanel({ orders }: InsightsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [showAll,  setShowAll]  = useState(false);

  const insights = useMemo(() => generateInsights(orders), [orders]);

  if (insights.length === 0) return null;

  const PREVIEW = 4;
  const visible = showAll ? insights : insights.slice(0, PREVIEW);
  const hasMore = insights.length > PREVIEW;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      {/* Header */}
      <div
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:         10,
          padding:    '14px 20px',
          cursor:     'pointer',
          borderBottom: expanded ? '1px solid var(--border)' : 'none',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(e => !e)}
        role="button"
        aria-expanded={expanded}
      >
        <Lightbulb size={16} color="var(--warning)" />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
          Key Business Insights
        </span>
        <span style={{
          fontSize: 11, background: 'var(--warning-light)', color: 'var(--warning)',
          border: '1px solid #f59e0b22', borderRadius: 99, padding: '1px 8px', fontWeight: 600,
        }}>
          {insights.length} insights
        </span>
        <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10 }}>
            {visible.map(ins => (
              <InsightCard key={ins.id} ins={ins} />
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => setShowAll(s => !s)}
              style={{
                marginTop: 12, display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, color: 'var(--accent)', fontWeight: 600,
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
              }}
            >
              {showAll
                ? <><ChevronUp size={13} /> Show fewer insights</>
                : <><ChevronDown size={13} /> Show {insights.length - PREVIEW} more insights</>
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}
