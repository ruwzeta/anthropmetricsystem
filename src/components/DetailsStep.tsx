import { useState } from 'react';
import { CM_PER_INCH } from '../lib/geometry';
import type { Unit } from '../lib/format';

interface Props {
  name: string;
  heightCm: number | null;
  unit: Unit;
  onChange: (details: { name: string; heightCm: number | null }) => void;
  onUnitChange: (unit: Unit) => void;
  onNext: () => void;
}

export function DetailsStep({ name, heightCm, unit, onChange, onUnitChange, onNext }: Props) {
  const totalInches = heightCm ? heightCm / CM_PER_INCH : null;
  const [feet, setFeet] = useState(totalInches ? String(Math.floor(totalInches / 12)) : '');
  const [inches, setInches] = useState(totalInches ? String(Math.round(totalInches % 12)) : '');
  const valid = heightCm !== null && heightCm >= 100 && heightCm <= 230;

  const setImperial = (f: string, i: string) => {
    setFeet(f);
    setInches(i);
    const total = Number(f || 0) * 12 + Number(i || 0);
    onChange({ name, heightCm: total > 0 ? total * CM_PER_INCH : null });
  };

  return (
    <section className="card step">
      <h2>Customer</h2>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onNext();
        }}
      >
        <label>
          Name
          <input value={name} placeholder="e.g. Nimali Perera" autoComplete="off" onChange={(e) => onChange({ name: e.target.value, heightCm })} />
        </label>
        <fieldset>
          <legend>Height without shoes</legend>
          <div className="segmented" role="radiogroup" aria-label="Units">
            {(['cm', 'in'] as Unit[]).map((u) => (
              <button key={u} type="button" role="radio" aria-checked={unit === u} className={unit === u ? 'on' : ''} onClick={() => onUnitChange(u)}>
                {u === 'cm' ? 'Centimetres' : 'Feet & inches'}
              </button>
            ))}
          </div>
          {unit === 'cm' ? (
            <label className="inline">
              <input
                type="number"
                inputMode="decimal"
                min={100}
                max={230}
                step="0.5"
                value={heightCm ? Math.round(heightCm * 10) / 10 : ''}
                onChange={(e) => onChange({ name, heightCm: e.target.value ? Number(e.target.value) : null })}
                aria-label="Height in centimetres"
              />
              cm
            </label>
          ) : (
            <div className="row">
              <label className="inline">
                <input type="number" inputMode="numeric" min={3} max={7} value={feet} onChange={(e) => setImperial(e.target.value, inches)} aria-label="Feet" />
                ft
              </label>
              <label className="inline">
                <input type="number" inputMode="numeric" min={0} max={11} value={inches} onChange={(e) => setImperial(feet, e.target.value)} aria-label="Inches" />
                in
              </label>
            </div>
          )}
          <p className="muted small">Height sets the scale for every other measurement, so measure it carefully.</p>
        </fieldset>
        <div className="row nav">
          <span className="spacer" />
          <button type="submit" className="primary" disabled={!valid}>
            Continue
          </button>
        </div>
      </form>
    </section>
  );
}
