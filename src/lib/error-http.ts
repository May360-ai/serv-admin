/** Mensajes controlados: nunca trasladar cuerpos HTTP, SQL ni trazas a la UI. */
export class ErrorHttp extends Error {
  readonly reintentable: boolean;

  constructor(readonly status?: number) {
    const mensajes: Record<number, string> = {
      400: 'No se pudo completar la solicitud. Revisa los datos ingresados.',
      401: 'Tu sesión no es válida. Inicia sesión nuevamente.',
      403: 'No tienes permiso para realizar esta acción.',
      404: 'El recurso solicitado no está disponible.',
      409: 'La operación entró en conflicto con los datos actuales. Actualiza y vuelve a intentarlo.',
      422: 'No se pudo completar la solicitud. Revisa los datos ingresados.',
      429: 'Hay demasiadas solicitudes. Espera un momento y vuelve a intentarlo.',
    };
    super(status === undefined ? 'No se pudo conectar con el servidor. Comprueba tu conexión y reintenta.'
      : mensajes[status] ?? (status >= 500 ? 'El servidor no pudo completar la solicitud. Inténtalo de nuevo.' : 'No se pudo completar la solicitud.'));
    this.name = 'ErrorHttp';
    this.reintentable = status !== 401 && status !== 403;
  }
}
