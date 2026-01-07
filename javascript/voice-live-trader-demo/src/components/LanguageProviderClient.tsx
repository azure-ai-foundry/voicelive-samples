"use client";

import { LanguageProvider } from "@/lib/i18n";

export function LanguageProviderClient({ children }: { children: React.ReactNode }) {
  return <LanguageProvider initialLang="zh">{children}</LanguageProvider>;
}
