export const initialCategories = [
  {
    name: "Audio",
    slug: "audio",
    description: "Tu música, a tu manera.",
    collections: [
      "Audífonos",
      "Diademas",
      "Parlantes Bluetooth",
      "Parlantes para PC",
      "Cabinas",
    ],
  },
  {
    name: "Celulares",
    slug: "celulares",
    description: "Todo para acompañar tu día.",
    collections: [
      "Soporte para celular",
      "Etc mobile",
      "Combo celular",
      "Powerbanks",
      "Cargadores",
      "Micrófono para celular",
      "Relojes",
      "Trípodes",
    ],
  },
  {
    name: "Periféricos",
    slug: "perifericos",
    description: "Un espacio de trabajo que va contigo.",
    collections: ["Combo teclado mouse oficina", "Mouses", "Teclado oficina"],
  },
  {
    name: "Gaming",
    slug: "gaming",
    description: "Prepara tu próxima partida.",
    collections: [
      "Gaming celular",
      "Diadema gamer",
      "Mouse gamer",
      "Teclado membrana gamer",
      "Teclado mecánico gamer",
    ],
  },
  {
    name: "Cómputo",
    slug: "computo",
    description: "Detalles que mejoran tu setup.",
    collections: [
      "PC Gadgets",
      "Bases refrigerantes",
      "Luces LED",
      "Mini impresora",
    ],
  },
  {
    name: "Redes",
    slug: "redes",
    description: "Conecta tu mundo.",
    collections: ["TV"],
  },
];
export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const defaultSections = [
  {
    id: "hero",
    title: "Tecnología que conecta contigo.",
    subtitle:
      "Encuentra lo que necesitas para escuchar, crear, jugar y disfrutar cada día.",
    visible: true,
  },
  {
    id: "categories",
    title: "Encuentra tu próxima conexión",
    subtitle: "Explora nuestras categorías",
    visible: true,
  },
  {
    id: "featured",
    title: "Elegidos para ti",
    subtitle: "Nuestra selección destacada",
    visible: true,
  },
  {
    id: "popular",
    title: "Los favoritos",
    subtitle: "Productos seleccionados por TecnoTop",
    visible: true,
  },
  {
    id: "bestsellers",
    title: "Los más vendidos",
    subtitle: "Según pedidos entregados",
    visible: true,
  },
  {
    id: "offers",
    title: "Más tecnología, mejor precio",
    subtitle: "Ofertas disponibles",
    visible: true,
  },
  {
    id: "benefits",
    title: "Comprar tecnología se siente mejor aquí",
    subtitle: "Una experiencia clara, de principio a fin",
    visible: true,
  },
];
