import { proxyGet, proxyPost } from "@/app/api/_lib/proxy";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return proxyGet(request, "/api/run-code");
}

export async function POST(request: NextRequest) {
  return proxyPost(request, "/api/run-code");
}
