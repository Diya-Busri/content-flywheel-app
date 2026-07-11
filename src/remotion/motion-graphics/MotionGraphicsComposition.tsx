/**
 * Motion Graphics Studio — Root Composition
 *
 * Renders a Template (lib/motion-graphics/types.ts) as a Remotion video:
 * one <Sequence> per scene, each scene rendering its background (+ optional
 * camera movement + animated-background variant), its positioned elements
 * (text/image/video/icon, each optionally wrapped/rendered via an animation
 * from the Animation Library registry), voiceover/captions, and music/SFX.
 *
 * Used in two places:
 *   1. Live preview — mounted directly inside an in-browser <Player>
 *      (components/motion-graphics-studio/PreviewPlayer.tsx), no server
 *      round-trip needed.
 *   2. Final render — bundled + rendered server-side by
 *      lib/motion-graphics/render-pipeline.ts via @remotion/renderer,
 *      selected by composition id "MotionGraphicsStudio" (registered in
 *      ShowcaseVideo.tsx alongside the existing CF Video Engine composition).
 */

import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as LucideIcons from "lucide-react";
import type {
  AspectRatio,
  CameraMovement,
  Scene,
  SceneElement,
} from "@/lib/motion-graphics/types";
import { ASPECT_RATIO_DIMENSIONS } from "@/lib/motion-graphics/types";
import {
  ANIMATION_REGISTRY,
  MOTION_FONT,
  CameraZoom,
  Pan,
} from "./animations";

// ─── Props ──────────────────────────────────────────────────────────────────

export interface MotionGraphicsCompositionProps {
  templateName: string;
  aspectRatio: AspectRatio;
  scenes: Scene[];
}

export const DEFAULT_MOTION_GRAPHICS_PROPS: MotionGraphicsCompositionProps = {
  templateName: "",
  aspectRatio: "9:16",
  scenes: [],
};

/** Used by <Composition calculateMetadata> and by the standalone <Player> preview. */
export function calculateMotionGraphicsMetadata(props: MotionGraphicsCompositionProps) {
  const totalFrames = Math.max(
    props.scenes.reduce((sum, s) => sum + (s.durationInFrames || 0), 0),
    30
  );
  const { width, height } = ASPECT_RATIO_DIMENSIONS[props.aspectRatio] ?? ASPECT_RATIO_DIMENSIONS["9:16"];
  return { durationInFrames: totalFrames, width, height };
}

// ─── Background layer ───────────────────────────────────────────────────────

const CameraWrapper: React.FC<{ movement: CameraMovement; durationInFrames: number; children: React.ReactNode }> = ({
  movement,
  durationInFrames,
  children,
}) => {
  switch (movement) {
    case "zoomIn":
      return (
        <CameraZoom durationInFrames={durationInFrames} fromScale={1} toScale={1.15}>
          {children}
        </CameraZoom>
      );
    case "zoomOut":
      return (
        <CameraZoom durationInFrames={durationInFrames} fromScale={1.15} toScale={1}>
          {children}
        </CameraZoom>
      );
    case "panLeft":
      return (
        <Pan durationInFrames={durationInFrames} direction="left">
          {children}
        </Pan>
      );
    case "panRight":
      return (
        <Pan durationInFrames={durationInFrames} direction="right">
          {children}
        </Pan>
      );
    case "panUp":
      return (
        <Pan durationInFrames={durationInFrames} direction="up">
          {children}
        </Pan>
      );
    case "panDown":
      return (
        <Pan durationInFrames={durationInFrames} direction="down">
          {children}
        </Pan>
      );
    default:
      return <>{children}</>;
  }
};

const SceneBackgroundLayer: React.FC<{ scene: Scene }> = ({ scene }) => {
  const { background } = scene;
  const cover: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };

  let content: React.ReactNode;
  if (background.type === "color") {
    content = <div style={{ ...cover, background: background.value }} />;
  } else if (background.type === "gradient") {
    content = <div style={{ ...cover, background: background.value }} />;
  } else if (background.type === "image") {
    content = <Img src={background.value} style={cover} />;
  } else if (background.type === "video") {
    content = <OffthreadVideo src={background.value} style={cover} />;
  } else {
    // animated — value is an AnimatedBackground variant key
    const AnimatedBg = ANIMATION_REGISTRY.animatedBackground.Component;
    content = <AnimatedBg variant={background.value || "gradientShift"} />;
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <CameraWrapper movement={scene.cameraMovement} durationInFrames={scene.durationInFrames}>
        {content}
      </CameraWrapper>
    </AbsoluteFill>
  );
};

