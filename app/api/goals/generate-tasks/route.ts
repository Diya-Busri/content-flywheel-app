import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { generateTasks } from "@/lib/goals/generate-tasks";

const VALID_DAYS = [7, 14, 30, 60, 90];
const TIME_OPTIONS = ["30min", "1hr", "2hr", "3hr", "4hr+"] as const;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { title, description, totalDays, dailyTimeCommitment, daysToGenerate } = body as {
      title?: string;
      description?: string;
      totalDays?: number;
      dailyTimeCommitment?: string;
      daysToGenerate?: number[];
    };

    if (!title || typeof title !== "string" || !totalDays || typeof totalDays !== "number") {
      return NextResponse.json(
        { error: "title and totalDays are required" },
        { status: 400 }
      );
    }
    if (!VALID_DAYS.includes(totalDays)) {
      return NextResponse.json(
        { error: "totalDays must be 7, 14, 30, 60, or 90" },
        { status: 400 }
      );
    }

    const timeCommitment =
      dailyTimeCommitment && TIME_OPTIONS.includes(dailyTimeCommitment as (typeof TIME_OPTIONS)[number])
        ? dailyTimeCommitment
        : "1hr";

    const tasks = await generateTasks({
      title,
      description,
      totalDays,
      dailyTimeCommitment: timeCommitment,
      daysToGenerate: Array.isArray(daysToGenerate) ? daysToGenerate : undefined,
    });

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("Goals generate-tasks error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate tasks" },
      { status: 500 }
    );
  }
}
