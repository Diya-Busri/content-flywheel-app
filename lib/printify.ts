/**
 * Printify API client helpers
 */

const PRINTIFY_BASE = "https://api.printify.com/v1";

export async function printifyFetch(
  path: string,
  apiKey: string,
  options: RequestInit = {}
) {
  const res = await fetch(`${PRINTIFY_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Printify API error ${res.status}: ${text}`);
  }

  return res.json();
}

export type PrintifyShop = {
  id: number;
  title: string;
  sales_channel: string;
};

export type PrintifyBlueprint = {
  id: number;
  title: string;
  description: string;
  brand: string;
  model: string;
  images: string[];
};

export type PrintifyPrintProvider = {
  id: number;
  title: string;
  location: { country: string; region: string };
};

export type PrintifyVariant = {
  id: number;
  title: string;
  options: Record<string, string>;
  placeholders: Array<{ position: string; images: string[] }>;
};
