'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { DetallePedido } from '@/components/pedidos/detalle-pedido';

function Contenido() {
  const { id } = useParams<{ id: string }>();
  return <DetallePedido pedidoId={id} />;
}

export default function DetallePedidoPage() {
  return <Suspense fallback={<p role="status">Cargando detalle del pedido…</p>}><Contenido /></Suspense>;
}
