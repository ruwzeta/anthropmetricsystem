import type { MeasurementKey } from './definitions';
import { distance, ellipsePerimeter, midpoint, xAtY, type Point } from './geometry';
import type { BinaryMask, Run } from './mask';

/** A body landmark in image pixel coordinates. */
export interface Keypoint extends Point {
  /** 0–1 likelihood that the point is visible in the image. */
  visibility: number;
}

/** One analysed photo: pose landmarks plus the person's silhouette. */
export interface PoseFrame {
  landmarks: Keypoint[];
  mask: BinaryMask;
}

export type Confidence = 'high' | 'medium' | 'low';

export interface MeasuredValue {
  cm: number;
  confidence: Confidence;
  note?: string;
}

export interface GuideLine {
  key: MeasurementKey;
  from: Point;
  to: Point;
}

export interface MeasurementResult {
  values: Partial<Record<MeasurementKey, MeasuredValue>>;
  guides: { front: GuideLine[]; side: GuideLine[] };
  warnings: string[];
}

export class MeasureError extends Error {}

/** MediaPipe Pose landmark indices (33-point BlazePose topology). */
export const LM = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  mouthLeft: 9,
  mouthRight: 10,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

/**
 * Typical depth-to-width ratios of body cross-sections, used only when no side
 * photo is available. Values are rounded averages for adults.
 */
const FALLBACK_DEPTH_RATIO: Partial<Record<MeasurementKey, number>> = {
  neck: 0.9,
  chest: 0.72,
  waist: 0.78,
  hip: 0.78,
  thigh: 0.95,
};

const CONFIDENCE_ORDER: Confidence[] = ['low', 'medium', 'high'];

function minConfidence(...values: Confidence[]): Confidence {
  return values.reduce((lowest, c) => (CONFIDENCE_ORDER.indexOf(c) < CONFIDENCE_ORDER.indexOf(lowest) ? c : lowest), 'high');
}

function visibilityConfidence(points: Keypoint[]): Confidence {
  const v = Math.min(...points.map((p) => p.visibility));
  if (v >= 0.8) return 'high';
  if (v >= 0.5) return 'medium';
  return 'low';
}

/** Scale and floor line of one photo, derived from the silhouette and the person's height. */
interface FrameScale {
  topY: number;
  floorY: number;
  pxPerCm: number;
}

function frameScale(frame: PoseFrame, heightCm: number, which: string): FrameScale {
  const { mask, landmarks } = frame;
  const topY = mask.topRow();
  const maskBottom = mask.bottomRow();
  if (topY < 0) throw new MeasureError(`No person was found in the ${which} photo.`);
  const feet = [LM.leftHeel, LM.rightHeel, LM.leftFootIndex, LM.rightFootIndex]
    .map((i) => landmarks[i])
    .filter((p) => p && p.visibility > 0.3)
    .map((p) => p.y);
  const floorY = Math.max(maskBottom, ...feet);
  const bodyPx = floorY - topY;
  if (bodyPx < 50) throw new MeasureError(`The person in the ${which} photo is too small. Move closer so the whole body fills the frame.`);
  return { topY, floorY, pxPerCm: bodyPx / heightCm };
}

interface Arm {
  shoulder: Keypoint;
  elbow: Keypoint;
  wrist: Keypoint;
}

/** x position of the arm's centre line at row y, including the hand below the wrist; null if the arm is not at that row. */
function armXAt(arm: Arm, y: number, handPx: number): number | null {
  const { shoulder: s, elbow: e, wrist: w } = arm;
  if (y < Math.min(s.y, e.y, w.y)) return null;
  if (y <= e.y) return xAtY(s, e, y);
  if (y <= w.y) return xAtY(e, w, y);
  if (y <= w.y + handPx && w.y > e.y) return w.x + ((w.x - e.x) / (w.y - e.y)) * (y - w.y);
  return null;
}

