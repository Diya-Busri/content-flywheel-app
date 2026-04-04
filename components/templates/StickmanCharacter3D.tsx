"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF, Center } from "@react-three/drei";
import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { StickmanPose } from "./stickman-types";

/** Three.js sample asset (Tomás Laulhé / Don McCurdy, CC0 via three.js examples). */
const MODEL_URL = "/3d/xbot.glb";

/**
 * Clip names from Xbot.glb: agree, headShake, idle, run, sad_pose, sneak_pose, walk
 * Mapped to explainer “poses” for a stock-style rigged character look.
 */
const CLIP_BY_POSE: Record<StickmanPose, string> = {
  standing: "idle",
  thinking: "headShake",
  sitting: "sneak_pose",
  celebrating: "agree",
  pointing: "idle",
  defeated: "sad_pose",
  "arms-raised": "run",
  walking: "walk",
};

function fadeToClip(
  actions: Record<string, THREE.AnimationAction | null> | undefined,
  clipName: string,
  duration = 0.35
) {
  if (!actions) return;
  const next = actions[clipName];
  if (!next) return;
  Object.values(actions).forEach((a) => {
    if (a && a !== next) {
      a.fadeOut(duration);
    }
  });
  next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(duration).play();
}

function XbotExplainer({ pose, animKey }: { pose: StickmanPose; animKey: number }) {
  const root = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions } = useAnimations(animations, root);

  useLayoutEffect(() => {
    scene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }, [scene]);

  useEffect(() => {
    const clip = CLIP_BY_POSE[pose] ?? "idle";
    fadeToClip(actions as Record<string, THREE.AnimationAction | null> | undefined, clip, 0.32);
  }, [pose, actions]);

  useFrame((state) => {
    if (!root.current) return;
    const w = Math.sin(state.clock.elapsedTime * 2.1 + animKey) * 0.015;
    root.current.position.y = w;
  });

  return (
    <group ref={root}>
      <Center bottom>
        {/* Single canvas instance: use cached scene so clip tracks match skeleton UUIDs. */}
        <primitive object={scene} rotation={[0, Math.PI, 0]} scale={0.95} />
      </Center>
    </group>
  );
}

/** Frame full body in the short, wide whiteboard strip below the caption. */
function FrameExplainerCamera() {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.near = 0.1;
    cam.far = 40;
    cam.fov = 50;
    cam.position.set(0, 0.58, 3.85);
    cam.lookAt(0, 0.42, 0);
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

useGLTF.preload(MODEL_URL);

export function StickmanCharacter3DCanvas({ pose, animKey }: { pose: StickmanPose; animKey: number }) {
  return (
    <div className="w-full h-full min-h-[100px] touch-none">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: false }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        camera={{ position: [0, 0.58, 3.85], fov: 50, near: 0.1, far: 40 }}
      >
        <FrameExplainerCamera />
        <ambientLight intensity={0.55} />
        <directionalLight
          castShadow
          position={[2.8, 6, 3.2]}
          intensity={1.1}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-far={20}
          shadow-camera-left={-3}
          shadow-camera-right={3}
          shadow-camera-top={3}
          shadow-camera-bottom={-3}
        />
        <directionalLight position={[-3.5, 2.5, -2]} intensity={0.32} color="#fef3c7" />
        <hemisphereLight args={["#fefce8", "#78716c", 0.35]} />
        <XbotExplainer pose={pose} animKey={animKey} />
      </Canvas>
    </div>
  );
}
