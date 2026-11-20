# TecnoTop V5

## Flujo
Comprar ahora conserva el formulario directo. Comprar valida y calcula precios en el servidor, reserva inventario local y guarda cliente, pedido, historial y notificación pendiente dentro de una transacción MySQL. Después intenta notificar a Telegram. Un error de Telegram no revierte la compra.

Dropi permanece pausado en el código, incluso si una variable antigua dice true. Se conserva su historial y el Cron anterior, cuya sincronización devuelve paused sin consultar al proveedor ni modificar stock. Mantener también DROPI_ORDERS_ENABLED=false en Hostinger.

## Administración
- /admin/pedidos: búsqueda, filtros, orden por fecha y detalle individual.
- /admin/configuracion/notificaciones: vinculación, pruebas, reintentos y activación.
- Estados comerciales añadidos sin eliminar estados históricos.
- Observaciones privadas en AuditLog; cambios de estado públicos en TrackingEvent.
- Cancelar no repone stock automáticamente: el administrador debe comprobar y ajustar las unidades disponibles.

## Telegram
API oficial: https://core.telegram.org/bots/api
Token solo en backend. El chat provisional 0 nunca se usa. El destinatario real se obtiene únicamente de MySQL tras abrir un enlace de un solo uso y pulsar Iniciar. El código se guarda como hash, dura cinco minutos y requiere que la sesión administrativa que lo creó siga activa. Solo se aceptan chats privados y el secreto del webhook se verifica antes de leer el mensaje.

No se reemplazan webhooks ajenos. Nunca se utiliza getUpdates.

Los mensajes son texto plano, se dividen entre campos completos y se numeran. Cada parte tiene estado y un reclamo atómico antes de enviarse. Partes confirmadas no se repiten. Los errores explícitos permiten reintentar. Telegram no ofrece clave de idempotencia en sendMessage: un timeout, respuesta ambigua o proceso interrumpido requiere comprobar el chat antes de autorizar el reintento. No es posible prometer entrega exactamente una vez ante un resultado de red incierto.

## Cron y zona horaria
POST /api/cron/telegram-daily requiere Authorization: Bearer CRON_SECRET. Clave única diaria en Notification por fecha de America/Bogota. La prueba administrativa tiene otra clave y no modifica el envío diario.

Horario en Hostinger: 0 5 * * * (05:00 UTC = 00:00 Colombia). Crear una tarea independiente, conservar intacta la existente.
Referencia oficial: https://www.hostinger.com/support/how-to-run-cron-jobs-for-node-js-websites-at-hostinger/

## Activación
Se exige CHECKOUT_ENABLED=true, datos del titular y políticas completas/aprobadas, revisión del aviso de Telegram, chat vinculado, notificación de prueba aceptada y recepción confirmada por el propietario. El interruptor checkout-v5 en MySQL empieza apagado. Desvincular el bot vuelve a apagarlo. No se aprueban políticas ni se confirma recepción en nombre del propietario.

## Migración
202611200001_orders_telegram_v5 añade estados, teléfono normalizado auxiliar, método de pago, resumen de precios, campos de notificación y tablas de partes/códigos. Conserva el teléfono original y todos los datos históricos. No reinicia MySQL.

## Verificación
Pruebas con mocks: checkout local e idempotencia, inventario, combos/colores, teléfono original y WhatsApp, códigos y sesiones, webhook ajeno, secret header, chat 0, envío dividido, concurrencia, reintentos seguros, timeout incierto y fecha colombiana. No se crean pedidos reales durante las pruebas.
