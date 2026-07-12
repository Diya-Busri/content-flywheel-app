/**
 * Motion Graphics Studio — Reddit Reaction Composition
 *
 * A dedicated 5-scene Remotion template for Reddit Reaction, Creator
 * Complaint Breakdown, and similar faceless content formats.
 *
 * Scene types:
 *   reddit-card     — styled Reddit post card with highlighted text
 *   kinetic-text    — large, punchy animated text
 *   icon-scene      — text with a simple icon/framework diagram
 *   app-demo        — device frame with asset placeholder
 *   outro           — branded CF conclusion
 *
 * Accepts StoryboardScene[] as props — the storyboard can be edited in the
 * Content Projects UI before rendering. All layout uses percentage-based
 * positioning so 9:16, 1:1, and 16:9 all render correctly.
 *
 * IMPORTANT: No AI API calls inside this file. All content must be resolved
 * before rendering (passed in as props). This file is Remotion-only.
 */

import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { RedditReactionCompositionProps, StoryboardScene, StoryboardVisualType } from "@/lib/motion-graphics/types";
import { ASPECT_RATIO_DIMENSIONS } from "@/lib/motion-graphics/types";

// ─── Brand constants ─────────────────────────────────────────────────────────

const CF_FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ─── Scene duration helpers ──────────────────────────────────────────────────

function sceneDurationFrames(scene: StoryboardScene, fps: number): number {
  const durationSeconds = Math.max(scene.endTime - scene.startTime, 2);
  return Math.round(durationSeconds * fps);
}

// ─── Shared elements ─────────────────────────────────────────────────────────

const BrandBadge: React.FC<{ accentColor: string; bgColor: string }> = ({ accentColor, bgColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 18, stiffness: 120 }, from: 0, to: 1 });
  return (
    <div
      style={{
        position: "absolute",
        top: "4%",
        left: "50%",
        transform: `translateX(-50%) scale(${progress})`,
        background: accentColor,
        color: bgColor,
        fontFamily: CF_FONT,
        fontSize: 22,
        fontWeight: 900,
        letterSpacing: "0.05em",
        padding: "6px 18px",
        borderRadius: 100,
        zIndex: 100,
        opacity: progress,
      }}
    >
      CF
    </div>
  );
};

// ─── Scene: reddit-card ──────────────────────────────────────────────────────

const RedditCardScene: React.FC<{
  scene: StoryboardScene;
  accentColor: string;
  bgColor: string;
}> = ({ scene, accentColor, bgColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slideUp = spring({ frame, fps, config: { damping: 22, stiffness: 150 }, from: 0, to: 1 });

  const cardTranslateY = interpolate(slideUp, [0, 1], [60, 0]);
  const cardOpacity = interpolate(slideUp, [0, 0.4], [0, 1]);

  const text = scene.narration || scene.onScreenText;
  const firstSentence = text.split(/[.!?]/)[0]?.trim() || text.slice(0, 120);

  return (
    <AbsoluteFill style={{ background: bgColor, justifyContent: "center", alignItems: "center" }}>
      {/* Subtle grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Reddit card */}
      <div
        style={{
          position: "absolute",
          left: "5%",
          width: "90%",
          top: "22%",
          transform: `translateY(${cardTranslateY}px)`,
          opacity: cardOpacity,
        }}
      >
        {/* Card header */}
        <div
          style={{
            background: "rgba(255,69,0,0.12)",
            border: "1.5px solid rgba(255,69,0,0.35)",
            borderRadius: "16px 16px 0 0",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* Avatar circle */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(255,69,0,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 900,
              color: "#ff4500",
              fontFamily: CF_FONT,
              flexShrink: 0,
            }}
          >
            {scene.anonymiseAuthor || !scene.redditAuthor
              ? "?"
              : scene.redditAuthor.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: CF_FONT, fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
              Community Post
            </div>
            {/* Only show author when one was supplied and not anonymised */}
            {scene.redditAuthor && !scene.anonymiseAuthor ? (
              <div style={{ fontFamily: CF_FONT, fontSize: 16, color: "rgba(255,255,255,0.5)" }}>
                u/{scene.redditAuthor}
              </div>
            ) : scene.redditAuthor && scene.anonymiseAuthor ? (
              <div style={{ fontFamily: CF_FONT, fontSize: 16, color: "rgba(255,255,255,0.5)" }}>
                u/[hidden]
              </div>
            ) : null}
          </div>
        </div>

        {/* Card body */}
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1.5px solid rgba(255,255,255,0.1)",
            borderTop: "none",
            borderRadius: "0 0 16px 16px",
            padding: "20px 18px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: CF_FONT,
              fontSize: 30,
              fontWeight: 600,
              color: "rgba(255,255,255,0.92)",
              lineHeight: 1.45,
            }}
          >
            {firstSentence}
          </p>

          {/* Highlight stripe */}
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              background: `${accentColor}22`,
              borderLeft: `4px solid ${accentColor}`,
              borderRadius: 8,
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: CF_FONT,
                fontSize: 24,
                fontWeight: 700,
                color: accentColor,
                lineHeight: 1.4,
              }}
            >
              {scene.onScreenText || firstSentence}
            </p>
          </div>
        </div>
      </div>

      {/* Captions */}
      <SceneCaptions scene={scene} accentColor={accentColor} />
    </AbsoluteFill>
  );
};

