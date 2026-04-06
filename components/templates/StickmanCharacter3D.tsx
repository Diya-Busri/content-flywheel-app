"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF, Center } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { StickmanPose } from "./stickman-types";

function cloneExplainerScene(scene: THREE.Object3D): THREE.Object3D {
  if (SkeletonUtils?.clone) {
    return SkeletonUtils.clone(scene);
  }
  return scene.clone(true);
}

/** Three.js sample asset (Tomás Laulhé / Don McCurdy, CC0 via three.js examples). */
const MODEL_URL = "/3d/xbot.glb";

/** Toon/cartoon palette */
const TOON_SKIN = new THREE.Color("#F4A261");
const TOON_CLOTHES = new THREE.Color("#222222");

/** Shared stepped gradient for MeshToonMaterial (cel-style bands). */
let toonGradientMap: THREE.CanvasTexture | null = null;

function getToonGradientMap(): THREE.CanvasTexture {
  if (toonGradientMap) return toonGradientMap;
  const canvas = document.createElement("canvas");
  canvas.width = 12;
  canvas.height = 1;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 12, 0);
  g.addColorStop(0, "#2a2a2a");
  g.addColorStop(0.35, "#7a7a7a");
  g.addColorStop(0.52, "#c8c8c8");
  g.addColorStop(1, "#ffffff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 12, 1);
  toonGradientMap = new THREE.CanvasTexture(canvas);
  toonGradientMap.minFilter = THREE.NearestFilter;
  toonGradientMap.magFilter = THREE.NearestFilter;
  return toonGradientMap;
}

function meshLabelBlob(mesh: THREE.Mesh): string {
  const meshName = mesh.name ?? "";
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const matNames = mats
    .filter((m): m is THREE.Material => !!m)
    .map((m) => m.name ?? "")
    .join(" ");
  return `${meshName} ${matNames}`.toLowerCase();
}

/** Classify mesh/material names: clothes → dark #222, else body/skin → warm #F4A261. */
function toonColorForMesh(mesh: THREE.Mesh): THREE.Color {
  const n = meshLabelBlob(mesh);

  const clothing =
    /\b(cloth|clothes|clothing|shirt|pant|trouser|jean|shoe|boot|jacket|coat|suit|hat|cap|belt|hoodie|sweater|vest|dress|skirt|sock|uniform|armor|helmet|mask|gear|fabric|denim|leather|trunks|glove|scarf|tie|hood|parka|blazer)\b/.test(
      n
    );
  const bodySkin =
    /\b(head|face|neck|torso|chest|skin|hand\b|hands\b|arm\b|arms\b|leg\b|legs\b|foot\b|feet|body\b|hip\b|hips\b|waist|tummy|nose|ear\b|ears\b|finger|thumb|palm|bicep|forearm|thigh|calf|ankle|chin|cheek|forehead|elbow|knee|wrist)\b/.test(
      n
    );

  if (clothing && !bodySkin) return TOON_CLOTHES.clone();
  if (bodySkin && !clothing) return TOON_SKIN.clone();
  if (clothing) return TOON_CLOTHES.clone();
  return TOON_SKIN.clone();
}

/** MeshToonMaterials: warm skin vs dark clothes (name-driven); cartoon shading via gradientMap. */
function applyFriendlyCharacterMaterials(root: THREE.Object3D) {
  const gradientMap = getToonGradientMap();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const color = toonColorForMesh(mesh);
    const isClothes = color.getHex() === TOON_CLOTHES.getHex();

    const mat = new THREE.MeshToonMaterial({
      color,
      gradientMap,
      emissive: isClothes ? new THREE.Color("#111111") : new THREE.Color("#c97b4a"),
      emissiveIntensity: isClothes ? 0.02 : 0.05,
    });
    mesh.material = mat;
  });
}

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
  const clone = useMemo(() => (scene ? cloneExplainerScene(scene) : new THREE.Group()), [scene]);
  const { actions } = useAnimations(animations, root);

  useLayoutEffect(() => {
    applyFriendlyCharacterMaterials(clone);
  }, [clone]);

  useEffect(() => {
    const clip = CLIP_BY_POSE[pose] ?? "idle";
    fadeToClip(actions as Record<string, THREE.AnimationAction | null> | undefined, clip, 0.32);
  }, [pose, actions]);

  useFrame((state) => {
    if (!root.current) return;
    const w = Math.sin(state.clock.elapsedTime * 2.1 + animKey) * 0.012;
    root.current.position.y = w;
  });

  return (
    <group ref={root}>
      <Center bottom>
        <primitive object={clone} rotation={[0, Math.PI, 0]} scale={0.92} />
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
        <ambientLight intensity={0.72} />
        <directionalLight
          castShadow
          position={[2.4, 5.2, 2.8]}
          intensity={0.75}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-far={20}
          shadow-camera-left={-3}
          shadow-camera-right={3}
          shadow-camera-top={3}
          shadow-camera-bottom={-3}
        />
        <directionalLight position={[-2.8, 3.2, -1.6]} intensity={0.45} color="#ffe8d6" />
        <hemisphereLight args={["#fff7ed", "#a8a29e", 0.42]} />
        <XbotExplainer pose={pose} animKey={animKey} />
      </Canvas>
    </div>
  );
}
