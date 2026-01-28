import { MetadataRoute } from "next";
import { getProductionUrl } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getProductionUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard/",
          "/onboarding/",
          "/auth/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
