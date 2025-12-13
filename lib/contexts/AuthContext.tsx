"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  authEnabled: boolean;
  mounted: boolean;
}

const AuthContext = createContext<AuthContextType>({ 
  authEnabled: false,
  mounted: false 
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authEnabled, setAuthEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    
    // Defer auth check to reduce initial load blocking
    const authCheckTimer = setTimeout(() => {
      fetch("/api/auth/status")
        .then((res) => res.json())
        .then((data) => setAuthEnabled(data.enabled))
        .catch(() => setAuthEnabled(false));
    }, 100);
    
    return () => clearTimeout(authCheckTimer);
  }, []);
  
  return (
    <AuthContext.Provider value={{ authEnabled, mounted }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
