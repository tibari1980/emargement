import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://emargement-valentin-hauy.fr";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/acces-refuse", "/politique-confidentialite"],
        disallow: ["/admin/", "/pedagogical/", "/secretary/", "/trainer/", "/planning/", "/api/", "/profile/"],
      },
      {
        userAgent: "Googlebot",
        allow: ["/", "/login", "/acces-refuse", "/politique-confidentialite"],
        disallow: ["/admin/", "/pedagogical/", "/secretary/", "/trainer/", "/planning/", "/api/", "/profile/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
