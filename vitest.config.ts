import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests cover the PURE decision logic (evaluateObstruction) and message
// mapping. The image-inference path (runFaceAttributes) needs a real browser +
// the ONNX/WASM weights, so it is exercised manually and documented, not here.
export default defineConfig({
  test: {
    environment: "node",
    // `.tsx` lets component tests render real markup via react-dom/server.
    include: ["app/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
