import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests cover the PURE decision logic (evaluateObstruction) and message
// mapping. The image-inference path (runFaceAttributes) needs a real browser +
// the ONNX/WASM weights, so it is exercised manually and documented, not here.
export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
