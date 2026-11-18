'use client';
import { useState } from 'react';
import { Button } from './button';

export function usePaginacion<T>(datos: T[], clave = '', cantidad = 10) {
  const [seleccion, setSeleccion] = useState({ clave, pagina: 1 });
  const paginas = Math.max(1, Math.ceil(datos.length / cantidad));
  const pagina = Math.min(paginas, seleccion.clave === clave ? seleccion.pagina : 1);
  return { datos: datos.slice((pagina - 1) * cantidad, pagina * cantidad), pagina, paginas,
    cambiar: (valor: number) => setSeleccion({ clave, pagina: Math.max(1, Math.min(paginas, valor)) }) };
}

export function Paginacion({ pagina, paginas, cambiar }: { pagina: number; paginas: number; cambiar: (pagina: number) => void }) {
  if (paginas <= 1) return null;
  return <nav aria-label="Paginación" className="flex flex-wrap items-center justify-center gap-3 py-3">
    <Button type="button" variant="outline" disabled={pagina <= 1} onClick={() => cambiar(pagina - 1)}>Anterior</Button>
    <span className="text-sm" role="status">Página {pagina} de {paginas}</span>
    <Button type="button" variant="outline" disabled={pagina >= paginas} onClick={() => cambiar(pagina + 1)}>Siguiente</Button>
  </nav>;
}
