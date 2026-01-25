"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface DemoContextType {
  isDemoMode: boolean;
  demoMessage: string;
  mounted: boolean;
}

const DemoContext = createContext<DemoContextType>({
  isDemoMode: false,
  demoMessage: "",
  mounted: false,
});

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoMessage, setDemoMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Read demo mode from env (available via next.config.ts env injection)
    const isDemo = process.env.DEMO_MODE === "true";
    setIsDemoMode(isDemo);
    setDemoMessage(isDemo ? "This is a read-only demo. Changes are not saved." : "");
  }, []);

  return (
    <DemoContext.Provider value={{ isDemoMode, demoMessage, mounted }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error("useDemo must be used within a DemoProvider");
  }
  return context;
}
