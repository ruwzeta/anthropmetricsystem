import type { MeasurementKey } from '../lib/definitions';
import type { GuideLine, Keypoint } from '../lib/measure';

/** Pairs of landmark indices drawn as the pose skeleton. */
const SKELETON: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [28, 30], [30, 32],
];

interface Props {
  imageUrl: string;
  width: number;
  height: number;
  landmarks?: Keypoint[];
  guides?: GuideLine[];
  highlight?: MeasurementKey | null;
  alt: string;
}

export function PhotoOverlay({ imageUrl, width, height, landmarks, guides, highlight, alt }: Props) {
  const stroke = Math.max(2, width / 250);
  return (
    <div className="photo">
      <img src={imageUrl} alt={alt} />
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {landmarks &&
          SKELETON.map(([a, b]) =>
            landmarks[a].visibility > 0.4 && landmarks[b].visibility > 0.4 ? (
              <line key={`${a}-${b}`} className="bone" x1={landmarks[a].x} y1={landmarks[a].y} x2={landmarks[b].x} y2={landmarks[b].y} strokeWidth={stroke} />
            ) : null,
          )}
        {landmarks &&
          landmarks.map((p, i) => (i >= 11 && p.visibility > 0.4 ? <circle key={i} className="joint" cx={p.x} cy={p.y} r={stroke * 1.6} /> : null))}
        {guides?.map((g, i) => (
          <line
            key={i}
            className={`guide${highlight === g.key ? ' active' : ''}${highlight && highlight !== g.key ? ' dim' : ''}`}
            x1={g.from.x}
            y1={g.from.y}
            x2={g.to.x}
            y2={g.to.y}
            strokeWidth={stroke * 1.4}
          />
        ))}
      </svg>
    </div>
  );
}