function runTouchesArm(run: Run, arms: Arm[], y: number, handPx: number): boolean {
  return arms.some((arm) => {
    const x = armXAt(arm, y, handPx);
    return x !== null && x >= run.left && x <= run.right;
  });
}

function hLine(key: MeasurementKey, run: Run): GuideLine {
  return { key, from: { x: run.left, y: run.y }, to: { x: run.right, y: run.y } };
}

/**
 * Plausible range of each measurement as a fraction of height, wide enough to
 * cover adults of most builds. A value outside it usually means a bad pose or
 * photo rather than an unusual body, so it is marked for a tape check.
 */
const PLAUSIBLE_RATIO: Partial<Record<MeasurementKey, [number, number]>> = {
  neck: [0.17, 0.3],
  chest: [0.42, 0.85],
  waist: [0.33, 0.85],
  hip: [0.45, 0.85],
  thigh: [0.25, 0.5],
  shoulderWidth: [0.2, 0.33],
  sleeveLength: [0.4, 0.56],
  armLength: [0.28, 0.42],
  sleeveInseam: [0.2, 0.36],
  backLength: [0.2, 0.3],
  inseam: [0.37, 0.53],
  outseam: [0.52, 0.7],
};

function flagImplausible(values: MeasurementResult['values'], heightCm: number): void {
  for (const [key, [min, max]] of Object.entries(PLAUSIBLE_RATIO) as [MeasurementKey, [number, number]][]) {
    const v = values[key];
    if (!v) continue;
    const ratio = v.cm / heightCm;
    if (ratio < min || ratio > max) values[key] = { ...v, confidence: 'low', note: 'Unusual for this height. Check the pose or measure with a tape.' };
  }
}

/**
 * Estimates tailoring measurements from a front photo (required) and a side
 * photo (recommended), using the person's real height to set the scale.
 *
 * Lengths come from distances between pose landmarks. Girths use the ellipse
 * model: the body's width at a level is read from the front silhouette, its
 * depth at the same height above the floor from the side silhouette, and the
 * girth is the perimeter of that ellipse.
 */
