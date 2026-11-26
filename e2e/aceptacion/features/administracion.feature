# language: es
Característica: Supervisión de la administración
  Como administrador
  Quiero ver la operación de todas las tiendas
  Para supervisar zonas, repartidores y pedidos

  Antecedentes:
    Dado que inicié sesión como "admin"

  Esquema del escenario: El administrador accede a cada módulo desde el menú
    Cuando abro "<opcion>" en el menú
    Entonces veo el título "<titulo>"

    Ejemplos:
      | opcion               | titulo                  |
      | Supervisión Global   | Dashboard               |
      | Pedidos Globales     | Supervisión de pedidos  |
      | Zonas de Reparto     | Zonas de Entrega        |
      | Gestión Repartidores | Gestión de repartidores |
      | Tiendas              | Tiendas                 |
      | Clientes             | Clientes                |

  Escenario: El repartidor solo trabaja desde la app Android
    Dado que estoy en la página de inicio de sesión
    Cuando inicio sesión con la cuenta de repartidor
    Entonces sigo en el inicio de sesión con el aviso "Los repartidores trabajan desde la app Android de SERV"
