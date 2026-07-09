/**
 * ElevenLabs voices for Video Creation Guide voiceover.
 * Categories: Male, Female, Character. Used for voice picker and preview.
 */
export type VoiceCategory = "Male" | "Female" | "Character";

export type ElevenLabsVoice = {
  name: string;
  voiceId: string;
  description: string;
  category: VoiceCategory;
};

export const ELEVENLABS_VOICES: ElevenLabsVoice[] = [
  { name: "Rachel", voiceId: "21m00Tcm4TlvDq8ikWAM", description: "Female, calm narration", category: "Female" },
  { name: "Drew", voiceId: "29vD33N1CtxCmqQRPOHJ", description: "Male, confident", category: "Male" },
  { name: "Bella", voiceId: "EXAVITQu4vr4xnSDxMaL", description: "Female, soft friendly", category: "Female" },
  { name: "Antoni", voiceId: "ErXwobaYiN019PkySvjV", description: "Male, warm", category: "Male" },
  { name: "Elli", voiceId: "MF3mGyEYCl7XYWbV9V6O", description: "Female, young energetic", category: "Female" },
  { name: "Josh", voiceId: "TxGEqnHWrfWFTfGW9XjX", description: "Male, deep", category: "Male" },
  { name: "Adam", voiceId: "pNInz6obpgDQGcFmaJgB", description: "Male, professional", category: "Male" },
  { name: "Sam", voiceId: "yoZ06aMxZJJ28mfd3POQ", description: "Male, casual", category: "Male" },
];

const VOICE_PREVIEW_TEXT = "Hey, check this out!";

export { VOICE_PREVIEW_TEXT };

export const VOICEOVER_STORAGE_KEY = "videoCreationGuideVoiceId";

export function getDefaultVoiceId(): string {
  if (typeof window === "undefined") return ELEVENLABS_VOICES[0].voiceId;
  try {
    const saved = localStorage.getItem(VOICEOVER_STORAGE_KEY);
    if (saved && ELEVENLABS_VOICES.some((v) => v.voiceId === saved)) return saved;
  } catch {}
  return ELEVENLABS_VOICES[0].voiceId;
}

export function setDefaultVoiceId(voiceId: string): void {
  try {
    localStorage.setItem(VOICEOVER_STORAGE_KEY, voiceId);
  } catch {}
}
