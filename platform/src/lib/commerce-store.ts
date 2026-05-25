import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type {
  BusinessLocation,
  CommerceState,
  Customer,
  CustomerMetrics,
  DeliveryZone,
  Order,
  PaymentMethod,
  Product,
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
    products: { name: string; presentation: string } | null;
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
        .select("*, customers(name, phone), order_items(*, products(name, presentation))")
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
    .select("*, customers(name, phone), order_items(*, products(name, presentation))")
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
      .select("*, customers(name, phone), order_items(*, products(name, presentation))")
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
