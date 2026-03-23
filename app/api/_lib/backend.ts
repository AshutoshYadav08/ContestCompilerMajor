import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.CONVEX_HTTP_URL || process.env.NEXT_PUBLIC_CONVEX_HTTP_URL;

export function getBackendUrl(path: string, request?: NextRequest) {
  if (!BACKEND_URL) {
    throw new Error("Missing CONVEX_HTTP_URL or NEXT_PUBLIC_CONVEX_HTTP_URL environment variable");
  }
  const base = BACKEND_URL.endsWith("/") ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
  const url = new URL(`${base}${path}`);
  if (request) {
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  }
  return url;
}

export async function backendFetch(path: string, init?: RequestInit, request?: NextRequest) {
  const response = await fetch(getBackendUrl(path, request), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json"
    }
  });
}

export async function backendJson(path: string, init?: RequestInit) {
  const response = await fetch(getBackendUrl(path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Backend request failed");
  }
  return data;
}
