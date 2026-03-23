import { backendJson } from "@/app/api/_lib/backend";
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ message: "Could not resolve Clerk user" }, { status: 404 });
  }

  const primaryEmail = user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId)?.emailAddress || user.emailAddresses[0]?.emailAddress;
  if (!primaryEmail) {
    return NextResponse.json({ message: "No email found for Clerk user" }, { status: 400 });
  }

  const payload = {
    clerkUserId: user.id,
    email: primaryEmail,
    username: user.username || undefined,
    fullName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.fullName || undefined,
    imageUrl: user.imageUrl || undefined
  };

  try {
    const profile = await backendJson("/api/profile/sync", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not sync profile" }, { status: 500 });
  }
}
