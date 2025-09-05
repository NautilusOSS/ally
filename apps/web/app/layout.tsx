import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ally — Your Trading Ally on Voi',
  description: 'Simple & intuitive DEX aggregator for Voi',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
