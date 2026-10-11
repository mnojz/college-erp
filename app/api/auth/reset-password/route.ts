import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendTemporaryPassword } from "@/app/lib/mailer";
import { generateTempPassword, verifyOtp } from "@/app/lib/reset-otp";

/**
 * Forgot-password step 2: verify the emailed OTP, then replace the account
 * password with a random 8-character one and email it to the same mailbox.
 *
 * The OTP gate is what stops an attacker from rotating someone else's
 * password just by typing their email — the reset only happens once the
 * requester proves control of the mailbox.
 */

// One message for every failure mode (unknown email, wrong code, expired,
// attempt-cap exhausted) so the endpoint can't be used to probe accounts.
const INVALID_MESSAGE = "Invalid or expired verification code.";

const SUCCESS_MESSAGE =
	"Your new password has been emailed to you. Check your inbox and spam folder.";

type ResetBody = {
	email?: unknown;
	otp?: unknown;
};

export async function POST(request: Request) {
	let body: ResetBody;
	try {
		body = (await request.json()) as ResetBody;
	} catch {
		return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
	}

	if (
		typeof body.email !== "string" ||
		typeof body.otp !== "string" ||
		!body.email.trim() ||
		!body.otp.trim()
	) {
		return NextResponse.json(
			{ error: "Email and verification code are required" },
			{ status: 400 },
		);
	}

	const email = body.email.trim().toLowerCase();
	const code = body.otp.trim();

	const user = await prisma.user.findUnique({
		where: { email },
		select: {
			id: true,
			status: true,
			passwordHash: true,
			resetOtpHash: true,
			resetOtpExpiresAt: true,
			resetOtpAttempts: true,
		},
	});

	if (!user || user.status !== "ACTIVE") {
		return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 });
	}

	const now = new Date();
	const result = verifyOtp(
		{
			hash: user.resetOtpHash,
			expiresAt: user.resetOtpExpiresAt,
			attempts: user.resetOtpAttempts,
		},
		code,
		now,
	);

	if (result !== "ok") {
		// Count failed guesses (including ones made after expiry) against the cap.
		if (result !== "missing" && result !== "maxed") {
			await prisma.user.update({
				where: { id: user.id },
				data: { resetOtpAttempts: { increment: 1 } },
			});
		}
		return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 });
	}

	const tempPassword = generateTempPassword();
	const newHash = await hash(tempPassword, 12);

	// Swap the hash first; the OTP stays valid until the email is on its way,
	// so a delivery failure can roll back without locking the user out.
	await prisma.user.update({
		where: { id: user.id },
		data: { passwordHash: newHash },
	});

	try {
		await sendTemporaryPassword(email, tempPassword);
	} catch {
		// Restore the old password — the user never received the new one.
		await prisma.user.update({
			where: { id: user.id },
			data: { passwordHash: user.passwordHash },
		});
		return NextResponse.json(
			{ error: "Could not send the email. Please try again later." },
			{ status: 502 },
		);
	}

	// Password delivered — consume the OTP so it cannot be replayed.
	await prisma.user.update({
		where: { id: user.id },
		data: {
			resetOtpHash: null,
			resetOtpExpiresAt: null,
			resetOtpAttempts: 0,
			resetOtpSentAt: null,
			resetOtpSendCount: 0,
		},
	});

	return NextResponse.json({ message: SUCCESS_MESSAGE });
}