// ─── Element rendering ──────────────────────────────────────────────────────

function renderBaseContent(element: SceneElement): React.ReactNode {
  const textStyle: React.CSSProperties = {
    margin: 0,
    fontFamily: element.fontFamily || MOTION_FONT,
    fontSize: element.fontSize || 42,
    fontWeight: element.fontWeight || 700,
    color: element.color || "#ffffff",
    textAlign: element.textAlign || "center",
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent:
      element.textAlign === "left" ? "flex-start" : element.textAlign === "right" ? "flex-end" : "center",
  };

  switch (element.type) {
    case "text":
      return <p style={textStyle}>{element.content}</p>;
    case "image":
      return <Img src={element.content} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />;
    case "video":
      return <OffthreadVideo src={element.content} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />;
    case "icon": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const IconComp = ((LucideIcons as any)[element.content] || LucideIcons.HelpCircle) as React.FC<{ size?: number; color?: string }>;
      return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconComp size={Math.min(element.width, element.height) * 4 || 64} color={element.color || "#ffffff"} />
        </div>
      );
    }
    default:
      return null;
  }
}

const SceneElementView: React.FC<{ element: SceneElement }> = ({ element }) => {
  const { animationIn } = element;
  const registryEntry = animationIn ? ANIMATION_REGISTRY[animationIn.animationId] : undefined;

  let inner: React.ReactNode;

  if (registryEntry && registryEntry.kind === "textContent" && element.type === "text") {
    // Delegate entirely to the text-effect component — it renders its own <p>.
    const TextEffect = registryEntry.Component;
    inner = (
      <TextEffect
        text={element.content}
        startFrame={animationIn!.delayFrames}
        durationInFrames={animationIn!.durationInFrames}
        style={{ color: element.color, fontFamily: element.fontFamily, textAlign: element.textAlign }}
        {...(animationIn!.config || {})}
      />
    );
  } else if (registryEntry && registryEntry.kind === "composite") {
    const Composite = registryEntry.Component;
    let config: Record<string, unknown> = {};
    try {
      config = element.content ? JSON.parse(element.content) : {};
    } catch {
      config = {};
    }
    inner = (
      <Composite
        startFrame={animationIn!.delayFrames}
        durationInFrames={animationIn!.durationInFrames}
        {...(registryEntry.defaultConfig || {})}
        {...config}
        {...(animationIn!.config || {})}
      />
    );
  } else if (registryEntry && registryEntry.kind === "particle") {
    const Particle = registryEntry.Component;
    inner = (
      <>
        {renderBaseContent(element)}
        <Particle
          startFrame={animationIn!.delayFrames}
          durationInFrames={animationIn!.durationInFrames}
          {...(animationIn!.config || {})}
        />
      </>
    );
  } else if (registryEntry && registryEntry.kind === "wrapper") {
    const Wrapper = registryEntry.Component;
    inner = (
      <Wrapper
        startFrame={animationIn!.delayFrames}
        durationInFrames={animationIn!.durationInFrames}
        style={{ width: "100%", height: "100%" }}
        {...(animationIn!.config || {})}
      >
        {renderBaseContent(element)}
      </Wrapper>
    );
  } else {
    inner = renderBaseContent(element);
  }

  return (
    <div
      style={{
        position: "absolute",
        left: `${element.x}%`,
        top: `${element.y}%`,
        width: `${element.width}%`,
        height: `${element.height}%`,
        opacity: element.opacity ?? 1,
        zIndex: element.zIndex ?? 0,
        transform: element.rotationDeg ? `rotate(${element.rotationDeg}deg)` : undefined,
      }}
    >
      {inner}
    </div>
  );
};

// ─── Captions ───────────────────────────────────────────────────────────────

