/** Mensajes controlados: nunca trasladar cuerpos HTTP, SQL ni trazas a la UI. */
export class ErrorHttp extends Error {
  readonly reintentable: boolean;

  constructor(readonly status?: number, codigo?: string) {
    const mensajes: Record<number, string> = {
      400: 'No se pudo completar la solicitud. Revisa los datos ingresados.',
      401: 'Tu sesión no es válida. Inicia sesión nuevamente.',
      403: 'No tienes permiso para realizar esta acción.',
      404: 'El recurso solicitado no está disponible.',
      409: 'La operación entró en conflicto con los datos actuales. Actualiza y vuelve a intentarlo.',
      422: 'No se pudo completar la solicitud. Revisa los datos ingresados.',
      429: 'Hay demasiadas solicitudes. Espera un momento y vuelve a intentarlo.',
    };
    const confirmaciones: Record<string, string> = {
      UBICACION_INVALIDA: 'No se recibió una ubicación válida. Obtén tu ubicación actual y reintenta.',
      DESTINO_SIN_PUNTO: 'La entrega no tiene un punto válido. Pide a despacho que lo complete.',
      PRECISION_INSUFICIENTE: 'La precisión debe ser de 50 m o mejor. Activa la ubicación precisa y reintenta.',
      UBICACION_ANTIGUA: 'La ubicación debe tener menos de 30 segundos. Revisa el GPS y la hora del dispositivo y reintenta.',
      FUERA_RADIO_ENTREGA: 'Estás fuera del radio de confirmación o su margen de precisión. Acércate al destino y reintenta; si no puedes, contacta a despacho.',
    };
    const mensajeConfirmacion = status && [409, 422].includes(status) && codigo && Object.hasOwn(confirmaciones, codigo) ? confirmaciones[codigo] : undefined;
    super(mensajeConfirmacion ?? (status === undefined ? 'No se pudo conectar con el servidor. Comprueba tu conexión y reintenta.'
      : mensajes[status] ?? (status >= 500 ? 'El servidor no pudo completar la solicitud. Inténtalo de nuevo.' : 'No se pudo completar la solicitud.')));
    this.name = 'ErrorHttp';
    this.reintentable = status !== 401 && status !== 403;
  }
}
