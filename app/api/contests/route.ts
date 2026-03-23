import { backendFetch } from "@/app/api/_lib/backend";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return backendFetch("/api/contests", { method: "GET" }, request);
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  return backendFetch("/api/contests", {
    method: "POST",
    body: JSON.stringify({ ...body, organiserId: userId })
  });
}