function splitToChunks(text: string, maxChars = 40): string[] {
  const words = text.trim().split(/\s+/);
  const chunks: string[] = [];
  let current = "";
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

const SceneCaptions: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const text = scene.voiceover?.text?.trim();
  if (!scene.captions.enabled || !text) return null;

  if (scene.captions.style === "block") {
    const chunks = splitToChunks(text, 42);
    const framesPerChunk = Math.max(fps * 1.6, 1);
    const idx = Math.min(Math.floor(frame / framesPerChunk), chunks.length - 1);
    const chunk = chunks[idx];
    return (
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", padding: "0 48px 120px", pointerEvents: "none" }}>
        <div
          style={{
            maxWidth: "88%",
            padding: "18px 26px",
            borderRadius: 20,
            background: "rgba(0,0,0,0.82)",
            border: `1px solid ${scene.captions.highlightColor || "rgba(255,255,255,0.13)"}`,
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: scene.captions.fontFamily || MOTION_FONT,
              fontSize: 32,
              fontWeight: 800,
              color: scene.captions.color || "#ffffff",
              textAlign: "center",
            }}
          >
            {chunk}
          </p>
        </div>
      </AbsoluteFill>
    );
  }

  // wordByWord / karaoke — highlight the current word within a rolling window
  const words = text.split(/\s+/);
  const framesPerWord = Math.max(fps * 0.42, 1);
  const activeIdx = Math.min(Math.floor(frame / framesPerWord), words.length - 1);
  const windowSize = 7;
  const windowStart = Math.max(0, activeIdx - Math.floor(windowSize / 2));
  const windowWords = words.slice(windowStart, windowStart + windowSize);

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", padding: "0 48px 120px", pointerEvents: "none" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0 10px",
          justifyContent: "center",
          maxWidth: "90%",
          padding: "16px 24px",
          borderRadius: 20,
          background: "rgba(0,0,0,0.7)",
        }}
      >
        {windowWords.map((w, i) => {
          const globalIdx = windowStart + i;
          const active = globalIdx === activeIdx;
          return (
            <span
              key={globalIdx}
              style={{
                fontFamily: scene.captions.fontFamily || MOTION_FONT,
                fontSize: 30,
                fontWeight: 800,
                color: active ? scene.captions.highlightColor || "#F89520" : scene.captions.color || "#ffffff",
                transform: active ? "scale(1.08)" : "scale(1)",
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

// ─── Scene ──────────────────────────────────────────────────────────────────

const SceneView: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const transitionInEntry = ANIMATION_REGISTRY[scene.transitionIn];
  const transitionOutEntry = ANIMATION_REGISTRY[scene.transitionOut];
  const TransitionIn = transitionInEntry?.kind === "wrapper" ? transitionInEntry.Component : ANIMATION_REGISTRY.fadeIn.Component;
  const TransitionOut = transitionOutEntry?.kind === "wrapper" ? transitionOutEntry.Component : ANIMATION_REGISTRY.fadeOut.Component;

  const outStart = scene.durationInFrames - scene.transitionOutDuration;
  const showOut = frame >= outStart;

  const sortedElements = [...scene.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  return (
    <AbsoluteFill style={{ background: "#000000" }}>
      <TransitionIn durationInFrames={scene.transitionInDuration} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
        <SceneBackgroundLayer scene={scene} />
      </TransitionIn>

      {sortedElements.map((el) => (
        <SceneElementView key={el.id} element={el} />
      ))}

      <SceneCaptions scene={scene} />

      {scene.voiceover?.audioAssetUrl && <Audio src={scene.voiceover.audioAssetUrl} />}
      {scene.sound?.musicAssetUrl && <Audio src={scene.sound.musicAssetUrl} volume={scene.sound.musicVolume ?? 0.4} />}
      {scene.sound?.sfxAssetUrl && (
        <Sequence from={scene.sound.sfxAtFrame ?? 0}>
          <Audio src={scene.sound.sfxAssetUrl} />
        </Sequence>
      )}

      {showOut && (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <TransitionOut
            startFrame={outStart}
            durationInFrames={scene.transitionOutDuration}
            style={{ width: "100%", height: "100%" }}
          >
            <AbsoluteFill style={{ background: "#000000" }} />
          </TransitionOut>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ─── Root ───────────────────────────────────────────────────────────────────

export const MotionGraphicsComposition: React.FC<MotionGraphicsCompositionProps> = ({ scenes }) => {
  let cursor = 0;
  const timeline = scenes.map((scene) => {
    const from = cursor;
    cursor += scene.durationInFrames;
    return { scene, from };
  });

  return (
    <AbsoluteFill style={{ background: "#000000" }}>
      {timeline.map(({ scene, from }) => (
        <Sequence key={scene.id} from={from} durationInFrames={scene.durationInFrames}>
          <SceneView scene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/**
 * Adapter with a loose `Record<string, unknown>` prop signature, for use
 * anywhere Remotion needs to infer its generic Props type parameter from the
 * `component` prop without a zod `schema` alongside it (both
 * `<Composition component={...} />` in ShowcaseVideo.tsx and
 * `<Player component={...} />` in PreviewPlayer.tsx). Keeps
 * MotionGraphicsComposition itself strictly typed; this is purely a typing
 * seam at the Remotion API boundary.
 */
export const MotionGraphicsCompositionUntyped: React.FC<Record<string, unknown>> = (props) => (
  <MotionGraphicsComposition {...(props as unknown as MotionGraphicsCompositionProps)} />
);
