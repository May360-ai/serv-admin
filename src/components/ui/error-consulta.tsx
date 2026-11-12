'use client';

import { ErrorHttp } from '@/lib/error-http';
import { Button } from './button';

export function ErrorConsulta({ error, reintentar, cargando = false }: {
  error: Error; reintentar: () => void; cargando?: boolean;
}) {
  const permitido = !(error instanceof ErrorHttp) || error.reintentable;
  return <div role="alert" className="rounded-lg border p-4 text-destructive">
    <p>{error.message}</p>
    {permitido && <Button variant="outline" isLoading={cargando} onClick={reintentar}>Reintentar</Button>}
  </div>;
}
