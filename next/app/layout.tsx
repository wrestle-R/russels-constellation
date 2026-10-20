import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "../components/theme";
import "./globals.css";
export const metadata: Metadata = {
  title: "Russel’s constellation",
  description:
    "Russel’s private, local music constellation. Songs connected by artist and colored by recorded listening.",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
