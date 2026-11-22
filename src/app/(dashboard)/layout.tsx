'use client';

import { EstadoPublicacionTienda } from '@/features/tienda/estado-publicacion';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Menu } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { useSocket } from '@/hooks/use-socket';
import { Apariencia } from '@/components/layout/apariencia';
import { Sidebar } from '@/components/layout/sidebar';
import type { EstadoPedido } from '@/types';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const suscribirSinCambios = () => () => {};
const fechaHoyLegible = () => new Date().toLocaleDateString('es-EC', {
  timeZone: 'America/Guayaquil', weekday: 'long', day: 'numeric', month: 'long',
});

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const usuario = useAuthStore((s) => s.usuario);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // En el servidor no hay fecha local ni sesión: se leen solo en el cliente, sin setState dentro de efectos.
  const fechaActual = useSyncExternalStore(suscribirSinCambios, fechaHoyLegible, () => '');
  const isMounted = useSyncExternalStore(suscribirSinCambios, () => true, () => false);

  const { on, off } = useSocket({ enabled: Boolean(usuario) });

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
      void queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      void queryClient.invalidateQueries({ queryKey: ['mis-pedidos-cliente'] });
    };

    const actualizarDespacho = () => {
      void queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      void queryClient.invalidateQueries({ queryKey: ['rutas'] });
      void queryClient.invalidateQueries({ queryKey: ['atrasadas'] });
    };
    const actualizarFlota = () => {
      void queryClient.invalidateQueries({ queryKey: ['flota'] });
      void queryClient.invalidateQueries({ queryKey: ['repartidores-despacho'] });
    };
    const actualizarUbicacion = ({ ruta_id }: { ruta_id: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['ubicacion-ruta', usuario.id, usuario.proveedor_id, ruta_id] });
    };
    on('pedido_registrado', actualizarDespacho);
    on('ruta_actualizada', actualizarDespacho);
    on('despacho_actualizado', actualizarDespacho);
    on('disponibilidad_repartidores_actualizada', actualizarFlota);
    on('ubicacion_ruta_actualizada', actualizarUbicacion);
    on('connect', actualizarDespacho);
    on('estado_pedido_actualizado', handleEstadoUpdate);
    return () => {
      off('pedido_registrado', actualizarDespacho);
      off('ruta_actualizada', actualizarDespacho);
      off('despacho_actualizado', actualizarDespacho);
      off('disponibilidad_repartidores_actualizada', actualizarFlota);
      off('ubicacion_ruta_actualizada', actualizarUbicacion);
      off('connect', actualizarDespacho);
      off('estado_pedido_actualizado', handleEstadoUpdate);
    };
  }, [usuario, on, off, queryClient]);

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
          <Apariencia />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-thin">
          <EstadoPublicacionTienda />
          {children}
        </main>
      </div>
    </div>
  );
}
