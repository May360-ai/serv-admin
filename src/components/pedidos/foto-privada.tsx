'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth.store';

export function FotoPrivada({ path, alt, revision = '', compact = false }: { path: string; alt: string; revision?: string; compact?: boolean }) {
  const usuario = useAuthStore(s => s.usuario);
  const consulta = useQuery({ queryKey: ['foto-privada', usuario?.id, path, revision], queryFn: async () => (await apiClient.get<Blob>(path, { responseType: 'blob' })).data, retry: false });
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!consulta.data) return;
    const reader = new FileReader();
    reader.onload = () => setSrc(String(reader.result));
    reader.readAsDataURL(consulta.data);
    return () => { reader.onload = null; reader.abort(); };
  }, [consulta.data]);
  if (consulta.isPending) return compact ? null : <p role="status">Cargando foto…</p>;
  if (consulta.isError && compact) return null;
  if (consulta.isError) return <p role="alert">No se pudo cargar la foto. <Button variant="outline" onClick={() => void consulta.refetch()}>Reintentar foto</Button></p>;
  return src ? <Image src={src} alt={alt} width={640} height={480} unoptimized className={compact ? 'h-10 w-10 rounded-full object-cover' : 'max-h-80 w-full rounded-md object-contain'} /> : null;
}
