import { NextResponse } from "next/server";

export async function GET() {
  const hasKey = !!(process.env.CREATOMATE_API_KEY?.trim());
  const template =
    process.env.CREATOMATE_TEMPLATE_DIGITAL_PRODUCT?.trim() ||
    process.env.CREATOMATE_TEMPLATE_PROMO?.trim() ||
    process.env.CREATOMATE_TEMPLATE_DEMO?.trim();

  return NextResponse.json({
    configured: hasKey && !!template,
    hasApiKey: hasKey,
    hasTemplate: !!template,
  });
}
