const databaseUrl = process.env.FIREBASE_DATABASE_URL ?? "https://bilnexluptimeflow-default-rtdb.firebaseio.com";

type RealtimeQuery = {
  orderBy?: string;
  equalTo?: string | number | boolean | null;
  startAt?: string | number | null;
  endAt?: string | number | null;
  limitToFirst?: number;
  limitToLast?: number;
};

export async function realtimeRequest<T>(path: string, init?: RequestInit, query?: RealtimeQuery): Promise<T> {
  const url = new URL(`${databaseUrl.replace(/\/$/, "")}/${path.replace(/^\/+/, "")}.json`);

  if (process.env.FIREBASE_DATABASE_SECRET) {
    url.searchParams.set("auth", process.env.FIREBASE_DATABASE_SECRET);
  }

  if (query?.orderBy !== undefined) url.searchParams.set("orderBy", JSON.stringify(query.orderBy));
  if (query?.equalTo !== undefined) url.searchParams.set("equalTo", JSON.stringify(query.equalTo));
  if (query?.startAt !== undefined) url.searchParams.set("startAt", JSON.stringify(query.startAt));
  if (query?.endAt !== undefined) url.searchParams.set("endAt", JSON.stringify(query.endAt));
  if (query?.limitToFirst !== undefined) url.searchParams.set("limitToFirst", String(query.limitToFirst));
  if (query?.limitToLast !== undefined) url.searchParams.set("limitToLast", String(query.limitToLast));

  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Firebase isteği başarısız (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }

  return response.json();
}
