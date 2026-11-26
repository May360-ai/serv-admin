# language: es
Característica: Gestión de pedidos de la tienda
  Como tienda
  Quiero aceptar o rechazar los pedidos que recibo
  Para que solo se despache lo que puedo preparar

  Escenario: La tienda acepta un pedido nuevo y el cliente lo ve aceptado
    Dado que el cliente hizo un pedido para mañana
    Cuando la tienda acepta ese pedido
    Entonces la tienda ve el pedido con estado "Aceptado"
    Y el cliente ve su pedido con estado "Aceptado"

  Escenario: La tienda rechaza un pedido
    Dado que el cliente hizo un pedido para mañana
    Cuando la tienda rechaza ese pedido
    Entonces el cliente ve su pedido con estado "Cancelado"

  Escenario: Un cliente no puede entrar al panel de la tienda
    Dado que inicié sesión como "cliente"
    Cuando intento abrir "/tienda/pedidos"
    Entonces veo la página "Acceso Restringido"
