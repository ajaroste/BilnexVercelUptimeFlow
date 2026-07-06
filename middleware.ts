import { NextRequest, NextResponse } from "next/server";

// ── Rate limiter (in-memory, per IP) ────────────────────────────────────────
// Not: Vercel'de her function instance bağımsız çalışır.
// Production için Upstash Redis önerilir; bu kod local + tek instance için idealdir.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMITS: Record<string, { requests: number; windowMs: number }> = {
  "/api/cron/check":  { requests: 5,   windowMs: 60_000 },  // 5 istek / dakika
  "/api/status-data": { requests: 30,  windowMs: 60_000 },  // 30 istek / dakika
  "/api/":            { requests: 60,  windowMs: 60_000 },  // Genel API limiti
};

function getLimit(pathname: string) {
  for (const [prefix, limit] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) return limit;
  }
  return null;
}

function checkRateLimit(ip: string, pathname: string): { allowed: boolean; remaining: number; resetAt: number } {
  const limit = getLimit(pathname);
  if (!limit) return { allowed: true, remaining: 999, resetAt: 0 };

  const key = `${ip}:${pathname.split("?")[0]}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { allowed: true, remaining: limit.requests - 1, resetAt: now + limit.windowMs };
  }

  entry.count++;
  const remaining = Math.max(0, limit.requests - entry.count);
  return { allowed: entry.count <= limit.requests, remaining, resetAt: entry.resetAt };
}

// ── Temizlik: 1000'den fazla kayıt birikirse eski olanları sil ──────────────
function pruneStore() {
  if (rateLimitStore.size < 1000) return;
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}

// ── Şüpheli User-Agent'ları engelle ─────────────────────────────────────────
const BLOCKED_UA_PATTERNS = [
  /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /zgrab/i,
  /python-requests\/[0-1]\./i,  // eski python requests
  /curl\/[0-6]\./i,             // eski curl (isteğe bağlı, devre dışı bırakabilirsiniz)
  /nuclei/i, /go-http-client\/1\./i,
];

function isSuspiciousUA(ua: string | null): boolean {
  if (!ua) return false;
  return BLOCKED_UA_PATTERNS.some(p => p.test(ua));
}

// ── Security Headers ─────────────────────────────────────────────────────────
function addSecurityHeaders(res: NextResponse): NextResponse {
  // Clickjacking engelle
  res.headers.set("X-Frame-Options", "DENY");
  // MIME sniffing engelle
  res.headers.set("X-Content-Type-Options", "nosniff");
  // Referrer bilgisi sınırla
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // XSS koruması (modern tarayıcılarda CSP ile birleşir)
  res.headers.set("X-XSS-Protection", "1; mode=block");
  // HSTS (HTTPS zorunlu kıl)
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  // İzinler politikası (gereksiz browser özelliklerini kapat)
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  // Content Security Policy
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",        // Firebase'e doğrudan client erişimi YOK
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  // Sunucu bilgisini gizle
  res.headers.delete("X-Powered-By");
  res.headers.set("Server", "");
  return res;
}

// ── IP alma (Vercel + genel) ──────────────────────────────────────────────────
function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// ── Middleware ───────────────────────────────────────────────────────────────
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = getIP(req);
  const ua = req.headers.get("user-agent");

  // 1. Şüpheli User-Agent engelle (API rotalarında)
  if (pathname.startsWith("/api/") && isSuspiciousUA(ua)) {
    return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Rate limiting
  pruneStore();
  if (pathname.startsWith("/api/")) {
    const { allowed, remaining, resetAt } = checkRateLimit(ip, pathname);
    if (!allowed) {
      const res = new NextResponse(
        JSON.stringify({ error: "Çok fazla istek. Lütfen bekleyin.", retryAfter: Math.ceil((resetAt - Date.now()) / 1000) }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
      res.headers.set("Retry-After", String(Math.ceil((resetAt - Date.now()) / 1000)));
      res.headers.set("X-RateLimit-Remaining", "0");
      return addSecurityHeaders(res);
    }
    const res = NextResponse.next();
    res.headers.set("X-RateLimit-Remaining", String(remaining));
    return addSecurityHeaders(res);
  }

  // 3. Diğer sayfalar için sadece security headers
  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    // API rotaları
    "/api/:path*",
    // Statik dosyalar ve _next hariç tüm sayfalar
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
