import './globals.css';
import { CartProvider } from '@/components/CartContext';
import { ServiceStatusProvider, ServiceClosedBanner } from '@/components/ServiceStatus';
import { StockProvider } from '@/components/StockGuard';
import WelcomeModal from '@/components/WelcomeModal';

export const metadata = {
  title: 'Jasa Order Kopi Kenangan by Iqbal',
  description: 'Jasa Order Kopi Kenangan by Iqbal — pesan kopi favoritmu dengan diskon 50% (maks Rp 35.000) lewat WhatsApp.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#18181B',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans min-h-screen">
        <ServiceStatusProvider>
          <StockProvider>
            <CartProvider>
              <ServiceClosedBanner>
                {children}
                <WelcomeModal />
              </ServiceClosedBanner>
            </CartProvider>
          </StockProvider>
        </ServiceStatusProvider>
      </body>
    </html>
  );
}
