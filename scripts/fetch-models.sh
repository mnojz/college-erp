#!/usr/bin/env bash
# Downloads the MediaPipe FaceLandmarker model + WASM runtime into public/models/.
# These are large binaries (~40MB) and are intentionally not committed.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/models

MODEL_URL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
echo "Fetching face_landmarker.task ..."
curl -fsSL -o public/models/face_landmarker.task "$MODEL_URL"

echo "Copying MediaPipe WASM runtime from @mediapipe/tasks-vision ..."
cp node_modules/@mediapipe/tasks-vision/wasm/* public/models/ 2>/dev/null || {
  echo "WASM files not found in node_modules — run `npm install` first." >&2
  exit 1
}

# ── FrameFind obstruction detectors (eyewear / mask) + its ONNX runtime ──────
# Two ~6.1 MiB ONNX classifiers from moraxh/FrameFind (MIT), self-hosted so no
# request ever hits the FrameFind CDN. See app/lib/obstruction-checks.ts.
mkdir -p public/models/framefind
echo "Fetching FrameFind glasses.onnx + mask.onnx (moraxh/FrameFind, MIT) ..."
curl -fsSL -o public/models/framefind/glasses.onnx \
  "https://raw.githubusercontent.com/moraxh/FrameFind/main/models/glasses/v1/glasses.onnx"
curl -fsSL -o public/models/framefind/mask.onnx \
  "https://raw.githubusercontent.com/moraxh/FrameFind/main/models/mask/v1/mask.onnx"

echo "Copying onnxruntime-web WASM binaries ..."
mkdir -p public/models/ort
# ORT's wasm backend needs BOTH the .wasm binaries and the .mjs glue modules —
# it dynamically imports `${wasmPaths}/ort-wasm-simd-threaded.jsep.mjs`.
cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded*.wasm \
   node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded*.mjs \
   public/models/ort/ 2>/dev/null || {
  echo "onnxruntime-web WASM files not found — run `npm install` first." >&2
  exit 1
}

echo "Done. Models are in public/models/"
