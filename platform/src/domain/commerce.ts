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
export type CustomerSegment =
  | "hogar"
  | "recurrente"
  | "fitness"
  | "parrilla"
  | "restaurante"
  | "distribuidor";
export type InventoryUnit = "kg" | "unit" | "maple";
export type InventoryLotStatus = "available" | "depleted" | "quarantine";
export type InventorySanitaryStatus = "pending" | "approved" | "rejected";
export type InventoryMovementType = "receipt" | "adjustment_in" | "waste" | "allocation";
export type BirdBatchStage =
  | "received"
  | "brooding"
  | "growing"
  | "finishing"
  | "ready_processing"
  | "processed"
  | "closed";
export type PoultryExpenseCategory =
  | "health"
  | "bedding"
  | "energy"
  | "labor"
  | "transport"
  | "other";
export type LayerFlockStatus = "active" | "paused" | "closed";
export type LayerEventType = "mortality" | "feed_consumption" | "expense";
export type FeedFormulaStatus = "draft" | "approved" | "archived";
export type MillBatchUsage = "internal_broiler" | "internal_layers" | "external_service";
export type FeedInputQualityStatus = "pending" | "approved" | "rejected";
export type BirdBatchEventType =
  | "mortality"
  | "weight_sample"
  | "feed_consumption"
  | "expense"
  | "stage_change"
  | "processing";

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
export const customerSegments: CustomerSegment[] = [
  "hogar",
  "recurrente",
  "fitness",
  "parrilla",
  "restaurante",
  "distribuidor",
];
export const inventoryUnits: InventoryUnit[] = ["kg", "unit", "maple"];
export const birdBatchStages: BirdBatchStage[] = [
  "received",
  "brooding",
  "growing",
  "finishing",
  "ready_processing",
  "processed",
  "closed",
];
export const poultryExpenseCategories: PoultryExpenseCategory[] = [
  "health",
  "bedding",
  "energy",
  "labor",
  "transport",
  "other",
];
export const layerFlockStatuses: LayerFlockStatus[] = ["active", "paused", "closed"];

export function isOriginType(value: unknown): value is OriginType {
  return originTypes.includes(value as OriginType);
}

export function isPriceUnit(value: unknown): value is PriceUnit {
  return priceUnits.includes(value as PriceUnit);
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return orderStatuses.includes(value as OrderStatus);
}

export function isCustomerSegment(value: unknown): value is CustomerSegment {
  return customerSegments.includes(value as CustomerSegment);
}

export function isInventoryUnit(value: unknown): value is InventoryUnit {
  return inventoryUnits.includes(value as InventoryUnit);
}

export function isBirdBatchStage(value: unknown): value is BirdBatchStage {
  return birdBatchStages.includes(value as BirdBatchStage);
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
  lotCode: string | null;
  allocatedQuantity: number | null;
  allocatedUnit: InventoryUnit | null;
  costTotal: number | null;
};

