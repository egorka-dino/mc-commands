import type React from "react";
import { SiteNav } from "./components/SiteNav";
import "../style.css";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
