import { handleProbeRequest } from "@/lib/probe-route";

export const maxDuration = 20;

export async function POST(request: Request) {
  return handleProbeRequest(request);
}
