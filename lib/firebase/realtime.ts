const databaseUrl = process.env.FIREBASE_DATABASE_URL ?? "https://bilnexluptimeflow-default-rtdb.firebaseio.com";

export async function realtimeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(`${databaseUrl.replace(/\/$/, "")}/${path.replace(/^\/+/, "")}.json`);
  if (process.env.FIREBASE_DATABASE_SECRET) url.searchParams.set("auth", process.env.FIREBASE_DATABASE_SECRET);
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Firebase isteği başarısız (${response.status})`);
  return response.json();
}
