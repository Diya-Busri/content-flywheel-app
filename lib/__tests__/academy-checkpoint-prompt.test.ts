import { describe, it, expect } from "vitest";
import {
  extractLessonPlainText,
  parseListField,
  buildCheckpointSystemPrompt,
  trimHistoryForContext,
  extractApplicationOutput,
  stripBasicMarkdown,
  describeHelpUsage,
} from "@/lib/academy-checkpoint-prompt";
import { serializeLessonBlocks, newBlock } from "@/lib/academy-blocks";

describe("extractLessonPlainText", () => {
  it("returns an empty string for missing content", () => {
    expect(extractLessonPlainText(null)).toBe("");
    expect(extractLessonPlainText(undefined)).toBe("");
  });

  it("flattens block content into readable plain text", () => {
    const heading = newBlock("heading");
    heading.content = "What is a niche?";
    const text = newBlock("text");
    text.content = "A niche is a focused segment of a market.";
    const checklist = newBlock("checklist");
    checklist.items = ["Pick a topic", "Validate demand"];
    const content = serializeLessonBlocks([heading, text, checklist]);

    const plain = extractLessonPlainText(content);
    expect(plain).toContain("What is a niche?");
    expect(plain).toContain("A niche is a focused segment of a market.");
    expect(plain).toContain("Pick a topic");
    expect(plain).toContain("Validate demand");
  });

  it("falls back to wrapping legacy plain-text content", () => {
    expect(extractLessonPlainText("Just some legacy text")).toContain("Just some legacy text");
  });
});

describe("parseListField", () => {
  it("returns [] for empty/missing input", () => {
    expect(parseListField(null)).toEqual([]);
    expect(parseListField("")).toEqual([]);
    expect(parseListField("   ")).toEqual([]);
  });

  it("parses a JSON array", () => {
    expect(parseListField(JSON.stringify(["a", "b"]))).toEqual(["a", "b"]);
  });

  it("falls back to newline-separated plain text", () => {
    expect(parseListField("Explain what a niche is\nIdentify 3 niches\n")).toEqual([
      "Explain what a niche is",
      "Identify 3 niches",
    ]);
  });
});

describe("buildCheckpointSystemPrompt", () => {
  const base = {
    courseTitle: "Digital Products 101",
    moduleTitle: "Finding Your Niche",
    lessonTitle: "What is a niche?",
    lessonContent: serializeLessonBlocks([{ ...newBlock("text"), content: "A niche is a focused market segment." }]),
    helpOption: "explain_simpler" as const,
  };

  it("includes the lesson content as the primary source", () => {
    const prompt = buildCheckpointSystemPrompt(base);
    expect(prompt).toContain("What is a niche?");
    expect(prompt).toContain("A niche is a focused market segment.");
    expect(prompt).toContain("LESSON CONTEXT");
  });

  it("never fabricates personalisation — states none is available when none is given", () => {
    const prompt = buildCheckpointSystemPrompt({ ...base, personalizationBlock: "" });
    expect(prompt).toContain("none available");
    expect(prompt).not.toContain("USER CONTEXT");
  });

  it("includes provided personalisation context verbatim when given", () => {
    const prompt = buildCheckpointSystemPrompt({
      ...base,
      helpOption: "example",
      personalizationBlock: "Niche/audience: dog trainers",
    });
    expect(prompt).toContain("dog trainers");
  });

  it("selects distinct instructions per help option", () => {
    const explain = buildCheckpointSystemPrompt({ ...base, helpOption: "explain_simpler" });
    const apply = buildCheckpointSystemPrompt({ ...base, helpOption: "apply" });
    expect(explain).not.toEqual(apply);
    expect(apply).toContain("ONE question at a time");
    expect(apply).toContain("APPLICATION OUTPUT:");
  });

  it("instructs the model to say so instead of fabricating when unsupported", () => {
    const prompt = buildCheckpointSystemPrompt({ ...base, helpOption: "question" });
    expect(prompt.toLowerCase()).toContain("say so");
  });
});

describe("trimHistoryForContext", () => {
  it("keeps everything when under the cap", () => {
    const msgs = [1, 2, 3];
    expect(trimHistoryForContext(msgs, 12)).toEqual(msgs);
  });

  it("keeps the MOST RECENT messages, not the oldest, when trimming", () => {
    const msgs = Array.from({ length: 20 }, (_, i) => i);
    const trimmed = trimHistoryForContext(msgs, 12);
    expect(trimmed.length).toBe(12);
    expect(trimmed[trimmed.length - 1]).toBe(19); // latest message preserved
    expect(trimmed[0]).toBe(8); // oldest kept message is the 9th (0-indexed 8)
  });
});

describe("extractApplicationOutput", () => {
  it("extracts the text after the APPLICATION OUTPUT marker", () => {
    const text = "Here's your plan.\n\nAPPLICATION OUTPUT:\nCompare niche A vs niche B based on demand.";
    expect(extractApplicationOutput(text)).toEqual({ text: "Compare niche A vs niche B based on demand." });
  });

  it("separates out a NEXT STEP pointer when present", () => {
    const text =
      "APPLICATION OUTPUT:\nCompare niche A vs niche B based on demand.\nNEXT STEP:\nOpen Digital Products → Discover to validate demand for each.";
    expect(extractApplicationOutput(text)).toEqual({
      text: "Compare niche A vs niche B based on demand.",
      nextStep: "Open Digital Products → Discover to validate demand for each.",
    });
  });

  it("returns null when no marker is present", () => {
    expect(extractApplicationOutput("Just a regular reply with no output yet.")).toBeNull();
  });
});

describe("stripBasicMarkdown", () => {
  it("strips bold markers but keeps the text", () => {
    expect(stripBasicMarkdown("Set a **Daily Content Creation Goal** today.")).toBe(
      "Set a Daily Content Creation Goal today."
    );
  });

  it("strips headings, backticks, and code fences", () => {
    expect(stripBasicMarkdown("# Heading\nUse `niche` wisely.")).toBe("Heading\nUse niche wisely.");
    expect(stripBasicMarkdown("```\nsome code\n```")).toBe("some code\n");
  });

  it("leaves plain text untouched", () => {
    expect(stripBasicMarkdown("Just a normal beginner-friendly sentence.")).toBe(
      "Just a normal beginner-friendly sentence."
    );
  });

  it("cleans up any stray unmatched ** left behind", () => {
    expect(stripBasicMarkdown("Half-closed **bold")).toBe("Half-closed bold");
  });
});

describe("describeHelpUsage", () => {
  it("describes a single help type in singular form", () => {
    expect(describeHelpUsage({ question: 1, explain_simpler: 0, example: 0, apply: 0 })).toBe("asked 1 question");
  });

  it("describes multiple help types joined naturally", () => {
    expect(describeHelpUsage({ question: 3, explain_simpler: 2, example: 0, apply: 0 })).toBe(
      "asked 3 questions and asked for a simpler explanation 2 times"
    );
  });

  it("falls back to a generic phrase when nothing was used", () => {
    expect(describeHelpUsage({ question: 0, explain_simpler: 0, example: 0, apply: 0 })).toBe("used the Understanding Check");
  });
});
