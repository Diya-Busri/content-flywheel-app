"use server";

export type ProofValidationResult = {
  valid: boolean;
  reason: string;
  confidence: "high" | "medium" | "low";
};

type ValidateProofInput = {
  taskDescription: string;
  proofType: "screenshot" | "text" | "link";
  proofImage?: string | null;
  proofDescription: string;
  proofUrl?: string | null;
};

export async function validateProof(input: ValidateProofInput): Promise<ProofValidationResult> {
  const { taskDescription, proofType, proofDescription, proofImage, proofUrl } = input;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY not configured, defaulting to accept");
    return {
      valid: true,
      reason: "Validation skipped (API not configured)",
      confidence: "low",
    };
  }

  const systemPrompt = `You are validating proof of task completion. The user claims to have completed this task: "${taskDescription}"

They provided: ${proofType}
Their explanation: "${proofDescription}"
${proofUrl ? `Link provided: ${proofUrl}` : ""}

Analyze if this genuinely proves task completion. Be strict but fair.

Reject if:
- Description is generic ("I did it", "finished", "done")
- Screenshot doesn't match task (random image)
- Link is unrelated
- Explanation lacks specifics

Accept if:
- Clear evidence of actual work
- Specific details about what was completed
- Screenshot shows relevant content

Respond with JSON only, no other text:
{
  "valid": true or false,
  "reason": "Brief explanation why accepted/rejected",
  "confidence": "high" or "medium" or "low"
}`;

  const userText =
    proofType === "screenshot" && proofImage
      ? "Here is the user's screenshot. Analyze it along with their written explanation above. Respond with JSON: { \"valid\": true/false, \"reason\": \"...\", \"confidence\": \"high\"|\"medium\"|\"low\" }"
      : "Based on the information above, validate the proof. Respond with JSON: { \"valid\": true/false, \"reason\": \"...\", \"confidence\": \"high\"|\"medium\"|\"low\" }";

  const content: Array<{ type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } }> = [
    { type: "text", text: userText },
  ];

  if (proofImage) {
    let mediaType = "image/png";
    let base64Data = proofImage;
    const dataUrlMatch = proofImage.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mediaType = dataUrlMatch[1] || "image/png";
      base64Data = dataUrlMatch[2];
    }
    content.unshift({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: base64Data,
      },
    });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", response.status, err);
      return { valid: true, reason: "Validation skipped (API error)", confidence: "low" };
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const textBlock = data.content?.find((c) => c.type === "text" && c.text);
    const text = textBlock?.text ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON in Claude response:", text);
      return { valid: true, reason: "Validation skipped (parse error)", confidence: "low" };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      valid?: boolean;
      reason?: string;
      confidence?: string;
    };

    return {
      valid: parsed.valid ?? true,
      reason: parsed.reason ?? "Validation completed",
      confidence:
        parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
          ? parsed.confidence
          : "medium",
    };
  } catch (err) {
    console.error("validateProof error:", err);
    return {
      valid: true,
      reason: "Validation skipped (API unavailable)",
      confidence: "low",
    };
  }
}
