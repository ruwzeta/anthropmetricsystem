import { useCallback, useRef, useState } from 'react';
import { analysePhoto, type AnalysedPhoto } from '../lib/pose';
import { checkPhoto, type View } from '../lib/validate';
import { CameraCapture } from './CameraCapture';
import { PhotoOverlay } from './PhotoOverlay';
import { PoseGuide } from './PoseGuide';

const TIPS: Record<View, string[]> = {
  front: [
    'Face the camera, standing straight on a level floor.',
    'Hold the arms slightly away from the body, about 30°.',
    'Stand with feet about shoulder-width apart.',
    'Wear fitted clothes; tie back long hair.',
    'Keep the whole body in frame, head to feet, camera at waist height.',
  ],
  side: [
    'Turn 90° so one shoulder points at the camera.',
    'Let the arms hang straight down by the sides.',
    'Stand tall, looking ahead, feet together.',
    'Keep the camera in the same place as the front photo.',
  ],
};

interface Props {
  view: View;
  photo: AnalysedPhoto | null;
  onChange: (photo: AnalysedPhoto | null) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
}

export function PhotoStep({ view, photo, onChange, onBack, onNext, onSkip }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = useCallback(
    async (blob: Blob) => {
      setCamera(false);
      setBusy(true);
      setError(null);
      try {
        onChange(await analysePhoto(blob));
      } catch (e) {
        onChange(null);
        setError(e instanceof Error ? e.message : 'The photo could not be analysed.');
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  const issues = photo ? checkPhoto(photo.frame, view) : [];
  const title = view === 'front' ? 'Front photo' : 'Side photo';

  return (
    <section className="card step">
      <h2>{title}</h2>
      {camera ? (
        <CameraCapture view={view} onCapture={handle} onCancel={() => setCamera(false)} />
      ) : (
        <div className="photo-step">
          <div className="photo-slot">
            {busy ? (
              <div className="placeholder">
                <div className="spinner" />
                <p>Finding body points…</p>
                <p className="muted small">The first photo downloads the pose model, which can take a moment.</p>
              </div>
            ) : photo ? (
              <PhotoOverlay imageUrl={photo.imageUrl} width={photo.width} height={photo.height} landmarks={photo.frame.landmarks} alt={title} />
            ) : (
              <div className="placeholder">
                <PoseGuide view={view} />
              </div>
            )}
          </div>
          <div className="photo-help">
            <ul className="tips">
              {TIPS[view].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            {error && <p className="error">{error}</p>}
            {photo && issues.length === 0 && <p className="ok">Body points found. This photo looks good.</p>}
            {issues.length > 0 && (
              <ul className="issues">
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
            <div className="row">
              <button type="button" className={photo ? 'secondary' : 'primary'} disabled={busy} onClick={() => setCamera(true)}>
                {photo ? 'Retake with camera' : 'Open camera'}
              </button>
              <button type="button" className="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
                Choose photo
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void handle(file);
                }}
              />
            </div>
            <p className="muted small">Photos are processed on this device and never uploaded.</p>
          </div>
        </div>
      )}
      <div className="row nav">
        <button type="button" className="secondary" onClick={onBack}>
          Back
        </button>
        <span className="spacer" />
        {onSkip && !photo && (
          <button type="button" className="secondary" onClick={onSkip}>
            Skip (less accurate)
          </button>
        )}
        <button type="button" className="primary" disabled={!photo || busy} onClick={onNext}>
          Continue
        </button>
      </div>
    </section>
  );
}
