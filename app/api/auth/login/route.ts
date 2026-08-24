import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import {
	AUTH_COOKIE,
	createSessionToken,
	sessionCookieOptions,
} from "@/app/lib/auth";

type LoginBody = {
	email?: unknown;
	password?: unknown;
};

export async function POST(request: Request) {
	let body: LoginBody;

	try {
		body = (await request.json()) as LoginBody;
	} catch {
		return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
	}

	if (typeof body.email !== "string" || typeof body.password !== "string") {
		return NextResponse.json(
			{ error: "Email and password are required" },
			{ status: 400 },
		);
	}

	const user = await prisma.user.findUnique({
		where: { email: body.email.trim().toLowerCase() },
		select: {
			id: true,
			role: true,
			status: true,
			passwordHash: true,
			firstName: true,
			lastName: true,
		},
	});

	const validPassword = user
		? await compare(body.password, user.passwordHash)
		: false;

	if (!user || user.status !== "ACTIVE" || !validPassword) {
		return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
	}

	const response = NextResponse.json({
		user: {
			id: user.id,
			firstName: user.firstName,
			lastName: user.lastName,
			role: user.role,
		},
	});

	response.cookies.set(
		AUTH_COOKIE,
		createSessionToken(user.id, user.role),
		sessionCookieOptions,
	);

	return response;
}
