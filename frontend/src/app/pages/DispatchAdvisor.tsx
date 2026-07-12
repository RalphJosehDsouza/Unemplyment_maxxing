import { useState } from 'react';
import { Sparkles, Truck, User, AlertCircle, Search, CheckCircle2 } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { advisorApi, Recommendation, VehicleRec, DriverRec } from '../../lib/services/advisor';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const display: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };
const inputStyle: React.CSSProperties = {
  background: 'var(--input-background)', border: '1px solid var(--border-strong)',
  padding: '0.6rem 0.75rem', color: 'var(--foreground)', fontSize: '0.85rem', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};

function scoreColor(s: number) {
  if (s >= 75) return '#10b981';
  if (s >= 50) return '#f59e0b';
  return '#ef4444';
}

function ScoreBadge({ score }: { score: number }) {
  const c = scoreColor(score);
  return (
    <div className="flex items-center gap-2" style={{ minWidth: 84 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border)' }}>
        <div style={{ width: `${score}%`, height: '100%', background: c }} />
      </div>
      <span style={{ ...mono, fontSize: '0.72rem', color: c, fontWeight: 600 }}>{score}</span>
    </div>
  );
}

function Reasons({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1 mt-1.5">
      {items.map((r, i) => (
        <li key={i} className="flex items-start gap-1.5" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <CheckCircle2 size={12} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
          <span>{r}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DispatchAdvisor() {
  const [cargo, setCargo] = useState('');
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [result, setResult] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const c = Number(cargo);
    if (!Number.isFinite(c) || c <= 0) return setError('Enter a cargo weight greater than 0.');
    setLoading(true);
    try {
      setResult(await advisorApi.recommend(c));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to get recommendation');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1100px]">
      <div className="mb-6">
        <div style={{ ...mono, fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
          Operational Intelligence
        </div>
        <h1 style={{ ...display, fontSize: '2.2rem', fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', color: 'var(--foreground)' }}>
          Dispatch Advisor
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem', maxWidth: 620 }}>
          Enter a load and the advisor ranks every available vehicle by capacity fit &amp; fuel cost, and every valid driver by safety score — then recommends the best pairing. Retired, in-shop, on-trip, and expired-licence options are automatically excluded.
        </p>
      </div>

      {/* Input */}
      <form onSubmit={run} className="flex flex-wrap items-end gap-3 mb-8 p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div>
          <label style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.14em', color: 'var(--muted-foreground)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Cargo Weight (kg)*</label>
          <input type="number" min="1" step="any" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="450" style={{ ...inputStyle, width: 130 }} autoFocus />
        </div>
        <div>
          <label style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.14em', color: 'var(--muted-foreground)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Source</label>
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="optional" style={{ ...inputStyle, width: 150 }} />
        </div>
        <div>
          <label style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.14em', color: 'var(--muted-foreground)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Destination</label>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="optional" style={{ ...inputStyle, width: 150 }} />
        </div>
        <button type="submit" disabled={loading} className="flex items-center gap-2"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 700, fontSize: '0.82rem', padding: '0.6rem 1.1rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.03em', opacity: loading ? 0.6 : 1 }}>
          <Search size={15} strokeWidth={2.5} /> {loading ? 'Analyzing…' : 'Recommend'}
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 mb-6 p-3" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)' }}>
          <AlertCircle size={14} color="var(--destructive)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--destructive)' }}>{error}</span>
        </div>
      )}

      {result && (
        <>
          {/* Recommended pairing */}
          {result.recommendation ? (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={15} color="#10b981" />
                <span style={{ ...mono, fontSize: '0.62rem', letterSpacing: '0.16em', color: '#10b981', textTransform: 'uppercase' }}>Recommended Pairing</span>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <RecommendCard kind="vehicle" v={result.recommendation.vehicle} />
                <RecommendCard kind="driver" d={result.recommendation.driver} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-8 p-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <AlertCircle size={16} color="#f59e0b" />
              <span style={{ fontSize: '0.85rem', color: 'var(--foreground)' }}>
                No valid pairing for {result.cargo}kg — {result.vehicles.length === 0 ? 'no available vehicle can carry this load' : 'no available driver with a valid licence'}.
              </span>
            </div>
          )}

          {/* Ranked lists (contained scroll — ~5 rows) */}
          <div className="grid md:grid-cols-2 gap-5">
            <RankedList title="Eligible Vehicles" icon={Truck} count={result.vehicles.length} note={result.excluded.available_vehicles_too_small ? `${result.excluded.available_vehicles_too_small} available but too small` : undefined}>
              {result.vehicles.map((v, i) => (
                <ListRow key={v.id} rank={i + 1} score={v.score}
                  title={v.registration_number} subtitle={`${v.model} · ${v.capacity}kg`} reasons={v.reasons} />
              ))}
              {!result.vehicles.length && <Empty>No eligible vehicles.</Empty>}
            </RankedList>

            <RankedList title="Eligible Drivers" icon={User} count={result.drivers.length} note={result.excluded.available_drivers_expired ? `${result.excluded.available_drivers_expired} available but licence expired` : undefined}>
              {result.drivers.map((d, i) => (
                <ListRow key={d.id} rank={i + 1} score={d.score}
                  title={d.name} subtitle={`${d.license_number} · valid ${d.days_to_expiry}d`} reasons={d.reasons} />
              ))}
              {!result.drivers.length && <Empty>No eligible drivers.</Empty>}
            </RankedList>
          </div>
        </>
      )}
    </div>
  );
}

function RecommendCard({ kind, v, d }: { kind: 'vehicle' | 'driver'; v?: VehicleRec; d?: DriverRec }) {
  const isVeh = kind === 'vehicle';
  const Icon = isVeh ? Truck : User;
  const score = isVeh ? v!.score : d!.score;
  const title = isVeh ? v!.registration_number : d!.name;
  const subtitle = isVeh ? v!.model : `${d!.license_number}`;
  const reasons = isVeh ? v!.reasons : d!.reasons;
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border-strong)', borderLeft: '2px solid #10b981', padding: '1.1rem 1.25rem' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex items-center justify-center" style={{ background: 'var(--secondary)' }}>
            <Icon size={16} color="var(--foreground)" />
          </div>
          <div>
            <div style={{ ...mono, fontSize: '0.5rem', letterSpacing: '0.14em', color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>{isVeh ? 'Vehicle' : 'Driver'}</div>
            <div style={{ ...display, fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.1 }}>{title}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{subtitle}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...display, fontSize: '1.6rem', fontWeight: 700, color: scoreColor(score), lineHeight: 1 }}>{score}</div>
          <div style={{ ...mono, fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase' }}>match</div>
        </div>
      </div>
      <Reasons items={reasons} />
    </div>
  );
}

function RankedList({ title, icon: Icon, count, note, children }: { title: string; icon: typeof Truck; count: number; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} color="var(--text-muted)" />
        <span style={{ ...mono, fontSize: '0.6rem', letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{title}</span>
        <span style={{ ...mono, fontSize: '0.6rem', color: 'var(--text-faint)' }}>({count})</span>
      </div>
      {/* contained scroll: ~5 rows visible, rest scrolls within */}
      <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', background: 'var(--surface)' }}>
        {children}
      </div>
      {note && <div style={{ ...mono, fontSize: '0.56rem', color: 'var(--text-faint)', letterSpacing: '0.05em', marginTop: 6 }}>{note}</div>}
    </div>
  );
}

function ListRow({ rank, score, title, subtitle, reasons }: { rank: number; score: number; title: string; subtitle: string; reasons: string[] }) {
  return (
    <div className="flex gap-3 p-3" style={{ borderBottom: '1px solid var(--border-faint)' }}>
      <div style={{ ...mono, fontSize: '0.7rem', color: 'var(--text-faint)', width: 18, flexShrink: 0, paddingTop: 2 }}>{rank}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <span style={{ ...mono, fontSize: '0.78rem', color: 'var(--foreground)' }}>{title}</span>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{subtitle}</div>
          </div>
          <div style={{ width: 90 }}><ScoreBadge score={score} /></div>
        </div>
        <Reasons items={reasons} />
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.82rem' }}>{children}</div>;
}
