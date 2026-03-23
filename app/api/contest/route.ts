import { proxyGet } from "@/app/api/_lib/proxy";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return proxyGet(request, "/api/contest");
}
