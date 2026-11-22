'use client';

import { useDetallePedido } from '@/hooks/use-consultas-pedidos';
import { useAuthStore } from '@/store/auth.store';
import { idPedidoValido } from '@/services/pedidos-consultas.service';
import { ErrorHttp } from '@/lib/error-http';
import { ErrorConsulta } from '@/components/ui/error-consulta';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoneda, getEstadoLabel } from '@/lib/utils';
import { esAdministrador } from '@/types/auth';
import { FotoPrivada } from './foto-privada';
import { CalificacionTienda, ResenaRepartidor, ResenasProducto } from './valoraciones';
import { MapaSeguimientoPedido } from './mapa-seguimiento-pedido';

function fechaConfirmada(value: string | null) {
  return value ? new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'No informada';
}

export function DetallePedido({ pedidoId }: { pedidoId: string }) {
  const usuario = useAuthStore(s => s.usuario);
  const consulta = useDetallePedido(pedidoId);
  if (!usuario) return <p role="status">Cargando sesión…</p>;
  if (!esAdministrador(usuario.rol) && !['cliente', 'proveedor', 'repartidor'].includes(usuario.rol)) return <p role="alert">Tu sesión no permite consultar el detalle.</p>;
  if (!idPedidoValido(pedidoId)) return <p role="alert">Identificador de pedido inválido.</p>;
  if (consulta.isLoading || consulta.isPending) return <p role="status">Cargando detalle del pedido…</p>;
  if (consulta.isError) return <section className="space-y-3">
    {consulta.error instanceof ErrorHttp && consulta.error.status === 404 && <h1>Pedido inexistente o no disponible para tu sesión</h1>}
    {consulta.error instanceof ErrorHttp && consulta.error.status === 403 && <h1>Acceso denegado</h1>}
    <ErrorConsulta error={consulta.error} reintentar={() => void consulta.refetch()} cargando={consulta.isFetching} />
  </section>;
  const pedido = consulta.data;
  if (!pedido) return <p role="status">El detalle no está disponible.</p>;
  const verImportes = usuario.rol !== 'repartidor';
  const seguimientoEnVivo =
    (['cliente', 'proveedor'].includes(usuario.rol) || esAdministrador(usuario.rol)) &&
    pedido.ruta?.estado === 'en_ruta' &&
    ['pendiente', 'aceptado', 'agendado', 'en_progreso', 'en_camino'].includes(pedido.estados_pedido.nombre);
  return <section className="max-w-4xl space-y-5">
    <h1 className="text-2xl font-bold">Pedido {pedido.codigo_seguimiento ?? `PED-${pedido.id}`}</h1>
    <p>{getEstadoLabel(pedido.estados_pedido.nombre)}</p>
    {seguimientoEnVivo && <MapaSeguimientoPedido pedidoId={String(pedido.id)} />}
    {pedido.foto_entrega && <Card><CardHeader><CardTitle>Comprobante de entrega</CardTitle></CardHeader><CardContent><FotoPrivada key={`${pedido.id}:${pedido.foto_entrega.creada_en}`} path={`/api/pedidos/${pedido.id}/foto-entrega`} alt="Foto del pedido entregado" revision={pedido.foto_entrega.creada_en} /></CardContent></Card>}
    <Card><CardHeader><CardTitle>Entrega</CardTitle></CardHeader><CardContent className="space-y-2">
      <p>Tienda: {pedido.proveedores.nombre_comercial}</p>
      <p>Creación: {fechaConfirmada(pedido.fecha_creacion)}</p>
      <p>Programación: {fechaConfirmada(pedido.fecha_programada)}</p>
      <p>Entrega confirmada: {fechaConfirmada(pedido.fecha_entrega_final)}</p>
      {pedido.direcciones ? <div><p>Dirección: {pedido.direcciones.direccion}, {pedido.direcciones.ciudad}</p>
        {pedido.direcciones.referencia && <p>Referencia: {pedido.direcciones.referencia}</p>}
        {pedido.direcciones.zona && <p>Zona: {pedido.direcciones.zona.nombre}</p>}</div> : <p>Sin dirección registrada</p>}
      {pedido.ruta ? <p>Ruta: {pedido.ruta.id} · {pedido.ruta.fecha_entrega} · {pedido.ruta.estado}</p> : <p>Sin ruta asignada</p>}
      {pedido.orden_en_ruta !== null && <p>Parada: {pedido.orden_en_ruta}</p>}
      {pedido.instrucciones_especiales && <p>Instrucciones: {pedido.instrucciones_especiales}</p>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Productos y servicios</CardTitle></CardHeader><CardContent>
      {pedido.detalle_pedido.length ? <ul className="space-y-2">{pedido.detalle_pedido.map(linea => <li key={linea.id}>
        {linea.cantidad} × {linea.items.nombre}{linea.variaciones_item && ` (${linea.variaciones_item.nombre_variacion})`}
        {verImportes && linea.precio_unitario !== undefined && <span> · Unitario: {formatMoneda(Number(linea.precio_unitario))}</span>}
        {verImportes && linea.subtotal !== undefined && <span> · Subtotal: {formatMoneda(Number(linea.subtotal))}</span>}
      </li>)}</ul> : <p>No hay productos registrados en este pedido.</p>}
    </CardContent></Card>
    {pedido.estados_pedido.nombre === 'completado' && <div className="space-y-4">
      {pedido.ruta && <ResenaRepartidor pedidoId={pedido.id} />}
      {usuario.rol === 'cliente' && <CalificacionTienda pedidoId={pedido.id} inicial={pedido.calificacion_tienda} />}
      {usuario.rol === 'cliente' && <div className="space-y-2"><h2 className="font-semibold">Valorar los productos recibidos</h2>{pedido.detalle_pedido.map(linea => <div key={linea.id} className="flex flex-wrap items-center gap-2"><span>{linea.items.nombre}</span><ResenasProducto itemId={linea.items.id} /></div>)}</div>}
    </div>}
    {verImportes && <Card><CardHeader><CardTitle>Importes</CardTitle></CardHeader><CardContent>
      {(['subtotal', 'costo_envio', 'impuesto', 'descuento', 'total'] as const).map(campo => <p key={campo}>
        {({ subtotal: 'Subtotal', costo_envio: 'Envío', impuesto: 'Impuesto', descuento: 'Descuento', total: 'Total' })[campo]}: {pedido[campo] == null ? 'No informado' : formatMoneda(Number(pedido[campo]))}
      </p>)}
      {pedido.pagos && <p className="mt-2 text-sm text-muted-foreground">
        Pago ({pedido.pagos.metodo_pago.replaceAll('_', ' ')}): {pedido.pagos.estado === 'completado' ? 'Confirmado' : 'Pendiente'}
      </p>}
    </CardContent></Card>}
  </section>;
}
