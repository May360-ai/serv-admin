'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { BASE_URL, getToken } from '@/lib/api-client';
import type { SocketEventMap } from '@/types';

type EventHandler<K extends keyof SocketEventMap> = (
  data: SocketEventMap[K]
) => void;

interface UseSocketOptions {
  enabled?: boolean;
}

interface UseSocketReturn {
  socket: Socket | null;
  on: <K extends keyof SocketEventMap>(event: K, handler: EventHandler<K>) => void;
  off: <K extends keyof SocketEventMap>(event: K, handler: EventHandler<K>) => void;
  emit: (event: string, data: unknown) => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { enabled = true } = options;
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const token = getToken();
    // No intentar conectar en pantallas públicas si no hay token aún
    if (!token) return;

    const socket = io(BASE_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.info('[Socket] Conectado exitosamente:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Desconectado:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Advertencia de conexión:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  const on = useCallback(
    <K extends keyof SocketEventMap>(event: K, handler: EventHandler<K>) => {
      socketRef.current?.on(event as string, handler as (data: unknown) => void);
    },
    []
  );

  const off = useCallback(
    <K extends keyof SocketEventMap>(event: K, handler: EventHandler<K>) => {
      socketRef.current?.off(event as string, handler as (data: unknown) => void);
    },
    []
  );

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { socket: socketRef.current, on, off, emit };
}
