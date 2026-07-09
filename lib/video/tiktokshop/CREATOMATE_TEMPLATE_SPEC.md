# Creatomate Template Spec: TikTok Shop Demo (5-Scene, 9:16)

Standard variable naming and structure for backend-injected TikTok Shop demo videos.

---

## 1) Variable Naming Convention

| Variable | Type | Description |
|--------|------|-------------|
| **Global** | | |
| `width` | number | 1080 |
| `height` | number | 1920 |
| `Voiceover.source` | string | URL of voiceover audio (mp3) |
| **Per-scene clip** | | |
| `Scene1.Clip.source` | string | Video URL for scene 1 (hook) |
| `Scene2.Clip.source` | string | Video URL for scene 2 (problem) |
| `Scene3.Clip.source` | string | Video URL for scene 3 (demo) |
| `Scene4.Clip.source` | string | Video URL for scene 4 (result) |
| `Scene5.Clip.source` | string | Video URL for scene 5 (cta) |
| **Per-scene text overlay** | | |
| `Scene1.Text.text` | string | On-screen text, scene 1 |
| `Scene2.Text.text` | string | On-screen text, scene 2 |
| `Scene3.Text.text` | string | On-screen text, scene 3 |
| `Scene4.Text.text` | string | On-screen text, scene 4 |
| `Scene5.Text.text` | string | On-screen text, scene 5 |
| **Product overlay** (optional) | | |
| `Scene1.ProductOverlay.source` | string | Product image URL (scene 1) |
| `Scene3.ProductOverlay.source` | string | Product image URL (scene 3) |
| **Before/after** (optional, scene 4) | | |
| `Scene4.BeforeImage.source` | string | “Before” image URL |
| `Scene4.AfterImage.source` | string | “After” image URL |
| **Subtitles** | | |
| `Subtitles.source` | string | Leave empty for “auto” from voiceover; or URL to SRT/VTT if you generate it |

**Convention rules**

- Prefix: `Scene{N}.` for scene-specific content; no prefix for global (e.g. `Voiceover`, `width`, `height`).
- Property suffix: `.source` for media (video/image/audio), `.text` for text.
- Names: PascalCase (e.g. `ProductOverlay`, `BeforeImage`).

---

## 2) JSON Example Payload (Creatomate API)

```json
{
  "template_id": "YOUR_TEMPLATE_ID",
  "modifications": {
    "width": 1080,
    "height": 1920,
    "Voiceover.source": "https://your-cdn.com/voiceover/abc123.mp3",
    "Scene1.Clip.source": "https://your-cdn.com/clips/hook.mp4",
    "Scene2.Clip.source": "https://your-cdn.com/clips/problem.mp4",
    "Scene3.Clip.source": "https://your-cdn.com/clips/demo.mp4",
    "Scene4.Clip.source": "https://your-cdn.com/clips/result.mp4",
    "Scene5.Clip.source": "https://your-cdn.com/clips/cta.mp4",
    "Scene1.Text.text": "You need this",
    "Scene2.Text.text": "The struggle is real",
    "Scene3.Text.text": "Here's how it works",
    "Scene4.Text.text": "Before vs after",
    "Scene5.Text.text": "Shop now – link in bio",
    "Scene1.ProductOverlay.source": "https://your-cdn.com/product.png",
    "Scene3.ProductOverlay.source": "https://your-cdn.com/product.png",
    "Scene4.BeforeImage.source": "https://your-cdn.com/before.jpg",
    "Scene4.AfterImage.source": "https://your-cdn.com/after.jpg"
  },
  "output_format": "mp4"
}
```

Omit any optional key (e.g. product overlay or before/after) when not used; backend can send empty string or omit.

---

## 3) Recommended Layer Structure (in Creatomate Editor)

- **Composition (root)**  
  - `width`: 1080, `height`: 1920.  
  - Duration: sum of scene durations (e.g. 20–45s).

- **Scene 1 – Hook** (e.g. 0s–4s)  
  - `Scene1.Clip` – Video (full frame).  
  - `Scene1.Text` – Text overlay (caption).  
  - `Scene1.ProductOverlay` – Image (optional), positioned (e.g. corner/brand strip).

- **Scene 2 – Problem**  
  - `Scene2.Clip`, `Scene2.Text`.

- **Scene 3 – Demo**  
  - `Scene3.Clip`, `Scene3.Text`, `Scene3.ProductOverlay` (optional).

- **Scene 4 – Result**  
  - `Scene4.Clip`, `Scene4.Text`.  
  - Optional: `Scene4.BeforeImage`, `Scene4.AfterImage` (e.g. split or side-by-side), time-limited to this scene.

