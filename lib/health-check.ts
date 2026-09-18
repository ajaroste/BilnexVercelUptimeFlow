import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { LatencyStatus } from "@/types";

const PRIVATE_IP_PATTERNS = [
  /^10\./, /^127\./, /^169\.254\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^0\./, /^::1$/, /^f[cd][0-9a-f]{2}:/i, /^fe80:/i,
];

const REQUEST_TIMEOUT_MS = 20_000;

function classifyLatency(responseTime: number, timedOut = false): LatencyStatus {
  if (timedOut || responseTime >= REQUEST_TIMEOUT_MS) return "timeout";
  if (responseTime >= 10_000) return "degraded";
  if (responseTime >= 3_000) return "slow";
  return "normal";
}

function describeHttpError(status: number, statusText: string) {
  const descriptions: Record<number, string> = {
    400: "Sunucu isteği geçersiz buldu.",
    401: "Kimlik doğrulama gerekli veya kimlik bilgileri geçersiz.",
    403: "Sunucu isteği anladı ancak erişime izin vermedi.",
    404: "İzlenen endpoint sunucuda bulunamadı.",
    408: "Sunucu isteği zamanında tamamlayamadı.",
    409: "Sunucuda istekle çakışan bir durum oluştu.",
    429: "Sunucu çok fazla istek nedeniyle isteği sınırlandırdı.",
    500: "Sunucu tarafında beklenmeyen bir uygulama hatası oluştu.",
    502: "Gateway/proxy arka servisten geçerli yanıt alamadı.",
    503: "Servis geçici olarak kullanılamıyor veya aşırı yoğun.",
    504: "Gateway/proxy arka servisten zamanında yanıt alamadı.",
  };
  const explanation = descriptions[status] ?? (
    status >= 500 ? "Sunucu tarafında bir hata oluştu." :
    status >= 400 ? "İstek istemci veya yetkilendirme kaynaklı bir HTTP hatasıyla sonuçlandı." :
    "Beklenmeyen bir HTTP yanıtı alındı."
  );
  return {
    errorType: status >= 500 ? "HTTP_SERVER" : "HTTP_CLIENT",
    errorCode: `HTTP_${status}`,
    error: `HTTP ${status} ${statusText || "Hata"} — ${explanation}`,
    errorDetail: explanation,
  };
}

type NetworkCause = {
  code?: string;
  errno?: string;
  message?: string;
};

