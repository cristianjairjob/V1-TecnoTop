import { z } from "zod";

export const visibilityControls = [
  {
    "key": "announcement",
    "label": "General · Anuncio superior",
    "selector": ".announcement",
    "visible": true
  },
  {
    "key": "navigation",
    "label": "General · Menú de categorías y ofertas",
    "selector": ".category-nav,.mobile-toggle",
    "visible": true
  },
  {
    "key": "search",
    "label": "Inicio · Buscador",
    "selector": ".search",
    "visible": true
  },
  {
    "key": "cart",
    "label": "General · Botón del carrito",
    "selector": ".cart-link",
    "visible": true
  },
  {
    "key": "tracking",
    "label": "General · Seguimiento público",
    "selector": "a[href=\"/seguimiento\"],.public-tracking",
    "visible": false
  },
  {
    "key": "footer",
    "label": "General · Pie de página",
    "selector": "body > .storefront-footer,body footer",
    "visible": true
  },
  {
    "key": "gallery",
    "label": "Producto · Galería de imágenes",
    "selector": ".product-gallery",
    "visible": true
  },
  {
    "key": "colors",
    "label": "Producto · Colores disponibles",
    "selector": ".product-colors",
    "visible": true
  },
  {
    "key": "stock",
    "label": "Producto · Aviso de últimas unidades y flotante",
    "selector": ".stock-notice,.stock-notice-floating",
    "visible": true
  },
  {
    "key": "socialProof",
    "label": "Producto · Compradores",
    "selector": ".product-social-proof",
    "visible": true
  },
  {
    "key": "highlights",
    "label": "Producto · Características destacadas",
    "selector": ".product-highlights",
    "visible": true
  },
  {
    "key": "benefits",
    "label": "Producto · Beneficios bajo las imágenes",
    "selector": ".product-benefits",
    "visible": true
  },
  {
    "key": "productTimer",
    "label": "Producto · Temporizador",
    "selector": ".product-page .checkout-countdown",
    "visible": true
  },
  {
    "key": "offers",
    "label": "Producto · Promociones de combos",
    "selector": ".product-offers",
    "visible": true
  },
  {
    "key": "shippingBanner",
    "label": "Producto · Anuncio de envío y pago",
    "selector": ".free-shipping-banner",
    "visible": true
  },
  {
    "key": "quantity",
    "label": "Producto · Cantidad personalizada",
    "selector": ".purchase-custom-quantity",
    "visible": true
  },
  {
    "key": "buy",
    "label": "Producto · Comprar ahora",
    "selector": ".buy-actions",
    "visible": true
  },
  {
    "key": "warranty",
    "label": "Producto · Garantía",
    "selector": ".product-warranty",
    "visible": true
  },
  {
    "key": "trust",
    "label": "Producto · Envío, pago y soporte",
    "selector": ".purchase-trust-grid",
    "visible": true
  },
  {
    "key": "arrival",
    "label": "Producto · Plazos de entrega",
    "selector": ".purchase-arrival",
    "visible": true
  },
  {
    "key": "details",
    "label": "Producto · Descripción",
    "selector": ".product-description,.product-description-title",
    "visible": true
  },
  {
    "key": "checkoutTimer",
    "label": "Formulario · Temporizador y flotante",
    "selector": ".checkout-grid .checkout-countdown,.checkout-floating-clock",
    "visible": true
  },
  {
    "key": "addressGuide",
    "label": "Formulario · Imagen de ayuda de dirección",
    "selector": ".checkout-address-guide",
    "visible": true
  },
  {
    "key": "checkoutOffers",
    "label": "Formulario · Promociones de combos",
    "selector": ".checkout-offers",
    "visible": true
  },
  {
    "key": "coupon",
    "label": "Formulario · Código de descuento",
    "selector": ".coupon",
    "visible": true
  },
  {
    "key": "checkoutShipping",
    "label": "Formulario · Anuncio de envío y pago",
    "selector": ".checkout-shipping-highlight",
    "visible": true
  },
  {
    "key": "confirm",
    "label": "Formulario · Botón de confirmar compra",
    "selector": "button[form=\"checkout-form\"]",
    "visible": true
  }
] as const;

export type VisibilityKey = typeof visibilityControls[number]["key"];
export type StorefrontVisibility = Record<VisibilityKey, boolean>;
export const defaultVisibility = Object.fromEntries(visibilityControls.map(c => [c.key,c.visible])) as StorefrontVisibility;
export const visibilitySchema = z.object(Object.fromEntries(visibilityControls.map(c => [c.key,z.boolean().default(c.visible)])) as Record<VisibilityKey,z.ZodDefault<z.ZodBoolean>>).strict();
export function parseVisibility(value: unknown): StorefrontVisibility {
 const parsed = visibilitySchema.safeParse(value);
 return parsed.success ? parsed.data : {...defaultVisibility};
}
// Only fixed, reviewed selectors enter the stylesheet; stored data contains booleans only.
export function visibilityStyles(value: StorefrontVisibility) {
 return visibilityControls.filter(c => !value[c.key]).map(c => c.selector + "{display:none!important}").join("\n");
}
