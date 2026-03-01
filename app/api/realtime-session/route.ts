import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** POST: Create an ephemeral OpenAI Realtime API session token for WebRTC. */
export async function POST() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 503 }
      );
    }
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "shimmer",
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error("[realtime-session]", response.status, err);
      return NextResponse.json(
        { error: "Failed to create Realtime session" },
        { status: response.status }
      );
    }
    const data = (await response.json()) as { client_secret?: { value: string; expires_at: number }; [key: string]: unknown };
    return NextResponse.json(data);
  } catch (err) {
    console.error("[realtime-session]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Realtime session failed" },
      { status: 500 }
    );
  }
}
