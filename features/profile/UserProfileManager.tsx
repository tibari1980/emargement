"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Phone,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PasswordField, TextField } from "@/components/ui/Field";
import { accountErrorMessage, changeUserPassword } from "@/lib/data/accounts";
import type { Actor } from "@/lib/data/audit";
import { homeFor } from "@/lib/core/navigation";
import { validatePassword } from "@/lib/security/password";
import {
  getUserProfile,
  sendUserPasswordReset,
  updateOwnProfile,
} from "@/lib/data/users";
import { ROLE_LABELS, type UserProfile } from "@/lib/domain/types";

export function UserProfileManager({ actor }: { actor: Actor }) {
  const router = useRouter();
  const announce = useAnnounce();
  const { refreshProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Formulaire Informations professionnelles
  const [fullName, setFullName] = useState(actor.fullName);
  const [phone, setPhone] = useState("");
  const [room, setRoom] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Formulaire Mot de passe
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    let mounted = true;
    getUserProfile(actor.id)
      .then((p) => {
        if (!mounted || !p) return;
        setProfile(p);
        setFullName(p.fullName || actor.fullName);
        setPhone(p.phone || "");
        setRoom(p.room || "");
        setSpecialty(p.specialty || "");
      })
      .catch((err) => {
        console.warn("UserProfileManager: error loading profile", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [actor.id, actor.fullName]);

  // Enregistrement des informations professionnelles
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);

    if (!fullName.trim()) {
      setProfileError("Veuillez renseigner votre nom complet.");
      return;
    }

    setSavingProfile(true);
    try {
      await updateOwnProfile(actor, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        room: room.trim(),
        specialty: specialty.trim(),
      });
      await refreshProfile();
      const targetHome = homeFor(actor.role);
      const roleLabel = ROLE_LABELS[actor.role] || "votre espace";
      const msg = `Vos informations professionnelles ont été enregistrées avec succès. Redirection vers votre espace d'accueil (${roleLabel})…`;
      setProfileSuccess(msg);
      announce(msg);
      // Mettre à jour l'état local
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              fullName: fullName.trim(),
              phone: phone.trim(),
              room: room.trim(),
              specialty: specialty.trim(),
            }
          : null,
      );
      setTimeout(() => {
        router.push(targetHome);
      }, 1000);
    } catch (err) {
      const errText = accountErrorMessage(err);
      setProfileError(`Impossible d'enregistrer vos informations : ${errText}`);
      announce("L'enregistrement du profil a échoué.", "assertive");
    } finally {
      setSavingProfile(false);
    }
  };

  // Mise à jour du mot de passe avec validation de la politique ANSSI / CNIL
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError("Veuillez saisir votre mot de passe actuel.");
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      setPasswordError(validation.errors.join(" "));
      announce(validation.errors[0] || "Mot de passe non conforme aux règles de sécurité.", "assertive");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }

    setChangingPassword(true);
    try {
      await changeUserPassword(currentPassword, newPassword);
      const msg = "Votre mot de passe a été modifié avec succès conformément aux normes de sécurité.";
      setPasswordSuccess(msg);
      announce(msg);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const errText = accountErrorMessage(err);
      setPasswordError(errText);
      announce(`Échec de la modification du mot de passe : ${errText}`, "assertive");
    } finally {
      setChangingPassword(false);
    }
  };

  // Export RGPD des données personnelles (Article 15 & 20 RGPD)
  const [exportingData, setExportingData] = useState(false);

  const handleExportPersonalData = () => {
    setExportingData(true);
    try {
      const personalData = {
        _rgpd_notice: "Export certifié des données à caractère personnel conformément aux Articles 15 (Droit d'accès) et 20 (Droit à la portabilité) du Règlement Général sur la Protection des Données (UE 2016/679).",
        etablissement: "ESRP / CFRP Valentin Haüy — Association Valentin Haüy",
        date_export: new Date().toISOString(),
        utilisateur: {
          identifiant_unique: actor.id,
          nom_complet: profile?.fullName || actor.fullName,
          email_professionnel: profile?.email || "",
          role_attribue: profile?.role || actor.role,
          libelle_role: ROLE_LABELS[profile?.role || actor.role],
          telephone_professionnel: profile?.phone || "Non renseigné",
          bureau_salle: profile?.room || "Non renseigné",
          specialite: profile?.specialty || "Non renseignée",
          statut_compte: profile?.active !== false ? "Actif" : "Désactivé",
          date_creation: profile?.createdAt || "Non consignée",
        },
        droits_et_contacts: {
          dpo: "dpo@avh.asso.fr",
          autorite_de_controle: "CNIL (Commission Nationale de l'Informatique et des Libertés - https://www.cnil.fr)",
          duree_conservation: "5 ans à compter de la clôture des sessions de formation conformément aux obligations légales de financement de la formation professionnelle.",
        },
      };

      const blob = new Blob([JSON.stringify(personalData, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const sanitizedName = (profile?.fullName || actor.fullName).toLowerCase().replace(/[^a-z0-9]/g, "-");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `rgpd-donnees-personnelles-${sanitizedName}-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      announce("Vos données personnelles ont été téléchargées avec succès au format JSON.");
    } catch (e) {
      console.error(e);
      announce("Erreur lors de l'export des données personnelles.", "assertive");
    } finally {
      setExportingData(false);
    }
  };

  // Envoi d'email de réinitialisation si mot de passe actuel oublié
  const handleForgotCurrentPassword = async () => {
    if (!profile?.email) return;
    setSendingReset(true);
    try {
      await sendUserPasswordReset(profile.email);
      setResetEmailSent(true);
      announce(`Lien de réinitialisation envoyé à ${profile.email}.`);
    } catch (err) {
      announce(`Erreur : ${accountErrorMessage(err)}`, "assertive");
    } finally {
      setSendingReset(false);
    }
  };

  if (loading) return <Loading label="Chargement de votre profil…" />;

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      {/* 1. CARTE PROFIL & INFORMATIONS PROFESSIONNELLES */}
      <section
        aria-labelledby="profile-info-heading"
        className="rounded-2xl border-2 border-border-subtle bg-surface-container-lowest p-6 sm:p-8 shadow-xs flex flex-col gap-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-5">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-white font-bold text-xl shadow-xs"
              aria-hidden="true"
            >
              {fullName
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() || "VH"}
            </div>
            <div>
              <h2 id="profile-info-heading" className="text-xl sm:text-2xl font-bold text-primary tracking-tight">
                {fullName || actor.fullName}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-primary text-xs font-bold shadow-2xs">
                  <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{ROLE_LABELS[actor.role]}</span>
                </span>
                <span className="text-xs text-on-surface-variant font-medium">
                  {profile?.email || "Compte certifié CFRP"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {profileSuccess && (
          <Alert tone="success">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-status-present shrink-0" aria-hidden="true" />
              <span className="font-semibold">{profileSuccess}</span>
            </div>
          </Alert>
        )}

        {profileError && (
          <Alert tone="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-status-absent shrink-0" aria-hidden="true" />
              <span>{profileError}</span>
            </div>
          </Alert>
        )}

        <form onSubmit={handleSaveProfile} noValidate className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Nom & Prénom *"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              hint="Nom utilisé sur les feuilles d'émargement et les emplois du temps."
            />

            <TextField
              label="Adresse email (identifiant)"
              value={profile?.email || ""}
              disabled
              hint="L'adresse email sert d'identifiant de connexion unique."
            />

            <TextField
              label="Téléphone professionnel"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex. 01 40 56 40 00"
              hint="Numéro direct ou poste interne pour l'équipe pédagogique."
            />

            <TextField
              label="Bureau / Salle habituelle"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Ex. Salle 102 — Plateau Informatique"
              hint="Salle de cours principale ou bureau d'intervention."
            />

            <div className="sm:col-span-2">
              <TextField
                label="Spécialité / Discipline d'enseignement"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Ex. Braille intégral & abrégé, Locomotion, Systèmes informatiques..."
                hint="Matières principales ou domaine d'expertise au sein de l'établissement."
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-border-subtle">
            <Link
              href={homeFor(actor.role)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-subtle bg-surface-container-low px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container transition-colors"
            >
              Retour à l&apos;accueil
            </Link>
            <Button type="submit" disabled={savingProfile} className="min-w-[180px]">
              {savingProfile ? "Enregistrement…" : "Enregistrer les modifications"}
            </Button>
          </div>
        </form>
      </section>

      {/* 2. CARTE SÉCURITÉ & CHANGEMENT DE MOT DE PASSE */}
      <section
        aria-labelledby="password-heading"
        className="rounded-2xl border-2 border-border-subtle bg-surface-container-lowest p-6 sm:p-8 shadow-xs flex flex-col gap-6"
      >
        <div className="flex items-start gap-3 border-b border-border-subtle pb-5">
          <div className="h-10 w-10 rounded-xl bg-secondary/15 flex items-center justify-center text-secondary shrink-0 mt-0.5">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="password-heading" className="text-xl sm:text-2xl font-bold text-primary tracking-tight">
              Sécurité &amp; Modification du mot de passe
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
              Modifiez régulièrement votre mot de passe pour garantir la confidentialité et la conformité RGPD des données stagiaires.
            </p>
          </div>
        </div>

        {passwordSuccess && (
          <Alert tone="success">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-status-present shrink-0" aria-hidden="true" />
              <span className="font-semibold">{passwordSuccess}</span>
            </div>
          </Alert>
        )}

        {passwordError && (
          <Alert tone="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-status-absent shrink-0" aria-hidden="true" />
              <span>{passwordError}</span>
            </div>
          </Alert>
        )}

        {resetEmailSent && (
          <Alert tone="info">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
              <span>
                Un lien de réinitialisation sécurisé a été envoyé à <strong>{profile?.email}</strong>.
              </span>
            </div>
          </Alert>
        )}

        <form onSubmit={handleChangePassword} noValidate className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-1 max-w-xl">
            <PasswordField
              label="Mot de passe actuel *"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              hint="Requis pour vérifier votre identité avant toute modification."
            />

            <div className="flex flex-col gap-2">
              <PasswordField
                label="Nouveau mot de passe *"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                hint="Au moins 10 caractères (12 recommandés ANSSI), combinant majuscules, minuscules, chiffres et caractères spéciaux."
              />

              {newPassword.length > 0 && (() => {
                const strength = validatePassword(newPassword);
                const scoreColors = [
                  "bg-status-absent",
                  "bg-status-absent",
                  "bg-amber-500",
                  "bg-emerald-500",
                  "bg-emerald-600",
                ];
                return (
                  <div className="mt-1 flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-surface-container p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-on-surface-variant">Robustesse du mot de passe :</span>
                      <span className="font-bold text-primary" aria-live="polite">
                        {strength.label}
                      </span>
                    </div>
                    {/* Visual strength bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
                      <div
                        className={`h-full transition-all duration-300 ${scoreColors[strength.score]}`}
                        style={{ width: `${Math.max(15, (strength.score / 4) * 100)}%` }}
                      />
                    </div>
                    {strength.errors.length > 0 && (
                      <p className="text-xs text-status-absent mt-1" role="alert">
                        {strength.errors[0]}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            <PasswordField
              label="Confirmer le nouveau mot de passe *"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              hint="Retapez à l'identique votre nouveau mot de passe."
            />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 border-t border-border-subtle">
            <button
              type="button"
              onClick={handleForgotCurrentPassword}
              disabled={sendingReset || !profile?.email}
              className="text-xs sm:text-sm text-secondary hover:underline font-semibold cursor-pointer disabled:opacity-50"
            >
              {sendingReset ? "Envoi de l'email…" : "Mot de passe actuel oublié ? Recevoir un lien par email"}
            </button>

            <Button type="submit" disabled={changingPassword} className="min-w-[180px]">
              {changingPassword ? "Mise à jour en cours…" : "Mettre à jour le mot de passe"}
            </Button>
          </div>
        </form>
      </section>

      {/* Section RGPD: Droit d'accès, Portabilité & Protection des Données */}
      <section
        aria-labelledby="rgpd-heading"
        className="rounded-2xl border-2 border-border-subtle bg-surface-container-lowest p-6 sm:p-8 shadow-xs flex flex-col gap-6"
      >
        <div className="flex items-start gap-3 border-b border-border-subtle pb-5">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="rgpd-heading" className="text-xl sm:text-2xl font-bold text-primary tracking-tight">
              Protection des Données Personnelles &amp; Conformité RGPD
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
              Conformément au Règlement Général sur la Protection des Données (RGPD - Règlement UE 2016/679), vos données professionnelles sont sécurisées, tracées et strictement protégées.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border-subtle bg-surface-container p-4">
            <h3 className="font-bold text-sm text-primary flex items-center gap-2">
              <FileText className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
              Finalité &amp; Base Légale
            </h3>
            <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
              Vos données sont traitées pour la gestion certifiée des feuilles d&apos;émargement, l&apos;assiduité des stagiaires et les relevés légaux destinés à l&apos;ASP (Agence de Services et de Paiement).
            </p>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-container p-4">
            <h3 className="font-bold text-sm text-primary flex items-center gap-2">
              <Shield className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
              Durée de Conservation &amp; DPO
            </h3>
            <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
              Données conservées 5 ans après la clôture de la session conformément au Code du Travail. Contact DPO officiel :{" "}
              <a href="mailto:dpo@avh.asso.fr" className="font-semibold underline text-primary">
                dpo@avh.asso.fr
              </a>.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 border-t border-border-subtle">
          <Link
            href="/politique-confidentialite"
            className="text-xs sm:text-sm text-secondary hover:underline font-semibold"
          >
            Consulter l&apos;intégralité de la Politique de Confidentialité RGPD →
          </Link>

          <Button
            type="button"
            variant="secondary"
            onClick={handleExportPersonalData}
            disabled={exportingData}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {exportingData ? "Génération en cours…" : "Exporter mes données (JSON RGPD)"}
          </Button>
        </div>
      </section>
    </div>
  );
}
