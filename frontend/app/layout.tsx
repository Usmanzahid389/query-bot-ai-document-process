import type { Metadata } from "next";
import localFont from "next/font/local";
import { Nav } from "@/components/Nav";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "QueryBot — Ask your documents",
  description: "Upload PDFs, DOCX, and TXT files and query them with AI-powered Q&A and summaries.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-50 font-sans antialiased dark:bg-zinc-950`}
      >
        <Nav />
        <main className="mx-auto max-w-5xl px-4 pt-0">{children}</main>
      </body>
    </html>
  );
}
