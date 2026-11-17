# TECNOTOP V1

Tienda propia para Colombia: Next.js App Router, React, TypeScript, Tailwind, Node.js 22, MySQL y Prisma. Frontend y API REST en la misma aplicación, sin WordPress, WooCommerce, Redis ni pasarela de pago.

Compatibilidad Hostinger: `next.config.mjs` evita compilar la configuración TypeScript en un servidor con GLIBC anterior a 2.29. La compilación usa Webpack y el fallback SWC WebAssembly oficial, conservando Next.js y Node.js 22.

## Inicio

```sh
npm ci
cp .env.example .env
# Configurar DATABASE_URL para una base MySQL propia.
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

`npm run build` genera Prisma, aplica únicamente migraciones pendientes y ejecuta un seed idempotente si existe DATABASE_URL; luego compila Next.js. No borra ni reinicia bases de datos. Sin DATABASE_URL permite compilar la interfaz; `/api/health` devuelve 503 hasta que MySQL y el esquema estén disponibles.

## Administración

`/admin` usa bcrypt, sesiones opacas almacenadas como hash en MySQL, cookies HttpOnly/Secure/SameSite, comprobación de origen, validación Zod, límites persistentes de solicitudes y auditoría. El administrador inicial se crea con `npm run admin:create` usando ADMIN_EMAIL y ADMIN_PASSWORD (16 caracteres mínimo), sin contraseña predeterminada. Alternativamente el seed admite ADMIN_PASSWORD_HASH bcrypt generado externamente; nunca sobrescribe un administrador existente.

Panel: productos y variantes, precios comerciales independientes, categorías, colecciones y orden de productos, pedidos, clientes, inventario, Dropi, promociones, seguimiento y contenido de inicio. Las categorías y 26 colecciones iniciales se crean sin asignar productos. Importaciones nuevas siempre quedan DRAFT. Publicar exige descripción, imágenes HTTPS, categoría y precios confirmados de todas las variantes activas.

La configuración comercial guarda datos del titular y textos de políticas. NIT es opcional; no se inventan datos legales. `policiesApproved` exige campos completos y revisión del titular. Mientras falten, las compras quedan deshabilitadas.

## Dropi

Consulta [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) para las fuentes y contratos inspeccionados. El token se usa solo desde el servidor en el header `dropi-integration-key` y nunca se devuelve al cliente. HTTPS, timeout, respuesta validada, redirecciones bloqueadas y máximo tres intentos solo para lecturas. El host de la API se restringe a Colombia.

- `POST products/index`: startData, pageSize, order_type, order_by, keywords, active, no_count, integration, get_stock.
- `GET products/v2/{id}`: datos individuales, inventario, variantes, imágenes y proveedor.
- `POST orders/myorders`: contraentrega con CON RECAUDO. **Deshabilitado por defecto.**
- Cotización y seguimiento remoto: no se identificaron contratos suficientes; los métodos retornan errores explícitos. No se inventan endpoints, guías ni estados.

El panel importa páginas de 10 productos y sincroniza páginas de 20. La sincronización conserva precios, clasificación y texto comercial. Ante un fallo de inventario, pone el stock local afectado en cero y registra un código seguro. Una respuesta incompatible se rechaza; hay que ajustar el adaptador solo con documentación o respuestas verificadas.

La consulta inicial desde el entorno de desarrollo respondió HTTP 401. Configurar el token no equivale a haber verificado la conexión. Validar nuevamente desde Hostinger antes de habilitar ventas.

## Pedidos y precios

Carrito persistente en el navegador. El servidor recalcula precios, descuentos y stock; no confía en precios enviados por el cliente. Los modelos Cart/CartItem se incluyen para evolución a persistencia de carritos entre dispositivos, actualmente no utilizada.

Checkout valida identidad/contacto/dirección y consentimiento, revalida stock con Dropi, y crea cliente, pedido y líneas en una transacción MySQL con aislamiento Serializable y decrementos condicionales. Cada intento lleva UUID de idempotencia y hash de contenido. Reutilizar la clave con otro contenido se rechaza. Los precios y datos logísticos se conservan en las líneas.

La primera versión limita cada pedido a un proveedor confirmado. El envío es gratis para el cliente; Dropi recibe calculate_costs_and_shiping=true. Los descuentos se redondean por precio unitario a centavos y el total coincide con la suma de líneas enviada a Dropi.

Nunca se reintenta automáticamente la creación remota. Ante timeout, respuesta desconocida o error de persistencia posterior al envío, el resultado se marca UNKNOWN y queda bloqueado para conciliación manual. Los rechazos inequívocos pueden revisarse y reintentarse desde administración. No cambiar estados para eludir esa protección.

Seguimiento público requiere número aleatorio de pedido y celular exacto; devuelve solo eventos y guías registrados, sin dirección ni datos privados. Los eventos manuales exigen evidencia y quedan auditados.

## Notificaciones

Existe una bandeja Notification para EMAIL, ADMIN y WHATSAPP. Su estado inicial es PENDING_CONFIGURATION. No se envía ni se simula ningún mensaje. Falta conectar un proveedor oficial y configurar plantillas/consentimientos antes de procesar la bandeja.

## Variables

| Variable             | Uso                                                               |
| -------------------- | ----------------------------------------------------------------- |
| DATABASE_URL         | MySQL de Hostinger; la aplicación normaliza localhost a 127.0.0.1 |
| APP_URL              | Origen público autorizado para mutaciones                         |
| DROPI_API_URL        | https://api.dropi.co/integrations/                                |
| DROPI_API_TOKEN      | Secreto de integración                                            |
| DROPI_ORDERS_ENABLED | false hasta validación y autorización para órdenes reales         |
| CHECKOUT_ENABLED     | false hasta catálogo y políticas listos                           |
| CRON_SECRET          | Bearer privado para sincronización                                |
| ADMIN_EMAIL          | Administrador inicial                                             |
| ADMIN_PASSWORD_HASH  | Bootstrap opcional con bcrypt, solo servidor                      |

No usar NEXT_PUBLIC para secretos. `.local/`, `.env*`, node_modules y builds se excluyen de Git; `.env.example` no contiene valores secretos. Hostinger reemplaza todas las variables al cambiarlas por API: no enviar valores enmascarados ni eliminar las existentes.

## Cron

`POST /api/cron/sync` con `Authorization: Bearer $CRON_SECRET`. Procesa una página por ejecución, conserva el cursor en MySQL, evita solapamientos con un bloqueo y elimina límites/sesiones vencidos. Un cron cada 15 minutos recorre los productos progresivamente. La frecuencia debe ajustarse al tamaño del catálogo. Nunca genera órdenes. Alternativa CLI: `npm run sync -- 0`.

## Validación y despliegue

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run start
```

