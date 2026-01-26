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
    
    // Fetch demo mode status from API (reads runtime env)
    fetch("/api/demo/status")
      .then((res) => res.json())
      .then((data) => {
        setIsDemoMode(data.isDemoMode);
        setDemoMessage(data.isDemoMode ? data.message : "");
      })
      .catch((err) => {
        console.error("Failed to fetch demo status:", err);
        // Default to non-demo mode on error
        setIsDemoMode(false);
        setDemoMessage("");
      });
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
