import type { OrderStatus } from '../types';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, BadgeVariant> = {
    Delivered:          'success',
    Cancelled:          'danger',
    Pending:            'neutral',
    Preparing:          'warning',
    'Out for Delivery': 'info',
  };
  return <Badge variant={map[status]}>{status}</Badge>;
}

export function StarRating({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: '#f59e0b', fontSize: 13 }}>★</span>
      <span style={{ fontWeight: 600, fontSize: 13 }}>{value.toFixed(1)}</span>
    </span>
  );
}