export type Order = {
  id: string;
  customerId: string | null;
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

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  document: string | null;
  notes: string;
  segment: CustomerSegment;
  subscriptionInterest: boolean;
  lastAddress: string | null;
  deliveryZoneId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerMetrics = Customer & {
  orders: Order[];
  orderCount: number;
  deliveredOrders: number;
  lifetimeValue: number;
  lastOrderAt: string | null;
};

export type InventoryMovement = {
  id: string;
  type: InventoryMovementType;
  quantityDelta: number;
  unit: InventoryUnit;
  reason: string;
  orderItemId: string | null;
  createdAt: string;
};

export type InventoryLot = {
  id: string;
  code: string;
  productId: string;
  productName: string;
  presentation: string;
  originType: OriginType;
  supplierName: string | null;
  locationId: string;
  locationName: string;
  receivedQuantity: number;
  quantity: number;
  unit: InventoryUnit;
  unitCost: number | null;
  receivedAt: string;
  expiresAt: string | null;
  status: InventoryLotStatus;
  notes: string;
  supplierDocument: string | null;
  supplierLotCode: string | null;
  arrivalTemperatureC: number | null;
  storageTemperatureC: number | null;
  packagingCondition: string;
  sanitaryStatus: InventorySanitaryStatus | null;
  sanitaryNotes: string;
  sanitaryReviewedAt: string | null;
  sourceBirdBatchId: string | null;
  sourceBirdBatchCode: string | null;
  sourceLayerFlockId: string | null;
  sourceLayerFlockCode: string | null;
  processedUnits: number | null;
  createdAt: string;
  movements: InventoryMovement[];
};

export type DispatchableOrderItem = {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  orderItemId: string;
  productId: string;
  productName: string;
  presentation: string;
  requestedQuantity: number;
  requiredStockQuantity: number | null;
  inventoryUnit: InventoryUnit;
};

export type InventoryWorkspace = {
  lots: InventoryLot[];
  pendingAssignments: DispatchableOrderItem[];
  availableStockValue: number;
  activeLotCount: number;
  expiringLotCount: number;
  pendingAssignmentCount: number;
  controlledPurchasedLotCount: number;
  approvedPurchasedLotCount: number;
};

export type BirdBatchEvent = {
  id: string;
  type: BirdBatchEventType;
  eventAt: string;
  count: number | null;
  avgWeightGrams: number | null;
  feedKg: number | null;
  feedUnitCost: number | null;
  amount: number | null;
  expenseCategory: PoultryExpenseCategory | null;
  millBatchId: string | null;
  millBatchCode: string | null;
  formulaName: string | null;
  stage: BirdBatchStage | null;
  notes: string;
};

export type BirdBatch = {
  id: string;
  code: string;
  locationId: string;
  locationName: string;
  sourceName: string;
  breed: string | null;
  receivedAt: string;
  initialCount: number;
  currentCount: number;
  processedCount: number;
  initialAvgWeightGrams: number | null;
  costPerChick: number | null;
  stage: BirdBatchStage;
  notes: string;
  events: BirdBatchEvent[];
  createdAt: string;
};

export type PoultryWorkspace = {
  batches: BirdBatch[];
  activeBatchCount: number;
  liveBirdCount: number;
  mortalityCount: number;
  processedCount: number;
};

export type LayerFlockEvent = {
  id: string;
  type: LayerEventType;
  eventAt: string;
  count: number | null;
  feedKg: number | null;
  feedUnitCost: number | null;
  amount: number | null;
  expenseCategory: PoultryExpenseCategory | null;
  millBatchId: string | null;
  millBatchCode: string | null;
  formulaName: string | null;
  notes: string;
};

export type EggCollection = {
  id: string;
  collectedAt: string;
  collectedEggs: number;
  rejectedEggs: number;
  notes: string;
};

export type LayerFlock = {
  id: string;
  code: string;
  locationId: string;
  locationName: string;
  sourceName: string;
  breed: string | null;
  startedAt: string;
  initialHens: number;
  currentHens: number;
  availableEggs: number;
  packedMaples: number;
  costPerHen: number | null;
  status: LayerFlockStatus;
  notes: string;
  events: LayerFlockEvent[];
  collections: EggCollection[];
  createdAt: string;
};

export type EggWorkspace = {
  flocks: LayerFlock[];
  activeFlockCount: number;
  liveHenCount: number;
  collectedEggCount: number;
  availableEggCount: number;
  packedMapleCount: number;
};

export type FeedInput = {
  id: string;
  name: string;
  unit: "kg";
  active: boolean;
  latestCostPerKg: number | null;
  latestCostAt: string | null;
  supplierName: string | null;
};

export type FeedInputLot = {
  id: string;
  code: string;
  inputId: string;
  inputName: string;
  supplierName: string;
  supplierTaxId: string | null;
  locationName: string;
  receivedKg: number;
  availableKg: number;
  unitCost: number;
  receivedAt: string;
  documentReference: string;
  qualityStatus: FeedInputQualityStatus;
  qualityNotes: string;
  notes: string;
};

export type FeedFormulaItem = {
  id: string;
  inputId: string;
  inputName: string;
  quantityKg: number;
  percentage: number;
  costPerKg: number | null;
  subtotal: number | null;
};

export type FeedFormulaVersion = {
  id: string;
  version: number;
  status: FeedFormulaStatus;
  targetKg: number;
  notes: string;
  createdAt: string;
  items: FeedFormulaItem[];
};

export type FeedFormula = {
  id: string;
  code: string;
  name: string;
  species: string;
  stage: string;
  active: boolean;
  versions: FeedFormulaVersion[];
};

export type MillBatch = {
  id: string;
  code: string;
  formulaName: string;
  formulaVersion: number;
  locationName: string;
  usage: MillBatchUsage;
  producedKg: number;
  availableKg: number;
  totalCost: number;
  costPerKg: number;
  producedAt: string;
  notes: string;
};

export type MillWorkspace = {
  inputs: FeedInput[];
  inputLots: FeedInputLot[];
  formulas: FeedFormula[];
  batches: MillBatch[];
  activeInputCount: number;
  approvedFormulaCount: number;
  approvedInputKg: number;
  pendingQualityLotCount: number;
  inputStockValue: number;
  producedKg: number;
  availableKg: number;
  averageCostPerKg: number | null;
};

export type AuditIssueSeverity = "critical" | "warning" | "info";

export type AuditIssue = {
  id: string;
  severity: AuditIssueSeverity;
  area: string;
  title: string;
  detail: string;
  href: string;
};

export type AuditEvent = {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
};

export type AuditWorkspace = {
  issues: AuditIssue[];
  events: AuditEvent[];
  criticalCount: number;
  warningCount: number;
  auditEventCount: number;
  traceableInventoryLots: number;
  totalInventoryLots: number;
  approvedInputKg: number;
  producedFeedKg: number;
  controlledCommercialLots: number;
  approvedCommercialLots: number;
};

export type CommerceState = {
  products: Product[];
  deliveryZones: DeliveryZone[];
  paymentMethods: PaymentMethod[];
  locations: BusinessLocation[];
  roles: StaffRole[];
  orders: Order[];
  customers?: Customer[];
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

export const customerSegmentLabels: Record<CustomerSegment, string> = {
  hogar: "Hogar",
  recurrente: "Recurrente",
  fitness: "Fitness",
  parrilla: "Parrilla",
  restaurante: "Restaurante",
  distribuidor: "Distribuidor",
};

export const inventoryMovementLabels: Record<InventoryMovementType, string> = {
  receipt: "Recepción",
  adjustment_in: "Ingreso adicional",
  waste: "Merma",
  allocation: "Asignado a pedido",
};

export const inventoryLotStatusLabels: Record<InventoryLotStatus, string> = {
  available: "Disponible",
  depleted: "Agotado",
  quarantine: "En cuarentena",
};

export const inventorySanitaryStatusLabels: Record<InventorySanitaryStatus, string> = {
  pending: "Inspeccion pendiente",
  approved: "Liberado",
  rejected: "Rechazado",
};

export const birdBatchStageLabels: Record<BirdBatchStage, string> = {
  received: "Ingreso",
  brooding: "Inicio / bebé",
  growing: "Crecimiento",
  finishing: "Engorde",
  ready_processing: "Listo para faena",
  processed: "Faenado",
  closed: "Cerrado",
};

export const birdBatchEventLabels: Record<BirdBatchEventType, string> = {
  mortality: "Mortalidad",
  weight_sample: "Pesaje",
  feed_consumption: "Alimento consumido",
  expense: "Costo operativo",
  stage_change: "Cambio de etapa",
  processing: "Salida faenada",
};

export const poultryExpenseCategoryLabels: Record<PoultryExpenseCategory, string> = {
  health: "Sanidad / vacunas",
  bedding: "Cama y limpieza",
  energy: "Energía",
  labor: "Mano de obra",
  transport: "Transporte",
  other: "Otro costo",
};

export const layerFlockStatusLabels: Record<LayerFlockStatus, string> = {
  active: "En postura",
  paused: "Pausado",
  closed: "Cerrado",
};

export const layerEventLabels: Record<LayerEventType, string> = {
  mortality: "Mortalidad",
  feed_consumption: "Alimento consumido",
  expense: "Costo operativo",
};

export const feedFormulaStatusLabels: Record<FeedFormulaStatus, string> = {
  draft: "Borrador",
  approved: "Aprobada",
  archived: "Archivada",
};

export const millBatchUsageLabels: Record<MillBatchUsage, string> = {
  internal_broiler: "Pollo de engorde",
  internal_layers: "Ponedoras",
  external_service: "Servicio a terceros",
};

export const feedInputQualityLabels: Record<FeedInputQualityStatus, string> = {
  pending: "Pendiente de liberacion",
  approved: "Aprobado para uso",
  rejected: "Rechazado",
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
