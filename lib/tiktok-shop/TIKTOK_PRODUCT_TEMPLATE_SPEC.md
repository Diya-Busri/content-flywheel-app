# Creatomate Template Spec: TikTok Shop Product (4-Scene, 9:16)

Product-driven TikTok Shop videos: **product image in every scene**, scene-based text, single voiceover. No generic stock or scenic fallbacks.

---

## 1) Variable Naming

| Variable | Type | Description |
|----------|------|-------------|
| `width` | number | 1080 |
| `height` | number | 1920 |
| `Voiceover.source` | string | URL of full voiceover audio (mp3) |
| `Scene1.Image.source` | string | **Product image** – hook scene (e.g. blurred zoom) |
| `Scene1.Text.text` | string | Hook line (short, punchy) |
| `Scene2.Image.source` | string | **Product image** – pain scene (e.g. close-up) |
| `Scene2.Text.text` | string | Pain / problem line |
| `Scene3.Image.source` | string | **Product image** – solution scene (e.g. zoom/pan) |
| `Scene3.Text.text` | string | Solution / bullet points (newlines allowed) |
| `Scene4.Image.source` | string | **Product image** – CTA scene |
| `Scene4.Text.text` | string | CTA line + "Buy now on TikTok Shop" |

All four scenes must show the **same product image**. The template applies the visual treatment per scene (blur, zoom, pan, etc.).

---

## 2) Scene Treatments (in Creatomate Editor)

- **Scene 1 (Hook):** Background = product image with blur + zoom. Text overlay = hook.
- **Scene 2 (Pain):** Background = product image close-up. Text overlay = pain.
- **Scene 3 (Solution):** Background = product image with animated zoom or pan. Text = solution bullets (multi-line).
- **Scene 4 (CTA):** Background = product image. Large CTA text including "Buy now on TikTok Shop".

---

## 3) JSON Example Payload

```json
{
  "template_id": "YOUR_TEMPLATE_ID",
  "modifications": {
    "width": 1080,
    "height": 1920,
    "Voiceover.source": "https://your-cdn.com/voiceover.mp3",
    "Scene1.Image.source": "https://your-cdn.com/product.jpg",
    "Scene1.Text.text": "You need this in your routine",
    "Scene2.Image.source": "https://your-cdn.com/product.jpg",
    "Scene2.Text.text": "Tired of dull skin?",
    "Scene3.Image.source": "https://your-cdn.com/product.jpg",
    "Scene3.Text.text": "• Glowing finish\n• Long-lasting\n• Easy to apply",
    "Scene4.Image.source": "https://your-cdn.com/product.jpg",
    "Scene4.Text.text": "Shop the link below\nBuy now on TikTok Shop"
  },
  "output_format": "mp4"
}
```

---

## 4) Env

Set in `.env.local`:

- `CREATOMATE_TEMPLATE_TIKTOK_PRODUCT` – template ID for this 4-scene product layout.
- Or `CREATOMATE_TEMPLATE_DEMO` – used as fallback if `CREATOMATE_TEMPLATE_TIKTOK_PRODUCT` is not set (template must use the variable names above).

---

## 5) Backend Flow

1. Script generated → split into `hook`, `pain`, `solution`, `cta`.
2. Voiceover generated from **full script** (ElevenLabs).
3. Product image required (from upload or extracted from product URL).
4. `buildSceneTimeline()` builds modifications; `renderProductVideo()` sends to Creatomate.

No stock or scenic fallback: if there is no product image, the API returns 400 and asks the user to add an image or use a link that includes one.
