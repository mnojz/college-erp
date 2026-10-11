import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Pure logic for the forgot-password OTP flow and the generated temporary
 * password. Kept free of I/O so it can be unit-tested directly (see
 * reset-otp.test.ts).
 */

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_SENDS_PER_WINDOW = 3;
export const OTP_SEND_WINDOW_MS = 60 * 60 * 1000;
export const TEMP_PASSWORD_LENGTH = 8;

const PASSWORD_ALPHABET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Cryptographically random 6-digit code; leading zeros preserved. */
export function generateOtpCode(): string {
	return randomInt(0, 1_000_000).toString().padStart(OTP_LENGTH, "0");
}

/** SHA-256 of the code as lowercase hex — what we persist in the database. */
export function hashOtp(code: string): string {
	return createHash("sha256").update(code, "utf8").digest("hex");
}

/** Cryptographically random 8-character alphanumeric password (62^8 ≈ 2.18e14). */
export function generateTempPassword(): string {
	let out = "";
	for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
		out += PASSWORD_ALPHABET[randomInt(0, PASSWORD_ALPHABET.length)];
	}
	return out;
}

/** The stored OTP state we validate a submitted code against. */
export type OtpState = {
	hash: string | null;
	expiresAt: Date | null;
	attempts: number;
};

export type OtpVerifyResult =
	| "ok"
	| "missing"
	| "expired"
	| "maxed"
	| "mismatch";

/**
 * Pure verification of a submitted code. The caller trims input; the result
 * distinguishes every failure mode so routes can respond uniformly. The
 * caller is responsible for persisting an incremented attempt count on a
 * non-"ok" result.
 */
export function verifyOtp(
	state: OtpState,
	code: string,
	now: Date = new Date(),
): OtpVerifyResult {
	if (!state.hash || !state.expiresAt) return "missing";
	if (state.attempts >= OTP_MAX_ATTEMPTS) return "maxed";
	if (state.expiresAt.getTime() <= now.getTime()) return "expired";

	const submitted = Buffer.from(hashOtp(code.trim()), "hex");
	const stored = Buffer.from(state.hash, "hex");
	const match =
		submitted.length === stored.length &&
		timingSafeEqual(submitted, stored);
	return match ? "ok" : "mismatch";
}

/** True when no OTP was sent yet, or the resend cooldown has elapsed. */
export function canResendOtp(
	sentAt: Date | null,
	now: Date = new Date(),
): boolean {
	return !sentAt || now.getTime() - sentAt.getTime() >= OTP_RESEND_COOLDOWN_MS;
}

/**
 * Sliding 1-hour send budget: resets once the last send is older than the
 * window (approximation of a true rolling counter, good enough for abuse
 * throttling on a single instance).
 */
export function sendsWithinWindow(
	sentAt: Date | null,
	sendCount: number,
	now: Date = new Date(),
): number {
	if (!sentAt) return 0;
	return now.getTime() - sentAt.getTime() < OTP_SEND_WINDOW_MS
		? sendCount
		: 0;
}
