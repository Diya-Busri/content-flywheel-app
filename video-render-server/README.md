# Video Render Server

Standalone Express server that stitches scene clips + audio into a single 9:16 (1080×1920) MP4, uploads to Supabase Storage, and returns the file URL.

## Requirements

- Node 18+
- FFmpeg (installed automatically in Docker)

## Setup

```bash
cd video-render-server
cp .env.example .env
# Edit .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm install
npm start
```

## API

### `POST /render`

**Body (JSON):**

```json
{
  "scenes": [
    {
      "clipUrl": "https://...",
      "audioUrl": "https://...",
      "captionText": "Optional caption",
      "duration": 5.2
    }
  ]
}
```

- **clipUrl**: Video or image URL (MP4, MOV, JPG, PNG, WebP). Scaled/cropped to 1080×1920.
- **audioUrl**: Audio URL (e.g. MP3). Trimmed to `duration` seconds.
- **captionText**: Text overlay (bottom-center). Optional.
- **duration**: Scene length in seconds.

**Response:** `{ "url": "https://...supabase.co/storage/v1/object/public/video-renders/..." }`

### `GET /health`

Returns `{ "ok": true, "ffmpeg": true }`.

## Env

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default 3001) |
| `SUPABASE_URL` | Yes* | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes* | Service role key (for uploads) |
| `SUPABASE_VIDEO_RENDERS_BUCKET` | No | Bucket name (default `video-renders`) |

\* Required for `/render` to return a URL; without them the server returns 503.

## Docker

```bash
docker build -t video-render-server .
docker run -p 3001:3001 -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... video-render-server
```

## Railway

From this directory:

```bash
railway init
railway add -e SUPABASE_URL -e SUPABASE_SERVICE_ROLE_KEY
railway up
```

Or link the repo in Railway and set the **root directory** to `video-render-server`. The `railway.toml` config uses the Dockerfile and exposes `/health` for checks.
