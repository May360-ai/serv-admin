'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Apariencia } from '@/components/layout/apariencia';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Truck, Mail, Lock } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const setDemoCredentials = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', process.env.NEXT_PUBLIC_SERV_DEMO_PASSWORD ?? '', { shouldValidate: true });
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await authService.login(data);
      setAuth(response.usuario, response.token);
      toast.success(`Bienvenido, ${response.usuario.nombre}`);
      router.push('/dashboard');
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error al iniciar sesión';
      toast.error(mensaje);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-16">
      <div className="absolute right-4 top-4"><Apariencia /></div>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary mb-4">
            <Truck className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">SERV</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestión de Entregas y Rutas</p>
        </div>

        <Card className="border border-border shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Iniciar Sesión</CardTitle>
            <CardDescription>Ingresá tus credenciales para acceder al panel</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    className="pl-9"
                    data-cy="input-email"
                    autoComplete="email"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
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
                    data-cy="input-password"
                    autoComplete="current-password"
                    {...register('password')}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                isLoading={isSubmitting}
                data-cy="btn-login"
              >
                {isSubmitting ? 'Iniciando sesión...' : 'Ingresar'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                ¿Primera vez?{' '}
                <a href="/registro" className="text-primary hover:underline font-medium">
                  Registrá tu tienda
                </a>
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_SERV_DEMO_PASSWORD && (
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-2.5">
                Probar con una cuenta demo
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDemoCredentials('admin@serv.com')}
                  className="px-3 py-2 text-sm rounded-md border border-border text-left hover:bg-accent"
                >
                  Administración
                </button>
                <button
                  type="button"
                  onClick={() => setDemoCredentials('tienda@serv.com')}
                  className="px-3 py-2 text-sm rounded-md border border-border text-left hover:bg-accent"
                >
                  Tienda · Carlos
                </button>
                <button
                  type="button"
                  onClick={() => setDemoCredentials('cliente@serv.com')}
                  className="px-3 py-2 text-sm rounded-md border border-border text-left hover:bg-accent"
                >
                  Cliente · Lucía
                </button>
                <button
                  type="button"
                  onClick={() => setDemoCredentials('repartidor@serv.com')}
                  className="px-3 py-2 text-sm rounded-md border border-border text-left hover:bg-accent"
                >
                  Repartidor · Martín
                </button>
              </div>
            </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2026 SERV — Logística de Última Milla
        </p>
      </div>
    </div>
  );
}
