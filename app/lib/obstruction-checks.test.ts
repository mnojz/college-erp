import { describe, it, expect } from "vitest";
import {
  evaluateObstruction,
  earForEye,
  OBSTRUCTION_THRESHOLD,
  EYE_OPEN_EAR_THRESHOLD,
  LEFT_EYE_INDICES,
  RIGHT_EYE_INDICES,
  type ObstructionInputs,
} from "@/app/lib/obstruction-checks";

/** A clean, unobstructed face — no glasses, no mask, eyes comfortably open. */
const CLEAR: ObstructionInputs = {
  glassesProbability: 0.02,
  maskProbabilities: [0.01, 0.98, 0.01],
  leftEyeEAR: 0.28,
  rightEyeEAR: 0.27,
};

/** Helper: mask probabilities with `with` / `without` / `incorrect` set. */
function mask(withMask: number, withoutMask: number, incorrectMask: number): [
  number,
  number,
  number,
] {
  return [withMask, withoutMask, incorrectMask];
}

describe("evaluateObstruction — obstruction decision logic (FrameFind)", () => {
  it("passes a clear face with no eyewear and no mask", () => {
    expect(evaluateObstruction(CLEAR)).toEqual({ obstructed: false });
  });

  it("rejects eyewear (glasses head is binary: transparent lenses + sunglasses)", () => {
    // FrameFind's MeGlass-trained glasses head is one binary class covering
    // both prescription glasses and sunglasses.
    for (const p of [0.93, 0.99, OBSTRUCTION_THRESHOLD]) {
      const r = evaluateObstruction({ ...CLEAR, glassesProbability: p });
      expect(r).toMatchObject({ obstructed: true, code: "EYEWEAR" });
    }
  });

  it("rejects a properly-worn face mask (with_mask)", () => {
    const r = evaluateObstruction({ ...CLEAR, maskProbabilities: mask(1.0, 0.0, 0.0) });
    expect(r).toMatchObject({ obstructed: true, code: "MASK" });
  });

  it("rejects an incorrectly-worn mask (incorrect_mask) too", () => {
    const r = evaluateObstruction({ ...CLEAR, maskProbabilities: mask(0.1, 0.1, 0.9) });
    expect(r).toMatchObject({ obstructed: true, code: "MASK" });
  });

  it("prioritises mask over eyewear when both fire (mask is the more specific coverage)", () => {
    const r = evaluateObstruction({
      glassesProbability: 0.9,
      maskProbabilities: mask(0.9, 0.05, 0.05),
      leftEyeEAR: 0.25,
      rightEyeEAR: 0.25,
    });
    expect(r).toMatchObject({ obstructed: true, code: "MASK" });
  });

  it("treats an uncertain prediction (everything below threshold) as NOT obstructed", () => {
    // Low-confidence everywhere -> passes the AI gate, deferred to admin review.
    const uncertain: ObstructionInputs = {
      glassesProbability: 0.3,
      maskProbabilities: mask(0.2, 0.6, 0.15),
      leftEyeEAR: 0.25,
      rightEyeEAR: 0.25,
    };
    expect(evaluateObstruction(uncertain)).toEqual({ obstructed: false });
  });

  it("uses an inclusive threshold for both heads (value == threshold rejects)", () => {
    expect(
      evaluateObstruction({ ...CLEAR, glassesProbability: OBSTRUCTION_THRESHOLD }),
    ).toMatchObject({ obstructed: true, code: "EYEWEAR" });
    expect(
      evaluateObstruction({ ...CLEAR, maskProbabilities: mask(OBSTRUCTION_THRESHOLD, 0, 0) }),
    ).toMatchObject({ obstructed: true, code: "MASK" });
  });

  it("does not confuse an uncertain (mid-range) glasses score with eyewear", () => {
    // Just under threshold — must not claim eyewear was detected.
    const r = evaluateObstruction({ ...CLEAR, glassesProbability: OBSTRUCTION_THRESHOLD - 0.01 });
    expect(r).toEqual({ obstructed: false });
  });

  it("provides a friendly, non-technical reason for each rejection", () => {
    for (const inputs of [
      { ...CLEAR, glassesProbability: 0.9 },
      { ...CLEAR, maskProbabilities: mask(0.9, 0.05, 0.05) },
      { ...CLEAR, leftEyeEAR: 0.05 },
    ]) {
      const r = evaluateObstruction(inputs);
      expect(r.obstructed).toBe(true);
      if (r.obstructed) {
        expect(r.reason.length).toBeGreaterThan(10);
        expect(r.reason).not.toMatch(/onnx|tensor|model|score|NaN|framefind/i);
      }
    }
  });
});

