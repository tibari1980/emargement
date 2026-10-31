import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CFRP Valentin Haüy — Plateforme d'Émargement & Pédagogie Accessible",
    short_name: "Émargement AVH",
    description:
      "Plateforme d'émargement biométrique, badge et signature numérique certifiée RGAA 4.1 AAA pour l'ESRP / CFRP Valentin Haüy.",
    start_url: "/",
    display: "standalone",
    background_color: "#0F172A",
    theme_color: "#0F172A",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
