interface ComingSoonProps {
  title: string;
  description: string;
  icon: string;
}

export default function ComingSoonPage({ title, description, icon }: ComingSoonProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      gap: 16,
    }}>
      <div style={{ fontSize: 56 }}>{icon}</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 380 }}>{description}</p>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--accent-light)',
        color: 'var(--accent)',
        padding: '8px 18px',
        borderRadius: 'var(--radius-md)',
        fontSize: 13,
        fontWeight: 600,
        marginTop: 8,
      }}>
        Coming in next build
      </div>
    </div>
  );
}
