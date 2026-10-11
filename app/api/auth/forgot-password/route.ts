import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendPasswordResetOtp } from "@/app/lib/mailer";
import {
	canResendOtp,
	generateOtpCode,
	hashOtp,
	OTP_MAX_SENDS_PER_WINDOW,
	OTP_TTL_MS,
	sendsWithinWindow,
} from "@/app/lib/reset-otp";

/**
 * Forgot-password step 1: given an email address, send that mailbox a 6-digit
 * OTP. The response is deliberately identical whether or not the account
 * exists (and whether or not the send was rate-limited) so the endpoint can't
 * be used to enumerate accounts.
 */

// Same generic message for every outcome — never confirm account existence.
const GENERIC_MESSAGE =
	"If an account exists for that email, a 6-digit verification code has been sent. Check your inbox and spam folder.";

type ForgotBody = {
	email?: unknown;
};

export async function POST(request: Request) {
	let body: ForgotBody;
	try {
		body = (await request.json()) as ForgotBody;
	} catch {
		return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
	}

	if (typeof body.email !== "string" || !body.email.trim()) {
		return NextResponse.json({ error: "Email is required" }, { status: 400 });
	}

	const email = body.email.trim().toLowerCase();
	const user = await prisma.user.findUnique({
		where: { email },
		select: {
			id: true,
			status: true,
			resetOtpSentAt: true,
			resetOtpSendCount: true,
		},
	});

	const now = new Date();

	if (user && user.status === "ACTIVE") {
		const withinCooldown = !canResendOtp(user.resetOtpSentAt, now);
		const withinBudget =
			sendsWithinWindow(user.resetOtpSentAt, user.resetOtpSendCount, now) >=
			OTP_MAX_SENDS_PER_WINDOW;

		// Silently skip throttled sends — the response stays generic either way.
		if (!withinCooldown && !withinBudget) {
			const sendsInWindow = sendsWithinWindow(
				user.resetOtpSentAt,
				user.resetOtpSendCount,
				now,
			);
			const code = generateOtpCode();

			await prisma.user.update({
				where: { id: user.id },
				data: {
					resetOtpHash: hashOtp(code),
					resetOtpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
					resetOtpAttempts: 0,
					resetOtpSentAt: now,
					resetOtpSendCount: sendsInWindow + 1,
				},
			});

			try {
				await sendPasswordResetOtp(email, code);
			} catch {
				// The code never reached the mailbox — drop it so it can't linger
				// un-delivered, and report the failure. (Only reachable for existing
				// accounts, i.e. only when the mail transport itself is broken.)
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
				return NextResponse.json(
					{ error: "Could not send the email. Please try again later." },
					{ status: 502 },
				);
			}
		}
	}

	return NextResponse.json({ message: GENERIC_MESSAGE });
}