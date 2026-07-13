/**
 * Cloudflare R2 storage abstraction (S3-compatible API).
 *
 * Required environment variables — set in Vercel dashboard and .env.local:
 *   R2_ACCOUNT_ID        — Cloudflare account ID (dash.cloudflare.com → top-right)
 *   R2_ACCESS_KEY_ID     — R2 API token access key (dash.cloudflare.com → R2 → Manage R2 API tokens)
 *   R2_SECRET_ACCESS_KEY — R2 API token secret key (same place)
 *   R2_BUCKET_NAME       — bucket name (e.g. "content-flywheel")
 *   R2_PUBLIC_URL        — public bucket URL (e.g. "https://pub-xxxx.r2.dev" or custom domain)
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getClient(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) throw new Error("R2_ACCOUNT_ID is not set");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME is not set");
  return bucket;
}

function getPublicUrl(): string {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) throw new Error("R2_PUBLIC_URL is not set");
  return url.replace(/\/$/, "");
}

/** Extract the R2 object key from a full public URL. */
function keyFromUrl(url: string): string {
  const base = getPublicUrl();
  if (url.startsWith(base)) return url.slice(base.length + 1);
  // Fallback: strip any https://host/ prefix
  return url.replace(/^https?:\/\/[^/]+\//, "");
}

export type UploadOptions = {
  contentType?: string;
  /** Ignored — all uploads are public via the bucket's public policy. */
  access?: "public";
  /** Ignored — R2 keys are exact; add a suffix yourself if needed. */
  addRandomSuffix?: boolean;
};

/** Upload a file to R2. Returns { url } matching Vercel Blob's put() shape. */
export async function upload(
  pathname: string,
  body: Buffer | Blob | ReadableStream | ArrayBufferLike | Uint8Array,
  options: UploadOptions = {}
): Promise<{ url: string }> {
  const client = getClient();
  const bucket = getBucket();

  let uploadBody: Buffer | Uint8Array;
  if (body instanceof ReadableStream) {
    const chunks: Uint8Array[] = [];
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    let done = false;
    while (!done) {
      const { value, done: d } = await reader.read();
      if (value) chunks.push(value);
      done = d;
    }
    uploadBody = Buffer.concat(chunks);
  } else if (typeof Blob !== "undefined" && body instanceof Blob) {
    // File extends Blob — AWS SDK v3 cannot hash a Blob/File stream; convert to Buffer first
    uploadBody = Buffer.from(await body.arrayBuffer());
  } else {
    uploadBody = body as Buffer | Uint8Array;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: pathname,
      Body: uploadBody as Buffer,
      ContentType: options.contentType,
    })
  );

  return { url: `${getPublicUrl()}/${pathname}` };
}

/** Delete a file from R2. Accepts the full public URL (mirrors Vercel Blob's del()). */
export async function del(url: string): Promise<void> {
  const client = getClient();
  const bucket = getBucket();
  const key = keyFromUrl(url);
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export type BlobItem = { url: string; pathname: string };

/** List files under a prefix. Returns { blobs } mirroring Vercel Blob's list(). */
export async function list(prefix: string): Promise<{ blobs: BlobItem[] }> {
  const client = getClient();
  const bucket = getBucket();
  const publicUrl = getPublicUrl();

  const res = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix })
  );

  const blobs: BlobItem[] = (res.Contents ?? []).map((obj) => ({
    pathname: obj.Key ?? "",
    url: `${publicUrl}/${obj.Key}`,
  }));

  return { blobs };
}

/**
 * Generate a short-lived presigned PUT URL for direct client-to-R2 uploads.
 * Returns { uploadUrl, publicUrl }.
 */
export async function getPresignedUploadUrl(
  pathname: string,
  contentType: string,
  expiresIn = 300
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const client = getClient();
  const bucket = getBucket();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: pathname,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  return { uploadUrl, publicUrl: `${getPublicUrl()}/${pathname}` };
}

// ── Private object storage ──────────────────────────────────────────────────
// Everything above assumes the bucket serves R2_PUBLIC_URL/<key> to anyone who
// knows the key. The functions below are for files that must NOT be linkable
// that way (e.g. 100 Product Challenge uploads) — they return only the R2
// object key (never a public URL), and reads go through a short-lived signed
// GET URL generated on demand for an authorised admin.
//
// IMPORTANT: this only withholds the URL at the application layer. If the R2
// bucket itself has "public access" / a public dev URL enabled at the
// Cloudflare account level, anyone who somehow learns the exact key could
// still fetch R2_PUBLIC_URL/<key> directly. For genuine bucket-level privacy,
// store these objects in a separate R2 bucket that has public access
// disabled — that's a Cloudflare dashboard change, not something this file
// can enforce in code. Using a random, non-guessable key (below) makes this
// low-risk in practice, but it is obscurity, not a hard access-control
// guarantee, unless paired with a genuinely private bucket.

/** Upload a file to R2 without ever returning a public URL. Returns the object key only. */
export async function uploadPrivate(
  key: string,
  body: Buffer | Blob | ReadableStream | ArrayBufferLike | Uint8Array,
  contentType?: string
): Promise<{ key: string }> {
  const client = getClient();
  const bucket = getBucket();

  let uploadBody: Buffer | Uint8Array;
  if (body instanceof ReadableStream) {
    const chunks: Uint8Array[] = [];
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    let done = false;
    while (!done) {
      const { value, done: d } = await reader.read();
      if (value) chunks.push(value);
      done = d;
    }
    uploadBody = Buffer.concat(chunks);
  } else if (typeof Blob !== "undefined" && body instanceof Blob) {
    uploadBody = Buffer.from(await body.arrayBuffer());
  } else {
    uploadBody = body as Buffer | Uint8Array;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: uploadBody as Buffer,
      ContentType: contentType,
    })
  );

  return { key };
}

/** Generate a short-lived signed GET URL for a private object. Default expiry: 5 minutes. */
export async function getSignedDownloadUrl(key: string, expiresIn = 300): Promise<string> {
  const client = getClient();
  const bucket = getBucket();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn });
}

/** Delete a private object by its exact key (not a public URL). */
export async function deleteByKey(key: string): Promise<void> {
  const client = getClient();
  const bucket = getBucket();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
