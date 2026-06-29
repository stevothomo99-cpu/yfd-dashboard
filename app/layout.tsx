import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YFD Dashboard",
  description: "YFD Operations Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}