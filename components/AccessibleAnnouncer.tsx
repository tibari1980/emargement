"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Politeness = "polite" | "assertive";
type Announce = (message: string, politeness?: Politeness) => void;

const AnnouncerContext = createContext<Announce>(() => {});

/**
 * ARIA live regions shared by the whole application. Status changes
 * ("Jean Dupont marqué présent") are read by NVDA, JAWS and Orca without
 * moving the keyboard focus.
 */
export function AccessibleAnnouncer({ children }: { children: React.ReactNode }) {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback<Announce>((message, politeness = "polite") => {
    const set = politeness === "assertive" ? setAssertive : setPolite;
    // Empty the region first so that an identical message is announced again.
    set("");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => set(message), 100);
  }, []);

  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnounce(): Announce {
  return useContext(AnnouncerContext);
}