Pruebas: validación de cantidades y teléfonos, condiciones de publicación, consentimiento, sanitización de snapshots, imágenes del CDN, órdenes deshabilitadas, CSRF, límites de cuerpo, host de API permitido, autenticación rechazada, respuestas malformadas y prohibición de reintentos de órdenes inciertas. GitHub Actions ejecuta estas comprobaciones con Node.js 22.

Destino: Hostinger, tecnotop.com.co, rama main, framework next, Node.js 22, build `npm run build`, start `npm run start`. `.hostinger/site.json` registra el destino sin secretos. Verificar build, HTTPS, portada y `/api/health`. El deploy por Git queda automático tras la configuración Node.js. No modificar registros MX ni servicios de correo.

## Límites antes de vender

1. Autenticar Dropi y verificar respuestas reales de productos/variantes.
2. Importar, clasificar y aprobar precios; no hay productos ficticios.
3. Completar y aprobar políticas e identificación del titular.
4. Verificar flujo de pedido en entorno acordado con Dropi antes de habilitar órdenes reales.
5. Conectar notificaciones oficiales y verificar endpoints de logística/seguimiento cuando existan.

El deploy técnico no implica que la tienda esté lista para recibir ventas. CHECKOUT_ENABLED y DROPI_ORDERS_ENABLED permanecen false durante la entrega inicial.
