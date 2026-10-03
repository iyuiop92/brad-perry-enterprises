import "server-only";

const AETHER_API_URL = (process.env.AETHER_API_URL ?? "https://www.aetherhockey.com").replace(/\/$/, "");

export async function callAetherContent(path: string, init?: RequestInit) {
  const token = process.env.BPE_AETHER_API_TOKEN;
  if (!token) throw new Error("BPE_AETHER_API_TOKEN is not configured");

  const response = await fetch(`${AETHER_API_URL}/api/integrations/bpe/content${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({ error: "Aether returned an invalid response" }));
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Aether request failed");
  return payload;
}
