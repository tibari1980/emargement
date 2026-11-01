import Link from "next/link";
import { Button, focusRing } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <PageHeader
        title="Page introuvable (Erreur 404)"
        description="La page que vous recherchez n'existe pas ou a été déplacée."
      />
      <div className="mt-6 rounded-2xl border-2 border-border-subtle bg-surface-container-lowest p-4 sm:p-6 shadow-sm">
        <p className="text-base sm:text-lg text-on-surface">
          Vérifiez l&apos;adresse saisie ou utilisez l&apos;un des liens ci-dessous pour poursuivre votre navigation.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4">
          <Link href="/" className={`flex sm:inline-flex ${focusRing} rounded-xl`}>
            <Button className="w-full sm:w-auto">Retourner à l&apos;accueil</Button>
          </Link>
          <Link href="/trainer/emargement" className={`flex sm:inline-flex ${focusRing} rounded-xl`}>
            <Button variant="secondary" className="w-full sm:w-auto">Aller à l&apos;émargement</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
