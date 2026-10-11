/**
 * Loads environment variables the way Next.js does: `.env` first, then
 * `.env.local` overrides it. The Prisma CLI and the seed scripts run outside
 * Next.js, so they import this module (before anything reads process.env) to
 * see the same DATABASE_URL as the app — e.g. the real Neon credentials that
 * live in the gitignored `.env.local`.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"] });