// ─── Scene: kinetic-text ─────────────────────────────────────────────────────

const KineticTextScene: React.FC<{
  scene: StoryboardScene;
  accentColor: string;
  bgColor: string;
}> = ({ scene, accentColor, bgColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 20, stiffness: 180 }, from: 0, to: 1 });

  const scale = interpolate(progress, [0, 1], [0.88, 1]);
  const opacity = interpolate(progress, [0, 0.35], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [30, 0]);

  const words = (scene.onScreenText || scene.narration.slice(0, 60)).split(" ");
  const emphasised = new Set(scene.emphasisWords || []);

  return (
    <AbsoluteFill style={{ background: bgColor, justifyContent: "center", alignItems: "center" }}>
      {/* Animated accent blob */}
      <div
        style={{
          position: "absolute",
          width: "70%",
          height: "70%",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}15 0%, transparent 70%)`,
          left: "15%",
          top: "15%",
          transform: `scale(${0.85 + progress * 0.15})`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: "6%",
          width: "88%",
          top: "30%",
          transform: `scale(${scale}) translateY(${translateY}px)`,
          opacity,
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: CF_FONT,
            fontSize: 72,
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                color: emphasised.has(w) ? accentColor : "#ffffff",
                display: "inline",
              }}
            >
              {w}
              {i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </p>
      </div>

      <SceneCaptions scene={scene} accentColor={accentColor} />
    </AbsoluteFill>
  );
};

// ─── Scene: icon-scene ───────────────────────────────────────────────────────

const IconScene: React.FC<{
  scene: StoryboardScene;
  accentColor: string;
  bgColor: string;
}> = ({ scene, accentColor, bgColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Parse framework from onScreenText — supports "A → B → C" style
  const parts = scene.onScreenText.includes("→")
    ? scene.onScreenText.split("→").map((s) => s.trim())
    : scene.onScreenText.split(/\s*[|•\/]\s*/).map((s) => s.trim()).filter(Boolean);

  const labels = parts.length >= 2 ? parts : [scene.onScreenText, scene.narration.slice(0, 30)];

  return (
    <AbsoluteFill style={{ background: bgColor, justifyContent: "center", alignItems: "center" }}>
      {/* Heading */}
      <div
        style={{
          position: "absolute",
          top: "18%",
          left: "8%",
          width: "84%",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: CF_FONT,
            fontSize: 40,
            fontWeight: 800,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: "-0.01em",
          }}
        >
          {scene.narration.split(".")[0] || scene.onScreenText}
        </p>
      </div>

      {/* Framework pills */}
      <div
        style={{
          position: "absolute",
          top: "38%",
          left: "5%",
          width: "90%",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          alignItems: "center",
        }}
      >
        {labels.map((label, i) => {
          const progress = spring({
            frame: Math.max(0, frame - i * 8),
            fps,
            config: { damping: 18, stiffness: 140 },
            from: 0,
            to: 1,
          });
          const translateX = interpolate(progress, [0, 1], [-40, 0]);
          const opacity = interpolate(progress, [0, 0.4], [0, 1]);

          return (
            <div
              key={i}
              style={{
                transform: `translateX(${translateX}px)`,
                opacity,
                display: "flex",
                alignItems: "center",
                gap: 14,
                width: "80%",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: i === labels.length - 1 ? accentColor : "rgba(255,255,255,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: CF_FONT,
                  fontSize: 20,
                  fontWeight: 900,
                  color: i === labels.length - 1 ? "#000" : "#fff",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <div
                style={{
                  background:
                    i === labels.length - 1
                      ? `${accentColor}22`
                      : "rgba(255,255,255,0.07)",
                  border: `1.5px solid ${i === labels.length - 1 ? accentColor : "rgba(255,255,255,0.12)"}`,
                  borderRadius: 12,
                  padding: "12px 18px",
                  flex: 1,
                  fontFamily: CF_FONT,
                  fontSize: 28,
                  fontWeight: 700,
                  color: i === labels.length - 1 ? accentColor : "#fff",
                }}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>

      <SceneCaptions scene={scene} accentColor={accentColor} />
    </AbsoluteFill>
  );
};

// ─── Scene: app-demo ─────────────────────────────────────────────────────────

const AppDemoScene: React.FC<{
  scene: StoryboardScene;
  accentColor: string;
  bgColor: string;
}> = ({ scene, accentColor, bgColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 20, stiffness: 120 }, from: 0, to: 1 });

  const scale = interpolate(progress, [0, 1], [0.9, 1]);
  const opacity = interpolate(progress, [0, 0.3], [0, 1]);

  const hasAsset = !!scene.assetUrl;

  return (
    <AbsoluteFill style={{ background: bgColor, justifyContent: "center", alignItems: "center" }}>
      {/* Device frame */}
      <div
        style={{
          position: "absolute",
          left: "10%",
          width: "80%",
          top: "12%",
          height: "68%",
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        {/* Phone bezel */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 28,
            border: `3px solid rgba(255,255,255,0.2)`,
            background: "rgba(255,255,255,0.04)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {hasAsset ? (
            scene.assetUrl!.match(/\.(mp4|webm|mov)$/i) ? (
              <OffthreadVideo
                src={scene.assetUrl!}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <Img
                src={scene.assetUrl!}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )
          ) : (
            /* Placeholder */
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  border: `3px dashed ${accentColor}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 24, color: accentColor }}>▶</span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontFamily: CF_FONT,
                  fontSize: 22,
                  fontWeight: 700,
                  color: accentColor,
                  textAlign: "center",
                  padding: "0 20px",
                }}
              >
                {scene.assetSuggestions[0] || "Add screen recording here"}
              </p>
              <p
                style={{
                  margin: 0,
                  fontFamily: CF_FONT,
                  fontSize: 16,
                  color: "rgba(255,255,255,0.4)",
                  textAlign: "center",
                  padding: "0 30px",
                }}
              >
                Upload asset in the storyboard editor
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Label below */}
      <div
        style={{
          position: "absolute",
          bottom: "8%",
          left: "5%",
          width: "90%",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: CF_FONT,
            fontSize: 30,
            fontWeight: 800,
            color: "#fff",
            opacity: 0.9,
          }}
        >
          {scene.onScreenText}
        </p>
      </div>

      <SceneCaptions scene={scene} accentColor={accentColor} />
    </AbsoluteFill>
  );
};

