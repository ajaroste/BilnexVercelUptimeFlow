import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const PRIVATE_IP_PATTERNS = [
  /^10\./, /^127\./, /^169\.254\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^0\./, /^::1$/, /^f[cd][0-9a-f]{2}:/i, /^fe80:/i,
];

export async function validateMonitorUrl(input: string) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Yalnızca HTTP/HTTPS adresleri desteklenir.");
  if (url.username || url.password) throw new Error("URL içinde kimlik bilgisi kullanılamaz.");
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => PRIVATE_IP_PATTERNS.some(pattern => pattern.test(address)))) {
    throw new Error("Özel veya yerel ağ adresleri izlenemez.");
  }
  return url;
}

export async function performHealthCheck(input: string) {
  const url = await validateMonitorUrl(input);
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
      headers: { "User-Agent": "Pulse-Uptime-Monitor/1.0", Accept: "*/*" },
      cache: "no-store",
    });
    const body = (await response.text()).slice(0, 2000);
    return {
      success: response.ok,
      statusCode: response.status,
      responseTime: Math.round(performance.now() - started),
      response: body,
      error: response.ok ? null : `HTTP ${response.status} ${response.statusText}`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    let message = "Bilinmeyen bağlantı hatası";
    if (error instanceof Error) {
      if (error.name === "TimeoutError") message = "İstek 5 saniye içinde yanıt vermedi";
      else {
        // Node.js fetch hatalarında asıl sebep error.cause içindedir
        const cause = (error as any).cause;
        message = cause && cause.message ? `Bağlantı hatası: ${cause.message}` : error.message;
      }
    }
    return { success: false, statusCode: null, responseTime: Math.round(performance.now() - started), response: "", error: message, timestamp: new Date().toISOString() };
  }
}
