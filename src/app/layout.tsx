import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#d97706',
};

export const metadata: Metadata = {
  title: '7 STAR INVEST — Official Halal & Trusted Earning Platform',
  description: 'High-Yield Financial Growth Platform with VIP Investment Plans, Instant Easypaisa & JazzCash Gateways, and Daily Mining Returns.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/css/app-theme.css" />
        <link rel="stylesheet" href="/css/main.css" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
