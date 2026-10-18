import { useEffect, useRef, useState } from 'react';
import type { View } from '../lib/validate';
import { PoseGuide } from './PoseGuide';

interface Props {
  view: View;
  onCapture: (photo: Blob) => void;
  onCancel: () => void;
}

const TIMER_SECONDS = 5;

/** Live camera with a pose outline and a self-timer, so a customer can take the photo alone. */
export function CameraCapture({ view, onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    setError(null);
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: facing, height: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError('The camera could not be opened. Allow camera access, or use "Choose photo" instead.'));
    if (!navigator.mediaDevices) setError('This browser cannot open the camera here. Use "Choose photo" instead.');
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      canvas.toBlob((blob) => blob && onCapture(blob), 'image/jpeg', 0.92);
      setCountdown(null);
      return;
    }
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onCapture]);

  return (
    <div className="camera">
      <div className="camera-view">
        <video ref={videoRef} autoPlay playsInline muted className={facing === 'user' ? 'mirrored' : undefined} />
        <PoseGuide view={view} className="camera-ghost" />
        {countdown !== null && countdown > 0 && <div className="countdown">{countdown}</div>}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="secondary" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}>
          Switch camera
        </button>
        <button type="button" className="primary" disabled={!!error || countdown !== null} onClick={() => setCountdown(TIMER_SECONDS)}>
          Start {TIMER_SECONDS}s timer
        </button>
      </div>
    </div>
  );
}
