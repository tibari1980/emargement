"use client";

import { useEffect, useState } from "react";
import { Download, Filter } from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Alert, Loading } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Pagination } from "@/components/ui/Pagination";
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

  // Pagination state (15 audit actions per page by default)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

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
    setPage(1);
  }, [key]);

  useEffect(() => {
    if (!key) return;
    let stale = false;
    listAuditLogs({ days: eachDay(from, to), actorId: actorId || undefined, entityType: entityType || undefined })
      .then((logs) => {
        if (stale) return;
        setResult({ key, logs });
        announce(`${logs.length} action${logs.length > 1 ? "s" : ""} trouvée${logs.length > 1 ? "s" : ""}.`);
      })
      .catch((err) => {
        console.warn("AuditJournal: listAuditLogs failed", err);
        if (!stale) setResult({ key, logs: [] });
      });
    return () => {
      stale = true;
    };
  }, [key, from, to, actorId, entityType, announce]);

  if (refError) return <Alert tone="error">{refError}</Alert>;
  if (!data) return <Loading />;

  const logs = current?.logs;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="filters-heading" className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 shadow-xs">
        <h2 id="filters-heading" className="mb-4 text-xl font-bold text-primary flex items-center gap-2">
          <Filter className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />
          <span>Filtres du journal</span>
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

      {logs && (() => {
        const totalItems = logs.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const safePage = Math.min(page, totalPages);
        const startIndex = (safePage - 1) * pageSize;
        const paginatedLogs = logs.slice(startIndex, startIndex + pageSize);

        return (
          <section aria-labelledby="journal-heading" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="journal-heading" className="text-xl font-bold text-primary">
                {logs.length} action{logs.length > 1 ? "s" : ""}
              </h2>
              <Button
                variant="secondary"
                disabled={!logs.length}
                onClick={() => {
                  downloadBlob(new Blob([toCsv(logs)], { type: "text/csv;charset=utf-8" }), `journal-activite-${from}-${to}.csv`);
                  announce("Journal exporté.");
                }}
                className="inline-flex items-center gap-2 !px-4 !py-2 text-sm"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Exporter en CSV</span>
              </Button>
            </div>
            {logs.length === 0 ? (
              <Alert tone="info">Aucune action sur cette période.</Alert>
            ) : (
              <>
                {/* Vue Cartes sur Smartphone (< 768px) */}
                <div className="grid gap-3 md:hidden">
                  {paginatedLogs.map((log) => (
                    <article
                      key={log.id}
                      className="rounded-xl border border-border-subtle bg-surface-container-lowest p-4 shadow-xs flex flex-col gap-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-on-surface-variant">
                          {formatAt(log)}
                        </span>
                        <span className="inline-flex rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-semibold text-primary">
                          {AUDIT_ENTITY_LABELS[log.entityType] ?? log.entityType}
                        </span>
                      </div>

                      <div className="text-xs">
                        <span className="font-bold text-on-surface">{log.actorName}</span>
                        <span className="text-on-surface-variant">
                          {" "}
                          ({ROLE_LABELS[log.actorRole] ?? log.actorRole})
                        </span>
                      </div>

                      <div className="rounded-lg bg-surface-container-low p-2.5 text-xs sm:text-sm text-on-surface">
                        <p className="font-medium leading-snug">{log.summary}</p>
                        {log.changes && (
                          <details className="mt-2 pt-1.5 border-t border-border-subtle/60">
                            <summary className="cursor-pointer font-semibold text-secondary text-xs hover:underline">
                              Détail des modifications
                            </summary>
                            <ul className="ml-4 mt-1.5 list-disc text-xs text-on-surface-variant space-y-0.5">
                              {Object.entries(log.changes).map(([field, c]) => (
                                <li key={field} className="break-words">
                                  <strong>{field}</strong> : {formatValue(c.from)} → {formatValue(c.to)}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    </article>
                  ))}
                </div>

                {/* Vue Tableau sur Tablette & Ordinateur (>= 768px) */}
                <div
                  tabIndex={0}
                  role="region"
                  aria-label={`Tableau du journal d'activité, ${logs.length} actions`}
                  className="hidden md:block overflow-x-auto rounded-xl border border-border-subtle bg-surface-container-lowest shadow-xs focus:outline-none focus:ring-4 focus:ring-focus-outer"
                >
                  <table className="w-full border-collapse text-left text-sm min-w-[650px]">
                    <caption className="sr-only">Journal d&apos;activité, du plus récent au plus ancien</caption>
                    <thead className="border-b border-border-subtle bg-surface-container text-xs font-bold uppercase text-on-surface">
                      <tr>
                        <th scope="col" className="p-3 sm:p-4">Date et heure</th>
                        <th scope="col" className="p-3 sm:p-4">Utilisateur</th>
                        <th scope="col" className="p-3 sm:p-4">Domaine</th>
                        <th scope="col" className="p-3 sm:p-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container">
                      {paginatedLogs.map((log) => (
                        <tr key={log.id} className="align-top hover:bg-surface-container-low transition-colors">
                          <td className="whitespace-nowrap p-3 sm:p-4 font-mono text-xs text-on-surface-variant">{formatAt(log)}</td>
                          <td className="p-3 sm:p-4">
                            <span className="font-bold text-on-surface block">{log.actorName}</span>
                            <span className="block text-xs text-on-surface-variant">{ROLE_LABELS[log.actorRole] ?? log.actorRole}</span>
                          </td>
                          <td className="p-3 sm:p-4">
                            <span className="inline-flex rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-semibold text-primary">
                              {AUDIT_ENTITY_LABELS[log.entityType] ?? log.entityType}
                            </span>
                          </td>
                          <th scope="row" className="p-3 sm:p-4 font-normal">
                            <span className="text-on-surface">{log.summary}</span>
                            {log.changes && (
                              <details className="mt-1.5">
                                <summary className="cursor-pointer font-semibold text-secondary text-xs hover:underline">
                                  Détail des modifications
                                </summary>
                                <ul className="ml-4 mt-1 list-disc text-xs text-on-surface-variant">
                                  {Object.entries(log.changes).map(([field, c]) => (
                                    <li key={field}>
                                      <strong>{field}</strong> : {formatValue(c.from)} → {formatValue(c.to)}
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

                <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setPage(1);
                  }}
                  pageSizeOptions={[15, 25, 50, 100]}
                  itemName="actions"
                  ariaLabel="Pagination du journal d'activité"
                />
              </>
            )}
          </section>
        );
      })()}
    </div>
  );
}