// ── Eye-state gate (EAR on MediaPipe landmarks) ──────────────────────────────

/**
 * Build a minimal 478-entry face-mesh where only the 12 eye-contour landmarks
 * are set; all others are placeholder points. The EAR only reads the six
 * indices per eye, so everything else can be dummies.
 */
function landmarksWithEyes(
  left: { open: boolean },
  right: { open: boolean },
): { x: number; y: number; z: number }[] {
  const lms: { x: number; y: number; z: number }[] = Array.from(
    { length: 478 },
    () => ({ x: 0.5, y: 0.5, z: 0 }),
  );
  // [p1(inner corner), p2, p3, p4(outer corner), p5, p6] in EAR order.
  // p2/p6 and p3/p5 are vertical lid pairs; the vertical separation encodes
  // open (large) vs closed (near-zero) while the corners stay fixed.
  const setEye = (
    indices: readonly [number, number, number, number, number, number],
    cx: number,
    open: boolean,
  ) => {
    const h = 0.08; // horizontal eye width
    const v = open ? 0.04 : 0.004; // lid separation
    const [p1, p2, p3, p4, p5, p6] = indices;
    lms[p1] = { x: cx - h / 2, y: 0.4, z: 0 };
    lms[p4] = { x: cx + h / 2, y: 0.4, z: 0 };
    lms[p2] = { x: cx - h / 6, y: 0.4 - v, z: 0 };
    lms[p6] = { x: cx - h / 6, y: 0.4 + v, z: 0 };
    lms[p3] = { x: cx + h / 6, y: 0.4 - v, z: 0 };
    lms[p5] = { x: cx + h / 6, y: 0.4 + v, z: 0 };
  };
  setEye([362, 385, 387, 263, 373, 380], 0.35, left.open);
  setEye([33, 160, 158, 133, 153, 144], 0.65, right.open);
  return lms;
}

