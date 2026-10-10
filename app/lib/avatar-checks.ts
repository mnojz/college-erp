/**
 * Client-side passport-photo quality gates (Phase 2 of profile verification).
 *
 * Runs entirely in the browser on @mediapipe/tasks-vision (FaceLandmarker;
 * WASM + model served from /public/models) before anything is uploaded. These
 * gates are ADVISORY — a modified client can bypass them — so the admin
 * approval workflow at /admin/profile-reviews remains the authoritative check.
 *
 * Checks performed (fail-fast, most-specific-first):
 *   1. Blur/noise   — variance of a 3x3 Laplacian response >= BLUR_MIN_VARIANCE.
 *   2. Exactly one face detected.
 *   3. Head straight — |yaw|, |pitch|, |roll| from the facial transformation
 *      matrix each <= ANGLE_MAX_RAD (~14.3°).
 *   4. Framing — face fills most of the frame and is centred (head-to-chest).
 *
 * NOTE on eyewear: MediaPipe's FaceLandmarker does NOT emit a per-landmark
 * visibility/presence score for faces (that field is only populated by the
 * pose landmarker), and it ships no glasses model. So there is no reliable
 * client-side signal for sunglasses/glasses — attempting one produces false
 * rejections on perfectly clear photos. Eyewear is therefore left to the admin
 * reviewer at /admin/profile-reviews, which is the authoritative gate anyway.
 */

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

/** Minimum Laplacian variance for an acceptable (sharp enough) photo. */
export const BLUR_MIN_VARIANCE = 150;

/**
 * Tuned thresholds for a passport-style photo.
 *
 * Head-pose angles are RADIANS (decomposed from the 4x4 facial transformation
 * matrix). 0.25 rad ≈ 14.3°.
 */
export const PASSPORT = {
  // Max |yaw| / |pitch| / |roll| in radians — head must be near dead-centre.
  ANGLE_MAX_RAD: 0.25,
  FACE_H_MIN: 0.45, // face box height as a fraction of frame (min — head must be large)
  FACE_H_MAX: 0.8, // face box height as a fraction of frame (max — not too zoomed)
  CENTER_TOL: 0.1, // how far the face centre may sit from horizontal middle
} as const;


/**
 * Variance of the 3x3 Laplacian response for a square-resized grayscale
 * copy of `img`.
 *
 * Pipeline: cover-crop to square at `size`×`size` → ITU-R 601 luma
 * (0.299R + 0.587G + 0.114B) → kernel [[0,1,0],[1,-4,1],[0,1,0]] over
 * interior pixels → population variance Σ(x−μ)²/n of the response.
 *
 * Resizing to a fixed size keeps the variance scale comparable across
 * input resolutions, so the threshold is meaningful.
 */
export function laplacianVariance(img: HTMLImageElement, size = 256): number {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;

  // Cover-crop to square so portrait/landscape inputs are comparable.
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(
    img,
    (img.naturalWidth - side) / 2,
    (img.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );

  const { data } = ctx.getImageData(0, 0, size, size);
  const gray = new Float32Array(size * size);
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      const l =
        -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - size] + gray[i + size];
      sum += l;
      sumSq += l * l;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Result of the local verification gates. */
export type FaceCheckResult =
  | { ok: true; score: number }
  | { ok: false; reason: string };

// ── MediaPipe FaceLandmarker (lazy singleton) ────────────────────────────────
// Loads once per session. The WASM backend and model are served from
// /public/models (copied at build time). Keeping this behind a module-level
// promise means the heavy WASM init never re-runs and never blocks first paint.
let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function createLandmarker(): Promise<FaceLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks("/models");
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: "/models/face_landmarker.task",
      delegate: "GPU",
    },
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: true, // needed for head-pose angles
    runningMode: "IMAGE",
    numFaces: 1,
  });
}

function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) landmarkerPromise = createLandmarker();
  return landmarkerPromise;
}

/**
 * Decompose a 4x4 facial transformation matrix (row-major, flattened length 16)
 * into head-pose Euler angles in RADIANS.
 *
 * The upper-left 3x3 is a rotation matrix R. We use the standard ZYX
 * (yaw→pitch→roll) extraction:
 *   pitch = atan2(-R[2][0], sqrt(R[0][0]² + R[1][0]²))
 *   yaw   = atan2(R[1][0], R[0][0])
 *   roll  = atan2(R[2][1], R[2][2])
 * Returns null if the matrix isn't a usable 4x4.
 */
function matrixToEuler(m: { rows: number; columns: number; data: number[] }): {
  yaw: number;
  pitch: number;
  roll: number;
} | null {
  if (m.rows !== 4 || m.columns !== 4 || m.data.length !== 16) return null;
  const d = m.data;
  // Column-major access: element (row r, col c) = d[c*4 + r].
  const r00 = d[0];
  const r10 = d[1];
  const r20 = d[2];
  const r21 = d[6];
  const r22 = d[10];
  const pitch = Math.atan2(-r20, Math.sqrt(r00 * r00 + r10 * r10));
  const yaw = Math.atan2(r10, r00);
  const roll = Math.atan2(r21, r22);
  return { yaw, pitch, roll };
}

