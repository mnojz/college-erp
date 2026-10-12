import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

/**
 * Canonical "who am I + my photo" endpoint. Role-agnostic: used by the shell's
 * identity provider so EVERY page gets the navbar avatar/name/subtitle even
 * when the page itself doesn't fetch a role profile (the server-component
 * wrappers like /student/academics or /teacher/resources that render a shell
 * without identity props). Display fields are derived here, role-aware, so the
 * provider has a single source of truth.
 */
export async function GET() {
	const session = await getSession();

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const user = await prisma.user.findUnique({
		where: { id: session.userId },
		select: {
			id: true,
			email: true,
			firstName: true,
			lastName: true,
			role: true,
			status: true,
			// Avatars live on the role profile, not on User.
			student: {
				select: {
					profileImageUrl: true,
					rollNumber: true,
					enrollmentNumber: true,
				},
			},
			teacher: {
				select: {
					profileImageUrl: true,
					employeeNo: true,
				},
			},
		},
	});

	if (!user || user.status !== "ACTIVE") {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Derive the shell display fields once, role-aware.
	const profileImageUrl = user.student?.profileImageUrl ?? user.teacher?.profileImageUrl ?? null;
	const displayName = `${user.firstName} ${user.lastName}`.trim();

	let subtitle = "Sign out";
	if (user.role === "STUDENT") {
		const sid = user.student?.rollNumber ?? user.student?.enrollmentNumber;
		if (sid != null) subtitle = `ID: ${sid}`;
	} else if (user.role === "TEACHER" && user.teacher?.employeeNo) {
		subtitle = `Emp ID: ${user.teacher.employeeNo}`;
	}

	return NextResponse.json({
		user: {
			id: user.id,
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			role: user.role,
			status: user.status,
			// Shell identity extras.
			profileImageUrl,
			displayName,
			subtitle,
		},
	});
}
