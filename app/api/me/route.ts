import { backendJson } from "@/app/api/_lib/backend";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await backendJson(`/api/profile?id=${encodeURIComponent(userId)}`);
    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not load profile" }, { status: 404 });
  }
}
