"use client";

import { ThemeProvider } from "next-themes";
import { ServiceProvider } from "@/components/service-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ServiceProvider>
        {children}
      </ServiceProvider>
    </ThemeProvider>
  );
}
