/**
 * Loads environment variables the way Next.js does: `.env` first, then
 * `.env.local` overrides it. The Prisma CLI and the seed scripts run outside
 * Next.js, so they import this module (before anything reads process.env) to
 * see the same DATABASE_URL as the app — e.g. the real Neon credentials that
 * live in the gitignored `.env.local`.
 */
import { config as loadEnv } from "dotenv";

// dotenv does NOT override existing vars, so load the base first and the
// override file second — mirroring Next.js `.env` → `.env.local` precedence.
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });
