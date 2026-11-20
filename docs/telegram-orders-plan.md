# Decisión: pedidos y notificaciones mediante Telegram

Estado: pendiente de implementación, por solicitud del propietario.

TecnoTop dejará de utilizar la API de Dropi. El proveedor podrá seguir utilizándose en la operación interna, pero no debe mencionarse en la experiencia del comprador.

En una próxima etapa, al confirmar una compra con el formulario completo y válido, la tienda guardará los datos del pedido de forma organizada y notificará al propietario mediante un bot de Telegram para recibirlos en su teléfono.

La acción «Comprar ahora» que abre el formulario no debe crear pedidos incompletos ni duplicados. La notificación corresponderá a la confirmación válida del pedido. Se conservarán validación del servidor, consentimiento, protección contra duplicados y almacenamiento histórico. Un fallo de Telegram no debe perder el pedido guardado.

Al implementar: configurar bot y destinatario privado, guardar credenciales únicamente en el servidor, acordar el contenido de la notificación y reemplazar las dependencias actuales de Dropi en checkout, inventario y administración. Revisar también los textos de error visibles al cliente.

Esta decisión documenta el cambio futuro: no activa Telegram, no desconecta todavía la integración existente y no modifica los permisos de venta actuales.