// ─── Scene: outro ────────────────────────────────────────────────────────────

const OutroScene: React.FC<{
  scene: StoryboardScene;
  accentColor: string;
  bgColor: string;
  projectName: string;
}> = ({ scene, accentColor, bgColor, projectName }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 16, stiffness: 100 }, from: 0, to: 1 });

  const scale = interpolate(progress, [0, 1], [0.8, 1]);
  const opacity = interpolate(progress, [0, 0.4], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${bgColor} 0%, #1a0a00 55%, ${accentColor}33 100%)`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* CF brand mark */}
      <div
        style={{
          position: "absolute",
          transform: `scale(${scale})`,
          opacity,
          textAlign: "center",
          width: "80%",
          left: "10%",
          top: "28%",
        }}
      >
        <div
          style={{
            fontFamily: CF_FONT,
            fontSize: 52,
            fontWeight: 900,
            color: accentColor,
            letterSpacing: "-0.03em",
            marginBottom: 12,
          }}
        >
          Content Flywheel
        </div>
        <p
          style={{
            margin: "0 0 30px",
            fontFamily: CF_FONT,
            fontSize: 26,
            fontWeight: 400,
            color: "rgba(255,255,255,0.8)",
            lineHeight: 1.45,
          }}
        >
          {scene.onScreenText || "Build and sell digital products with AI"}
        </p>
        <div
          style={{
            display: "inline-block",
            background: accentColor,
            color: "#000",
            fontFamily: CF_FONT,
            fontSize: 26,
            fontWeight: 900,
            padding: "14px 32px",
            borderRadius: 100,
          }}
        >
          {scene.narration.split(".")[0] || "Start free today"}
        </div>
      </div>

      <SceneCaptions scene={scene} accentColor={accentColor} />
    </AbsoluteFill>
  );
};

