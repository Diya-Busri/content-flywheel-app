/**
 * Seed script: creates the 7 Content Flywheel Academy courses (migrated from Skool).
 * Each course gets one module and one placeholder lesson.
 *
 * Run with:
 *   npx tsx scripts/seed-academy.ts
 *
 * Prerequisites: DATABASE_URL must be set in your .env.local
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  academyCoursesTable,
  academyModulesTable,
  academyLessonsTable,
} from "../db/schema/academy-schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌  DATABASE_URL not set. Add it to .env.local and retry.");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

// ─── Course definitions ────────────────────────────────────────────────────────

const COURSES = [
  {
    title: "Welcome to Content Flywheel Academy",
    description:
      "Start here before watching anything else. Understand the community, the roadmap, and how to get the most out of Content Flywheel Academy.",
    category: "Getting Started",
    difficulty: "beginner",
    estimatedDuration: "15 min",
    orderIndex: 0,
    firstLesson: {
      title: "Welcome to Content Flywheel Academy",
      durationMinutes: 4,
    },
  },
  {
    title: "Mindset & Execution",
    description:
      "Learn why most people never launch and how to take consistent action. Build the habits and routines that lead to real results.",
    category: "Foundations",
    difficulty: "beginner",
    estimatedDuration: "20 min",
    orderIndex: 1,
    firstLesson: {
      title: "Why Most Creators Never Launch (And How to Fix It)",
      durationMinutes: 5,
    },
  },
  {
    title: "Niche Selection",
    description:
      "Choose a niche with real demand and avoid beginner mistakes. Discover how to validate your niche before creating a single product.",
    category: "Foundations",
    difficulty: "beginner",
    estimatedDuration: "25 min",
    orderIndex: 2,
    firstLesson: {
      title: "How to Pick a Niche That Actually Makes Money",
      durationMinutes: 6,
    },
  },
  {
    title: "Digital Products",
    description:
      "Learn what digital products are and how to create your first offer. From templates to guides to mini-courses — start simple and scale.",
    category: "Products",
    difficulty: "beginner",
    estimatedDuration: "30 min",
    orderIndex: 3,
    firstLesson: {
      title: "5 Digital Products You Can Create This Week",
      durationMinutes: 3,
    },
  },
  {
    title: "Marketing & Launch",
    description:
      "Get attention, build trust, and make sales through content. Learn the launch frameworks that work for faceless creators.",
    category: "Marketing",
    difficulty: "intermediate",
    estimatedDuration: "40 min",
    orderIndex: 4,
    firstLesson: {
      title: "The Content Flywheel Launch Formula",
      durationMinutes: 8,
    },
  },
  {
    title: "Content Flywheel Platform",
    description:
      "Learn how to use Content Flywheel to build products and content faster. A full walkthrough of every feature from store to AI coach.",
    category: "Platform",
    difficulty: "beginner",
    estimatedDuration: "35 min",
    orderIndex: 5,
    firstLesson: {
      title: "Platform Overview: Your Complete Walkthrough",
      durationMinutes: 7,
    },
  },
  {
    title: "Platform Demos",
    description:
      "See Content Flywheel in action. Watch real screen recordings of AI video generation, design studio, digital products, and more.",
    category: "Platform",
    difficulty: "beginner",
    estimatedDuration: "20 min",
    orderIndex: 6,
    firstLesson: {
      title: "Demo: AI Video Generation End-to-End",
      durationMinutes: 4,
    },
  },
];

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Seeding Content Flywheel Academy courses...\n");

  for (const c of COURSES) {
    // 1. Insert course
    const courseId = randomUUID();
    await db.insert(academyCoursesTable).values({
      id: courseId,
      title: c.title,
      description: c.description,
      category: c.category,
      difficulty: c.difficulty,
      estimatedDuration: c.estimatedDuration,
      orderIndex: c.orderIndex,
      status: "published",
      isPublished: true,
      slug: c.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    });

    // 2. Insert first module
    const moduleId = randomUUID();
    await db.insert(academyModulesTable).values({
      id: moduleId,
      courseId,
      title: "Module 1",
      orderIndex: 0,
    });

    // 3. Insert placeholder lesson
    const lessonId = randomUUID();
    await db.insert(academyLessonsTable).values({
      id: lessonId,
      courseId,
      moduleId,
      title: c.firstLesson.title,
      lessonType: "video",
      isPublished: true,
      durationMinutes: c.firstLesson.durationMinutes,
      orderIndex: 0,
      // videoUrl: "" ← paste your video URL here after uploading
    });

    console.log(`✅  ${c.title}`);
    console.log(`    └─ Lesson: "${c.firstLesson.title}"`);
  }

  console.log("\n✨ Done! Open /dashboard/academy to see your courses.");
  console.log(
    "   Next: go to Admin → Courses → each course and paste in your video URLs.\n"
  );

  await sql.end();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
