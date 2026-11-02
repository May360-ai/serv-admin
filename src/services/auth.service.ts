import { apiClient, setToken, removeToken } from '@/lib/api-client';
import type { LoginRequest, LoginResponse, RegistroRequest, Usuario } from '@/types';

function parseJwtPayload(token: string): { id?: number; rol_nombre?: string; proveedor_id?: number | null } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export const authService = {
  async login(body: LoginRequest): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/api/auth/login', body);
    
    // Extraer proveedor_id directamente del token JWT firmado por el backend
    const payload = parseJwtPayload(data.token);
    const usuarioCompleto: Usuario = {
      ...data.usuario,
      proveedor_id: payload?.proveedor_id ? String(payload.proveedor_id) : data.usuario.proveedor_id,
    };

    setToken(data.token, data.usuario.rol);
    if (typeof window !== 'undefined') {
      localStorage.setItem('serv_usuario', JSON.stringify(usuarioCompleto));
    }
    return { token: data.token, usuario: usuarioCompleto };
  },

  async registro(body: RegistroRequest): Promise<LoginResponse> {
    const payload = {
      nombre: body.nombre,
      email: body.email,
      password: body.password,
      rol_nombre: 'proveedor',
      nombre_comercial: body.nombre_comercial || `${body.nombre} Tienda`,
    };

    const { data } = await apiClient.post<{ token?: string; usuario?: Usuario }>('/api/auth/registro', payload);

    // Si el backend original no devuelve el token en el registro, logueamos de inmediato en el front
    if (!data.token) {
      return this.login({ email: body.email, password: body.password });
    }

    const jwtPayload = parseJwtPayload(data.token);
    const usuarioCompleto: Usuario = {
      ...data.usuario!,
      proveedor_id: jwtPayload?.proveedor_id ? String(jwtPayload.proveedor_id) : data.usuario?.proveedor_id,
    };

    setToken(data.token, usuarioCompleto.rol);
    if (typeof window !== 'undefined') {
      localStorage.setItem('serv_usuario', JSON.stringify(usuarioCompleto));
    }
    return { token: data.token, usuario: usuarioCompleto };
  },

  logout(): void {
    removeToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },

  getUsuarioActual(): Usuario | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('serv_usuario');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Usuario;
    } catch {
      return null;
    }
  },
};
