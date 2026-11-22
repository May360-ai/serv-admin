'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Apariencia } from '@/components/layout/apariencia';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Truck, Mail, Lock, User, Store } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const registroSchema = z.object({
  rol: z.enum(['cliente', 'proveedor']),
  nombre: z.string().min(2, 'Nombre demasiado corto'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  confirmar_password: z.string(),
  nombre_comercial: z.string().optional(),
}).refine((data) => data.password === data.confirmar_password, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmar_password'],
}).refine((data) => data.rol !== 'proveedor' || (data.nombre_comercial?.trim().length ?? 0) >= 2, {
  message: 'Indica el nombre comercial de tu tienda',
  path: ['nombre_comercial'],
});

type RegistroFormData = z.infer<typeof registroSchema>;

export default function RegistroPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegistroFormData>({
    resolver: zodResolver(registroSchema),
    defaultValues: { rol: 'cliente' },
  });

  const rolSeleccionado = watch('rol');

  const onSubmit = async (data: RegistroFormData) => {
    try {
      const response = await authService.registro({
        nombre: data.nombre,
        email: data.email,
        password: data.password,
        nombre_comercial: data.rol === 'proveedor' ? data.nombre_comercial?.trim() : undefined,
        rol: data.rol,
      });
      setAuth(response.usuario, response.token);
      toast.success('¡Cuenta creada exitosamente!');
      router.push('/dashboard');
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error al registrarse';
      toast.error(mensaje);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-16">
      <div className="absolute right-4 top-4"><Apariencia /></div>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary mb-4">
            <Truck className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">SERV</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {rolSeleccionado === 'proveedor' ? 'Registrá tu tienda' : 'Creá tu cuenta de cliente'}
          </p>
        </div>

        <Card className="border border-border shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Crear cuenta</CardTitle>
            <CardDescription>Elegí el tipo de cuenta y completá el formulario</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de cuenta">
                <button
                  type="button"
                  onClick={() => setValue('rol', 'cliente', { shouldValidate: true })}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    rolSeleccionado === 'cliente' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                  }`}
                >
                  Cliente
                </button>
                <button
                  type="button"
                  onClick={() => setValue('rol', 'proveedor', { shouldValidate: true })}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    rolSeleccionado === 'proveedor' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                  }`}
                >
                  Tienda
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre">Tu nombre</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="nombre"
                    placeholder="Juan García"
                    className="pl-9"
                    {...register('nombre')}
                  />
                </div>
                {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
              </div>

              {rolSeleccionado === 'proveedor' && (
              <div className="space-y-2">
                <Label htmlFor="nombre_comercial">Nombre comercial *</Label>
                <div className="relative">
                  <Store className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="nombre_comercial"
                    placeholder="Flores del Valle"
                    className="pl-9"
                    {...register('nombre_comercial')}
                  />
                </div>
                {errors.nombre_comercial && <p className="text-xs text-destructive">{errors.nombre_comercial.message}</p>}
              </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    className="pl-9"
                    {...register('email')}
                  />
                </div>
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-9"
                    {...register('password')}
                  />
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmar_password">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmar_password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-9"
                    {...register('confirmar_password')}
                  />
                </div>
                {errors.confirmar_password && (
                  <p className="text-xs text-destructive">{errors.confirmar_password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                isLoading={isSubmitting}
              >
                {isSubmitting ? 'Creando cuenta...' : 'Registrarse'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                ¿Ya tenés cuenta?{' '}
                <a href="/login" className="text-primary hover:underline font-medium">
                  Iniciá sesión
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
