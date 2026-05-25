import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type {
  BusinessLocation,
  BirdBatch,
  BirdBatchEvent,
  BirdBatchStage,
  PoultryExpenseCategory,
  CommerceState,
  Customer,
  CustomerMetrics,
  DeliveryZone,
  DispatchableOrderItem,
  InventoryLot,
  InventoryMovement,
  InventorySanitaryStatus,
  InventoryUnit,
  InventoryWorkspace,
  EggCollection,
  EggWorkspace,
  FeedInputLot,
  FeedInputQualityStatus,
  FinanceOrder,
  FinanceWorkspace,
  FeedFormula,
  FeedFormulaStatus,
  FeedInput,
  MillBatch,
  MillBatchUsage,
  MillWorkspace,
  LayerEventType,
  LayerFlock,
  LayerFlockEvent,
  LayerFlockStatus,
  Order,
  OrderExpense,
  OrderExpenseCategory,
  OrderPayment,
  OrderPaymentStatus,
  PaymentMethod,
  Product,
  PoultryWorkspace,
  StaffRole,
  SalesReceipt,
  SalesReceiptType,
  AuditIssue,
  AuditWorkspace,
} from "@/domain/commerce";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";

const dataFile = path.join(process.cwd(), "data", "commerce.json");

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  origin_type: Product["originType"];
  description: string;
  presentation: string;
  price_unit: Product["priceUnit"];
  price: number | string | null;
  portion_grams: number | null;
  image_url: string | null;
  active: boolean;
  subscription_eligible: boolean;
  traceable: boolean;
};

type DeliveryZoneRow = {
  id: string;
  name: string;
  neighborhoods: string;
  base_fee: number | string;
  free_from: number | string | null;
  subscription_available: boolean;
  active: boolean;
};

type PaymentMethodRow = {
  id: string;
  name: string;
  instructions: string;
  active: boolean;
};

type LocationRow = {
  id: string;
  name: string;
  type: BusinessLocation["type"];
  address: string | null;
  active: boolean;
};

type RoleRow = {
  id: string;
  name: string;
  scope: string;
};

type OrderRow = {
  id: string;
  customer_id: string | null;
  number: string;
  address: string;
  delivery_zone_id: string;
  payment_method_id: string;
  status: Order["status"];
  subtotal: number | string;
  delivery_fee: number | string;
  total: number | string | null;
  has_pending_price: boolean;
  created_at: string;
  customers: { name: string; phone: string } | null;
  order_items: Array<{
    product_id: string;
    quantity: number | string;
    unit_price: number | string | null;
    subtotal: number | string | null;
    allocated_quantity?: number | string | null;
    allocated_unit?: InventoryUnit | null;
    cost_total?: number | string | null;
    products: { name: string; presentation: string } | null;
    inventory_lots?: { code: string } | null;
  }>;
};

type OrderPaymentRow = {
  id: string;
  order_id: string;
  payment_method_id: string;
  amount: number | string;
  paid_at: string;
  operation_reference: string;
  evidence_reference: string;
  status: OrderPaymentStatus;
  reconciliation_notes: string;
  reconciled_at: string | null;
  payment_methods: { name: string } | null;
};

type SalesReceiptRow = {
  id: string;
  order_id: string;
  receipt_type: SalesReceiptType;
  series_number: string;
  customer_document: string | null;
  issued_at: string;
  total: number | string;
  status: SalesReceipt["status"];
};

type OrderExpenseRow = {
  id: string;
  order_id: string;
  category: OrderExpenseCategory;
  amount: number | string;
  incurred_at: string;
  reference: string;
  notes: string;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  document: string | null;
  notes: string | null;
  segment: Customer["segment"] | null;
  subscription_interest: boolean | null;
  last_address: string | null;
  last_delivery_zone_id: string | null;
  created_at: string;
  updated_at: string | null;
};

type InventoryMovementRow = {
  id: string;
  movement_type: InventoryMovement["type"];
  quantity_delta: number | string;
  unit: InventoryUnit;
  reason: string;
  order_item_id: string | null;
  created_at: string;
};

type InventoryLotRow = {
  id: string;
  code: string;
  product_id: string;
  origin_type: InventoryLot["originType"];
  supplier_name: string | null;
  location_id: string;
  received_quantity: number | string;
  quantity: number | string;
  unit: InventoryUnit;
  unit_cost: number | string | null;
  produced_or_received_at: string;
  expires_at: string | null;
  status: InventoryLot["status"];
  notes: string | null;
  supplier_document?: string | null;
  supplier_lot_code?: string | null;
  arrival_temperature_c?: number | string | null;
  storage_temperature_c?: number | string | null;
  packaging_condition?: string | null;
  sanitary_status?: InventorySanitaryStatus | null;
  sanitary_notes?: string | null;
  sanitary_reviewed_at?: string | null;
  source_bird_batch_id?: string | null;
  source_layer_flock_id?: string | null;
  processed_units?: number | string | null;
  created_at: string;
  products: { name: string; presentation: string } | null;
  locations: { name: string } | null;
  bird_batches?: { code: string } | null;
  layer_flocks?: { code: string } | null;
  inventory_movements: InventoryMovementRow[];
};

type BirdBatchEventRow = {
  id: string;
  event_type: BirdBatchEvent["type"];
  event_at: string;
  count: number | null;
  avg_weight_grams: number | string | null;
  feed_kg: number | string | null;
  feed_unit_cost?: number | string | null;
  amount?: number | string | null;
  expense_category?: PoultryExpenseCategory | null;
  mill_batch_id?: string | null;
  mill_batches?: {
    code: string;
    feed_formula_versions: { feed_formulas: { name: string } | null } | null;
  } | null;
  stage: BirdBatchStage | null;
  notes: string | null;
};

type BirdBatchRow = {
  id: string;
  code: string;
  location_id: string;
  source_name: string;
  breed: string | null;
  received_at: string;
  initial_count: number | string;
  current_count: number | string;
  processed_count: number | string;
  initial_avg_weight_grams: number | string | null;
  cost_per_chick: number | string | null;
  stage: BirdBatchStage;
  notes: string | null;
  created_at: string;
  locations: { name: string } | null;
  bird_batch_events: BirdBatchEventRow[];
};

type LayerFlockEventRow = {
  id: string;
  event_type: LayerEventType;
  event_at: string;
  count: number | null;
  feed_kg: number | string | null;
  feed_unit_cost: number | string | null;
  amount: number | string | null;
  expense_category: PoultryExpenseCategory | null;
  mill_batch_id?: string | null;
  mill_batches?: {
    code: string;
    feed_formula_versions: { feed_formulas: { name: string } | null } | null;
  } | null;
  notes: string | null;
};

type EggCollectionRow = {
  id: string;
  collected_at: string;
  collected_eggs: number | string;
  rejected_eggs: number | string;
  notes: string | null;
};

type LayerFlockRow = {
  id: string;
  code: string;
  location_id: string;
  source_name: string;
  breed: string | null;
  started_at: string;
  initial_hens: number | string;
  current_hens: number | string;
  available_eggs: number | string;
  packed_maples: number | string;
  cost_per_hen: number | string | null;
  status: LayerFlockStatus;
  notes: string | null;
  created_at: string;
  locations: { name: string } | null;
  layer_flock_events: LayerFlockEventRow[];
  egg_collections: EggCollectionRow[];
};

type FeedInputRow = {
  id: string;
  name: string;
  unit: "kg";
  active: boolean;
  feed_input_prices: Array<{
    cost_per_kg: number | string;
    effective_at: string;
    supplier_name: string | null;
  }>;
};

type FeedInputLotRow = {
  id: string;
  code: string;
  input_id: string;
  received_kg: number | string;
  available_kg: number | string;
  unit_cost: number | string;
  received_at: string;
  document_reference: string;
  quality_status: FeedInputQualityStatus;
  quality_notes: string | null;
  notes: string | null;
  feed_inputs: { name: string } | null;
  suppliers: { name: string; tax_id: string | null } | null;
  locations: { name: string } | null;
};

type FeedFormulaItemRow = {
  id: string;
  input_id: string;
  quantity_kg: number | string;
  percentage: number | string;
  feed_inputs: FeedInputRow | null;
};

type FeedFormulaVersionRow = {
  id: string;
  version: number | string;
  status: FeedFormulaStatus;
  target_kg: number | string;
  notes: string | null;
  created_at: string;
  feed_formula_items: FeedFormulaItemRow[];
};

type FeedFormulaRow = {
  id: string;
  code: string;
  name: string;
  species: string;
  stage: string;
  active: boolean;
  feed_formula_versions: FeedFormulaVersionRow[];
};

type MillBatchRow = {
  id: string;
  code: string;
  usage: MillBatchUsage;
  produced_kg: number | string;
  available_kg: number | string;
  total_cost: number | string;
  cost_per_kg: number | string;
  produced_at: string;
  notes: string | null;
  locations: { name: string } | null;
  feed_formula_versions: {
    version: number | string;
    feed_formulas: { name: string } | null;
  } | null;
};

type AuditEventRow = {
  id: string;
  action: string;
  entity: string;
  created_at: string;
};

