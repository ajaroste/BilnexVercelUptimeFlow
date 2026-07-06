"use client";

import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import { useTheme } from "next-themes";
import { HealthLog } from "@/types";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export function ResponseChart({ logs, color = "#43d4ae", height = 250 }: { logs: HealthLog[]; color?: string; height?: number }) {
  const { resolvedTheme } = useTheme();
  const options: ApexOptions = {
    chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "inherit", background: "transparent" },
    colors: [color],
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 3 },
    fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0.02, stops: [0, 95] } },
    grid: { borderColor: resolvedTheme === "dark" ? "#1e293b" : "#e2e8f0", strokeDashArray: 4 },
    xaxis: { type: "datetime", labels: { style: { colors: "#94a3b8" }, datetimeUTC: false }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { colors: "#94a3b8" }, formatter: (v) => `${Math.round(v)} ms` } },
    tooltip: { theme: resolvedTheme, x: { format: "dd MMM HH:mm" }, y: { formatter: (v) => `${v} ms` } },
  };
  return <Chart type="area" height={height} width="100%" options={options} series={[{ name: "Yanıt süresi", data: logs.map(log => [new Date(log.timestamp).getTime(), log.responseTime]) }]} />;
}