export function computeMeasurements(input: { front: PoseFrame; side?: PoseFrame; heightCm: number }): MeasurementResult {
  const { front, side, heightCm } = input;
  if (!(heightCm > 50 && heightCm < 260)) throw new MeasureError('Enter a height between 50 and 260 cm.');

  const values: MeasurementResult['values'] = {};
  const guides: MeasurementResult['guides'] = { front: [], side: [] };
  const warnings: string[] = [];

  const lm = front.landmarks;
  const mask = front.mask;
  const scale = frameScale(front, heightCm, 'front');
  const { floorY, pxPerCm } = scale;
  const bodyPx = floorY - scale.topY;
  const toCm = (px: number) => px / pxPerCm;
  const handPx = 0.11 * bodyPx;

  const sL = lm[LM.leftShoulder];
  const sR = lm[LM.rightShoulder];
  const hL = lm[LM.leftHip];
  const hR = lm[LM.rightHip];
  const sMid = midpoint(sL, sR);
  const hMid = midpoint(hL, hR);
  const torsoPx = hMid.y - sMid.y;
  if (!(torsoPx > 0.1 * bodyPx)) {
    throw new MeasureError('Could not find the shoulders and hips in the front photo. Stand upright, facing the camera.');
  }
  const centerX = (y: number) => xAtY(sMid, hMid, y);
  const torsoRun = (y: number) => mask.runAt(y, centerX(y));
  const torsoConf = visibilityConfidence([sL, sR, hL, hR]);

  const arms: (Arm & { side: 'left' | 'right' })[] = [
    { side: 'left', shoulder: sL, elbow: lm[LM.leftElbow], wrist: lm[LM.leftWrist] },
    { side: 'right', shoulder: sR, elbow: lm[LM.rightElbow], wrist: lm[LM.rightWrist] },
  ];

  values.height = { cm: heightCm, confidence: 'high', note: 'Entered by you; used to set the scale.' };

  // Shoulder width: the silhouette's width across the shoulder joints.
  const shoulderRun = torsoRun(sMid.y);
  let shoulderWidthPx = distance(sL, sR) * 1.2;
  let shoulderConf = torsoConf;
  // Wider than 1.5× the joint span means the silhouette includes raised arms.
  if (shoulderRun && shoulderRun.width > distance(sL, sR) && shoulderRun.width < 1.5 * distance(sL, sR)) {
    shoulderWidthPx = shoulderRun.width;
    guides.front.push(hLine('shoulderWidth', shoulderRun));
  } else {
    shoulderConf = minConfidence(shoulderConf, 'medium');
  }
  values.shoulderWidth = { cm: toCm(shoulderWidthPx), confidence: shoulderConf };

  // Armpits: the first row below the shoulder where the arm's centre line leaves the torso silhouette.
  const armpits: { side: 'left' | 'right'; point: Point }[] = [];
  for (const arm of arms) {
    // An armpit further down than this means the arm only parts from the body at the waist.
    for (let y = Math.round(sMid.y + 0.03 * torsoPx); y < sMid.y + 0.4 * torsoPx; y++) {
      const armX = armXAt(arm, y, handPx);
      const run = torsoRun(y);
      if (!run) continue;
      // A raised arm is above this row entirely: the armpit is where the torso no longer reaches past the shoulder joint.
      const armAbove = armX === null && y > Math.max(arm.elbow.y, arm.wrist.y);
      const beyondShoulder = arm.shoulder.x < centerX(y) ? run.left < arm.shoulder.x - 0.1 * torsoPx : run.right > arm.shoulder.x + 0.1 * torsoPx;
      if ((armAbove && !beyondShoulder) || (armX !== null && (armX < run.left || armX > run.right))) {
        armpits.push({ side: arm.side, point: { x: arm.shoulder.x < centerX(y) ? run.left : run.right, y } });
        break;
      }
    }
  }
  const armsAway = armpits.length > 0;
  if (!armsAway) warnings.push('Arms seem to touch the body. Hold them slightly away from the sides for better chest and waist readings.');
  const armpitY = armsAway ? armpits.reduce((sum, a) => sum + a.point.y, 0) / armpits.length : sMid.y + 0.22 * torsoPx;

  // Crotch: the first gap between the legs below the hips.
  const kneeY = (lm[LM.leftKnee].y + lm[LM.rightKnee].y) / 2;
  let crotchY: number | null = null;
  for (let y = Math.round(hMid.y); y < kneeY; y++) {
    const gap = [0, 1, 2].every((dy) => !mask.get(hMid.x, y + dy) && !mask.get(hMid.x - 1, y + dy) && !mask.get(hMid.x + 1, y + dy));
    if (gap) {
      crotchY = y;
      break;
    }
  }
  const crotchFound = crotchY !== null;
  if (!crotchFound) warnings.push('No gap was found between the legs. Stand with feet about shoulder-width apart for an accurate inseam.');
  const crotch = crotchY ?? hMid.y + 0.2 * (kneeY - hMid.y);

  // Front widths at each girth level.
  interface Level {
    key: MeasurementKey;
    run: Run;
    centre: Point;
    confidence: Confidence;
    note?: string;
  }
  const levels: Level[] = [];

  const chestY = Math.min(armpitY + 0.03 * bodyPx, hMid.y - 0.3 * torsoPx);
  const chestRun = torsoRun(chestY);
  if (chestRun) {
    levels.push({ key: 'chest', run: chestRun, centre: { x: centerX(chestY), y: chestY }, confidence: armsAway ? torsoConf : 'low' });
  }

  let waistRun: Run | null = null;
  for (let y = Math.round(chestY + 0.35 * (hMid.y - chestY)); y < hMid.y - 0.05 * torsoPx; y++) {
    const run = torsoRun(y);
    if (!run || runTouchesArm(run, arms, y, handPx)) continue;
    if (!waistRun || run.width < waistRun.width) waistRun = run;
  }
  if (waistRun) levels.push({ key: 'waist', run: waistRun, centre: { x: centerX(waistRun.y), y: waistRun.y }, confidence: torsoConf });

  let hipRun: Run | null = null;
  const hipEnd = Math.min(crotch - 2, hMid.y + 0.4 * torsoPx);
  for (let y = Math.round(hMid.y - 0.05 * torsoPx); y < hipEnd; y++) {
    const run = mask.runAt(y, hMid.x);
    if (!run || runTouchesArm(run, arms, y, handPx)) continue;
    if (!hipRun || run.width > hipRun.width) hipRun = run;
  }
  if (hipRun) levels.push({ key: 'hip', run: hipRun, centre: { x: hMid.x, y: hipRun.y }, confidence: torsoConf });

  const mouthY = (lm[LM.mouthLeft].y + lm[LM.mouthRight].y) / 2;
  // The neck is the narrowest band between chin and shoulders; take the middle of that band.
  const neckCandidates: Run[] = [];
  for (let y = Math.round(mouthY + 0.4 * (sMid.y - mouthY)); y < sMid.y; y++) {
    const run = mask.runAt(y, sMid.x);
    if (run) neckCandidates.push(run);
  }
  const narrowest = Math.min(...neckCandidates.map((r) => r.width));
  const neckBand = neckCandidates.filter((r) => r.width <= narrowest * 1.03);
  const neckRun: Run | null = neckBand.length ? neckBand[Math.floor(neckBand.length / 2)] : null;
  if (neckRun) {
    levels.push({ key: 'neck', run: neckRun, centre: { x: sMid.x, y: neckRun.y }, confidence: visibilityConfidence([lm[LM.mouthLeft], lm[LM.mouthRight], sL, sR]) });
  }

  const thighY = crotch + 0.025 * bodyPx;
  const legL = { x: xAtY(hL, lm[LM.leftKnee], thighY), y: thighY };
  const legR = { x: xAtY(hR, lm[LM.rightKnee], thighY), y: thighY };
  const thighRun = mask.runAt(thighY, legL.x);
  if (thighRun) {
    const legsTouch = legR.x >= thighRun.left && legR.x <= thighRun.right;
    const run = legsTouch ? { ...thighRun, width: thighRun.width / 2, right: thighRun.left + thighRun.width / 2 } : thighRun;
    levels.push({
      key: 'thigh',
      run,
      centre: legL,
      confidence: legsTouch || !crotchFound ? 'low' : visibilityConfidence([hL, lm[LM.leftKnee]]),
      note: legsTouch ? 'Legs were touching; one thigh was taken as half the width of both.' : undefined,
    });
  }

  // Side photo: body depth at the same height above the floor.
  let sideDepth: ((key: MeasurementKey, cmAboveFloor: number) => { depthCm: number; confidence: Confidence } | null) | null = null;
  if (side) {
    const sScale = frameScale(side, heightCm, 'side');
    const slm = side.landmarks;
    const ssMid = midpoint(slm[LM.leftShoulder], slm[LM.rightShoulder]);
    const shMid = midpoint(slm[LM.leftHip], slm[LM.rightHip]);
    const skMid = midpoint(slm[LM.leftKnee], slm[LM.rightKnee]);
    const earMid = midpoint(slm[LM.leftEar], slm[LM.rightEar]);
    const moreVisible = (a: Keypoint, b: Keypoint) => (a.visibility >= b.visibility ? a : b);
    // Side-on, one shoulder and one hip are hidden behind the body, so rate the visible ones.
    const sideConf = visibilityConfidence([moreVisible(slm[LM.leftShoulder], slm[LM.rightShoulder]), moreVisible(slm[LM.leftHip], slm[LM.rightHip])]);

    if (Math.abs(slm[LM.leftShoulder].x - slm[LM.rightShoulder].x) > 0.25 * (shMid.y - ssMid.y)) {
      warnings.push('In the side photo the person does not seem to be fully side-on. Turn 90° so one shoulder faces the camera.');
    }

    sideDepth = (key, cmAboveFloor) => {
      const y = sScale.floorY - cmAboveFloor * sScale.pxPerCm;
      let x: number;
      if (y < ssMid.y) x = xAtY(earMid, ssMid, y);
      else if (y <= shMid.y) x = xAtY(ssMid, shMid, y);
      else x = xAtY(shMid, skMid, y);
      const run = side.mask.runAt(y, x);
      if (!run) return null;
      guides.side.push(hLine(key, run));
      return { depthCm: run.width / sScale.pxPerCm, confidence: sideConf };
    };
  } else {
    warnings.push('No side photo, so girths use typical body proportions and are less accurate.');
  }

  for (const level of levels) {
    const widthCm = toCm(level.run.width);
    const heightAboveFloor = toCm(floorY - level.run.y);
    const depth = sideDepth?.(level.key, heightAboveFloor) ?? null;
    let cm: number;
    let confidence = level.confidence;
    let note = level.note;
    if (depth) {
      cm = ellipsePerimeter(widthCm, depth.depthCm);
      confidence = minConfidence(confidence, depth.confidence);
    } else {
      cm = ellipsePerimeter(widthCm, widthCm * (FALLBACK_DEPTH_RATIO[level.key] ?? 0.8));
      confidence = 'low';
      note = note ?? 'Estimated from the front photo only.';
    }
    values[level.key] = { cm, confidence, note };
    guides.front.push(hLine(level.key, level.run));
  }

  // Arm lengths, from the better-visible arm.
  const armScores = arms.map((a) => Math.min(a.shoulder.visibility, a.elbow.visibility, a.wrist.visibility));
  const bestArm = armScores[0] >= armScores[1] ? arms[0] : arms[1];
  const armConf = visibilityConfidence([bestArm.shoulder, bestArm.elbow, bestArm.wrist]);
  // The shoulder landmark is the joint centre; the shoulder point a tailor uses sits a little further out.
  const shoulderPointOffsetPx = Math.max(0, (shoulderWidthPx - distance(sL, sR)) / 4);
  const armPx = shoulderPointOffsetPx + distance(bestArm.shoulder, bestArm.elbow) + distance(bestArm.elbow, bestArm.wrist);
  values.armLength = { cm: toCm(armPx), confidence: armConf };
  values.sleeveLength = { cm: toCm(shoulderWidthPx / 2 + armPx), confidence: minConfidence(armConf, shoulderConf) };
  guides.front.push({ key: 'armLength', from: bestArm.shoulder, to: bestArm.elbow }, { key: 'armLength', from: bestArm.elbow, to: bestArm.wrist });

  const armpit = armpits.find((a) => a.side === bestArm.side) ?? armpits[0];
  if (armpit) {
    values.sleeveInseam = { cm: toCm(distance(armpit.point, bestArm.elbow) + distance(bestArm.elbow, bestArm.wrist)), confidence: armConf };
    guides.front.push({ key: 'sleeveInseam', from: armpit.point, to: bestArm.elbow });
  }

  if (neckRun && waistRun) {
    values.backLength = { cm: toCm(waistRun.y - neckRun.y), confidence: torsoConf };
  }

  values.inseam = {
    cm: toCm(floorY - crotch),
    confidence: crotchFound ? visibilityConfidence([hL, hR, lm[LM.leftAnkle], lm[LM.rightAnkle]]) : 'low',
    note: crotchFound ? undefined : 'Crotch point estimated because the legs were together.',
  };
  guides.front.push({ key: 'inseam', from: { x: hMid.x, y: crotch }, to: { x: hMid.x, y: floorY } });

  if (waistRun) {
    values.outseam = { cm: toCm(floorY - waistRun.y), confidence: torsoConf };
  }

  flagImplausible(values, heightCm);
  return { values, guides, warnings };
}
