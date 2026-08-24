import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const fees = await prisma.feeStructure.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      amount: true,
      program: { select: { name: true, code: true } },
      term: { select: { name: true, number: true } },
    },
  });
  return NextResponse.json({ fees });
}
