import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Émargement — CFRP Valentin Haüy",
  description: "Suivi de présence et émargement des stagiaires du CFRP Valentin Haüy",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${atkinson.variable} h-full`} suppressHydrationWarning>
      {/* Browser extensions add attributes to <body> before React hydrates. */}
      <body className="flex min-h-full flex-col bg-surface text-on-surface font-sans antialiased selection:bg-focus-outer selection:text-navy-deep" suppressHydrationWarning>
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
        </div>
        <AccessibleAnnouncer>
          <AccessibilityProvider>
            <AuthProvider>
              <AppHeader />
              <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-[1440px] flex-1 px-4 sm:px-6 lg:px-8 py-6 outline-none">
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
