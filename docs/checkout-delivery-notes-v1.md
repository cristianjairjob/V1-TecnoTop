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

## Colores por unidad y galería

La migración 202611190002_product_colors añade Product.colorOptions (JSON nullable).
Admin permite activar colores, indicar cantidad, elegir entre 30 tonos o personalizar
cualquier nombre/hex y vincular cada opción a una variante existente de inventario/Dropi.
El total configurado del combo se distribuye en centavos sin cambiar el importe pagado.
Sin precio de combo, se suman los precios de las variantes seleccionadas.
El servidor bloquea colores inválidos, incompletos, sin vínculo y stock insuficiente.
Cada OrderItem conserva el nombre del color y su variantId/dropiVariantId.
No se crean variantes ficticias de Dropi ni se modifican pedidos históricos.

Galería con deslizamiento táctil y flechas superpuestas. Alerta de últimas unidades
solo cuando el inventario real está entre 1 y 10; muestra la cantidad real.
Reloj sincronizado mediante el inicio de sesión del navegador, estático en producto
y flotante únicamente en checkout. Guía de dirección sin enlaces de ampliación.
Subtotal tachado; envío gratis sin tarifa anterior inventada.

Validación: 61 pruebas, incluidas órdenes con colores mixtos y respuestas Dropi simuladas.
