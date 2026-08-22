"use client";

import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Service } from "@/types";

export function MonitoringSettings({ service, onSaved }: { service: Service; onSaved: () => Promise<void> }) {
  const [dnsEnabled, setDnsEnabled] = useState(false);
  const [dnsAffectsStatus, setDnsAffectsStatus] = useState(false);
  const [expectedDns, setExpectedDns] = useState("");
  const [sslEnabled, setSslEnabled] = useState(false);
  const [sslAffectsStatus, setSslAffectsStatus] = useState(false);
  const [sslWarnDays, setSslWarnDays] = useState(14);
  const [locationsEnabled, setLocationsEnabled] = useState(false);
  const [locationsAffectStatus, setLocationsAffectStatus] = useState(true);
  const [includePrimary, setIncludePrimary] = useState(true);
  const [minimumLocations, setMinimumLocations] = useState(1);
  const [probeText, setProbeText] = useState("");
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [notifyDown, setNotifyDown] = useState(true);
  const [notifyRecovery, setNotifyRecovery] = useState(true);
  const [notifyDns, setNotifyDns] = useState(true);
  const [notifySsl, setNotifySsl] = useState(true);
  const [notifyLocation, setNotifyLocation] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setDnsEnabled(service.dnsMonitoring?.enabled === true);
    setDnsAffectsStatus(service.dnsMonitoring?.affectsStatus === true);
    setExpectedDns((service.dnsMonitoring?.expectedAddresses ?? []).join(", "));
    setSslEnabled(service.sslMonitoring?.enabled === true);
    setSslAffectsStatus(service.sslMonitoring?.affectsStatus === true);
    setSslWarnDays(service.sslMonitoring?.warnDays ?? 14);
    setLocationsEnabled(service.multiLocationMonitoring?.enabled === true);
    setLocationsAffectStatus(service.multiLocationMonitoring?.affectsStatus !== false);
    setIncludePrimary(service.multiLocationMonitoring?.includePrimaryLocation !== false);
    setMinimumLocations(service.multiLocationMonitoring?.minimumSuccessfulLocations ?? 1);
    setProbeText((service.multiLocationMonitoring?.probes ?? []).map(p => `${p.name}|${p.url}`).join("\n"));
    setTelegramEnabled(service.telegram?.enabled !== false);
    setNotifyDown(service.telegram?.notifyOnDown !== false);
    setNotifyRecovery(service.telegram?.notifyOnRecovery !== false);
    setNotifyDns(service.telegram?.notifyOnDns !== false);
    setNotifySsl(service.telegram?.notifyOnSsl !== false);
    setNotifyLocation(service.telegram?.notifyOnLocation !== false);
  }, [service]);

  const probes = useMemo(() => probeText.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
    const [namePart, urlPart] = line.includes("|") ? line.split("|", 2) : [`Probe ${index + 1}`, line];
    return {
      id: `probe-${index + 1}`,
      name: namePart.trim() || `Probe ${index + 1}`,
      url: (urlPart ?? "").trim(),
      enabled: true,
    };
  }), [probeText]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/services/${encodeURIComponent(service.id)}/monitoring`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dnsMonitoring: {
            enabled: dnsEnabled,
            affectsStatus: dnsAffectsStatus,
            expectedAddresses: expectedDns.split(",").map(x => x.trim()).filter(Boolean),
            requireAllExpected: false,
          },
          sslMonitoring: {
            enabled: sslEnabled,
            affectsStatus: sslAffectsStatus,
            warnDays: sslWarnDays,
          },
          multiLocationMonitoring: {
            enabled: locationsEnabled,
            affectsStatus: locationsAffectStatus,
            includePrimaryLocation: includePrimary,
            minimumSuccessfulLocations: minimumLocations,
            probes,
          },
          telegram: {
            enabled: telegramEnabled,
            notifyOnDown: notifyDown,
            notifyOnRecovery: notifyRecovery,
            notifyOnDns: notifyDns,
            notifyOnSsl: notifySsl,
            notifyOnLocation: notifyLocation,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ayarlar kaydedilemedi.");
      await onSaved();
      setMessage({ ok: true, text: "İzleme ayarları kaydedildi." });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Ayarlar kaydedilemedi." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card mt-5 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold">İzleme Ayarları</h2>
          <p className="mt-1 text-xs text-slate-400">DNS, SSL, konum ve Telegram kontrolleri servis bazında açılıp kapatılır.</p>
        </div>
        <button onClick={() => void save()} disabled={saving} className="btn-secondary self-start">
          <Save className="size-4" />{saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>

      {message && <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"}`}>{message.text}</div>}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ConfigCard title="DNS Monitoring" status={service.dnsStatus}>
          <Toggle label="DNS kontrolü" checked={dnsEnabled} onChange={setDnsEnabled} />
          <Toggle label="DNS hatası servisi DOWN yapsın" checked={dnsAffectsStatus} onChange={setDnsAffectsStatus} disabled={!dnsEnabled} />
          <Field label="Beklenen IP adresleri (opsiyonel, virgülle)" value={expectedDns} onChange={setExpectedDns} disabled={!dnsEnabled} placeholder="1.2.3.4, 5.6.7.8" />
        </ConfigCard>

        <ConfigCard title="SSL Monitoring" status={service.sslStatus} extra={service.sslDaysRemaining != null ? `${service.sslDaysRemaining} gün kaldı` : undefined}>
          <Toggle label="SSL sertifika kontrolü" checked={sslEnabled} onChange={setSslEnabled} />
          <Toggle label="SSL hatası servisi DOWN yapsın" checked={sslAffectsStatus} onChange={setSslAffectsStatus} disabled={!sslEnabled} />
          <NumberField label="Kaç gün kala uyar" value={sslWarnDays} onChange={setSslWarnDays} disabled={!sslEnabled} min={1} max={90} />
        </ConfigCard>

        <ConfigCard title="Multi-location Monitoring" status={service.locationStatus}>
          <Toggle label="Multi-location aktif" checked={locationsEnabled} onChange={setLocationsEnabled} />
          <Toggle label="Vercel Primary sonucu dahil" checked={includePrimary} onChange={setIncludePrimary} disabled={!locationsEnabled} />
          <Toggle label="Konum problemi servisi DOWN yapsın" checked={locationsAffectStatus} onChange={setLocationsAffectStatus} disabled={!locationsEnabled || !includePrimary} />
          <NumberField label="Minimum başarılı konum" value={minimumLocations} onChange={setMinimumLocations} disabled={!locationsEnabled} min={1} max={11} />
          <label className="block text-xs text-slate-500">
            <span className="mb-1 block font-medium">Probe'lar — her satır: İsim|HTTPS URL</span>
            <textarea value={probeText} onChange={e => setProbeText(e.target.value)} disabled={!locationsEnabled} rows={4} className="input min-h-24 w-full font-mono text-xs" placeholder={'Europe|https://eu-probe.example.com/api/probe\nTurkey|https://tr-probe.example.com/api/probe'} />
          </label>
          {!includePrimary && locationsEnabled && <p className="text-[11px] text-amber-600 dark:text-amber-400">Vercel/ABD kontrolü ana duruma dahil edilmez; yalnız seçili probe'lar değerlendirilir.</p>}
        </ConfigCard>

        <ConfigCard title="Telegram Bildirimleri">
          <Toggle label="Telegram aktif" checked={telegramEnabled} onChange={setTelegramEnabled} />
          <Toggle label="DOWN bildirimi" checked={notifyDown} onChange={setNotifyDown} disabled={!telegramEnabled} />
          <Toggle label="Recovery bildirimi" checked={notifyRecovery} onChange={setNotifyRecovery} disabled={!telegramEnabled} />
          <Toggle label="DNS bildirimi" checked={notifyDns} onChange={setNotifyDns} disabled={!telegramEnabled} />
          <Toggle label="SSL bildirimi" checked={notifySsl} onChange={setNotifySsl} disabled={!telegramEnabled} />
          <Toggle label="Konum bildirimi" checked={notifyLocation} onChange={setNotifyLocation} disabled={!telegramEnabled} />
        </ConfigCard>
      </div>
    </section>
  );
}

