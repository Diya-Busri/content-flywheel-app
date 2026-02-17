/**
 * GET /api/video/status/[id]
 * Polls Shotstack for render status. Returns { status, url?, error? }.
 */
import { NextRequest, NextResponse } from "next/server";

const SHOTSTACK_STAGE = "https://api.shotstack.io/edit/stage";
const SHOTSTACK_PROD = "https://api.shotstack.io/edit/v1";

function getApiKey(): string | null {
  const stage = process.env.SHOTSTACK_API_KEY_SANDBOX?.trim() || process.env.SHOTSTACK_SANDBOX_API_KEY?.trim();
  const prod = process.env.SHOTSTACK_API_KEY?.trim();
  return stage || prod || null;
}

function getBaseUrl(): string {
  return process.env.SHOTSTACK_API_KEY?.trim() && !process.env.SHOTSTACK_API_KEY_SANDBOX?.trim() && !process.env.SHOTSTACK_SANDBOX_API_KEY?.trim()
    ? SHOTSTACK_PROD
    : SHOTSTACK_STAGE;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Render ID required" }, { status: 400 });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { status: "error", error: "Shotstack API key not configured" },
        { status: 503 }
      );
    }

    const base = getBaseUrl();
    const res = await fetch(`${base}/render/${id}`, {
      headers: { "x-api-key": apiKey },
    });

    const body = await res.text();
    let data: {
      success?: boolean;
      response?: { status?: string; url?: string; error?: string };
    };
    try {
      data = JSON.parse(body);
    } catch {
      return NextResponse.json({
        status: "error",
        error: `Invalid response: ${body.slice(0, 200)}`,
      });
    }

    const resp = data.response;
    if (!resp) {
      return NextResponse.json({
        status: "error",
        error: "No response from Shotstack",
      });
    }

    return NextResponse.json({
      status: resp.status || "unknown",
      url: resp.url ?? undefined,
      error: resp.error ?? undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status check failed";
    console.error("[video/status]", err);
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500 }
    );
  }
}
