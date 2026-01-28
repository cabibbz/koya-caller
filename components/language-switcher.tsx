"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import { useLocale } from "next-intl";
import { Globe, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

const languages = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
];

export function LanguageSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const currentLocale = useLocale();
  const [locale, setLocale] = useState(currentLocale);

  // Sync local state with actual locale when it changes
  useEffect(() => {
    setLocale(currentLocale);
  }, [currentLocale]);

  const handleLocaleChange = async (newLocale: string) => {
    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: newLocale }),
      });

      if (response.ok) {
        setLocale(newLocale);
        startTransition(() => {
          router.refresh();
        });
      }
    } catch {
      // Silently fail - locale will remain unchanged
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <Globe className="h-4 w-4 text-muted-foreground" />
      )}
      <Select value={locale} onValueChange={handleLocaleChange}>
        <SelectTrigger className="w-[110px] h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {languages.map((language) => (
            <SelectItem key={language.code} value={language.code}>
              <span className="flex items-center gap-2">
                <span>{language.flag}</span>
                <span>{language.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
