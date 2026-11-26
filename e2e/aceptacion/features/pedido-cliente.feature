# language: es
Característica: Pedido del cliente
  Como cliente de SERV
  Quiero pedir productos de una tienda y elegir cuándo los recibo
  Para recibirlos en mi dirección en Ambato

  Antecedentes:
    Dado que inicié sesión como "cliente"

  Escenario: Hacer un pedido para mañana con pago en efectivo
    Cuando agrego al carrito un producto de la tienda de pruebas
    Y confirmo el pedido para mañana con mi ubicación actual
    Entonces veo el pedido en "Mis Pedidos y Envíos" con estado "Pendiente"

  Escenario: No se puede confirmar sin punto de entrega
    Dado que no di permiso de ubicación
    Cuando agrego al carrito un producto de la tienda de pruebas
    Y abro el carrito
    Entonces el botón "Confirmar y Realizar Pedido" está deshabilitado

  Escenario: Cancelar un pedido que la tienda aún no aceptó
    Cuando agrego al carrito un producto de la tienda de pruebas
    Y confirmo el pedido para mañana con mi ubicación actual
    Y cancelo ese pedido
    Entonces veo el pedido en "Mis Pedidos y Envíos" con estado "Cancelado"
