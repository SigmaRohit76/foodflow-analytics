/**
 * Reusable chart wrappers built on Recharts.
 * All colours are derived from CSS variables so they respond to dark mode.
 *
 * Usage: import the specific chart you need. Never import raw Recharts in pages.
 */
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ─── Palette ─────────────────────────────────────────────────────────────────

export const CHART_COLORS = [
  '#1d4ed8', '#10b981', '#f59e0b', '#ef4444',
  '#6366f1', '#ec4899', '#14b8a6', '#f97316',
  '#8b5cf6', '#06b6d4', '#84cc16', '#a78bfa',
];

// ─── Tooltip style ────────────────────────────────────────────────────────────

const tooltipStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  boxShadow: 'var(--shadow-md)',
  fontSize: 12,
  color: 'var(--text-primary)',
};
const tooltipLabelStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontWeight: 600,
  marginBottom: 4,
};

function fmt(v: number) {
  if (v >= 1_000_000) return `₹${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `₹${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

// ─── Area chart (trend) ───────────────────────────────────────────────────────

interface AreaDataPoint {
  name: string;
  [key: string]: string | number;
}
interface AreaSeriesConfig {
  key: string;
  label: string;
  color: string;
  yAxisId?: string;
  formatter?: (v: number) => string;
}

interface TrendAreaChartProps {
  data: AreaDataPoint[];
  series: AreaSeriesConfig[];
  height?: number;
  dual?: boolean;
}

export function TrendAreaChart({ data, series, height = 280, dual = false }: TrendAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={s.color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => series[0]?.formatter ? series[0].formatter(v) : String(v)}
          width={55}
        />
        {dual && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => series[1]?.formatter ? series[1].formatter(v) : String(v)}
            width={55}
          />
        )}
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(value, name) => {
            const v = value as number;
            const s = series.find((x) => x.label === name);
            return [s?.formatter ? s.formatter(v) : v.toLocaleString(), name as string];
          }}
        />
        <Legend iconType="circle" iconSize={8} />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#grad-${s.key})`}
            yAxisId={s.yAxisId ?? 'left'}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Bar chart ───────────────────────────────────────────────────────────────

interface BarDataPoint { name: string; [key: string]: string | number; }
interface BarSeriesConfig {
  key: string;
  label: string;
  color: string;
  formatter?: (v: number) => string;
}

interface SimpleBarChartProps {
  data: BarDataPoint[];
  series: BarSeriesConfig[];
  height?: number;
  horizontal?: boolean;
  showLegend?: boolean;
}

export function SimpleBarChart({
  data,
  series,
  height = 260,
  horizontal = false,
  showLegend = false,
}: SimpleBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        barSize={horizontal ? 12 : undefined}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={!horizontal} horizontal={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} tickFormatter={(v) => series[0]?.formatter ? series[0].formatter(v) : String(v)} width={55} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} width={90} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} tickFormatter={(v) => series[0]?.formatter ? series[0].formatter(v) : String(v)} width={55} />
          </>
        )}
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(value, name) => {
            const v = value as number;
            const s = series.find((x) => x.label === name);
            return [s?.formatter ? s.formatter(v) : v.toLocaleString(), name as string];
          }}
          cursor={{ fill: 'var(--bg-surface-2)' }}
        />
        {showLegend && <Legend iconType="square" iconSize={10} />}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Donut / Pie chart ────────────────────────────────────────────────────────

interface PieDataPoint { name: string; value: number; }

interface DonutChartProps {
  data: PieDataPoint[];
  height?: number;
  colors?: string[];
  formatter?: (v: number) => string;
}

export function DonutChart({
  data,
  height = 220,
  colors = CHART_COLORS,
  formatter,
}: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <ResponsiveContainer width={height} height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={height * 0.28}
            outerRadius={height * 0.42}
            dataKey="value"
            strokeWidth={2}
            stroke="var(--bg-surface)"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(value) => {
              const v = value as number;
              return [formatter ? formatter(v) : v.toLocaleString(), ''];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-legend" style={{ flex: 1 }}>
        {data.map((d, i) => (
          <div key={d.name} className="donut-legend-item">
            <span className="donut-legend-dot" style={{ background: colors[i % colors.length] }} />
            <span className="donut-legend-label">{d.name}</span>
            <span className="donut-legend-value">
              {formatter ? formatter(d.value) : d.value.toLocaleString()}
            </span>
            <span className="donut-legend-pct">
              {total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Horizontal progress rows ─────────────────────────────────────────────────

interface ProgressRowProps {
  label: string;
  value: number;
  max: number;
  displayValue: string;
  color?: string;
  subLabel?: string;
}

export function ProgressRow({ label, value, max, displayValue, color = 'var(--accent)', subLabel }: ProgressRowProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
          {subLabel && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 6 }}>{subLabel}</span>
          )}
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{displayValue}</span>
      </div>
      <div className="progress-bar-wrap">
        <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export { fmt };
