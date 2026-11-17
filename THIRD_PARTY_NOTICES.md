# Referencia de protocolo Dropi

Se inspeccionó https://github.com/common-repository/wc-dropi-integration (GPL-2.0-or-later según readme.txt) para identificar contratos HTTP. No se incorporó código PHP ni se instaló WooCommerce. La implementación TypeScript es propia.

Archivos consultados: `clasess/Constants.php`, `clasess/models/ProductsModel.php`, `clasess/models/OrdersModel.php`, `clasess/Dropi.php`, `clasess/Settings.php`, `clasess/models/TokenModel.php`.

Contratos implementados: POST `products/index`, GET `products/v2/{id}`, POST `orders/myorders`. Colombia usa `dropi-integration-key`. Los pedidos contraentrega usan `rate_type: CON RECAUDO`, `type: FINAL_ORDER`, `status: PENDIENTE CONFIRMACION`, `payment_method_id: 1`, `calculate_costs_and_shiping: true`.

Imágenes `urlS3`: https://d39ru7awumhhs2.cloudfront.net/; imágenes `url`: https://api.dropi.co/.

No se reprodujeron las opciones inseguras de desactivación de SSL ni los logs de tokens del plugin. No se verificaron endpoints de cotización ni de seguimiento; esos métodos devuelven un error explícito y no inventan datos.

Los logos originales fueron proporcionados por el propietario de TecnoTop y se conservan sin modificación.
