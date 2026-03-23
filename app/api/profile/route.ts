import { getBackendUrl } from "@/app/api/_lib/backend";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(getBackendUrl(`/api/profile?id=${encodeURIComponent(userId)}`), {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not load profile" }, { status: 404 });
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  try {
    const response = await fetch(getBackendUrl("/api/profile/update"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        userId,
        username: body?.username,
        fullName: body?.fullName,
        organisation: body?.organisation,
        dob: body?.dob
      }),
      cache: "no-store"
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not update profile" }, { status: 400 });
  }
}
