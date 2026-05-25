import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type {
  BusinessLocation,
  BirdBatch,
  BirdBatchEvent,
  BirdBatchStage,
  CommerceState,
  Customer,
  CustomerMetrics,
  DeliveryZone,
  DispatchableOrderItem,
  InventoryLot,
  InventoryMovement,
  InventoryUnit,
  InventoryWorkspace,
  Order,
  PaymentMethod,
  Product,
  PoultryWorkspace,
  StaffRole,
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
  source_bird_batch_id?: string | null;
  processed_units?: number | string | null;
  created_at: string;
  products: { name: string; presentation: string } | null;
  locations: { name: string } | null;
  bird_batches?: { code: string } | null;
  inventory_movements: InventoryMovementRow[];
};

type BirdBatchEventRow = {
  id: string;
  event_type: BirdBatchEvent["type"];
  event_at: string;
  count: number | null;
  avg_weight_grams: number | string | null;
  feed_kg: number | string | null;
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
    sourceBirdBatchId: row.source_bird_batch_id ?? null,
    sourceBirdBatchCode: row.bird_batches?.code ?? null,
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
        stage: event.stage,
        notes: event.notes ?? "",
      }))
      .sort((a, b) => b.eventAt.localeCompare(a.eventAt)),
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
  const { data, error } = await supabase
    .from("orders")
    .update({ status: updates.status })
    .eq("id", id)
    .select("*, customers(name, phone), order_items(*, products(name, presentation), inventory_lots(code))")
    .single();
  assertDatabaseResult(error, "No se pudo actualizar el pedido");
  return orderFromRow(data as unknown as OrderRow);
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
    };
  }

  const supabase = await createSupabaseClient();
  const [lotsResult, ordersResult] = await Promise.all([
    supabase
      .from("inventory_lots")
      .select("*, products(name, presentation), locations(name), bird_batches(code), inventory_movements(*)")
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
    activeLotCount: lots.filter((lot) => lot.quantity > 0 && lot.status === "available").length,
    expiringLotCount,
    pendingAssignmentCount: pendingAssignments.length,
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
    p_notes: payload.notes,
  });
  assertDatabaseResult(error, "No se pudo registrar el lote");
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
    .select("*, locations(name), bird_batch_events(*)")
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
  type: "mortality" | "weight_sample" | "feed_consumption" | "stage_change";
  eventAt: string;
  count: number | null;
  avgWeightGrams: number | null;
  feedKg: number | null;
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
    p_stage: payload.stage,
    p_notes: payload.notes,
  });
  assertDatabaseResult(error, "No se pudo registrar el evento de crianza");
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
