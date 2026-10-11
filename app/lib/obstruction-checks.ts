/**
 * Facial-obstruction detection (eyewear / face mask) using FrameFind
 * (github.com/moraxh/FrameFind, MIT) — the second mandatory AI stage of profile
 * verification.
 *
 * WHY A SECOND MODEL: MediaPipe's FaceLandmarker (app/lib/avatar-checks.ts) has
 * no glasses/mask model and does not populate per-landmark visibility for faces,
 * so it cannot reliably detect eyewear. FrameFind ships two small (~6.1 MiB each)
 * ONNX classifiers that run fully offline via onnxruntime-web:
 *   - GlassesDetector — binary "wearing glasses" from an eye-region crop,
 *     trained on the MeGlass dataset (regular + sunglasses are one class).
 *   - MaskDetector     — 3-class (with_mask / without_mask / incorrect_mask)
 *     from a face-region crop.
 *
 * Both detectors are configured with `autoLandmarks: false` and fed the
 * landmarks our existing MediaPipe singleton already produced, so face detection
 * runs exactly ONCE per photo. No image ever leaves the device. This is an
 * ADVISORY first-stage filter; admin approval remains the authoritative gate
 * (see /admin/profile-reviews).
 *
 * Eye state (closed eyes) is checked alongside them via the eye-aspect-ratio
 * (EAR) computed directly from those same landmarks — pure geometry, no extra
 * model, no extra inference pass. See EYE_OPEN_EAR_THRESHOLD.
 *
 * Integration: called from checkPassportFace() AFTER the MediaPipe gates pass,
 * on a canvas capped at MAX_CANVAS_PX — never the full-resolution original.
 */

import { GlassesDetector, MaskDetector } from "@framefind/core";

/** Longest side of the canvas inference runs on (full-res copies avoided). */
export const MAX_CANVAS_PX = 1024;

/**
 * Decision thresholds. FrameFind's own defaults: 0.35 for glasses (code),
 * 0.5 documented for both. We use 0.5 explicitly for both — at this operating
 * point the MeGlass-trained glasses head catches transparent lenses, and any
 * miss falls through to admin review rather than silently approving.
 */
export const OBSTRUCTION_THRESHOLD = 0.5;

/** Machine-readable obstruction codes (mirrors RejectionCode in avatar-checks). */
export type ObstructionCode = "EYEWEAR" | "MASK" | "EYES_CLOSED";

/** Raw detector outputs used by the pure decision layer. */
export type ObstructionInputs = {
  /** Smoothed probability the person is wearing (any) glasses, in [0, 1]. */
  glassesProbability: number;
  /** Smoothed per-class probabilities from the mask head, in [0, 1]. */
  maskProbabilities: [withMask: number, withoutMask: number, incorrectMask: number];
  /**
   * Eye-aspect-ratio per eye in [0, ~0.4]: higher = more open. null when the
   * eye landmarks were unavailable (eye-state check is then skipped — the
   * mask/eyewear checks above are model-driven and unaffected).
   */
  leftEyeEAR: number | null;
  rightEyeEAR: number | null;
};

/**
 * Eye-state check via the eye-aspect-ratio (EAR) on the existing MediaPipe
 * landmarks — no model needed. Indices are the standard 6-point eye contours
 * (corner, upper/lower lid x2) that FrameFind's own BlinkDetector uses; EAR =
 * (‖p2−p6‖ + ‖p3−p5‖) / (2·‖p1−p4‖). Open eyes land ≈ 0.20–0.35; closed or
 * nearly-closed lids collapse to ≈ 0.05–0.13. The threshold sits between the
 * two populations with margin for narrow-eye shapes and mild downward gaze.
 */
export const EYE_OPEN_EAR_THRESHOLD = 0.15;

/** MediaPipe face-mesh indices, in [p1, p2, p3, p4, p5, p6] EAR order. */
export const LEFT_EYE_INDICES = [362, 385, 387, 263, 373, 380] as const;
export const RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144] as const;

function dist2d(a: LandmarkLike, b: LandmarkLike): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Pure EAR computation for one eye from 6 landmarks. Returns null when any
 * point is missing/non-finite or the eye has no horizontal extent (callers
 * skip the eye-state gate for that eye instead of guessing).
 */
export function earForEye(
  landmarks: readonly (LandmarkLike | undefined)[],
  indices: readonly number[],
): number | null {
  const [p1, p2, p3, p4, p5, p6] = indices.map((i) => landmarks[i]);
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return null;
  const points = [p1, p2, p3, p4, p5, p6];
  if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const horizontal = dist2d(p1, p4);
  if (horizontal < 1e-6) return null;
  const ear = (dist2d(p2, p6) + dist2d(p3, p5)) / (2 * horizontal);
  return Number.isFinite(ear) ? ear : null;
}

export type ObstructionVerdict =
  | { obstructed: false }
  | { obstructed: true; code: ObstructionCode; reason: string };

