import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';


export const metadata: Metadata = {
  title: 'SERV - Gestión de Entregas y Rutas',
  description: 'Plataforma administrativa para logística de última milla',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
