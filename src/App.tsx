import { useEffect, useMemo, useState } from 'react';
import { About } from './components/About';
import { CalibrationView } from './components/CalibrationView';
import { CustomerList } from './components/CustomerList';
import { DetailsStep } from './components/DetailsStep';
import { MeasurementCard } from './components/MeasurementCard';
import { PhotoStep } from './components/PhotoStep';
import type { Unit } from './lib/format';
import { computeMeasurements, MeasureError, type MeasurementResult } from './lib/measure';
import type { AnalysedPhoto } from './lib/pose';
import { checkPhoto, downgradeForPhotoIssues } from './lib/validate';
import { calibrationFromProfiles, initialFinalValues, loadProfiles, loadSettings, newId, saveProfiles, saveSettings, type Profile, type Settings } from './lib/profiles';

type Tab = 'measure' | 'customers' | 'calibration' | 'about';
type Step = 'details' | 'front' | 'side' | 'results';

const STEPS: { id: Step; label: string }[] = [
  { id: 'details', label: 'Customer' },
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'results', label: 'Measurements' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('measure');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [profiles, setProfiles] = useState<Profile[]>(loadProfiles);

  const [step, setStep] = useState<Step>('details');
  const [details, setDetails] = useState<{ name: string; heightCm: number | null }>({ name: '', heightCm: null });
  const [front, setFront] = useState<AnalysedPhoto | null>(null);
  const [side, setSide] = useState<AnalysedPhoto | null>(null);
  const [result, setResult] = useState<MeasurementResult | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveProfiles(profiles), [profiles]);

  const calibration = useMemo(() => calibrationFromProfiles(profiles), [profiles]);
  const calibrated = settings.useCalibration && Object.keys(calibration).length > 0;
  const setUnit = (unit: Unit) => setSettings((s) => ({ ...s, unit }));
  const saved = !!draft && profiles.some((p) => p.id === draft.id);

  const measure = () => {
    if (!front || !details.heightCm) return;
    setError(null);
    try {
      const measured = computeMeasurements({ front: front.frame, side: side?.frame, heightCm: details.heightCm });
      const photoIssues = [...checkPhoto(front.frame, 'front'), ...(side ? checkPhoto(side.frame, 'side') : [])];
      const r = { ...measured, values: downgradeForPhotoIssues(measured.values, photoIssues), warnings: [...photoIssues, ...measured.warnings] };
      setResult(r);
      setDraft({
        id: newId(),
        name: details.name.trim(),
        createdAt: new Date().toISOString(),
        heightCm: details.heightCm,
        measured: r.values,
        final: initialFinalValues(r.values, calibrated ? calibration : null),
        tapeVerified: false,
        notes: '',
        warnings: r.warnings,
      });
      setStep('results');
    } catch (e) {
      setError(e instanceof MeasureError ? e.message : 'Something went wrong while measuring. Try another photo.');
    }
  };

  const upsert = (profile: Profile) => setProfiles((list) => (list.some((p) => p.id === profile.id) ? list.map((p) => (p.id === profile.id ? profile : p)) : [...list, profile]));

  const startOver = () => {
    setStep('details');
    setDetails({ name: '', heightCm: details.heightCm });
    setFront(null);
    setSide(null);
    setResult(null);
    setDraft(null);
    setError(null);
    setTab('measure');
  };

  const opened = openId ? profiles.find((p) => p.id === openId) : undefined;

  return (
    <div className="app">
      <header className="topbar no-print">
        <div className="brand">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 8h18v8H3z M7 8v3 M11 8v4 M15 8v3 M19 8v4" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>BodyMeasure</span>
        </div>
        <nav>
          {(
            [
              ['measure', 'Measure'],
              ['customers', `Customers${profiles.length ? ` (${profiles.length})` : ''}`],
              ['calibration', 'Calibration'],
              ['about', 'How it works'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? 'on' : ''}
              onClick={() => {
                setTab(id);
                setOpenId(null);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === 'measure' && (
          <>
            <ol className="stepper no-print">
              {STEPS.map((s, i) => (
                <li key={s.id} className={s.id === step ? 'on' : STEPS.findIndex((x) => x.id === step) > i ? 'done' : ''}>
                  <span>{i + 1}</span> {s.label}
                </li>
              ))}
            </ol>
            {error && <p className="error card">{error}</p>}
            {step === 'details' && (
              <DetailsStep name={details.name} heightCm={details.heightCm} unit={settings.unit} onChange={setDetails} onUnitChange={setUnit} onNext={() => setStep('front')} />
            )}
            {step === 'front' && <PhotoStep view="front" photo={front} onChange={setFront} onBack={() => setStep('details')} onNext={() => setStep('side')} />}
            {step === 'side' && (
              <PhotoStep
                view="side"
                photo={side}
                onChange={setSide}
                onBack={() => setStep('front')}
                onNext={measure}
                onSkip={() => {
                  setSide(null);
                  measure();
                }}
              />
            )}
            {step === 'results' && draft && result && front && (
              <>
                <MeasurementCard
                  profile={draft}
                  unit={settings.unit}
                  onUnitChange={setUnit}
                  onChange={(p) => {
                    setDraft(p);
                    if (saved) upsert(p);
                  }}
                  onSave={() => upsert(draft)}
                  saved={saved}
                  photos={{ front, side, guides: result.guides }}
                  calibrated={calibrated}
                />
                <div className="row nav no-print">
                  <button type="button" className="secondary" onClick={() => setStep('side')}>
                    Back
                  </button>
                  <span className="spacer" />
                  <button type="button" className="primary" onClick={startOver}>
                    New customer
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'customers' &&
          (opened ? (
            <>
              <MeasurementCard profile={opened} unit={settings.unit} onUnitChange={setUnit} onChange={upsert} saved calibrated={false} />
              <div className="row nav no-print">
                <button type="button" className="secondary" onClick={() => setOpenId(null)}>
                  All customers
                </button>
              </div>
            </>
          ) : (
            <CustomerList profiles={profiles} unit={settings.unit} onOpen={setOpenId} onDelete={(id) => setProfiles((list) => list.filter((p) => p.id !== id))} onNew={startOver} />
          ))}

        {tab === 'calibration' && (
          <CalibrationView
            calibration={calibration}
            enabled={settings.useCalibration}
            onToggle={(useCalibration) => setSettings((s) => ({ ...s, useCalibration }))}
            verifiedCount={profiles.filter((p) => p.tapeVerified).length}
          />
        )}

        {tab === 'about' && <About />}
      </main>
    </div>
  );
}
