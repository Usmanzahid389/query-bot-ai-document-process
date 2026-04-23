import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { fonts } from "@/lib/fonts";
import "./globals.css";

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
        className={`${fonts.rubik.className} ${fonts.rubik.variable} flex h-dvh flex-col overflow-hidden bg-slate-100 antialiased dark:bg-zinc-950`}
      >
        <Nav />
        <main className="flex-1 min-h-0 w-full overflow-auto">{children}</main>
      </body>
    </html>
  );
}
