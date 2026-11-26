# Meta Pixel + CAPI en TecnoTop

## Diagnóstico del 26/11/2026

La consulta pública de `https://tecnotop.com.co/` devolvió 200, pero sin banner/componente de Meta y con CSP anterior (`script-src 'self' 'unsafe-inline'`, `connect-src 'self'`). `GET /api/meta-capi` devolvió 404; con esta implementación publicada debe devolver 405 porque solo admite POST. Los archivos Meta siguen sin commit/push localmente: el código de seguimiento todavía no está desplegado. No se verificaron las variables privadas de Hostinger ni se enviaron eventos reales.

Corrección limitada a Meta: `meta-config.ts` lee dinámicamente las cuatro variables en el servidor y recorta espacios; el layout pasa únicamente el ID público al componente. Consentimiento inválido ya no oculta el aviso, y almacenamiento local bloqueado permite conservar una elección explícita en memoria durante esa página. Se mantiene el bloqueo de medición sin aceptación. No se modificó `meta-schema.ts`: su validación no explica el 404 ni la ausencia del banner.

Diagnóstico tras desplegar:

- Sin ID numérico no aparece el aviso. Con elección guardada se muestra «Preferencias de privacidad» en lugar del aviso inicial. Para repetir la prueba, usar una ventana privada o borrar únicamente `tecnotop-meta-consent-v1` de Local Storage y recargar.
- Tras aceptar: en Red deben aparecer `connect.facebook.net/en_US/fbevents.js`, solicitudes del Píxel a Facebook y POST `/api/meta-capi` al recorrer el checkout. GET 404 indica versión sin endpoint; GET 405 es normal. La llamada a Graph es servidor→servidor y no aparece en Red del navegador.
- Respuesta 503 `META_CONFIG_MISSING`: ID/token ausente o ID inválido. 400: validación; 403: origen/comprobante; 429: límite; 502 `failed`: revisar logs `[meta-capi]`.
- Logs: `GRAPH_REJECTED` incluye estado HTTP y códigos numéricos de Meta; `SEND_OR_ACK_FAILED` identifica error de red/timeout/respuesta/confirmación local; `LEDGER_UNAVAILABLE` indica revisar conexión/migración `MetaEvent`; `REQUEST_FAILED` marca error de la petición. No contienen token, URL privada, mensaje de error bruto ni datos personales.
- Con `META_TEST_EVENT_CODE=TEST87719`, una aceptación real de Graph registra `TEST_EVENT_ACCEPTED`, `eventsReceived: 1` y si hubo IP. Si existe ese log pero no aparece en Probar eventos, comprobar que el ID/token/código pertenecen al conjunto de datos abierto. El código de prueba se envía únicamente en CAPI.
- Consola del navegador: `[meta-pixel] SCRIPT_BLOCKED`, `[meta-capi] HTTP_ERROR` o `NETWORK_ERROR` permiten distinguir bloqueo del script y problemas del endpoint.

17 pruebas específicas de Meta aprobadas tras esta corrección, sin tráfico real a Meta.

Implementación local preparada para revisión antes de commit/push/despliegue. No contiene credenciales reales.

## Configuración

En `.env` local (ignorado por Git) y en Hostinger → aplicación Node.js → variables de entorno:

```dotenv
NEXT_PUBLIC_META_PIXEL_ID=
META_CAPI_ACCESS_TOKEN=
META_TEST_EVENT_CODE=
META_CLIENT_IP_HEADER=
```

- `NEXT_PUBLIC_META_PIXEL_ID`: ID numérico del píxel/conjunto de datos. Es público y debe corresponder al token usado por CAPI.
- `META_CAPI_ACCESS_TOKEN`: token privado de CAPI. Nunca lleva prefijo `NEXT_PUBLIC_`, nunca se envía al navegador ni se registra en logs.
- `META_TEST_EVENT_CODE`: código de Administrador de eventos → Probar eventos. Opcional; retirar para medición de producción. Solo modifica CAPI, no convierte automáticamente eventos del navegador en pruebas.
- `META_CLIENT_IP_HEADER`: encabezado que el proxy de confianza **sobrescribe** con la IP real del visitante. Por ejemplo `x-forwarded-for`, solamente después de verificar ese comportamiento en Hostinger; toma su primera dirección y valida IPv4/IPv6. Si el proxy agrega en lugar de sobrescribir o el servidor es accesible directamente, no confiar en ese encabezado. Vacío = omitir IP, sin inventarla ni aceptar la enviada en JSON. En localhost puede quedar vacío.

