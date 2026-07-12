import OpenAI from "openai";

let client: OpenAI | null = null;

/** Lazily-created singleton OpenAI client shared by all Jarvis AI tools. */
export function getOpenAIClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    client = new OpenAI({ apiKey });
  }
  return client;
}
