import { applyCorrection, type Calibration } from '../lib/calibration';
import { MEASUREMENTS } from '../lib/definitions';

interface Props {
  calibration: Calibration;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  verifiedCount: number;
}

export function CalibrationView({ calibration, enabled, onToggle, verifiedCount }: Props) {
  const rows = MEASUREMENTS.filter((m) => calibration[m.key]);
  return (
    <section className="card">
      <h2>Calibration</h2>
      <p>
        Every tailor measures a little differently, and every phone camera is different. When you tick <em>“I checked these values with a tape”</em> on a customer card, the app compares
        its photo estimates with your tape values and learns a small correction for each measurement.
      </p>
      <p className="muted small">
        The correction is a regularised least-squares fit, the same idea as the 2019 translation formula w = yxᵀ(xxᵀ + λI)⁻¹ with λ = 0.5. With only a few checked customers it moves the
        values part of the way; it gets more confident as you add more.
      </p>
      <label className="check">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        Apply my calibration to new measurements
      </label>
      {rows.length === 0 ? (
        <p className="muted">No tape-checked customers yet ({verifiedCount}).</p>
      ) : (
        <table className="measurements">
          <thead>
            <tr>
              <th>Measurement</th>
              <th className="num">Customers</th>
              <th className="num">Effect at 100 cm</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const c = calibration[m.key]!;
              const delta = applyCorrection(100, c) - 100;
              return (
                <tr key={m.key}>
                  <td>{m.label}</td>
                  <td className="num">{c.samples}</td>
                  <td className="num">
                    {delta >= 0 ? '+' : ''}
                    {delta.toFixed(1)} cm
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
