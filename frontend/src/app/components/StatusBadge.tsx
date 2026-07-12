import { STATUS_STYLES } from '../../lib/constants';

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || {
    bg: 'rgba(255,255,255,0.06)',
    fg: '#a0a0a0',
    border: 'rgba(255,255,255,0.12)',
    label: status,
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.6rem',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '0.22rem 0.5rem',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.fg }} />
      {s.label}
    </span>
  );
}
