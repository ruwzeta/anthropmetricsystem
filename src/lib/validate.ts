import { distance, midpoint } from './geometry';
import type { MeasurementKey } from './definitions';
import { LM, type MeasuredValue, type MeasurementResult, type PoseFrame } from './measure';

export type View = 'front' | 'side';

const REQUIRED_FRONT = [LM.nose, LM.leftShoulder, LM.rightShoulder, LM.leftElbow, LM.rightElbow, LM.leftWrist, LM.rightWrist, LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle];

/**
 * Checks that a photo is usable before measuring: the whole body is in frame,
 * the key body points are visible, and the person faces the right way.
 * Returns plain-language problems; an empty list means the photo looks good.
 */
export function checkPhoto(frame: PoseFrame, view: View): string[] {
  const issues: string[] = [];
  const { landmarks: lm, mask } = frame;

  const top = mask.topRow();
  const bottom = mask.bottomRow();
  if (top <= 1) issues.push('The top of the head is cut off. Step back or tilt the camera so there is space above the head.');
  if (bottom >= mask.height - 2) issues.push('The feet touch the bottom edge. Make sure the feet and a little floor are visible.');
  if (top >= 0 && bottom - top < mask.height * 0.4) issues.push('The person is small in the photo. Move closer so the body fills most of the frame.');

  if (view === 'front') {
    const hidden = REQUIRED_FRONT.filter((i) => lm[i].visibility < 0.5);
    if (hidden.length > 2) issues.push('Several body points are hidden. Wear fitted clothes and keep arms and legs uncovered by other objects.');
    const torsoLen = midpoint(lm[LM.leftHip], lm[LM.rightHip]).y - midpoint(lm[LM.leftShoulder], lm[LM.rightShoulder]).y;
    const raised = [LM.leftWrist, LM.rightWrist].some((i, n) => lm[i].y < lm[n ? LM.rightShoulder : LM.leftShoulder].y + 0.4 * torsoLen);
    if (raised) issues.push('The arms are raised. Lower them to about 30° from the body.');
    const hipSpan = distance(lm[LM.leftHip], lm[LM.rightHip]);
    if (distance(lm[LM.leftAnkle], lm[LM.rightAnkle]) > 3 * hipSpan) issues.push('The feet are very wide apart. Stand with feet about shoulder-width apart.');
  }

  const shoulderSpan = distance(lm[LM.leftShoulder], lm[LM.rightShoulder]);
  const torso = distance(midpoint(lm[LM.leftShoulder], lm[LM.rightShoulder]), midpoint(lm[LM.leftHip], lm[LM.rightHip]));
  if (torso > 0) {
    const ratio = shoulderSpan / torso;
    if (view === 'front' && ratio < 0.45) issues.push('The person seems to be turned. Face the camera straight on.');
    if (view === 'side' && ratio > 0.35) issues.push('The person is not fully side-on. Turn 90° so one shoulder points at the camera.');
  }
  return issues;
}

/**
 * When a photo failed its checks, no value from it can be trusted as "Good":
 * every measurement except the entered height is marked for a tape check.
 */
export function downgradeForPhotoIssues(values: MeasurementResult['values'], issues: string[]): MeasurementResult['values'] {
  if (issues.length === 0) return values;
  const out: MeasurementResult['values'] = {};
  for (const [key, v] of Object.entries(values) as [MeasurementKey, MeasuredValue][]) {
    out[key] = key === 'height' ? v : { ...v, confidence: 'low', note: v.note ?? 'The photo did not pass its checks. Measure with a tape.' };
  }
  return out;
}