Conservar las variables existentes. `APP_URL` debe ser el origen del entorno (por ejemplo `http://localhost:3000` local y `https://tecnotop.com.co` en Hostinger). Usar una base **de desarrollo** para probar; no copiar la conexión de producción al entorno de pruebas. No cambiar Telegram, Cron, Dropi ni los interruptores de ventas para instalar Meta.

Aplicar la migración aditiva y generar Prisma en desarrollo:

```sh
npm run db:generate
npm run db:migrate
npm run dev
```

El build existente de Hostinger aplica migraciones cuando `DATABASE_URL` está configurada. La tabla nueva `MetaEvent` guarda únicamente ID/nombre del evento y marcas de tiempo de envío/bloqueo; no guarda tokens, IP, cookies ni datos personales. No altera pedidos históricos.

## Flujo real y deduplicación

| Evento | Momento | Identificador / datos |
|---|---|---|
| PageView | Inicialización autorizada y cambio de ruta pública | Solo Píxel; no se carga en administración |
| InitiateCheckout | Formulario de checkout con una cotización válida, ventas habilitadas y consentimiento publicitario | UUID por entrada al formulario; solo IP/UA/cookies en CAPI |
| AddPaymentInfo | Envío válido del formulario: se confirma la modalidad contraentrega | UUID conservado al reintentar el mismo formulario; em/ph/fn/ln |
| Purchase | Pedido guardado correctamente | UUID de idempotencia del checkout, compartido con el navegador; em/ph/fn/ln/ct/st; total del pedido guardado y COP |

Purchase significa **pedido contraentrega recibido**, no dinero cobrado ni entrega completada. No se dispara al pulsar comprar en la ficha ni con validación fallida. En este flujo no hay tarjeta ni pasarela de pago.

Los campos reales son `firstName`, `lastName`, `phone`, `email`, `city` y `state`. El email vacío se omite. Teléfono: normalizar a `57` + diez dígitos colombianos; nombres, apellidos, correo, ciudad y departamento: minúsculas, extremos sin espacios y espacios internos consecutivos reducidos a uno. SHA-256 se calcula únicamente en servidor. IP, User-Agent, `_fbp` y `_fbc` no se hashean.

El helper usa `fbq('track', nombre, datos, { eventID: uuid })` y envía ese mismo `event_id` a `/api/meta-capi`. No envía nombres/teléfonos/correos como parámetros de `fbq`. Purchase se despacha también desde la respuesta del checkout, para no depender exclusivamente del navegador. El endpoint solo admite Purchase con un comprobante firmado, válido 24 horas, y vuelve a consultar el total y comprador del pedido en MySQL; ignora importes o compradores aportados por el cliente. No existe endpoint público para inventar compras.

El registro MySQL impide reenvíos CAPI ya aceptados y reclama envíos concurrentes. Los reintentos conservan ID y fecha; Meta desduplica navegador/servidor por nombre e ID. Hay hasta dos intentos por llamada ante error transitorio y hasta dos llamadas del helper. No se añade un Cron ni se garantiza recuperación automática si el proceso cae y el comprador abandona; no hay una cola duradera de payloads personales. Un fallo de Meta no revierte ni bloquea un pedido guardado.

Los pedidos `TT-PRUEBA-…` se excluyen de Purchase salvo que exista `META_TEST_EVENT_CODE`. Las etapas anteriores pueden registrarse al recorrer el formulario de demostración: probar preferentemente con un conjunto de datos de pruebas.

## Consentimiento y seguridad

Sin ID no aparece el aviso ni se carga Meta. Con ID aparece un aviso separado del consentimiento obligatorio del pedido, con Aceptar/Rechazar y acceso permanente a preferencias. Sin autorización no se carga el script ni se envían eventos de negocio; rechazar no impide comprar. La retirada detiene nuevos envíos, no borra retroactivamente los anteriores. No se utiliza un píxel `noscript` que eluda esta elección.

