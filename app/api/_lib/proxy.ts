import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.CONVEX_HTTP_URL || process.env.NEXT_PUBLIC_CONVEX_HTTP_URL;

function getTargetUrl(path: string, request?: NextRequest) {
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

export async function proxyGet(request: NextRequest, path: string) {
  try {
    const response = await fetch(getTargetUrl(path, request), {
      method: "GET",
      headers: {
        Accept: "application/json"
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
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Proxy request failed" },
      { status: 500 }
    );
  }
}

export async function proxyPost(request: NextRequest, path: string) {
  try {
    const bodyText = await request.text();
    const response = await fetch(getTargetUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: bodyText
    });

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Proxy request failed" },
      { status: 500 }
    );
  }
}
