import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinSearch",
  description: "Research Indian stocks: watchlist, overview, key metrics and results dates",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
