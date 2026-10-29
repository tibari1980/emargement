"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { navFor } from "@/lib/core/navigation";
import { isActive } from "@/lib/data/users";
import { ROLE_LABELS } from "@/lib/domain/types";
import { useAuth } from "./AuthProvider";
import { Button, focusRing } from "./ui/Button";

export function AppHeader() {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const items = profile && isActive(profile) ? navFor(profile.role) : [];

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <header className="border-b-4 border-blue-800 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className={`rounded text-xl font-bold text-blue-900 ${focusRing}`}>
          Émargement CFRP Valentin Haüy
        </Link>
        {profile && (
          <div className="flex flex-wrap items-center gap-3">
            <p>
              <span className="font-semibold">{profile.fullName}</span>
              <span className="text-gray-700"> — {ROLE_LABELS[profile.role]}</span>
            </p>
            <Button variant="secondary" onClick={handleSignOut}>
              Se déconnecter
            </Button>
          </div>
        )}
      </div>
      {items.length > 0 && (
        <nav aria-label="Menu principal" className="bg-blue-900">
          <ul className="mx-auto flex max-w-7xl flex-wrap gap-1 px-4">
            {items.map((item) => {
              const current = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={`block px-4 py-3 font-semibold text-white underline-offset-4 hover:underline ${focusRing} ${
                      current ? "bg-white !text-blue-950 underline" : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