type AssignmentOrderRow = {
  id: string;
  number: string;
  status: Order["status"];
  order_items: Array<{
    id: string;
    product_id: string;
    lot_id: string | null;
    quantity: number | string;
    products: {
      name: string;
      presentation: string;
      price_unit: Product["priceUnit"];
      portion_grams: number | null;
    } | null;
  }>;
};

type StorefrontOrderResult = {
  order: Order;
  zoneName: string;
  paymentName: string;
};

function numberValue(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}

function productFromRow(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    originType: row.origin_type,
    description: row.description,
    presentation: row.presentation,
    priceUnit: row.price_unit,
    price: numberValue(row.price),
    portionGrams: row.portion_grams,
    imageUrl: row.image_url,
    active: row.active,
    subscriptionEligible: row.subscription_eligible,
    traceable: row.traceable,
  };
}

function productToRow(product: Omit<Product, "id"> | Product) {
  return {
    sku: product.sku,
    name: product.name,
    category: product.category,
    origin_type: product.originType,
    description: product.description,
    presentation: product.presentation,
    price_unit: product.priceUnit,
    price: product.price,
    portion_grams: product.portionGrams,
    image_url: product.imageUrl,
    active: product.active,
    subscription_eligible: product.subscriptionEligible,
    traceable: product.traceable,
  };
}

function zoneFromRow(row: DeliveryZoneRow): DeliveryZone {
  return {
    id: row.id,
    name: row.name,
    neighborhoods: row.neighborhoods,
    baseFee: Number(row.base_fee),
    freeFrom: numberValue(row.free_from),
    subscriptionAvailable: row.subscription_available,
    active: row.active,
  };
}

function paymentFromRow(row: PaymentMethodRow): PaymentMethod {
  return {
    id: row.id,
    name: row.name,
    instructions: row.instructions,
    active: row.active,
  };
}

function orderFromRow(row: OrderRow): Order {
  return {
    id: row.id,
    customerId: row.customer_id,
    number: row.number,
    customerName: row.customers?.name ?? "Cliente",
    phone: row.customers?.phone ?? "",
    address: row.address,
    deliveryZoneId: row.delivery_zone_id,
    paymentMethodId: row.payment_method_id,
    status: row.status,
    items: (row.order_items ?? []).map((item) => ({
      productId: item.product_id,
      name: item.products?.name ?? "Producto",
      presentation: item.products?.presentation ?? "",
      quantity: Number(item.quantity),
      unitPrice: numberValue(item.unit_price),
      subtotal: numberValue(item.subtotal),
      lotCode: item.inventory_lots?.code ?? null,
      allocatedQuantity: numberValue(item.allocated_quantity ?? null),
      allocatedUnit: item.allocated_unit ?? null,
      costTotal: numberValue(item.cost_total ?? null),
    })),
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    total: numberValue(row.total),
    hasPendingPrice: row.has_pending_price,
    createdAt: row.created_at,
  };
}

function paymentRecordFromRow(row: OrderPaymentRow): OrderPayment {
  return {
    id: row.id,
    orderId: row.order_id,
    paymentMethodId: row.payment_method_id,
    paymentMethodName: row.payment_methods?.name ?? "Medio de pago",
    amount: Number(row.amount),
    paidAt: row.paid_at,
    operationReference: row.operation_reference,
    evidenceReference: row.evidence_reference,
    status: row.status,
    reconciliationNotes: row.reconciliation_notes,
    reconciledAt: row.reconciled_at,
  };
}

function salesReceiptFromRow(row: SalesReceiptRow): SalesReceipt {
  return {
    id: row.id,
    orderId: row.order_id,
    type: row.receipt_type,
    seriesNumber: row.series_number,
    customerDocument: row.customer_document,
    issuedAt: row.issued_at,
    total: Number(row.total),
    status: row.status,
  };
}

function orderExpenseFromRow(row: OrderExpenseRow): OrderExpense {
  return {
    id: row.id,
    orderId: row.order_id,
    category: row.category,
    amount: Number(row.amount),
    incurredAt: row.incurred_at,
    reference: row.reference,
    notes: row.notes,
  };
}

function customerFromRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    document: row.document,
    notes: row.notes ?? "",
    segment: row.segment ?? "hogar",
    subscriptionInterest: row.subscription_interest ?? false,
    lastAddress: row.last_address,
    deliveryZoneId: row.last_delivery_zone_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function customerWithMetrics(customer: Customer, orders: Order[]): CustomerMetrics {
  const customerOrders = orders
    .filter(
      (order) =>
        order.customerId === customer.id ||
        (!order.customerId && normalizePhone(order.phone) === normalizePhone(customer.phone)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    ...customer,
    orders: customerOrders,
    orderCount: customerOrders.length,
    deliveredOrders: customerOrders.filter((order) => order.status === "delivered").length,
    lifetimeValue: customerOrders
      .filter((order) => order.status !== "cancelled")
      .reduce((sum, order) => sum + (order.total ?? 0), 0),
    lastOrderAt: customerOrders[0]?.createdAt ?? null,
  };
}

function inventoryLotFromRow(row: InventoryLotRow): InventoryLot {
  return {
    id: row.id,
    code: row.code,
    productId: row.product_id,
    productName: row.products?.name ?? "Producto",
    presentation: row.products?.presentation ?? "",
    originType: row.origin_type,
    supplierName: row.supplier_name,
    locationId: row.location_id,
    locationName: row.locations?.name ?? "Ubicación",
    receivedQuantity: Number(row.received_quantity),
    quantity: Number(row.quantity),
    unit: row.unit,
    unitCost: numberValue(row.unit_cost),
    receivedAt: row.produced_or_received_at,
    expiresAt: row.expires_at,
    status: row.status,
    notes: row.notes ?? "",
    supplierDocument: row.supplier_document ?? null,
    supplierLotCode: row.supplier_lot_code ?? null,
    arrivalTemperatureC: numberValue(row.arrival_temperature_c ?? null),
    storageTemperatureC: numberValue(row.storage_temperature_c ?? null),
    packagingCondition: row.packaging_condition ?? "",
    sanitaryStatus: row.sanitary_status ?? null,
    sanitaryNotes: row.sanitary_notes ?? "",
    sanitaryReviewedAt: row.sanitary_reviewed_at ?? null,
    sourceBirdBatchId: row.source_bird_batch_id ?? null,
    sourceBirdBatchCode: row.bird_batches?.code ?? null,
    sourceLayerFlockId: row.source_layer_flock_id ?? null,
    sourceLayerFlockCode: row.layer_flocks?.code ?? null,
    processedUnits: numberValue(row.processed_units ?? null),
    createdAt: row.created_at,
    movements: (row.inventory_movements ?? []).map((movement) => ({
      id: movement.id,
      type: movement.movement_type,
      quantityDelta: Number(movement.quantity_delta),
      unit: movement.unit,
      reason: movement.reason,
      orderItemId: movement.order_item_id,
      createdAt: movement.created_at,
    })),
  };
}

function birdBatchFromRow(row: BirdBatchRow): BirdBatch {
  return {
    id: row.id,
    code: row.code,
    locationId: row.location_id,
    locationName: row.locations?.name ?? "Unidad productiva",
    sourceName: row.source_name,
    breed: row.breed,
    receivedAt: row.received_at,
    initialCount: Number(row.initial_count),
    currentCount: Number(row.current_count),
    processedCount: Number(row.processed_count),
    initialAvgWeightGrams: numberValue(row.initial_avg_weight_grams),
    costPerChick: numberValue(row.cost_per_chick),
    stage: row.stage,
    notes: row.notes ?? "",
    createdAt: row.created_at,
    events: (row.bird_batch_events ?? [])
      .map((event) => ({
        id: event.id,
        type: event.event_type,
        eventAt: event.event_at,
        count: event.count,
        avgWeightGrams: numberValue(event.avg_weight_grams),
        feedKg: numberValue(event.feed_kg),
        feedUnitCost: numberValue(event.feed_unit_cost ?? null),
        amount: numberValue(event.amount ?? null),
        expenseCategory: event.expense_category ?? null,
        millBatchId: event.mill_batch_id ?? null,
        millBatchCode: event.mill_batches?.code ?? null,
        formulaName: event.mill_batches?.feed_formula_versions?.feed_formulas?.name ?? null,
        stage: event.stage,
        notes: event.notes ?? "",
      }))
      .sort((a, b) => b.eventAt.localeCompare(a.eventAt)),
  };
}

function layerFlockFromRow(row: LayerFlockRow): LayerFlock {
  const events: LayerFlockEvent[] = (row.layer_flock_events ?? [])
    .map((event) => ({
      id: event.id,
      type: event.event_type,
      eventAt: event.event_at,
      count: event.count,
      feedKg: numberValue(event.feed_kg),
      feedUnitCost: numberValue(event.feed_unit_cost),
      amount: numberValue(event.amount),
      expenseCategory: event.expense_category,
      millBatchId: event.mill_batch_id ?? null,
      millBatchCode: event.mill_batches?.code ?? null,
      formulaName: event.mill_batches?.feed_formula_versions?.feed_formulas?.name ?? null,
      notes: event.notes ?? "",
    }))
    .sort((a, b) => b.eventAt.localeCompare(a.eventAt));
  const collections: EggCollection[] = (row.egg_collections ?? [])
    .map((collection) => ({
      id: collection.id,
      collectedAt: collection.collected_at,
      collectedEggs: Number(collection.collected_eggs),
      rejectedEggs: Number(collection.rejected_eggs),
      notes: collection.notes ?? "",
    }))
    .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
  return {
    id: row.id,
    code: row.code,
    locationId: row.location_id,
    locationName: row.locations?.name ?? "Unidad productiva",
    sourceName: row.source_name,
    breed: row.breed,
    startedAt: row.started_at,
    initialHens: Number(row.initial_hens),
    currentHens: Number(row.current_hens),
    availableEggs: Number(row.available_eggs),
    packedMaples: Number(row.packed_maples),
    costPerHen: numberValue(row.cost_per_hen),
    status: row.status,
    notes: row.notes ?? "",
    events,
    collections,
    createdAt: row.created_at,
  };
}

function feedInputFromRow(row: FeedInputRow): FeedInput {
  const price = [...(row.feed_input_prices ?? [])].sort((a, b) =>
    b.effective_at.localeCompare(a.effective_at),
  )[0];
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    active: row.active,
    latestCostPerKg: price ? Number(price.cost_per_kg) : null,
    latestCostAt: price?.effective_at ?? null,
    supplierName: price?.supplier_name ?? null,
  };
}

