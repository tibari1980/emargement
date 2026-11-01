"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Compass,
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
import { NotificationBell } from "./notifications/NotificationBell";

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
  const [desktopNavCollapsed, setDesktopNavCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const items = profile && isActive(profile) ? navFor(profile.role) : [];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile menu on page navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

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
    setMobileMenuOpen(false);
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

  // Active item for mobile breadcrumb bar
  const activeItem =
    items.find(
      (item) =>
        pathname === item.href ||
        (item.permission === "attendance.record" && Boolean(pathname?.endsWith("/emargement")))
    ) ??
    (pathname === "/profile"
      ? { label: "Mon profil", href: "/profile" }
      : pathname?.startsWith("/guide")
        ? { label: "Guide d'utilisation", href: "/guide" }
        : null);

  return (
    <header className="sticky top-0 z-40 w-full max-w-[100vw] border-b border-border-subtle bg-surface-container-lowest/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col justify-between px-3 sm:px-6 lg:px-8 pt-1 sm:pt-2">
        {/* Top Row: Brand + Quick Actions */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 py-1.5 sm:py-2 min-w-0">
          {/* Institutional Brand */}
          <div className="flex items-center min-w-0 flex-1">
            <Link
              href="/"
              className={`inline-flex items-center gap-2 sm:gap-3 rounded-xl p-1 text-primary min-w-0 max-w-full ${focusRing}`}
              aria-label="Accueil émargement CFRP Valentin Haüy — Retour à la page d'accueil"
            >
              <span className="sm:hidden shrink-0">
                <BrandLogoEye size="sm" />
              </span>
              <span className="hidden sm:inline-flex shrink-0">
                <BrandLogoEye size="md" />
              </span>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span className="text-sm sm:text-base lg:text-lg font-bold text-primary tracking-tight truncate">
                    <span className="hidden lg:inline">ESRP / </span>CFRP Valentin Haüy
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-status-present-bg text-status-present text-[11px] font-bold shrink-0">
                    <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-status-present animate-pulse" aria-hidden="true"></span>
                    <span className="hidden xl:inline">Session active</span>
                  </span>
                </div>
                <span className="text-xs text-on-surface-variant hidden lg:inline truncate">
                  Plateforme d&apos;Émargement &amp; Suivi Pédagogique Certifiée
                </span>
              </div>
            </Link>
          </div>

          {/* Quick Controls & Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <AccessibilityToolbar />

            {!profile && (
              <>
                <Link
                  href="/guide"
                  className={`hidden md:inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-secondary/30 bg-surface-container-high px-3 py-1.5 text-xs sm:text-sm font-bold text-primary hover:bg-surface-variant transition-colors ${focusRing}`}
                >
                  <BookOpen className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                  <span>Guide</span>
                </Link>
                <Link
                  href="/login"
                  className={`inline-flex min-h-10 items-center gap-1.5 sm:gap-2 rounded-xl bg-primary-container px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-on-primary shadow-xs hover:opacity-95 transition-opacity ${focusRing}`}
                  aria-label="Accéder à l'espace de connexion sécurisé"
                >
                  <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Connexion</span>
                </Link>
                {/* Mobile Hamburger for Public Pages */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-expanded={mobileMenuOpen}
                  aria-controls="mobile-nav-drawer"
                  aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu d'accès rapide"}
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

            {profile && (
              <>
                <NotificationBell />

                {/* Tablet & Desktop Profile / Guide / SignOut Controls (hidden on mobile < 768px to prevent horizontal overflow) */}
                <div className="hidden md:flex items-center gap-1.5 lg:gap-2">
                  <div className="h-6 w-px bg-border-subtle mx-0.5" aria-hidden="true" />

                  {/* Unified Profile Capsule: Avatar + Name + Role + Mon Profil */}
                  <Link
                    href="/profile"
                    className={`inline-flex min-h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface-container-high px-2.5 lg:px-3 py-1 hover:bg-surface-variant transition-colors ${focusRing}`}
                    aria-label={`Accéder à votre profil et modifier votre mot de passe (${profile.fullName} — ${ROLE_LABELS[profile.role]})`}
                    title={`${profile.fullName} (${ROLE_LABELS[profile.role]}) — Cliquez pour accéder à votre profil`}
                  >
                    <div
                      className="flex h-7 w-7 lg:h-8 lg:w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-white font-bold text-xs shadow-xs"
                      aria-hidden="true"
                    >
                      {userInitials}
                    </div>
                    <div className="text-left flex flex-col">
                      <span className="text-xs lg:text-sm font-bold text-on-surface leading-tight truncate max-w-[110px] lg:max-w-[150px]">
                        {profile.fullName}
                      </span>
                      <span className="text-[11px] text-secondary font-semibold leading-tight truncate max-w-[110px] lg:max-w-[150px]">
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
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-secondary/30 bg-surface-container-high px-2.5 lg:px-3 py-1 text-xs lg:text-sm font-bold text-primary hover:bg-surface-variant transition-colors ${focusRing}`}
                    aria-label={`Consulter le guide d'utilisation pas-à-pas pour votre espace (${ROLE_LABELS[profile.role]})`}
                    title="Consulter le guide d'utilisation pas-à-pas"
                  >
                    <BookOpen className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                    <span className="hidden lg:inline">Guide</span>
                  </Link>

                  {/* Sign Out Button */}
                  <Button
                    variant="secondary"
                    onClick={handleSignOut}
                    aria-label="Se déconnecter de votre compte"
                    title="Se déconnecter"
                    className="inline-flex !min-h-10 !px-2.5 lg:!px-3 !py-1 text-xs lg:text-sm rounded-xl items-center gap-1.5"
                  >
                    <LogOut className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden="true" />
                    <span className="hidden lg:inline">Déconnexion</span>
                  </Button>
                </div>

                {/* Mobile Menu Button (Hamburger + User Initials Badge on < 768px) */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-expanded={mobileMenuOpen}
                  aria-controls="mobile-nav-drawer"
                  aria-label={
                    mobileMenuOpen
                      ? "Fermer le menu principal"
                      : `Ouvrir le menu principal et profil (${profile.fullName})`
                  }
                  className={`inline-flex md:hidden min-h-10 items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-container-high px-2 py-1.5 text-primary hover:bg-surface-variant transition-colors ${focusRing}`}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-container text-white font-bold text-[11px]"
                    aria-hidden="true"
                  >
                    {userInitials}
                  </span>
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

        {/* Mobile Sub-Bar (< 768px): Active Module Indicator + Quick Drawer Trigger */}
        {items.length > 0 && (
          <div className="flex md:hidden items-center justify-between gap-2 py-1.5 border-t border-surface-container min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Compass className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
              <span className="text-xs font-bold text-primary truncate">
                {activeItem ? activeItem.label : "Navigation"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Ouvrir la liste complète des modules de navigation"
              className={`inline-flex items-center gap-1 rounded-lg bg-surface-container px-2.5 py-1 text-xs font-bold text-primary hover:bg-surface-variant transition-colors shrink-0 ${focusRing}`}
            >
              <span>Modules ({items.length})</span>
              <ChevronDown className="h-3.5 w-3.5 text-secondary shrink-0" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Tablet & Desktop Primary Navigation Bar (>= 768px, collapsible) */}
        {items.length > 0 && (
          <div className="hidden md:flex items-center justify-between gap-2 border-t border-surface-container py-1.5">
            {!desktopNavCollapsed ? (
              <nav
                id="menu-principal"
                aria-label="Navigation principale de l'établissement"
                tabIndex={-1}
                className="flex flex-wrap items-center gap-1 lg:gap-1.5 outline-none flex-1 min-w-0"
              >
                {items.map((item) => {
                  const current =
                    pathname === item.href ||
                    (item.permission === "attendance.record" && Boolean(pathname?.endsWith("/emargement")));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      className={`whitespace-nowrap px-3 lg:px-3.5 py-1.5 text-xs lg:text-sm rounded-xl font-semibold transition-all ${focusRing} ${
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
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant py-1">
                <Compass className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                <span>
                  Module actif : <strong className="text-primary">{activeItem?.label ?? "Tableau de bord"}</strong>
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setDesktopNavCollapsed((prev) => !prev)}
              aria-expanded={!desktopNavCollapsed}
              aria-controls="menu-principal"
              aria-label={desktopNavCollapsed ? "Déplier la barre de navigation" : "Réduire la barre de navigation"}
              title={desktopNavCollapsed ? "Déplier le menu" : "Réduire le menu"}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface-container hover:text-on-surface shrink-0 transition-colors ${focusRing}`}
            >
              {desktopNavCollapsed ? (
                <>
                  <span>Afficher le menu</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </>
              ) : (
                <>
                  <span className="hidden xl:inline">Réduire</span>
                  <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Mobile Drawer Navigation rendered in Portal so backdrop-blur on header never clips it */}
      {mounted &&
        mobileMenuOpen &&
        createPortal(
          <div
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal de navigation"
            className="fixed inset-0 z-[100] md:hidden bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200"
          >
            {/* Backdrop click area */}
            <div
              className="flex-1"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer content */}
            <div className="bg-surface-container-lowest text-on-surface rounded-t-3xl border-t-2 border-border-strong p-4 sm:p-5 max-h-[88dvh] overflow-y-auto flex flex-col gap-4 shadow-2xl animate-in slide-in-from-bottom duration-250">
              {/* Drawer Header */}
              <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-3">
                {profile ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-white font-bold text-sm">
                      {userInitials}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm sm:text-base font-bold text-primary truncate">
                        {profile.fullName}
                      </span>
                      <span className="text-xs font-semibold text-secondary truncate">
                        {ROLE_LABELS[profile.role]}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BrandLogoEye size="sm" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-primary truncate">
                        ESRP / CFRP Valentin Haüy
                      </span>
                      <span className="text-xs text-on-surface-variant truncate">
                        Navigation &amp; Accès rapide
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Fermer le menu"
                  className={`inline-flex min-h-10 min-w-10 items-center justify-center p-2 rounded-xl border border-border-subtle text-on-surface hover:bg-surface-container shrink-0 ${focusRing}`}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {/* Role-categorized links when authenticated */}
              {profile && items.length > 0 && (
                <div className="flex flex-col gap-4">
                  {Object.entries(groupedItems).map(([cat, catItems]) => (
                    <div key={cat} className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-secondary px-1">
                        {CATEGORY_LABELS[cat as ModuleCategory] || cat}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {catItems.map((item) => {
                          const current =
                            pathname === item.href ||
                            (item.permission === "attendance.record" && Boolean(pathname?.endsWith("/emargement")));
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              aria-current={current ? "page" : undefined}
                              className={`flex items-center justify-between p-3 rounded-xl border text-sm font-semibold transition-colors ${focusRing} ${
                                current
                                  ? "bg-primary-container text-on-primary border-primary font-bold shadow-xs"
                                  : "bg-surface-container-low text-on-surface border-border-subtle hover:bg-surface-container"
                              }`}
                            >
                              <span className="truncate">{item.label}</span>
                              <span className="text-xs opacity-80 shrink-0 ml-2" aria-hidden="true">
                                →
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Drawer Footer Actions */}
              <div className="border-t border-border-subtle pt-3 flex flex-col gap-2">
                {profile ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Link
                        href="/profile"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`w-full min-h-11 justify-center inline-flex items-center gap-2 rounded-xl text-sm font-bold bg-surface-container-low text-primary border border-border-subtle p-3 hover:bg-surface-container transition-colors ${focusRing}`}
                      >
                        <User className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                        <span>Mon profil &amp; Mot de passe</span>
                      </Link>
                      <Link
                        href={`/guide?role=${profile.role}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`w-full min-h-11 justify-center inline-flex items-center gap-2 rounded-xl text-sm font-bold bg-surface-container-high text-primary border border-secondary/30 p-3 hover:bg-surface-container transition-colors ${focusRing}`}
                      >
                        <BookOpen className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                        <span>Guide pas-à-pas</span>
                      </Link>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={handleSignOut}
                      className="w-full !min-h-11 justify-center inline-flex items-center gap-2 rounded-xl text-sm font-bold text-status-absent"
                    >
                      <LogOut className="h-4 w-4 shrink-0 text-status-absent" aria-hidden="true" />
                      <span>Se déconnecter</span>
                    </Button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`w-full min-h-11 justify-center inline-flex items-center gap-2 rounded-xl text-sm font-bold bg-primary-container text-on-primary p-3 shadow-xs ${focusRing}`}
                    >
                      <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Se connecter à la plateforme</span>
                    </Link>
                    <Link
                      href="/guide"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`w-full min-h-11 justify-center inline-flex items-center gap-2 rounded-xl text-sm font-bold bg-surface-container-high text-primary border border-border-subtle p-3 ${focusRing}`}
                    >
                      <BookOpen className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                      <span>Consulter le guide d&apos;utilisation</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}
