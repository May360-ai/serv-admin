'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, getToken } from '@/lib/api-client';
import { prepararFoto } from '@/lib/preparar-foto';
import { direccionesService } from '@/services/direcciones.service';
import { FotoPrivada } from '@/components/pedidos/foto-privada';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAuthStore } from '@/store/auth.store';

interface PerfilRespuesta {
  id: number;
  nombre: string;
  apellido?: string | null;
  email: string;
  telefono?: string | null;
  cedula?: string | null;
  rol: string;
  foto_actualizada: string | null;
  direccion_habitual?: {
    id: number;
    nombre_ubicacion: string;
    direccion: string;
    referencia: string | null;
    ciudad: string;
    zona?: { id: string; nombre: string } | null;
  } | null;
  calificacion_promedio?: number | null;
  cantidad_resenas?: number;
}

export function FotoPerfil() {
  const usuario = useAuthStore(s => s.usuario);
  const setAuth = useAuthStore(s => s.setAuth);
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccionPrincipalId, setDireccionPrincipalId] = useState('');
  const [direccionTexto, setDireccionTexto] = useState('');
  const [ciudad, setCiudad] = useState('Ambato');
  const [referencia, setReferencia] = useState('');
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNuevo, setPasswordNuevo] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [errorClaveLocal, setErrorClaveLocal] = useState<string | null>(null);

  const client = useQueryClient();
  const perfil = useQuery({
    queryKey: ['mi-perfil', usuario?.id],
    enabled: !!usuario,
    queryFn: async () => (await apiClient.get<PerfilRespuesta>('/api/perfil')).data,
  });
  const misDirecciones = useQuery({
    queryKey: ['mis-direcciones-perfil', usuario?.id],
    enabled: open && usuario?.rol === 'cliente',
    queryFn: direccionesService.listarMias,
  });

  const guardar = useMutation({
    mutationFn: async (file: File | null) => {
      if (!file) await apiClient.delete('/api/perfil/foto');
      else await apiClient.put('/api/perfil/foto', await prepararFoto(file), { headers: { 'Content-Type': 'image/jpeg' } });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['mi-perfil'] });
      await client.invalidateQueries({ queryKey: ['foto-privada'] });
    },
  });

  const guardarDatos = useMutation({
    mutationFn: async () => {
      const nombreLimpio = nombre.trim();
      if (nombreLimpio.length < 2) throw new Error('El nombre debe tener al menos 2 caracteres.');
      const payload: Record<string, unknown> = {
        nombre: nombreLimpio,
        apellido: apellido.trim() || null,
        telefono: telefono.trim() || null,
      };
      if (usuario?.rol === 'cliente') {
        const dirActual = perfil.data?.direccion_habitual;
        const dirEditada =
          direccionTexto.trim() !== (dirActual?.direccion ?? '') ||
          ciudad.trim() !== (dirActual?.ciudad ?? 'Ambato') ||
          referencia.trim() !== (dirActual?.referencia ?? '');
        if (dirEditada && direccionTexto.trim()) {
          payload.direccion_habitual = {
            direccion: direccionTexto.trim(),
            ciudad: ciudad.trim() || 'Ambato',
            referencia: referencia.trim() || null,
          };
        } else if (direccionPrincipalId && direccionPrincipalId !== String(dirActual?.id ?? '')) {
          payload.direccion_principal_id = Number(direccionPrincipalId);
        }
      }
      const { data } = await apiClient.patch<{ data: { nombre: string } }>('/api/perfil', payload);
      return data.data;
    },
    onSuccess: async (actualizado) => {
      const token = getToken();
      if (usuario && token) {
        const siguiente = { ...usuario, nombre: actualizado.nombre };
        setAuth(siguiente, token);
        if (typeof window !== 'undefined') localStorage.setItem('serv_usuario', JSON.stringify(siguiente));
      }
      await client.invalidateQueries({ queryKey: ['mi-perfil'] });
      await client.invalidateQueries({ queryKey: ['mis-direcciones-perfil'] });
    },
  });

  const cambiarClave = useMutation({
    mutationFn: async () => {
      await apiClient.patch('/api/perfil/password', {
        password_actual: passwordActual,
        password_nuevo: passwordNuevo,
      });
    },
    onSuccess: () => {
      setPasswordActual('');
      setPasswordNuevo('');
      setConfirmarPassword('');
      setErrorClaveLocal(null);
    },
  });

  const abrirModal = () => {
    const p = perfil.data;
    setNombre(p?.nombre ?? usuario?.nombre ?? '');
    setApellido(p?.apellido ?? '');
    setTelefono(p?.telefono ?? '');
    setDireccionPrincipalId(p?.direccion_habitual ? String(p.direccion_habitual.id) : '');
    setDireccionTexto(p?.direccion_habitual?.direccion ?? '');
    setCiudad(p?.direccion_habitual?.ciudad ?? 'Ambato');
    setReferencia(p?.direccion_habitual?.referencia ?? '');
    setPasswordActual('');
    setPasswordNuevo('');
    setConfirmarPassword('');
    setErrorClaveLocal(null);
    guardar.reset();
    guardarDatos.reset();
    cambiarClave.reset();
    setOpen(true);
  };

  return <>
    <div className="flex items-center gap-2">
      {perfil.data?.foto_actualizada && <FotoPrivada key={usuario?.id} path="/api/perfil/foto" alt="Tu foto de perfil" revision={perfil.data.foto_actualizada} compact />}
      <Button variant="outline" className="flex-1" onClick={abrirModal}>Mi perfil</Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-[28rem]" onClose={() => setOpen(false)} aria-labelledby="titulo-perfil">
        <DialogHeader><DialogTitle id="titulo-perfil">Mi perfil</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground mb-3">{perfil.data?.email ?? usuario?.email}</p>
        {usuario?.rol === 'repartidor' && (
          <p className="mb-3 text-sm">
            {perfil.data?.calificacion_promedio != null
              ? `${perfil.data.calificacion_promedio.toFixed(1)}/5 · ${perfil.data.cantidad_resenas ?? 0} entregas valoradas`
              : 'Sin valoraciones de entregas'}
          </p>
        )}

        <div className="space-y-3 border-b pb-4">
          <h3 className="text-sm font-semibold">Foto de perfil</h3>
          {perfil.data?.foto_actualizada ? <FotoPrivada key={usuario?.id} path="/api/perfil/foto" alt="Tu foto de perfil" revision={perfil.data.foto_actualizada} /> : <p className="text-sm text-muted-foreground">Tu perfil todavía no tiene foto.</p>}
          <label className="block text-sm">Seleccionar foto
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={guardar.isPending} className="mt-1.5 block w-full text-sm" onChange={event => {
              const file = event.target.files?.[0];
              if (file) guardar.mutate(file);
              event.target.value = '';
            }} />
          </label>
          {guardar.isPending && <p role="status" className="text-sm">Guardando foto…</p>}
          {guardar.isError && <p role="alert" className="text-sm text-destructive">{guardar.error.message}</p>}
          {perfil.data?.foto_actualizada && <Button variant="outline" size="sm" disabled={guardar.isPending} onClick={() => guardar.mutate(null)}>Quitar foto</Button>}
        </div>

        <form className="mt-4 space-y-3 border-b pb-4" onSubmit={e => { e.preventDefault(); guardarDatos.mutate(); }}>
          <h3 className="text-sm font-semibold">Datos personales</h3>
          <label className="block text-sm">Nombre *<Input value={nombre} minLength={2} maxLength={100} required disabled={guardarDatos.isPending} onChange={e => setNombre(e.target.value)} /></label>
          <label className="block text-sm">Apellido<Input value={apellido} maxLength={100} disabled={guardarDatos.isPending} onChange={e => setApellido(e.target.value)} /></label>
          <label className="block text-sm">Teléfono<Input type="tel" value={telefono} maxLength={20} disabled={guardarDatos.isPending} onChange={e => setTelefono(e.target.value)} /></label>
          {usuario?.rol === 'cliente' && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium text-muted-foreground">Dirección habitual de entrega</p>
              {(misDirecciones.data?.length ?? 0) > 0 && (
                <label className="block text-sm">Dirección guardada
                  <Select value={direccionPrincipalId} onChange={e => {
                    const idElegido = e.target.value;
                    setDireccionPrincipalId(idElegido);
                    const encontrada = misDirecciones.data?.find(d => String(d.id) === idElegido);
                    if (encontrada) {
                      setDireccionTexto(encontrada.direccion);
                      setCiudad(encontrada.ciudad);
                      setReferencia(encontrada.referencia ?? '');
                    }
                  }}>
                    <option value="">Selecciona o escribe abajo</option>
                    {misDirecciones.data?.map(d => (
                      <option key={d.id} value={String(d.id)}>{d.nombre_ubicacion}: {d.direccion}</option>
                    ))}
                  </Select>
                </label>
              )}
              <label className="block text-sm">Dirección<Input value={direccionTexto} maxLength={255} placeholder="Av. Los Guaytambos y Las Dalias" disabled={guardarDatos.isPending} onChange={e => setDireccionTexto(e.target.value)} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">Ciudad<Input value={ciudad} maxLength={100} disabled={guardarDatos.isPending} onChange={e => setCiudad(e.target.value)} /></label>
                <label className="block text-sm">Referencia<Input value={referencia} maxLength={255} disabled={guardarDatos.isPending} onChange={e => setReferencia(e.target.value)} /></label>
              </div>
            </div>
          )}
          {guardarDatos.isError && <p role="alert" className="text-sm text-destructive">{guardarDatos.error.message}</p>}
          {guardarDatos.isSuccess && <p role="status" className="text-sm">Datos actualizados.</p>}
          <Button type="submit" size="sm" isLoading={guardarDatos.isPending}>Guardar datos</Button>
        </form>

        <form className="mt-4 space-y-3" onSubmit={e => {
          e.preventDefault();
          if (passwordNuevo.length < 8) { setErrorClaveLocal('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
          if (passwordNuevo !== confirmarPassword) { setErrorClaveLocal('Las contraseñas nuevas no coinciden.'); return; }
          if (passwordNuevo === passwordActual) { setErrorClaveLocal('La nueva contraseña debe ser diferente a la actual.'); return; }
          setErrorClaveLocal(null);
          cambiarClave.mutate();
        }}>
          <h3 className="text-sm font-semibold">Cambiar contraseña</h3>
          <label className="block text-sm">Contraseña actual<Input type="password" value={passwordActual} required autoComplete="current-password" disabled={cambiarClave.isPending} onChange={e => setPasswordActual(e.target.value)} /></label>
          <label className="block text-sm">Nueva contraseña<Input type="password" value={passwordNuevo} minLength={8} maxLength={72} required autoComplete="new-password" disabled={cambiarClave.isPending} onChange={e => setPasswordNuevo(e.target.value)} /></label>
          <label className="block text-sm">Confirmar nueva contraseña<Input type="password" value={confirmarPassword} minLength={8} maxLength={72} required autoComplete="new-password" disabled={cambiarClave.isPending} onChange={e => setConfirmarPassword(e.target.value)} /></label>
          {(errorClaveLocal || cambiarClave.isError) && <p role="alert" className="text-sm text-destructive">{errorClaveLocal ?? cambiarClave.error?.message}</p>}
          {cambiarClave.isSuccess && <p role="status" className="text-sm">Contraseña actualizada.</p>}
          <Button type="submit" size="sm" variant="outline" isLoading={cambiarClave.isPending}>Actualizar contraseña</Button>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
