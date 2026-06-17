import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Flux Tech Titans Arena",
  description: "A Project Flux Top Trumps-style card game featuring technology leaders and computing legends.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
