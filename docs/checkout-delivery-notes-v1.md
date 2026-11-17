# Checkout y notas de entrega V1

Rama: `feature/checkout-delivery-notes-v1`.

El checkout exige nombres y apellidos separados, teléfono colombiano, correo,
departamento, ciudad, dirección, complemento, establecimiento, referencia y fecha
solicitada. La fecha se guarda como `YYYY-MM-DD`, se presenta como `DD/MM/YYYY` y
se valida contra el día actual de `America/Bogota`. La interfaz aclara que no es
una promesa de entrega.

## Archivos

| Archivo | Cambio |
| --- | --- |
| `src/components/cart-checkout.tsx` | Campos requeridos, selector de fecha, aclaración y validación previa al envío. |
| `src/components/admin.tsx` | Datos de entrega, notas exactas y botón para copiar; distingue registros históricos sin datos. |
| `src/lib/validation.ts` | Validaciones obligatorias del servidor y del formulario. |
| `src/lib/delivery.ts` | Fecha de Colombia, formato de presentación y construcción única de notas. |
| `src/lib/order-details.ts` | Snapshot de comprador, dirección y entrega; notas persistentes. |
| `src/lib/checkout.ts` | Guarda el snapshot y las notas en la transacción existente. |
| `src/services/dropi/order-payload.ts` | Valida datos guardados y copia las notas literalmente al payload. |
| `src/services/dropi/orders.ts` | Construye y valida el payload antes de reclamar el envío. |
| `prisma/schema.prisma` | Nombres/apellidos separados y columna de notas. |
| `prisma/migrations/202611170003_checkout_delivery_notes/migration.sql` | Migración aditiva, sin borrar ni transformar datos anteriores. |
| `tests/checkout-delivery-notes.test.ts` | 23 pruebas nuevas de validación, persistencia, payload e idempotencia. |
| `tests/security.test.ts` | Actualiza datos del checkout en la prueba existente. |
| `.github/workflows/ci.yml` | Ejecuta CI también en la rama solicitada. |
| `docs/checkout-delivery-notes-v1.md` | Este informe. |

## Persistencia y compatibilidad

`Customer.name` se conserva. Se agregan `firstName` y `lastName` anulables para no
inventar datos históricos. Cada nuevo pedido guarda `address.buyer` (nombres,
apellidos, teléfono y correo), `address.delivery` (establecimiento, referencia y
fecha) y `Order.deliveryNotes` en la misma transacción que reserva inventario.

El payload de `POST orders/myorders` usa `notes` sin parámetros adicionales.
El texto contiene LOCAL, REFERENCIA, FECHA SOLICITADA DE ENTREGA y PEDIDO TECNOTOP.
Antes del envío se comprueba que el texto almacenado coincide con los datos
estructurados. No se divide ningún nombre completo. Un pedido antiguo incompleto
requiere revisión y se bloquea antes de pasar a SENDING. Una fecha histórica válida
no se recalcula ni se descarta durante un reintento. Las notas no se borran si
Dropi rechaza el pedido o falla la conexión.

## Verificación local

- `npm run typecheck`: correcto.
- `npm run lint`: correcto.
- `npm test`: 37 pruebas correctas (14 existentes y 23 nuevas).
- `npm run build`: correcto con Node.js 22.
- `git diff --check`: correcto.

Las pruebas cubren campos vacíos/incorrectos, fechas pasadas e inexistentes,
fecha válida, cambio de día en Colombia, nombres compuestos, formato exacto,
notas incompletas, conservación histórica, notas persistidas antes del POST,
igualdad entre texto almacenado/enviado, respuesta aceptada y error 401 simulados,
reintentos idempotentes, cambios de solicitud, contraentrega y envío gratuito.
MySQL y HTTP se sustituyen por mocks en las pruebas de pedidos: no se crean pedidos
reales ni se modifica la configuración de producción.

La compilación local no tiene DATABASE_URL y omite migraciones. En Hostinger,
el script de compilación existente ejecuta `prisma migrate deploy` sobre MySQL.
La carga del checkout vacío se comprobó en navegador local; la revisión visual
del formulario con productos y del detalle administrativo con pedidos reales
no se realizó porque no hay registros de prueba cargados.

## Estado operativo requerido

Conservar `CHECKOUT_ENABLED=false` y `DROPI_ORDERS_ENABLED=false`.
No se cambia ninguna variable de entorno ni la tarea de inventario cada ocho horas.
La conexión real con Dropi permanece pendiente; estas pruebas no verifican su
aceptación real de pedidos ni activan ventas.
