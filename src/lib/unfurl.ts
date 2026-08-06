import dns from "node:dns/promises";
import ogs from "open-graph-scraper";
import { prisma } from "@/lib/prisma";

const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const FETCH_TIMEOUT_MS = 5000;

export type LinkUnfurlResult = {
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
};

function isPrivateIPv4(ip: string) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isPrivateIPv6(ip: string) {
  const lower = ip.toLowerCase();
  return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
}

// Refuse to let the server fetch internal/loopback addresses on the user's
// behalf (SSRF) — resolve the hostname ourselves and check every address,
// since DNS can return a private IP for a public-looking hostname.
async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (addresses.length === 0) throw new Error("Could not resolve host");
  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIPv4(address)) throw new Error("Refusing to fetch a private address");
    if (family === 6 && isPrivateIPv6(address)) throw new Error("Refusing to fetch a private address");
  }
}

function isYouTube(url: URL) {
  return url.hostname === "youtu.be" || url.hostname.endsWith("youtube.com");
}

async function unfurlYouTube(url: URL): Promise<LinkUnfurlResult> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url.toString())}&format=json`;
  const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) return { title: null, description: null, image: null, favicon: null };
  const data = await res.json();
  return {
    title: data.title ?? null,
    description: data.author_name ? `von ${data.author_name}` : null,
    image: data.thumbnail_url ?? null,
    favicon: null,
  };
}

async function unfurlGeneric(rawUrl: string): Promise<LinkUnfurlResult> {
  const { result } = await ogs({ url: rawUrl, timeout: FETCH_TIMEOUT_MS / 1000 });
  return {
    title: result.ogTitle ?? null,
    description: result.ogDescription ?? null,
    image: result.ogImage?.[0]?.url ?? null,
    favicon: result.favicon ?? null,
  };
}

export async function unfurlUrl(rawUrl: string): Promise<LinkUnfurlResult> {
  const url = new URL(rawUrl);
  const key = url.toString();

  const cached = await prisma.linkPreview.findUnique({ where: { url: key } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_MAX_AGE_MS) {
    return { title: cached.title, description: cached.description, image: cached.image, favicon: null };
  }

  await assertPublicUrl(url);

  const result = isYouTube(url) ? await unfurlYouTube(url) : await unfurlGeneric(key);

  await prisma.linkPreview.upsert({
    where: { url: key },
    create: { url: key, title: result.title, description: result.description, image: result.image },
    update: { title: result.title, description: result.description, image: result.image, fetchedAt: new Date() },
  });

  return result;
}
