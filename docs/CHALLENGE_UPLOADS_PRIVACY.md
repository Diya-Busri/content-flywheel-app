# 100 Product Challenge — upload privacy setup

This doc explains the current state of file privacy for challenge submission
uploads, what the recommended long-term fix is, and how to verify it. It is
informational only — **no storage architecture change has been made
automatically**, per the instruction not to touch the existing public R2
bucket that your live product assets, covers, and downloads already depend
on.

## Current state (as shipped)

- Challenge uploads (product files, covers, screenshots, etc.) are written
  via `uploadPrivate()` in `lib/storage.ts` to the **same R2 bucket** every
  other product asset uses (`R2_BUCKET_NAME`), under the key prefix
  `private/challenge/<uuid>-<sanitized-filename>`.
- The app **never** constructs or returns a public URL for these keys.
  `POST /api/challenge/upload` returns only the opaque key. The admin
  dashboard fetches short-lived (5 minute) signed GET URLs on demand via
  `GET /api/admin/challenge-submissions/[id]/files`, which are never stored
  or logged anywhere.
- This is enforced at the **application layer only**. Whether a file is
  truly unreachable without authorisation depends on whether your R2 bucket
  itself has public access enabled at the Cloudflare account level (see
  "How to verify" below).

## Which challenge uploads must be private

Everything a creator uploads through the challenge submission form:

- The product file itself (PDF, ZIP, DOCX, PPTX, XLSX, EPUB)
- Product cover images and screenshots
- Workbook / template / course-outline previews
- Any brand assets or supporting images

None of these should ever be reachable by a plain URL, indexed, or linked
from any public page — including for **public** (non-anonymous) challenge
submissions. A public submission's *finished, admin-reviewed* Store listing
is what becomes public — the raw uploaded review material never should.

## Recommended: separate private R2 bucket

The most robust fix is a second, dedicated R2 bucket with **no public
access** enabled (no "Public Development URL", no custom domain mapped to
it). This removes the current obscurity-only guarantee (non-guessable key)
and replaces it with a real access-control boundary — even a leaked key is
useless without valid R2 credentials and a signed URL.

**Steps (Cloudflare dashboard):**

1. Create a new R2 bucket, e.g. `content-flywheel-private`.
2. Do **not** enable "Public Development URL" or attach a custom domain to
   it — this is what makes it private.
3. Reuse the same R2 API token (`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`)
   if it already has read/write access to all buckets on the account, or
   create a scoped token limited to just the new bucket.
4. Point the challenge upload code at the new bucket (see env vars below).

### Environment variables if introduced

Add alongside the existing `R2_*` vars (do not remove or repoint the
existing ones — those must keep serving your live public product assets
unchanged):

```
R2_PRIVATE_BUCKET_NAME=content-flywheel-private
```

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` can be reused as-is
if the token has access to both buckets. No `R2_PRIVATE_PUBLIC_URL` variable
is needed or wanted — a private bucket should never have a public URL to
configure.

### Code change (only do this once the bucket exists)

In `lib/storage.ts`, `uploadPrivate()` / `getSignedDownloadUrl()` /
`deleteByKey()` would read `R2_PRIVATE_BUCKET_NAME` (falling back to
`R2_BUCKET_NAME` if unset, so nothing breaks if the new bucket isn't
configured yet) instead of always using `getBucket()`. Every other function
in that file (`upload`, `del`, `list`, `getPresignedUploadUrl`) — the ones
your existing public product assets use — stays exactly as-is, pointed at
`R2_BUCKET_NAME`. This is a small, additive change, not a rewrite.

## How signed downloads should work

This part is already implemented and doesn't change if you add the private
bucket later — same function, just pointed at a different (safer) bucket:

1. Admin opens a submission in `/dashboard/admin/challenge-submissions`.
2. Clicking "Load files" calls `GET /api/admin/challenge-submissions/[id]/files`.
3. That route re-checks `isAdmin()`, then calls `getSignedDownloadUrl(key, 300)`
   for each file — a 5-minute presigned `GetObjectCommand` URL.
4. The signed URL is returned in the JSON response and opened directly by the
   admin's browser. It is never persisted to the database, never logged, and
   expires automatically.
5. Non-admins get a 403 before any signed URL is ever generated.

## How to verify a file cannot be accessed publicly without authorisation

1. Submit a test entry through `/challenge/submit` with a small test file
   attached.
2. In the admin dashboard, open the submission and click "Load files" to
   get the object key logged in your browser's network tab (inspect the
   `key` field in the `/files` response) — or check the `uploaded_files`
   JSONB column directly in the `challenge_submissions` table.
3. Construct the plain public URL yourself:
   `${R2_PUBLIC_URL}/<the key you found>`
4. Open that URL in an incognito browser window (no admin session).
   - **If it 404s or is refused** — the bucket has no public access
     enabled, and the current single-bucket setup is already
     effectively private. No further action needed.
   - **If the file downloads** — the bucket has public access enabled at
     the account level, and you should move challenge uploads to a
     genuinely private bucket using the steps above. Until then, treat
     the current key-obscurity approach as "hard to find," not "provably
     private."
5. Separately, confirm a signed URL still works when copy-pasted after its
   5-minute expiry has passed — it should fail. If it doesn't expire,
   double check the `expiresIn` value wasn't changed.
