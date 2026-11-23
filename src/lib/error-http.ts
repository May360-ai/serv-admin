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
      FOTO_ENTREGA_REQUERIDA: 'Adjunta la foto del pedido antes de confirmar la entrega.',
      UBICACION_INVALIDA: 'No se recibió una ubicación válida. Obtén tu ubicación actual y reintenta.',
      DESTINO_SIN_PUNTO: 'La entrega no tiene un punto válido. Pide a despacho que lo complete.',
      PRECISION_INSUFICIENTE: 'La precisión debe ser de 50 m o mejor. Activa la ubicación precisa y reintenta.',
      UBICACION_ANTIGUA: 'La ubicación debe tener menos de 30 segundos. Revisa el GPS y la hora del dispositivo y reintenta.',
      FUERA_RADIO_ENTREGA: 'Estás fuera del radio de confirmación o su margen de precisión. Acércate al destino y reintenta; si no puedes, contacta a despacho.',
      SIN_SUCURSAL_ZONA: 'Esta tienda todavía no tiene una sucursal habilitada para la zona de entrega.',
      FUERA_ZONA_POLIGONO: 'El punto marcado está fuera de las zonas de reparto activas.',
      ZONA_INACTIVA: 'La zona seleccionada está inactiva.',
      ZONA_SOLAPADA: 'El área dibujada se superpone con otra zona activa.',
      ZONA_DUPLICADA: 'Ya existe una zona con ese nombre.',
      STOCK_INSUFICIENTE: 'No hay suficiente stock disponible para uno de los productos.',
      CONFLICTO_STOCK: 'El stock cambió mientras editabas. Actualiza el catálogo y revisa de nuevo.',
      FECHA_PASADA: 'La fecha de entrega programada debe ser hoy o una fecha futura.',
      RUTA_YA_SALIO: 'Conflicto de asignación: La ruta ya salió. Actualiza las opciones y vuelve a intentarlo.',
      PEDIDO_YA_ASIGNADO: 'Conflicto de asignación: Pedido ya asignado o ruta llena. Actualiza las opciones y vuelve a intentarlo.',
      REPARTIDOR_NO_DISPONIBLE: 'Conflicto de asignación: Repartidor no disponible. Actualiza las opciones y vuelve a intentarlo.',
      RUTA_DESTINO_LLENA: 'La ruta destino ya alcanzó su capacidad máxima.',
      REPARTIDOR_CON_RUTAS: 'Reasigna o cierra las rutas pendientes del repartidor antes de desactivarlo.',
      CUENTA_INACTIVA: 'Tu cuenta se encuentra inactiva. Contacta a administración.',
      CREDENCIALES_INVALIDAS: 'Correo o contraseña incorrectos.',
      EMAIL_DUPLICADO: 'Ese correo electrónico ya está registrado.',
      CEDULA_DUPLICADA: 'La cédula ya está registrada en otra cuenta.',
      CEDULA_INVALIDA: 'La cédula ingresada no es válida (validación módulo 10).',
      TELEFONO_DUPLICADO: 'El teléfono ya está registrado en otra cuenta.',
      DATOS_INCOMPLETOS: 'Revisa los datos ingresados. Hay campos obligatorios incompletos o inválidos.',
      CLIENTE_CON_PEDIDOS_ACTIVOS: 'No se puede suspender un cliente con pedidos pendientes o en ruta.',
      PASSWORD_ACTUAL_INCORRECTO: 'La contraseña actual es incorrecta.',
      PRODUCTO_DUPLICADO: 'Ya existe un producto con ese nombre o código en tu tienda.',
      PRODUCTO_EN_PEDIDO_ACTIVO: 'No se puede desactivar un producto incluido en pedidos activos o en ruta.',
      DIMENSIONES_INVALIDAS: 'El peso y las dimensiones deben ser números mayores a cero.',
      CAPACIDAD_INVALIDA: 'La capacidad máxima debe ser un entero entre 1 y 20.',
      CAPACIDAD_REPARTIDOR_EXCEDIDA: 'La ruta tiene más pedidos que la capacidad máxima de ese repartidor.',
      PEDIDO_EN_CAMINO: 'No puedes modificar ni cancelar un pedido que ya está en camino.',
      TRANSICION_INVALIDA: 'Esta transición de estado no está permitida.',
      PARADA_ANTERIOR_PENDIENTE: 'Completa primero la parada anterior de la ruta.',
      FECHA_REPROGRAMACION_INVALIDA: 'Elige una fecha y hora futuras válidas para reprogramar.',
      FECHA_REQUERIDA: 'Indica la fecha y hora de entrega.',
      FUERA_HORARIO: 'La tienda no atiende en la fecha y hora elegidas. Revisa su horario.',
      TIENDA_NO_DISPONIBLE: 'Esta tienda no está habilitada para recibir pedidos en este momento.',
      METODO_PAGO_INVALIDO: 'Elige un método de pago válido.',
      PAGO_CONFIRMADO: 'El pago de este pedido ya fue confirmado.',
      SALIDA_EN_CURSO: 'El repartidor debe terminar su ruta en curso antes de iniciar otra.',
    };
    const mensajeConfirmacion = status && status >= 400 && status < 500 && codigo && Object.hasOwn(confirmaciones, codigo) ? confirmaciones[codigo] : undefined;
    super(mensajeConfirmacion ?? (status === undefined ? 'No se pudo conectar con el servidor. Comprueba tu conexión y reintenta.'
      : mensajes[status] ?? (status >= 500 ? 'El servidor no pudo completar la solicitud. Inténtalo de nuevo.' : 'No se pudo completar la solicitud.')));
    this.name = 'ErrorHttp';
    this.reintentable = status !== 401 && status !== 403;
  }
}