/**
 * Pure decision logic — separated from inference so it is unit-testable
 * without a model. Returns the most severe obstruction present, or
 * { obstructed: false }.
 *
 * "incorrect_mask" (mask worn but not covering properly, e.g. pulled below the
 * nose) is also a rejection: a mask visible on the face at all fails the
 * passport-photo policy.
 *
 * Eye state (EYES_CLOSED) is checked last from the EAR values: it is a
 * geometric heuristic on the landmarks rather than a model prediction, so it
 * ranks below the model-driven mask/eyewear verdicts when several apply at
 * once. Either eye below EYE_OPEN_EAR_THRESHOLD rejects the photo.
 */
export function evaluateObstruction(i: ObstructionInputs): ObstructionVerdict {
  const [withMask, , incorrectMask] = i.maskProbabilities;
  if (
    withMask >= OBSTRUCTION_THRESHOLD ||
    incorrectMask >= OBSTRUCTION_THRESHOLD
  ) {
    return {
      obstructed: true,
      code: "MASK",
      reason: "Your nose or mouth appears to be covered. Please upload an unobstructed photo.",
    };
  }
  if (i.glassesProbability >= OBSTRUCTION_THRESHOLD) {
    return {
      obstructed: true,
      code: "EYEWEAR",
      reason: "Glasses or sunglasses are not allowed. Please upload a photo without eyewear.",
    };
  }
  const eyes = [i.leftEyeEAR, i.rightEyeEAR];
  if (eyes.some((ear) => ear !== null && ear < EYE_OPEN_EAR_THRESHOLD)) {
    return {
      obstructed: true,
      code: "EYES_CLOSED",
      reason: "Please open your eyes and look straight at the camera, then try again.",
    };
  }
  return { obstructed: false };
}

// ── FrameFind lazy singletons ────────────────────────────────────────────────
// The ONNX sessions + WASM runtime load once per session and are reused, so
// repeated uploads never re-download or re-initialise. autoLandmarks:false
// keeps FrameFind from spinning up its own MediaPipe instance — we pass ours.
const MODEL_BASE = "/models/framefind";
const WASM_PATH = "/models/ort/";

let detectorsPromise: Promise<{ glasses: GlassesDetector; mask: MaskDetector }> | null = null;


async function createDetectors(): Promise<{ glasses: GlassesDetector; mask: MaskDetector }> {
  const glasses = new GlassesDetector({
    modelUrl: `${MODEL_BASE}/glasses.onnx`,
    wasmPaths: WASM_PATH,
    autoLandmarks: false,
    smoothingWindow: 1,
    threshold: OBSTRUCTION_THRESHOLD,
  });
  const mask = new MaskDetector({
    modelUrl: `${MODEL_BASE}/mask.onnx`,
    wasmPaths: WASM_PATH,
    autoLandmarks: false,
    smoothingWindow: 1,
    threshold: OBSTRUCTION_THRESHOLD,
  });
  await Promise.all([glasses.load(), mask.load()]);
  return { glasses, mask };
}

function getDetectors(): Promise<{ glasses: GlassesDetector; mask: MaskDetector }> {
  if (!detectorsPromise) detectorsPromise = createDetectors();
  return detectorsPromise;
}

type LandmarkLike = { x: number; y: number; z: number };

/**
 * Run the obstruction detectors on `img` using the MediaPipe landmarks from
 * the same verification pass.
 *
 * Returns the raw probabilities for the pure decision layer, or null when the
 * models failed to load / inference threw — callers must treat null as
 * UNCERTAIN (fail closed, never auto-approve).
 */
export async function detectObstructions(
  img: HTMLImageElement,
  landmarks: LandmarkLike[],
): Promise<ObstructionInputs | null> {
  try {
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    if (!W || !H || landmarks.length === 0) return null;

    // Draw at a capped size — landmarks are normalized, so scaling is free,
    // and inference never touches the full-resolution pixels.
    const scale = Math.min(1, MAX_CANVAS_PX / Math.max(W, H));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(W * scale));
    canvas.height = Math.max(1, Math.round(H * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const { glasses, mask } = await getDetectors();
    // Eye state is pure geometry on the landmarks we already have — no model
    // inference needed. Computed here so the decision layer stays a pure fn.
    const leftEyeEAR = earForEye(landmarks, LEFT_EYE_INDICES);
    const rightEyeEAR = earForEye(landmarks, RIGHT_EYE_INDICES);
    // NOTE: run the two heads strictly SEQUENTIALLY. onnxruntime-web's wasm
    // backend guards all sessions with a single global in-flight flag, so two
    // concurrent session.run() calls (even on separate sessions) throw
    // "Session already started". Both heads are tiny, so this costs nothing.
    const glassesResult = await glasses.detectFromCanvas(canvas, landmarks);
    const maskResult = await mask.detectFromCanvas(canvas, landmarks);
    canvas.width = 0; // release the pixel buffer promptly
    canvas.height = 0;

    if (!glassesResult.faceDetected || !maskResult.faceDetected) return null;
    return {
      glassesProbability: glassesResult.probability,
      maskProbabilities: maskResult.probabilities,
      leftEyeEAR,
      rightEyeEAR,
    };
  } catch (err) {
    console.error("[obstruction-checks] inference failed:", err);
    return null;
  }
}
