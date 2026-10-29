import type { Metadata } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import { AccessibleAnnouncer } from "@/components/AccessibleAnnouncer";
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
  description: "Suivi de présence des stagiaires du CFRP Valentin Haüy",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${atkinson.variable} h-full`}>
      {/* Browser extensions add attributes to <body> before React hydrates. */}
      <body className="flex min-h-full flex-col bg-gray-50 text-gray-950" suppressHydrationWarning>
        <a
          href="#contenu"
          className="sr-only z-50 bg-amber-300 px-4 py-3 font-bold text-black focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
        >
          Aller au contenu principal
        </a>
        <AccessibleAnnouncer>
          <AuthProvider>
            <AppHeader />
            <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 outline-none">
              {children}
            </main>
          </AuthProvider>
        </AccessibleAnnouncer>
      </body>
    </html>
  );
}
