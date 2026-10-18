import type { View } from '../lib/validate';

/** A simple figure showing the pose to stand in for each photo. */
export function PoseGuide({ view, className }: { view: View; className?: string }) {
  return (
    <svg className={className ?? 'pose-guide'} viewBox="0 0 100 200" role="img" aria-label={view === 'front' ? 'Stand facing the camera, arms slightly out, feet apart' : 'Stand side-on, arms by your sides'}>
      {view === 'front' ? (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="50" cy="22" r="11" />
          <path d="M50 33 v8 M34 46 h32 M36 46 l-1 46 h30 l-1 -46" />
          <path d="M34 47 l-12 34 l-6 26 M66 47 l12 34 l6 26" />
          <path d="M40 92 l-6 50 l-4 46 M60 92 l6 50 l4 46" />
          <path d="M26 190 h10 M64 190 h10" />
        </g>
      ) : (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="50" cy="22" r="11" />
          <path d="M50 33 v8 M42 44 q-3 24 0 48 h16 q4 -24 0 -48 z" />
          <path d="M50 46 l1 40 l1 26" />
          <path d="M46 92 l0 50 l0 46 M54 92 l0 50 l0 46" />
          <path d="M44 190 h16" />
        </g>
      )}
    </svg>
  );
}
