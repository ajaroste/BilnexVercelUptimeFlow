# Pulse — Uptime Monitoring

Next.js 15, TypeScript, Tailwind CSS, Firebase Firestore ve Vercel Cron ile hazırlanmış modern servis izleme paneli.

## Kurulum

```bash
npm install
cp .env.example .env.local
npm run dev
```

Uygulama salt okunur çalışır ve Firebase Realtime Database verilerini `/api/status-data` üzerinden gösterir. Production için `.env.example` içindeki `FIREBASE_DATABASE_URL` ve `FIREBASE_DATABASE_SECRET` değerlerini Vercel ortam değişkenlerine ekleyin. Anahtar hiçbir zaman tarayıcıya gönderilmez.

## Koleksiyonlar

- `health_endpoints`: servis tanımı, URL/IP, kontrol aralığı, durum ve performans sayaçlarının tamamı
- `health_logs`: yalnızca durum değişiklikleri (`UP_TO_DOWN`, `DOWN_TO_UP`)
- `incidents`: kesinti başlangıç/bitiş ve süre bilgisi

Bu model, her health check’i ayrı doküman olarak yazmak yerine servis dokümanındaki sayaçları atomik artırır. Böylece yazma maliyeti ve log hacmi kontrol altında kalır.

## API

- `POST /api/check` — manuel kontrol
- `GET /api/cron/check?interval=5|10` — Vercel Cron
- `GET /api/export?format=csv|json` — rapor dışa aktarma
- `GET /api/status-data` — Realtime Database salt-okunur dashboard verisi

Cron endpoint’i production ortamında `Authorization: Bearer $CRON_SECRET` bekler.
