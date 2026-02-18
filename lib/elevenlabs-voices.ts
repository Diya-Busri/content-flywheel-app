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
  { name: "Rachel", voiceId: "21m00Tcm4TlvDq8ikWAM", description: "Calm, narration", category: "Female" },
  { name: "Drew", voiceId: "29vD33N1CtxCmqQRPOHJ", description: "Confident, conversational", category: "Male" },
  { name: "Bella", voiceId: "EXAVITQu4vr4xnSDxMaL", description: "Soft, friendly", category: "Female" },
  { name: "Antoni", voiceId: "ErXwobaYiN019PkySvjV", description: "Warm, storytelling", category: "Male" },
  { name: "Elli", voiceId: "MF3mGyEYCl7XYWbV9V6O", description: "Young, energetic", category: "Female" },
  { name: "Josh", voiceId: "TxGEqnHWrfWFTfGW9XjX", description: "Deep, authoritative", category: "Male" },
  { name: "Arnold", voiceId: "VR6AewLTigWG4xSOukaG", description: "Bold, dramatic", category: "Male" },
  { name: "Domi", voiceId: "AZnzlk1XvdvUeBnXmlld", description: "Strong, confident", category: "Female" },
  { name: "Sam", voiceId: "yoZ06aMxZJJ28mfd3POQ", description: "Casual, relatable", category: "Male" },
  { name: "Adam", voiceId: "pNInz6obpgDQGcFmaJgB", description: "Deep, professional", category: "Male" },
  { name: "Clyde", voiceId: "2EiwWnXFnvU5JabPnv8n", description: "Character, versatile", category: "Character" },
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
