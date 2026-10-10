#!/usr/bin/env bash
# Downloads the MediaPipe FaceLandmarker model + WASM runtime into public/models/.
# These are large binaries (~40MB) and are intentionally not committed.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/models

MODEL_URL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
echo "Fetching face_landmarker.task ..."
curl -fsSL -o public/models/face_landmarker.task "$MODEL_URL"

echo "Copying WASM runtime from @mediapipe/tasks-vision ..."
cp node_modules/@mediapipe/tasks-vision/wasm/* public/models/ 2>/dev/null || {
  echo "WASM files not found in node_modules — run `npm install` first." >&2
  exit 1
}

echo "Done. Models are in public/models/"