// ─── Scene: quote-card ───────────────────────────────────────────────────────

const QuoteCardScene: React.FC<{
  scene: StoryboardScene;
  accentColor: string;
  bgColor: string;
}> = ({ scene, accentColor, bgColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 18, stiffness: 130 }, from: 0, to: 1 });
  const opacity = interpolate(progress, [0, 0.4], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [40, 0]);

  return (
    <AbsoluteFill style={{ background: bgColor, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          left: "8%",
          width: "84%",
          top: "28%",
          transform: `translateY(${translateY}px)`,
          opacity,
        }}
      >
        <div
          style={{
            fontSize: 80,
            color: accentColor,
            fontFamily: CF_FONT,
            lineHeight: 0.8,
            marginBottom: 8,
          }}
        >
          &ldquo;
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: CF_FONT,
            fontSize: 40,
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.4,
            borderLeft: `4px solid ${accentColor}`,
            paddingLeft: 20,
          }}
        >
          {scene.onScreenText || scene.narration.slice(0, 100)}
        </p>
      </div>

      <SceneCaptions scene={scene} accentColor={accentColor} />
    </AbsoluteFill>
  );
};

// ─── Captions overlay ────────────────────────────────────────────────────────

const SceneCaptions: React.FC<{ scene: StoryboardScene; accentColor: string }> = ({
  scene,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const text = scene.narration?.trim();
  if (!text) return null;

  const words = text.split(/\s+/);
  const framesPerWord = Math.max(fps * 0.4, 1);
  const activeIdx = Math.min(Math.floor(frame / framesPerWord), words.length - 1);
  const windowSize = 6;
  const windowStart = Math.max(0, activeIdx - Math.floor(windowSize / 2));
  const windowWords = words.slice(windowStart, windowStart + windowSize);
  const emphasised = new Set(scene.emphasisWords || []);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        padding: "0 32px 90px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0 8px",
          justifyContent: "center",
          maxWidth: "92%",
          padding: "14px 20px",
          borderRadius: 18,
          background: "rgba(0,0,0,0.75)",
        }}
      >
        {windowWords.map((w, i) => {
          const globalIdx = windowStart + i;
          const active = globalIdx === activeIdx;
          const emph = emphasised.has(w);
          return (
            <span
              key={globalIdx}
              style={{
                fontFamily: CF_FONT,
                fontSize: 28,
                fontWeight: 800,
                color: active || emph ? accentColor : "#ffffff",
                transform: active ? "scale(1.1)" : "scale(1)",
                display: "inline-block",
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ─── Generic fallback scene ──────────────────────────────────────────────────

const GenericScene: React.FC<{
  scene: StoryboardScene;
  accentColor: string;
  bgColor: string;
}> = ({ scene, accentColor, bgColor }) => (
  <KineticTextScene scene={scene} accentColor={accentColor} bgColor={bgColor} />
);

// ─── Scene router ────────────────────────────────────────────────────────────

function renderSceneByType(
  scene: StoryboardScene,
  accentColor: string,
  bgColor: string,
  projectName: string
): React.ReactNode {
  switch (scene.visualType as StoryboardVisualType) {
    case "reddit-card":
      return <RedditCardScene scene={scene} accentColor={accentColor} bgColor={bgColor} />;
    case "kinetic-text":
      return <KineticTextScene scene={scene} accentColor={accentColor} bgColor={bgColor} />;
    case "icon-scene":
    case "diagram":
      return <IconScene scene={scene} accentColor={accentColor} bgColor={bgColor} />;
    case "app-demo":
    case "screen-recording":
    case "b-roll-placeholder":
      return <AppDemoScene scene={scene} accentColor={accentColor} bgColor={bgColor} />;
    case "quote-card":
      return <QuoteCardScene scene={scene} accentColor={accentColor} bgColor={bgColor} />;
    case "outro":
      return (
        <OutroScene
          scene={scene}
          accentColor={accentColor}
          bgColor={bgColor}
          projectName={projectName}
        />
      );
    default:
      return <GenericScene scene={scene} accentColor={accentColor} bgColor={bgColor} />;
  }
}

// ─── Root composition ────────────────────────────────────────────────────────

export const RedditReactionComposition: React.FC<RedditReactionCompositionProps> = ({
  scenes,
  aspectRatio,
  brandAccent,
  brandBg,
  projectName,
}) => {
  const { fps } = useVideoConfig();
  const accent = brandAccent || "#F89520";
  const bg = brandBg || "#0d0d0d";

  let cursor = 0;
  const timeline = (scenes || []).map((scene) => {
    const durationInFrames = sceneDurationFrames(scene, fps);
    const from = cursor;
    cursor += durationInFrames;
    return { scene, from, durationInFrames };
  });

  if (timeline.length === 0) {
    return (
      <AbsoluteFill
        style={{
          background: bg,
          justifyContent: "center",
          alignItems: "center",
          fontFamily: CF_FONT,
          fontSize: 36,
          color: "rgba(255,255,255,0.5)",
        }}
      >
        No scenes yet
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ background: bg }}>
      {timeline.map(({ scene, from, durationInFrames }) => (
        <Sequence key={scene.id} from={from} durationInFrames={durationInFrames}>
          <AbsoluteFill>
            {renderSceneByType(scene, accent, bg, projectName)}
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/**
 * Untyped adapter for Remotion <Composition component={...} /> and <Player />.
 * Keeps the main component strictly typed while satisfying Remotion's
 * Record<string, unknown> generic constraint at the API boundary.
 */
export const RedditReactionCompositionUntyped: React.FC<Record<string, unknown>> = (props) => (
  <RedditReactionComposition {...(props as unknown as RedditReactionCompositionProps)} />
);

/** Calculates total duration + dimensions from the scene list. */
export function calculateRedditReactionMetadata(props: RedditReactionCompositionProps, fps = 30) {
  const totalFrames = Math.max(
    (props.scenes || []).reduce((sum, s) => sum + sceneDurationFrames(s, fps), 0),
    30
  );
  const dims = ASPECT_RATIO_DIMENSIONS[props.aspectRatio] ?? ASPECT_RATIO_DIMENSIONS["9:16"];
  return { durationInFrames: totalFrames, ...dims };
}
