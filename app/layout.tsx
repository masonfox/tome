import type { Metadata } from "next";
import "./globals.css";
import { LayoutWrapper } from "@/components/LayoutWrapper";
import { ToastProvider } from "@/components/ToastProvider";
import { TimezoneDetector } from "@/components/TimezoneDetector";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Tome",
  description: "Track your reading progress with Calibre integration",
  manifest: "/site.webmanifest",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" data-bottom-nav="false" suppressHydrationWarning>
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
                const savedMode = localStorage.getItem("darkMode");
                if (savedMode !== null) {
                  document.documentElement.setAttribute("data-theme", savedMode === "true" ? "dark" : "light");
                } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
                  document.documentElement.setAttribute("data-theme", "dark");
                } else {
                  document.documentElement.setAttribute("data-theme", "light");
                }
                
                // Set bottom navigation preference before page loads to prevent flicker
                const bottomNavEnabled = localStorage.getItem("bottomNavigationEnabled");
                if (bottomNavEnabled === "true") {
                  document.documentElement.setAttribute("data-bottom-nav", "true");
                } else {
                  document.documentElement.setAttribute("data-bottom-nav", "false");
                }
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
