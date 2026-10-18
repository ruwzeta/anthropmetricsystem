import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { BinaryMask } from './mask';
import type { Keypoint, PoseFrame } from './measure';

const WASM_PATH = `${import.meta.env.BASE_URL}mediapipe`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task';
/** Longest side of the image passed to the model; larger photos are scaled down. */
const MAX_SIDE = 1600;

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

/** Loads the pose model once (about 30 MB, cached by the browser afterwards). */
export function loadPoseModel(): Promise<PoseLandmarker> {
  landmarkerPromise ??= (async () => {
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    const options = {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' as const },
      runningMode: 'IMAGE' as const,
      numPoses: 1,
      outputSegmentationMasks: true,
    };
    try {
      return await PoseLandmarker.createFromOptions(fileset, options);
    } catch {
      // Some devices have no usable WebGL; the CPU path is slower but works everywhere.
      return PoseLandmarker.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } });
    }
  })().catch((err) => {
    landmarkerPromise = null;
    throw err;
  });
  return landmarkerPromise;
}

export interface AnalysedPhoto {
  frame: PoseFrame;
  width: number;
  height: number;
  /** The (possibly downscaled, upright) photo as a data URL, for display. */
  imageUrl: string;
}

export class NoPersonError extends Error {}

/** Draws the photo upright (respecting EXIF rotation) and at most MAX_SIDE pixels on its longest side. */
async function toCanvas(source: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  const ratio = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export async function analysePhoto(source: Blob): Promise<AnalysedPhoto> {
  const [landmarker, canvas] = await Promise.all([loadPoseModel(), toCanvas(source)]);
  const result = landmarker.detect(canvas);
  try {
    const pose = result.landmarks[0];
    const maskImage = result.segmentationMasks?.[0];
    if (!pose || !maskImage) throw new NoPersonError('No person was found in this photo. Make sure the whole body is visible.');

    const { width, height } = canvas;
    const landmarks: Keypoint[] = pose.map((p) => ({ x: p.x * width, y: p.y * height, visibility: p.visibility ?? 0 }));
    let mask = BinaryMask.fromConfidence(maskImage.width, maskImage.height, maskImage.getAsFloat32Array());
    if (mask.width !== width || mask.height !== height) mask = resizeMask(mask, width, height);

    return { frame: { landmarks, mask }, width, height, imageUrl: canvas.toDataURL('image/jpeg', 0.85) };
  } finally {
    result.close();
  }
}

function resizeMask(mask: BinaryMask, width: number, height: number): BinaryMask {
  const out = new BinaryMask(width, height);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(mask.height - 1, Math.floor((y * mask.height) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(mask.width - 1, Math.floor((x * mask.width) / width));
      out.data[y * width + x] = mask.data[sy * mask.width + sx];
    }
  }
  return out;
}
