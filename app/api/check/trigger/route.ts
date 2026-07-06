import { NextResponse } from "next/server";

/**
 * Güvenli manuel tetikleme proxy'si.
 * Client, CRON_SECRET'i bilmez — bu route server-side olarak header ekler.
 * Rate limiting middleware tarafından zaten kısıtlanıyor.
 */
export async function POST() {
  const secret = process.env.CRON_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  try {
    const res = await fetch(`${baseUrl}/api/cron/check?interval=1`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error ?? "Kontrol başarısız" }, { status: res.status });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sunucu hatası" },
      { status: 500 },
    );
  }
}
