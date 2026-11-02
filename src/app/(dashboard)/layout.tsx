'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { useSocket } from '@/hooks/use-socket';
import { Sidebar } from '@/components/layout/sidebar';
import type { EstadoPedido } from '@/types';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const usuario = useAuthStore((s) => s.usuario);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fechaActual, setFechaActual] = useState<string>('');
  const [isMounted, setIsMounted] = useState(false);

  const { on, off } = useSocket({ enabled: Boolean(usuario) });

  useEffect(() => {
    setIsMounted(true);
    setFechaActual(
      new Date().toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    );
  }, []);

  useEffect(() => {
    if (isMounted && !usuario) {
      router.push('/login');
    }
  }, [isMounted, usuario, router]);

  // Listener en tiempo real para eventos de pedidos
  useEffect(() => {
    if (!usuario) return;

    const handleEstadoUpdate = (data: { pedido_id: string; estado: EstadoPedido }) => {
      toast.info(`Actualización: Pedido #${data.pedido_id.slice(-6)} está ${data.estado}`);
    };

    on('estado_pedido_actualizado', handleEstadoUpdate);
    return () => off('estado_pedido_actualizado', handleEstadoUpdate);
  }, [usuario, on, off]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar dinámico con RBAC */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center gap-4 border-b border-border px-4 lg:px-6 bg-card">
          <button
            className="lg:hidden p-2 rounded-md hover:bg-muted"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="text-sm text-muted-foreground capitalize">
            {fechaActual}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
