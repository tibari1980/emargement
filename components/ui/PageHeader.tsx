"use client";

import { useEffect, useRef } from "react";

/**
 * Page title. Focus moves to the <h1> when the page is shown so that screen
 * reader users start reading from the top of the new content.
 */
export function PageHeader({ title, description }: { title: string; description?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = `${title} — Émargement CFRP Valentin Haüy`;
    ref.current?.focus();
  }, [title]);

  return (
    <div className="mb-6 border-b border-border-subtle pb-4">
      <h1 ref={ref} tabIndex={-1} className="text-2xl sm:text-3xl font-bold text-primary tracking-tight outline-none">
        {title}
      </h1>
      {description && <p className="mt-1.5 max-w-3xl text-sm sm:text-base text-on-surface-variant">{description}</p>}
    </div>
  );
}
