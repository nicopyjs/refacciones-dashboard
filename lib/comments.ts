import { Redis } from "@upstash/redis";

export interface Comment {
  id: string;
  date: string;
  site: string | null;
  author: string;
  text: string;
  createdAt: string;
}

const HASH_KEY = "schedule:comments";

function getRedis(): Redis {
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

export async function getAllComments(): Promise<Comment[]> {
  const redis = getRedis();
  const raw = await redis.hgetall<Record<string, Comment[]>>(HASH_KEY);
  if (!raw) return [];
  const all: Comment[] = [];
  for (const date of Object.keys(raw)) {
    const list = raw[date];
    if (Array.isArray(list)) all.push(...list);
  }
  return all.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export async function addComment(date: string, author: string, text: string, site: string | null): Promise<Comment> {
  const redis = getRedis();
  const comment: Comment = {
    id: crypto.randomUUID(),
    date,
    site: site || null,
    author: author.slice(0, 60),
    text: text.slice(0, 500),
    createdAt: new Date().toISOString(),
  };
  const existing = (await redis.hget<Comment[]>(HASH_KEY, date)) ?? [];
  existing.push(comment);
  await redis.hset(HASH_KEY, { [date]: existing });
  return comment;
}

export async function deleteComment(date: string, id: string): Promise<void> {
  const redis = getRedis();
  const existing = (await redis.hget<Comment[]>(HASH_KEY, date)) ?? [];
  const filtered = existing.filter((c) => c.id !== id);
  if (filtered.length === 0) {
    await redis.hdel(HASH_KEY, date);
  } else {
    await redis.hset(HASH_KEY, { [date]: filtered });
  }
}
