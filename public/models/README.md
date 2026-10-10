# Face-verification models (MediaPipe)

The client-side profile-picture checks (`app/lib/avatar-checks.ts`) need the
MediaPipe FaceLandmarker model and its WASM runtime here. These are large
binaries (~40MB) and are **not** committed to git.

Fetch them with:

```bash
npm run setup:models   # or: bash scripts/fetch-models.sh
```

Expected files: `face_landmarker.task` plus the `vision_wasm_*` runtime files.
