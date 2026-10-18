import { BinaryMask } from '../mask';
import { LM, type Keypoint, type PoseFrame } from '../measure';

/**
 * A simple synthetic person with known dimensions, drawn as front and side
 * silhouettes, for testing the measurement engine without a camera or model.
 * All body dimensions are in cm; `h` is height above the floor.
 */
export const BODY = {
  heightCm: 170,
  pxPerCm: 5,
  floorPx: 900,
  centrePx: 500,
  /** [height above floor, full front width, full side depth] for the torso and head. */
  torsoProfile: [
    [80, 34, 24],
    [92, 36, 26],
    [104, 28, 20],
    [120, 32, 24],
    [136, 32, 24],
    [136.01, 44, 24],
    [140, 44, 24],
    [140.01, 12, 12],
    [148, 12, 12],
    [148.01, 16, 20],
    [170, 16, 20],
  ] as const,
  legCentreCm: 9,
  /** Leg width/depth tapers linearly from the crotch (h=80) to the ankle (h=8). */
  legTop: { width: 15, depth: 16 },
  legBottom: { width: 9, depth: 10 },
  joints: {
    shoulder: { x: 18, h: 138 },
    elbow: { x: 30, h: 108 },
    wrist: { x: 40, h: 82 },
    hip: { x: 9, h: 92 },
    knee: { x: 9, h: 48 },
    ankle: { x: 9, h: 8 },
    heel: { x: 9, h: 2 },
    foot: { x: 11, h: 0.5 },
    mouth: { x: 2, h: 155 },
    ear: { x: 7, h: 160 },
    nose: { x: 0, h: 158 },
  },
  upperArmThickness: 9,
  forearmThickness: 7,
} as const;

const W = 1000;
const H = 950;

function px(xCm: number, h: number) {
  return { x: BODY.centrePx + xCm * BODY.pxPerCm, y: BODY.floorPx - h * BODY.pxPerCm };
}

function profileAt(h: number): { width: number; depth: number } | null {
  const p = BODY.torsoProfile;
  if (h < p[0][0] || h > p[p.length - 1][0]) return null;
  for (let i = 1; i < p.length; i++) {
    const [h0, w0, d0] = p[i - 1];
    const [h1, w1, d1] = p[i];
    if (h <= h1) {
      const t = (h - h0) / (h1 - h0);
      return { width: w0 + (w1 - w0) * t, depth: d0 + (d1 - d0) * t };
    }
  }
  return null;
}

function legAt(h: number): { width: number; depth: number } | null {
  if (h < 0 || h > 80) return null;
  const t = Math.max(0, (80 - h) / 72);
  const { legTop: a, legBottom: b } = BODY;
  return { width: a.width + (b.width - a.width) * Math.min(1, t), depth: a.depth + (b.depth - a.depth) * Math.min(1, t) };
}

function segmentDistance(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function keypoint(xCm: number, h: number, visibility = 0.99): Keypoint {
  return { ...px(xCm, h), visibility };
}

function landmarks(view: 'front' | 'side'): Keypoint[] {
  const j = BODY.joints;
  const lm: Keypoint[] = Array.from({ length: 33 }, () => keypoint(0, 100, 0));
  const put = (left: number, right: number, joint: { x: number; h: number }) => {
    const x = view === 'front' ? joint.x : 0.3;
    lm[left] = keypoint(x, joint.h);
    lm[right] = keypoint(-x, joint.h, view === 'front' ? 0.99 : 0.6);
  };
  put(LM.leftShoulder, LM.rightShoulder, j.shoulder);
  put(LM.leftElbow, LM.rightElbow, view === 'front' ? j.elbow : { x: 0, h: j.elbow.h });
  put(LM.leftWrist, LM.rightWrist, view === 'front' ? j.wrist : { x: 0, h: j.wrist.h });
  put(LM.leftHip, LM.rightHip, j.hip);
  put(LM.leftKnee, LM.rightKnee, j.knee);
  put(LM.leftAnkle, LM.rightAnkle, j.ankle);
  put(LM.leftHeel, LM.rightHeel, j.heel);
  put(LM.leftFootIndex, LM.rightFootIndex, j.foot);
  put(LM.mouthLeft, LM.mouthRight, j.mouth);
  put(LM.leftEar, LM.rightEar, j.ear);
  lm[LM.nose] = keypoint(0, j.nose.h);
  return lm;
}

export function syntheticFront(options: { armsDown?: boolean; legsTogether?: boolean } = {}): PoseFrame {
  const mask = new BinaryMask(W, H);
  const j = BODY.joints;
  const legCentre = BODY.legCentreCm;
  const elbowX = options.armsDown ? 19 : j.elbow.x;
  const wristX = options.armsDown ? 19 : j.wrist.x;
  const arms = [1, -1].flatMap((side) => [
    { a: px(side * j.shoulder.x, j.shoulder.h), b: px(side * elbowX, j.elbow.h), r: (BODY.upperArmThickness * BODY.pxPerCm) / 2 },
    { a: px(side * elbowX, j.elbow.h), b: px(side * wristX, j.wrist.h), r: (BODY.forearmThickness * BODY.pxPerCm) / 2 },
  ]);
  for (let y = 0; y < H; y++) {
    const h = (BODY.floorPx - y) / BODY.pxPerCm;
    for (let x = 0; x < W; x++) {
      const xCm = (x - BODY.centrePx) / BODY.pxPerCm;
      const torso = profileAt(h);
      const leg = legAt(h);
      let on = !!torso && Math.abs(xCm) <= torso.width / 2;
      if (!on && leg) on = options.legsTogether ? Math.abs(xCm) <= leg.width : Math.abs(Math.abs(xCm) - legCentre) <= leg.width / 2;
      if (!on) on = arms.some((s) => segmentDistance({ x, y }, s.a, s.b) <= s.r);
      if (on) mask.set(x, y);
    }
  }
  const lm = landmarks('front');
  if (options.armsDown) {
    lm[LM.leftElbow] = keypoint(elbowX, j.elbow.h);
    lm[LM.rightElbow] = keypoint(-elbowX, j.elbow.h);
    lm[LM.leftWrist] = keypoint(wristX, j.wrist.h);
    lm[LM.rightWrist] = keypoint(-wristX, j.wrist.h);
  }
  return { landmarks: lm, mask };
}

export function syntheticSide(): PoseFrame {
  const mask = new BinaryMask(W, H);
  for (let y = 0; y < H; y++) {
    const h = (BODY.floorPx - y) / BODY.pxPerCm;
    const torso = profileAt(h);
    const leg = legAt(h);
    const depth = torso?.depth ?? leg?.depth;
    if (depth === undefined) continue;
    for (let x = 0; x < W; x++) {
      const xCm = (x - BODY.centrePx) / BODY.pxPerCm;
      if (Math.abs(xCm) <= depth / 2) mask.set(x, y);
    }
  }
  return { landmarks: landmarks('side'), mask };
}
