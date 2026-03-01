"use client";

import React, { createContext, useContext, useState } from "react";

type CoachContextValue = {
  open: boolean;
  setOpen: (value: boolean) => void;
};

const CoachContext = createContext<CoachContextValue | null>(null);

export function CoachOpenProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <CoachContext.Provider value={{ open, setOpen }}>
      {children}
    </CoachContext.Provider>
  );
}

export function useCoachOpen(): CoachContextValue {
  const ctx = useContext(CoachContext);
  if (!ctx) {
    throw new Error("useCoachOpen must be used within CoachOpenProvider");
  }
  return ctx;
}
