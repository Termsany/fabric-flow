import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type StorageProvider = "local" | "s3";

const uploadsRoot = path.resolve(process.cwd(), process.env.UPLOADS_DIR || "uploads");
const paymentProofsDir = path.join(uploadsRoot, "payment-proofs");

function getStorageProvider(): StorageProvider {
  return process.env.STORAGE_PROVIDER === "s3" ? "s3" : "local";
}

function sanitizeExt(originalName: string, mimeType: string): string {
  const ext = path.extname(originalName).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
    return ext === ".jpeg" ? ".jpg" : ext;
  }

  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}

function buildObjectKey(tenantId: number, originalName: string, mimeType: string): string {
  const ext = sanitizeExt(originalName, mimeType);
  return `payment-proofs/payment-${tenantId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
}

let cachedClient: S3Client | null = null;

function getS3Client(): S3Client {
  if (cachedClient) {
    return cachedClient;
  }

  const region = process.env.S3_REGION || "auto";
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  if (!accessKeyId || !secretAccessKey || !process.env.S3_BUCKET) {
    throw new Error("S3 storage is not fully configured");
  }

  cachedClient = new S3Client({
    region,
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return cachedClient;
}

function getBucketName(): string {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) {
    throw new Error("S3_BUCKET is required when STORAGE_PROVIDER=s3");
  }

  return bucket;
}

function getPublicBaseUrl(): string {
  const configured = process.env.UPLOADS_PUBLIC_BASE_URL?.trim() || process.env.S3_PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const endpoint = process.env.S3_ENDPOINT?.trim()?.replace(/\/+$/, "");
  if (!endpoint) {
    throw new Error("UPLOADS_PUBLIC_BASE_URL or S3_PUBLIC_BASE_URL is required when STORAGE_PROVIDER=s3");
  }

  return `${endpoint}/${getBucketName()}`;
}

function resolveS3KeyFromUrl(url: string): string {
  const publicBase = getPublicBaseUrl();
  if (url.startsWith(`${publicBase}/`)) {
    return url.slice(publicBase.length + 1);
  }

  const parsed = new URL(url);
  const parts = parsed.pathname.replace(/^\/+/, "").split("/");
  if (parts[0] === getBucketName()) {
    return parts.slice(1).join("/");
  }

  return parts.join("/");
}

export async function savePaymentProof(params: {
  tenantId: number;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ proofImageUrl: string }> {
  const key = buildObjectKey(params.tenantId, params.originalName, params.mimeType);

  if (getStorageProvider() === "local") {
    await fs.mkdir(paymentProofsDir, { recursive: true });
    const absolutePath = path.join(uploadsRoot, key);
    await fs.writeFile(absolutePath, params.buffer);
    return {
      proofImageUrl: `/${key.replace(/\\/g, "/")}`,
    };
  }

  const client = getS3Client();
  await client.send(new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    Body: params.buffer,
    ContentType: params.mimeType,
    CacheControl: "private, max-age=31536000, immutable",
  }));

  return {
    proofImageUrl: `${getPublicBaseUrl()}/${key}`,
  };
}

export async function getPaymentProof(params: { proofImageUrl: string }): Promise<{
  stream: Readable;
  contentType: string;
}> {
  if (getStorageProvider() === "local" || params.proofImageUrl.startsWith("/")) {
    const absolutePath = path.join(uploadsRoot, params.proofImageUrl.replace(/^\/+/, ""));
    const stream = Readable.from(await fs.readFile(absolutePath));
    return {
      stream,
      contentType: guessContentType(absolutePath),
    };
  }

  const client = getS3Client();
  const key = resolveS3KeyFromUrl(params.proofImageUrl);
  const result = await client.send(new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  }));

  const body = result.Body;
  if (!body) {
    throw new Error("Proof image not found");
  }

  return {
    stream: body instanceof Readable ? body : Readable.fromWeb(body.transformToWebStream()),
    contentType: result.ContentType || guessContentType(key),
  };
}

function guessContentType(value: string): string {
  const ext = path.extname(value).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

export function isLocalStorage(): boolean {
  return getStorageProvider() === "local";
}

