'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePedidosAdministracion } from '@/hooks/use-consultas-pedidos';
import { useAuthStore } from '@/store/auth.store';
import { estadoConsulta, type FiltrosAdministracion } from '@/services/pedidos-consultas.service';
import { ContratoPedidosError } from '@/services/pedidos-contrato';
import { ErrorConsulta } from '@/components/ui/error-consulta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { formatMoneda, getEstadoLabel } from '@/lib/utils';
import type { EstadoPedido } from '@/types';

const inicial = { estado: '', proveedor_id: '', zona_id: '', fecha_desde: '', fecha_hasta: '' };
const fechaGuayaquil = new Intl.DateTimeFormat('es-EC', {
  timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit', year: 'numeric',
});

export function PedidosAdministracion() {
  const usuario = useAuthStore(s => s.usuario);
  // Estado del formulario separado de la consulta: escribir no provoca GETs.
  const [borrador, setBorrador] = useState(inicial);
  const [filtros, setFiltros] = useState<FiltrosAdministracion>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const consulta = usePedidosAdministracion({ ...filtros, page, page_size: pageSize });
  if (!usuario) return <p role="status">Cargando sesión…</p>;
  if (usuario.rol !== 'administrador') return <p role="alert">Esta vista requiere una sesión de administrador.</p>;
  const meta = consulta.data?.meta;
  return <section className="space-y-6">
    <div><h1 className="text-2xl font-bold">Supervisión de pedidos</h1>
      <p className="text-sm text-muted-foreground">Todas las tiendas, incluidos pedidos sin ruta. Las fechas filtran el día de creación en Guayaquil.</p></div>
    <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3" onSubmit={event => {
      event.preventDefault(); setPage(1); setFiltros({ ...borrador, estado: (borrador.estado || undefined) as EstadoPedido | undefined });
    }}>
      <label>Estado<Select aria-label="Estado" value={borrador.estado} onChange={e => setBorrador({ ...borrador, estado: e.target.value })}>
        <option value="">Todos los estados</option>{estadoConsulta.options.map(estado => <option key={estado} value={estado}>{getEstadoLabel(estado)}</option>)}
      </Select></label>
      {(['proveedor_id', 'zona_id'] as const).map(campo => <label key={campo}>{campo === 'proveedor_id' ? 'Proveedor (ID)' : 'Zona (ID)'}
        <Input aria-label={campo === 'proveedor_id' ? 'Proveedor (ID)' : 'Zona (ID)'} type="number" min={1} max={2147483647} step={1} value={borrador[campo]} onChange={e => setBorrador({ ...borrador, [campo]: e.target.value })} />
      </label>)}
      {(['fecha_desde', 'fecha_hasta'] as const).map(campo => <label key={campo}>{campo === 'fecha_desde' ? 'Creado desde' : 'Creado hasta'}
        <Input aria-label={campo === 'fecha_desde' ? 'Creado desde' : 'Creado hasta'} type="date" value={borrador[campo]} onChange={e => setBorrador({ ...borrador, [campo]: e.target.value })} />
      </label>)}
      <Button type="submit">Aplicar filtros</Button>
      <Button type="button" variant="outline" onClick={() => { setBorrador(inicial); setFiltros({}); setPage(1); }}>Restablecer filtros</Button>
    </form>
    <Button variant="outline" isLoading={consulta.isFetching} onClick={() => void consulta.refetch()}>Actualizar</Button>
    {consulta.isLoading ? <p role="status">Cargando pedidos…</p> : consulta.isError ?
      (consulta.error instanceof ContratoPedidosError ? <p role="alert">{consulta.error.message}</p> :
        <ErrorConsulta error={consulta.error} reintentar={() => void consulta.refetch()} cargando={consulta.isFetching} />) : <>
      <p role="status">{meta?.total ?? 0} pedido(s) en total</p>
      {consulta.data?.data.length ? <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm">
        <thead><tr>{['Pedido', 'Cliente', 'Tienda', 'Estado', 'Creación', 'Programación', 'Total'].map(nombre => <th key={nombre} className="p-3 text-left">{nombre}</th>)}</tr></thead>
        <tbody>{consulta.data.data.map(pedido => <tr key={pedido.id} className="border-t">
          <td className="p-3"><Link className="underline" href={`/pedidos/${pedido.id}`}>{pedido.codigo_seguimiento ?? `PED-${pedido.id}`}</Link></td>
          <td className="p-3">{[pedido.usuarios.nombre, pedido.usuarios.apellido].filter(Boolean).join(' ')}</td>
          <td className="p-3">{pedido.proveedores.nombre_comercial}</td><td className="p-3">{getEstadoLabel(pedido.estados_pedido.nombre)}</td>
          <td className="p-3">{pedido.fecha_creacion ? fechaGuayaquil.format(new Date(pedido.fecha_creacion)) : 'No informada'}</td>
          <td className="p-3">{pedido.fecha_programada ? fechaGuayaquil.format(new Date(pedido.fecha_programada)) : 'Sin programación'}</td>
          <td className="p-3">{formatMoneda(Number(pedido.total))}</td>
        </tr>)}</tbody>
      </table></div> : <EmptyState title="Sin pedidos para mostrar" description="No hay pedidos en esta página con los filtros aplicados." />}
    </>}
    <div className="flex flex-wrap items-center gap-3">
      <label>Por página<Select aria-label="Por página" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
        {[20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
      </Select></label>
      <Button variant="outline" disabled={page <= 1 || consulta.isFetching} onClick={() => setPage(page - 1)}>Anterior</Button>
      <span>Página {page}{meta?.total_pages ? ` de ${meta.total_pages}` : ''}</span>
      <Button variant="outline" disabled={!meta || page >= meta.total_pages || consulta.isFetching || consulta.isError} onClick={() => setPage(page + 1)}>Siguiente</Button>
    </div>
  </section>;
}
