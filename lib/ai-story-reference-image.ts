import { buildNameToTypeMap, parseCharacterTypes, resolveSpeakerToType } from "@/lib/ai-story-character-style";

/** First speaking character in the scene → user-defined type key for picking a reference image. */
export function getPrimaryCharacterTypeForScene(
  dialogue: string,
  charactersField: string,
  characterNamesField: string
): string | null {
  const types = parseCharacterTypes(charactersField);
  if (types.length === 0) return null;
  const nameToType = buildNameToTypeMap(characterNamesField, types);
  const firstLine = dialogue.split(/\n/).find((l) => l.trim().length > 0) ?? "";
  const m = firstLine.match(/^([^:]+):/);
  if (!m) return types[0] ?? null;
  const resolved = resolveSpeakerToType(m[1], types, nameToType);
  return resolved ?? types[0] ?? null;
}