function ConfigCard({ title, status, extra, children }: { title: string; status?: string; extra?: string; children: React.ReactNode }) {
  const tone = status === "ok" ? "text-emerald-600" : status === "warning" ? "text-amber-500" : status === "error" ? "text-rose-500" : "text-slate-400";
  return <div className="rounded-2xl border p-4 dark:border-slate-700"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-bold">{title}</h3>{status && <span className={`text-[11px] font-bold uppercase ${tone}`}>{status}{extra ? ` · ${extra}` : ""}</span>}</div><div className="space-y-3">{children}</div></div>;
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <label className={`flex items-center justify-between gap-3 text-sm ${disabled ? "opacity-50" : ""}`}><span>{label}</span><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} className="size-4 accent-indigo-500" /></label>;
}

function Field({ label, value, onChange, disabled, placeholder }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; placeholder?: string }) {
  return <label className="block text-xs text-slate-500"><span className="mb-1 block font-medium">{label}</span><input value={value} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} className="input w-full text-sm" /></label>;
}

function NumberField({ label, value, onChange, disabled, min, max }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean; min: number; max: number }) {
  return <label className="block text-xs text-slate-500"><span className="mb-1 block font-medium">{label}</span><input type="number" value={value} onChange={e => onChange(Number(e.target.value))} disabled={disabled} min={min} max={max} className="input w-full text-sm" /></label>;
}
