/**
 * 404 Not Found Page
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("notFound");
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center px-4">
        {/* Large 404 text */}
        <h1 className="text-[150px] font-bold text-primary/10 leading-none select-none">
          404
        </h1>

        {/* Message */}
        <div className="-mt-8 relative z-10">
          <h2 className="text-2xl font-bold mb-2">{t("title")}</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            {t("description")}
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4" />
              {t("goBack")}
            </Button>
            <Button asChild className="gap-2">
              <Link href="/">
                <Home className="w-4 h-4" />
                {t("home")}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
