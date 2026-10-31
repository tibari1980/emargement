"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  LogIn,
  LogOut,
  Menu,
  User,
  X,
} from "lucide-react";
import { navFor, type ModuleCategory } from "@/lib/core/navigation";
import { isActive } from "@/lib/data/users";
import { ROLE_LABELS } from "@/lib/domain/types";
import { AccessibilityToolbar } from "./AccessibilityToolbar";
import { useAuth } from "./AuthProvider";
import { BrandLogoEye } from "./BrandLogoEye";
import { Button, focusRing } from "./ui/Button";

const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  trainer: "Espace Formateur",
  pedagogical: "Espace Pédagogique",
  secretary: "Espace Secrétariat",
  admin: "Administration",
  shared: "Modules Partagés",
};

export function AppHeader() {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const items = profile && isActive(profile) ? navFor(profile.role) : [];

  // Close mobile menu on page navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  const userInitials = profile?.fullName
    ? profile.fullName
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "VH";

  // Group items by category for the mobile menu
  const groupedItems = items.reduce<Record<string, typeof items>>((acc, item) => {
    const cat = item.category || "shared";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface-container-lowest/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex max-w-[1440px] flex-col justify-between px-3 sm:px-6 lg:px-8 pt-1.5 sm:pt-2">
        <div className="flex items-center justify-between gap-2 sm:gap-4 py-2">
          {/* Institutional Brand */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/"
              className={`flex items-center gap-2 sm:gap-3 rounded-xl p-1 text-primary ${focusRing}`}
              aria-label="Accueil émargement CFRP Valentin Haüy — Retour à la page d'accueil"
            >
              <BrandLogoEye size="md" />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-lg font-bold text-primary tracking-tight">
                    <span className="hidden sm:inline">ESRP / </span>CFRP Valentin Haüy
                  </span>
                  <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full bg-status-present-bg text-status-present text-[11px] sm:text-xs font-bold">
                    <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-status-present animate-pulse" aria-hidden="true"></span>
                    <span className="hidden xs:inline">Session active</span>
                  </span>
                </div>
                <span className="text-xs text-on-surface-variant hidden md:inline">
                  Plateforme d&apos;Émargement &amp; Suivi Pédagogique Certifiée
                </span>
              </div>
            </Link>
          </div>

          {/* Quick Controls & Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <AccessibilityToolbar />

            {!profile && (
              <Link
                href="/login"
                className={`inline-flex min-h-10 items-center gap-1.5 sm:gap-2 rounded-xl bg-primary-container px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-on-primary shadow-xs hover:opacity-95 transition-opacity ${focusRing}`}
                aria-label="Accéder à l'espace de connexion sécurisé"
              >
                <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Connexion</span>
              </Link>
            )}

            {profile && (
              <>
                <div className="h-6 w-px bg-border-subtle hidden sm:block mx-1" aria-hidden="true" />

                <div className="flex items-center gap-2">
                  {/* Unified Profile Capsule: Avatar + Name + Role + Mon Profil */}
                  <Link
                    href="/profile"
                    className={`inline-flex min-h-10 items-center gap-2 sm:gap-2.5 rounded-xl border border-border-subtle bg-surface-container-high px-2.5 sm:px-3 py-1 hover:bg-surface-variant transition-colors ${focusRing}`}
                    aria-label={`Accéder à votre profil et modifier votre mot de passe (${profile.fullName} — ${ROLE_LABELS[profile.role]})`}
                    title={`${profile.fullName} (${ROLE_LABELS[profile.role]}) — Cliquez pour accéder à votre profil et modifier votre mot de passe`}
                  >
                    <div
                      className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-white font-bold text-xs shadow-xs"
                      aria-hidden="true"
                    >
                      {userInitials}
                    </div>
                    <div className="text-left hidden md:flex flex-col">
                      <span className="text-xs sm:text-sm font-bold text-on-surface leading-tight truncate max-w-[150px]">
                        {profile.fullName}
                      </span>
                      <span className="text-[11px] text-secondary font-semibold leading-tight">
                        {ROLE_LABELS[profile.role]}
                      </span>
                    </div>
                    <span className="hidden xl:inline-flex items-center gap-1 text-xs font-bold text-primary pl-2 border-l border-border-subtle">
                      <User className="h-3.5 w-3.5 text-secondary shrink-0" aria-hidden="true" />
                      <span>Mon profil</span>
                    </span>
                  </Link>

                  {/* Guide d'utilisation */}
                  <Link
                    href={`/guide?role=${profile.role}`}
                    className={`inline-flex min-h-10 items-center gap-1.5 sm:gap-2 rounded-xl border border-secondary/30 bg-surface-container-high px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-bold text-primary hover:bg-surface-variant transition-colors ${focusRing}`}
                    aria-label={`Consulter le guide d'utilisation pas-à-pas pour votre espace (${ROLE_LABELS[profile.role]})`}
                    title="Consulter le guide d'utilisation pas-à-pas"
                  >
                    <BookOpen className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                    <span className="hidden sm:inline">Guide</span>
                  </Link>

                  {/* Sign Out Button */}
                  <Button
                    variant="secondary"
                    onClick={handleSignOut}
                    aria-label="Se déconnecter de votre compte"
                    className="!min-h-10 !px-3 !py-1 text-xs sm:text-sm rounded-xl inline-flex items-center gap-1.5 hidden sm:inline-flex"
                  >
                    <LogOut className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden="true" />
                    <span>Déconnexion</span>
                  </Button>
                </div>

                {/* Mobile Menu Button (Hamburger) */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-expanded={mobileMenuOpen}
                  aria-controls="mobile-nav-drawer"
                  aria-label={mobileMenuOpen ? "Fermer le menu de navigation" : "Ouvrir le menu de navigation"}
                  className={`inline-flex md:hidden min-h-10 min-w-10 items-center justify-center rounded-xl border border-border-subtle bg-surface-container p-2 text-primary hover:bg-surface-variant transition-colors ${focusRing}`}
                >
                  {mobileMenuOpen ? (
                    <X className="h-5 w-5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Menu className="h-5 w-5 shrink-0" aria-hidden="true" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Primary Navigation Bar (Flex-wrap to prevent truncation on all displays) */}
        {items.length > 0 && (
          <nav
            id="menu-principal"
            aria-label="Navigation principale de l'établissement"
            tabIndex={-1}
            className="flex flex-wrap items-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 border-t border-surface-container outline-none"
          >
            {items.map((item) => {
              const current = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={`whitespace-nowrap px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm rounded-xl font-semibold transition-all ${focusRing} ${
                    current
                      ? "bg-primary-container text-on-primary font-bold shadow-xs"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {/* Mobile Drawer Navigation (Slide-over for phones and tablets) */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Menu principal de navigation"
          className="fixed inset-0 z-50 md:hidden bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200"
        >
          {/* Backdrop click area */}
          <div
            className="flex-1"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="bg-surface-container-lowest rounded-t-3xl border-t-2 border-border-strong p-5 max-h-[85vh] overflow-y-auto flex flex-col gap-5 shadow-2xl animate-in slide-in-from-bottom duration-300">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-white font-bold text-sm">
                  {userInitials}
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-bold text-primary">{profile?.fullName}</span>
                  <span className="text-xs text-on-surface-variant">{profile ? ROLE_LABELS[profile.role] : ""}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fermer le menu"
                className={`p-2 rounded-xl text-on-surface-variant hover:bg-surface-container ${focusRing}`}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Role-categorized links */}
            <div className="flex flex-col gap-4">
              {Object.entries(groupedItems).map(([cat, catItems]) => (
                <div key={cat} className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-secondary px-2">
                    {CATEGORY_LABELS[cat as ModuleCategory] || cat}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {catItems.map((item) => {
                      const current = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          aria-current={current ? "page" : undefined}
                          className={`flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-colors ${focusRing} ${
                            current
                              ? "bg-primary-container text-on-primary font-bold shadow-xs"
                              : "bg-surface-container-low text-on-surface hover:bg-surface-container"
                          }`}
                        >
                          <span>{item.label}</span>
                          <span className="text-xs opacity-70" aria-hidden="true">→</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Drawer Footer Actions */}
            <div className="border-t border-border-subtle pt-4 flex flex-col gap-2">
              <Link
                href={profile?.role ? `/guide?role=${profile.role}` : "/guide"}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full !min-h-11 justify-center inline-flex items-center gap-2 rounded-xl text-sm font-bold bg-surface-container-high text-primary border border-secondary/30 p-3 hover:bg-surface-container transition-colors"
              >
                <BookOpen className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                <span>Guide d&apos;utilisation pas-à-pas</span>
              </Link>
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full !min-h-11 justify-center inline-flex items-center gap-2 rounded-xl text-sm font-bold bg-surface-container-low text-primary border border-border-subtle p-3 hover:bg-surface-container transition-colors"
              >
                <User className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                <span>Mon profil &amp; Mot de passe</span>
              </Link>
              <Button
                variant="secondary"
                onClick={handleSignOut}
                className="w-full !min-h-11 justify-center inline-flex items-center gap-2 rounded-xl text-sm font-bold text-status-absent"
              >
                <LogOut className="h-4 w-4 shrink-0 text-status-absent" aria-hidden="true" />
                <span>Se déconnecter</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