describe("earForEye — pure EAR math", () => {
  it("computes EAR = (vertical1 + vertical2) / (2 · horizontal)", () => {
    // Hand-built eye: width 0.08, lid pairs at ±0.02 → (0.04 + 0.04) / 0.16 = 0.5.
    const eye = [
      { x: 0.0, y: 0.5, z: 0 }, // p1
      { x: 0.02, y: 0.48, z: 0 }, // p2
      { x: 0.06, y: 0.48, z: 0 }, // p3
      { x: 0.08, y: 0.5, z: 0 }, // p4
      { x: 0.06, y: 0.52, z: 0 }, // p5
      { x: 0.02, y: 0.52, z: 0 }, // p6
    ];
    expect(earForEye(eye, [0, 1, 2, 3, 4, 5])).toBeCloseTo(0.5, 6);
  });

  it("returns null when any required landmark is missing", () => {
    const eye = landmarksWithEyes({ open: true }, { open: true });
    const indices = [362, 385, 387, 263, 373, 380];
    expect(earForEye(eye, indices)).not.toBeNull();
    const broken = eye.slice();
    broken[385] = undefined as never; // drop one lid point
    expect(earForEye(broken, indices)).toBeNull();
  });

  it("returns null for a degenerate (zero-width) eye", () => {
    const collapsed = Array.from({ length: 6 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    expect(earForEye(collapsed, [0, 1, 2, 3, 4, 5])).toBeNull();
  });
});

describe("evaluateObstruction — eye-state gate", () => {
  it("passes when both eyes are comfortably open", () => {
    expect(evaluateObstruction(CLEAR)).toEqual({ obstructed: false });
  });

  it("rejects when both eyes are closed", () => {
    const r = evaluateObstruction({ ...CLEAR, leftEyeEAR: 0.08, rightEyeEAR: 0.09 });
    expect(r).toMatchObject({ obstructed: true, code: "EYES_CLOSED" });
  });

  it("rejects when only ONE eye is closed (wink / lazy lid)", () => {
    expect(evaluateObstruction({ ...CLEAR, leftEyeEAR: 0.09, rightEyeEAR: 0.27 }))
      .toMatchObject({ obstructed: true, code: "EYES_CLOSED" });
    expect(evaluateObstruction({ ...CLEAR, leftEyeEAR: 0.28, rightEyeEAR: 0.1 }))
      .toMatchObject({ obstructed: true, code: "EYES_CLOSED" });
  });

  it("rejects strictly-below-threshold EAR and passes just above it", () => {
    expect(
      evaluateObstruction({
        ...CLEAR,
        leftEyeEAR: EYE_OPEN_EAR_THRESHOLD - 0.001,
        rightEyeEAR: 0.3,
      }),
    ).toMatchObject({ obstructed: true, code: "EYES_CLOSED" });
    expect(
      evaluateObstruction({
        ...CLEAR,
        leftEyeEAR: EYE_OPEN_EAR_THRESHOLD + 0.001,
        rightEyeEAR: 0.3,
      }),
    ).toEqual({ obstructed: false });
  });

  it("skips the eye gate when EAR is null (landmarks unavailable) — no false reject", () => {
    expect(
      evaluateObstruction({ ...CLEAR, leftEyeEAR: null, rightEyeEAR: null }),
    ).toEqual({ obstructed: false });
    // One eye measurable and open, other missing → still passes.
    expect(
      evaluateObstruction({ ...CLEAR, leftEyeEAR: 0.3, rightEyeEAR: null }),
    ).toEqual({ obstructed: false });
  });

  it("ranks model verdicts (MASK > EYEWEAR) above EYES_CLOSED", () => {
    expect(
      evaluateObstruction({
        glassesProbability: 0.9,
        maskProbabilities: mask(0.9, 0.05, 0.05),
        leftEyeEAR: 0.05,
        rightEyeEAR: 0.05,
      }),
    ).toMatchObject({ obstructed: true, code: "MASK" });
    expect(
      evaluateObstruction({
        glassesProbability: 0.9,
        maskProbabilities: mask(0.05, 0.9, 0.05),
        leftEyeEAR: 0.05,
        rightEyeEAR: 0.05,
      }),
    ).toMatchObject({ obstructed: true, code: "EYEWEAR" });
  });

  it("end-to-end: synthetic closed-eye landmark mesh yields EYES_CLOSED, open mesh passes", () => {
    const closed = landmarksWithEyes({ open: false }, { open: false });
    const open = landmarksWithEyes({ open: true }, { open: true });
    const ear = (lms: { x: number; y: number; z: number }[]) => ({
      leftEyeEAR: earForEye(lms, LEFT_EYE_INDICES),
      rightEyeEAR: earForEye(lms, RIGHT_EYE_INDICES),
    });
    // Sanity: the synthetic geometry really does separate the two states.
    expect(earForEye(open, LEFT_EYE_INDICES)).toBeGreaterThan(EYE_OPEN_EAR_THRESHOLD);
    expect(earForEye(closed, LEFT_EYE_INDICES)).toBeLessThan(EYE_OPEN_EAR_THRESHOLD);
    expect(
      evaluateObstruction({ ...CLEAR, ...ear(closed) }),
    ).toMatchObject({ obstructed: true, code: "EYES_CLOSED" });
    expect(evaluateObstruction({ ...CLEAR, ...ear(open) })).toEqual({ obstructed: false });
  });
});
