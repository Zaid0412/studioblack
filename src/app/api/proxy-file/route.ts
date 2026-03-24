import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { env } from "@/env";

/**
 * GET /api/proxy-file?url=<encoded-url>
 * Proxies a file from Supabase Storage to avoid CORS issues with client-side PDF viewers.
 * Requires authentication. URL restricted to the project's own Supabase instance.
 */
export const GET = withAuth({}, async (req) => {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 }
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Only allow HTTPS to prevent protocol-based SSRF
  if (parsed.protocol !== "https:") {
    return NextResponse.json(
      { error: "Only HTTPS URLs are allowed" },
      { status: 400 }
    );
  }

  // Restrict to this project's Supabase instance only
  const allowedHost = new URL(env().NEXT_PUBLIC_SUPABASE_URL).hostname;
  if (parsed.hostname !== allowedHost) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

  const res = await fetch(url, { redirect: "error" });
  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch file" },
      { status: res.status }
    );
  }

  const contentLength = Number(res.headers.get("content-length") || 0);
  if (contentLength > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const contentType =
    res.headers.get("content-type") || "application/octet-stream";

  // Stream response with byte counting to prevent OOM
  const upstream = res.body;
  if (!upstream) {
    return NextResponse.json({ error: "Empty response body" }, { status: 502 });
  }

  let totalBytes = 0;
  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_FILE_SIZE) {
        controller.error(new Error("File too large"));
        return;
      }
      controller.enqueue(chunk);
    },
  });

  const stream = upstream.pipeThrough(transform);

  return new NextResponse(stream, {
    headers: {
      "Content-Type": contentType,
      ...(contentLength > 0 && {
        "Content-Length": String(contentLength),
      }),
      "Cache-Control": "public, max-age=3600",
    },
  });
});
