/**
 * CF Video Engine – Remotion Composition
 *
 * Renders a VideoEngineProject as a vertical 1080×1920 MP4.
 *
 * This file is intentionally self-contained (no @/ imports) so the
 * Remotion webpack bundler can resolve it without alias configuration.
 *
 * Visual layer priority per scene:
 *   1. assetUrl (image) → full-screen <Img> with object-cover + dark overlay
 *   2. assetUrl (video) → full-screen <OffthreadVideo> with object-cover + dark overlay
 *   3. no asset         → animated gradient fallback (keyed to scene type)
 *
 * All scenes also render: on-screen text (centre), voiceover subtitles (bottom),
 * per-scene TTS audio, and fade-in / fade-out at scene boundaries.
 */

import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import React from 'react';

// ─── Types (inlined — no external imports needed) ─────────────────────────────

type SceneType =
  | 'ai_visual'
  | 'app_screenshot'
  | 'product_mockup'
  | 'cta'
  | 'text_slide';

export type EngineSceneData = {
  id: string;
  sceneNumber: number;
  durationSeconds: number;
  sceneType: SceneType;
  onScreenText: string;
  voiceover: string;
  transition?: string;
  /** Absolute URL to an uploaded image or video asset */
  assetUrl?: string;
};

export type VideoEngineCompositionProps = {
  projectTitle: string;
  scenes: EngineSceneData[];
  /** sceneId → absolute audio URL (http://localhost:PORT/...) */
  audioUrls: Record<string, string>;
};

// ─── Design tokens ────────────────────────────────────────────────────────────

/** Fallback gradient backgrounds — used when no assetUrl is provided */
const BACKGROUNDS: Record<SceneType, string> = {
  ai_visual:      'linear-gradient(160deg, #0f0c29 0%, #302b63 55%, #24243e 100%)',
  app_screenshot: 'linear-gradient(160deg, #0d1117 0%, #161b22 55%, #1c2128 100%)',
  product_mockup: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%)',
  cta:            'linear-gradient(160deg, #c05621 0%, #F89520 50%, #f6ad55 100%)',
  text_slide:     'linear-gradient(160deg, #0a0a0a 0%, #111111 100%)',
};

/** Accent colours for type badges and bottom stripe */
const ACCENTS: Record<SceneType, string> = {
  ai_visual:      '#a78bfa',
  app_screenshot: '#60a5fa',
  product_mockup: '#34d399',
  cta:            '#ffffff',
  text_slide:     '#9ca3af',
};

const SCENE_LABELS: Record<SceneType, string> = {
  ai_visual:      'AI Visual',
  app_screenshot: 'App',
  product_mockup: 'Product',
  cta:            'CTA',
  text_slide:     'Text',
};

const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif';

// ─── Asset type detection ─────────────────────────────────────────────────────

function getAssetKind(url: string): 'image' | 'video' | null {
  // Data URIs — check MIME type prefix directly
  if (url.startsWith('data:image/')) return 'image';
  if (url.startsWith('data:video/')) return 'video';

  // Strip query string before checking extension
  const clean = url.split('?')[0].toLowerCase();
  const ext   = clean.split('.').pop() ?? '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext))                         return 'video';
  return null;
}

// ─── Overlay darkness constants ───────────────────────────────────────────────

/**
 * When a real asset is present we need a heavier overlay so text stays legible.
 * When only a gradient is shown we keep it lighter.
 */
const OVERLAY_WITH_ASSET    = 'rgba(0, 0, 0, 0.55)';
const OVERLAY_WITHOUT_ASSET = 'rgba(0, 0, 0, 0.15)';

// ─── Subtitle chunker ─────────────────────────────────────────────────────────

function splitToChunks(text: string, maxChars = 40): string[] {
  const words = text.trim().split(/\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text];
}

// ─── SubtitlePill ─────────────────────────────────────────────────────────────

const SubtitlePill: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chunks = splitToChunks(text, 42);
  const framesPerChunk = Math.max(fps * 1.6, 1);
  const idx   = Math.min(Math.floor(frame / framesPerChunk), chunks.length - 1);
  const chunk = chunks[idx];
  if (!chunk) return null;

  const localFrame = frame % framesPerChunk;
  const popIn = interpolate(localFrame, [0, 6], [0.94, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '0 48px 140px',
      }}
    >
      <div
        style={{
          maxWidth: 880,
          padding: '20px 28px',
          borderRadius: 24,
          background: 'rgba(0,0,0,0.84)',
          border: '1px solid rgba(255,255,255,0.13)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
          transform: `scale(${popIn})`,
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: FONT,
            fontSize: 34,
            lineHeight: 1.3,
            fontWeight: 800,
            color: '#ffffff',
            textAlign: 'center',
            letterSpacing: -0.5,
          }}
        >
          {chunk}
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ─── Visual layer ─────────────────────────────────────────────────────────────
// Renders the background visual + dark overlay for one scene.

