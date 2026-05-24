export type OriginType = "own" | "selected_supplier" | "pending_confirmation";
export type PriceUnit = "unit" | "maple" | "kg";
export type LocationType = "store" | "warehouse" | "mill" | "farm";
export type OrderStatus =
  | "pending_confirmation"
  | "confirmed"
  | "preparing"
  | "dispatched"
  | "delivered"
  | "cancelled";

export const originTypes: OriginType[] = [
  "own",
  "selected_supplier",
  "pending_confirmation",
];
export const priceUnits: PriceUnit[] = ["unit", "maple", "kg"];
export const orderStatuses: OrderStatus[] = [
  "pending_confirmation",
  "confirmed",
  "preparing",
  "dispatched",
  "delivered",
  "cancelled",
];

export function isOriginType(value: unknown): value is OriginType {
  return originTypes.includes(value as OriginType);
}

export function isPriceUnit(value: unknown): value is PriceUnit {
  return priceUnits.includes(value as PriceUnit);
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return orderStatuses.includes(value as OrderStatus);
}

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  originType: OriginType;
  description: string;
  presentation: string;
  priceUnit: PriceUnit;
  price: number | null;
  portionGrams: number | null;
  imageUrl: string | null;
  active: boolean;
  subscriptionEligible: boolean;
  traceable: boolean;
};

export type DeliveryZone = {
  id: string;
  name: string;
  neighborhoods: string;
  baseFee: number;
  freeFrom: number | null;
  subscriptionAvailable: boolean;
  active: boolean;
};

export type PaymentMethod = {
  id: string;
  name: string;
  instructions: string;
  active: boolean;
};

export type BusinessLocation = {
  id: string;
  name: string;
  type: LocationType;
  address: string;
  active: boolean;
};

export type StaffRole = {
  id: string;
  name: string;
  scope: string;
  permissions: string[];
};

export type OrderItem = {
  productId: string;
  name: string;
  presentation: string;
  quantity: number;
  unitPrice: number | null;
  subtotal: number | null;
};

export type Order = {
  id: string;
  number: string;
  customerName: string;
  phone: string;
  address: string;
  deliveryZoneId: string;
  paymentMethodId: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number | null;
  hasPendingPrice: boolean;
  createdAt: string;
};

export type CommerceState = {
  products: Product[];
  deliveryZones: DeliveryZone[];
  paymentMethods: PaymentMethod[];
  locations: BusinessLocation[];
  roles: StaffRole[];
  orders: Order[];
  updatedAt: string;
};

export const originLabels: Record<OriginType, string> = {
  own: "Origen propio",
  selected_supplier: "Proveedor seleccionado",
  pending_confirmation: "Origen por confirmar",
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending_confirmation: "Por confirmar",
  confirmed: "Confirmado",
  preparing: "En preparación",
  dispatched: "Despachado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const orderStatusActions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending_confirmation: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["dispatched", "cancelled"],
  dispatched: ["delivered"],
};

export function formatPrice(product: Product): string {
  if (product.price === null) {
    return "Precio por definir";
  }

  const suffix =
    product.priceUnit === "kg"
      ? " / kg"
      : product.priceUnit === "maple"
        ? " / maple"
        : "";

  return `S/ ${product.price.toFixed(2)}${suffix}`;
}

export function productSalePrice(product: Product): number | null {
  if (product.price === null) {
    return null;
  }

  if (product.priceUnit === "kg" && product.portionGrams) {
    return product.price * (product.portionGrams / 1000);
  }

  return product.price;
}

export function productPriceDetail(product: Product): string {
  const salePrice = productSalePrice(product);

  if (salePrice === null) {
    return "Consultar disponibilidad y precio";
  }

  if (product.priceUnit === "kg" && product.portionGrams) {
    return `S/ ${salePrice.toFixed(2)} por presentación`;
  }

  return formatPrice(product);
}
