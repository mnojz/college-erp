# Face-verification models

The client-side profile-picture checks need **two** model runtimes here. These are
large binaries (~70MB total) and are **not** committed to git.

Fetch them with:

```bash
npm run setup:models   # or: bash scripts/fetch-models.sh
```

## 1. MediaPipe FaceLandmarker (`app/lib/avatar-checks.ts`)
Face detection, landmarks, and head-pose. Files: `face_landmarker.task` plus the
`vision_wasm_*` runtime files.

## 2. FrameFind obstruction detectors (`app/lib/obstruction-checks.ts`)
Eyewear (glasses + sunglasses) and face-mask detection via onnxruntime-web.
Files: `framefind/glasses.onnx` + `framefind/mask.onnx` (~6.1MiB each,
[moraxh/FrameFind](https://github.com/moraxh/FrameFind), MIT) plus the
`ort/ort-wasm-simd-threaded*.wasm` onnxruntime-web binaries.

Closed eyes are also rejected — no extra model: the gate computes the
eye-aspect-ratio (EAR) from the MediaPipe landmarks already produced for this
photo and rejects below `EYE_OPEN_EAR_THRESHOLD`.

Known limits (by design of the chosen models): no sticker/emoji, hand, or
general occlusion detector; hair over the eyes may read as "no glasses".
Anything these miss still reaches admin review.