Se amplía CSP únicamente con los dominios de script/conexión de Meta necesarios. La URL CAPI se fija a `https://graph.facebook.com/v21.0/{PIXEL_ID}/events?access_token={TOKEN}`, según lo solicitado; el token no se muestra en respuestas ni logs. El endpoint exige mismo origen, consentimiento, UUID, límites de tamaño y frecuencia. La URL fuente debe pertenecer a la tienda; se quitan query y fragmento para no transmitir datos de formularios en URLs.

## Verificar antes de hacer git push

1. Usar una base/catálogo de desarrollo y, preferentemente, un píxel de pruebas. Guardar las variables privadas localmente. En Meta → Administrador de eventos → conjunto de datos → **Probar eventos**, copiar el código en `META_TEST_EVENT_CODE`. Reiniciar el servidor al cambiar variables.
2. Abrir la tienda local en un navegador sin bloqueadores. Rechazar medición y verificar que no hay `fbevents.js`, solicitudes `facebook.com/tr` ni POST de eventos a `/api/meta-capi`. Aceptar desde Preferencias de privacidad: comprobar PageView.
3. Abrir un checkout con productos válidos: observar InitiateCheckout. Completar datos ficticios válidos en desarrollo y enviar el formulario: observar AddPaymentInfo. Solo si se guarda el pedido, observar Purchase. Esto consume inventario de desarrollo y, si Telegram está configurado allí, podría notificar: usar una configuración de desarrollo aislada, no la de producción.
4. En las herramientas del navegador, comparar el `eventID` del Píxel con `event_id` del POST a `/api/meta-capi`. Purchase debe coincidir con `meta.eventId` de la respuesta `/api/checkout`. En **Probar eventos**, revisar origen Navegador/Servidor, mismo nombre e ID y desduplicación. Meta puede tardar en mostrar el resultado. No asumir deduplicación solo porque aparecen dos filas.
5. Revisar moneda COP y total real (después de descuentos, sin sumar ahorros ficticios). En el servidor, el payload CAPI tiene SHA-256 para los datos personales; no inspeccionar ni copiar URLs con el token a capturas o incidencias públicas. DevTools verá los datos originales enviados **a nuestro backend**, nunca el token ni el POST servidor→Meta.
6. Probar formulario inválido, doble clic/reintento y recarga de confirmación: no deben crear un nuevo Purchase por el mismo pedido. Probar retirar consentimiento: no debe generar nuevos eventos. Verificar que `/admin` no genera PageView.
7. Tras verificar, retirar `META_TEST_EVENT_CODE` y utilizar las credenciales definitivas en Hostinger cuando se autorice publicar. No he hecho push ni desplegado esta integración.

## Archivos

Nuevos: `src/lib/meta-schema.ts`, `src/lib/meta-browser.ts`, `src/lib/meta-capi.ts`, `src/components/meta-pixel.tsx`, `src/app/api/meta-capi/route.ts`, `prisma/migrations/202611250001_meta_events/migration.sql`, `tests/meta-browser.test.ts`, `tests/meta-capi.test.ts`, este documento.

Modificados: `.env.example`, `next.config.mjs`, `prisma/schema.prisma`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/politicas/page.tsx`, `src/components/cart-checkout.tsx`, `src/app/api/checkout/route.ts`.

## Validación realizada

- 109 pruebas aprobadas, incluidas 15 nuevas pruebas Meta: consentimiento/retirada, cookies bloqueadas, hashing, equivalencia de IDs, reintentos, concurrencia, comprobantes firmados, totales autoritativos y aislamiento de fallos del checkout.
- TypeScript sin errores, ESLint sin errores y build Next.js de producción correcto.
- Prisma Client generado; migración revisada pero no aplicada a la base de producción.
- En este entorno Windows el lanzador npm terminó sin ejecutar algunos scripts; se ejecutaron los mismos comandos directamente con Node 22 (`tsc --noEmit`, `eslint .`, `tsx --test tests/*.test.ts`, `prisma generate`, `next build --webpack`). El build se hizo con `DATABASE_URL` vacío para no acceder a producción.
- Solicitudes a Meta y MySQL simuladas en tests. No se crearon pedidos reales ni se enviaron eventos reales. La recepción y deduplicación observadas en Meta quedan pendientes de las credenciales y la prueba manual anterior.

Referencias oficiales: [desduplicación](https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events), [parámetros](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/), [verificar configuración](https://developers.facebook.com/documentation/ads-commerce/conversions-api/verifying-setup).
