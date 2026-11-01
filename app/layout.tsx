import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import Script from "next/script";
import { AccessibleAnnouncer } from "@/components/AccessibleAnnouncer";
import { AccessibilityProvider } from "@/components/AccessibilityProvider";
import { AppFooter } from "@/components/AppFooter";
import { AppHeader } from "@/components/AppHeader";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

// Typeface designed by the Braille Institute for low-vision readers.
const atkinson = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-atkinson",
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://emargement-valentin-hauy.fr";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "ESRP / CFRP Valentin Haüy — Plateforme d'Émargement & Pédagogie Accessible",
    template: "%s | ESRP / CFRP Valentin Haüy",
  },
  description:
    "Plateforme officielle d'émargement et de suivi pédagogique du Centre de Formation et de Réadaptation Professionnelle (CFRP) Valentin Haüy. 100% accessible RGAA 4.1 niveau AAA pour les personnes aveugles et malvoyantes.",
  applicationName: "Émargement Valentin Haüy",
  authors: [
    { name: "Tibari Zeroual — Ingénieur de développement" },
    { name: "Association Valentin Haüy", url: "https://www.avh.asso.fr" },
  ],
  creator: "Tibari Zeroual — Ingénieur de développement (ESRP / CFRP Valentin Haüy)",
  publisher: "Association Valentin Haüy",
  keywords: [
    "Valentin Haüy",
    "CFRP",
    "ESRP",
    "émargement",
    "accessibilité numérique",
    "RGAA 4.1 AAA",
    "déficience visuelle",
    "aveugle",
    "malvoyant",
    "formation professionnelle",
    "assiduité",
    "Qualiopi",
    "France Travail",
    "AGEFIPH",
  ],
  alternates: {
    canonical: "/",
    languages: {
      "fr-FR": "/",
    },
  },
  openGraph: {
    title: "ESRP / CFRP Valentin Haüy — Plateforme d'Émargement & Pédagogie Accessible",
    description:
      "Suivi de présence, assiduité certifiée et suivi pédagogique adapté aux personnes déficientes visuelles, conforme RGAA 4.1 AAA.",
    url: baseUrl,
    siteName: "ESRP / CFRP Valentin Haüy",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/images/autonomie-guide-dog.jpg",
        width: 1200,
        height: 630,
        alt: "Stagiaire déficiente visuelle marchant avec son chien guide en autonomie urbaine",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ESRP / CFRP Valentin Haüy — Émargement Accessible RGAA 4.1 AAA",
    description:
      "Plateforme numérique d'émargement adaptée aux lecteurs d'écran (NVDA, JAWS, VoiceOver, Orca).",
    images: ["/images/autonomie-guide-dog.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
};

const jsonLdData = [
  {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": "Centre de Formation et de Réadaptation Professionnelle (CFRP) Valentin Haüy",
    "alternateName": "ESRP / CFRP Valentin Haüy",
    "url": baseUrl,
    "logo": `${baseUrl}/images/logo-valentin-hauy.png`,
    "description":
      "Établissement médico-social et centre de formation professionnelle qualifiante dédié à l'insertion et l'autonomie des personnes déficientes visuelles.",
    "parentOrganization": {
      "@type": "NGO",
      "name": "Association Valentin Haüy",
      "url": "https://www.avh.asso.fr",
    },
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Paris",
      "addressCountry": "FR",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Plateforme d'Émargement & Suivi Pédagogique Valentin Haüy",
    "applicationCategory": "EducationalApplication",
    "operatingSystem": "All modern web browsers",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "EUR",
    },
    "accessibilityFeature": [
      "alternativeText",
      "braille",
      "highContrastDisplay",
      "readingOrder",
      "structuralNavigation",
      "screenReader",
      "displayTransformability",
    ],
    "accessibilityControl": [
      "fullKeyboardControl",
      "fullMouseControl",
      "fullTouchControl",
      "voiceControl",
    ],
    "accessibilityHazard": ["none"],
    "accessibilityAPI": ["ARIA"],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "ESRP / CFRP Valentin Haüy — Émargement",
    "url": baseUrl,
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${atkinson.variable} h-full`} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
        />
      </head>
      {/* Browser extensions add attributes to <body> before React hydrates. */}
      <body className="flex min-h-full w-full max-w-[100vw] overflow-x-hidden flex-col bg-surface text-on-surface font-sans antialiased selection:bg-focus-outer selection:text-navy-deep" suppressHydrationWarning>
        {/* Anti-FOUC script: Immediately applies user contrast and font size before paint to eliminate white flash on F5 */}
        <Script
          id="avh-a11y-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem("avh_a11y_prefs");
                  var contrast = "standard";
                  var fontSize = "normal";
                  var spacing = "standard";
                  if (saved) {
                    var p = JSON.parse(saved);
                    if (p.contrast) contrast = p.contrast;
                    if (p.fontSize) fontSize = p.fontSize;
                    if (p.spacing) spacing = p.spacing;
                  }
                  var d = document.documentElement;
                  d.classList.add("text-size-" + fontSize);
                  if (contrast === "high-contrast") {
                    d.classList.add("contrast-high");
                    d.style.backgroundColor = "#000000";
                  } else if (contrast === "dark") {
                    d.classList.add("contrast-dark");
                    d.style.backgroundColor = "#0f172a";
                  } else {
                    d.classList.add("contrast-standard");
                  }
                  d.classList.add("spacing-" + spacing);
                } catch (e) {}
              })();
            `,
          }}
        />
        <div className="sr-only focus-within:not-sr-only focus-within:fixed focus-within:left-4 focus-within:top-4 focus-within:z-50 focus-within:flex focus-within:flex-col focus-within:gap-2">
          <a
            href="#contenu"
            className="rounded-lg border-2 border-primary bg-focus-outer px-4 py-3 font-bold text-primary shadow-xl focus:outline-none focus:ring-4 focus:ring-focus-inner"
          >
            Aller au contenu principal
          </a>
          <a
            href="#menu-principal"
            className="rounded-lg border-2 border-primary bg-focus-outer px-4 py-3 font-bold text-primary shadow-xl focus:outline-none focus:ring-4 focus:ring-focus-inner"
          >
            Aller au menu principal
          </a>
          <a
            href="#btn-accessibilite"
            className="rounded-lg border-2 border-primary bg-focus-outer px-4 py-3 font-bold text-primary shadow-xl focus:outline-none focus:ring-4 focus:ring-focus-inner"
          >
            Aller aux options d&apos;accessibilité (contrastes, taille du texte)
          </a>
        </div>
        <AccessibleAnnouncer>
          <AccessibilityProvider>
            <AuthProvider>
              <AppHeader />
              <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-[1440px] flex-1 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 outline-none overflow-x-hidden">
                {children}
              </main>
              <AppFooter />
            </AuthProvider>
          </AccessibilityProvider>
        </AccessibleAnnouncer>
      </body>
    </html>
  );
}
