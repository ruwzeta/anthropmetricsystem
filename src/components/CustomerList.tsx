import { formatLength, type Unit } from '../lib/format';
import { downloadFile, profilesToCsv, type Profile } from '../lib/profiles';

interface Props {
  profiles: Profile[];
  unit: Unit;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export function CustomerList({ profiles, unit, onOpen, onDelete, onNew }: Props) {
  if (profiles.length === 0) {
    return (
      <section className="card empty">
        <h2>No customers yet</h2>
        <p className="muted">Saved measurement cards appear here. They stay on this device.</p>
        <button type="button" className="primary" onClick={onNew}>
          Measure someone
        </button>
      </section>
    );
  }
  const sorted = [...profiles].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <section className="card">
      <header className="results-head">
        <h2>Customers</h2>
        <button type="button" className="secondary" onClick={() => downloadFile('customers.csv', profilesToCsv(sorted, unit), 'text/csv')}>
          Export all (CSV)
        </button>
      </header>
      <ul className="customers">
        {sorted.map((p) => (
          <li key={p.id}>
            <button type="button" className="customer" onClick={() => onOpen(p.id)}>
              <span className="label">{p.name || 'Unnamed customer'}</span>
              <span className="muted small">
                {new Date(p.createdAt).toLocaleDateString()} · chest {p.final.chest ? formatLength(p.final.chest, unit) : '—'} · waist {p.final.waist ? formatLength(p.final.waist, unit) : '—'}
                {p.tapeVerified && ' · tape checked'}
              </span>
            </button>
            <button
              type="button"
              className="link danger"
              onClick={() => {
                if (confirm(`Delete ${p.name || 'this customer'}?`)) onDelete(p.id);
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