function feedInputLotFromRow(row: FeedInputLotRow): FeedInputLot {
  return {
    id: row.id,
    code: row.code,
    inputId: row.input_id,
    inputName: row.feed_inputs?.name ?? "Insumo",
    supplierName: row.suppliers?.name ?? "Proveedor no identificado",
    supplierTaxId: row.suppliers?.tax_id ?? null,
    locationName: row.locations?.name ?? "Molino",
    receivedKg: Number(row.received_kg),
    availableKg: Number(row.available_kg),
    unitCost: Number(row.unit_cost),
    receivedAt: row.received_at,
    documentReference: row.document_reference,
    qualityStatus: row.quality_status,
    qualityNotes: row.quality_notes ?? "",
    notes: row.notes ?? "",
  };
}

function feedFormulaFromRow(row: FeedFormulaRow): FeedFormula {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    species: row.species,
    stage: row.stage,
    active: row.active,
    versions: (row.feed_formula_versions ?? [])
      .map((version) => ({
        id: version.id,
        version: Number(version.version),
        status: version.status,
        targetKg: Number(version.target_kg),
        notes: version.notes ?? "",
        createdAt: version.created_at,
        items: (version.feed_formula_items ?? []).map((item) => {
          const price = item.feed_inputs ? feedInputFromRow(item.feed_inputs).latestCostPerKg : null;
          const quantityKg = Number(item.quantity_kg);
          return {
            id: item.id,
            inputId: item.input_id,
            inputName: item.feed_inputs?.name ?? "Insumo",
            quantityKg,
            percentage: Number(item.percentage),
            costPerKg: price,
            subtotal: price === null ? null : quantityKg * price,
          };
        }),
      }))
      .sort((a, b) => b.version - a.version),
  };
}

function millBatchFromRow(row: MillBatchRow): MillBatch {
  return {
    id: row.id,
    code: row.code,
    formulaName: row.feed_formula_versions?.feed_formulas?.name ?? "Fórmula",
    formulaVersion: Number(row.feed_formula_versions?.version ?? 0),
    locationName: row.locations?.name ?? "Molino",
    usage: row.usage,
    producedKg: Number(row.produced_kg),
    availableKg: Number(row.available_kg),
    totalCost: Number(row.total_cost),
    costPerKg: Number(row.cost_per_kg),
    producedAt: row.produced_at,
    notes: row.notes ?? "",
  };
}

