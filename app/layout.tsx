import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LayoutWrapper } from "@/components/Layout/LayoutWrapper";
import { ToastProvider } from "@/components/Utilities/ToastProvider";
import { TimezoneDetector } from "@/components/Utilities/TimezoneDetector";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Tome",
  description: "Track your reading progress with Calibre integration",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tome",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // Required for safe-area-inset-* to work on iOS
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" data-color-mode="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Run IMMEDIATELY before anything else
              const sidebarCollapsed = localStorage.getItem("sidebarCollapsed");
              document.documentElement.setAttribute("data-sidebar-collapsed", sidebarCollapsed === "false" ? "false" : "true");
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Set theme before page loads to prevent flicker
                const savedPreference = localStorage.getItem("themePreference");
                const oldSavedMode = localStorage.getItem("darkMode");
                
                let preference = "auto"; // NEW DEFAULT
                
                // Check new format first
                if (savedPreference && ["light", "dark", "auto"].includes(savedPreference)) {
                  preference = savedPreference;
                } 
                // Migrate old format
                else if (oldSavedMode !== null) {
                  preference = oldSavedMode === "true" ? "dark" : "light";
                  localStorage.setItem("themePreference", preference);
                  localStorage.removeItem("darkMode");
                }
                
                // Determine effective theme
                let theme;
                if (preference === "auto") {
                  theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
                } else {
                  theme = preference;
                }
                
                document.documentElement.setAttribute("data-theme", theme);
                document.documentElement.setAttribute("data-color-mode", theme);
              })();

              // Enable transitions only after a delay
              window.addEventListener('load', function() {
                setTimeout(function() {
                  document.documentElement.classList.add('transitions-enabled');
                }, 50);
              });
            `,
          }}
        />
      </head>
      <body className="bg-[var(--background)] text-[var(--foreground)]">
        <Providers>
          <ToastProvider />
          <TimezoneDetector />
          <LayoutWrapper>{children}</LayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}
