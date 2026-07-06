import { clsx, type ClassValue } from "clsx";

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export function formatRelativeDate(value: string | null) {
  if (!value) return "Henüz kontrol edilmedi";
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}

export const formatDuration = (seconds: number | null) => {
  if (seconds == null) return "Devam ediyor";
  if (seconds < 60) return `${seconds} sn`;
  return `${Math.round(seconds / 60)} dk`;
};
