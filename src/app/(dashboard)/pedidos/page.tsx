'use client';

import { useState } from 'react';
import { Plus, Search, Filter, RefreshCw } from 'lucide-react';
import { useTodosPedidos } from '@/hooks/use-pedidos';
import { TablaPedidos } from '@/components/pedidos/tabla-pedidos';
import { ModalNuevoPedido } from '@/components/pedidos/modal-nuevo-pedido';
import { RoleGuard } from '@/components/auth/role-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { EstadoPedido } from '@/types';

const ESTADOS_FILTRO: { value: EstadoPedido | ''; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'aceptado', label: 'Aceptado' },
  { value: 'agendado', label: 'Agendado' },
  { value: 'en_camino', label: 'En Camino' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];

export default function PedidosPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoPedido | ''>('');
  const [fechaFiltro, setFechaFiltro] = useState('');

  const { data, isLoading, refetch } = useTodosPedidos({
    busqueda: busqueda || undefined,
    estado: estadoFiltro || undefined,
    fecha: fechaFiltro || undefined,
  });

  const pedidos = data?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground text-sm">
            {isLoading ? 'Cargando...' : `${pedidos.length} pedido(s) encontrado(s)`}
          </p>
        </div>
        <RoleGuard allowedRoles={['cliente']}>
          <Button onClick={() => setModalOpen(true)} data-cy="btn-nuevo-pedido">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Pedido
          </Button>
        </RoleGuard>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-card rounded-lg border border-border">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, dirección..."
            className="pl-9 h-9"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            data-cy="input-busqueda-pedidos"
          />
        </div>

        <Select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value as EstadoPedido | '')}
          className="w-44 h-9"
          data-cy="select-estado-pedido"
        >
          {ESTADOS_FILTRO.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </Select>

        <Input
          type="date"
          value={fechaFiltro}
          onChange={(e) => setFechaFiltro(e.target.value)}
          className="w-40 h-9"
          data-cy="input-fecha-filtro"
        />

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="ml-auto gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Tabla */}
      <TablaPedidos pedidos={pedidos} isLoading={isLoading} />

      {/* Modal accesible únicamente por rol cliente */}
      <RoleGuard allowedRoles={['cliente']}>
        <ModalNuevoPedido open={modalOpen} onOpenChange={setModalOpen} />
      </RoleGuard>
    </div>
  );
}
