"use client";

import { useEffect, useState } from "react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { downloadBlob } from "@/lib/core/apiClient";
import { addDays, eachDay, isValidIsoDate, todayIso } from "@/lib/core/dates";
import { listAuditLogs } from "@/lib/data/auditLogs";
import {
  AUDIT_ENTITY_LABELS,
  AUDIT_ENTITY_TYPES,
  ROLE_LABELS,
  type AuditEntityType,
  type AuditLog,
} from "@/lib/domain/types";
import { useReferenceData } from "@/features/shared/useReferenceData";

const MAX_DAYS = 31;

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" });
const formatAt = (log: AuditLog) => (log.at ? dateTime.format(log.at.toDate()) : log.day);

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "vide";
  if (Array.isArray(value)) return value.length ? `${value.length} élément(s)` : "aucun";
  if (typeof value === "boolean") return value ? "oui" : "non";
  return String(value);
}

function toCsv(logs: AuditLog[]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["Date", "Utilisateur", "Rôle", "Domaine", "Action", "Détail"];
  const rows = logs.map((l) => [
    formatAt(l),
    l.actorName,
    ROLE_LABELS[l.actorRole] ?? l.actorRole,
    AUDIT_ENTITY_LABELS[l.entityType] ?? l.entityType,
    l.summary,
    l.changes ? Object.entries(l.changes).map(([k, c]) => `${k}: ${formatValue(c.from)} → ${formatValue(c.to)}`).join(" ; ") : "",
  ]);
  // BOM so that Excel opens accents correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(escape).join(";")).join("\r\n");
}

/** Who did what and when: immutable journal, filterable by period, user and domain. */
export function AuditJournal() {
  const announce = useAnnounce();
  const { data, error: refError } = useReferenceData();
  const [from, setFrom] = useState(addDays(todayIso(), -6));
  const [to, setTo] = useState(todayIso());
  const [actorId, setActorId] = useState("");
  const [entityType, setEntityType] = useState<AuditEntityType | "">("");
  const [result, setResult] = useState<{ key: string; logs?: AuditLog[]; error?: string } | null>(null);

  const periodError = !isValidIsoDate(from) || !isValidIsoDate(to)
    ? "Dates invalides."
    : to < from
      ? "La date de fin doit être postérieure à la date de début."
      : eachDay(from, to).length > MAX_DAYS
        ? `La période est limitée à ${MAX_DAYS} jours.`
        : null;
  const key = periodError ? null : `${from}|${to}|${actorId}|${entityType}`;
  const current = result && result.key === key ? result : null;

  useEffect(() => {
    if (!key) return;
    let stale = false;
    listAuditLogs({ days: eachDay(from, to), actorId: actorId || undefined, entityType: entityType || undefined })
      .then((logs) => {
        if (stale) return;
        setResult({ key, logs });
        announce(`${logs.length} action${logs.length > 1 ? "s" : ""} trouvée${logs.length > 1 ? "s" : ""}.`);
      })
      .catch(() => !stale && setResult({ key, error: "Impossible de charger le journal." }));
    return () => {
      stale = true;
    };
  }, [key, from, to, actorId, entityType, announce]);

  if (refError) return <Alert tone="error">{refError}</Alert>;
  if (!data) return <Loading />;

  const logs = current?.logs;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="filters-heading" className="rounded-lg border-2 border-gray-300 bg-white p-5">
        <h2 id="filters-heading" className="mb-4 text-xl font-bold">
          Filtres
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <TextField label="Du" type="date" value={from} onChange={(e) => setFrom(e.target.value)} error={periodError} />
          <TextField label="Au" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <SelectField label="Utilisateur" value={actorId} onChange={(e) => setActorId(e.target.value)}>
            <option value="">Tous les utilisateurs</option>
            {data.staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({ROLE_LABELS[u.role]})
              </option>
            ))}
          </SelectField>
          <SelectField label="Domaine" value={entityType} onChange={(e) => setEntityType(e.target.value as AuditEntityType | "")}>
            <option value="">Tous les domaines</option>
            {AUDIT_ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {AUDIT_ENTITY_LABELS[t]}
              </option>
            ))}
          </SelectField>
        </div>
      </section>

      {current?.error && <Alert tone="error">{current.error}</Alert>}
      {key && !current && <Loading label="Chargement du journal…" />}

      {logs && (
        <section aria-labelledby="journal-heading" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="journal-heading" className="text-xl font-bold">
              {logs.length} action{logs.length > 1 ? "s" : ""}
            </h2>
            <Button
              variant="secondary"
              disabled={!logs.length}
              onClick={() => {
                downloadBlob(new Blob([toCsv(logs)], { type: "text/csv;charset=utf-8" }), `journal-activite-${from}-${to}.csv`);
                announce("Journal exporté.");
              }}
            >
              Exporter en CSV
            </Button>
          </div>
          {logs.length === 0 ? (
            <Alert tone="info">Aucune action sur cette période.</Alert>
          ) : (
            <div className="overflow-x-auto rounded-lg border-2 border-gray-300 bg-white">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Journal d&apos;activité, du plus récent au plus ancien</caption>
                <thead className="bg-gray-100">
                  <tr>
                    <th scope="col" className="p-3">Date et heure</th>
                    <th scope="col" className="p-3">Utilisateur</th>
                    <th scope="col" className="p-3">Domaine</th>
                    <th scope="col" className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t-2 border-gray-200 align-top">
                      <td className="whitespace-nowrap p-3">{formatAt(log)}</td>
                      <td className="p-3">
                        <span className="font-semibold">{log.actorName}</span>
                        <span className="block text-sm text-gray-700">{ROLE_LABELS[log.actorRole] ?? log.actorRole}</span>
                      </td>
                      <td className="p-3">{AUDIT_ENTITY_LABELS[log.entityType] ?? log.entityType}</td>
                      <th scope="row" className="p-3 font-normal">
                        {log.summary}
                        {log.changes && (
                          <details className="mt-1">
                            <summary className="cursor-pointer font-semibold text-blue-900">Détail des modifications</summary>
                            <ul className="ml-5 mt-1 list-disc text-sm">
                              {Object.entries(log.changes).map(([field, c]) => (
                                <li key={field}>
                                  {field} : {formatValue(c.from)} → {formatValue(c.to)}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </th>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