function assignmentFromRow(order: AssignmentOrderRow): DispatchableOrderItem[] {
  return order.order_items
    .filter((item) => !item.lot_id && item.products)
    .map((item) => {
      const product = item.products!;
      const inventoryUnit: InventoryUnit = product.price_unit === "kg" ? "kg" : product.price_unit;
      const requestedQuantity = Number(item.quantity);
      const requiredStockQuantity =
        product.price_unit === "kg" && product.portion_grams
          ? requestedQuantity * (product.portion_grams / 1000)
          : product.price_unit === "kg"
            ? null
            : requestedQuantity;
      return {
        orderId: order.id,
        orderNumber: order.number,
        orderStatus: order.status,
        orderItemId: item.id,
        productId: item.product_id,
        productName: product.name,
        presentation: product.presentation,
        requestedQuantity,
        requiredStockQuantity,
        inventoryUnit,
      };
    });
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function assertDatabaseResult(error: { message: string } | null, context: string) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

async function writeLocalState(state: CommerceState): Promise<CommerceState> {
  const nextState = { ...state, updatedAt: new Date().toISOString() };
  const temporaryFile = `${dataFile}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(nextState, null, 2), "utf8");
  await fs.rename(temporaryFile, dataFile);
  return nextState;
}

async function getLocalState(): Promise<CommerceState> {
  const source = await fs.readFile(dataFile, "utf8");
  return JSON.parse(source) as CommerceState;
}

async function getSupabaseCommerceState(includeProtected: boolean): Promise<CommerceState> {
  const supabase = await createSupabaseClient();
  const productsRequest = supabase.from("products").select("*").order("name");
  const zonesRequest = supabase.from("delivery_zones").select("*").order("name");
  const paymentsRequest = supabase.from("payment_methods").select("*").order("name");
  const [products, zones, payments] = await Promise.all([
    productsRequest,
    zonesRequest,
    paymentsRequest,
  ]);
  assertDatabaseResult(products.error, "No se pudo leer productos");
  assertDatabaseResult(zones.error, "No se pudo leer delivery");
  assertDatabaseResult(payments.error, "No se pudo leer pagos");

  let locations: BusinessLocation[] = [];
  let roles: StaffRole[] = [];
  let orders: Order[] = [];

  if (includeProtected) {
    const [locationsResult, rolesResult, ordersResult] = await Promise.all([
      supabase.from("locations").select("*").order("name"),
      supabase.from("staff_roles").select("*").order("name"),
      supabase
        .from("orders")
        .select("*, customers(name, phone), order_items(*, products(name, presentation), inventory_lots(code))")
        .order("created_at", { ascending: false }),
    ]);
    assertDatabaseResult(locationsResult.error, "No se pudo leer sedes");
    assertDatabaseResult(rolesResult.error, "No se pudo leer roles");
    assertDatabaseResult(ordersResult.error, "No se pudo leer pedidos");
    locations = (locationsResult.data as LocationRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      address: row.address ?? "",
      active: row.active,
    }));
    roles = (rolesResult.data as RoleRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      scope: row.scope,
      permissions: [],
    }));
    orders = (ordersResult.data as unknown as OrderRow[]).map(orderFromRow);
  }

  return {
    products: (products.data as ProductRow[]).map(productFromRow),
    deliveryZones: (zones.data as DeliveryZoneRow[]).map(zoneFromRow),
    paymentMethods: (payments.data as PaymentMethodRow[]).map(paymentFromRow),
    locations,
    roles,
    orders,
    updatedAt: new Date().toISOString(),
  };
}

export async function getStorefrontState(): Promise<CommerceState> {
  if (!isSupabaseConfigured()) {
    return getLocalState();
  }
  try {
    return await getSupabaseCommerceState(false);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Supabase aún no tiene el catálogo migrado; usando datos locales en desarrollo.", error);
      return getLocalState();
    }
    throw error;
  }
}

export async function getCommerceState(): Promise<CommerceState> {
  if (!isSupabaseConfigured()) {
    return getLocalState();
  }
  return getSupabaseCommerceState(true);
}

export async function listVisibleProducts(): Promise<Product[]> {
  const state = await getStorefrontState();
  return state.products.filter((product) => product.active);
}

export async function createProduct(product: Product): Promise<Product> {
  if (!isSupabaseConfigured()) {
    const state = await getLocalState();
    if (state.products.some((current) => current.sku === product.sku)) {
      throw new Error("Ya existe un producto con ese SKU.");
    }
    await writeLocalState({ ...state, products: [product, ...state.products] });
    return product;
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .insert(productToRow(product))
    .select("*")
    .single();
  assertDatabaseResult(error, "No se pudo crear el producto");
  return productFromRow(data as ProductRow);
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  if (!isSupabaseConfigured()) {
    const state = await getLocalState();
    const current = state.products.find((product) => product.id === id);
    if (!current) {
      throw new Error("Producto no encontrado.");
    }
    const next = { ...current, ...updates, id: current.id };
    await writeLocalState({
      ...state,
      products: state.products.map((product) => (product.id === id ? next : product)),
    });
    return next;
  }

  const row: Record<string, unknown> = {};
  if (updates.sku !== undefined) row.sku = updates.sku;
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.category !== undefined) row.category = updates.category;
  if (updates.originType !== undefined) row.origin_type = updates.originType;
  if (updates.description !== undefined) row.description = updates.description;
  if (updates.presentation !== undefined) row.presentation = updates.presentation;
  if (updates.priceUnit !== undefined) row.price_unit = updates.priceUnit;
  if (updates.price !== undefined) row.price = updates.price;
  if (updates.portionGrams !== undefined) row.portion_grams = updates.portionGrams;
  if (updates.imageUrl !== undefined) row.image_url = updates.imageUrl;
  if (updates.active !== undefined) row.active = updates.active;
  if (updates.subscriptionEligible !== undefined) row.subscription_eligible = updates.subscriptionEligible;
  if (updates.traceable !== undefined) row.traceable = updates.traceable;

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  assertDatabaseResult(error, "No se pudo actualizar el producto");
  return productFromRow(data as ProductRow);
}

export async function deleteProduct(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const state = await getLocalState();
    await writeLocalState({
      ...state,
      products: state.products.filter((product) => product.id !== id),
    });
    return;
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  assertDatabaseResult(error, "No se pudo eliminar el producto");
}

export async function updateDeliveryZones(deliveryZones: DeliveryZone[]): Promise<DeliveryZone[]> {
  if (!isSupabaseConfigured()) {
    const state = await getLocalState();
    await writeLocalState({ ...state, deliveryZones });
    return deliveryZones;
  }

  const supabase = await createSupabaseClient();
  for (const zone of deliveryZones) {
    const { error } = await supabase
      .from("delivery_zones")
      .update({
        name: zone.name,
        neighborhoods: zone.neighborhoods,
        base_fee: zone.baseFee,
        free_from: zone.freeFrom,
        subscription_available: zone.subscriptionAvailable,
        active: zone.active,
      })
      .eq("id", zone.id);
    assertDatabaseResult(error, "No se pudo actualizar delivery");
  }
  return deliveryZones;
}

export async function updatePaymentMethods(paymentMethods: PaymentMethod[]): Promise<PaymentMethod[]> {
  if (!isSupabaseConfigured()) {
    const state = await getLocalState();
    await writeLocalState({ ...state, paymentMethods });
    return paymentMethods;
  }

  const supabase = await createSupabaseClient();
  for (const payment of paymentMethods) {
    const { error } = await supabase
      .from("payment_methods")
      .update({
        name: payment.name,
        instructions: payment.instructions,
        active: payment.active,
      })
      .eq("id", payment.id);
    assertDatabaseResult(error, "No se pudo actualizar el medio de pago");
  }
  return paymentMethods;
}

export async function createOrder(order: Order): Promise<Order> {
  if (isSupabaseConfigured()) {
    throw new Error("Los pedidos productivos deben crearse mediante la función segura.");
  }
  const state = await getLocalState();
  const normalizedPhone = normalizePhone(order.phone);
  const existing = (state.customers ?? []).find(
    (customer) => normalizePhone(customer.phone) === normalizedPhone,
  );
  const now = new Date().toISOString();
  const customer: Customer = existing
    ? {
        ...existing,
        name: order.customerName,
        phone: order.phone,
        lastAddress: order.address,
        deliveryZoneId: order.deliveryZoneId,
        updatedAt: now,
      }
    : {
        id: `cus-${randomUUID()}`,
        name: order.customerName,
        phone: order.phone,
        email: null,
        document: null,
        notes: "",
        segment: "hogar",
        subscriptionInterest: false,
        lastAddress: order.address,
        deliveryZoneId: order.deliveryZoneId,
        createdAt: now,
        updatedAt: now,
      };
  const created = { ...order, customerId: customer.id };
  const customers = existing
    ? (state.customers ?? []).map((current) => (current.id === customer.id ? customer : current))
    : [customer, ...(state.customers ?? [])];
  await writeLocalState({ ...state, customers, orders: [created, ...state.orders] });
  return created;
}

export async function createStorefrontOrder(payload: {
  customerName: string;
  phone: string;
  address: string;
  deliveryZoneId: string;
  paymentMethodId: string;
  items: { productId: string; quantity: number }[];
}): Promise<StorefrontOrderResult> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc("create_storefront_order", {
    p_customer_name: payload.customerName,
    p_phone: payload.phone,
    p_address: payload.address,
    p_delivery_zone_id: payload.deliveryZoneId,
    p_payment_method_id: payload.paymentMethodId,
    p_items: payload.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
    })),
  });
  assertDatabaseResult(error, "No se pudo registrar el pedido");
  const result = data as {
    order: Order;
    zoneName: string;
    paymentName: string;
  };
  return result;
}

export async function updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
  if (!isSupabaseConfigured()) {
    const state = await getLocalState();
    const current = state.orders.find((order) => order.id === id);
    if (!current) {
      throw new Error("Pedido no encontrado.");
    }
    const next = { ...current, ...updates, id: current.id };
    await writeLocalState({
      ...state,
      orders: state.orders.map((order) => (order.id === id ? next : order)),
    });
    return next;
  }

  const supabase = await createSupabaseClient();
  const { error: updateError } = await supabase.rpc("transition_order_status", {
    p_order_id: id,
    p_status: updates.status!,
  });
  assertDatabaseResult(updateError, "No se pudo actualizar el pedido");
  const { data, error } = await supabase
    .from("orders")
    .select("*, customers(name, phone), order_items(*, products(name, presentation), inventory_lots(code))")
    .eq("id", id)
    .single();
  assertDatabaseResult(error, "No se pudo actualizar el pedido");
  return orderFromRow(data as unknown as OrderRow);
}

export async function getFinanceWorkspace(): Promise<FinanceWorkspace> {
  if (!isSupabaseConfigured()) {
    return {
      orders: [],
      reconciledRevenue: 0,
      accountsReceivable: 0,
      registeredCost: 0,
      operatingCost: 0,
      auditableMargin: 0,
      pendingReconciliationCount: 0,
      missingReceiptCount: 0,
    };
  }
  const supabase = await createSupabaseClient();
  const [ordersResult, paymentsResult, receiptsResult, expensesResult] = await Promise.all([
    supabase
      .from("orders")
      .select("*, customers(name, phone), order_items(*, products(name, presentation), inventory_lots(code))")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),
    supabase
      .from("order_payments")
      .select("*, payment_methods(name)")
      .order("paid_at", { ascending: false }),
    supabase.from("sales_receipts").select("*").order("issued_at", { ascending: false }),
    supabase.from("order_expenses").select("*").order("incurred_at", { ascending: false }),
  ]);
  assertDatabaseResult(ordersResult.error, "No se pudo leer pedidos financieros");
  assertDatabaseResult(paymentsResult.error, "No se pudo leer cobros");
  assertDatabaseResult(receiptsResult.error, "No se pudo leer comprobantes");
  assertDatabaseResult(expensesResult.error, "No se pudo leer gastos de pedido");

  const payments = (paymentsResult.data as unknown as OrderPaymentRow[]).map(paymentRecordFromRow);
  const receipts = (receiptsResult.data as SalesReceiptRow[]).map(salesReceiptFromRow);
  const expenses = (expensesResult.data as OrderExpenseRow[]).map(orderExpenseFromRow);
  const orders: FinanceOrder[] = (ordersResult.data as unknown as OrderRow[]).map((row) => {
    const order = orderFromRow(row);
    const orderPayments = payments.filter((payment) => payment.orderId === order.id);
    const orderExpenses = expenses.filter((expense) => expense.orderId === order.id);
    const receipt = receipts.find((entry) => entry.orderId === order.id && entry.status === "issued") ?? null;
    const reconciledAmount = orderPayments
      .filter((payment) => payment.status === "reconciled")
      .reduce((sum, payment) => sum + payment.amount, 0);
    const pendingAmount = orderPayments
      .filter((payment) => payment.status === "pending")
      .reduce((sum, payment) => sum + payment.amount, 0);
    const hasCompleteStockCost = order.items.every((item) => item.costTotal !== null);
    const stockCost = hasCompleteStockCost
      ? order.items.reduce((sum, item) => sum + (item.costTotal ?? 0), 0)
      : null;
    const operatingCost = orderExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    return {
      ...order,
      payments: orderPayments,
      receipt,
      expenses: orderExpenses,
      reconciledAmount,
      pendingAmount,
      stockCost,
      operatingCost,
      margin: order.total !== null && stockCost !== null
        ? order.total - stockCost - operatingCost
        : null,
    };
  });
  const completedWithAuditableMargin = orders.filter(
    (order) =>
      order.status === "delivered" &&
      order.margin !== null &&
      order.total !== null &&
      order.reconciledAmount >= order.total,
  );
  const collectableOrders = orders.filter((order) =>
    ["confirmed", "preparing", "dispatched", "delivered"].includes(order.status),
  );
  return {
    orders,
    reconciledRevenue: orders.reduce((sum, order) => sum + order.reconciledAmount, 0),
    accountsReceivable: collectableOrders.reduce(
      (sum, order) => sum + Math.max((order.total ?? 0) - order.reconciledAmount, 0),
      0,
    ),
    registeredCost: orders.reduce((sum, order) => sum + (order.stockCost ?? 0), 0),
    operatingCost: orders.reduce((sum, order) => sum + order.operatingCost, 0),
    auditableMargin: completedWithAuditableMargin.reduce((sum, order) => sum + (order.margin ?? 0), 0),
    pendingReconciliationCount: payments.filter((payment) => payment.status === "pending").length,
    missingReceiptCount: orders.filter((order) => order.status === "delivered" && !order.receipt).length,
  };
}

export async function registerOrderPayment(payload: {
  orderId: string;
  paymentMethodId: string;
  amount: number;
  paidAt: string;
  operationReference: string;
  evidenceReference: string;
  notes: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("La gestion financiera requiere Supabase activo.");
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("register_order_payment", {
    p_order_id: payload.orderId,
    p_payment_method_id: payload.paymentMethodId,
    p_amount: payload.amount,
    p_paid_at: payload.paidAt,
    p_operation_reference: payload.operationReference,
    p_evidence_reference: payload.evidenceReference,
    p_notes: payload.notes,
  });
  assertDatabaseResult(error, "No se pudo registrar el cobro");
}

export async function reviewOrderPayment(payload: {
  paymentId: string;
  status: "reconciled" | "rejected";
  notes: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("La gestion financiera requiere Supabase activo.");
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("review_order_payment", {
    p_payment_id: payload.paymentId,
    p_status: payload.status,
    p_notes: payload.notes,
  });
  assertDatabaseResult(error, "No se pudo conciliar el cobro");
}

export async function issueSalesReceipt(payload: {
  orderId: string;
  type: SalesReceiptType;
  seriesNumber: string;
  customerDocument: string | null;
  issuedAt: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("La gestion financiera requiere Supabase activo.");
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("issue_sales_receipt", {
    p_order_id: payload.orderId,
    p_receipt_type: payload.type,
    p_series_number: payload.seriesNumber,
    p_customer_document: payload.customerDocument,
    p_issued_at: payload.issuedAt,
  });
  assertDatabaseResult(error, "No se pudo registrar el comprobante");
}

export async function voidSalesReceipt(payload: {
  receiptId: string;
  reason: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("La gestion financiera requiere Supabase activo.");
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("void_sales_receipt", {
    p_receipt_id: payload.receiptId,
    p_reason: payload.reason,
  });
  assertDatabaseResult(error, "No se pudo anular el comprobante");
}

export async function recordOrderExpense(payload: {
  orderId: string;
  category: OrderExpenseCategory;
  amount: number;
  incurredAt: string;
  reference: string;
  notes: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("La gestion financiera requiere Supabase activo.");
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("record_order_expense", {
    p_order_id: payload.orderId,
    p_category: payload.category,
    p_amount: payload.amount,
    p_incurred_at: payload.incurredAt,
    p_reference: payload.reference,
    p_notes: payload.notes,
  });
  assertDatabaseResult(error, "No se pudo registrar el gasto");
}

export async function listCustomersWithMetrics(): Promise<CustomerMetrics[]> {
  if (!isSupabaseConfigured()) {
    const state = await getLocalState();
    return (state.customers ?? [])
      .map((customer) => customerWithMetrics(customer, state.orders))
      .sort((a, b) => (b.lastOrderAt ?? b.createdAt).localeCompare(a.lastOrderAt ?? a.createdAt));
  }

  const supabase = await createSupabaseClient();
  const [customersResult, ordersResult] = await Promise.all([
    supabase.from("customers").select("*").order("updated_at", { ascending: false }),
    supabase
      .from("orders")
      .select("*, customers(name, phone), order_items(*, products(name, presentation), inventory_lots(code))")
      .order("created_at", { ascending: false }),
  ]);
  assertDatabaseResult(customersResult.error, "No se pudo leer clientes");
  assertDatabaseResult(ordersResult.error, "No se pudo leer historial de clientes");
  const orders = (ordersResult.data as unknown as OrderRow[]).map(orderFromRow);
  return (customersResult.data as CustomerRow[])
    .map((row) => customerWithMetrics(customerFromRow(row), orders))
    .sort((a, b) => (b.lastOrderAt ?? b.createdAt).localeCompare(a.lastOrderAt ?? a.createdAt));
}

export async function updateCustomer(
  id: string,
  updates: Pick<Customer, "name" | "phone" | "email" | "document" | "notes" | "segment" | "subscriptionInterest">,
): Promise<Customer> {
  if (!isSupabaseConfigured()) {
    const state = await getLocalState();
    const current = (state.customers ?? []).find((customer) => customer.id === id);
    if (!current) {
      throw new Error("Cliente no encontrado.");
    }
    const next = { ...current, ...updates, updatedAt: new Date().toISOString() };
    await writeLocalState({
      ...state,
      customers: (state.customers ?? []).map((customer) => (customer.id === id ? next : customer)),
    });
    return next;
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .update({
      name: updates.name,
      phone: updates.phone,
      phone_normalized: normalizePhone(updates.phone),
      email: updates.email,
      document: updates.document,
      notes: updates.notes,
      segment: updates.segment,
      subscription_interest: updates.subscriptionInterest,
    })
    .eq("id", id)
    .select("*")
    .single();
  assertDatabaseResult(error, "No se pudo actualizar el cliente");
  return customerFromRow(data as CustomerRow);
}

export async function getInventoryWorkspace(): Promise<InventoryWorkspace> {
  if (!isSupabaseConfigured()) {
    return {
      lots: [],
      pendingAssignments: [],
      availableStockValue: 0,
      activeLotCount: 0,
      expiringLotCount: 0,
      pendingAssignmentCount: 0,
      controlledPurchasedLotCount: 0,
      approvedPurchasedLotCount: 0,
    };
  }

  const supabase = await createSupabaseClient();
  const [lotsResult, ordersResult] = await Promise.all([
    supabase
      .from("inventory_lots")
      .select("*, products(name, presentation), locations(name), bird_batches(code), layer_flocks(code), inventory_movements(*)")
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, number, status, order_items(id, product_id, lot_id, quantity, products(name, presentation, price_unit, portion_grams))")
      .in("status", ["confirmed", "preparing"])
      .order("created_at", { ascending: false }),
  ]);
  assertDatabaseResult(lotsResult.error, "No se pudo leer lotes");
  assertDatabaseResult(ordersResult.error, "No se pudo leer pedidos por despachar");

  const lots = (lotsResult.data as unknown as InventoryLotRow[]).map(inventoryLotFromRow);
  const pendingAssignments = (ordersResult.data as unknown as AssignmentOrderRow[]).flatMap(assignmentFromRow);
  const expirationLimit = new Date();
  expirationLimit.setDate(expirationLimit.getDate() + 5);
  const expiringLotCount = lots.filter(
    (lot) =>
      lot.quantity > 0 &&
      lot.expiresAt !== null &&
      new Date(lot.expiresAt).getTime() <= expirationLimit.getTime(),
  ).length;
  return {
    lots,
    pendingAssignments,
    availableStockValue: lots.reduce(
      (sum, lot) => sum + lot.quantity * (lot.unitCost ?? 0),
      0,
    ),
    activeLotCount: lots.filter(
      (lot) =>
        lot.quantity > 0 &&
        lot.status === "available" &&
        (lot.originType === "own" || lot.sanitaryStatus === "approved"),
    ).length,
    expiringLotCount,
    pendingAssignmentCount: pendingAssignments.length,
    controlledPurchasedLotCount: lots.filter((lot) => lot.sanitaryStatus !== null).length,
    approvedPurchasedLotCount: lots.filter((lot) => lot.sanitaryStatus === "approved").length,
  };
}

export async function createInventoryLot(payload: {
  productId: string;
  locationId: string;
  quantity: number;
  unit: InventoryUnit;
  unitCost: number | null;
  receivedAt: string;
  expiresAt: string | null;
  supplierName: string | null;
  supplierDocument: string;
  supplierLotCode: string;
  arrivalTemperatureC: number;
  storageTemperatureC: number;
  packagingCondition: string;
  notes: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("El inventario operativo requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("create_inventory_lot", {
    p_product_id: payload.productId,
    p_location_id: payload.locationId,
    p_quantity: payload.quantity,
    p_unit: payload.unit,
    p_unit_cost: payload.unitCost,
    p_received_at: payload.receivedAt,
    p_expires_at: payload.expiresAt,
    p_supplier_name: payload.supplierName,
    p_supplier_document: payload.supplierDocument,
    p_supplier_lot_code: payload.supplierLotCode,
    p_arrival_temperature_c: payload.arrivalTemperatureC,
    p_storage_temperature_c: payload.storageTemperatureC,
    p_packaging_condition: payload.packagingCondition,
    p_notes: payload.notes,
  });
  assertDatabaseResult(error, "No se pudo registrar el lote");
}

export async function reviewInventoryLotSanitary(payload: {
  lotId: string;
  sanitaryStatus: "approved" | "rejected";
  sanitaryNotes: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("El control sanitario requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("review_inventory_lot_sanitary", {
    p_lot_id: payload.lotId,
    p_sanitary_status: payload.sanitaryStatus,
    p_sanitary_notes: payload.sanitaryNotes,
  });
  assertDatabaseResult(error, "No se pudo revisar la liberacion sanitaria");
}

export async function recordInventorySanitaryEvidence(payload: {
  lotId: string;
  supplierDocument: string;
  supplierLotCode: string;
  arrivalTemperatureC: number;
  storageTemperatureC: number;
  packagingCondition: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("El control sanitario requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("record_inventory_lot_sanitary_evidence", {
    p_lot_id: payload.lotId,
    p_supplier_document: payload.supplierDocument,
    p_supplier_lot_code: payload.supplierLotCode,
    p_arrival_temperature_c: payload.arrivalTemperatureC,
    p_storage_temperature_c: payload.storageTemperatureC,
    p_packaging_condition: payload.packagingCondition,
  });
  assertDatabaseResult(error, "No se pudo registrar el expediente sanitario");
}

export async function recordInventoryMovement(payload: {
  lotId: string;
  type: "adjustment_in" | "waste";
  quantity: number;
  reason: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("El inventario operativo requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("record_inventory_movement", {
    p_lot_id: payload.lotId,
    p_movement_type: payload.type,
    p_quantity: payload.quantity,
    p_reason: payload.reason,
  });
  assertDatabaseResult(error, "No se pudo registrar el movimiento");
}

export async function allocateLotToOrderItem(payload: {
  orderItemId: string;
  lotId: string;
  quantity: number;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("El despacho trazable requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("allocate_inventory_lot", {
    p_order_item_id: payload.orderItemId,
    p_lot_id: payload.lotId,
    p_quantity: payload.quantity,
  });
  assertDatabaseResult(error, "No se pudo asignar el lote al pedido");
}

export async function getPoultryWorkspace(): Promise<PoultryWorkspace> {
  if (!isSupabaseConfigured()) {
    return {
      batches: [],
      activeBatchCount: 0,
      liveBirdCount: 0,
      mortalityCount: 0,
      processedCount: 0,
    };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("bird_batches")
    .select("*, locations(name), bird_batch_events(*, mill_batches(code, feed_formula_versions(feed_formulas(name))))")
    .order("created_at", { ascending: false });
  assertDatabaseResult(error, "No se pudo leer la crianza avícola");
  const batches = (data as unknown as BirdBatchRow[]).map(birdBatchFromRow);
  return {
    batches,
    activeBatchCount: batches.filter((batch) => !["processed", "closed"].includes(batch.stage)).length,
    liveBirdCount: batches.reduce((sum, batch) => sum + batch.currentCount, 0),
    mortalityCount: batches.reduce(
      (sum, batch) =>
        sum +
        batch.events
          .filter((event) => event.type === "mortality")
          .reduce((batchSum, event) => batchSum + (event.count ?? 0), 0),
      0,
    ),
    processedCount: batches.reduce((sum, batch) => sum + batch.processedCount, 0),
  };
}

export async function createBirdBatch(payload: {
  locationId: string;
  sourceName: string;
  breed: string | null;
  receivedAt: string;
  initialCount: number;
  initialAvgWeightGrams: number | null;
  costPerChick: number | null;
  notes: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("La crianza operativa requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("create_bird_batch", {
    p_location_id: payload.locationId,
    p_source_name: payload.sourceName,
    p_breed: payload.breed,
    p_received_at: payload.receivedAt,
    p_initial_count: payload.initialCount,
    p_initial_avg_weight_grams: payload.initialAvgWeightGrams,
    p_cost_per_chick: payload.costPerChick,
    p_notes: payload.notes,
  });
  assertDatabaseResult(error, "No se pudo registrar el lote de crianza");
}

export async function recordBirdBatchEvent(payload: {
  batchId: string;
  type: "mortality" | "weight_sample" | "feed_consumption" | "expense" | "stage_change";
  eventAt: string;
  count: number | null;
  avgWeightGrams: number | null;
  feedKg: number | null;
  feedUnitCost: number | null;
  amount: number | null;
  expenseCategory: PoultryExpenseCategory | null;
  millBatchId: string | null;
  stage: BirdBatchStage | null;
  notes: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("La crianza operativa requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("record_bird_batch_event", {
    p_batch_id: payload.batchId,
    p_event_type: payload.type,
    p_event_at: payload.eventAt,
    p_count: payload.count,
    p_avg_weight_grams: payload.avgWeightGrams,
    p_feed_kg: payload.feedKg,
    p_feed_unit_cost: payload.feedUnitCost,
    p_amount: payload.amount,
    p_expense_category: payload.expenseCategory,
    p_stage: payload.stage,
    p_notes: payload.notes,
    p_mill_batch_id: payload.millBatchId,
  });
  assertDatabaseResult(error, "No se pudo registrar el evento de crianza");
}

export async function valueBirdBatchFeedEvent(payload: {
  batchId: string;
  eventId: string;
  feedUnitCost: number;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("La crianza operativa requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("value_bird_feed_event", {
    p_batch_id: payload.batchId,
    p_event_id: payload.eventId,
    p_feed_unit_cost: payload.feedUnitCost,
  });
  assertDatabaseResult(error, "No se pudo valorizar el consumo de alimento");
}

export async function harvestBirdBatch(payload: {
  batchId: string;
  productId: string;
  locationId: string;
  processedUnits: number;
  netWeightKg: number;
  unitCost: number | null;
  processedAt: string;
  expiresAt: string | null;
  notes: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("La salida a inventario requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("harvest_bird_batch_to_inventory", {
    p_batch_id: payload.batchId,
    p_product_id: payload.productId,
    p_location_id: payload.locationId,
    p_processed_units: payload.processedUnits,
    p_net_weight_kg: payload.netWeightKg,
    p_unit_cost: payload.unitCost,
    p_processed_at: payload.processedAt,
    p_expires_at: payload.expiresAt,
    p_notes: payload.notes,
  });
  assertDatabaseResult(error, "No se pudo transferir el pollo faenado a inventario");
}

export async function getEggWorkspace(): Promise<EggWorkspace> {
  if (!isSupabaseConfigured()) {
    return {
      flocks: [],
      activeFlockCount: 0,
      liveHenCount: 0,
      collectedEggCount: 0,
      availableEggCount: 0,
      packedMapleCount: 0,
    };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("layer_flocks")
    .select("*, locations(name), layer_flock_events(*, mill_batches(code, feed_formula_versions(feed_formulas(name)))), egg_collections(*)")
    .order("created_at", { ascending: false });
  assertDatabaseResult(error, "No se pudo leer la producción de huevos");
  const flocks = (data as unknown as LayerFlockRow[]).map(layerFlockFromRow);
  return {
    flocks,
    activeFlockCount: flocks.filter((flock) => flock.status === "active").length,
    liveHenCount: flocks.reduce((sum, flock) => sum + flock.currentHens, 0),
    collectedEggCount: flocks.reduce(
      (sum, flock) =>
        sum + flock.collections.reduce((flockSum, collection) => flockSum + collection.collectedEggs, 0),
      0,
    ),
    availableEggCount: flocks.reduce((sum, flock) => sum + flock.availableEggs, 0),
    packedMapleCount: flocks.reduce((sum, flock) => sum + flock.packedMaples, 0),
  };
}

export async function createLayerFlock(payload: {
  locationId: string;
  sourceName: string;
  breed: string | null;
  startedAt: string;
  initialHens: number;
  costPerHen: number | null;
  notes: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("La producción de huevos requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("create_layer_flock", {
    p_location_id: payload.locationId,
    p_source_name: payload.sourceName,
    p_breed: payload.breed,
    p_started_at: payload.startedAt,
    p_initial_hens: payload.initialHens,
    p_cost_per_hen: payload.costPerHen,
    p_notes: payload.notes,
  });
  assertDatabaseResult(error, "No se pudo registrar el lote de ponedoras");
}

export async function recordLayerFlockEvent(payload: {
  flockId: string;
  type: LayerEventType;
  eventAt: string;
  count: number | null;
  feedKg: number | null;
  feedUnitCost: number | null;
  amount: number | null;
  expenseCategory: PoultryExpenseCategory | null;
  millBatchId: string | null;
  notes: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("La producción de huevos requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("record_layer_flock_event", {
    p_flock_id: payload.flockId,
    p_event_type: payload.type,
    p_event_at: payload.eventAt,
    p_count: payload.count,
    p_feed_kg: payload.feedKg,
    p_feed_unit_cost: payload.feedUnitCost,
    p_amount: payload.amount,
    p_expense_category: payload.expenseCategory,
    p_notes: payload.notes,
    p_mill_batch_id: payload.millBatchId,
  });
  assertDatabaseResult(error, "No se pudo registrar el seguimiento de ponedoras");
}

export async function collectEggs(payload: {
  flockId: string;
  collectedAt: string;
  collectedEggs: number;
  rejectedEggs: number;
  notes: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("La producción de huevos requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("collect_layer_eggs", {
    p_flock_id: payload.flockId,
    p_collected_at: payload.collectedAt,
    p_collected_eggs: payload.collectedEggs,
    p_rejected_eggs: payload.rejectedEggs,
    p_notes: payload.notes,
  });
  assertDatabaseResult(error, "No se pudo registrar la cosecha de huevos");
}

export async function packEggMaples(payload: {
  flockId: string;
  productId: string;
  locationId: string;
  mapleCount: number;
  unitCost: number | null;
  packedAt: string;
  expiresAt: string | null;
  notes: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("El empaque de maples requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("pack_egg_maples_to_inventory", {
    p_flock_id: payload.flockId,
    p_product_id: payload.productId,
    p_location_id: payload.locationId,
    p_maple_count: payload.mapleCount,
    p_unit_cost: payload.unitCost,
    p_packed_at: payload.packedAt,
    p_expires_at: payload.expiresAt,
    p_notes: payload.notes,
  });
  assertDatabaseResult(error, "No se pudo enviar los maples al inventario");
}

export async function getMillWorkspace(): Promise<MillWorkspace> {
  if (!isSupabaseConfigured()) {
    return {
      inputs: [],
      inputLots: [],
      formulas: [],
      batches: [],
      activeInputCount: 0,
      approvedFormulaCount: 0,
      approvedInputKg: 0,
      pendingQualityLotCount: 0,
      inputStockValue: 0,
      producedKg: 0,
      availableKg: 0,
      averageCostPerKg: null,
    };
  }

  const supabase = await createSupabaseClient();
  const [inputsResult, inputLotsResult, formulasResult, batchesResult] = await Promise.all([
    supabase
      .from("feed_inputs")
      .select("*, feed_input_prices(*)")
      .order("name", { ascending: true }),
    supabase
      .from("feed_input_lots")
      .select("*, feed_inputs(name), suppliers(name, tax_id), locations(name)")
      .order("received_at", { ascending: false }),
    supabase
      .from("feed_formulas")
      .select("*, feed_formula_versions(*, feed_formula_items(*, feed_inputs(*, feed_input_prices(*))))")
      .order("name", { ascending: true }),
    supabase
      .from("mill_batches")
      .select("*, locations(name), feed_formula_versions(version, feed_formulas(name))")
      .order("produced_at", { ascending: false }),
  ]);
  assertDatabaseResult(inputsResult.error, "No se pudo leer los insumos del molino");
  assertDatabaseResult(inputLotsResult.error, "No se pudo leer existencias de insumos");
  assertDatabaseResult(formulasResult.error, "No se pudo leer las fórmulas");
  assertDatabaseResult(batchesResult.error, "No se pudo leer la producción del molino");
  const inputs = (inputsResult.data as unknown as FeedInputRow[]).map(feedInputFromRow);
  const inputLots = (inputLotsResult.data as unknown as FeedInputLotRow[]).map(feedInputLotFromRow);
  const formulas = (formulasResult.data as unknown as FeedFormulaRow[]).map(feedFormulaFromRow);
  const batches = (batchesResult.data as unknown as MillBatchRow[]).map(millBatchFromRow);
  const totalCost = batches.reduce((sum, batch) => sum + batch.totalCost, 0);
  const producedKg = batches.reduce((sum, batch) => sum + batch.producedKg, 0);
  const availableKg = batches
    .filter((batch) => batch.usage !== "external_service")
    .reduce((sum, batch) => sum + batch.availableKg, 0);
  return {
    inputs,
    inputLots,
    formulas,
    batches,
    activeInputCount: inputs.filter((input) => input.active).length,
    approvedFormulaCount: formulas.reduce(
      (sum, formula) => sum + formula.versions.filter((version) => version.status === "approved").length,
      0,
    ),
    approvedInputKg: inputLots
      .filter((lot) => lot.qualityStatus === "approved")
      .reduce((sum, lot) => sum + lot.availableKg, 0),
    pendingQualityLotCount: inputLots.filter((lot) => lot.qualityStatus === "pending").length,
    inputStockValue: inputLots.reduce((sum, lot) => sum + lot.availableKg * lot.unitCost, 0),
    producedKg,
    availableKg,
    averageCostPerKg: producedKg ? totalCost / producedKg : null,
  };
}

export async function receiveFeedInputLot(payload: {
  inputId: string;
  locationId: string;
  supplierName: string;
  supplierTaxId: string | null;
  quantityKg: number;
  unitCost: number;
  receivedAt: string;
  documentReference: string;
  qualityStatus: FeedInputQualityStatus;
  qualityNotes: string;
  notes: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("La recepcion de insumos requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("receive_feed_input_lot", {
    p_input_id: payload.inputId,
    p_location_id: payload.locationId,
    p_supplier_name: payload.supplierName,
    p_supplier_tax_id: payload.supplierTaxId,
    p_quantity_kg: payload.quantityKg,
    p_unit_cost: payload.unitCost,
    p_received_at: payload.receivedAt,
    p_document_reference: payload.documentReference,
    p_quality_status: payload.qualityStatus,
    p_quality_notes: payload.qualityNotes,
    p_notes: payload.notes,
  });
  assertDatabaseResult(error, "No se pudo recibir el insumo");
}

export async function reviewFeedInputLot(payload: {
  lotId: string;
  qualityStatus: Exclude<FeedInputQualityStatus, "pending">;
  qualityNotes: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("La liberacion de insumos requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("review_feed_input_lot", {
    p_lot_id: payload.lotId,
    p_quality_status: payload.qualityStatus,
    p_quality_notes: payload.qualityNotes,
  });
  assertDatabaseResult(error, "No se pudo actualizar el control de calidad");
}

export async function registerFeedInputPrice(payload: {
  inputId: string;
  costPerKg: number;
  effectiveAt: string;
  supplierName: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("El módulo Molino requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("register_feed_input_price", {
    p_input_id: payload.inputId,
    p_cost_per_kg: payload.costPerKg,
    p_effective_at: payload.effectiveAt,
    p_supplier_name: payload.supplierName,
  });
  assertDatabaseResult(error, "No se pudo registrar el precio del insumo");
}

export async function createFeedFormulaVersion(payload: {
  formulaId: string;
  targetKg: number;
  notes: string;
  items: Array<{ inputId: string; quantityKg: number }>;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("El módulo Molino requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("create_feed_formula_version", {
    p_formula_id: payload.formulaId,
    p_target_kg: payload.targetKg,
    p_notes: payload.notes,
    p_items: payload.items,
  });
  assertDatabaseResult(error, "No se pudo crear la versión de fórmula");
}

export async function approveFeedFormulaVersion(versionId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("El módulo Molino requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("approve_feed_formula_version", {
    p_version_id: versionId,
  });
  assertDatabaseResult(error, "No se pudo aprobar la fórmula");
}

export async function createMillBatch(payload: {
  versionId: string;
  locationId: string;
  usage: MillBatchUsage;
  producedKg: number;
  producedAt: string;
  notes: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("El módulo Molino requiere Supabase activo.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("create_mill_batch", {
    p_version_id: payload.versionId,
    p_location_id: payload.locationId,
    p_usage: payload.usage,
    p_produced_kg: payload.producedKg,
    p_produced_at: payload.producedAt,
    p_notes: payload.notes,
  });
  assertDatabaseResult(error, "No se pudo registrar el lote de alimento");
}

export async function getAuditWorkspace(): Promise<AuditWorkspace> {
  if (!isSupabaseConfigured()) {
    return {
      issues: [],
      events: [],
      criticalCount: 0,
      warningCount: 0,
      auditEventCount: 0,
      traceableInventoryLots: 0,
      totalInventoryLots: 0,
      approvedInputKg: 0,
      producedFeedKg: 0,
      controlledCommercialLots: 0,
      approvedCommercialLots: 0,
      reconciledRevenue: 0,
      accountsReceivable: 0,
      auditedMargin: 0,
    };
  }

  const supabase = await createSupabaseClient();
  const [inventoryResult, inputLotsResult, formulasResult, millResult, birdEventsResult, ordersResult, eventsResult, financeWorkspace] =
    await Promise.all([
      supabase
        .from("inventory_lots")
        .select("id, code, origin_type, supplier_name, supplier_document, supplier_lot_code, arrival_temperature_c, storage_temperature_c, sanitary_status, unit_cost, quantity, status, products(name)"),
      supabase
        .from("feed_input_lots")
        .select("*, feed_inputs(name), suppliers(name, tax_id), locations(name)"),
      supabase.from("feed_formula_versions").select("id, status"),
      supabase.from("mill_batches").select("id, code, produced_kg, mill_batch_input_consumptions(id)"),
      supabase.from("bird_batch_events").select("id, event_type, feed_kg, amount"),
      supabase
        .from("orders")
        .select("id, number, status, order_items(cost_total)")
        .in("status", ["confirmed", "preparing", "dispatched", "delivered"]),
      supabase.from("audit_events").select("id, action, entity, created_at").order("created_at", { ascending: false }).limit(30),
      getFinanceWorkspace(),
    ]);

  assertDatabaseResult(inventoryResult.error, "No se pudo auditar inventario");
  assertDatabaseResult(inputLotsResult.error, "No se pudo auditar insumos");
  assertDatabaseResult(formulasResult.error, "No se pudo auditar formulas");
  assertDatabaseResult(millResult.error, "No se pudo auditar produccion de alimento");
  assertDatabaseResult(birdEventsResult.error, "No se pudo auditar alimentacion avicola");
  assertDatabaseResult(ordersResult.error, "No se pudo auditar pedidos");
  assertDatabaseResult(eventsResult.error, "No se pudo leer bitacora de auditoria");

  const inventoryLots = (inventoryResult.data ?? []) as unknown as Array<{
    id: string; code: string; origin_type: Product["originType"]; supplier_name: string | null;
    unit_cost: number | string | null; quantity: number | string; status: InventoryLot["status"];
    supplier_document: string | null; supplier_lot_code: string | null;
    arrival_temperature_c: number | string | null; storage_temperature_c: number | string | null;
    sanitary_status: InventorySanitaryStatus | null;
    products: { name: string } | null;
  }>;
  const inputLots = (inputLotsResult.data as unknown as FeedInputLotRow[]).map(feedInputLotFromRow);
  const formulas = (formulasResult.data ?? []) as Array<{ id: string; status: FeedFormulaStatus }>;
  const millBatches = (millResult.data ?? []) as unknown as Array<{
    id: string;
    code: string;
    produced_kg: number | string;
    mill_batch_input_consumptions: Array<{ id: string }>;
  }>;
  const birdFeedEvents = (birdEventsResult.data ?? []) as Array<{
    id: string; event_type: string; feed_kg: number | string | null; amount: number | string | null;
  }>;
  const controlledOrders = (ordersResult.data ?? []) as Array<{
    id: string; number: string; status: Order["status"]; order_items: Array<{ cost_total: number | string | null }>;
  }>;
  const issues: AuditIssue[] = [];

  for (const lot of inventoryLots) {
    if (Number(lot.quantity) > 0 && lot.unit_cost === null) {
      issues.push({
        id: `inventory-cost-${lot.id}`,
        severity: "critical" as const,
        area: "Inventario",
        title: `${lot.code} sin costo unitario`,
        detail: `El lote ${lot.products?.name ?? "comercial"} no permite calcular margen real.`,
        href: "/gestion/inventario",
      });
    }
    if (lot.status === "quarantine") {
      issues.push({
        id: `inventory-quality-${lot.id}`,
        severity: "warning" as const,
        area: "Calidad",
        title: `${lot.code} en cuarentena`,
        detail: "Requiere liberacion o descarte documentado antes de venta.",
        href: "/gestion/inventario",
      });
    }
  }

  const purchasedInventoryLots = inventoryLots.filter((lot) => lot.origin_type !== "own");
  for (const lot of purchasedInventoryLots) {
    if (
      !lot.supplier_document ||
      !lot.supplier_lot_code ||
      lot.arrival_temperature_c === null ||
      lot.storage_temperature_c === null
    ) {
      issues.push({
        id: `supplier-evidence-${lot.id}`,
        severity: "critical",
        area: "Cadena de frio",
        title: `${lot.code} sin expediente completo`,
        detail: "Falta documento, lote del proveedor o temperaturas verificables de recepcion y almacenamiento.",
        href: "/gestion/inventario",
      });
    } else if (lot.sanitary_status !== "approved") {
      issues.push({
        id: `supplier-release-${lot.id}`,
        severity: lot.sanitary_status === "rejected" ? "critical" : "warning",
        area: "Calidad",
        title: `${lot.code}: ${lot.sanitary_status === "rejected" ? "recepcion rechazada" : "liberacion pendiente"}`,
        detail: "El producto comprado permanece bloqueado para despacho hasta completar la revision sanitaria.",
        href: "/gestion/inventario",
      });
    }
  }

  for (const lot of inputLots) {
    if (lot.qualityStatus !== "approved" && lot.availableKg > 0) {
      issues.push({
        id: `input-quality-${lot.id}`,
        severity: lot.qualityStatus === "rejected" ? "critical" as const : "warning" as const,
        area: "Molino",
        title: `${lot.code}: ${lot.qualityStatus === "rejected" ? "insumo rechazado" : "calidad pendiente"}`,
        detail: `${lot.inputName} de ${lot.supplierName}; no puede entrar a formula productiva.`,
        href: "/gestion/molino",
      });
    }
  }

  const unvaluedFeed = birdFeedEvents.filter(
    (event) => event.event_type === "feed_consumption" && event.feed_kg !== null && event.amount === null,
  );
  if (unvaluedFeed.length > 0) {
    issues.push({
      id: "broiler-feed-cost",
      severity: "critical" as const,
      area: "Crianza",
      title: `${unvaluedFeed.length} consumos de alimento sin valorizar`,
      detail: "El costo productivo del pollo no esta completo para auditoria.",
      href: "/gestion/crianza",
    });
  }

  const untracedMillBatches = millBatches.filter(
    (batch) => (batch.mill_batch_input_consumptions ?? []).length === 0,
  );
  if (untracedMillBatches.length > 0) {
    issues.push({
      id: "mill-input-history",
      severity: "warning",
      area: "Molino",
      title: `${untracedMillBatches.length} lotes molidos sin insumos vinculados`,
      detail: "Los lotes producidos antes del control FIFO conservan costo, pero no expediente completo de materia prima.",
      href: "/gestion/molino",
    });
  }

  const costlessOrders = controlledOrders.filter((order) =>
    order.order_items.some((item) => item.cost_total === null),
  );
  if (costlessOrders.length > 0) {
    issues.push({
      id: "order-margin",
      severity: "critical" as const,
      area: "Ventas",
      title: `${costlessOrders.length} pedidos operativos sin costo completo`,
      detail: "No se puede certificar margen hasta asignar lotes valorizados.",
      href: "/gestion/pedidos",
    });
  }

  const deliveredFinancialOrders = financeWorkspace.orders.filter((order) => order.status === "delivered");
  for (const order of deliveredFinancialOrders) {
    if (order.total !== null && order.reconciledAmount < order.total) {
      issues.push({
        id: `payment-balance-${order.id}`,
        severity: "critical",
        area: "Finanzas",
        title: `${order.number} con saldo no conciliado`,
        detail: `Falta conciliar S/ ${(order.total - order.reconciledAmount).toFixed(2)} de una entrega finalizada.`,
        href: "/gestion/finanzas",
      });
    }
    if (!order.receipt) {
      issues.push({
        id: `receipt-missing-${order.id}`,
        severity: "critical",
        area: "Tributario",
        title: `${order.number} entregado sin comprobante`,
        detail: "Registra boleta o factura para sustentar el ingreso reconocido.",
        href: "/gestion/finanzas",
      });
    }
    if (order.deliveryFee > 0 && !order.expenses.some((expense) => expense.category === "delivery")) {
      issues.push({
        id: `delivery-cost-${order.id}`,
        severity: "warning",
        area: "Margen",
        title: `${order.number} sin costo de reparto`,
        detail: "El margen no incorpora el costo real de entregar el pedido.",
        href: "/gestion/finanzas",
      });
    }
  }
  if (financeWorkspace.pendingReconciliationCount > 0) {
    issues.push({
      id: "payment-review-pending",
      severity: "warning",
      area: "Finanzas",
      title: `${financeWorkspace.pendingReconciliationCount} cobros esperan conciliacion`,
      detail: "Confirma operaciones contra Yape, Plin o transferencia antes del cierre.",
      href: "/gestion/finanzas",
    });
  }

  if (!formulas.some((formula) => formula.status === "approved")) {
    issues.push({
      id: "formula-approved",
      severity: "warning" as const,
      area: "Molino",
      title: "No existe formula aprobada",
      detail: "Corrige y aprueba una version antes de producir alimento interno.",
      href: "/gestion/molino",
    });
  }

  return {
    issues,
    events: ((eventsResult.data ?? []) as AuditEventRow[]).map((event) => ({
      id: event.id,
      action: event.action,
      entity: event.entity,
      createdAt: event.created_at,
    })),
    criticalCount: issues.filter((issue) => issue.severity === "critical").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    auditEventCount: (eventsResult.data ?? []).length,
    traceableInventoryLots: inventoryLots.filter(
      (lot) => lot.unit_cost !== null && (lot.origin_type === "own" || lot.sanitary_status === "approved"),
    ).length,
    totalInventoryLots: inventoryLots.length,
    approvedInputKg: inputLots
      .filter((lot) => lot.qualityStatus === "approved")
      .reduce((sum, lot) => sum + lot.availableKg, 0),
    producedFeedKg: millBatches.reduce((sum, batch) => sum + Number(batch.produced_kg), 0),
    controlledCommercialLots: purchasedInventoryLots.length,
    approvedCommercialLots: purchasedInventoryLots.filter((lot) => lot.sanitary_status === "approved").length,
    reconciledRevenue: financeWorkspace.reconciledRevenue,
    accountsReceivable: financeWorkspace.accountsReceivable,
    auditedMargin: financeWorkspace.auditableMargin,
  };
}
