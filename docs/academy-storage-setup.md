# Academy Storage Setup (Supabase)

The Academy block editor and community uploads store files in Supabase Storage.
Storage buckets are created via the Supabase dashboard / API, not via SQL migrations.

## Required buckets (all PUBLIC)

Create these four buckets in **Supabase Dashboard → Storage → New bucket**, and
toggle each one to **Public**:

| Bucket name          | Used for                                  |
| -------------------- | ----------------------------------------- |
| `academy-videos`     | Lesson video uploads (video blocks)       |
| `academy-images`     | Lesson image uploads (image blocks)       |
| `academy-downloads`  | Lesson downloadable files (download blocks)|
| `academy-community`  | Community post attachments                |

All four must be **public** so the returned `getPublicUrl()` links resolve without
signed URLs.

## Environment variables

The upload route (`app/api/academy/upload/route.ts`) uses the service-role client
from `lib/supabase/server.ts`, which reads:

- `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key bypasses RLS, so no extra storage policies are required for
uploads. Because the buckets are public, reads work for all users.

## Quick create via Supabase JS (optional)

```js
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
for (const id of ["academy-videos", "academy-images", "academy-downloads", "academy-community"]) {
  await supabase.storage.createBucket(id, { public: true });
}
```
