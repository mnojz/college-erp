import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated/downloaded artifacts (gitignored): Prisma client output and
    // the MediaPipe/ORT model weights fetched by `npm run setup:models`.
    "app/generated/**",
    "public/models/**",
  ]),
]);

export default eslintConfig;
