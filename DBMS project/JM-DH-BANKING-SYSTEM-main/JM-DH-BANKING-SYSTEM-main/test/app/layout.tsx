import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Bharat Trust Bank (BTB) - Scheduled Commercial Bank | Official NetBanking Portal",
  description: "Official NetBanking Portal for Bharat Trust Bank. Experience secure, instant, zero-latency transfers, high-yield deposits, and RBI compliant banking services.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <Header />
          <main style={{ minHeight: 'calc(100vh - 160px)' }}>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
