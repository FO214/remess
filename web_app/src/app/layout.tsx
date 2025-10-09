import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Remess",
  description: "Discover your messaging story. Every conversation. Every moment. All your texts.",
  keywords: ["messaging", "analytics", "iMessage", "texts", "conversation", "data visualization"],
  authors: [{ name: "Remess" }],
  icons: {
    icon: "/icon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Remess",
    description: "Discover your messaging story. Every conversation. Every moment. All your texts.",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 1200,
        alt: "Remess - Your LIFE in Texts",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Remess",
    description: "Discover your messaging story. Every conversation. Every moment. All your texts.",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Remess",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}