function describeNetworkError(error: unknown) {
  const fallback = error instanceof Error ? error.message : "Bilinmeyen bağlantı hatası";
  const cause = error instanceof Error ? (error as Error & { cause?: NetworkCause }).cause : undefined;
  const code = String(cause?.code ?? cause?.errno ?? "").toUpperCase();
  const rawDetail = String(cause?.message ?? fallback).slice(0, 400);

  const known: Record<string, { type: string; message: string; detail: string }> = {
    ENOTFOUND: {
      type: "DNS",
      message: "DNS çözümlemesi başarısız oldu.",
      detail: "Alan adı bir IP adresine çözümlenemedi. DNS kaydı, alan adı veya DNS sağlayıcısı kontrol edilmelidir.",
    },
    EAI_AGAIN: {
      type: "DNS",
      message: "DNS sunucusu geçici olarak yanıt veremedi.",
      detail: "DNS sorgusu geçici hata verdi. Ağ veya DNS sağlayıcısında anlık yoğunluk olabilir.",
    },
    ECONNREFUSED: {
      type: "CONNECTION",
      message: "Bağlantı hedef sunucu tarafından reddedildi.",
      detail: "Hedef IP/port erişilebilir ancak ilgili portta servis dinlemiyor veya güvenlik duvarı bağlantıyı reddediyor olabilir.",
    },
    ECONNRESET: {
      type: "CONNECTION",
      message: "Bağlantı karşı taraf tarafından sıfırlandı.",
      detail: "TCP bağlantısı kurulduktan sonra sunucu, proxy veya ağ cihazı bağlantıyı beklenmedik şekilde kapattı.",
    },
    ETIMEDOUT: {
      type: "NETWORK_TIMEOUT",
      message: "Ağ bağlantısı zaman aşımına uğradı.",
      detail: "TCP bağlantısı veya ağ iletişimi zamanında tamamlanamadı.",
    },
    UND_ERR_CONNECT_TIMEOUT: {
      type: "NETWORK_TIMEOUT",
      message: "Sunucuya bağlantı kurulurken zaman aşımı oluştu.",
      detail: "HTTP istemcisi hedef sunucuya TCP/TLS bağlantısını zamanında kuramadı.",
    },
    ENETUNREACH: {
      type: "NETWORK",
      message: "Hedef ağa ulaşılamıyor.",
      detail: "Sunucunun bulunduğu ağa giden rota veya ağ bağlantısı kullanılamıyor.",
    },
    EHOSTUNREACH: {
      type: "NETWORK",
      message: "Hedef sunucuya ulaşılamıyor.",
      detail: "Ağ mevcut olsa da hedef host erişilebilir değil.",
    },
    CERT_HAS_EXPIRED: {
      type: "TLS",
      message: "SSL/TLS sertifikasının süresi dolmuş.",
      detail: "HTTPS sertifikası yenilenmeli.",
    },
    ERR_TLS_CERT_ALTNAME_INVALID: {
      type: "TLS",
      message: "SSL/TLS sertifikası alan adıyla eşleşmiyor.",
      detail: "Sertifikanın SAN/CN alanları izlenen hostname ile uyuşmuyor.",
    },
    DEPTH_ZERO_SELF_SIGNED_CERT: {
      type: "TLS",
      message: "Kendinden imzalı SSL/TLS sertifikası güvenilir bulunmadı.",
      detail: "Sertifika zinciri güvenilir bir kök sertifika otoritesine dayanmıyor.",
    },
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: {
      type: "TLS",
      message: "SSL/TLS sertifika zinciri doğrulanamadı.",
      detail: "Ara sertifika veya sertifika zinciri eksik/hatalı olabilir.",
    },
  };

  const match = known[code];
  if (match) {
    return {
      errorType: match.type,
      errorCode: code,
      error: match.message,
      errorDetail: `${match.detail} Teknik detay: ${rawDetail}`.slice(0, 700),
    };
  }

  return {
    errorType: "NETWORK",
    errorCode: code || "FETCH_ERROR",
    error: "Bağlantı sırasında beklenmeyen bir ağ hatası oluştu.",
    errorDetail: rawDetail,
  };
}

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
  const started = performance.now();

  try {
    const url = await validateMonitorUrl(input);
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: "follow",
      headers: { "User-Agent": "Pulse-Uptime-Monitor/1.0", Accept: "*/*" },
      cache: "no-store",
    });

    const responseTime = Math.round(performance.now() - started);
    const body = (await response.text()).slice(0, 2000);
    const latencyStatus = classifyLatency(responseTime);
    const httpError = response.ok ? null : describeHttpError(response.status, response.statusText);

    return {
      success: response.ok,
      statusCode: response.status,
      responseTime,
      latencyStatus,
      response: body,
      errorType: httpError?.errorType ?? null,
      errorCode: httpError?.errorCode ?? null,
      error: httpError?.error ?? null,
      errorDetail: httpError?.errorDetail ?? null,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const responseTime = Math.round(performance.now() - started);
    const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");

    if (isTimeout) {
      return {
        success: false,
        statusCode: null,
        responseTime,
        latencyStatus: "timeout" as LatencyStatus,
        response: "",
        errorType: "TIMEOUT",
        errorCode: "REQUEST_TIMEOUT",
        error: "İstek 20 saniye içinde yanıt vermedi.",
        errorDetail: "Servis yoğun, kilitli veya ağ bağlantısı çok yavaş olabilir. 20 saniyelik sağlık kontrolü süresinde tamamlanmış bir HTTP yanıtı alınamadı.",
        timestamp: new Date().toISOString(),
      };
    }

    const diagnostic = describeNetworkError(error);
    return {
      success: false,
      statusCode: null,
      responseTime,
      latencyStatus: "error" as LatencyStatus,
      response: "",
      ...diagnostic,
      timestamp: new Date().toISOString(),
    };
  }
}
