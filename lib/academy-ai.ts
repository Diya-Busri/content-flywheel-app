import "server-only";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface GeneratedCourse {
  description: string;
  learningOutcomes: string[];
  modules: { title: string; description: string }[];
  difficulty: string;
  estimatedDuration: string;
}

export async function generateCoursePlan(title: string): Promise<GeneratedCourse> {
  const prompt = `You are a course creation assistant for Content Flywheel, a platform for digital product creators.
Given the course title: "${title}"
Generate:
1. A compelling 2-3 sentence course description
2. 4-6 learning outcomes (what students will be able to do after)
3. 4-6 suggested module titles with brief descriptions
4. Suggested difficulty (Beginner/Intermediate/Advanced)
5. Estimated completion time

Return ONLY valid JSON with this exact shape:
{
  "description": "string",
  "learningOutcomes": ["string"],
  "modules": [{ "title": "string", "description": "string" }],
  "difficulty": "Beginner | Intermediate | Advanced",
  "estimatedDuration": "string"
}`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<GeneratedCourse>;
  return {
    description: parsed.description ?? "",
    learningOutcomes: Array.isArray(parsed.learningOutcomes) ? parsed.learningOutcomes : [],
    modules: Array.isArray(parsed.modules) ? parsed.modules : [],
    difficulty: parsed.difficulty ?? "Beginner",
    estimatedDuration: parsed.estimatedDuration ?? "",
  };
}

export interface GeneratedLesson {
  description: string;
  suggestedContent: string;
}

export async function generateLessonPlan(
  lessonTitle: string,
  courseTitle: string
): Promise<GeneratedLesson> {
  const prompt = `You are a lesson writing assistant for Content Flywheel, a platform for digital product creators.
Course: "${courseTitle}"
Lesson title: "${lessonTitle}"

Write:
1. A 1-2 sentence lesson description.
2. Suggested lesson content: a clear, well-structured draft (markdown allowed) the instructor can refine. Aim for 150-300 words with practical, actionable guidance.

Return ONLY valid JSON: { "description": "string", "suggestedContent": "string" }`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<GeneratedLesson>;
  return {
    description: parsed.description ?? "",
    suggestedContent: parsed.suggestedContent ?? "",
  };
}
