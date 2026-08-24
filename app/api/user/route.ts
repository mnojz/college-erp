import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";

const roles = ["ADMIN", "TEACHER", "STUDENT"] as const;
type CreateUserBody = {
	email?: unknown;
	password?: unknown;
	firstName?: unknown;
	lastName?: unknown;
	role?: unknown;
};

export async function POST(request: Request) {
	if (!(await requireAdmin())) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	let body: CreateUserBody;

	try {
		body = (await request.json()) as CreateUserBody;
	} catch {
		return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
	}

	const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
	const password = typeof body.password === "string" ? body.password : "";
	const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
	const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
	const role = typeof body.role === "string" ? body.role : "";

	if (!email || !password || !firstName || !lastName || !roles.includes(role as (typeof roles)[number])) {
		return NextResponse.json(
			{ error: "Email, password, name, and a valid role are required" },
			{ status: 400 },
		);
	}

	if (password.length < 8) {
		return NextResponse.json(
			{ error: "Password must be at least 8 characters" },
			{ status: 400 },
		);
	}

	try {
		const user = await prisma.user.create({
			data: {
				email,
				passwordHash: await hash(password, 12),
				firstName,
				lastName,
				role: role as (typeof roles)[number],
			},
			select: {
				id: true,
				email: true,
				firstName: true,
				lastName: true,
				role: true,
				status: true,
			},
		});

		return NextResponse.json({ user }, { status: 201 });
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
			return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
		}

		return NextResponse.json({ error: "Unable to create user" }, { status: 500 });
	}
}
