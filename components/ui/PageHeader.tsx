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
    <div className="mb-6">
      <h1 ref={ref} tabIndex={-1} className="text-3xl font-bold text-gray-950 outline-none">
        {title}
      </h1>
      {description && <p className="mt-2 max-w-3xl text-lg text-gray-800">{description}</p>}
    </div>
  );
}
