import { describe, expect, it } from "vitest";
import {
	canResendOtp,
	generateOtpCode,
	generateTempPassword,
	hashOtp,
	OTP_MAX_ATTEMPTS,
	OTP_MAX_SENDS_PER_WINDOW,
	OTP_RESEND_COOLDOWN_MS,
	OTP_TTL_MS,
	sendsWithinWindow,
	verifyOtp,
	TEMP_PASSWORD_LENGTH,
	type OtpState,
} from "./reset-otp";

const NOW = new Date("2026-01-01T12:00:00.000Z");

function state(overrides: Partial<OtpState> = {}): OtpState {
	return {
		hash: hashOtp("123456"),
		expiresAt: new Date(NOW.getTime() + OTP_TTL_MS),
		attempts: 0,
		...overrides,
	};
}

describe("generateOtpCode", () => {
	it("produces a 6-digit numeric code", () => {
		for (let i = 0; i < 200; i++) {
			expect(generateOtpCode()).toMatch(/^\d{6}$/);
		}
	});
});

describe("generateTempPassword", () => {
	it("produces an 8-character alphanumeric password", () => {
		expect(TEMP_PASSWORD_LENGTH).toBe(8);
		for (let i = 0; i < 200; i++) {
			const password = generateTempPassword();
			expect(password).toHaveLength(TEMP_PASSWORD_LENGTH);
			expect(password).toMatch(/^[A-Za-z0-9]{8}$/);
		}
	});

	it("does not repeat the same value every time", () => {
		const values = new Set(
			Array.from({ length: 50 }, () => generateTempPassword()),
		);
		expect(values.size).toBeGreaterThan(1);
	});
});

describe("verifyOtp", () => {
	it("accepts the correct code", () => {
		expect(verifyOtp(state(), "123456", NOW)).toBe("ok");
	});

	it("accepts a trimmed code", () => {
		expect(verifyOtp(state(), "  123456 ", NOW)).toBe("ok");
	});

	it("rejects a wrong code", () => {
		expect(verifyOtp(state(), "654321", NOW)).toBe("mismatch");
	});

	it("reports missing when no OTP was requested", () => {
		expect(verifyOtp(state({ hash: null, expiresAt: null }), "123456", NOW)).toBe(
			"missing",
		);
	});

	it("rejects an expired code", () => {
		const expired = state({
			expiresAt: new Date(NOW.getTime() - 1),
		});
		expect(verifyOtp(expired, "123456", NOW)).toBe("expired");
	});

	it("rejects once the attempt cap is reached", () => {
		const capped = state({ attempts: OTP_MAX_ATTEMPTS });
		expect(verifyOtp(capped, "123456", NOW)).toBe("maxed");
	});

	it("still allows attempts below the cap", () => {
		const almost = state({ attempts: OTP_MAX_ATTEMPTS - 1 });
		expect(verifyOtp(almost, "123456", NOW)).toBe("ok");
		expect(verifyOtp(almost, "000000", NOW)).toBe("mismatch");
	});
});

describe("canResendOtp", () => {
	it("allows the first send", () => {
		expect(canResendOtp(null, NOW)).toBe(true);
	});

	it("blocks a resend inside the cooldown", () => {
		const sentAt = new Date(NOW.getTime() - OTP_RESEND_COOLDOWN_MS + 1000);
		expect(canResendOtp(sentAt, NOW)).toBe(false);
	});

	it("allows a resend after the cooldown", () => {
		const sentAt = new Date(NOW.getTime() - OTP_RESEND_COOLDOWN_MS);
		expect(canResendOtp(sentAt, NOW)).toBe(true);
	});
});

describe("sendsWithinWindow", () => {
	it("is zero when nothing was sent", () => {
		expect(sendsWithinWindow(null, 7, NOW)).toBe(0);
	});

	it("keeps the count inside the window", () => {
		const sentAt = new Date(NOW.getTime() - 30 * 60 * 1000);
		expect(sendsWithinWindow(sentAt, 2, NOW)).toBe(2);
	});

	it("resets the count once the window has passed", () => {
		const sentAt = new Date(NOW.getTime() - 61 * 60 * 1000);
		expect(sendsWithinWindow(sentAt, OTP_MAX_SENDS_PER_WINDOW, NOW)).toBe(0);
	});
});
