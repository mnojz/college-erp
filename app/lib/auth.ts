import { cookies } from "next/headers";
import jwt, { type JwtPayload } from "jsonwebtoken";

export const AUTH_COOKIE = "college_erp_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export type Session = JwtPayload & {
  userId: string;
  role: string;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

export function createSessionToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, getJwtSecret(), {
    expiresIn: SESSION_DURATION_SECONDS,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());

    if (
      typeof payload === "object" &&
      typeof payload.userId === "string" &&
      typeof payload.role === "string"
    ) {
      return payload as Session;
    }
  } catch {
    return null;
  }

  return null;
}

export async function requireAdmin() {
  const session = await getSession();
  return session?.role === "ADMIN" ? session : null;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};