const VisualLayer: React.FC<{
  scene: EngineSceneData;
}> = ({ scene }) => {
  const hasAsset  = Boolean(scene.assetUrl);
  const assetKind = scene.assetUrl ? getAssetKind(scene.assetUrl) : null;

  const coverStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center',
  };

  return (
    <>
      {/* Base: gradient (always rendered so there's a colour layer even for CTA) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: BACKGROUNDS[scene.sceneType],
        }}
      />

      {/* Asset layer — image */}
      {hasAsset && assetKind === 'image' && scene.assetUrl && (
        <Img
          src={scene.assetUrl}
          style={coverStyle}
          onError={() => {
            console.error(
              `[VisualLayer] <Img> failed to load — sceneId=${scene.id}`,
              scene.assetUrl?.startsWith('data:') ? 'data-uri' : scene.assetUrl,
            );
          }}
        />
      )}

      {/* Asset layer — video */}
      {hasAsset && assetKind === 'video' && scene.assetUrl && (
        <OffthreadVideo
          src={scene.assetUrl}
          style={coverStyle}
          // Loop the clip — Remotion automatically loops short clips
        />
      )}

      {/* Dark overlay — heavier when a photo/video is shown */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: hasAsset ? OVERLAY_WITH_ASSET : OVERLAY_WITHOUT_ASSET,
        }}
      />
    </>
  );
};

// ─── SceneClip ────────────────────────────────────────────────────────────────

const SceneClip: React.FC<{
  scene: EngineSceneData;
  audioUrl?: string;
  totalFrames: number;
}> = ({ scene, audioUrl, totalFrames }) => {
  const frame  = useCurrentFrame();
  const accent = ACCENTS[scene.sceneType];

  // Per-scene diagnostic log — captured by onBrowserLog in the render pipeline
  if (frame === 0) {
    const assetKind = scene.assetUrl ? getAssetKind(scene.assetUrl) : null;
    const assetDesc = scene.assetUrl
      ? `${assetKind ?? 'unknown'} (${scene.assetUrl.startsWith('data:') ? 'data-uri' : scene.assetUrl.slice(0, 60)})`
      : 'none';
    console.log(
      `[SceneClip] id=${scene.id} type=${scene.sceneType} frames=${totalFrames}`,
      `audio=${audioUrl ? 'yes' : 'no'} asset=${assetDesc}`,
    );
  }

  // Fade in 12 frames, fade out 10 frames
  const fadeIn  = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [totalFrames - 10, totalFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.min(fadeIn, fadeOut);

  const textLen  = scene.onScreenText?.length ?? 0;
  const fontSize = textLen > 80 ? 48 : textLen > 50 ? 58 : textLen > 30 ? 68 : 80;

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* ── Background + asset visual layer ── */}
      <VisualLayer scene={scene} />

      {/* ── Audio ── */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* ── Top-left: scene type badge ── */}
      <div
        style={{
          position: 'absolute',
          top: 72,
          left: 56,
          padding: '10px 22px',
          borderRadius: 100,
          background: 'rgba(0,0,0,0.45)',
          border: `1.5px solid ${accent}70`,
          color: accent,
          fontSize: 20,
          fontFamily: FONT,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: 'uppercase' as const,
        }}
      >
        {SCENE_LABELS[scene.sceneType]}
      </div>

      {/* ── Top-right: scene number ── */}
      <div
        style={{
          position: 'absolute',
          top: 76,
          right: 56,
          color: 'rgba(255,255,255,0.5)',
          fontSize: 24,
          fontFamily: FONT,
          fontWeight: 600,
          letterSpacing: 2,
        }}
      >
        {scene.sceneNumber}
      </div>

      {/* ── Centre: on-screen text ── */}
      {scene.onScreenText ? (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: '0 72px 120px',
          }}
        >
          <p
            style={{
              margin: 0,
              color: '#ffffff',
              fontSize,
              fontFamily: FONT,
              fontWeight: 900,
              textAlign: 'center',
              lineHeight: 1.18,
              textShadow: '0 4px 40px rgba(0,0,0,0.7)',
              letterSpacing: -1.5,
            }}
          >
            {scene.onScreenText}
          </p>
        </AbsoluteFill>
      ) : null}

      {/* ── Bottom: voiceover subtitles ── */}
      {scene.voiceover ? <SubtitlePill text={scene.voiceover} /> : null}

      {/* ── Accent stripe at bottom ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: accent,
          opacity: 0.7,
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Main composition ─────────────────────────────────────────────────────────

export const VideoEngineComposition: React.FC<VideoEngineCompositionProps> = ({
  scenes,
  audioUrls,
}) => {
  const { fps } = useVideoConfig();

  let cursor = 0;
  const timeline = scenes.map((scene) => {
    const from           = cursor;
    const durationInFrames = Math.max(Math.round(scene.durationSeconds * fps), fps);
    cursor += durationInFrames;
    return { scene, from, durationInFrames };
  });

  return (
    <AbsoluteFill style={{ background: '#000000' }}>
      {timeline.map(({ scene, from, durationInFrames }) => (
        <Sequence key={scene.id} from={from} durationInFrames={durationInFrames}>
          <SceneClip
            scene={scene}
            audioUrl={audioUrls[scene.id]}
            totalFrames={durationInFrames}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
