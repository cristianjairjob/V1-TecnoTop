# Checkout y notas de entrega

Rama: `feature/checkout-delivery-notes-v1`.

## Formulario actual

Nombres y apellidos separados, celular colombiano, departamento/municipio,
dirección y complemento obligatorios. Correo sin asterisco, notas adicionales y
fecha solicitada opcionales. Si se elige fecha, debe ser al menos cinco días
calendario después del día actual en America/Bogota. Validación tanto en HTML
como en el servidor; formato almacenado YYYY-MM-DD. No es una promesa de entrega.

Comprar ahora abre checkout con el producto y cantidad seleccionados sin añadir
al carrito. Las tres promociones sustituyen la cantidad y se cotizan desde MySQL.
El subtotal visible corresponde al precio base; el descuento incluye el ahorro
por precio anterior/combo más el cupón. El total de pago no cambia. El consentimiento
obligatorio aparece debajo del total y sigue asociado al formulario mediante `form`.

## Persistencia y compatibilidad

Los nuevos pedidos guardan address.delivery con version=2, additionalNotes y
requestedDate, además del snapshot original del comprador. Order.deliveryNotes
contiene las notas opcionales, fecha (o ausencia explícita) y número interno.
El texto persistido se envía literalmente como notes a Dropi. No se inventan fechas.
El formato histórico de establecimiento/referencia sigue validándose y enviándose
sin modificaciones. No requiere migraciones ni transforma pedidos históricos.

Los departamentos y municipios son el listado DIVIPOLA DANE incluido en
src/data/colombia-locations.json. El servidor valida la correspondencia.

## Verificación

Typecheck, lint, 58 pruebas y build Node.js 22. Pruebas con MySQL/HTTP simulados:
campos requeridos, opcionales, límite de cinco días, cambio de año/día colombiano,
notas guardadas/enviadas, compatibilidad histórica, cupón y ahorro de combos,
idempotencia y bloqueo de productos de demostración.

No se crean pedidos reales ni se modifican variables de entorno, controles de
activación de ventas o la tarea de inventario. La prueba no confirma que Dropi
acepte pedidos reales.
