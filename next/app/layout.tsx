import type { Metadata } from "next";
import { ThemeProvider } from "../components/theme";
import "./globals.css";
export const metadata: Metadata = {
  title: "Play It Back · Your music, connected",
  description:
    "A personal music collection. Explore your artists, genres, albums and playlists.",
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
