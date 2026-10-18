import { useState } from 'react';
import { MEASUREMENTS, type MeasurementKey } from '../lib/definitions';
import { formatLength, toUnit, type Unit } from '../lib/format';
import { inchesToCm } from '../lib/geometry';
import type { GuideLine } from '../lib/measure';
import type { AnalysedPhoto } from '../lib/pose';
import { downloadFile, profilesToCsv, type Profile } from '../lib/profiles';
import { PhotoOverlay } from './PhotoOverlay';

interface Props {
  profile: Profile;
  unit: Unit;
  onUnitChange: (unit: Unit) => void;
  onChange: (profile: Profile) => void;
  onSave?: () => void;
  saved: boolean;
  photos?: { front: AnalysedPhoto; side: AnalysedPhoto | null; guides: { front: GuideLine[]; side: GuideLine[] } };
  calibrated: boolean;
}

const CONFIDENCE_LABEL = { high: 'Good', medium: 'Fair', low: 'Check' } as const;

function slug(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'customer';
}

export function MeasurementCard({ profile, unit, onUnitChange, onChange, onSave, saved, photos, calibrated }: Props) {
  const [highlight, setHighlight] = useState<MeasurementKey | null>(null);
  const rows = MEASUREMENTS.filter((m) => profile.final[m.key] !== undefined);

  const setValue = (key: MeasurementKey, text: string) => {
    const n = Number(text);
    if (!text || !Number.isFinite(n) || n <= 0) return;
    onChange({ ...profile, final: { ...profile.final, [key]: unit === 'cm' ? n : inchesToCm(n) } });
  };

  const exportJson = () => {
    const data = {
      name: profile.name,
      date: profile.createdAt,
      unit: 'cm',
      measurements: Object.fromEntries(rows.map((m) => [m.key, Math.round((profile.final[m.key] as number) * 10) / 10])),
      tapeVerified: profile.tapeVerified,
      notes: profile.notes,
    };
    downloadFile(`${slug(profile.name)}-measurements.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  return (
    <section className="card results">
      <header className="results-head">
        <div>
          <h2>{profile.name || 'Unnamed customer'}</h2>
          <p className="muted">
            Measured {new Date(profile.createdAt).toLocaleDateString()} · height {formatLength(profile.heightCm, unit)}
            {calibrated && ' · calibrated'}
          </p>
        </div>
        <div className="segmented no-print" role="radiogroup" aria-label="Units">
          {(['cm', 'in'] as Unit[]).map((u) => (
            <button key={u} type="button" role="radio" aria-checked={unit === u} className={unit === u ? 'on' : ''} onClick={() => onUnitChange(u)}>
              {u}
            </button>
          ))}
        </div>
      </header>

      {profile.warnings.length > 0 && (
        <ul className="issues no-print">
          {profile.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div className={photos ? 'results-grid' : undefined}>
        <table className="measurements">
          <thead>
            <tr>
              <th>Measurement</th>
              <th className="num">Value ({unit})</th>
              <th className="no-print">Quality</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const measured = profile.measured[m.key];
              const final = profile.final[m.key] as number;
              const edited = measured && Math.abs(final - measured.cm) > 0.05 && m.key !== 'height';
              return (
                <tr key={m.key} onMouseEnter={() => setHighlight(m.key)} onMouseLeave={() => setHighlight(null)} className={highlight === m.key ? 'hl' : undefined}>
                  <td>
                    <span className="label">{m.label}</span>
                    <span className="how">{m.howToMeasure}</span>
                    {measured?.note && <span className="how note">{measured.note}</span>}
                  </td>
                  <td className="num">
                    <input
                      key={`${m.key}-${unit}-${final}`}
                      className="value no-print"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      defaultValue={toUnit(final, unit)}
                      onFocus={() => setHighlight(m.key)}
                      onBlur={(e) => setValue(m.key, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      aria-label={`${m.label} in ${unit}`}
                      readOnly={m.key === 'height'}
                    />
                    <span className="print-only">{formatLength(final, unit)}</span>
                    {edited && <span className="edited no-print">edited</span>}
                  </td>
                  <td className="no-print">{measured && <span className={`badge ${measured.confidence}`}>{CONFIDENCE_LABEL[measured.confidence]}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {photos && (
          <div className="result-photos no-print">
            <PhotoOverlay imageUrl={photos.front.imageUrl} width={photos.front.width} height={photos.front.height} guides={photos.guides.front} highlight={highlight} alt="Front photo with measurement lines" />
            {photos.side && (
              <PhotoOverlay imageUrl={photos.side.imageUrl} width={photos.side.width} height={photos.side.height} guides={photos.guides.side} highlight={highlight} alt="Side photo with measurement lines" />
            )}
          </div>
        )}
      </div>

      <label className="check no-print">
        <input type="checkbox" checked={profile.tapeVerified} onChange={(e) => onChange({ ...profile, tapeVerified: e.target.checked })} />
        I checked these values with a tape. Use them to improve future measurements.
      </label>
      <label className="notes">
        <span>Notes</span>
        <textarea rows={3} value={profile.notes} placeholder="Fit preferences, garment, posture…" onChange={(e) => onChange({ ...profile, notes: e.target.value })} />
      </label>

      <div className="row no-print">
        {onSave && (
          <button type="button" className="primary" onClick={onSave}>
            {saved ? 'Saved ✓' : 'Save customer'}
          </button>
        )}
        <button type="button" className="secondary" onClick={() => window.print()}>
          Print / PDF
        </button>
        <button type="button" className="secondary" onClick={() => downloadFile(`${slug(profile.name)}-measurements.csv`, profilesToCsv([profile], unit), 'text/csv')}>
          CSV
        </button>
        <button type="button" className="secondary" onClick={exportJson}>
          JSON
        </button>
      </div>
      <p className="muted small">
        Values are estimates from photos. Confidence shows how clearly the body was seen; check anything marked “Check” with a tape. Edit any value by tapping it.
      </p>
    </section>
  );
}