/** Bounding box (normalized 0..1) of a set of landmarks. */
function landmarksBounds(landmarks: NormalizedLandmark[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.y > maxY) maxY = lm.y;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * MediaPipe's WASM runtime (Emscripten) prints a startup INFO line —
 * "[browser] INFO: Created TensorFlow Lite XNNPACK delegate for CPU." — the
 * first time the face graph runs. It is harmless, but its stdout plumbing
 * (_fd_write/doWritev) attaches the live JS call stack, so it surfaces in dev
 * tools as a scary-looking "error" at the detect() call site.
 *
 * It cannot be disabled through the public API: the WASM factory captures its
 * output sink exactly once, at instantiation, via `out = console.log.bind(console)`
 * (vision_wasm_internal.js). The glue also never reads globalThis.Module, so a
 * Module.print shim is a no-op here. The only reliable fix is to install a
 * FILTERING console BEFORE the landmarker is first created (i.e. at module
 * load) and leave it installed — the bound reference then routes through our
 * filter for the life of the page.
 *
 * The filter drops ONLY known MediaPipe/WASM startup noise and forwards
 * everything else, so no real log or error is ever lost.
 */
const MP_NOISE_RE =
  /\[browser\]|XNNPACK|TensorFlow\s?Lite|TFLite|Created OpenGL|OpenGL ES delegate|WEBGL delegate/i;

// A genuine failure often mentions the same libs, so never suppress a line that
// reads like an actual error/fatal/abort.
const REAL_ERROR_RE = /\berror\b|\bfatal\b|\bfailed\b|\babort\b|exception/i;

function isMediaPipeNoise(args: unknown[]): boolean {
  if (args.length === 0) return false;
  const joined = args
    .map((a) => (typeof a === "string" ? a : ""))
    .join(" ");
  if (!joined || !MP_NOISE_RE.test(joined)) return false;
  return !REAL_ERROR_RE.test(joined);
}

let consoleFilterInstalled = false;
function installConsoleNoiseFilter(): void {
  if (consoleFilterInstalled || typeof console === "undefined") return;
  consoleFilterInstalled = true;
  const channels = ["log", "info", "warn", "debug", "error"] as const;
  for (const name of channels) {
    const original = console[name].bind(console);
    console[name] = ((...args: unknown[]) => {
      if (isMediaPipeNoise(args)) return;
      return original(...(args as []));
    }) as typeof console[typeof name];
  }
}

// Install at module load — guaranteed to run before the first getLandmarker()
// call, so the WASM factory binds our filtered console instead of the raw one.
installConsoleNoiseFilter();

/**
 * Full passport-style verification of a single face using MediaPipe.
 * Returns a rejection reason on the first failed check, or { ok: true } when
 * the photo passes every gate.
 */
export async function checkPassportFace(img: HTMLImageElement): Promise<FaceCheckResult> {
  let result: FaceLandmarkerResult;
  try {
    // The console noise filter was installed at module load (above), so the
    // WASM startup INFO line is already suppressed by the time we get here.
    result = await getLandmarker().then((landmarker) => landmarker.detect(img));
  } catch (err) {
    console.error("FaceLandmarker detect error:", err);
    return {
      ok: false,
      reason: "Couldn't run face verification. Please try again with a different photo.",
    };
  }

  const faces = result.faceLandmarks ?? [];

  if (faces.length === 0) {
    return {
      ok: false,
      reason: "No face detected. Upload a clear, front-facing passport-style photo of yourself.",
    };
  }
  if (faces.length > 1) {
    return {
      ok: false,
      reason: "More than one person detected. Upload a photo with only yourself.",
    };
  }

  const landmarks = faces[0];

  // ── Head-pose (yaw / pitch / roll) from the facial transformation matrix ──
  const matrix = result.facialTransformationMatrixes?.[0];
  const euler = matrix ? matrixToEuler(matrix) : null;
  if (euler) {
    if (Math.abs(euler.yaw) > PASSPORT.ANGLE_MAX_RAD) {
      return {
        ok: false,
        reason: "You're looking too far left or right. Face the camera straight on.",
      };
    }
    if (Math.abs(euler.pitch) > PASSPORT.ANGLE_MAX_RAD) {
      return {
        ok: false,
        reason: "Please look straight ahead — not too far up or down.",
      };
    }
    if (Math.abs(euler.roll) > PASSPORT.ANGLE_MAX_RAD) {
      return {
        ok: false,
        reason: "Your head is tilted. Please keep it straight and level with the camera.",
      };
    }
  }

  // ── Framing — the face should fill most of the frame (head-to-chest) ──
  const { minX, maxX, minY, maxY } = landmarksBounds(landmarks);
  const faceH = maxY - minY;
  const faceW = maxX - minX;
  const centerX = (minX + maxX) / 2;

  if (faceH < PASSPORT.FACE_H_MIN) {
    return {
      ok: false,
      reason: "Your face is too small in the frame. Move closer so your head fills most of the photo.",
    };
  }
  if (faceH > PASSPORT.FACE_H_MAX || faceW > PASSPORT.FACE_H_MAX) {
    return {
      ok: false,
      reason: "Your face is too large / too close. Include a little space around your head and shoulders.",
    };
  }
  if (Math.abs(centerX - 0.5) > PASSPORT.CENTER_TOL) {
    return { ok: false, reason: "Please centre your face in the frame." };
  }

  return { ok: true, score: 1 };
}

