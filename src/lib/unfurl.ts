import ogs from "open-graph-scraper";
import { prisma } from "@/lib/prisma";
import { assertPublicUrl } from "@/lib/ssrf-guard";

const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const FETCH_TIMEOUT_MS = 5000;

export type LinkUnfurlResult = {
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
};

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
