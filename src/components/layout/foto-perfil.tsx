'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { prepararFoto } from '@/lib/preparar-foto';
import { FotoPrivada } from '@/components/pedidos/foto-privada';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth.store';

export function FotoPerfil() {
  const usuario = useAuthStore(s => s.usuario);
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const perfil = useQuery({ queryKey: ['mi-perfil', usuario?.id], enabled: !!usuario, queryFn: async () => (await apiClient.get<{ foto_actualizada: string | null }>('/api/perfil')).data });
  const guardar = useMutation({ mutationFn: async (file: File | null) => {
    if (!file) await apiClient.delete('/api/perfil/foto');
    else await apiClient.put('/api/perfil/foto', await prepararFoto(file), { headers: { 'Content-Type': 'image/jpeg' } });
  }, onSuccess: async () => { await client.invalidateQueries({ queryKey: ['mi-perfil'] }); await client.invalidateQueries({ queryKey: ['foto-privada'] }); } });
  return <>
    <div className="flex items-center gap-2">{perfil.data?.foto_actualizada && <FotoPrivada key={usuario?.id} path="/api/perfil/foto" alt="Tu foto de perfil" revision={perfil.data.foto_actualizada} compact />}<Button variant="outline" className="flex-1" onClick={() => setOpen(true)}>Mi foto de perfil</Button></div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="w-[calc(100vw-2rem)] sm:w-96" onClose={() => setOpen(false)} aria-labelledby="titulo-perfil">
      <DialogHeader><DialogTitle id="titulo-perfil">Mi foto de perfil</DialogTitle></DialogHeader>
      <p className="mb-3">{usuario?.nombre}</p>
      {perfil.data?.foto_actualizada ? <FotoPrivada key={usuario?.id} path="/api/perfil/foto" alt="Tu foto de perfil" revision={perfil.data.foto_actualizada} /> : <p>Tu perfil todavía no tiene foto.</p>}
      <label className="my-3 block">Seleccionar foto<input type="file" accept="image/jpeg,image/png,image/webp" disabled={guardar.isPending} className="mt-2 block w-full text-sm" onChange={event => {
        const file = event.target.files?.[0]; if (file) guardar.mutate(file); event.target.value = '';
      }} /></label>
      {guardar.isPending && <p role="status">Guardando foto…</p>}
      {guardar.isError && <p role="alert">{guardar.error.message}</p>}
      {perfil.data?.foto_actualizada && <Button variant="outline" disabled={guardar.isPending} onClick={() => guardar.mutate(null)}>Quitar foto</Button>}
    </DialogContent></Dialog>
  </>;
}
