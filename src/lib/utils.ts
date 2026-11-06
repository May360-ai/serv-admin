import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { EstadoPedido } from '@/types';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatFecha(fecha: string): string {
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(fecha));
}

export function formatHora(hora: string): string {
  return hora.slice(0, 5); // "09:00"
}

export function formatMoneda(monto: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(monto);
}

export function esMismoDia(fecha1: string, fecha2: string): boolean {
  return new Date(fecha1).toDateString() === new Date(fecha2).toDateString();
}

export function esUltimoMinuto(fecha_entrega: string, fecha_registro: string): boolean {
  const entrega = new Date(fecha_entrega);
  const registro = new Date(fecha_registro);
  const diffHoras = (entrega.getTime() - registro.getTime()) / (1000 * 60 * 60);
  return diffHoras <= 3;
}

export function getEstadoColor(estado: EstadoPedido): string {
  const colores: Record<EstadoPedido, string> = {
    pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    aceptado: 'bg-blue-100 text-blue-800 border-blue-200',
    agendado: 'bg-purple-100 text-purple-800 border-purple-200',
    en_progreso: 'bg-blue-100 text-blue-800 border-blue-200',
    en_camino: 'bg-orange-100 text-orange-800 border-orange-200',
    completado: 'bg-green-100 text-green-800 border-green-200',
    cancelado: 'bg-red-100 text-red-800 border-red-200',
  };
  return colores[estado];
}

export function getEstadoLabel(estado: EstadoPedido): string {
  const labels: Record<EstadoPedido, string> = {
    pendiente: 'Pendiente',
    aceptado: 'Aceptado',
    agendado: 'Agendado',
    en_progreso: 'En progreso',
    en_camino: 'En Camino',
    completado: 'Completado',
    cancelado: 'Cancelado',
  };
  return labels[estado];
}

export function calcularPorcentajeCapacidad(
  pedidos: number,
  capacidadMaxima: number
): number {
  return Math.min((pedidos / capacidadMaxima) * 100, 100);
}

export function truncarTexto(texto: string, maxLength: number): string {
  if (texto.length <= maxLength) return texto;
  return `${texto.slice(0, maxLength)}...`;
}

export function generarIniciales(nombre: string): string {
  return nombre
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