- **Scene 5 – CTA**  
  - `Scene5.Clip`, `Scene5.Text`.

- **Global**  
  - `Voiceover` – Audio track (single source for full narration).  
  - `Subtitles` – Auto subtitles from voiceover, or a single source if you inject SRT/VTT later.

Use **dynamic properties** in the editor for every field you want to override via API (each of the variables above). Names in the template must match the keys in `modifications` exactly.

---

## 4) Timing Model (Scene Durations)

- **Backend** sends per-scene `durationSec` (e.g. from script step). Total must be 20–45s.
- **Creatomate** does not receive “duration” in this spec; timing is controlled by:
  - **Option A (recommended):** Each scene is a **segment** of the composition timeline. Set segment `time` and `duration` in the template to fixed defaults (e.g. Scene1: 0–4s, Scene2: 4–8s, …). Backend then only replaces media and text; total duration is fixed (e.g. 30s).  
  - **Option B:** Composition and each scene clip’s in/out points are driven by **modifications** (e.g. `Scene1.duration`, `Scene2.time`). Use Creatomate’s time/duration properties if your plan supports them.
- **Practical approach:** Build the template with a **fixed timing grid** (e.g. 4+4+8+6+4 = 26s). Backend injects clip URLs and text; clips can be longer than the segment—Creatomate trims by segment duration. If you need variable per-scene duration later, add variables like `Scene1.duration` and map them in the template.

**Example fixed timing (26s total)**

| Scene | Type   | Start | End |
|-------|--------|-------|-----|
| 1     | hook   | 0s    | 4s  |
| 2     | problem| 4s    | 8s  |
| 3     | demo   | 8s    | 16s |
| 4     | result | 16s   | 22s |
| 5     | cta    | 22s   | 26s |

---

## 5) Animating Product Overlays Cleanly

- **Placement:** Same position for Scene 1 and Scene 3 (e.g. bottom-right or top banner) so it feels consistent.
- **Animation:** Use short **fade-in** (e.g. 0.2–0.4s) at scene start; optional light **scale** (e.g. 0.95 → 1) so it doesn’t pop. No heavy motion so it stays readable.
- **Visibility:** Bind overlay visibility to the scene’s time range (show only during Scene 1 and Scene 3). If the overlay is inside a scene group, it’s automatic.
- **Fallback:** When `Scene1.ProductOverlay.source` or `Scene3.ProductOverlay.source` is empty or missing, hide the layer (or use a transparent pixel) so the template doesn’t show a broken image.
- **Aspect:** Scale to fit a defined area (e.g. 200px height) and keep aspect ratio so product doesn’t stretch.

---

## 6) Error Prevention Rules

- **Required variables:** Backend must always send: `width`, `height`, `Voiceover.source`, and all five `Scene{N}.Clip.source` URLs. Validate URLs (http/https, non-empty) before calling the API.
- **Optional variables:** Only send `Scene1.ProductOverlay.source` / `Scene3.ProductOverlay.source` when you have a product image. Only send `Scene4.BeforeImage.source` and `Scene4.AfterImage.source` when both exist. Otherwise omit or leave empty per your Creatomate setup.
- **URLs:** All media URLs must be **publicly reachable** (no auth). Creatomate’s servers must be able to fetch them. Use HTTPS.
- **Format:** Video: MP4 (H.264). Audio: MP3. Images: JPG/PNG. Avoid huge files; keep clips and images optimized for mobile.
- **Naming:** Match variable names **exactly** to the template (case-sensitive). No extra spaces. Use the same dot-notation (e.g. `Scene1.Clip.source`) in code and in the template.
- **Template ID:** Validate `template_id` before POST. If a variable is missing in the template, Creatomate may return 400; log the response body and map missing keys to your naming list.
- **Timeouts:** Render can take 1–3+ minutes. Poll status with at least 2s interval and a max wait (e.g. 5 min); on timeout, surface a clear message and do not assume success.

---

## Backend Mapping (Reference)

Your `assetPlan.ts` (or equivalent) should output `modifications` whose keys match the table in section 1. Example mapping from pipeline to Creatomate keys:

- `Voiceover` → `Voiceover.source`
- Scene clip URL → `Scene{N}.Clip.source`
- Scene text → `Scene{N}.Text.text`
- Product overlay URL → `Scene{N}.ProductOverlay.source` (N = 1, 3)
- Before/after → `Scene4.BeforeImage.source`, `Scene4.AfterImage.source`
- `width` / `height` → 1080 / 1920

Keep this spec and the JSON payload in sync with your Creatomate template so backend injection stays reliable.
