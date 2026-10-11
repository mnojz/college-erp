import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing-mail helper for the forgot-password flow.
 *
 * Configured entirely via env (see .env / README "Forgot password"):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * When SMTP_HOST is unset the transport is not configured: in development the
 * message is printed to the server console (so the flow is testable without
 * any mail account), in production it fails loudly.
 */

type MailPayload = {
	to: string;
	subject: string;
	text: string;
	html: string;
};

function isProduction(): boolean {
	return process.env.NODE_ENV === "production";
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
	const host = process.env.SMTP_HOST;
	if (!host) return null;
	if (!transporter) {
		const port = Number(process.env.SMTP_PORT ?? 587);
		transporter = nodemailer.createTransport({
			host,
			port,
			// Implicit TLS on the SMTPS port, STARTTLS otherwise (Gmail/Outlook
			// both advertise STARTTLS on 587).
			secure: port === 465,
			auth: process.env.SMTP_USER
				? {
						user: process.env.SMTP_USER,
						pass: process.env.SMTP_PASS ?? "",
					}
				: undefined,
		});
	}
	return transporter;
}

/** Send a message, or fall back to the dev console when SMTP is unset. */
async function sendMail(payload: MailPayload): Promise<void> {
	const transport = getTransporter();

	if (!transport) {
		if (isProduction()) {
			throw new Error("SMTP is not configured (SMTP_HOST is missing)");
		}
		console.info(
			`[mailer] SMTP not configured — dev fallback for ${payload.to}\n` +
				`[mailer] Subject: ${payload.subject}\n${payload.text}`,
		);
		return;
	}

	const from =
		process.env.SMTP_FROM?.trim() ||
		process.env.SMTP_USER ||
		"College ERP <no-reply@localhost>";

	try {
		await transport.sendMail({ from, ...payload });
	} catch (error) {
		console.error("[mailer] failed to send email:", error);
		throw new Error("Email delivery failed");
	}
}

/** Email the 6-digit verification code for the forgot-password flow. */
export async function sendPasswordResetOtp(
	to: string,
	code: string,
): Promise<void> {
	await sendMail({
		to,
		subject: "Your password reset code — College ERP",
		text:
			`Your verification code is: ${code}\n\n` +
			`It expires in 10 minutes. If you did not request a password reset, ` +
			`you can safely ignore this email.\n`,
		html: `
			<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
				<h2 style="margin:0 0 8px;font-size:18px">Password reset</h2>
				<p style="color:#4b5563;margin:0 0 16px">Use this code to reset your College ERP password:</p>
				<p style="font-size:32px;letter-spacing:8px;font-weight:bold;margin:0 0 16px">${code}</p>
				<p style="color:#6b7280;font-size:13px;margin:0">The code expires in 10 minutes. If you did not request this, you can safely ignore this email.</p>
			</div>`.trim(),
	});
}

/** Email the freshly generated 8-character temporary password. */
export async function sendTemporaryPassword(
	to: string,
	tempPassword: string,
): Promise<void> {
	await sendMail({
		to,
		subject: "Your new password — College ERP",
		text:
			`Your password has been reset. Here is your new temporary password:\n\n` +
			`${tempPassword}\n\n` +
			`Sign in with your email and this password, then choose a password of your own.\n`,
		html: `
			<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
				<h2 style="margin:0 0 8px;font-size:18px">Your new password</h2>
				<p style="color:#4b5563;margin:0 0 16px">Your College ERP password has been reset. Use this temporary password to sign in:</p>
				<p style="font-size:24px;letter-spacing:3px;font-weight:bold;margin:0 0 16px">${tempPassword}</p>
				<p style="color:#6b7280;font-size:13px;margin:0">Sign in with your email and this password, then choose a password of your own.</p>
			</div>`.trim(),
	});
}
