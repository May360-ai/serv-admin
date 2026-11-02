'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
    setValue('password', 'password123', { shouldValidate: true });
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg mb-4">
            <Truck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">SERV</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestión de Entregas y Rutas</p>
        </div>

        <Card className="shadow-xl border-0">
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

            {/* Accesos rápidos de prueba por rol */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-2.5">
                Cuentas Demo Sembradas
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDemoCredentials('admin@serv.com')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-purple-200 bg-purple-50 text-purple-900 hover:bg-purple-100 transition-colors text-center"
                >
                  👑 Admin Global
                </button>
                <button
                  type="button"
                  onClick={() => setDemoCredentials('tienda@serv.com')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100 transition-colors text-center"
                >
                  🏪 Tienda (Carlos)
                </button>
                <button
                  type="button"
                  onClick={() => setDemoCredentials('cliente@serv.com')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-green-200 bg-green-50 text-green-900 hover:bg-green-100 transition-colors text-center"
                >
                  🛍️ Cliente (Lucía)
                </button>
                <button
                  type="button"
                  onClick={() => setDemoCredentials('repartidor@serv.com')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors text-center"
                >
                  🛵 Repartidor (Martín)
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2026 SERV — Logística de Última Milla
        </p>
      </div>
    </div>
  );
}
