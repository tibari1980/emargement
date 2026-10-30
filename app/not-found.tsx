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
      <div className="mt-6 rounded-lg border-2 border-gray-300 bg-white p-6 shadow-sm">
        <p className="text-lg text-gray-800">
          Vérifiez l&apos;adresse saisie ou utilisez l&apos;un des liens ci-dessous pour poursuivre votre navigation.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link href="/" className={`inline-flex ${focusRing} rounded-md`}>
            <Button>Retourner à l&apos;accueil</Button>
          </Link>
          <Link href="/trainer/emargement" className={`inline-flex ${focusRing} rounded-md`}>
            <Button variant="secondary">Aller à l&apos;émargement</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
