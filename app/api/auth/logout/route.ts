import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/app/lib/auth";

export async function POST() {
	const response = NextResponse.json({ message: "Logged out" });
	response.cookies.delete(AUTH_COOKIE);
	return response;
}
