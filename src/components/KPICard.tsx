import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { KPIDelta } from '../services/dataService';

interface KPICardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  /** If provided, renders the data-driven delta chip + prev-value footer */
  delta?: KPIDelta;
  /** Formatted previous-period value for footer display, e.g. "₹4.2L" */
  prevValueLabel?: string;
  /** Optional override for the comparison label (e.g. "vs. Jan–Jun 2024") */
  comparisonLabel?: string;
}

export function KPICard({
  label,
  value,
  subValue,
  icon,
  iconBg,
  iconColor,
  delta,
  prevValueLabel,
  comparisonLabel = 'vs. previous period',
}: KPICardProps) {
  const trend = delta?.direction ?? 'neutral';

  return (
    <div className="kpi-card">
      {/* Header: label + icon */}
      <div className="kpi-card-header">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </span>
      </div>

      {/* Main value */}
      <div className={`kpi-value${subValue ? ' kpi-value-sm' : ''}`}>{value}</div>
      {subValue && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{subValue}</div>
      )}

      {/* Footer: delta chip + comparison context */}
      <div className="kpi-footer">
        {delta && (
          <span className={`kpi-trend ${trend}`}>
            {trend === 'up'      && <TrendingUp    size={11} />}
            {trend === 'down'    && <TrendingDown  size={11} />}
            {trend === 'neutral' && <Minus         size={11} />}
            {delta.label}
          </span>
        )}
        {prevValueLabel ? (
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            prev: <strong style={{ color: 'var(--text-secondary)' }}>{prevValueLabel}</strong>
            {' '}
            <span style={{ color: 'var(--text-muted)' }}>({comparisonLabel})</span>
          </span>
        ) : (
          <span>{comparisonLabel}</span>
        )}
      </div>
    </div>
  );
}
