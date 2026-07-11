"use client";

/**
 * Admin → Motion Graphics Studio → Animation Library
 *
 * Renders all 32 reusable animation components from
 * src/remotion/motion-graphics/animations/index.tsx as live, looping
 * @remotion/player previews, grouped by category. This is a pure browser
 * preview — no server bundling/rendering needed, since @remotion/player
 * runs the composition directly in React.
 */

import React, { useMemo } from "react";
import { Player } from "@remotion/player";
import { AbsoluteFill } from "remotion";
import { Card, CardContent } from "@/components/ui/card";
import {
  ANIMATION_CATEGORIES,
  ANIMATION_REGISTRY,
  animationsByCategory,
  type AnimationRegistryEntry,
} from "@/src/remotion/motion-graphics/animations";

const DEMO_DURATION = 100;
const DEMO_FPS = 30;
const DEMO_WIDTH = 320;
const DEMO_HEIGHT = 180;

const DemoBox: React.FC = () => (
  <div
    style={{
      width: 96,
      height: 96,
      borderRadius: 16,
      background: "linear-gradient(135deg, #F89520, #FDB846)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    }}
  />
);

/** Builds a small, self-contained demo composition for one registry entry. */
function buildDemoComponent(entry: AnimationRegistryEntry): React.FC {
  return function Demo() {
    const common = { startFrame: 6, durationInFrames: 24, ...entry.defaultConfig } as Record<string, unknown>;

    let content: React.ReactNode;
    switch (entry.kind) {
      case "wrapper": {
        const Wrapper = entry.Component;
        content = (
          <Wrapper {...common} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DemoBox />
          </Wrapper>
        );
        break;
      }
      case "textContent": {
        const TextComp = entry.Component;
        content = (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TextComp
              {...common}
              text={entry.id === "numberCounter" ? undefined : "Motion Graphics"}
              to={entry.id === "numberCounter" ? 1284 : undefined}
              prefix={entry.id === "numberCounter" ? "$" : undefined}
            />
          </div>
        );
        break;
      }
      case "particle": {
        const Particle = entry.Component;
        content = (
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <DemoBox />
            <Particle {...common} />
          </AbsoluteFill>
        );
        break;
      }
      case "background": {
        const Bg = entry.Component;
        content = <Bg {...entry.defaultConfig} />;
        break;
      }
      case "composite": {
        const Composite = entry.Component;
        if (entry.id === "cardStack") {
          content = (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Composite
                {...common}
                cardWidth={90}
                cardHeight={120}
                items={["#F89520", "#60a5fa", "#34d399"].map((c, i) => (
                  <div key={i} style={{ width: "100%", height: "100%", background: c }} />
                ))}
              />
            </div>
          );
        } else if (entry.id === "carousel") {
          content = (
            <div style={{ width: 220, height: 100 }}>
              <Composite
                {...common}
                items={["#F89520", "#60a5fa", "#34d399"].map((c, i) => (
                  <div key={i} style={{ width: 220, height: 100, borderRadius: 12, background: c }} />
                ))}
              />
            </div>
          );
        } else if (entry.id === "timelineProgress") {
          content = (
            <Composite {...common} steps={["Intro", "Demo", "Recap"]} currentStepIndex={1} />
          );
        } else if (entry.id === "ctaEnding") {
          content = <Composite {...common} headline="Try it free" subheadline="No card required" buttonText="Get Started" />;
        } else {
          // logoReveal — no real logo asset in the gallery preview; show a placeholder disc.
          content = (
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#F89520,#FDB846)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#111",
                fontWeight: 900,
                fontSize: 28,
              }}
            >
              CF
            </div>
          );
        }
        break;
      }
      default:
        content = null;
    }

    return (
      <AbsoluteFill style={{ background: "#0b0b10", alignItems: "center", justifyContent: "center" }}>
        {content}
      </AbsoluteFill>
    );
  };
}

const AnimationCard: React.FC<{ entry: AnimationRegistryEntry }> = ({ entry }) => {
  const Demo = useMemo(() => buildDemoComponent(entry), [entry]);
  return (
    <Card className="overflow-hidden">
      <div style={{ width: "100%", aspectRatio: `${DEMO_WIDTH}/${DEMO_HEIGHT}`, background: "#0b0b10" }}>
        <Player
          component={Demo}
          durationInFrames={DEMO_DURATION}
          fps={DEMO_FPS}
          compositionWidth={DEMO_WIDTH}
          compositionHeight={DEMO_HEIGHT}
          style={{ width: "100%", height: "100%" }}
          loop
          autoPlay
          controls={false}
          clickToPlay={false}
          showVolumeControls={false}
        />
      </div>
      <CardContent className="p-3">
        <p className="text-sm font-semibold">{entry.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.description}</p>
      </CardContent>
    </Card>
  );
};

export const AnimationLibraryGrid: React.FC = () => {
  return (
    <div className="space-y-8">
      {ANIMATION_CATEGORIES.map((cat) => (
        <div key={cat.id}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">{cat.label}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {animationsByCategory(cat.id).map((entry) => (
              <AnimationCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground pt-2">
        {Object.keys(ANIMATION_REGISTRY).length} reusable animation components — each is its own React component in
        src/remotion/motion-graphics/animations/, importable anywhere in the app.
      </p>
    </div>
  );
};
