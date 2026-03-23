import { proxyPost } from "@/app/api/_lib/proxy";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return proxyPost(request, "/api/bootstrap");
}
