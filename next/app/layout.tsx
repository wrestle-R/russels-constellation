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
const themeInit = `try{var t=localStorage.getItem('play-it-back-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}catch{document.documentElement.dataset.theme='dark'}`;
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
