import { NextResponse } from "next/server";
import { performHealthCheck } from "@/lib/health-check";

export const maxDuration = 20;

export async function POST(request: Request) {
  const secret = process.env.MULTI_LOCATION_PROBE_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz probe isteği" }, { status: 401 });
  }

  try {
    const body = await request.json() as { target?: string };
    if (!body.target) return NextResponse.json({ error: "target gerekli" }, { status: 400 });
    const result = await performHealthCheck(body.target);
    return NextResponse.json(result, { status: result.success ? 200 : 503 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Probe başarısız" },
      { status: 500 },
    );
  }
}
