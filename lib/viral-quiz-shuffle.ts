/** Same shape as QuizRound in ViralTemplatePreview; server-safe. */
export type ViralQuizRound = {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation?: string;
  emoji?: string;
};

const LABELS = ["A", "B", "C", "D"] as const;

/**
 * Coerce model JSON into a fixed 4-option round. Models often copy `"correctIndex": 0` so every answer is A.
 */
export function normalizeRawQuizRound(raw: unknown): ViralQuizRound {
  const o = raw as Record<string, unknown>;
  const question = typeof o.question === "string" ? o.question : "";
  const explanation = typeof o.explanation === "string" ? o.explanation : undefined;
  const emoji = typeof o.emoji === "string" ? o.emoji : undefined;

  const optionsRaw = o.options;
  const opt: string[] = Array.isArray(optionsRaw)
    ? optionsRaw.slice(0, 4).map((x) => (typeof x === "string" ? x : String(x ?? "")))
    : [];
  while (opt.length < 4) opt.push("");

  let correctIndex = 0;
  if (typeof o.correctIndex === "number" && Number.isFinite(o.correctIndex)) {
    correctIndex = Math.max(0, Math.min(3, Math.floor(o.correctIndex)));
  } else if (typeof o.correctAnswer === "number" && Number.isFinite(o.correctAnswer)) {
    correctIndex = Math.max(0, Math.min(3, Math.floor(o.correctAnswer)));
  } else if (typeof o.correctAnswer === "string") {
    const letter = o.correctAnswer.trim().toUpperCase();
    const idx = LABELS.indexOf(letter as (typeof LABELS)[number]);
    if (idx >= 0) correctIndex = idx;
    else {
      const at = opt.findIndex((t) => t.trim() === o.correctAnswer);
      if (at >= 0) correctIndex = at;
    }
  }

  return {
    question,
    options: [opt[0]!, opt[1]!, opt[2]!, opt[3]!],
    correctIndex,
    explanation,
    emoji,
  };
}

/**
 * Randomly permutes options (Fisher–Yates on index map). Each question gets an independent uniform A–D mix.
 */
export function shuffleQuizRound(question: ViralQuizRound): ViralQuizRound {
  const oldCorrect = Math.max(0, Math.min(3, Math.floor(question.correctIndex)));
  const perm = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = perm[i]!;
    perm[i] = perm[j]!;
    perm[j] = t;
  }
  const newOptions = perm.map((from) => question.options[from]!) as [string, string, string, string];
  const newCorrectIndex = perm.indexOf(oldCorrect);
  return {
    ...question,
    options: newOptions,
    correctIndex: newCorrectIndex,
  };
}
