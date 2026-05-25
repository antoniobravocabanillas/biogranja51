export type BusinessLine = {
  name: string;
  badge: string;
  description: string;
  ownership: string;
};

export const businessLines: BusinessLine[] = [
  {
    name: "Pollo de granja",
    badge: "Origen propio",
    description:
      "Crianza controlada y alimentación formulada por etapa para ofrecer frescura y trazabilidad.",
    ownership: "BioGranja produce",
  },
  {
    name: "Huevos frescos",
    badge: "Origen por confirmar",
    description:
      "Maples disponibles con registro de lote, fecha y disponibilidad para hogares y negocios.",
    ownership: "Procedencia pendiente de registro",
  },
  {
    name: "Res seleccionada",
    badge: "Proveedor aliado",
    description:
      "Cortes evaluados bajo criterios de proveedor formal, calidad y cadena de frio.",
    ownership: "BioGranja selecciona",
  },
  {
    name: "Cerdo seleccionado",
    badge: "Proveedor aliado",
    description:
      "Oferta comercial inmediata, con ruta futura hacia producción porcina propia.",
    ownership: "BioGranja selecciona",
  },
];

export const operatingPillars = [
  {
    name: "Venta omnicanal",
    description: "Tienda, WhatsApp, suscripciones, delivery y clientes B2B.",
  },
  {
    name: "Producción trazable",
    description: "Lotes, alimentación, pesos, sanidad, stock y rendimiento.",
  },
  {
    name: "Molino y nutrición",
    description: "Formulación, costos, molienda y futuro alimento comercial.",
  },
  {
    name: "Sistema circular",
    description: "Residuos valorizados, compost y futuros cultivos de soporte.",
  },
];

export const managementModules = [
  {
    code: "COM",
    name: "Comercial",
    description: "Pedidos, clientes, precios, promociones y suscripciones.",
    status: "Operativo",
  },
  {
    code: "INV",
    name: "Inventario comercial",
    description: "Producto faenado o comprado listo para venta, mermas y despacho.",
    status: "Operativo",
  },
  {
    code: "AVI",
    name: "Crianza avícola",
    description: "Pollitos vivos, peso, alimento, mortalidad y salida a faena.",
    status: "Operativo",
  },
  {
    code: "MOL",
    name: "Molino",
    description: "Fórmulas, insumos, costos por kg y órdenes de molienda.",
    status: "Sprint 3",
  },
  {
    code: "PRO",
    name: "Abastecimiento",
    description: "Proveedores de res y cerdo, compras, recepcion y calidad.",
    status: "Sprint 2",
  },
  {
    code: "CIR",
    name: "Circularidad",
    description: "Subproductos, compost, indicadores y aprovechamiento.",
    status: "Fase 2",
  },
];

export const executiveKpis = [
  { label: "Pedidos del mes", value: "--", note: "Al conectar ventas" },
  { label: "Margen bruto", value: "--%", note: "Por linea y producto" },
  { label: "Costo alimento/kg", value: "S/ 1.80 - 2.13", note: "Base actual pollo" },
  { label: "Trazabilidad", value: "0%", note: "Lotes por implementar" },
];
